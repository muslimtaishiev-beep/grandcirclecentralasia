import { Router } from "express";
import admin from "firebase-admin";
import { createHash, randomBytes } from "crypto";
import {
  ALL_PERMISSION_KEYS, ORG_MODULES, PERMISSIONS, hasFullAccess, isPermissionKey, migrateLegacyPermissions,
  type PermissionKey,
} from "../shared/permissions.js";
import { requireFirebaseAuth } from "./authRoutes.js";
import { accessChangeDenied, hasPerm, membershipsOf, pickStrongest, staffCaller, type StaffCaller } from "../server/access.js";
import { syncClaims } from "../server/claims.js";
import { forgetAccount, revokeAllSessions } from "../server/session.js";
import { checkTenantOpen, invalidateTenant } from "../server/tenantAccess.js";
import { AUDIT_ACTIONS, actorOf, writeAudit, type AuditSection } from "../server/audit.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
import { applyBulk, classesText, levelsOf, mergeDirectory, placementOf, sanitizeDirectory, sanitizePlacement, LEVEL_LABEL, type StaffDirectory, type StaffPlacement } from "../shared/staffPlacement.js";

/**
 * Администрирование организации: сотрудники, их доступ и входы, действия над
 * учётной записью, отчёт «у кого есть право», владение, журнал действий,
 * обзор настройки, ключ API. Организация — только из пути (:id).
 */
const router = Router();
const db = () => admin.firestore();
type Db = FirebaseFirestore.Firestore;

const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });
const isOwnerRole = (r: unknown) => ["owner", "org:owner"].includes(String(r || ""));
const permLabel = (k: string) => PERMISSIONS.find(p => p.key === k)?.label || k;
const ROLE_NAMES: Record<string, string> = { "org:owner": "Владелец", owner: "Владелец", "org:admin": "Администратор", admin: "Администратор", superadmin: "Суперадмин" };
const roleName = (r: unknown) => ROLE_NAMES[String(r || "")] || String(r || "Сотрудник");

/** Сотрудник организации с одним из прав; кладёт req.caller. Закрытая организация — отказ. */
const need = (...anyOf: PermissionKey[]) => async (req: any, res: any, next: any) => {
  try {
    const t = String(req.params.id || "");
    const c = await staffCaller(db(), t, req.user);
    if (!c?.member) return fail(res, 403, "Доступно только сотрудникам организации");
    if (anyOf.length && !hasPerm(c, ...anyOf)) return fail(res, 403, `Нужно право ${anyOf.map(p => `«${permLabel(p)}»`).join(" или ")}`);
    if (req.user?.isSuperadmin !== true) {
      const gate = await checkTenantOpen(t);
      if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error, reason: gate.reason });
    }
    req.caller = c;
    next();
  } catch (e: any) {
    console.error("[admin] access", e);
    return fail(res, 500, "Не удалось проверить доступ");
  }
};

const ms = (v: any): number => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : v ? Date.parse(String(v)) || 0 : 0);

/** Учётные записи Auth пачками по 100. */
async function authUsers(uids: string[]): Promise<Map<string, admin.auth.UserRecord>> {
  const out = new Map<string, admin.auth.UserRecord>();
  for (let i = 0; i < uids.length; i += 100) {
    try {
      const r = await admin.auth().getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
      for (const u of r.users) out.set(u.uid, u);
    } catch (e: any) { console.error("[admin] getUsers", e?.message); }
  }
  return out;
}

/** Членства организации: по одному (самому сильному) на человека. */
async function tenantMembers(t: string): Promise<any[]> {
  const snap = await db().collection("memberships").where("tenantId", "==", t).get();
  const byUser = new Map<string, any[]>();
  for (const d of snap.docs) {
    const m = { id: d.id, ...d.data() } as any;
    if (!m.userId) continue;
    const list = byUser.get(String(m.userId)) || [];
    list.push(m);
    byUser.set(String(m.userId), list);
  }
  return [...byUser.values()].map(list => {
    const active = list.filter(m => m.status === "active");
    return pickStrongest(active.length ? active : list);
  }).filter(Boolean);
}

type StaffStatus = "active" | "invited" | "suspended";
const statusOf = (m: any, u?: admin.auth.UserRecord): StaffStatus =>
  m.status === "suspended" ? "suspended" : u && !u.metadata?.lastSignInTime ? "invited" : "active";

/** Последний вход: Auth (lastSignInTime / lastRefreshTime). */
const lastSeen = (u?: admin.auth.UserRecord): number => {
  const a = Date.parse(String(u?.metadata?.lastRefreshTime || "")) || 0;
  const b = Date.parse(String(u?.metadata?.lastSignInTime || "")) || 0;
  return Math.max(a, b);
};

