import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { requireScreen } from "../server/tenantAccess.js";
import { hasPerm, staffCaller, type StaffCaller } from "../server/access.js";
import { effectiveDisabledScreens, type PermissionKey } from "../shared/permissions.js";
import { candidateOf } from "../shared/admissions.js";

/**
 * Главная: сводка организации одним запросом.
 *
 * Данные отдаёт сервер и только то, на что у сотрудника есть право: клиент
 * ничего не читает из базы напрямую. Каждый блок считается отдельно — упал
 * один, остальные на месте, а у упавшего `ok: false` (не ноль). Блок без
 * права или у выключенного раздела в ответе отсутствует.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const SAFE_ID = /^[\w-]{1,64}$/;
const LIMIT = 2000;

const num = (v: unknown) => parseFloat(String(v ?? "0").replace(/[^\d.]/g, "")) || 0;

type Block = { ok: true } & Record<string, any> | { ok: false };
const safe = async (name: string, fn: () => Promise<Record<string, any>>): Promise<Block> => {
  try { return { ok: true, ...(await fn()) }; } catch (e: any) { console.warn(`[dashboard] ${name}:`, e?.message); return { ok: false }; }
};

/** Права на каждый блок. Те же, что открывают соответствующий раздел. */
const NEED = {
  members: ["team:view", "team:manage"],
  tasks: ["tasks:use"],
  deals: ["crm:read", "crm:manage"],
  exams: ["tests:manage", "placement:manage"],
  review: ["tests:review", "tests:manage"],
  admissions: ["admission:manage", "psych:view", "psych:conduct"],
  emails: ["settings:manage", "team:manage", "admission:manage", "tests:manage", "crm:manage", "certificates:issue"],
  forms: ["team:manage", "certificates:issue", "crm:manage"],
  finance: ["finance:view", "edu:payroll"],
} satisfies Record<string, PermissionKey[]>;

const SCREEN: Record<string, string> = {
  members: "team", tasks: "tasks", deals: "crm", exams: "exams", review: "exams",
  admissions: "admissions", emails: "emailTemplates", forms: "forms", finance: "payroll",
};

