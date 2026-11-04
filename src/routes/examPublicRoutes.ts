import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes, randomInt } from "crypto";
import { checkTenantOpen } from "../server/tenantAccess.js";
import { pinMatches } from "../shared/pin.js";
import { tenantLogos } from "../shared/legal.js";
import { resolveLegalProfile } from "../shared/legal.js";
import { studentView, type BankQuestion } from "../shared/exams.js";
import { LEGAL_VERSION } from "../shared/legalDocs.js";
import {
  DECISION_LABEL, gradeAttempt, isWindowOpen, partResults, pickSectionQuestions,
  type Attempt, type AttemptSection, type Exam, type FrozenQuestion,
} from "../shared/examRun.js";

/**
 * «Экзамены»: страница ученика — без входа, по ссылке экзамена и PIN.
 *
 * Ученик получает секретный токен работы; ответы, сдача раздела и отчёт
 * прокторинга принимаются только с ним. (В прежнем срезе хватало знать
 * шестизначный номер — по нему можно было дописать ответы в чужую работу.)
 * Номер работы остаётся — по нему и фамилии ученик потом узнаёт результат.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
/** Сбой сервера: подробности — в журнал, ученику — общее сообщение (ошибки Firestore раскрывают проект и поля). */
const oops = (res: any, e: any) => { console.error("[exam-public]", e?.message || e); return fail(res, 500, "Ошибка сервера — попробуйте ещё раз через минуту"); };
/** Запас на сеть: последний ответ, отправленный в последнюю секунду, не теряется. */
const GRACE_MS = 45_000;

type Full = Attempt & { token: string; questions: Record<string, FrozenQuestion> };

async function resolve(code: string): Promise<{ tenant: any; exam: Exam } | { error: string; status: number }> {
  if (!/^[A-Z0-9]{5,10}$/.test(code)) return { error: "Ссылка на экзамен неверна", status: 404 };
  const link = await db().collection("exam_links").doc(code).get();
  if (!link.exists) return { error: "Экзамен не найден", status: 404 };
  const { tenantId, examId } = link.data() as any;
  const gate = await checkTenantOpen(tenantId, "exams");
  if (!gate.ok) return { error: gate.error || "Экзамен недоступен", status: gate.status || 403 };
  const s = await col(tenantId, "exams").doc(examId).get();
  if (!s.exists || s.data()?.archived) return { error: "Экзамен не найден", status: 404 };
  return { tenant: gate.tenant, exam: { ...(s.data() as Exam), id: s.id } };
}

const orgView = (t: any) => ({ id: str(t?.id, 80), name: str(t?.name, 120), consentText: str(t?.workspaceConfig?.registration?.consentText, 1200), ...tenantLogos(t) });

async function byToken(t: string, token: string): Promise<Full | null> {
  if (!/^[\w-]{20,60}$/.test(token)) return null;
  const snap = await col(t, "exam_attempts").where("token", "==", token).limit(1).get();
  return snap.empty ? null : ({ ...(snap.docs[0].data() as Full), id: snap.docs[0].id });
}

/**
 * Сдать раздел `expected` и открыть следующий; после последнего — подсчёт.
 *
 * В транзакции и только если работа всё ещё на этом разделе: таймер
 * ученика, его нажатие и досдача со стороны менеджера могут прийти
 * одновременно, и без проверки раздел «перескакивал» через следующий.
 */
