import { Router } from "express";
import admin from "firebase-admin";
import {
  ALL_PERMISSION_KEYS, isPermissionKey, ROLE_PRESETS, ORG_MODULES,
  hasFullAccess, migrateLegacyPermissions, resolvePermissions, isSystemRoleName,
  WORKSPACE_SCREENS, NON_HIDEABLE_SCREENS,
} from "../shared/permissions.js";
import { requireFirebaseAuth } from "./authRoutes.js";
import { callerPermissions, canAssignSystemRole } from "../server/access.js";
import { syncClaims } from "../server/claims.js";
import { stripTenantSecrets } from "../server/tenantView.js";

const router = Router();

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
        tenants: all.docs.map(d => ({
          ...d.data(), id: d.id,
          role: "superadmin", permissions: [], customPermissions: [],
          effectivePermissions: ALL_PERMISSION_KEYS,
        })),
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
      const membership = membershipsSnapshot.docs.find(m => m.data().tenantId === data.id)?.data() || {};
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
      return {
        ...stripTenantSecrets(data),
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
const requireTenantAdmin = async (req: any, res: any, next: any) => {
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

    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .where("tenantId", "==", tenantId)
      .where("status", "==", "active")
      .get();

    if (membershipsSnapshot.empty) {
      return res.status(403).json({ error: "Access denied. Not a member." });
    }

    const membership = membershipsSnapshot.docs[0].data();

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
      allowed = own.has("team:manage") || own.has("settings:manage");
    }
    if (!allowed) {
      return res.status(403).json({
        error: "Нет прав на управление организацией. Нужно право «Управление сотрудниками» или «Настройки организации».",
      });
    }

    req.membership = membership;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/tenants/:id/invite - Invite staff to the organization
router.post("/:id/invite", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
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
    if (bodyCustomRoleId) {
      const r = await db.collection("custom_roles").doc(bodyCustomRoleId).get();
      if (!r.exists || r.data()?.tenantId !== tenantId) {
        return res.status(400).json({ success: false, error: "Должность не найдена в этой организации" });
      }
      assignedCustomRoleId = bodyCustomRoleId;
      assignedRole = String(r.data()?.name || "Сотрудник");
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
    const excess = wantedPerms.filter(p => !mine.has(p));
    if (excess.length) {
      return res.status(403).json({ success: false, error: `Нельзя выдать права, которых нет у вас: ${excess.join(", ")}` });
    }

    // Check if target user exists in Auth, if not create automatically
    let targetUserId = "";
    let createdTempPassword = "";
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      targetUserId = userRecord.uid;
      if (staffName && !userRecord.displayName) {
        await admin.auth().updateUser(targetUserId, { displayName: staffName });
      }
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        createdTempPassword = password || `Pass_${Math.random().toString(36).slice(-6)}!2026`;
        const newUserRecord = await admin.auth().createUser({
          email: email,
          password: createdTempPassword,
          displayName: staffName
        });
        targetUserId = newUserRecord.uid;

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

    // Check if membership already exists
    const existingSnapshot = await db.collection("memberships")
      .where("userId", "==", targetUserId)
      .where("tenantId", "==", tenantId)
      .get();

    const rolePatch: Record<string, any> = assignedCustomRoleId
      ? { customRoleId: assignedCustomRoleId }
      : { customRoleId: admin.firestore.FieldValue.delete() };

    if (!existingSnapshot.empty) {
      // Понизить владельца/администратора может только владелец или суперадмин.
      const existing = existingSnapshot.docs[0].data();
      if (hasFullAccess(existing.role) && !canAssignSystemRole(callerRole, callerIsSA, "org:owner")) {
        return res.status(403).json({ success: false, error: "Этот сотрудник — владелец или администратор организации" });
      }
      const docId = existingSnapshot.docs[0].id;
      await db.collection("memberships").doc(docId).update({
        displayName: staffName,
        role: assignedRole,
        permissions: wantedPerms,
        customPermissions: admin.firestore.FieldValue.delete(),
        ...rolePatch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await syncClaims(db, targetUserId).catch(() => false);
      return res.json({ success: true, message: "Имя, роль и разрешения сотрудника обновлены" });
    }

    const membershipId = `mem_${targetUserId}_${tenantId}`;
    await db.collection("memberships").doc(membershipId).set({
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
    await syncClaims(db, targetUserId).catch(() => false);

    // Письмо сотруднику. Firebase сам ничего не шлёт: аккаунт создавался с
    // временным паролем, который видел только админ на экране, — сотрудник
    // оставался без письма и без пароля, если админ не переслал его руками.
    // sendOobCode — единственный путь, где письмо отправляет сам Firebase;
    // для нового аккаунта это «установите пароль», для существующего — сброс.
    let inviteEmailSent = false;
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

    return res.json({ 
      success: true, 
      inviteEmailSent,
      message: inviteEmailSent
        ? `Сотрудник добавлен. Письмо со ссылкой для входа отправлено на ${email}`
        : (createdTempPassword
            ? `Сотрудник добавлен, но письмо не ушло. Передайте временный пароль: ${createdTempPassword}`
            : "Сотрудник добавлен, но письмо не ушло — отправьте ему сброс пароля вручную"),
      tempPassword: createdTempPassword
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
router.put("/:id/workspace-config", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const tenantId = req.params.id;
    const db = admin.firestore();
    const c = req.body?.config || {};
    const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || req.user?.uid || "",
    };

    await db.collection("tenants").doc(tenantId).update({
      workspaceConfig: clean,
      needsWorkspaceSetup: admin.firestore.FieldValue.delete(),
    });
    return res.json({ success: true, config: clean });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────── Должности и права ───────────────────────

const ROLES = "custom_roles";

/** GET /api/tenants/:id/roles — должности организации. */
router.get("/:id/roles", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
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
router.post("/:id/roles", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const tenantId = req.params.id;
    const { roleId, name, description, permissions } = req.body || {};
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
    }

    const doc = {
      id, tenantId, name: cleanName,
      description: String(description || "").trim().slice(0, 200),
      permissions: wanted,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || req.user?.uid || "",
      ...(roleId ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    };
    await db.collection(ROLES).doc(id).set(doc, { merge: true });
    // Права должности изменились — обновить claims всех, кто на ней (в фоне).
    if (roleId) {
      db.collection("memberships").where("tenantId", "==", tenantId).where("customRoleId", "==", id).get()
        .then(ms => Promise.all(ms.docs.map(d => syncClaims(db, String(d.data().userId || "")).catch(() => false))))
        .catch(() => {});
    }
    return res.json({ success: true, role: { ...doc, memberCount: 0 } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /api/tenants/:id/roles/:roleId — удалить незанятую должность. */
router.delete("/:id/roles/:roleId", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const { id: tenantId, roleId } = req.params;
    const snap = await db.collection(ROLES).doc(roleId).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Должность не найдена" });
    if (snap.data()?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Должность другой организации" });
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
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** PUT /api/tenants/:id/modules — что скрыто для всей организации. */
router.put("/:id/modules", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const known = new Set(ORG_MODULES.map(m => m.key));
    const disabled = (Array.isArray(req.body?.disabledModules) ? req.body.disabledModules : [])
      .map(String).filter((k: string) => known.has(k));
    await db.collection("tenants").doc(req.params.id).update({
      disabledModules: disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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
router.put("/:id/screens", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const known = new Set(WORKSPACE_SCREENS.map(sx => sx.key));
    const disabled = (Array.isArray(req.body?.disabledScreens) ? req.body.disabledScreens : [])
      .map(String)
      .filter((k: string) => known.has(k) && !NON_HIDEABLE_SCREENS.has(k));
    await db.collection("tenants").doc(req.params.id).update({
      disabledScreens: disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ success: true, disabledScreens: disabled });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/tenants/:id/members/:membershipId/role — назначить должность. */
router.post("/:id/members/:membershipId/role", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
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

    if (customRoleId !== undefined) {
      if (customRoleId) {
        const r = await db.collection(ROLES).doc(String(customRoleId)).get();
        if (!r.exists || r.data()?.tenantId !== tenantId) {
          return res.status(400).json({ success: false, error: "Должность не найдена" });
        }
        patch.customRoleId = String(customRoleId);
        // role хранит человекочитаемое название должности — его показывают
        // в списках; полный доступ по-прежнему только у системных ролей.
        patch.role = r.data()?.name || "Сотрудник";
      } else {
        patch.customRoleId = admin.firestore.FieldValue.delete();
      }
    }

    if (Array.isArray(permissions)) {
      const wanted = (permissions as unknown[]).filter(isPermissionKey);
      const mine = await callerPermissions(db, req.user.uid, tenantId, req.user);
      // Нельзя ВЫДАТЬ то, чего нет у самого. То, что у сотрудника уже было,
      // остаётся: иначе менеджер не мог бы сохранить карточку коллеги с
      // правами выше своих, не отняв их.
      const had = new Set(migrateLegacyPermissions(mem.data() || {}));
      const excess = wanted.filter(p => !mine.has(p) && !had.has(p));
      if (excess.length) {
        return res.status(403).json({
          success: false, error: `Нельзя выдать права, которых нет у вас: ${excess.join(", ")}`,
        });
      }
      patch.permissions = wanted;
      // Матрица PBAC больше не используется: её значения перенесены, а
      // хранить их дальше опасно — они складывались по ИЛИ и отменяли запреты.
      patch.customPermissions = admin.firestore.FieldValue.delete();
    }

    await memRef.update(patch);
    await syncClaims(db, String(mem.data()?.userId || "")).catch(() => false);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/tenants/:id/members - List members
router.get("/:id/members", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
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
      user: usersMap[m.userId] || { email: "Unknown", displayName: "Unknown" }
    }));

    return res.json({ success: true, members: membersWithData });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