/** Права с причинами: откуда у сотрудника каждое право и выключено ли оно модулем. */
async function accessOf(t: string, m: any, disabledModules: string[], roleCache = new Map<string, any>()) {
  const full = hasFullAccess(m.role);
  let role: { id: string; name: string; perms: Set<string> } | null = null;
  if (!full && m.customRoleId) {
    const id = String(m.customRoleId);
    if (!roleCache.has(id)) {
      const r = await db().collection("custom_roles").doc(id).get();
      roleCache.set(id, r.exists && r.data()?.tenantId === t ? { id, name: String(r.data()?.name || ""), perms: new Set((r.data()?.permissions || []).filter(isPermissionKey)) } : null);
    }
    role = roleCache.get(id);
  }
  const personal = new Set<string>(full ? [] : migrateLegacyPermissions(m));
  const off = new Set<string>(ORG_MODULES.filter(x => disabledModules.includes(x.key)).flatMap(x => x.permissions));
  const rows = ALL_PERMISSION_KEYS.map(k => {
    const via: string[] = [];
    if (full) via.push(`role:${roleName(m.role)}`);
    if (role?.perms.has(k)) via.push(`position:${role.name}`);
    if (personal.has(k)) via.push("personal");
    return { key: k, label: permLabel(k), granted: via.length > 0 && !off.has(k), via, moduleOff: off.has(k) };
  });
  return { full, role: role ? { id: role.id, name: role.name } : null, permissions: rows };
}

const disabledModulesOf = async (t: string): Promise<string[]> => {
  const s = await db().collection("tenants").doc(t).get();
  return Array.isArray(s.data()?.disabledModules) ? s.data()!.disabledModules.map(String) : [];
};

// ─────────────────────── Сотрудники ───────────────────────

