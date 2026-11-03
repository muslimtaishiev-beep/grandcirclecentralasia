import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { callerPermissions } from "../server/access.js";
import { requireScreen } from "../server/tenantAccess.js";
import {
  DISCIPLINE_CODE, QUESTION_ID, SET_ID, canonicalHeader, optionColumn, plainText, isQuestionType, normalizeLevels, normalizeSetIds, parseSheetRow,
  questionId, sanitizeContent, validateQuestion,
  type BankQuestion, type Discipline, type Difficulty, type QuestionSet,
} from "../shared/exams.js";

/**
 * «Экзамены»: банк вопросов организации.
 *
 * Дисциплины и вопросы — подколлекции организации, пишет их только сервер:
 * ключи ответов не должны попадать в браузер ученика, а номера вопросов
 * («MAT-0042») выдаются по счётчику дисциплины в транзакции, без дублей.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });

/** Смотреть банк может и проверяющий; менять — тот, кто ведёт тесты или срез. */
const access = (need: "view" | "edit") => async (req: any, res: any, next: any) => {
  try {
    if (req.user?.isSuperadmin === true) { req.canEdit = true; return next(); }
    const perms = await callerPermissions(db(), req.user?.uid, String(req.params.tenantId), req.user);
    const canEdit = perms.has("tests:manage") || perms.has("placement:manage");
    const canView = canEdit || perms.has("tests:review");
    if (need === "edit" ? !canEdit : !canView) return fail(res, 403, need === "edit" ? "Менять банк вопросов может сотрудник с правом на тесты или срез" : "Нет доступа к экзаменам");
    req.canEdit = canEdit;
    next();
  } catch (e: any) { return fail(res, 500, e.message); }
};
/** Номер вопроса и код дисциплины в адресе — только по образцу: «%2F» в id давал бы вложенный путь Firestore. */
const checkParams = (req: any, res: any, next: any) => {
  if (req.params.code !== undefined && !DISCIPLINE_CODE.test(String(req.params.code))) return fail(res, 400, "Неверный код дисциплины");
  if (req.params.id !== undefined && !QUESTION_ID.test(String(req.params.id))) return fail(res, 400, "Неверный номер вопроса");
  if (req.params.setId !== undefined && !SET_ID.test(String(req.params.setId))) return fail(res, 400, "Неверный набор");
  next();
};
export const view = [requireFirebaseAuth, requireScreen("exams", (req: any) => req.params.tenantId), access("view")];
export const edit = [requireFirebaseAuth, requireScreen("exams", (req: any) => req.params.tenantId), access("edit")];
const who = (req: any) => str(req.user?.email || req.user?.uid, 120);

// ── Дисциплины ──────────────────────────────────────────────────────────

