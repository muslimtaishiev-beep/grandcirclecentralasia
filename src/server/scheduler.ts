import admin from "firebase-admin";
import { Router } from "express";
import { createHash } from "crypto";
import { verifySession } from "./session.js";

/**
 * Отложенные задачи: «письмо через 5 минут», «опубликовать в 18:00».
 *
 * Задача — документ scheduled_jobs (пишет только сервер). Её выполняет тот,
 * кто первым придёт после runAt:
 *  - будильник хостинга (Vercel Cron) или любой внешний — /api/cron/tick;
 *  - страховка: открытый кабинет сотрудника раз в минуту зовёт /api/cron/poke.
 * Захват задачи — транзакцией, поэтому одна задача выполняется один раз.
 */

const db = () => admin.firestore();
const COL = "scheduled_jobs";

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export interface Job<P = any> {
  id: string;
  tenantId: string;
  kind: string;
  /** Ключ «одна задача на предмет»: новая с тем же ключом отменяет прежнюю. */
  key: string;
  runAt: number;
  payload: P;
  status: JobStatus;
  createdAt: number;
  createdBy: { uid: string; name: string };
  result?: string;
  doneAt?: number;
  attempts?: number;
}

type Handler = (job: Job) => Promise<string | void>;
const handlers = new Map<string, Handler>();
/** Служебная проверка будильника: ничего не делает, только отмечается выполненной. */
const pingHandler: Handler = async () => "ok";

/** Обработчик вида задачи; вернул строку — она пишется в result. Бросил — failed. */
export function registerJobHandler(kind: string, fn: Handler) { handlers.set(kind, fn); }
registerJobHandler("ping", pingHandler);

const keyId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 40);

/**
 * Поставить задачу. Задача с тем же key, ещё не выполненная, заменяется
 * (смена статуса заявки отменяет прежнее отложенное письмо).
 */
export async function scheduleJob<P>(o: { tenantId: string; kind: string; key: string; runAt: number; payload: P; by: { uid: string; name: string } }): Promise<Job<P>> {
  const id = keyId(`${o.tenantId}|${o.key}`);
  const job: Job<P> = {
    id, tenantId: o.tenantId, kind: o.kind, key: o.key, runAt: Math.max(Date.now(), Math.floor(o.runAt)),
    payload: o.payload, status: "pending", createdAt: Date.now(), createdBy: o.by, attempts: 0,
  };
  await db().collection(COL).doc(id).set(JSON.parse(JSON.stringify(job)));
  return job;
}

/** Отменить ещё не выполненную задачу по ключу. true — была и отменена. */
export async function cancelJob(tenantId: string, key: string): Promise<boolean> {
  const ref = db().collection(COL).doc(keyId(`${tenantId}|${key}`));
  return db().runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.data()?.status !== "pending") return false;
    tx.update(ref, { status: "cancelled", doneAt: Date.now() });
    return true;
  });
}

/** Задача по ключу (для показа «запланировано на …»). */
export async function jobFor(tenantId: string, key: string): Promise<Job | null> {
  const s = await db().collection(COL).doc(keyId(`${tenantId}|${key}`)).get();
  return s.exists ? (s.data() as Job) : null;
}

/** Выполнить созревшие задачи. Возвращает, сколько выполнено. */
export async function runDueJobs(limit = 25): Promise<number> {
  const due = await db().collection(COL).where("status", "==", "pending").where("runAt", "<=", Date.now()).orderBy("runAt").limit(limit).get();
  let n = 0;
  for (const d of due.docs) {
    const claimed = await db().runTransaction(async tx => {
      const s = await tx.get(d.ref);
      if (s.data()?.status !== "pending") return null;
      tx.update(d.ref, { status: "running", attempts: (s.data()?.attempts || 0) + 1 });
      return s.data() as Job;
    }).catch(() => null);
    if (!claimed) continue;
    const fn = handlers.get(claimed.kind);
    try {
      if (!fn) throw new Error(`Нет обработчика «${claimed.kind}»`);
      const r = await fn(claimed);
      await d.ref.update({ status: "done", doneAt: Date.now(), result: String(r || "").slice(0, 500) });
      n++;
    } catch (e: any) {
      console.error("[scheduler]", claimed.kind, e?.message || e);
      await d.ref.update({ status: "failed", doneAt: Date.now(), result: String(e?.message || e).slice(0, 500) });
    }
  }
  return n;
}

let lastPoke = 0;
export const schedulerRouter = Router();


/**
 * Будильник (Vercel Cron, любой внешний, кабинет сотрудника). Секрет не нужен:
 * выполняется только созревшее, каждая задача — один раз; частота ограничена.
 */
async function sweep(): Promise<number> {
  if (Date.now() - lastPoke < 20_000) return 0;
  lastPoke = Date.now();
  const gate = db().collection("system").doc("scheduler");
  const go = await db().runTransaction(async tx => {
    const s = await tx.get(gate);
    if (Date.now() - Number(s.data()?.lastRun || 0) < 20_000) return false;
    tx.set(gate, { lastRun: Date.now() }, { merge: true });
    return true;
  });
  return go ? runDueJobs(50) : 0;
}
schedulerRouter.all("/tick", async (_req: any, res: any) => {
  try { return res.json({ success: true, ran: await sweep() }); }
  catch (e: any) { console.error("[scheduler] tick", e); return res.status(500).json({ success: false }); }
});

/** Страховка: кабинет сотрудника зовёт раз в минуту. Не чаще раза в 45 с на экземпляр и на платформу. */
schedulerRouter.post("/poke", async (req: any, res: any) => {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ success: false });
    await verifySession(token);
    return res.json({ success: true, ran: await sweep() });
  } catch { return res.json({ success: false }); }
});