router.get("/:tenantId", requireFirebaseAuth, requireScreen("dashboard", (req: any) => req.params.tenantId), async (req: any, res: any) => {
  const t = String(req.params.tenantId || "");
  if (!SAFE_ID.test(t)) return res.status(400).json({ success: false, error: "Неверная организация" });
  let c: StaffCaller | null;
  try { c = await staffCaller(db(), t, req.user); } catch (e: any) { console.error("[dashboard]", e); return res.status(500).json({ success: false, error: "Не удалось проверить доступ" }); }
  if (!c?.member) return res.status(403).json({ success: false, error: "Доступно только сотрудникам организации" });

  const off = req.tenant ? effectiveDisabledScreens(req.tenant) : new Set<string>();
  const can = (k: keyof typeof NEED) => !off.has(SCREEN[k]) && hasPerm(c, ...(NEED[k] as PermissionKey[]));
  const today = new Date().toISOString().slice(0, 10);
  const jobs: Record<string, Promise<Block>> = {};

  if (can("members")) jobs.members = safe("members", async () => {
    const s = await db().collection("memberships").where("tenantId", "==", t).where("status", "==", "active").select().get();
    return { count: s.size };
  });

  if (can("tasks")) jobs.tasks = safe("tasks", async () => {
    const s = await col(t, "workspace_tasks").limit(LIMIT).get();
    const all = s.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((x: any) => x.status !== "done" && x.status !== "backlog_archived");
    const mine = all.filter((x: any) => Array.isArray(x.assigneeStaffIds) && x.assigneeStaffIds.includes(c!.uid));
    const rank = (x: any) => (x.dueDate && String(x.dueDate) < today ? 0 : 1);
    mine.sort((a: any, b: any) => rank(a) - rank(b) || String(a.dueDate || "9").localeCompare(String(b.dueDate || "9")));
    return {
      open: all.length,
      mineCount: mine.length,
      overdue: mine.filter((x: any) => x.dueDate && String(x.dueDate) < today).length,
      mine: mine.slice(0, 8).map((x: any) => ({ id: x.id, title: String(x.title || "").slice(0, 200), status: String(x.status || ""), priority: String(x.priority || ""), dueDate: x.dueDate ? String(x.dueDate) : null })),
    };
  });

  if (can("deals")) jobs.deals = safe("deals", async () => {
    const s = await col(t, "crm_deals").limit(LIMIT).get();
    const open = s.docs.map(d => d.data() as any).filter(x => !x.archived && (x.status === "open" || x.status === undefined));
    return { open: open.length, amount: open.reduce((a, x) => a + num(x.amount), 0) };
  });

  if (can("exams") || can("review")) jobs.exams = safe("exams", async () => {
    const out: Record<string, any> = {};
    if (can("exams")) {
      const es = await col(t, "exams").select("status", "archived").get();
      const live = es.docs.map(d => d.data() as any).filter(x => !x.archived);
      out.openExams = live.filter(x => x.status === "open").length;
      out.totalExams = live.length;
      const ip = await col(t, "exam_attempts").where("status", "==", "in_progress").select("superseded").get();
      out.inProgress = ip.docs.filter(d => !(d.data() as any).superseded).length;
    }
    if (can("review")) {
      const fin = await col(t, "exam_attempts").where("status", "==", "finished").select("superseded", "review").get();
      out.unreviewed = fin.docs.map(d => d.data() as any).filter(x => !x.superseded && x.review?.status !== "done").length;
    }
    return out;
  });

  if (can("admissions")) jobs.admissions = safe("admissions", async () => {
    const [ap, at] = await Promise.all([
      col(t, "applicants").select("archived", "decision", "candidate", "paperResults").get(),
      col(t, "exam_attempts").where("status", "==", "finished").select("applicantId", "superseded").get(),
    ]);
    const tested = new Set(at.docs.map(d => d.data() as any).filter(x => x.applicantId && !x.superseded).map(x => String(x.applicantId)));
    const live = ap.docs.filter(d => !(d.data() as any).archived);
    const undecided = live.filter(d => {
      const a: any = d.data();
      if (candidateOf({ candidate: a.candidate, decision: a.decision })?.decisionFinal) return false;
      return tested.has(d.id) || (Array.isArray(a.paperResults) && a.paperResults.length > 0);
    }).length;
    return { total: live.length, undecided };
  });

  if (can("emails")) jobs.emails = safe("emails", async () => {
    const s = await db().collection("email_log").where("tenantId", "==", t).where("status", "==", "failed").select().get();
    return { failed: s.size };
  });

  if (can("forms")) jobs.forms = safe("forms", async () => {
    const s = await db().collection("form_submissions").where("tenantId", "==", t).where("status", "==", "new").select("deleted").get();
    return { unanswered: s.docs.filter(d => !(d.data() as any).deleted).length };
  });

  if (can("finance")) jobs.finance = safe("finance", async () => {
    const sub = await db().collection("submissions").where("tenantId", "==", t).where("finalDecision", "==", "ПРИНЯТ").get();
    let fees = 0, monthly = 0, contracts = 0;
    sub.docs.forEach(d => { const x: any = d.data(); fees += num(x.initialFee); contracts += num(x.totalCost); monthly += num(x.monthlyPaidSum || x.firstMonthPaymentAmount); });
    let payroll = 0;
    (await col(t, "payroll_records").get()).docs.forEach(d => { const p: any = d.data(); payroll += parseFloat(String(p.calc?.toPay || p.toPay || 0)) || 0; });
    const cash = fees + monthly;
    return { accepted: sub.size, fees, monthly, contracts, cash, payroll, net: cash - payroll };
  });

  const keys = Object.keys(jobs);
  const done = await Promise.all(keys.map(k => jobs[k]));
  const blocks: Record<string, Block> = {};
  keys.forEach((k, i) => { blocks[k] = done[i]; });
  return res.json({ success: true, uid: c.uid, blocks });
});

export default router;