router.get("/:tenantId/disciplines", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [ds, qs] = await Promise.all([col(t, "exam_disciplines").get(), col(t, "exam_bank").select("disciplineId", "active", "levels").get()]);
    const stats = new Map<string, { total: number; active: number; levels: Set<string> }>();
    for (const d of qs.docs) {
      const x = d.data(); const k = String(x.disciplineId);
      const s = stats.get(k) || { total: 0, active: 0, levels: new Set<string>() };
      s.total++; if (x.active !== false) s.active++;
      for (const l of x.levels || []) s.levels.add(String(l));
      stats.set(k, s);
    }
    const disciplines = ds.docs.map(d => {
      const s = stats.get(d.id);
      return { ...(d.data() as Discipline), code: d.id, total: s?.total || 0, active: s?.active || 0, levels: normalizeLevels([...(s?.levels || [])]) };
    }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return res.json({ success: true, disciplines, canEdit: req.canEdit });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.post("/:tenantId/disciplines", ...edit, async (req: any, res: any) => {
  try {
    const code = str(req.body?.code, 8).toUpperCase();
    const name = str(req.body?.name, 80);
    if (!DISCIPLINE_CODE.test(code)) return fail(res, 400, "Код дисциплины: латинские буквы и цифры, 2–8 знаков, начинается с буквы (например MAT, ENG7)");
    if (!name) return fail(res, 400, "Укажите название дисциплины");
    const ref = col(req.params.tenantId, "exam_disciplines").doc(code);
    const now = Date.now();
    const d: Discipline = { code, name, description: str(req.body?.description, 300), nextNumber: 1, createdAt: now, updatedAt: now };
    await db().runTransaction(async tx => {
      if ((await tx.get(ref)).exists) throw Object.assign(new Error(`Дисциплина с кодом ${code} уже есть`), { status: 409 });
      tx.set(ref, d);
    });
    return res.json({ success: true, discipline: d });
  } catch (e: any) { return fail(res, e.status || 500, e.message); }
});

router.put("/:tenantId/disciplines/:code", ...edit, checkParams, async (req: any, res: any) => {
  try {
    const ref = col(req.params.tenantId, "exam_disciplines").doc(String(req.params.code));
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Дисциплина не найдена");
    const patch: Partial<Discipline> = { updatedAt: Date.now() };
    if (req.body?.name !== undefined) { const n = str(req.body.name, 80); if (!n) return fail(res, 400, "Название не может быть пустым"); patch.name = n; }
    if (req.body?.description !== undefined) patch.description = str(req.body.description, 300);
    await ref.update(patch);
    return res.json({ success: true, discipline: { ...snap.data(), ...patch } });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Удалить можно только пустую дисциплину: вопросы сначала удаляют или переносят. */
router.delete("/:tenantId/disciplines/:code", ...edit, checkParams, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const code = String(req.params.code);
    const left = await col(t, "exam_bank").where("disciplineId", "==", code).count().get();
    if (left.data().count) return fail(res, 409, `В дисциплине ${left.data().count} вопросов — сначала удалите их`);
    await col(t, "exam_disciplines").doc(code).delete();
    return res.json({ success: true });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Наборы ──────────────────────────────────────────────────────────────

const newSetId = () => "set_" + Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
/** Только наборы, которые есть в банке организации: чужой или удалённый id в вопрос не попадёт. */
async function existingSets(t: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const snaps = await db().getAll(...ids.map(id => col(t, "exam_sets").doc(id)));
  return snaps.filter(s => s.exists).map(s => s.id);
}

router.get("/:tenantId/sets", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [ss, qs] = await Promise.all([col(t, "exam_sets").get(), col(t, "exam_bank").select("sets").get()]);
    const count = new Map<string, number>();
    for (const d of qs.docs) for (const id of d.data().sets || []) count.set(id, (count.get(id) || 0) + 1);
    const sets = ss.docs.map(d => ({ ...(d.data() as QuestionSet), id: d.id, count: count.get(d.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return res.json({ success: true, sets });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.post("/:tenantId/sets", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const name = str(req.body?.name, 80);
    if (!name) return fail(res, 400, "Укажите название набора");
    const dup = (await col(t, "exam_sets").get()).docs.some(d => String(d.data().name).toLowerCase() === name.toLowerCase());
    if (dup) return fail(res, 409, `Набор «${name}» уже есть`);
    const now = Date.now();
    const set: QuestionSet = { id: newSetId(), name, description: str(req.body?.description, 300), createdAt: now, updatedAt: now };
    await col(t, "exam_sets").doc(set.id).create(set);
    return res.json({ success: true, set: { ...set, count: 0 } });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.put("/:tenantId/sets/:setId", ...edit, checkParams, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const ref = col(t, "exam_sets").doc(String(req.params.setId));
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Набор не найден");
    const patch: Partial<QuestionSet> = { updatedAt: Date.now() };
    if (req.body?.name !== undefined) {
      const n = str(req.body.name, 80); if (!n) return fail(res, 400, "Название не может быть пустым");
      const dup = (await col(t, "exam_sets").get()).docs.some(d => d.id !== snap.id && String(d.data().name).toLowerCase() === n.toLowerCase());
      if (dup) return fail(res, 409, `Набор «${n}» уже есть`);
      patch.name = n;
    }
    if (req.body?.description !== undefined) patch.description = str(req.body.description, 300);
    await ref.update(patch);
    return res.json({ success: true, set: { ...snap.data(), ...patch, id: snap.id } });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/**
 * Удаление набора снимает его с вопросов (сами вопросы остаются в банке).
 * Если набор подключён к экзамену — отказ: экзамен молча начал бы брать
 * вопросы из всей дисциплины, то есть смешивать их.
 */
router.delete("/:tenantId/sets/:setId", ...edit, checkParams, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const id = String(req.params.setId);
    const exams = await col(t, "exams").select("title", "sections").get();
    const used = exams.docs.filter(d => (d.data().sections || []).some((s: any) => s?.setId === id)).map(d => `«${d.data().title}»`);
    if (used.length) return fail(res, 409, `Набор подключён к экзаменам: ${used.slice(0, 5).join(", ")}${used.length > 5 ? "…" : ""}. Сначала отключите его там`);
    const qs = await col(t, "exam_bank").where("sets", "array-contains", id).get();
    for (let i = 0; i < qs.docs.length; i += 400) {
      const b = db().batch();
      for (const d of qs.docs.slice(i, i + 400)) b.update(d.ref, { sets: admin.firestore.FieldValue.arrayRemove(id) });
      await b.commit();
    }
    await col(t, "exam_sets").doc(id).delete();
    return res.json({ success: true, released: qs.size });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Вопросы ─────────────────────────────────────────────────────────────

router.get("/:tenantId/questions", ...view, async (req: any, res: any) => {
  try {
    let q: FirebaseFirestore.Query = col(req.params.tenantId, "exam_bank");
    const d = str(req.query.discipline, 8);
    if (d) q = q.where("disciplineId", "==", d);
    const snap = await q.get();
    const questions = snap.docs.map(x => ({ ...(x.data() as BankQuestion), id: x.id }))
      .sort((a, b) => a.disciplineId.localeCompare(b.disciplineId) || a.number - b.number);
    return res.json({ success: true, questions });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Вопрос из тела запроса: проверка теми же правилами, что и импорт. */
function buildQuestion(body: any): { q: Omit<BankQuestion, "id" | "tenantId" | "disciplineId" | "number" | "createdAt" | "updatedAt">; errors: string[] } {
  const type = isQuestionType(body?.type) ? body.type : "multiple_choice";
  const content = sanitizeContent(type, body);
  const diff = [1, 2, 3].includes(Number(body?.difficulty)) ? Number(body.difficulty) as Difficulty : 2;
  const points = Number(body?.points);
  const q = {
    ...content, type,
    answer: str(body?.answer, 2000),
    levels: normalizeLevels(body?.levels),
    topic: str(body?.topic, 160),
    difficulty: diff,
    points: Number.isFinite(points) && points > 0 ? Math.min(points, 100) : 1,
    active: body?.active !== false,
  };
  const errors = validateQuestion(q).filter(i => i.level === "error").map(i => i.message);
  return { q, errors };
}

/** Следующие номера дисциплины — в транзакции, чтобы два импорта не выдали один номер. */
async function allocate(t: string, code: string, n: number): Promise<number> {
  const ref = col(t, "exam_disciplines").doc(code);
  return db().runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw Object.assign(new Error(`Нет дисциплины ${code}`), { status: 400 });
    const start = Number(s.data()?.nextNumber) || 1;
    tx.update(ref, { nextNumber: start + n, updatedAt: Date.now() });
    return start;
  });
}

router.post("/:tenantId/questions", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const code = str(req.body?.disciplineId, 8).toUpperCase();
    const { q, errors } = buildQuestion(req.body);
    if (errors.length) return fail(res, 400, errors.join("; "));
    const sets = await existingSets(t, normalizeSetIds(req.body?.sets));
    const n = await allocate(t, code, 1);
    const now = Date.now();
    const full: BankQuestion = { ...q, id: questionId(code, n), tenantId: t, disciplineId: code, number: n, ...(sets.length ? { sets } : {}), createdAt: now, updatedAt: now, updatedBy: who(req) };
    // create, а не set: если номер почему-то занят, это ошибка, а не тихая перезапись чужого вопроса.
    await col(t, "exam_bank").doc(full.id).create(full);
    return res.json({ success: true, question: full });
  } catch (e: any) { return fail(res, e.status || 500, e.message); }
});

router.put("/:tenantId/questions/:id", ...edit, checkParams, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const id = String(req.params.id);
    const ref = col(t, "exam_bank").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Вопрос не найден");
    const prev = snap.data() as BankQuestion;
    const { q, errors } = buildQuestion(req.body);
    if (errors.length) return fail(res, 400, errors.join("; "));
    // Полная замена содержимого: поля прежнего типа не должны остаться висеть.
    // Наборы не прислали — остаются прежние.
    const sets = req.body?.sets === undefined ? prev.sets || [] : await existingSets(t, normalizeSetIds(req.body.sets));
    const full: BankQuestion = { ...q, id, tenantId: t, disciplineId: prev.disciplineId, number: prev.number, order: prev.order, source: prev.source, ...(sets.length ? { sets } : {}), createdAt: prev.createdAt, updatedAt: Date.now(), updatedBy: who(req) };
    await ref.set(JSON.parse(JSON.stringify(full)));
    return res.json({ success: true, question: full });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Массово: включить, выключить, удалить, задать классы или сложность, добавить в набор или убрать из него. */
router.post("/:tenantId/questions/bulk", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => str(x, 20)).filter((x: string) => QUESTION_ID.test(x)))] as string[];
    const action = String(req.body?.action || "");
    if (!ids.length) return fail(res, 400, "Не выбраны вопросы");
    if (ids.length > 2000) return fail(res, 400, "Слишком много вопросов за раз");
    // Несуществующие номера отбрасываем заранее: update по ним ронял бы
    // пачку, и действие применялось бы частично.
    const exist: string[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const snaps = await db().getAll(...ids.slice(i, i + 300).map(id => col(t, "exam_bank").doc(id)));
      for (const sn of snaps) if (sn.exists) exist.push(sn.id);
    }
    ids.splice(0, ids.length, ...exist);
    if (!ids.length) return fail(res, 404, "Выбранных вопросов нет в банке");
    const patch: Record<string, any> = { updatedAt: Date.now(), updatedBy: who(req) };
    if (action === "activate") patch.active = true;
    else if (action === "deactivate") patch.active = false;
    else if (action === "levels") patch.levels = normalizeLevels(req.body?.levels);
    else if (action === "difficulty") { const d = Number(req.body?.difficulty); if (![1, 2, 3].includes(d)) return fail(res, 400, "Сложность — 1, 2 или 3"); patch.difficulty = d; }
    else if (action === "addSet" || action === "removeSet") {
      const setId = str(req.body?.setId, 40);
      if (!SET_ID.test(setId) || !(await existingSets(t, [setId])).length) return fail(res, 400, "Набор не найден");
      const F = admin.firestore.FieldValue;
      patch.sets = action === "addSet" ? F.arrayUnion(setId) : F.arrayRemove(setId);
    }
    else if (action !== "delete") return fail(res, 400, "Неизвестное действие");
    for (let i = 0; i < ids.length; i += 400) {
      const b = db().batch();
      for (const id of ids.slice(i, i + 400)) {
        const ref = col(t, "exam_bank").doc(id);
        if (action === "delete") b.delete(ref); else b.update(ref, patch);
      }
      await b.commit();
    }
    return res.json({ success: true, count: ids.length });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Импорт таблицей ─────────────────────────────────────────────────────

/**
 * { header: string[], rows: string[][], commit?: boolean, createDisciplines?: {code,name}[], setId?: string }
 * Без commit — только проверка: что создастся, что обновится, где ошибки.
 * Строка с номером обновляет свой вопрос, без номера — получает новый.
 * Колонка «Наборы» — названия наборов (новые создаются при загрузке); без
 * колонки наборы обновляемых вопросов не трогаются. setId — набор, в который
 * дополнительно попадают все загруженные вопросы.
 */
router.post("/:tenantId/import", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const header: string[] = Array.isArray(req.body?.header) ? req.body.header.map(String) : [];
    const rows: string[][] = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : [];
    const keys = header.map(h => canonicalHeader(h));
    const optCols = header.map(h => optionColumn(h));
    if (!keys.includes("Вопрос") && !keys.includes("Данные (JSON)")) return fail(res, 400, "Не найдена колонка «Вопрос» — скачайте шаблон");
    if (!keys.includes("Дисциплина") && !keys.includes("Номер")) return fail(res, 400, "Не найдена колонка «Дисциплина»");

    const [ds, existing, setSnap] = await Promise.all([col(t, "exam_disciplines").get(), col(t, "exam_bank").select("disciplineId").get(), col(t, "exam_sets").get()]);
    const setByName = new Map(setSnap.docs.map(d => [String(d.data().name).toLowerCase(), d.id]));
    const hasSetColumn = keys.includes("Наборы");
    const extraSet = str(req.body?.setId, 40);
    if (extraSet && !setSnap.docs.some(d => d.id === extraSet)) return fail(res, 400, "Набор для загрузки не найден");
    const known = new Set(ds.docs.map(d => d.id));
    // Предмет можно написать словом: «математика», «Английский» → код дисциплины по названию.
    const byName = ds.docs.map(d => ({ code: d.id, name: String(d.data().name || "").toLowerCase() }));
    const disciplineCode = (v: string) => {
      const t = v.trim().toLowerCase();
      if (!t || known.has(t.toUpperCase())) return v;
      const hit = byName.find(d => d.name === t) || byName.find(d => d.name.startsWith(t) || t.startsWith(d.name));
      return hit ? hit.code : v;
    };
    const existingIds = new Set(existing.docs.map(d => d.id));
    const toCreate: Record<string, string> = {};
    for (const d of Array.isArray(req.body?.createDisciplines) ? req.body.createDisciplines : []) {
      const code = str(d?.code, 8).toUpperCase(); const name = str(d?.name, 80);
      if (DISCIPLINE_CODE.test(code) && name && !known.has(code)) toCreate[code] = name;
    }

    const parsed = rows.map((r, i) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, j) => { if (k) obj[k] = String(r?.[j] ?? ""); });
      if (obj["Дисциплина"]) obj["Дисциплина"] = disciplineCode(obj["Дисциплина"]);
      // Варианты по колонкам («вариант_А», «вариант_Б»…) — собираем в один список.
      if (!String(obj["Варианты"] || "").trim()) {
        const opts: string[] = [];
        optCols.forEach((n, j) => { const v = String(r?.[j] ?? "").trim(); if (n !== null && v) opts[n] = v; });
        if (opts.length) obj["Варианты"] = opts.filter(Boolean).join("\n");
      }
      return parseSheetRow(obj, i + 2);
    }).filter(p => p.question || p.issues.length);
    const missing = new Set<string>();
    for (const p of parsed) {
      if (p.disciplineId && !known.has(p.disciplineId) && !toCreate[p.disciplineId]) {
        missing.add(p.disciplineId);
        p.issues.push({ level: "error", message: `Нет дисциплины ${p.disciplineId}` });
        p.question = null;
      }
      if (p.id && !existingIds.has(p.id) && p.question) p.issues.push({ level: "warning", message: `Вопроса ${p.id} нет в банке — будет создан новый с очередным номером` });
    }
    const ok = parsed.filter(p => p.question);
    const summary = {
      rows: parsed.length,
      create: ok.filter(p => !p.id || !existingIds.has(p.id)).length,
      update: ok.filter(p => p.id && existingIds.has(p.id)).length,
      errors: parsed.filter(p => !p.question).length,
      warnings: ok.filter(p => p.issues.length).length,
      missingDisciplines: [...missing],
      newSets: [...new Set(ok.flatMap(p => p.setNames).filter(n => !setByName.has(n.toLowerCase())))],
    };
    const report = parsed.filter(p => p.issues.length).slice(0, 300).map(p => ({ row: p.rowNumber, id: p.id, discipline: p.disciplineId, issues: p.issues }));
    // Как вопросы прочитались — таблицей, чтобы до записи было видно, что сайт понял файл правильно.
    const preview = parsed.slice(0, 200).map(p => ({
      row: p.rowNumber, id: p.id, discipline: p.disciplineId, ok: !!p.question,
      type: p.question?.type || null, text: p.question ? plainText(p.question as any).slice(0, 200) : "",
      options: (p.question as any)?.options?.length || 0, answer: String(p.question?.answer || "").slice(0, 80),
      levels: p.question?.levels || [], sets: p.setNames,
    }));
    if (!req.body?.commit) return res.json({ success: true, summary, report, preview });
    if (summary.errors) return fail(res, 400, "В таблице есть строки с ошибками — исправьте их или уберите");

    const now = Date.now();
    for (const [code, name] of Object.entries(toCreate)) {
      // create: если дисциплину успел создать параллельный импорт, её счётчик не сбрасываем.
      await col(t, "exam_disciplines").doc(code).create({ code, name, description: "", nextNumber: 1, createdAt: now, updatedAt: now })
        .catch((e: any) => { if (e?.code !== 6) throw e; });
    }
    // Наборы из колонки, которых ещё нет, — создаём (одно название — один набор).
    for (const name of summary.newSets) {
      const key = name.toLowerCase();
      if (setByName.has(key)) continue;
      const id = newSetId();
      await col(t, "exam_sets").doc(id).create({ id, name, description: "", createdAt: now, updatedAt: now });
      setByName.set(key, id);
    }
    const setsOf = (p: (typeof ok)[number], old?: any): string[] => {
      const base: string[] = hasSetColumn ? p.setNames.map(n => setByName.get(n.toLowerCase())!).filter(Boolean) : old?.sets || [];
      return [...new Set([...base, ...(extraSet ? [extraSet] : [])])];
    };
    // Номера для новых — пачкой на дисциплину.
    const newBy = new Map<string, number>();
    for (const p of ok) if (!p.id || !existingIds.has(p.id)) newBy.set(p.disciplineId, (newBy.get(p.disciplineId) || 0) + 1);
    const next = new Map<string, number>();
    for (const [code, n] of newBy) next.set(code, await allocate(t, code, n));
    const writes: BankQuestion[] = [];
    const byId = new Map<string, (typeof ok)[number]>();
    for (const p of ok) {
      const update = !!p.id && existingIds.has(p.id);
      const number = update ? Number(p.id!.split("-")[1]) : next.get(p.disciplineId)!;
      if (!update) next.set(p.disciplineId, number + 1);
      byId.set(update ? p.id! : questionId(p.disciplineId, number), p);
      writes.push({ ...p.question!, id: update ? p.id! : questionId(p.disciplineId, number), tenantId: t, disciplineId: p.disciplineId, number, createdAt: now, updatedAt: now, updatedBy: who(req) });
    }
    // При обновлении — полная замена (поля прежнего типа не остаются), но
    // дата создания, порядок и происхождение вопроса сохраняются.
    const updIds = writes.filter(q => existingIds.has(q.id)).map(q => q.id);
    const prev = new Map<string, any>();
    for (let i = 0; i < updIds.length; i += 300) {
      const snaps = await db().getAll(...updIds.slice(i, i + 300).map(id => col(t, "exam_bank").doc(id)));
      for (const s of snaps) if (s.exists) prev.set(s.id, s.data());
    }
    for (let i = 0; i < writes.length; i += 400) {
      const b = db().batch();
      for (const q of writes.slice(i, i + 400)) {
        const old = prev.get(q.id);
        const sets = setsOf(byId.get(q.id)!, old);
        const doc = { ...(old ? { ...q, createdAt: old.createdAt ?? q.createdAt, order: old.order, source: old.source } : q), sets: sets.length ? sets : undefined };
        const ref = col(t, "exam_bank").doc(q.id);
        // Новые — только create: занятый номер не перезаписывается молча.
        if (old) b.set(ref, JSON.parse(JSON.stringify(doc))); else b.create(ref, JSON.parse(JSON.stringify(doc)));
      }
      await b.commit();
    }
    return res.json({ success: true, summary, created: summary.create, updated: summary.update });
  } catch (e: any) { return fail(res, e.status || 500, e.message); }
});

export default router;
