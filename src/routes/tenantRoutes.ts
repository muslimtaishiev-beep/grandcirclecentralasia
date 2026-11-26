import { Router } from "express";
import { sanitizePlacement } from "../shared/staffPlacement.js";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import {
  ALL_PERMISSION_KEYS, isPermissionKey, ROLE_PRESETS, ORG_MODULES,
  hasFullAccess, migrateLegacyPermissions, resolvePermissions, isSystemRoleName,
  WORKSPACE_SCREENS, NON_HIDEABLE_SCREENS, resolveScreens, normalizeTenantStatus,
} from "../shared/permissions.js";
import { checkTenantOpen, invalidateTenant, requireScreen } from "../server/tenantAccess.js";
import { requireFirebaseAuth } from "./authRoutes.js";
import { accessChangeDenied, callerPermissions, activeMembership, canAssignSystemRole, existingMembership, pickStrongest, rolePermissions } from "../server/access.js";
import { syncClaims } from "../server/claims.js";
import { actorOf, diffRows, writeAudit } from "../server/audit.js";
import { sendStaffInviteEmail } from "../../emailService.js";
import { appUrl } from "../server/emailEvents.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
import { stripTenantSecrets } from "../server/tenantView.js";
import { sanitizeLegal } from "../shared/legal.js";

const router = Router();
/** Организация для проверки раздела — только из пути: тело запроса её не подменяет. */
const byPathId = (req: any) => req.params.id;

/**
 * Пересчёт прав в токене (claims) — с одним повтором. Ошибку не глотаем
 * молча: от claims зависят правила базы, и пониженный сотрудник иначе
 * сохраняет доступ. Возвращает true, если применилось.
 */
async function syncClaimsSafe(db: FirebaseFirestore.Firestore, uid: string): Promise<boolean> {
  if (!uid) return true;
  for (let i = 0; i < 2; i++) {
    try { await syncClaims(db, uid); return true; }
    catch (e: any) { console.error(`[Claims] пересчёт ${uid} не удался (${i + 1}/2):`, e?.message); }
  }
  return false;
}
const CLAIMS_LAG = "Сохранено, но права в базе не обновились — повторите сохранение";