/** GET /api/tenants/:id/staff — список сотрудников. */
router.get("/:id/staff", requireFirebaseAuth, need("team:view", "team:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const members = await tenantMembers(t);
    const users = await authUsers(members.map(m => String(m.userId)));
    const roles = new Map<string, string>();
    const teacherRoles = new Set<string>();
    for (const id of new Set(members.map(m => m.customRoleId).filter(Boolean).map(String))) {
      const r = await db().collection("custom_roles").doc(id).get();
      if (r.exists && r.data()?.tenantId === t) { roles.set(id, String(r.data()?.name || "")); if (r.data()?.teacher === true) teacherRoles.add(id); }
    }
    const depts = new Map<string, string>();
    try {
      for (const d of (await db().collection("departments").where("tenantId", "==", t).get()).docs) depts.set(d.id, String(d.data()?.name || ""));
    } catch (e: any) { console.error("[admin] departments", e?.message); }
    const staff = members.map(m => {
      const u = users.get(String(m.userId));
      return {
        uid: String(m.userId),
        membershipId: m.id,
        name: String(m.displayName || u?.displayName || u?.email || "").slice(0, 120),
        email: u?.email || "",
        role: String(m.role || ""),
        roleName: m.customRoleId ? roles.get(String(m.customRoleId)) || roleName(m.role) : roleName(m.role),
        customRoleId: m.customRoleId || null,
        systemRole: hasFullAccess(m.role) ? (isOwnerRole(m.role) ? "owner" : "admin") : null,
        departmentId: m.departmentId || null,
        departmentName: m.departmentId ? depts.get(String(m.departmentId)) || "" : "",
        status: statusOf(m, u),
        lastSeenAt: lastSeen(u) || null,
        joinedAt: ms(m.joinedAt) || null,
        personalPermissions: migrateLegacyPermissions(m).length,
        placement: placementOf(m),
        /** Должность учителя — классы нужно указать. */
        teacher: !!m.customRoleId && teacherRoles.has(String(m.customRoleId)),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return res.json({ success: true, staff, canManage: hasPerm(req.caller, "team:manage"), directory: await staffDirectory(t) });
  } catch (e: any) {
    console.error("[admin] staff", e);
    return fail(res, 500, "Не удалось загрузить сотрудников");
  }
});

/** Сотрудник этой организации по uid или 404. */
async function memberOr404(t: string, uid: string, res: any): Promise<any | null> {
  const list = await membershipsOf(db(), uid, t);
  if (!list.length) { fail(res, 404, "Сотрудник не найден"); return null; }
  const active = list.filter(m => m.status === "active");
  return { ...pickStrongest(active.length ? active : list), _all: list };
}

/** GET /api/tenants/:id/staff/:uid — карточка: доступ, активность, входы. */
router.get("/:id/staff/:uid", requireFirebaseAuth, need("team:view", "team:manage"), async (req: any, res: any) => {
  try {
    const { id: t, uid } = req.params;
    const m = await memberOr404(t, uid, res);
    if (!m) return;
    const u = (await authUsers([uid])).get(uid);
    const access = await accessOf(t, m, await disabledModulesOf(t));
    const audit = db().collection("tenants").doc(t).collection("audit");
    const [byHim, aboutHim, logins] = await Promise.all([
      audit.where("actorUid", "==", uid).limit(500).get(),
      audit.where("targetId", "==", uid).limit(500).get(),
      db().collection("login_events").where("uid", "==", uid).limit(500).get(),
    ]);
    const ev = (d: any) => ({ id: d.id, ...d.data(), actionLabel: AUDIT_ACTIONS[d.data().action] || d.data().action });
    const recent = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(ev).sort((a: any, b: any) => b.at - a.at).slice(0, 50);
    return res.json({
      success: true,
      staff: {
        uid, membershipId: m.id, name: String(m.displayName || u?.displayName || ""), email: u?.email || "",
        role: String(m.role || ""), roleName: access.role?.name || roleName(m.role), customRoleId: m.customRoleId || null,
        systemRole: hasFullAccess(m.role) ? (isOwnerRole(m.role) ? "owner" : "admin") : null,
        status: statusOf(m, u), lastSeenAt: lastSeen(u) || null, joinedAt: ms(m.joinedAt) || null,
        invitedBy: m.invitedBy || null, suspendedAt: ms(m.suspendedAt) || null,
        isSelf: uid === req.user.uid,
        placement: placementOf(m),
        teacher: !!m.customRoleId && (await db().collection("custom_roles").doc(String(m.customRoleId)).get()).data()?.teacher === true,
      },
      directory: await staffDirectory(t),
      access,
      member: { id: m.id, role: m.role || "", customRoleId: m.customRoleId || null, permissions: m.permissions ?? null, customPermissions: m.customPermissions ?? null },
      activity: recent(byHim),
      history: recent(aboutHim),
      logins: logins.docs.map(d => d.data() as any).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30)
        .map(x => ({ at: x.at || 0, device: x.device || "", ip: x.ip || "", status: x.status || "" })),
      canManage: hasPerm(req.caller, "team:manage"),
    });
  } catch (e: any) {
    console.error("[admin] staff card", e);
    return fail(res, 500, "Не удалось загрузить сотрудника");
  }
});

// ─────────────────────── Где работает ───────────────────────

const dirRef = (t: string) => db().collection("tenants").doc(t).collection("edu_settings").doc("staffDirectory");
async function staffDirectory(t: string): Promise<StaffDirectory> {
  return sanitizeDirectory((await dirRef(t).get()).data());
}
const placementRows = (a: StaffPlacement, b: StaffPlacement): { label: string; from: string; to: string }[] => [
  ["Классы", classesText(a), classesText(b)],
  ["Ступени", levelsOf(a).map(l => LEVEL_LABEL[l]).join(", "), levelsOf(b).map(l => LEVEL_LABEL[l]).join(", ")],
  ["Предметы", a.subjects.join(", "), b.subjects.join(", ")],
  ["Группы", a.groups.join(", "), b.groups.join(", ")],
].filter(([, x, y]) => x !== y).map(([label, from, to]) => ({ label, from, to }));

/** Все документы членства сотрудника в организации получают одно место работы. */
async function writePlacement(t: string, uid: string, p: StaffPlacement) {
  const list = await membershipsOf(db(), uid, t);
  await Promise.all(list.map(m => db().collection("memberships").doc(m.id).update({ grades: p.grades, classes: p.classes, levels: p.levels, subjects: p.subjects, groups: p.groups })));
}

/** PUT /api/tenants/:id/staff/:uid/placement — классы, ступени, предметы, группы. Себе тоже можно. */
router.put("/:id/staff/:uid/placement", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const { id: t, uid } = req.params;
    const m = await memberOr404(t, uid, res);
    if (!m) return;
    const before = placementOf(m);
    const next = sanitizePlacement(req.body?.placement);
    await writePlacement(t, uid, next);
    await dirRef(t).set(mergeDirectory(await staffDirectory(t), next), { merge: true });
    const changes = placementRows(before, next);
    if (changes.length) await writeAudit(db(), t, { actor: actorOf(req.user), action: "staff.placement", section: "staff", target: { kind: "member", id: uid, name: String(m.displayName || "") }, changes });
    return res.json({ success: true, placement: next });
  } catch (e: any) { console.error("[admin] placement", e); return fail(res, 500, "Не удалось сохранить"); }
});