async function advance(t: string, exam: Exam, attemptId: string, expected: number, now = Date.now()): Promise<Full> {
  const ref = col(t, "exam_attempts").doc(attemptId);
  const out = await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const a = { ...(snap.data() as Full), id: snap.id };
    if (a.status !== "in_progress" || a.current !== expected) return { a, finished: false };
    const sections = a.sections.map(s => ({ ...s }));
    const cur = sections[a.current];
    if (cur && !cur.finishedAt) cur.finishedAt = now;
    const next = a.current + 1;
    const patch: Partial<Full> = { sections };
    if (next < sections.length) {
      // Следующий раздел начинается в момент окончания предыдущего: ушедший
      // ученик досдаёт разделы цепочкой, а не получает свежий таймер.
      sections[next].startedAt = now;
      sections[next].deadline = now + sections[next].minutes * 60_000;
      patch.current = next;
    } else {
      patch.status = "finished";
      patch.finishedAt = now;
      patch.result = gradeAttempt(sections, a.questions, a.answers, exam.settings, a.review?.overrides || {});
    }
    tx.update(ref, JSON.parse(JSON.stringify(patch)));
    return { a: { ...a, ...patch } as Full, finished: patch.status === "finished" };
  });
  // Ученик сдал повторную попытку — прежняя больше не считается.
  if (out.finished) await supersedeOthers(t, out.a);
  return out.a;
}

export async function supersedeOthers(t: string, a: Full) {
  const key = identityKey(a.student);
  const snap = await col(t, "exam_attempts").where("examId", "==", a.examId).where("identity", "==", key).get();
  const b = db().batch(); let n = 0;
  for (const d of snap.docs) if (d.id !== a.id && d.data().status === "finished" && !d.data().superseded) { b.update(d.ref, { superseded: true, supersededBy: a.id }); n++; }
  if (n) await b.commit();
}

/**
 * Время раздела вышло, а ученик закрыл вкладку или пропала сеть: разделы
 * досдаются сами — по запросу ученика или при открытии списка менеджером.
 */
export async function finalizeIfExpired(t: string, exam: Exam, a0: Attempt, now = Date.now()): Promise<Attempt> {
  let a = a0 as Full;
  for (let guard = 0; guard < 25 && a.status === "in_progress"; guard++) {
    const cur = a.sections[a.current];
    if (!cur?.deadline || now <= cur.deadline + GRACE_MS) break;
    a = await advance(t, exam, a.id, a.current, cur.deadline);
  }
  return a;
}

const digits = (s: string) => s.replace(/\D/g, "");
/**
 * Счётчик неудачных попыток: PIN из 4 цифр с окном ±1 час (3 кода из 9000)
 * при общем лимите перебирался бы за пару минут, номер работы с фамилией —
 * за несколько часов. После 10 ошибок за 10 минут адрес ждёт до конца окна.
 * Память процесса: на нескольких экземплярах сервера защита частичная, но
 * перебор всё равно замедляется на порядки.
 */
const FAIL_WINDOW = 10 * 60_000, FAIL_LIMIT = 10;
const failures = new Map<string, { n: number; until: number }>();
function blocked(key: string): number {
  const f = failures.get(key);
  if (!f || Date.now() > f.until) return 0;
  return f.n >= FAIL_LIMIT ? Math.ceil((f.until - Date.now()) / 60_000) : 0;
}
function fail1(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() > f.until) failures.set(key, { n: 1, until: Date.now() + FAIL_WINDOW });
  else f.n++;
  if (failures.size > 50_000) for (const [k, v] of failures) if (Date.now() > v.until) failures.delete(k);
}

/**
 * Кто сдаёт: ФИО (порядок слов не важен) и, если спрашиваем, телефон.
 * Только по телефону было нельзя: кто знает номер одноклассника, мог
 * начать «его» работу (и заблокировать ему вход) или сдать пустую
 * пересдачу, которая заменяла его настоящую.
 */
const nameKey = (n: string) => n.toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter(Boolean).sort().join(" ");
const identityKey = (st: Attempt["student"]) => `${digits(st.phone).slice(-9) ? `p:${digits(st.phone).slice(-9)}|` : ""}n:${nameKey(st.name)}`;