// POST /api/tenants/request - Request a new organization
router.post("/request", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { organizationName, contactEmail, contactPhone, contactPerson, description } = req.body;
    const uid = req.user.uid;
    const db = admin.firestore();

    if (!organizationName || !contactEmail) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const inviteId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const requestData = {
      id: inviteId,
      organizationName,
      contactEmail,
      contactPhone: contactPhone || "",
      contactPerson: contactPerson || req.user.email,
      description: description || "",
      requestedByUserId: uid,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
    };

    await db.collection("tenant_invites").doc(inviteId).set(requestData);

    return res.json({ success: true, request: requestData });
  } catch (error: any) {
    console.error("[Tenants/Request] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tenants/my - List current user's organizations
router.get("/my", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const uid = req.user.uid;
    const db = admin.firestore();

    // Суперадмин не состоит в организациях, но должен видеть их все: иначе
    // воркспейс открывался с заглушкой вместо тенанта — вместо названия
    // показывался org_..., права считались нулевыми, а настройки выглядели
    // недоступными.
    const isSuperadmin = req.user?.isSuperadmin === true
      || (await db.collection("superadmins").doc(uid).get()).exists;

    if (isSuperadmin) {
      const all = await db.collection("tenants").limit(50).get();
      return res.json({
        success: true,
        tenants: all.docs.map(d => {
          const data: any = d.data();
          return {
            ...data, id: d.id,
            role: "superadmin", permissions: [], customPermissions: [],
            effectivePermissions: ALL_PERMISSION_KEYS,
            platformDisabledScreens: Array.isArray(data.platformDisabledScreens) ? data.platformDisabledScreens : [],
            disabledScreens: Array.isArray(data.disabledScreens) ? data.disabledScreens : [],
            disabledModules: Array.isArray(data.disabledModules) ? data.disabledModules : [],
            // Суперадмину видно всё — и разделы, закрытые для организации.
            visibleScreens: WORKSPACE_SCREENS.map(sx => sx.key),
            status: normalizeTenantStatus(data.status),
            suspended: normalizeTenantStatus(data.status) === "suspended",
          };
        }),
      });
    }

    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .get();

    const tenantIds = membershipsSnapshot.docs.map(doc => doc.data().tenantId);

    if (tenantIds.length === 0) {
      return res.json({ success: true, tenants: [] });
    }

    // Fetch tenant details
    const tenantsSnapshot = await db
      .collection("tenants")
      .where("id", "in", tenantIds.slice(0, 10))
      .get();

    // Должности сотрудника — одним запросом на все организации сразу.
    const roleIds = [...new Set(membershipsSnapshot.docs
      .map(d => d.data().customRoleId).filter(Boolean).map(String))].slice(0, 30);
    const roleDocs = roleIds.length
      ? await db.getAll(...roleIds.map(id => db.collection("custom_roles").doc(id)))
      : [];
    const roleById = new Map(roleDocs.filter(d => d.exists).map(d => [d.id, d.data()]));

    const tenants = tenantsSnapshot.docs.map(doc => {
      const data = doc.data();
      const membership = pickStrongest(membershipsSnapshot.docs.filter(m => m.data().tenantId === data.id).map(m => ({ id: m.id, ...m.data() }))) || {};
      const customRole = membership.customRoleId ? roleById.get(String(membership.customRoleId)) : null;
      // Права считаются на сервере: клиенту незачем джойнить должность с
      // персональными правами и отключёнными модулями — и незачем знать
      // правила, по которым это делается.
      const effective = resolvePermissions({
        role: membership.role,
        permissions: membership.permissions,
        customPermissions: membership.customPermissions,
        rolePermissions: customRole?.permissions,
        disabledModules: data.disabledModules,
      });
      // Три слоя видимости считаются здесь же: что закрыла платформа, что
      // скрыла организация, что не выдано сотруднику. Клиент получает готовый
      // список и не гадает.
      const flags = {
        platformDisabledScreens: Array.isArray(data.platformDisabledScreens) ? data.platformDisabledScreens : [],
        disabledScreens: Array.isArray(data.disabledScreens) ? data.disabledScreens : [],
        disabledModules: Array.isArray(data.disabledModules) ? data.disabledModules : [],
      };
      const screens = resolveScreens({ ...flags, granted: effective });
      return {
        ...stripTenantSecrets(data),
        ...flags,
        status: normalizeTenantStatus(data.status),
        suspended: normalizeTenantStatus(data.status) === "suspended",
        visibleScreens: screens.visible,
        hiddenScreens: screens.hiddenBy,
        role: membership.role || 'user',
        permissions: membership.permissions || [],
        customPermissions: membership.customPermissions || [],
        customRole: customRole ? { id: membership.customRoleId, name: customRole.name, permissions: customRole.permissions } : null,
        effectivePermissions: [...effective],
        membershipId: membership.id
      };
    });

    return res.json({ success: true, tenants });
  } catch (error: any) {
    console.error("[Tenants/My] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware to check if user is an admin of the tenant
const requireTenantAdminWith = (...need: string[]) => async (req: any, res: any, next: any) => {
  try {
    // Суперадмин — только по документу в superadmins, не по домену почты.
    //
    // Раньше здесь стоял пропуск для ЛЮБОГО адреса @studyfreeforum.com: завёл
    // сотрудника с рабочей почтой — и он администратор в каждой организации
    // платформы, включая чужие. Плюс проверка uid === "superadmin" — такого
    // пользователя не существует, это остаток отладки.
    if (req.user?.isSuperadmin === true) {
      req.membership = { role: "superadmin" };
      return next();
    }

    const uid = req.user.uid;
    const tenantId = req.params.id;
    const db = admin.firestore();

    // Самое сильное из активных членств: дубль «Работник» не понижает владельца.
    const membership = await activeMembership(db, uid, tenantId);
    if (!membership) {
      return res.status(403).json({ error: "Access denied. Not a member." });
    }

    // Доступ решают ПРАВА, а не название должности.
    //
    // Раньше здесь стояла проверка строки роли с подстрокой «Руководитель» —
    // и выданная владельцем галочка «Управление сотрудниками» ничего не
    // значила: сервер смотрел на название должности и отказывал. Заодно
    // должность «Руководитель смены» получала право менять роли всей
    // компании — из-за поиска подстроки.
    //
    // Системные роли (владелец, администратор) сохраняют полный доступ:
    // иначе владелец мог бы снять галочку сам с себя и запереть организацию.
    let allowed = hasFullAccess(membership.role);
    if (!allowed) {
      const own = new Set<string>(migrateLegacyPermissions(membership));
      if (membership.customRoleId) {
        const roleDoc = await db.collection("custom_roles").doc(String(membership.customRoleId)).get();
        if (roleDoc.exists) for (const p of (roleDoc.data()?.permissions || [])) own.add(String(p));
      }
      allowed = need.some(p => own.has(p));
    }
    if (!allowed) {
      return res.status(403).json({ error: NEED_TEXT(need) });
    }

    // Приостановленная организация закрыта и для её администраторов.
    const gate = await checkTenantOpen(tenantId);
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error, reason: gate.reason });

    req.membership = membership;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
const PERM_TEXT: Record<string, string> = { "team:manage": "Управление сотрудниками", "team:view": "Просмотр сотрудников", "settings:manage": "Настройки организации" };
const NEED_TEXT = (need: string[]) => `Нужно право ${need.map(p => `«${PERM_TEXT[p] || p}»`).join(" или ")}`;
/** Сотрудники, должности, приглашения. */
const requireTeam = requireTenantAdminWith("team:manage");
/** Смотреть сотрудников и должности. */
const requireTeamView = requireTenantAdminWith("team:manage", "team:view");
/** Название, реквизиты, разделы, модули. */
const requireSettings = requireTenantAdminWith("settings:manage");

// POST /api/tenants/:id/invite - Invite staff to the organization
router.post("/:id/invite", requireFirebaseAuth, requireTeam, async (req: any, res: any) => {
  try {
    const { email, password, name, displayName, role, roleName, permissions } = req.body;
    const tenantId = req.params.id;
    const uid = req.user.uid;
    const db = admin.firestore();

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email address" });
    }

    const staffName = displayName || name || email.split("@")[0];
    const callerRole = req.membership?.role;
    const callerIsSA = req.user?.isSuperadmin === true;

    // Кем станет приглашённый. Раньше роль бралась из тела запроса как есть:
    // сотрудник с правом «Управление сотрудниками» мог выставить СЕБЕ org:owner.
    //  — customRoleId: должность этой организации (название — из документа);
    //  — org:owner / org:admin: только владелец или суперадмин (org:admin —
    //    любой с полным доступом);
    //  — иначе свободная метка, не совпадающая с системной ролью.
    const SYSTEM: Record<string, string> = { "org:owner": "org:owner", owner: "org:owner", "org:admin": "org:admin", admin: "org:admin" };
    let assignedRole = "";
    let assignedCustomRoleId: string | undefined;
    const bodyCustomRoleId = req.body?.customRoleId ? String(req.body.customRoleId) : "";
    let roleGrant = new Set<any>();
    if (bodyCustomRoleId) {
      const r = await rolePermissions(db, tenantId, bodyCustomRoleId);
      if (!r) {
        return res.status(400).json({ success: false, error: "Должность не найдена в этой организации" });
      }
      assignedCustomRoleId = bodyCustomRoleId;
      assignedRole = r.name;
      roleGrant = r.perms;
    } else if (SYSTEM[String(role || "")]) {
      const sys = SYSTEM[String(role)];
      if (!canAssignSystemRole(callerRole, callerIsSA, sys)) {
        return res.status(403).json({ success: false, error: "Только владелец или суперадмин может назначить эту роль" });
      }
      assignedRole = sys;
    } else {
      assignedRole = String(roleName || role || "Сотрудник").trim().slice(0, 40) || "Сотрудник";
      if (isSystemRoleName(assignedRole)) {
        return res.status(400).json({ success: false, error: "Это название зарезервировано за системной ролью" });
      }
    }

    // Личные права: только из каталога и не больше, чем есть у вызывающего.
    const mine = await callerPermissions(db, uid, tenantId, req.user);
    const rawPerms = Array.isArray(permissions) ? permissions
      : (permissions && typeof permissions === "object") ? migrateLegacyPermissions({ permissions }) : [];
    const wantedPerms = (rawPerms as unknown[]).filter(isPermissionKey);
    // Должность и личные права вместе — не шире прав приглашающего.
    const deniedNew = await accessChangeDenied(db, req.user, tenantId, null, new Set([...roleGrant, ...wantedPerms]));
    if (deniedNew && !hasFullAccess(assignedRole)) return res.status(403).json({ success: false, error: deniedNew });

    // Check if target user exists in Auth, if not create automatically
    let targetUserId = "";
    // Аккаунт создан этим же запросом — только тогда можно выдать ссылку
    // «установить пароль». Для существовавшего аккаунта ссылка сброса — это
    // захват чужой учётной записи (владельца другой школы, суперадмина).
    let createdNow = false;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      targetUserId = userRecord.uid;
      if (staffName && !userRecord.displayName) {
        await admin.auth().updateUser(targetUserId, { displayName: staffName });
      }
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        // Пароль задаёт сам сотрудник по ссылке. Исключение — суперадмин,
        // заводящий руководителя новой школы.
        const initialPassword = callerIsSA && typeof password === "string" && password.length >= 8
          ? password
          : `${randomBytes(18).toString("base64url")}aA1!`;
        const newUserRecord = await admin.auth().createUser({
          email: email,
          password: initialPassword,
          displayName: staffName
        });
        targetUserId = newUserRecord.uid;
        createdNow = true;

        // Create user document in Firestore
        await db.collection("users").doc(targetUserId).set({
          id: targetUserId,
          email: email,
          displayName: staffName,
          globalRole: "user",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        throw authErr;
      }
    }

    // Членство уже есть? Ищем по паре «пользователь + организация» (у старых
    // организаций id не mem_<uid>_<org>) и берём самое сильное.
    const existing = await existingMembership(db, targetUserId, tenantId);

    const rolePatch: Record<string, any> = assignedCustomRoleId
      ? { customRoleId: assignedCustomRoleId }
      : { customRoleId: admin.firestore.FieldValue.delete() };

    if (existing) {
      // Повторное приглашение — это смена доступа: те же правила, что у «Назначить должность».
      if (hasFullAccess(existing.role) && !canAssignSystemRole(callerRole, callerIsSA, "org:owner")) {
        return res.status(403).json({ success: false, error: "Этот сотрудник — владелец или администратор организации" });
      }
      const deniedExisting = await accessChangeDenied(db, req.user, tenantId, existing, hasFullAccess(assignedRole) ? [] : new Set([...roleGrant, ...wantedPerms]));
      if (deniedExisting) return res.status(403).json({ success: false, error: deniedExisting });
      const docId = existing.id;
      const place = req.body?.placement ? sanitizePlacement(req.body.placement) : null;
      await db.collection("memberships").doc(docId).update({
        ...(place ? { grades: place.grades, classes: place.classes, levels: place.levels, subjects: place.subjects, groups: place.groups } : {}),
        displayName: staffName,
        role: assignedRole,
        permissions: wantedPerms,
        customPermissions: admin.firestore.FieldValue.delete(),
        ...rolePatch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      const synced = await syncClaimsSafe(db, targetUserId);
      await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "role.change", section: "access", target: { kind: "member", id: targetUserId, name: staffName }, detail: "Повторное приглашение", changes: diffRows([["Должность", existing.role, assignedRole], ["Личные права", migrateLegacyPermissions(existing).join(", "), wantedPerms.join(", ")]]) });
      return res.json({ success: true, claimsSynced: synced, message: synced ? "Имя, роль и разрешения сотрудника обновлены" : CLAIMS_LAG });
    }

    const membershipId = `mem_${targetUserId}_${tenantId}`;
    // Где работает (классы, предметы, группы) — сразу при приглашении, если указали.
    const place = req.body?.placement ? sanitizePlacement(req.body.placement) : null;
    await db.collection("memberships").doc(membershipId).set({
      ...(place ? { grades: place.grades, classes: place.classes, levels: place.levels, subjects: place.subjects, groups: place.groups } : {}),
      id: membershipId,
      userId: targetUserId,
      tenantId: tenantId,
      displayName: staffName,
      role: assignedRole,
      permissions: wantedPerms,
      ...(assignedCustomRoleId ? { customRoleId: assignedCustomRoleId } : {}),
      status: "active",
      invitedBy: uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const claimsSynced = await syncClaimsSafe(db, targetUserId);
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "invite", section: "staff", target: { kind: "member", id: targetUserId, name: staffName }, detail: `${email} · ${assignedRole}${wantedPerms.length ? ` · личных прав: ${wantedPerms.length}` : ""}` });

    // Письмо сотруднику. Firebase сам ничего не шлёт: аккаунт создавался с
    // временным паролем, который видел только админ на экране, — сотрудник
    // оставался без письма и без пароля, если админ не переслал его руками.
    // sendOobCode — единственный путь, где письмо отправляет сам Firebase;
    // для нового аккаунта это «установите пароль», для существующего — сброс.
    let inviteEmailSent = false;
    if (createdNow) {
      try {
        const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y";
        const oob = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
        });
        inviteEmailSent = oob.ok;
      } catch (e: any) {
        // Членство важнее письма: сотрудник добавлен, а про письмо честно
        // говорим в ответе — админ дошлёт руками.
        console.error("[Tenants/Invite] письмо не отправилось:", e?.message);
      }
    } else {
      // Существующему человеку — только «вас добавили», без сброса пароля.
      try {
        const t = await db.collection("tenants").doc(tenantId).get();
        const r = await sendStaffInviteEmail({
          tenantId,
          email: resolveWorkspaceConfig(t.data()?.workspaceConfig).email,
          to: email,
          fullName: staffName,
          tenantName: String(t.data()?.name || "Организация"),
          role: assignedRole,
          resetLink: `${await appUrl()}/login`,
          existingAccount: true,
        });
        inviteEmailSent = r.sent;
      } catch (e: any) {
        console.error("[Tenants/Invite] письмо не отправилось:", e?.message);
      }
    }

    // Пароль наружу не отдаём никогда. Ссылка «установить пароль» — только
    // для аккаунта, созданного этим запросом, и только если письмо не ушло.
    let inviteLink: string | null = null;
    if (!inviteEmailSent && createdNow) {
      try { inviteLink = await admin.auth().generatePasswordResetLink(email); } catch (e: any) { console.error("[Tenants/Invite] ссылка не создана:", e?.message); }
    }
    return res.json({
      success: true,
      inviteEmailSent,
      inviteLink,
      claimsSynced,
      message: inviteEmailSent
        ? (createdNow ? `Сотрудник добавлен. Письмо со ссылкой для входа отправлено на ${email}` : `Сотрудник добавлен. Письмо отправлено на ${email}`)
        : inviteLink
          ? "Сотрудник добавлен, но письмо не ушло — передайте ему ссылку для входа"
          : createdNow
            ? "Сотрудник добавлен, но письмо не ушло — отправьте ему сброс пароля со страницы входа"
            : "Сотрудник добавлен. У него уже есть учётная запись — пусть войдёт как обычно",
    });
  } catch (error: any) {
    console.error("[Tenants/Invite] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tenants/:id/workspace-config — быстрая настройка воркспейса.
 *
 * Владелец описывает вид деятельности компании, и экраны подстраиваются:
 * заголовок дашборда, терминология («Тренер» вместо «Преподаватель»),
 * обязательность полей расписания. Организации без конфига видят прежние
 * тексты — существующих это не трогает.
 */
router.put("/:id/workspace-config", requireFirebaseAuth, requireSettings, requireScreen("workspaceSetup", byPathId), async (req: any, res: any) => {
  try {
    const tenantId = req.params.id;
    const db = admin.firestore();
    const incoming = req.body?.config || {};
    const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
    // Слияние, а не замена: раздел, которого нет в запросе, остаётся как был.
    const existingSnap = await db.collection("tenants").doc(tenantId).get();
    const prev = (existingSnap.data()?.workspaceConfig || {}) as Record<string, any>;
    const c: any = { ...prev, ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== undefined)) };

    const clean = {
      setupCompleted: true,
      activityType: str(c.activityType, 60),
      dashboardTitle: str(c.dashboardTitle, 80),
      dashboardSubtitle: str(c.dashboardSubtitle, 200),
      terms: {
        teacher: str(c.terms?.teacher, 40) || "Преподаватель",
        room: str(c.terms?.room, 40) || "Кабинет",
        student: str(c.terms?.student, 40) || "Ученик",
        group: str(c.terms?.group, 40) || "Группа",
        lesson: str(c.terms?.lesson, 40) || "Урок",
        subscription: str(c.terms?.subscription, 40) || "Абонемент",
      },
      schedule: {
        requireTeacher: c.schedule?.requireTeacher !== false,
        requireRoom: c.schedule?.requireRoom !== false,
      },
      // Анкета регистрации на экзамен: какие поля спрашивать, как их
      // подписать, какие варианты класса/уровня предлагать.
      registration: {
        title: str(c.registration?.title, 80),
        subtitle: str(c.registration?.subtitle, 200),
        fields: (Array.isArray(c.registration?.fields) ? c.registration.fields : [])
          .filter((f: any) => ["name", "phone", "email", "grade"].includes(String(f?.key)))
          .slice(0, 8)
          .map((f: any) => ({
            key: String(f.key),
            label: str(f.label, 60),
            placeholder: str(f.placeholder, 80),
            visible: f.visible !== false,
            required: f.required !== false,
          })),
        gradeOptions: (Array.isArray(c.registration?.gradeOptions) ? c.registration.gradeOptions : [])
          .map((v: unknown) => str(v, 30)).filter(Boolean).slice(0, 30),
        gradeSuffix: str(c.registration?.gradeSuffix, 30),
        requireFullName: c.registration?.requireFullName !== false,
        pinAuthority: str(c.registration?.pinAuthority, 40),
        pinRequired: c.registration?.pinRequired !== false,
        consentText: str(c.registration?.consentText, 1200),
        startButtonLabel: str(c.registration?.startButtonLabel, 40),
        finishTitle: str(c.registration?.finishTitle, 80),
        finishText: str(c.registration?.finishText, 600),
      },
      // Публичные страницы заявок и билетов.
      tickets: {
        publicTitle: str(c.tickets?.publicTitle, 80),
        closedTitle: str(c.tickets?.closedTitle, 80),
        closedMessage: str(c.tickets?.closedMessage, 300),
        submitButtonLabel: str(c.tickets?.submitButtonLabel, 40),
        successTitle: str(c.tickets?.successTitle, 80),
        successMessage: str(c.tickets?.successMessage, 300),
        ticketWord: str(c.tickets?.ticketWord, 30),
        supportPhone: str(c.tickets?.supportPhone, 40),
        checkinOkText: str(c.tickets?.checkinOkText, 40),
      },
      // Письма от имени организации: адрес для ответов — только похожий на почту.
      email: {
        fromName: str(c.email?.fromName, 60),
        replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(c.email?.replyTo, 120)) ? str(c.email?.replyTo, 120) : "",
        signature: str(c.email?.signature, 300),
      },
      landing: {
        badge: str(c.landing?.badge, 60),
        subtitle: str(c.landing?.subtitle, 240),
        primaryCtaLabel: str(c.landing?.primaryCtaLabel, 40),
        secondaryCtaLabel: str(c.landing?.secondaryCtaLabel, 40),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || req.user?.uid || "",
    };

    await db.collection("tenants").doc(tenantId).update({
      workspaceConfig: clean,
      needsWorkspaceSetup: admin.firestore.FieldValue.delete(),
    });
    invalidateTenant(tenantId);
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "settings.workspace", section: "settings", detail: clean.activityType || "" });
    return res.json({ success: true, config: clean });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────── Должности и права ───────────────────────

const ROLES = "custom_roles";

/**
 * PUT /api/tenants/:id/legal — реквизиты организации для справок,
 * сертификатов и шаблонов документов. Раньше во всех документах платформы
 * были зашиты реквизиты одной организации.
 */
router.put("/:id/legal", requireFirebaseAuth, requireSettings, requireScreen("workspaceSetup", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const tenantId = req.params.id;
    const mine = await callerPermissions(db, req.user.uid, tenantId, req.user);
    if (!mine.has("settings:manage")) {
      return res.status(403).json({ success: false, error: "Нужно право «Настройки организации»" });
    }
    const legal = sanitizeLegal(req.body?.legal);
    if (!legal.legalName) return res.status(400).json({ success: false, error: "Укажите официальное название организации" });
    await db.collection("tenants").doc(tenantId).update({ legal, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    invalidateTenant(tenantId);
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "settings.legal", section: "settings", detail: legal.legalName });
    return res.json({ success: true, legal });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/tenants/:id/roles — должности организации. */
router.get("/:id/roles", requireFirebaseAuth, requireTeamView, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection(ROLES).where("tenantId", "==", req.params.id).get();
    const roles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Сколько сотрудников на каждой должности — чтобы занятую не удалили молча.
    const ms = await db.collection("memberships").where("tenantId", "==", req.params.id).get();
    const counts: Record<string, number> = {};
    ms.docs.forEach(d => {
      const rid = d.data().customRoleId;
      if (rid) counts[rid] = (counts[rid] || 0) + 1;
    });
    return res.json({
      success: true,
      roles: roles.map((r: any) => ({ ...r, memberCount: counts[r.id] || 0 })),
      presets: ROLE_PRESETS,
      catalog: ALL_PERMISSION_KEYS,
      modules: ORG_MODULES,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/tenants/:id/roles — создать или изменить должность. */
router.post("/:id/roles", requireFirebaseAuth, requireTeam, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const tenantId = req.params.id;
    const { roleId, name, description, permissions, teacher } = req.body || {};
    const cleanName = String(name || "").trim().slice(0, 40);
    if (!cleanName) return res.status(400).json({ success: false, error: "Укажите название должности" });
    // Название должности не может совпадать с системной ролью: иначе строка
    // role сотрудника стала бы «admin» и дала полный доступ мимо галочек.
    if (isSystemRoleName(cleanName)) {
      return res.status(400).json({ success: false, error: "Это название зарезервировано за системной ролью" });
    }

    // Только права из каталога: иначе в документе копится мусор, который
    // ничего не открывает, но выглядит как выданный доступ.
    const wanted = (Array.isArray(permissions) ? permissions : []).filter(isPermissionKey);

    // Защита от эскалации: нельзя выдать должности то, чего нет у самого.
    const mine = await callerPermissions(db, req.user.uid, tenantId, req.user);
    const excess = wanted.filter(p => !mine.has(p));
    if (excess.length) {
      return res.status(403).json({
        success: false,
        error: `Нельзя выдать права, которых нет у вас: ${excess.join(", ")}`,
      });
    }

    const id = roleId ? String(roleId) : `role_${tenantId}_${Date.now().toString(36)}`;
    if (roleId) {
      const existing = await db.collection(ROLES).doc(id).get();
      if (!existing.exists) return res.status(404).json({ success: false, error: "Должность не найдена" });
      if (existing.data()?.tenantId !== tenantId) {
        return res.status(403).json({ success: false, error: "Должность другой организации" });
      }
      // Должность с правами шире своих не правят: иначе можно обнулить права
      // финансиста или раздать их, переписав его должность.
      const over = (existing.data()?.permissions || []).filter((p: unknown) => isPermissionKey(p) && !mine.has(p));
      if (over.length) return res.status(403).json({ success: false, error: "В этой должности есть права, которых нет у вас" });
    }

    const doc = {
      id, tenantId, name: cleanName,
      description: String(description || "").trim().slice(0, 200),
      permissions: wanted,
      // Учительская должность: при назначении спрашиваются классы и предметы.
      teacher: teacher === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || req.user?.uid || "",
      ...(roleId ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    };
    const prevPerms: string[] = roleId ? ((await db.collection(ROLES).doc(id).get()).data()?.permissions || []) : [];
    await db.collection(ROLES).doc(id).set(doc, { merge: true });
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: roleId ? "role.save" : "role.create", section: "roles", target: { kind: "role", id, name: cleanName }, changes: diffRows([["Права", prevPerms.join(", "), wanted.join(", ")]]) });
    // Права должности изменились — обновить claims всех, кто на ней, ДО
    // ответа: на Vercel фоновая работа после ответа может не выполниться.
    let claimsFailed = 0;
    if (roleId) {
      const ms = await db.collection("memberships").where("tenantId", "==", tenantId).where("customRoleId", "==", id).get();
      const done = await Promise.all(ms.docs.map(d => syncClaimsSafe(db, String(d.data().userId || ""))));
      claimsFailed = done.filter(ok => !ok).length;
    }
    return res.json({
      success: true, role: { ...doc, memberCount: 0 }, claimsFailed,
      ...(claimsFailed ? { warning: `Права не обновились у сотрудников: ${claimsFailed} — повторите сохранение` } : {}),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /api/tenants/:id/roles/:roleId — удалить незанятую должность. */
router.delete("/:id/roles/:roleId", requireFirebaseAuth, requireTeam, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const { id: tenantId, roleId } = req.params;
    const snap = await db.collection(ROLES).doc(roleId).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Должность не найдена" });
    if (snap.data()?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Должность другой организации" });
    }
    const mine = await callerPermissions(db, req.user.uid, tenantId, req.user);
    if ((snap.data()?.permissions || []).some((p: unknown) => isPermissionKey(p) && !mine.has(p))) {
      return res.status(403).json({ success: false, error: "В этой должности есть права, которых нет у вас" });
    }
    // Занятую должность не удаляем: сотрудники остались бы без прав молча.
    const used = await db.collection("memberships")
      .where("tenantId", "==", tenantId).where("customRoleId", "==", roleId).limit(1).get();
    if (!used.empty) {
      return res.status(409).json({
        success: false,
        error: "На этой должности есть сотрудники — сначала переведите их",
      });
    }
    await db.collection(ROLES).doc(roleId).delete();
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "role.delete", section: "roles", target: { kind: "role", id: roleId, name: String(snap.data()?.name || "") } });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** PUT /api/tenants/:id/modules — что скрыто для всей организации. */
router.put("/:id/modules", requireFirebaseAuth, requireSettings, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const known = new Set(ORG_MODULES.map(m => m.key));
    const disabled = (Array.isArray(req.body?.disabledModules) ? req.body.disabledModules : [])
      .map(String).filter((k: string) => known.has(k));
    await db.collection("tenants").doc(req.params.id).update({
      disabledModules: disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateTenant(req.params.id);
    await writeAudit(db, req.params.id, { actor: actorOf(req.user), action: "settings.modules", section: "settings", detail: disabled.length ? `Выключены: ${disabled.join(", ")}` : "Все модули включены" });
    return res.json({ success: true, disabledModules: disabled });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});


/**
 * PUT /api/tenants/:id/screens — какие ЭКРАНЫ показываются у организации.
 *
 * В отличие от модулей (грубая группа), это управление каждым пунктом меню
 * отдельно. Дашборд выключить нельзя — без него воркспейс становится тупиком
 * без единой ссылки.
 */
router.put("/:id/screens", requireFirebaseAuth, requireSettings, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const known = new Set(WORKSPACE_SCREENS.map(sx => sx.key));
    // Это слой ОРГАНИЗАЦИИ. Закрытое платформой сюда не попадает: его
    // организация не видит и включить не может (см. platformDisabledScreens).
    const snap = await db.collection("tenants").doc(req.params.id).get();
    const platform = new Set<string>(Array.isArray(snap.data()?.platformDisabledScreens) ? snap.data()!.platformDisabledScreens.map(String) : []);
    const disabled = (Array.isArray(req.body?.disabledScreens) ? req.body.disabledScreens : [])
      .map(String)
      .filter((k: string) => known.has(k) && !NON_HIDEABLE_SCREENS.has(k) && !platform.has(k));
    await db.collection("tenants").doc(req.params.id).update({
      disabledScreens: disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateTenant(req.params.id);
    await writeAudit(db, req.params.id, { actor: actorOf(req.user), action: "settings.screens", section: "settings", detail: disabled.length ? `Скрыты: ${disabled.join(", ")}` : "Все разделы показаны" });
    return res.json({ success: true, disabledScreens: disabled, platformDisabledScreens: [...platform] });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/tenants/:id/members/:membershipId/role — назначить должность. */
router.post("/:id/members/:membershipId/role", requireFirebaseAuth, requireTeam, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const { id: tenantId, membershipId } = req.params;
    const { customRoleId, permissions } = req.body || {};

    const memRef = db.collection("memberships").doc(membershipId);
    const mem = await memRef.get();
    if (!mem.exists) return res.status(404).json({ success: false, error: "Сотрудник не найден" });
    if (mem.data()?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Сотрудник другой организации" });
    }

    const patch: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const target = mem.data() || {};

    // Права сотрудника ПОСЛЕ изменения: должность (новая или прежняя) + личные.
    let roleGrant = new Set<any>();
    if (customRoleId !== undefined) {
      if (customRoleId) {
        const r = await rolePermissions(db, tenantId, String(customRoleId));
        if (!r) return res.status(400).json({ success: false, error: "Должность не найдена" });
        patch.customRoleId = String(customRoleId);
        // role хранит человекочитаемое название должности — его показывают
        // в списках; полный доступ по-прежнему только у системных ролей.
        patch.role = r.name;
        roleGrant = r.perms;
      } else {
        patch.customRoleId = admin.firestore.FieldValue.delete();
      }
    } else if (target.customRoleId) {
      roleGrant = (await rolePermissions(db, tenantId, String(target.customRoleId)))?.perms || new Set();
    }
    const personal = Array.isArray(permissions) ? (permissions as unknown[]).filter(isPermissionKey) : migrateLegacyPermissions(target);
    const denied = await accessChangeDenied(db, req.user, tenantId, target, new Set([...roleGrant, ...personal]));
    if (denied) return res.status(403).json({ success: false, error: denied });

    if (Array.isArray(permissions)) {
      patch.permissions = personal;
      // Матрица PBAC больше не используется: её значения перенесены, а
      // хранить их дальше опасно — они складывались по ИЛИ и отменяли запреты.
      patch.customPermissions = admin.firestore.FieldValue.delete();
    }

    await memRef.update(patch);
    const claimsSynced = await syncClaimsSafe(db, String(mem.data()?.userId || ""));
    await writeAudit(db, tenantId, { actor: actorOf(req.user), action: "role.change", section: "access", target: { kind: "member", id: String(target.userId || ""), name: String(target.displayName || "") }, changes: diffRows([["Должность", target.role, patch.role ?? (customRoleId === "" || customRoleId === null ? "без должности" : target.role)], ["Личные права", migrateLegacyPermissions(target).join(", "), (Array.isArray(permissions) ? personal : migrateLegacyPermissions(target)).join(", ")]]) });
    return res.json({ success: true, claimsSynced, ...(claimsSynced ? {} : { warning: CLAIMS_LAG }) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/tenants/:id/members - List members
router.get("/:id/members", requireFirebaseAuth, requireTeamView, requireScreen("permissions", byPathId), async (req: any, res: any) => {
  try {
    const tenantId = req.params.id;
    const db = admin.firestore();

    const snapshot = await db.collection("memberships").where("tenantId", "==", tenantId).get();
    const memberships = snapshot.docs.map(doc => doc.data());

    // Populate user info (basic implementation)
    const userIds = memberships.map(m => m.userId);
    let usersMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const usersSnapshot = await db.collection("users").where("id", "in", userIds.slice(0, 10)).get();
      usersSnapshot.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });
    }

    const membersWithData = memberships.map(m => ({
      ...m,
      user: usersMap[m.userId] || { email: "", displayName: "Неизвестный сотрудник" }
    }));

    return res.json({ success: true, members: membersWithData });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