/** POST /api/tenants/:id/staff-placement — пачкой: { uids, add, remove } (отметить или снять у нескольких). */
router.post("/:id/staff-placement", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const uids = [...new Set((Array.isArray(req.body?.uids) ? req.body.uids : []).map(String))].slice(0, 300) as string[];
    if (!uids.length) return fail(res, 400, "Выберите сотрудников");
    const add = sanitizePlacement(req.body?.add); const remove = sanitizePlacement(req.body?.remove);
    // Литеры в «убрать» не уводят параллель: снимаются только они.
    remove.grades = (Array.isArray(req.body?.remove?.grades) ? req.body.remove.grades : []).map(Number).filter((g: number) => g >= 1 && g <= 11);
    let done = 0;
    for (const uid of uids) {
      const list = await membershipsOf(db(), uid, t);
      if (!list.length) continue;
      const m = pickStrongest(list);
      const before = placementOf(m);
      const next = applyBulk(before, add, remove);
      await writePlacement(t, uid, next);
      const changes = placementRows(before, next);
      if (changes.length) await writeAudit(db(), t, { actor: actorOf(req.user), action: "staff.placement", section: "staff", target: { kind: "member", id: uid, name: String(m.displayName || "") }, changes, detail: "Массовая отметка" });
      done++;
    }
    await dirRef(t).set(mergeDirectory(await staffDirectory(t), add), { merge: true });
    return res.json({ success: true, done });
  } catch (e: any) { console.error("[admin] placement bulk", e); return fail(res, 500, "Не удалось сохранить"); }
});

/** Справочник предметов и групп организации. */
router.get("/:id/staff-directory", requireFirebaseAuth, need("team:view", "team:manage"), async (req: any, res: any) => {
  try { return res.json({ success: true, directory: await staffDirectory(req.params.id) }); }
  catch (e: any) { console.error("[admin] directory", e); return fail(res, 500, "Не удалось загрузить"); }
});
router.put("/:id/staff-directory", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const next = sanitizeDirectory(req.body?.directory);
    await dirRef(t).set(next);
    await writeAudit(db(), t, { actor: actorOf(req.user), action: "staff.directory", section: "settings", target: { kind: "settings", id: "staffDirectory", name: "Предметы и группы" }, detail: `Предметов: ${next.subjects.length}, групп: ${next.groups.length}` });
    return res.json({ success: true, directory: next });
  } catch (e: any) { console.error("[admin] directory", e); return fail(res, 500, "Не удалось сохранить"); }
});

/** Цель действия + защита: себя нельзя, владельца — только владелец, шире своих прав — нельзя. */
async function actionTarget(req: any, res: any): Promise<any | null> {
  const { id: t, uid } = req.params;
  const m = await memberOr404(t, uid, res);
  if (!m) return null;
  const denied = await accessChangeDenied(db(), req.user, t, m, []);
  if (denied) { fail(res, 403, denied); return null; }
  return m;
}

const audited = (req: any, m: any, action: string, section: AuditSection = "staff", detail = "") =>
  writeAudit(db(), req.params.id, { actor: actorOf(req.user), action, section, target: { kind: "member", id: String(m.userId), name: String(m.displayName || "") }, ...(detail ? { detail } : {}) });

async function resync(uid: string): Promise<boolean> {
  forgetAccount(uid);
  for (let i = 0; i < 2; i++) {
    try { await syncClaims(db(), uid); return true; } catch (e: any) { console.error("[admin] claims", e?.message); }
  }
  return false;
}

/** POST /api/tenants/:id/staff/:uid/suspend — отключить: доступ закрыт, сеансы завершены. */
router.post("/:id/staff/:uid/suspend", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const m = await actionTarget(req, res);
    if (!m) return;
    if (m.status === "suspended") return fail(res, 409, "Сотрудник уже отключён");
    const batch = db().batch();
    for (const x of m._all) batch.update(db().collection("memberships").doc(x.id), {
      status: "suspended", suspendedAt: Date.now(), suspendedBy: req.user.uid, statusBefore: x.status || "active",
    });
    await batch.commit();
    const claimsSynced = await resync(String(m.userId));
    await revokeAllSessions(String(m.userId)).catch(e => console.error("[admin] revoke", e?.message));
    await audited(req, m, "staff.suspend", "staff", String(req.body?.reason || "").slice(0, 200));
    return res.json({ success: true, status: "suspended", claimsSynced });
  } catch (e: any) {
    console.error("[admin] suspend", e);
    return fail(res, 500, "Не удалось отключить сотрудника");
  }
});

/** POST /api/tenants/:id/staff/:uid/resume — включить обратно. */
router.post("/:id/staff/:uid/resume", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const m = await actionTarget(req, res);
    if (!m) return;
    const off = m._all.filter((x: any) => x.status === "suspended");
    if (!off.length) return fail(res, 409, "Сотрудник не отключён");
    const batch = db().batch();
    for (const x of off) batch.update(db().collection("memberships").doc(x.id), {
      status: "active", suspendedAt: admin.firestore.FieldValue.delete(), suspendedBy: admin.firestore.FieldValue.delete(), statusBefore: admin.firestore.FieldValue.delete(),
    });
    await batch.commit();
    const claimsSynced = await resync(String(m.userId));
    await audited(req, m, "staff.resume");
    return res.json({ success: true, status: "active", claimsSynced });
  } catch (e: any) {
    console.error("[admin] resume", e);
    return fail(res, 500, "Не удалось включить сотрудника");
  }
});