/** То, что ученик видит про работу: без ключей и без чужих разделов. */
function studentState(exam: Exam, a: Full) {
  // Раздел ещё не запущен (ждём фото) — вопросы не показываем.
  const cur = a.status === "in_progress" && a.sections[a.current]?.deadline ? a.sections[a.current] : null;
  const showNow = a.status === "finished" && exam.settings.results.showToStudent === "immediately";
  return {
    shortId: a.shortId,
    status: a.status,
    waitingStart: a.status === "in_progress" && !a.sections[a.current]?.deadline,
    student: { name: a.student.name },
    current: a.current,
    sections: a.sections.map(s => ({ id: s.id, title: s.title, minutes: s.minutes, count: s.questionIds.length, finished: !!s.finishedAt })),
    section: cur ? {
      id: cur.id, title: cur.title, deadline: cur.deadline,
      blocks: (cur.blocks || []).map(b => ({ title: b.title, first: b.questionIds[0] })),
      questions: cur.questionIds.map(id => a.questions[id]).filter(Boolean).map(q => studentView(q as unknown as BankQuestion)),
      answers: Object.fromEntries(cur.questionIds.filter(id => a.answers[id] !== undefined).map(id => [id, a.answers[id]])),
    } : null,
    result: showNow && a.result ? publicResult(exam, a) : null,
    serverNow: Date.now(),
  };
}

function publicResult(exam: Exam, a: Attempt) {
  const r = a.result!;
  const parts = partResults(r.sections, exam.settings.scoring);
  // Части нельзя смешивать — общий итог ученику не показываем вовсе.
  const hideTotal = parts.length > 0 && !!exam.settings.scoring.hideTotal;
  return {
    percent: r.percent, earned: r.earned, max: r.max, correct: r.correct, total: r.total,
    sections: r.sections, mark: hideTotal ? null : r.mark, band: hideTotal ? null : r.band, scaleLabel: hideTotal ? null : r.scaleLabel,
    parts: parts.map(p => ({ title: p.title, value: p.value })), hideTotal,
    topics: r.topics.slice(0, 30),
    group: exam.settings.results.groups.length ? a.group || null : null,
    decision: exam.settings.results.decisions && a.decision ? DECISION_LABEL[a.decision.value] : null,
    finishedAt: a.finishedAt,
  };
}

// ── Ручки ───────────────────────────────────────────────────────────────

