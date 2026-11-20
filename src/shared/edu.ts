/**
 * Расписание и абонементы — общее для сервера и экрана.
 * Время занятия — местное время организации «ГГГГ-ММ-ДДTчч:мм» без пояса.
 */
export interface DirItem { id: string; name: string }
export type PlanType = "lessons_pack" | "time_period";
export interface SubPlan { id: string; name: string; type: PlanType; lessons: number; days: number; price: number }
export interface EduDirectory { rooms: DirItem[]; groups: DirItem[]; plans: SubPlan[] }
export type SubStatus = "active" | "frozen" | "depleted" | "expired" | "canceled";
export type SubAction = "deduct" | "return" | "freeze" | "unfreeze" | "extend" | "cancel";

export const PLAN_TYPE_LABEL: Record<PlanType, string> = { lessons_pack: "Пакет занятий", time_period: "На срок" };
export const SUB_STATUS_LABEL: Record<SubStatus, string> = { active: "Активен", frozen: "Заморожен", depleted: "Исчерпан", expired: "Истёк", canceled: "Отменён" };

const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const idOf = (v: unknown) => clip(v, 40).replace(/[^\w-]/g, "");

/**
 * Время к виду «ГГГГ-ММ-ДДTчч:мм». Старые занятия хранились с «Z» в конце,
 * хотя вводилось местное время, — пояс отбрасываем: что ввели, то и показываем.
 */
export function normTime(v: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(String(v ?? ""));
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59) return "";
  return `${m[1]}T${m[2]}:${m[3]}`;
}
/** Минуты от полуночи. */
export const minutesOf = (t: string) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));

export const lessonsOverlap = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  !!a.startTime && !!b.startTime && a.startTime < b.endTime && b.startTime < a.endTime;

/** Раскладка пересекающихся занятий одного дня по колонкам. */
export function layoutDay<T extends { startTime: string; endTime: string }>(items: T[]): { item: T; col: number; cols: number }[] {
  const sorted = [...items].sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
  const out: { item: T; col: number; cols: number }[] = [];
  let cluster: { item: T; col: number; cols: number }[] = []; let clusterEnd = "";
  const flush = () => { const n = Math.max(1, ...cluster.map(c => c.col + 1)); cluster.forEach(c => (c.cols = n)); out.push(...cluster); cluster = []; };
  for (const it of sorted) {
    if (cluster.length && it.startTime >= clusterEnd) flush();
    const used = new Set(cluster.filter(c => c.item.endTime > it.startTime).map(c => c.col));
    let col = 0; while (used.has(col)) col++;
    cluster.push({ item: it, col, cols: 1 });
    if (!clusterEnd || it.endTime > clusterEnd) clusterEnd = it.endTime;
    if (cluster.length === 1) clusterEnd = it.endTime;
  }
  if (cluster.length) flush();
  return out;
}

export function sanitizePlan(raw: any): SubPlan | null {
  const type: PlanType = raw?.type === "time_period" ? "time_period" : "lessons_pack";
  const lessons = Math.floor(Number(raw?.lessons ?? raw?.totalLessons));
  const days = Math.floor(Number(raw?.days));
  const price = Math.round(Number(raw?.price) * 100) / 100;
  const name = clip(raw?.name, 80);
  if (!name || !Number.isFinite(price) || price < 0 || price > 1e9) return null;
  if (type === "lessons_pack" && !(lessons >= 1 && lessons <= 500)) return null;
  if (!(days >= 1 && days <= 730)) return null;
  return { id: idOf(raw?.id) || `p${Math.random().toString(36).slice(2, 8)}`, name, type, lessons: type === "lessons_pack" ? lessons : 0, days, price };
}

const items = (v: any, max: number): DirItem[] => {
  const seen = new Set<string>(); const out: DirItem[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const name = clip(x?.name, 80); if (!name) continue;
    const id = idOf(x?.id) || `i${Math.random().toString(36).slice(2, 8)}`;
    if (seen.has(id)) continue; seen.add(id); out.push({ id, name });
    if (out.length >= max) break;
  }
  return out;
};
export function sanitizeDirectory(raw: any): EduDirectory {
  return {
    rooms: items(raw?.rooms, 200),
    groups: items(raw?.groups, 500),
    plans: (Array.isArray(raw?.plans) ? raw.plans : []).map(sanitizePlan).filter(Boolean).slice(0, 50) as SubPlan[],
  };
}

/** Статус абонемента на дату: отмена, заморозка, исчерпан, истёк. */
export function subscriptionStatus(s: any, today: string): SubStatus {
  if (s?.canceled) return "canceled";
  if (s?.isFrozen && (!s.frozenUntilDate || s.frozenUntilDate >= today)) return "frozen";
  if (s?.type === "lessons_pack" && Number(s.remainingLessons) <= 0) return "depleted";
  if (s?.expiryDate && String(s.expiryDate).slice(0, 10) < today) return "expired";
  return "active";
}