/** DELETE /api/tenants/:id/staff/:uid — удалить из организации (учётная запись остаётся). */
router.delete("/:id/staff/:uid", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const m = await actionTarget(req, res);
    if (!m) return;
    if (m._all.some((x: any) => isOwnerRole(x.role))) return fail(res, 403, "Владельца нельзя удалить — сначала передайте владение");
    const batch = db().batch();
    for (const x of m._all) batch.delete(db().collection("memberships").doc(x.id));
    await batch.commit();
    const claimsSynced = await resync(String(m.userId));
    await revokeAllSessions(String(m.userId)).catch(e => console.error("[admin] revoke", e?.message));
    await audited(req, m, "staff.remove", "staff", `${roleName(m.role)}`);
    return res.json({ success: true, claimsSynced });
  } catch (e: any) {
    console.error("[admin] remove", e);
    return fail(res, 500, "Не удалось удалить сотрудника");
  }
});

/** POST /api/tenants/:id/staff/:uid/revoke-sessions — выйти на всех устройствах. */
router.post("/:id/staff/:uid/revoke-sessions", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const m = await actionTarget(req, res);
    if (!m) return;
    await revokeAllSessions(String(m.userId));
    await audited(req, m, "staff.sessions", "security");
    return res.json({ success: true });
  } catch (e: any) {
    console.error("[admin] sessions", e);
    return fail(res, 500, "Не удалось завершить сеансы");
  }
});

/**
 * Письмо «установить / сменить пароль» на почту учётной записи. Ссылка
 * уходит только владельцу почты — наружу её не отдаём никогда.
 */
async function sendPasswordEmail(email: string): Promise<boolean> {
  const key = process.env.VITE_FIREBASE_API_KEY;
  if (!key || !email) return false;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
    });
    return r.ok;
  } catch (e: any) {
    console.error("[admin] password email", e?.message);
    return false;
  }
}

/** Читаемый временный пароль: без похожих символов (0/O, 1/l). */
function tempPassword(): string {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, x => abc[x % abc.length]).join("");
}

/**
 * POST /api/tenants/:id/staff/:uid/reset-password
 * mode "email" (по умолчанию) — сотруднику письмо со ссылкой смены пароля.
 * mode "set" — пароль задаёт администратор (свой или созданный системой),
 * все сеансы сотрудника завершаются. Только если учётная запись не состоит
 * в других организациях: иначе админ одной школы получил бы вход в чужую.
 */
router.post("/:id/staff/:uid/reset-password", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const m = await actionTarget(req, res);
    if (!m) return;
    const uid = String(m.userId);
    const u = (await authUsers([uid])).get(uid);
    if (!u) return fail(res, 404, "Учётная запись не найдена");
    const mode = req.body?.mode === "set" ? "set" : "email";

    if (mode === "email") {
      if (!u.email) return fail(res, 409, "У сотрудника нет почты — задайте пароль сами");
      if (!(await sendPasswordEmail(u.email))) return fail(res, 502, "Письмо не отправилось — попробуйте позже");
      await audited(req, m, "staff.password", "security", u.email);
      return res.json({ success: true, mode, sentTo: u.email });
    }

    if (req.user?.isSuperadmin !== true) {
      const all = await db().collection("memberships").where("userId", "==", uid).get();
      const other = all.docs.some(d => String(d.data().tenantId) !== String(req.params.id) && d.data().status !== "removed");
      if (other) return fail(res, 409, "Сотрудник состоит и в других организациях — пароль можно сменить только письмом на его почту");
    }
    const typed = typeof req.body?.password === "string" ? req.body.password : "";
    if (typed && (typed.length < 8 || typed.length > 128)) return fail(res, 400, "Пароль — от 8 до 128 символов");
    const password = typed || tempPassword();
    await admin.auth().updateUser(uid, { password });
    await revokeAllSessions(uid);
    forgetAccount(uid);
    await audited(req, m, "staff.password.set", "security", typed ? "задан администратором" : "создан системой");
    // Пароль возвращается только тот, что создал сервер: свой администратор и так знает.
    return res.json({ success: true, mode, ...(typed ? {} : { password }) });
  } catch (e: any) {
    console.error("[admin] reset", e);
    return fail(res, 500, "Не удалось сменить пароль");
  }
});

/** Приглашён, но ни разу не входил. */
async function pendingInvite(req: any, res: any): Promise<{ m: any; u: admin.auth.UserRecord } | null> {
  const m = await actionTarget(req, res);
  if (!m) return null;
  const u = (await authUsers([String(m.userId)])).get(String(m.userId));
  if (!u) { fail(res, 404, "Учётная запись не найдена"); return null; }
  if (u.metadata?.lastSignInTime) { fail(res, 409, "Сотрудник уже входил — приглашение принято"); return null; }
  return { m, u };
}