router.get("/:code", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const { exam, tenant } = r;
    const now = Date.now();
    return res.json({
      success: true,
      org: orgView(tenant),
      exam: {
        title: exam.title, description: exam.description,
        open: isWindowOpen(exam, now), status: exam.status,
        opensAt: exam.settings.access.opensAt, closesAt: exam.settings.access.closesAt,
        needPin: exam.settings.access.pinMode !== "none",
        registration: exam.settings.registration,
        proctoring: { enabled: exam.settings.proctoring.enabled, detectors: exam.settings.proctoring.detectors, tabSwitch: exam.settings.proctoring.tabSwitch },
        sections: exam.sections.map(s => ({ title: s.title, minutes: s.minutes })),
        resultsMode: exam.settings.results.showToStudent,
        // У экзаменов, сохранённых до появления настройки, её нет — по умолчанию по одному.
        layout: exam.settings.display?.layout === "list" ? "list" : "paged",
      },
    });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:code/start", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const { exam, tenant } = r; const t = exam.tenantId;
    if (!isWindowOpen(exam)) return fail(res, 403, exam.status === "open" ? "Экзамен сейчас закрыт — проверьте время начала" : "Экзамен не открыт для сдачи");
    const reg = exam.settings.registration;
    const student = {
      name: str(req.body?.name, 120), phone: reg.phone ? str(req.body?.phone, 30) : "",
      email: reg.email ? str(req.body?.email, 120).toLowerCase() : "", level: reg.level ? str(req.body?.level, 30) : "",
    };
    if (student.name.split(/\s+/).filter(Boolean).length < 2) return fail(res, 400, "Укажите фамилию и имя полностью");
    if (reg.phone && digits(student.phone).length < 9) return fail(res, 400, "Укажите номер телефона");
    if (reg.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(student.email)) return fail(res, 400, "Укажите почту");
    if (reg.level && !student.level) return fail(res, 400, `Укажите: ${reg.levelLabel.toLowerCase()}`);
    if (req.body?.consent !== true) return fail(res, 400, "Нужно согласие на обработку персональных данных");
    const acc = exam.settings.access;
    const pin = str(req.body?.pin, 12).replace(/\D/g, "");
    const pinKey = `pin:${exam.id}:${req.ip}`;
    const wait = blocked(pinKey);
    if (wait) return fail(res, 429, `Слишком много неверных PIN. Попробуйте через ${wait} мин.`);
    const pinOk = acc.pinMode === "none" || (acc.pinMode === "hourly" ? pinMatches(pin, `${t}:${exam.id}`) : pin === acc.fixedPin.replace(/\D/g, ""));
    if (!pinOk) { fail1(pinKey); return fail(res, 403, "Неверный PIN — уточните его у организатора в аудитории"); }

    const identity = identityKey(student);
    const ids = [...new Set(exam.sections.map(s => s.disciplineId))];
    const bank: BankQuestion[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const snap = await col(t, "exam_bank").where("disciplineId", "in", ids.slice(i, i + 10)).get();
      bank.push(...snap.docs.map(d => ({ ...(d.data() as BankQuestion), id: d.id })));
    }
    const now = Date.now();
    const questions: Record<string, FrozenQuestion> = {};
    const parts: AttemptSection[] = exam.sections.map((s, i) => {
      const qs = pickSectionQuestions(s, bank);
      for (const q of qs) { const { tenantId: _t, source: _s, createdAt: _c, updatedAt: _u, updatedBy: _b, ...frozen } = q as any; questions[q.id] = frozen; }
      return {
        id: s.id, title: s.title, disciplineId: s.disciplineId, minutes: s.minutes, questionIds: qs.map(q => q.id),
        startedAt: i === 0 ? now : null, deadline: i === 0 ? now + s.minutes * 60_000 : null, finishedAt: null,
      };
    });
    // Дисциплины «с общим таймером» сливаются с предыдущей в одну часть:
    // одна страница, один таймер, но блоки — для заголовков и баллов.
    const sections: AttemptSection[] = [];
    exam.sections.forEach((s, i) => {
      const p = parts[i];
      if (!p.questionIds.length) return;
      const block = { id: p.id, title: p.title, disciplineId: p.disciplineId, questionIds: p.questionIds };
      const last = sections[sections.length - 1];
      if (s.joinPrev && last) {
        last.blocks = [...(last.blocks || [{ id: last.id, title: last.title, disciplineId: last.disciplineId, questionIds: last.questionIds }]), block];
        last.questionIds = [...last.questionIds, ...p.questionIds];
        last.title = last.blocks.map(x => x.title).join(", ");
      } else sections.push({ ...p });
    });
    if (!sections.length) return fail(res, 503, "Для экзамена нет вопросов — сообщите организатору");
    // С фото таймер первого раздела запускается после снимка (/begin), иначе
    // время на фотографию съедало бы время экзамена.
    if (exam.settings.registration.photo) { sections[0].startedAt = null; sections[0].deadline = null; }
    else { sections[0].startedAt = now; sections[0].deadline = now + sections[0].minutes * 60_000; }

    let shortId = "";
    for (let k = 0; k < 8 && !shortId; k++) {
      const c = String(randomInt(100000, 1000000));
      const clash = await col(t, "exam_attempts").where("examId", "==", exam.id).where("shortId", "==", c).limit(1).get();
      if (clash.empty) shortId = c;
    }
    const token = randomBytes(24).toString("base64url");
    const ref = col(t, "exam_attempts").doc();
    const attempt: Full & { identity: string; consent: object } = {
      id: ref.id, tenantId: t, examId: exam.id, examTitle: exam.title, shortId, token, identity,
      student, status: "in_progress", startedAt: now, finishedAt: null, current: 0, sections, questions,
      answers: {}, result: null, review: { status: "none", overrides: {}, notes: {} },
      proctoring: { enabled: exam.settings.proctoring.enabled },
      published: false, decision: null, group: null, retakeAllowed: false, superseded: false, hasPhoto: false,
      meta: { ip: str(req.ip, 64), userAgent: str(req.headers["user-agent"], 300) },
      // Согласие — с редакцией документов и временем: доказательство для Организации.
      consent: { at: now, version: LEGAL_VERSION, ip: str(req.ip, 64), custom: !!str(tenant?.workspaceConfig?.registration?.consentText, 10) },
    };
    // Проверка попыток и создание — одной транзакцией: два параллельных
    // «Начать» не создадут две работы и не потратят одно разрешение дважды.
    // Считаются все неаннулированные попытки, в том числе заменённые
    // пересдачей: иначе при лимите 2 пересдавать можно было бесконечно.
    const refused = await db().runTransaction(async tx => {
      const prev = await tx.get(col(t, "exam_attempts").where("examId", "==", exam.id).where("identity", "==", identity));
      const alive = prev.docs.map(d => ({ ...(d.data() as Full), id: d.id })).filter(a => a.status !== "annulled");
      if (alive.some(a => a.status === "in_progress")) return "У вас уже начата работа на другом устройстве. Продолжите там или обратитесь к организатору.";
      const grant = alive.find(a => a.retakeAllowed);
      if (alive.length >= acc.maxAttempts && !grant) return "Вы уже сдавали этот экзамен. Если нужна пересдача — обратитесь к организатору.";
      if (alive.length >= acc.maxAttempts && grant) tx.update(col(t, "exam_attempts").doc(grant.id), { retakeAllowed: false });
      tx.set(ref, JSON.parse(JSON.stringify(attempt)));
      return null;
    });
    if (refused) return fail(res, 409, refused);
    return res.json({ success: true, token, shortId, org: orgView(tenant), state: studentState(exam, attempt) });
  } catch (e: any) { return oops(res, e); }
});

