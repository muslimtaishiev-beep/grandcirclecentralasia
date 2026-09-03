import admin from "firebase-admin";
import { effectiveDisabledScreens, normalizeTenantStatus, WORKSPACE_SCREENS } from "../shared/permissions.js";

/**
 * Открыта ли организация — и открыт ли в ней раздел.
 *
 * Суперадмин может приостановить организацию и закрыть ей разделы. Раньше
 * статус писался и никем не читался: сотрудники «заблокированной» компании
 * работали как ни в чём не бывало, а закрытый раздел прятался только в меню
 * — его данные оставались доступны по прямому запросу к API.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: any | null }>();

export async function loadTenant(id: string): Promise<any | null> {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const snap = await admin.firestore().collection("tenants").doc(id).get();
  const data = snap.exists ? { ...snap.data(), id: snap.id } : null;
  cache.set(id, { at: Date.now(), data });
  return data;
}

/** После любой записи в документ организации. */
export const invalidateTenant = (id: string) => { cache.delete(id); };

export const SUSPENDED_MESSAGE = "Организация приостановлена. Обратитесь к администратору платформы.";
const screenLabel = (k: string) => WORKSPACE_SCREENS.find(s => s.key === k)?.label || k;

// Плоский тип, а не размеченное объединение: проект собирается без
// strictNullChecks, и `if (!gate.ok)` там не сужает тип.
export interface TenantGate {
  ok: boolean;
  tenant?: any;
  status?: number;
  error?: string;
  reason?: "missing" | "not_found" | "suspended" | "screen_off";
}

export async function checkTenantOpen(tenantId: unknown, navKey?: string): Promise<TenantGate> {
  const id = String(tenantId || "").trim();
  if (!id) return { ok: false, status: 400, error: "Не указана организация", reason: "missing" };
  const t = await loadTenant(id);
  if (!t) return { ok: false, status: 404, error: "Организация не найдена", reason: "not_found" };
  if (normalizeTenantStatus(t.status) === "suspended") {
    return { ok: false, status: 403, error: SUSPENDED_MESSAGE, reason: "suspended" };
  }
  if (navKey && effectiveDisabledScreens(t).has(navKey)) {
    return { ok: false, status: 403, error: `Раздел «${screenLabel(navKey)}» отключён для вашей организации`, reason: "screen_off" };
  }
  return { ok: true, tenant: t };
}

/**
 * Middleware для кабинетных роутов: организация активна, раздел не выключен.
 * Суперадмин проходит всегда — иначе приостановленную организацию было бы
 * не разблокировать.
 */
export const requireScreen = (navKey: string, pick?: (req: any) => unknown) =>
  async (req: any, res: any, next: any) => {
    const id = String((pick ? pick(req) : (req.params?.id || req.body?.tenantId || req.query?.tenantId)) || "");
    if (req.user?.isSuperadmin === true) {
      req.tenant = await loadTenant(id);
      return next();
    }
    const gate = await checkTenantOpen(id, navKey);
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error, reason: gate.reason });
    req.tenant = gate.tenant;
    next();
  };

/** Ошибка с HTTP-статусом — для строгой проверки организации в старых ручках. */
export class TenantError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Обязательный идентификатор организации. Раньше отсутствующий tenantId
 * молча подменялся Академией — и данные чужой организации уезжали к ней.
 */
export function requireTenantId(v: unknown): string {
  const id = String(v ?? "").trim();
  if (!id) throw new TenantError(400, "Не указана организация");
  return id;
}

export async function loadTenantOrThrow(v: unknown): Promise<any> {
  const id = requireTenantId(v);
  const t = await loadTenant(id);
  if (!t) throw new TenantError(404, "Организация не найдена");
  return t;
}