/** POST /api/tenants/:id/staff/:uid/resend-invite — повторить письмо приглашения. */
router.post("/:id/staff/:uid/resend-invite", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const p = await pendingInvite(req, res);
    if (!p) return;
    if (!p.u.email) return fail(res, 409, "У сотрудника нет почты");
    if (!(await sendPasswordEmail(p.u.email))) return fail(res, 502, "Письмо не отправилось — попробуйте позже");
    await audited(req, p.m, "invite.resend", "staff", p.u.email);
    return res.json({ success: true, sentTo: p.u.email });
  } catch (e: any) {
    console.error("[admin] resend", e);
    return fail(res, 500, "Не удалось отправить приглашение");
  }
});

/** POST /api/tenants/:id/staff/:uid/revoke-invite — отозвать неиспользованное приглашение. */
router.post("/:id/staff/:uid/revoke-invite", requireFirebaseAuth, need("team:manage"), async (req: any, res: any) => {
  try {
    const p = await pendingInvite(req, res);
    if (!p) return;
    if (p.m._all.some((x: any) => isOwnerRole(x.role))) return fail(res, 403, "Владельца нельзя удалить — сначала передайте владение");
    const batch = db().batch();
    for (const x of p.m._all) batch.delete(db().collection("memberships").doc(x.id));
    await batch.commit();
    const claimsSynced = await resync(String(p.m.userId));
    await audited(req, p.m, "invite.revoke", "staff", p.u.email || "");
    return res.json({ success: true, claimsSynced });
  } catch (e: any) {
    console.error("[admin] revoke invite", e);
    return fail(res, 500, "Не удалось отозвать приглашение");
  }
});

// ─────────────────────── Кто может что ───────────────────────

/** GET /api/tenants/:id/access-report?perm= — у кого есть право и почему. */
router.get("/:id/access-report", requireFirebaseAuth, need("team:view", "team:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const only = req.query?.perm ? String(req.query.perm) : "";
    if (only && !isPermissionKey(only)) return fail(res, 400, "Нет такого права");
    const members = (await tenantMembers(t)).filter(m => m.status === "active");
    const off = await disabledModulesOf(t);
    const cache = new Map<string, any>();
    const people = await Promise.all(members.map(async m => ({ m, a: await accessOf(t, m, off, cache) })));
    const keys = only ? [only] : ALL_PERMISSION_KEYS;
    const report = keys.map(k => {
      const row = people.map(({ m, a }) => ({ m, p: a.permissions.find(x => x.key === k)! }));
      return {
        key: k, label: permLabel(k),
        moduleOff: row[0]?.p.moduleOff ?? ORG_MODULES.some(x => off.includes(x.key) && x.permissions.includes(k as PermissionKey)),
        holders: row.filter(r => r.p.via.length).map(r => ({
          uid: String(r.m.userId), name: String(r.m.displayName || ""), via: r.p.via, effective: r.p.granted,
        })),
      };
    });
    return res.json({ success: true, report });
  } catch (e: any) {
    console.error("[admin] report", e);
    return fail(res, 500, "Не удалось собрать отчёт");
  }
});

// ─────────────────────── Владение ───────────────────────

const callerIsOwner = async (req: any, t: string) =>
  req.user?.isSuperadmin === true || (await membershipsOf(db(), req.user.uid, t)).some(m => m.status === "active" && isOwnerRole(m.role));

async function makeOwner(req: any, res: any, demoteSelf: boolean) {
  const t = req.params.id;
  const uid = String(req.body?.uid || "");
  if (!(await callerIsOwner(req, t))) return fail(res, 403, "Только владелец");
  if (!uid || uid === req.user.uid) return fail(res, 400, "Выберите другого сотрудника");
  const list = await membershipsOf(db(), uid, t);
  const target = pickStrongest(list.filter(m => m.status === "active"));
  if (!target) return fail(res, 404, "Активный сотрудник не найден");
  if (isOwnerRole(target.role)) return fail(res, 409, "Сотрудник уже владелец");
  await db().collection("memberships").doc(target.id).update({
    role: "org:owner", customRoleId: admin.firestore.FieldValue.delete(), roleBefore: String(target.role || ""), updatedAt: Date.now(),
  });
  if (demoteSelf && req.user?.isSuperadmin !== true) {
    const mine = (await membershipsOf(db(), req.user.uid, t)).filter(m => m.status === "active" && isOwnerRole(m.role));
    for (const m of mine) await db().collection("memberships").doc(m.id).update({ role: "org:admin", updatedAt: Date.now() });
    await db().collection("tenants").doc(t).set({ ownerId: uid, updatedAt: Date.now() }, { merge: true });
    invalidateTenant(t);
    await resync(req.user.uid);
  }
  const claimsSynced = await resync(uid);
  await writeAudit(db(), t, {
    actor: actorOf(req.user), action: demoteSelf ? "owner.transfer" : "owner.add", section: "access",
    target: { kind: "member", id: uid, name: String(target.displayName || "") },
    changes: [{ label: "Роль", from: roleName(target.role), to: "Владелец" }, ...(demoteSelf && req.user?.isSuperadmin !== true ? [{ label: "Прежний владелец", from: "Владелец", to: "Администратор" }] : [])],
  });
  return res.json({ success: true, claimsSynced });
}