/** Состояние работы по токену — для продолжения после перезагрузки. */
router.post("/:code/state", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    let a = await byToken(r.exam.tenantId, str(req.body?.token, 80));
    if (!a || a.examId !== r.exam.id) return fail(res, 404, "Работа не найдена", { reset: true });
    if (a.status === "annulled") return fail(res, 410, "Работа аннулирована организатором", { reset: true });
    a = (await finalizeIfExpired(r.exam.tenantId, r.exam, a)) as Full;
    return res.json({ success: true, state: studentState(r.exam, a) });
  } catch (e: any) { return oops(res, e); }
});

/** Ответы текущего раздела: { token, answers: { id: значение } } — пачкой. */
router.post("/:code/answer", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const t = r.exam.tenantId;
    const token = str(req.body?.token, 80);
    const ref0 = await byToken(t, token);
    if (!ref0 || ref0.examId !== r.exam.id) return fail(res, 404, "Работа не найдена", { reset: true });
    const ref = col(t, "exam_attempts").doc(ref0.id);
    const out = await db().runTransaction(async tx => {
      const s = await tx.get(ref); const a = s.data() as Full;
      if (a.status !== "in_progress") return { status: 409, error: "Работа уже сдана" };
      const cur = a.sections[a.current];
      if (cur.deadline && Date.now() > cur.deadline + GRACE_MS) return { status: 409, error: "Время раздела вышло" };
      const allowed = new Set(cur.questionIds);
      const patch: Record<string, string> = {};
      for (const [qid, v] of Object.entries(req.body?.answers || {})) {
        if (!allowed.has(qid)) continue;
        patch[`answers.${qid}`] = String(v ?? "").slice(0, 2000);
      }
      if (Object.keys(patch).length) tx.update(ref, patch);
      return { saved: Object.keys(patch).length };
    });
    if ("error" in out) return fail(res, out.status as number, out.error as string);
    return res.json({ success: true, saved: out.saved, serverNow: Date.now() });
  } catch (e: any) { return oops(res, e); }
});

