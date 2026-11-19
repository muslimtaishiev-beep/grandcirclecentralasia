import admin from "firebase-admin";
import { syncClaims } from "./claims.js";

/**
 * Создание организации — только сервером.
 *
 * Раньше суперадмин создавал организацию прямо из браузера: документ
 * tenants/{id} писался через setDoc без проверки, поэтому субдомен
 * существующей школы её затирал, а членство владельца писалось с клиента
 * (теперь правила это запрещают) и без userId — владелец не входил.
 */

type Db = FirebaseFirestore.Firestore;

export class ProvisionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api", "mail", "staging", "dev", "studyfreeforum"]);
const TIERS = new Set(["starter", "business", "enterprise"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSubdomain(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);
}

export interface ProvisionInput {
  name: string;
  subdomain: string;
  ownerEmail: string;
  tierId?: string;
  phone?: string;
  actorUid: string;
}

export interface ProvisionResult {
  tenantId: string;
  subdomain: string;
  ownerUid: string;
  ownerEmail: string;
  inviteEmailSent: boolean;
  inviteLink?: string;
}

const DEFAULT_STAGES = [
  { id: "new", name: "Новый", color: "#3b82f6", order: 0, probabilityPercent: 10 },
  { id: "work", name: "В работе", color: "#8b5cf6", order: 1, probabilityPercent: 40 },
  { id: "decision", name: "Принимает решение", color: "#f59e0b", order: 2, probabilityPercent: 70 },
  { id: "won", name: "Успешно", color: "#10b981", order: 3, probabilityPercent: 100, isWonStage: true },
  { id: "lost", name: "Отказ", color: "#ef4444", order: 4, probabilityPercent: 0, isLostStage: true },
];

export async function provisionTenant(db: Db, input: ProvisionInput): Promise<ProvisionResult> {
  const name = String(input.name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  if (!name) throw new ProvisionError(400, "Укажите название организации");
  const sub = normalizeSubdomain(input.subdomain || name);
  if (sub.length < 3) throw new ProvisionError(400, "Субдомен должен быть от 3 символов: латиница, цифры, дефис");
  if (RESERVED_SUBDOMAINS.has(sub)) throw new ProvisionError(400, `Субдомен «${sub}» зарезервирован`);
  const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(ownerEmail)) throw new ProvisionError(400, "Укажите почту владельца");
  const tierId = TIERS.has(String(input.tierId)) ? String(input.tierId) : "starter";

  const tenantId = `org_${sub.replace(/-/g, "_")}`;
  const tenantRef = db.collection("tenants").doc(tenantId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Занятость — и по id, и по субдомену: у старых организаций они могут не совпадать.
  // Сам документ создаётся в транзакции через create(): одновременный второй запрос
  // с тем же субдоменом не перезапишет первый.
  const subTaken = await db.collection("tenants").where("subdomain", "==", sub).limit(1).get();
  if (!subTaken.empty) throw new ProvisionError(409, `Субдомен «${sub}» уже занят`);

  await db.runTransaction(async tx => {
    const cur = await tx.get(tenantRef);
    if (cur.exists) throw new ProvisionError(409, `Субдомен «${sub}» уже занят`);
    tx.create(tenantRef, {
      id: tenantId,
      slug: sub,
      subdomain: sub,
      name,
      tierId,
      platformDisabledScreens: [],
      ownerEmail,
      needsWorkspaceSetup: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUid,
      branding: { logoUrl: null, primaryColor: "#000000", loginMessage: null },
      settings: { maxStudents: 50, allowedDomains: [], proctoringEnabled: false, storageProvider: "firebase_storage", gasUrl: null, gasApiKey: null },
      contacts: { email: ownerEmail, phone: String(input.phone ?? "").slice(0, 40) },
    });
    tx.set(tenantRef.collection("billing").doc("subscription"), { tierId, status: "active", createdAt: now, updatedAt: now });
    // Воронка по умолчанию: без неё «Сделки» вечно грузятся.
    tx.set(tenantRef.collection("crm_pipelines").doc("default_pipeline"), {
      tenantId, name: "Воронка продаж", isDefault: true, stages: DEFAULT_STAGES, createdAt: Date.now(),
    });
  });

  // Владелец: существующий аккаунт или новый без пароля — пароль он задаёт сам по письму.
  let ownerUser: admin.auth.UserRecord;
  let createdOwner = false;
  try {
    ownerUser = await admin.auth().getUserByEmail(ownerEmail);
  } catch (e: any) {
    if (e?.code !== "auth/user-not-found") throw e;
    ownerUser = await admin.auth().createUser({ email: ownerEmail, emailVerified: false });
    createdOwner = true;
  }
  const ownerUid = ownerUser.uid;

  const membershipId = `mem_${ownerUid}_${tenantId}`;
  await db.collection("memberships").doc(membershipId).set({
    id: membershipId,
    userId: ownerUid,
    userEmail: ownerEmail,
    email: ownerEmail,
    displayName: ownerUser.displayName || ownerEmail.split("@")[0],
    tenantId,
    role: "org:owner",
    status: "active",
    invitedBy: input.actorUid,
    joinedAt: now,
  });
  try { await syncClaims(db, ownerUid); } catch (e: any) { console.error("[provisionTenant] claims:", e?.message); }

  // Письмо «установите пароль»: только sendOobCode реально отправляет почту.
  let inviteEmailSent = false;
  let inviteLink: string | undefined;
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (apiKey) {
    try {
      const oob = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: ownerEmail }),
      });
      inviteEmailSent = oob.ok;
    } catch (e: any) {
      console.error("[provisionTenant] письмо владельцу:", e?.message);
    }
  }
  // Письмо не ушло — ссылку получает суперадмин (только для нового, ещё без
  // пароля аккаунта: ссылку сброса чужого существующего аккаунта не выдаём).
  if (!inviteEmailSent && createdOwner) {
    try { inviteLink = await admin.auth().generatePasswordResetLink(ownerEmail); } catch { /* пусто */ }
  }

  return { tenantId, subdomain: sub, ownerUid, ownerEmail, inviteEmailSent, ...(inviteLink ? { inviteLink } : {}) };
}