/** POST /api/tenants/:id/transfer-ownership {uid} — передать владение (сам становится администратором). */
router.post("/:id/transfer-ownership", requireFirebaseAuth, need(), async (req: any, res: any) => {
  try { return await makeOwner(req, res, true); }
  catch (e: any) { console.error("[admin] transfer", e); return fail(res, 500, "Не удалось передать владение"); }
});

/** POST /api/tenants/:id/add-owner {uid} — второй владелец. */
router.post("/:id/add-owner", requireFirebaseAuth, need(), async (req: any, res: any) => {
  try { return await makeOwner(req, res, false); }
  catch (e: any) { console.error("[admin] add owner", e); return fail(res, 500, "Не удалось добавить владельца"); }
});

// ─────────────────────── Журнал действий ───────────────────────

/**
 * GET /api/tenants/:id/audit?actor=&target=&section=&action=&from=&to=&before=&limit=
 * Страницы — по времени: before = at последней строки.
 */
router.get("/:id/audit", requireFirebaseAuth, need("audit:view"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const q = req.query || {};
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    const from = Number(q.from) || 0;
    const before = Number(q.before) || Number(q.to) || 0;
    let query: FirebaseFirestore.Query = db().collection("tenants").doc(t).collection("audit");
    if (from) query = query.where("at", ">=", from);
    if (before) query = query.where("at", "<", before);
    query = query.orderBy("at", "desc");
    const want = (x: any) => (!q.actor || x.actorUid === String(q.actor)) && (!q.target || x.targetId === String(q.target))
      && (!q.section || x.section === String(q.section)) && (!q.action || x.action === String(q.action));
    const filtered = !!(q.actor || q.target || q.section || q.action);
    const rows: any[] = [];
    let cursor: number | null = null, scanned = 0;
    // С фильтрами читаем порциями, пока не наберём страницу (не больше 2000 строк).
    for (let page = 0; page < 10 && rows.length < limit; page++) {
      const snap = await (cursor ? query.where("at", "<", cursor) : query).limit(filtered ? 200 : limit).get();
      if (snap.empty) { cursor = null; break; }
      scanned += snap.size;
      for (const d of snap.docs) {
        const x = { id: d.id, ...d.data() } as any;
        if (want(x) && rows.length < limit) rows.push({ ...x, actionLabel: AUDIT_ACTIONS[x.action] || x.action });
      }
      cursor = Number((snap.docs[snap.docs.length - 1].data() as any).at) || null;
      if (snap.size < (filtered ? 200 : limit)) { cursor = rows.length >= limit ? cursor : null; break; }
    }
    const next = rows.length >= limit ? rows[rows.length - 1].at : null;
    return res.json({ success: true, events: rows, next, scanned, actions: AUDIT_ACTIONS });
  } catch (e: any) {
    console.error("[admin] audit", e);
    return fail(res, 500, "Не удалось загрузить журнал");
  }
});

// ─────────────────────── Обзор ───────────────────────

/** GET /api/tenants/:id/overview — что не настроено и сводка по сотрудникам. */
router.get("/:id/overview", requireFirebaseAuth, need("settings:manage", "team:manage", "team:view"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const [tenant, secrets, members] = await Promise.all([
      db().collection("tenants").doc(t).get(),
      db().collection("tenant_secrets").doc(t).get(),
      tenantMembers(t),
    ]);
    const td: any = tenant.data() || {};
    const sd: any = secrets.data() || {};
    const users = await authUsers(members.map(m => String(m.userId)));
    const statuses = members.map(m => statusOf(m, users.get(String(m.userId))));
    const activeUids = members.filter((m, i) => statuses[i] === "active").map(m => String(m.userId));
    const tg = await Promise.all(activeUids.map(uid => db().collection("user_telegram").doc(uid).get()));
    const telegram = tg.filter(d => !!d.data()?.chatId).length;
    const email = resolveWorkspaceConfig(td.workspaceConfig).email;
    const checks = [
      { key: "legal", label: "Реквизиты", ok: !!td.legal?.legalName },
      { key: "workspace", label: "Настройка разделов", ok: !!td.workspaceConfig?.setupCompleted },
      { key: "email", label: "Отправитель писем", ok: !!(email?.fromName && email?.replyTo) },
      { key: "telegram", label: "Telegram у сотрудников", ok: activeUids.length > 0 && telegram === activeUids.length, value: `${telegram} из ${activeUids.length}` },
      { key: "apiKey", label: "Ключ API", ok: !!(sd.apiKeyHash || sd.apiKey) },
      { key: "owners", label: "Второй владелец", ok: members.filter(m => m.status === "active" && isOwnerRole(m.role)).length > 1 },
    ];
    return res.json({
      success: true,
      tenant: { id: t, name: String(td.name || ""), status: String(td.status || "") },
      staff: {
        total: members.length,
        active: statuses.filter(s => s === "active").length,
        invited: statuses.filter(s => s === "invited").length,
        suspended: statuses.filter(s => s === "suspended").length,
      },
      checks,
    });
  } catch (e: any) {
    console.error("[admin] overview", e);
    return fail(res, 500, "Не удалось собрать обзор");
  }
});