/** Сдать раздел (ученик нажал «Завершить раздел» или вышло время). */
router.post("/:code/finish-section", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const t = r.exam.tenantId;
    let a = await byToken(t, str(req.body?.token, 80));
    if (!a || a.examId !== r.exam.id) return fail(res, 404, "Работа не найдена", { reset: true });
    // Сначала досдаём просроченное: вернувшись через час, ученик не должен
    // получить свежий таймер на следующий раздел.
    a = (await finalizeIfExpired(t, r.exam, a)) as Full;
    if (a.status !== "in_progress") return res.json({ success: true, state: studentState(r.exam, a) });
    if (req.body?.sectionId && a.sections[a.current]?.id !== req.body.sectionId) {
      return res.json({ success: true, state: studentState(r.exam, a) }); // повторное нажатие — раздел уже сдан
    }
    a = await advance(t, r.exam, a.id, a.current);
    return res.json({ success: true, state: studentState(r.exam, a) });
  } catch (e: any) { return oops(res, e); }
});

/** Запустить таймер раздела, отложенного до фото. Повторный вызов ничего не меняет. */
router.post("/:code/begin", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const t = r.exam.tenantId;
    const a0 = await byToken(t, str(req.body?.token, 80));
    if (!a0 || a0.examId !== r.exam.id) return fail(res, 404, "Работа не найдена", { reset: true });
    const ref = col(t, "exam_attempts").doc(a0.id);
    const a = await db().runTransaction(async tx => {
      const a1 = { ...((await tx.get(ref)).data() as Full), id: a0.id };
      const cur = a1.sections[a1.current];
      if (a1.status === "in_progress" && cur && !cur.deadline) {
        const now = Date.now();
        const sections = a1.sections.map((x, i) => (i === a1.current ? { ...x, startedAt: now, deadline: now + x.minutes * 60_000 } : x));
        tx.update(ref, { sections });
        return { ...a1, sections };
      }
      return a1;
    });
    return res.json({ success: true, state: studentState(r.exam, a) });
  } catch (e: any) { return oops(res, e); }
});