// ─────────────────────── Интеграции: ключ API ───────────────────────

export const apiKeyHash = (k: string) => createHash("sha256").update(String(k)).digest("hex");

/** GET /api/tenants/:id/api-key — есть ли ключ (без значения) и разрешённые сайты. */
router.get("/:id/api-key", requireFirebaseAuth, need("settings:manage"), async (req: any, res: any) => {
  try {
    const s: any = (await db().collection("tenant_secrets").doc(req.params.id).get()).data() || {};
    return res.json({
      success: true,
      hasKey: !!(s.apiKeyHash || s.apiKey),
      prefix: s.apiKeyPrefix || (s.apiKey ? `${String(s.apiKey).slice(0, 8)}…` : null),
      issuedAt: ms(s.apiKeyIssuedAt) || null,
      allowedOrigins: Array.isArray(s.allowedOrigins) ? s.allowedOrigins : [],
    });
  } catch (e: any) {
    console.error("[admin] api key", e);
    return fail(res, 500, "Не удалось загрузить ключ");
  }
});

/** POST /api/tenants/:id/api-key — выпустить / перевыпустить. Ключ показывается один раз. */
router.post("/:id/api-key", requireFirebaseAuth, need("settings:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const key = `sf_live_${randomBytes(24).toString("base64url")}`;
    const del = admin.firestore.FieldValue.delete();
    await db().collection("tenant_secrets").doc(t).set({
      apiKeyHash: apiKeyHash(key), apiKeyPrefix: `${key.slice(0, 12)}…`, apiKeyIssuedAt: Date.now(), apiKeyIssuedBy: req.user.uid,
      apiKey: del, secretKey: del,
    }, { merge: true });
    // Старый ключ в документе организации больше не действует.
    await db().collection("tenants").doc(t).set({ apiKey: del, secretKey: del }, { merge: true });
    invalidateTenant(t);
    await writeAudit(db(), t, { actor: actorOf(req.user), action: "apikey.issue", section: "integrations", detail: `${key.slice(0, 12)}…` });
    return res.json({ success: true, apiKey: key, prefix: `${key.slice(0, 12)}…` });
  } catch (e: any) {
    console.error("[admin] api key issue", e);
    return fail(res, 500, "Не удалось выпустить ключ");
  }
});

/** PUT /api/tenants/:id/api-key/origins {origins: string[]} — сайты, с которых ключ принимается. */
router.put("/:id/api-key/origins", requireFirebaseAuth, need("settings:manage"), async (req: any, res: any) => {
  try {
    const t = req.params.id;
    const raw: unknown[] = Array.isArray(req.body?.origins) ? req.body.origins : [];
    const origins: string[] = [];
    for (const v of raw.slice(0, 20)) {
      let u: URL;
      try { u = new URL(String(v).trim()); } catch { return fail(res, 400, `Неверный адрес: ${String(v).slice(0, 80)}`); }
      if (!/^https?:$/.test(u.protocol)) return fail(res, 400, `Только http(s): ${u.href.slice(0, 80)}`);
      if (!origins.includes(u.origin)) origins.push(u.origin);
    }
    const prev: any = (await db().collection("tenant_secrets").doc(t).get()).data() || {};
    await db().collection("tenant_secrets").doc(t).set({ allowedOrigins: origins }, { merge: true });
    await writeAudit(db(), t, {
      actor: actorOf(req.user), action: "apikey.origins", section: "integrations",
      changes: [{ label: "Сайты", from: (prev.allowedOrigins || []).join(", "), to: origins.join(", ") }],
    });
    return res.json({ success: true, allowedOrigins: origins });
  } catch (e: any) {
    console.error("[admin] origins", e);
    return fail(res, 500, "Не удалось сохранить адреса");
  }
});

export default router;