/** Фото на сертификат — до начала экзамена; одно, перезаписывается. */
router.post("/:code/photo", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const a = await byToken(r.exam.tenantId, str(req.body?.token, 80));
    if (!a || a.examId !== r.exam.id) return fail(res, 404, "Работа не найдена");
    if (a.status !== "in_progress") return fail(res, 409, "Фото можно сделать только перед экзаменом");
    const photo = String(req.body?.photo || "");
    if (!/^data:image\/jpeg;base64,/.test(photo) || photo.length > 400_000) return fail(res, 400, "Фото не подходит");
    await col(r.exam.tenantId, "exam_photos").doc(a.id).set({ photo, at: Date.now() });
    await col(r.exam.tenantId, "exam_attempts").doc(a.id).update({ hasPhoto: true });
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Протокол прокторинга: нарушения с отметкой времени и до 20 снимков. */
router.post("/:code/proctoring", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const t = r.exam.tenantId;
    const a = await byToken(t, str(req.body?.token, 80));
    if (!a || a.examId !== r.exam.id) return fail(res, 404, "Работа не найдена");
    // Протокол принимается один раз: иначе после сдачи можно прислать
    // «чистый» протокол поверх настоящего.
    if (a.proctoring?.endedAt) return fail(res, 409, "Протокол уже получен");
    const b = req.body || {};
    const startedAt = Number(b.startedAt) || null;
    const violations = (Array.isArray(b.violations) ? b.violations : []).slice(0, 300).map((v: any) => ({
      type: str(v?.type, 40), severity: ["LOW", "MEDIUM", "HIGH"].includes(v?.severity) ? v.severity : "LOW",
      description: str(v?.description, 200), atMs: Math.max(0, Number(v?.timestamp) - (startedAt || 0)) || 0,
    }));
    const bySeverity: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const v of violations) bySeverity[v.severity]++;
    let total = 0;
    const snapshots = (Array.isArray(b.snapshots) ? b.snapshots : []).slice(0, 20)
      .filter((x: any) => /^data:image\/jpeg;base64,/.test(String(x?.dataUrl || "")) && String(x.dataUrl).length < 150_000)
      .filter((x: any) => (total += String(x.dataUrl).length) < 900_000)
      .map((x: any) => ({ type: str(x.type, 40), atMs: Math.max(0, Number(x.atMs) - (startedAt || 0)) || 0, dataUrl: String(x.dataUrl) }));
    const summary = {
      enabled: true, unavailable: b.unavailable === true,
      honestyIndex: Number.isFinite(Number(b.honestyIndex)) ? Math.round(Number(b.honestyIndex)) : null,
      totalViolations: violations.length, bySeverity, violations: violations.slice(0, 200),
      snapshotCount: snapshots.length, startedAt, endedAt: Number(b.endedAt) || Date.now(),
    };
    if (snapshots.length) await col(t, "exam_evidence").doc(a.id).set({ snapshots, at: Date.now() });
    await col(t, "exam_attempts").doc(a.id).update({ proctoring: summary });
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Результат по номеру работы и фамилии — когда организатор его откроет. */
router.post("/:code/result", async (req: any, res: any) => {
  try {
    const r = await resolve(String(req.params.code).toUpperCase());
    if ("error" in r) return fail(res, r.status, r.error);
    const { exam, tenant } = r; const t = exam.tenantId;
    const shortId = str(req.body?.shortId, 10).replace(/\D/g, "");
    const name = str(req.body?.name, 80).toLowerCase().replace(/ё/g, "е").trim();
    if (!shortId || name.length < 2) return fail(res, 400, "Укажите номер работы и фамилию");
    const lookKey = `res:${exam.id}:${req.ip}`;
    const wait = blocked(lookKey);
    if (wait) return fail(res, 429, `Слишком много попыток. Попробуйте через ${wait} мин.`);
    const snap = await col(t, "exam_attempts").where("examId", "==", exam.id).where("shortId", "==", shortId).limit(1).get();
    const a = snap.empty ? null : ({ ...(snap.docs[0].data() as Full), id: snap.docs[0].id });
    // Фамилия целиком, а не первые буквы: «Ив» подходило к половине класса
    // и сильно облегчало подбор чужого номера.
    const tokens = (a?.student.name || "").toLowerCase().replace(/ё/g, "е").split(/\s+/);
    if (!a || !tokens.includes(name)) { fail1(lookKey); return fail(res, 404, "Работа с таким номером и фамилией не найдена"); }
    if (a.status === "annulled") return res.json({ success: true, state: "annulled" });
    if (a.status !== "finished") return res.json({ success: true, state: "in_progress" });
    const mode = exam.settings.results.showToStudent;
    if (mode === "never") return res.json({ success: true, state: "hidden" });
    if (mode === "after_publish" && !a.published) return res.json({ success: true, state: "pending" });
    const legal = resolveLegalProfile(tenant);
    let photo: string | null = null;
    if (exam.settings.results.certificate && a.hasPhoto) photo = (await col(t, "exam_photos").doc(a.id).get()).data()?.photo || null;
    return res.json({
      success: true, state: "ready",
      student: { name: a.student.name, level: a.student.level ? `${exam.settings.registration.levelLabel}: ${a.student.level}` : "", shortId: a.shortId },
      exam: { title: exam.title, certificate: exam.settings.results.certificate, certificateTitle: exam.settings.results.certificateTitle },
      org: orgView(tenant), school: { legalName: legal.legalName, signatoryTitle: legal.signatoryTitle, signatoryName: legal.signatoryName || "", stampUrl: legal.stampUrl || null },
      result: publicResult(exam, a), photo,
    });
  } catch (e: any) { return oops(res, e); }
});

export default router;
