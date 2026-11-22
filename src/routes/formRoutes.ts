import { Router } from "express";
import rateLimit from "express-rate-limit";
import admin from "firebase-admin";
import crypto from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import {
  FORM_STATUSES, STATUS_LABEL, MODE_STATUSES, TICKET_ACTIVE,
  isFormStatus, type FormStatus, type FormMode,
} from "../shared/formStatuses.js";
import { checkFileValue, FILE_LIMITS } from "../shared/uploads.js";
import { EMAIL_RE, cleanMulti, fieldVisible } from "../shared/formFields.js";
import { verifySession } from "../server/session.js";
import { hasAnyPermission } from "../server/access.js";
import { checkTenantOpen, requireScreen, loadTenant } from "../server/tenantAccess.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
import { appUrl, registerResender, sendTemplated } from "../server/emailEvents.js";
import { notifyFormWatchers } from "../server/formWatch.js";
import { sendFormTicketEmail } from "../../emailService.js";
import { tenantLogos } from "../shared/legal.js";
import { writeAudit, actorOf } from "../server/audit.js";
import { DECISION_ID, checkedInId, decisionOf, kindOfStatus, resolveDecisions, sanitizeDecisions, formModeOf } from "../shared/formDecisions.js";
import { afterStatusChange, cancelPending, cancelStepSchedule, publishStep, scheduleStep, sendDecisionEmail, sendFlowEmail, trackPage } from "../server/formNotify.js";
import { canPublish, resolveFlow, sanitizeFlow, stepActive, STEP_ID, type StepState } from "../shared/formFlow.js";
import { loadTemplate } from "../server/emailEvents.js";
import { pageDoc } from "../server/resultPages.js";

/** Что о организации можно показать заявителю: название, брендинг, тексты билетов. */
function publicOrg(t: any) {
  if (!t) return null;
  const b = t.branding && typeof t.branding === "object" ? t.branding : {};
  return {
    id: t.id, name: String(t.name || ""),
    ...tenantLogos(t), primaryColor: b.primaryColor || null,
    tickets: resolveWorkspaceConfig(t.workspaceConfig).tickets,
  };
}


/**
 * Публичные формы заявок и отслеживание их статуса.
 *
 * Заявитель — человек с улицы: он не авторизован и в Firestore ходить не
 * может (правила требуют доступа к тенанту). Поэтому и открытие формы, и
 * отправка, и проверка статуса по QR идут через сервер, который читает и
 * пишет админским доступом, отдавая наружу строго то, что можно показать
 * постороннему.
 *
 * Что наружу НЕ уходит: чужие заявки, внутренние заметки, список полей
 * неактивной формы, tenantId в ответе трекера.
 */

const router = Router();
const db = () => admin.firestore();

const FORMS = "custom_forms";
const SUBS = "form_submissions";

/** Человекочитаемый токен: 10 символов без похожих друг на друга. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeToken(): string {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);

type Status = FormStatus;
const STATUSES = FORM_STATUSES;

const formMode = (f: any): FormMode => (f?.mode === "ticket" ? "ticket" : "application");

/** Имя колонки таблицы по её номеру: 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let n = index, name = "";
  do { name = String.fromCharCode(65 + (n % 26)) + name; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return name;
}

/**
 * Записать заявки в таблицу формы: существующие строки обновить, новые
 * дописать вниз.
 *
 * Пишем на сервере, а не в кабинете: заявка приходит, когда кабинет может
 * быть ни у кого не открыт, и строка всё равно должна появиться.
 *
 * Пачка целиком — одно чтение и одна запись. Массовая смена статуса или
 * правка поля у сотни заявок построчно означала бы сотню перезаписей
 * одного документа, а Firestore держит около одной записи в секунду на
 * документ: пачка стояла бы минуты и падала по таймауту функции.
 *
 * Внутри транзакции: если кто-то в эту же секунду правит таблицу руками,
 * его правка не потеряется — транзакция перечитает лист и повторит.
 *
 * Строка заявки ищется по коду в колонке F. Найдена — обновляем её
 * колонки (дата подачи остаётся прежней); нет — дописываем под последней
 * занятой строкой. Раньше функция всегда дописывала в конец, и каждое
 * обновление заявки через upsert/PATCH давало ещё одну строку: у хакатона
 * 442 строки оказались 251 заявкой.
 *
 * Ошибку глотаем: таблица — удобство, а падение записи в неё не должно
 * оборачиваться отказом в приёме заявки или в смене статуса.
 */
async function upsertSheetRows(form: any, submissions: Array<Record<string, any>>): Promise<void> {
  try {
    const tenantId = String(form?.tenantId || "");
    const sheetId = String(form?.sheetId || "");
    if (!tenantId || !sheetId || !submissions.length) return;

    const sheetRef = db().collection("tenants").doc(tenantId).collection("workspace_sheets").doc(sheetId);
    const fields: any[] = (Array.isArray(form.fields) ? form.fields : []).filter((f: any) => f.type !== "file");

    await db().runTransaction(async tx => {
      const snap = await tx.get(sheetRef);
      if (!snap.exists) return;
      const sheet = snap.data() || {};
      const cells: Record<string, any> = { ...(sheet.cells || {}) };

      const rowByCode = new Map<string, number>();
      let lastRow = 1;
      for (const [key, value] of Object.entries(cells)) {
        const row = Number((key.match(/\d+$/) || [])[0]);
        if (Number.isFinite(row) && row > lastRow) lastRow = row;
        if (/^F\d+$/.test(key)) {
          const code = String((value as any)?.rawValue || "");
          if (code && !rowByCode.has(code)) rowByCode.set(code, row);
        }
      }

      for (const sub of submissions) {
        const code = String(sub.qrToken || "");
        const existingRow = code ? rowByCode.get(code) || 0 : 0;
        const row = existingRow || ++lastRow;
        if (!existingRow && code) rowByCode.set(code, row);

        // Дата — когда заявка ПОДАНА, а не когда её последний раз правили.
        const submittedAt = sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date();
        const values = [
          existingRow
            ? String(cells[`A${row}`]?.rawValue ?? submittedAt.toLocaleString("ru-RU"))
            : submittedAt.toLocaleString("ru-RU"),
          String(sub.applicantName || ""),
          String(sub.applicantPhone || ""),
          String(sub.applicantEmail || ""),
          decisionOf(resolveDecisions(form), sub.status).label,
          code,
        ].concat(fields.map((f: any) => String(sub.data?.[f.id] ?? "")));

        // Пустой ответ — пустой ячейкой, а не пропуском: пропуск оставлял на
        // этом месте прежнее значение, и строка выглядела собранной из
        // разных заявок.
        values.forEach((value, i) => {
          cells[`${columnName(i)}${row}`] = { rawValue: value, computedValue: value };
        });
      }

      tx.update(sheetRef, {
        cells,
        updatedAt: Date.now(),
        rowsCount: Math.max(Number(sheet.rowsCount) || 100, lastRow + 10),
      });
    });
  } catch (e: any) {
    console.warn("[Forms/Sheet] Не удалось записать заявки в таблицу:", e.message);
  }
}

/**
 * Дождаться записи, которую раньше запускали фоном, — но не дольше limitMs.
 *
 * Сервер работает на Vercel как функция: после ответа её могут заморозить,
 * и всё, что было запущено «в фоне», не доделывается. На проде 2 из 20
 * заявок не дошли до таблицы именно так. Поэтому запись в таблицу и
 * отправка билета теперь часть ответа. Предел — чтобы медленная таблица
 * не держала заявителя: не успели — таблицу чинит «Обновить таблицу».
 */
async function settle(work: Promise<unknown>, limitMs = 4000): Promise<void> {
  await Promise.race([
    work.catch(() => {}),
    new Promise(resolve => setTimeout(resolve, limitMs)),
  ]);
}

/** Одна заявка — частный случай пачки. */
async function appendToSheet(form: any, _formId: string, submission: Record<string, any>): Promise<void> {
  return upsertSheetRows(form, [submission]);
}

/** Ключ правки заявки: отдаётся только заявителю, в QR и в таблицу не попадает. */
const makeEditToken = () => crypto.randomBytes(18).toString("base64url");

/**
 * Заявка, которую заявитель правит повторной отправкой: по ключу правки или
 * коду QR, только в этой форме и организации и не удалённая.
 */
async function findOwnSubmission(formId: string, tenantId: string, secret: string): Promise<any | null> {
  if (!secret || secret.length < 8) return null;
  const mine = (d: any) => {
    const s = d?.data?.() || {};
    return !s.deleted && s.formId === formId && String(s.tenantId || "") === tenantId;
  };
  const byEdit = await db().collection(SUBS).where("formId", "==", formId).where("editToken", "==", secret).limit(1).get();
  if (!byEdit.empty && mine(byEdit.docs[0])) return byEdit.docs[0];
  for (const code of [...new Set([secret, secret.toUpperCase()])]) {
    const byQr = await db().collection(SUBS).where("formId", "==", formId).where("qrToken", "==", code).limit(1).get();
    if (!byQr.empty && mine(byQr.docs[0])) return byQr.docs[0];
  }
  return null;
}

/** Код заявки на витрине: не QR и не id документа — по нему ничего не открыть. */
const publicCode = (id: string) => crypto.createHash("sha256").update(`showcase:${id}`).digest("hex").slice(0, 10).toUpperCase();

// ─────────────────────────── Публичная часть ───────────────────────────

/**
 * GET /api/forms/public/list?tenantId= — анкеты организации для чужого сайта.
 *
 * Отдаёт ТОЛЬКО помеченные «показывать на внешних сайтах». Список всех
 * анкет подряд наружу отдавать нельзя: рядом с открытым опросом у
 * организации лежат внутренние анкеты (например, на два десятка полей про
 * семью ребёнка), и само их существование — не публичные сведения.
 *
 * Признак выключен по умолчанию, поэтому включение этой ручки ничего не
 * раскрывает само по себе: пока организатор не отметит анкету, список пуст.
 *
 * Полей анкеты здесь нет — только название и описание. За полями идут в
 * /public/:formId по идентификатору из этого списка.
 */
router.get("/public/list", async (req: any, res: any) => {
  try {
    const tenantId = str(req.query.tenantId, 200);
    if (!tenantId) return res.status(400).json({ success: false, error: "Не указана организация" });

    const gate = await checkTenantOpen(tenantId, "forms");
    const tenant = gate.ok ? gate.tenant : await loadTenant(tenantId);
    if (!gate.ok) {
      return res.json({ success: true, org: publicOrg(tenant), forms: [] });
    }

    const snap = await db().collection(FORMS)
      .where("tenantId", "==", tenantId)
      .where("publicListed", "==", true)
      .limit(50).get();

    const forms = snap.docs
      .filter(d => d.data().active !== false)
      .map(d => {
        const f = d.data();
        return {
          id: d.id,
          title: String(f.title || "Заявка"),
          description: String(f.description || ""),
          mode: formMode(f),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title, "ru"));

    return res.json({ success: true, org: publicOrg(tenant), forms });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/forms/public/:formId/submissions — витрина заявок.
 *
 * Показывает, что уже предложили другие и что ответила организация:
 * школьный сайт выборов просил именно это — без витрины человек видит
 * только свою заявку и не понимает, идёт ли работа вообще.
 *
 * Отдаём ТОЛЬКО заявки, помеченные вручную. Не «все, кроме скрытых»:
 * анкета анонимная, люди писали не для публикации, и по умолчанию
 * публичной не становится ничего.
 *
 * Персональные поля вырезаются даже у помеченной заявки. Сегодня в анкете
 * одно поле про предложение, но её правят в кабинете, и завтра там может
 * появиться имя или телефон — витрина не должна их раскрыть.
 */
const PERSONAL_FIELD = /фамили|имя|фио|отчеств|телефон|номер|whatsapp|почт|e-?mail|адрес|класс|школ|родител|контакт|name|phone|mail/i;

router.get("/public/:formId/submissions", async (req: any, res: any) => {
  try {
    const formId = str(req.params.formId, 200);
    const formSnap = await db().collection(FORMS).doc(formId).get();
    if (!formSnap.exists) return res.status(404).json({ success: false, error: "Анкета не найдена." });
    const form = formSnap.data()!;

    const gate = await checkTenantOpen(form.tenantId, "forms");
    if (!gate.ok) return res.json({ success: true, submissions: [], total: 0 });

    // Какие поля анкеты можно показывать: всё, что похоже на персональные
    // сведения или является файлом, наружу не идёт.
    const safeFields = (Array.isArray(form.fields) ? form.fields : [])
      .filter((f: any) => f.type !== "file" && !PERSONAL_FIELD.test(String(f.label || "")))
      .map((f: any) => String(f.id));

    const snap = await db().collection(SUBS)
      .where("formId", "==", formId)
      .where("publicShown", "==", true)
      .limit(50).get();

    const submissions = snap.docs
      .filter(d => !d.data().deleted)
      .map(d => {
        const sub = d.data();
        const dec = decisionOf(resolveDecisions(form), sub.status);
        const status: Status = dec.kind;

        const data: Record<string, string> = {};
        for (const id of safeFields) {
          const value = sub.data?.[id];
          if (value !== undefined && value !== null && String(value).trim()) data[id] = String(value);
        }

        // Ответ организации — последний непустой из истории. Отдельного
        // поля не заводим: сотрудник пишет ответ один раз, при смене
        // статуса, и он же уходит и заявителю, и на витрину. Два разных
        // текста означали бы, что один из них забудут заполнить.
        const notes = (Array.isArray(sub.history) ? sub.history : []).filter((h: any) => String(h?.note || "").trim());
        const last = notes[notes.length - 1];

        return {
          code: publicCode(d.id),
          createdAt: sub.createdAt || null,
          status,
          statusLabel: dec.label,
          data,
          reply: last ? { text: String(last.note), at: last.at || null } : null,
        };
      })
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    return res.json({
      success: true,
      org: publicOrg(gate.tenant),
      formTitle: String(form.title || ""),
      fieldLabels: Object.fromEntries(
        (Array.isArray(form.fields) ? form.fields : [])
          .filter((f: any) => safeFields.includes(String(f.id)))
          .map((f: any) => [String(f.id), String(f.label || "")]),
      ),
      submissions,
      total: submissions.length,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/forms/public/:formId/stats — сколько предложений и сколько решено.
 *
 * Считает ВСЕ заявки, не только публичные: цифра «предложений 47» никого
 * не раскрывает, а показывает, что работа идёт. Тексты при этом закрыты.
 */
router.get("/public/:formId/stats", async (req: any, res: any) => {
  try {
    const formId = str(req.params.formId, 200);
    const formSnap = await db().collection(FORMS).doc(formId).get();
    if (!formSnap.exists) return res.status(404).json({ success: false, error: "Анкета не найдена." });

    const gate = await checkTenantOpen(formSnap.data()!.tenantId, "forms");
    if (!gate.ok) return res.json({ success: true, total: 0, resolved: 0 });

    const snap = await db().collection(SUBS).where("formId", "==", formId).limit(1000).get();
    const alive = snap.docs.filter(d => !d.data().deleted);
    const decs = resolveDecisions(formSnap.data());
    const resolved = alive.filter(d => ["approved", "paid", "checked_in"].includes(kindOfStatus(decs, d.data().status)));

    return res.json({ success: true, total: alive.length, resolved: resolved.length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/forms/public/:formId — форма для заполнения.
 *
 * Неактивная форма не отдаёт поля: если её закрыли, посторонний не должен
 * видеть даже, о чём она была.
 */
router.get("/public/:formId", async (req: any, res: any) => {
  try {
    const snap = await db().collection(FORMS).doc(String(req.params.formId)).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: "Форма не найдена. Проверьте ссылку." });
    }
    const f = snap.data()!;
    // Приостановленная организация или закрытый платформой раздел — форма
    // для посетителя тоже закрыта.
    const gate = await checkTenantOpen(f.tenantId, "forms");
    if (!gate.ok) {
      return res.status(410).json({ success: false, closed: true, error: "Приём заявок по этой форме закрыт." });
    }
    // Закрытую вручную форму показываем с текстами организации.
    if (f.active === false) {
      const org = publicOrg(gate.tenant);
      return res.status(410).json({ success: false, closed: true, org, error: org?.tickets?.closedMessage || "Приём заявок по этой форме закрыт." });
    }
    return res.json({
      success: true,
      org: publicOrg(gate.tenant),
      form: {
        id: snap.id,
        title: f.title || "Заявка",
        description: f.description || "",
        fields: Array.isArray(f.fields) ? f.fields : [],
        qrTrackingEnabled: f.qrTrackingEnabled !== false,
        mode: formMode(f),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/forms/submit — отправка или обновление заявки посетителем. */
/** Письмо по шаблону формы одной заявке (после отправки и при переотправке). */
async function emailForm(sub: { id: string; formId: string; applicantName?: string; applicantEmail?: string; qrToken?: string }, form: any, o: { force?: boolean; by?: string } = {}) {
  const t = String(form.tenantId || "");
  return sendTemplated({
    tenantId: t, templateId: String(form.emailTemplateId || ""), to: String(sub.applicantEmail || ""), event: "form", refId: sub.id, force: o.force, by: o.by,
    ctx: { submissionId: sub.id, formId: sub.formId, label: `${sub.applicantName || "Без имени"} · ${form.title || "Форма"}` },
    actionUrl: `/workspace/${t}/builder/forms`, noRecipient: "В заявке нет почты",
    mirror: { ref: db().collection(SUBS).doc(sub.id), field: "emailStatus" },
    vars: { имя: String(sub.applicantName || ""), форма: String(form.title || ""), ссылка: form.qrTrackingEnabled !== false && sub.qrToken ? `${await appUrl()}/track/${sub.qrToken}` : "" },
  });
}
registerResender("form", async (t, ctx, by) => {
  if (!ctx.submissionId) return { sent: false, reason: "Нет заявки" };
  const sub = (await db().collection(SUBS).doc(ctx.submissionId).get()).data();
  if (!sub || sub.tenantId !== t || sub.deleted) return { sent: false, reason: "Заявка не найдена" };
  const form = (await db().collection("custom_forms").doc(String(sub.formId)).get()).data();
  if (!form || form.tenantId !== t) return { sent: false, reason: "Форма не найдена" };
  if (ctx.stepId) {
    const step = resolveFlow(form).steps.find(x => x.id === ctx.stepId);
    const st: StepState | undefined = sub.flow?.[ctx.stepId];
    if (!step || !st?.published) return { sent: false, reason: "Этап не опубликован" };
    return sendFlowEmail({ sub: { ...sub, id: ctx.submissionId }, form: { ...form, id: String(sub.formId) }, step, st, force: true, by });
  }
  if (ctx.statusId) {
    return sendDecisionEmail({ sub: { ...sub, id: ctx.submissionId }, form: { ...form, id: String(sub.formId) }, decision: decisionOf(resolveDecisions(form), ctx.statusId), force: true, by });
  }
  if (!form.emailTemplateId) return { sent: false, reason: "У формы не выбран шаблон письма" };
  return emailForm({ id: ctx.submissionId, formId: String(sub.formId), applicantName: sub.applicantName, applicantEmail: sub.applicantEmail, qrToken: sub.qrToken }, form, { force: true, by });
});

router.post("/submit", async (req: any, res: any) => {
  try {
    const { formId, data } = req.body || {};
    if (!formId || typeof data !== "object" || !data) {
      return res.status(400).json({ success: false, error: "Не хватает данных заявки" });
    }

    const formSnap = await db().collection(FORMS).doc(String(formId)).get();
    if (!formSnap.exists) return res.status(404).json({ success: false, error: "Форма не найдена" });
    const form = formSnap.data()!;
    if (form.active === false) {
      return res.status(410).json({ success: false, error: "Приём заявок по этой форме закрыт." });
    }
    const gate = await checkTenantOpen(form.tenantId, "forms");
    if (!gate.ok) return res.status(410).json({ success: false, error: "Приём заявок по этой форме закрыт." });

    const fields: any[] = Array.isArray(form.fields) ? form.fields : [];

    // Принимаем только те поля, которые есть в форме: иначе кто угодно
    // допишет в заявку произвольные ключи, и они всплывут в кабинете.
    const clean: Record<string, any> = {};
    const missing: string[] = [];
    let fileChars = 0;
    for (const f of fields) {
      // Заголовок раздела — не поле; скрытое условием поле (раздел не для
      // этого ответа) не обязательно и в заявку не попадает.
      if (f.type === "section") continue;
      if (!fieldVisible(f, clean)) continue;
      const raw = (data as any)[f.id];
      let value: any;
      if (f.type === "multi") {
        const m = cleanMulti(f, raw);
        if (m.error) return res.status(400).json({ success: false, error: m.error });
        if (f.required && !m.value.length) { missing.push(f.label || f.id); continue; }
        clean[f.id] = m.value;
        continue;
      }
      if (f.type === "checkbox") {
        value = Boolean(raw);
      } else if (f.type === "file") {
        // Файл приходит data-URL'ом с клиента. Принимаем любой формат, кроме
        // установщиков и исполняемых файлов; проверяем и имя, и содержимое.
        value = String(raw ?? "");
        if (value) {
          const check = checkFileValue(value);
          if (!check.ok) {
            return res.status(value.length > FILE_LIMITS.maxFieldChars ? 413 : 400).json({
              success: false,
              error: `Поле «${f.label}»: ${check.error}`,
            });
          }
        }
        fileChars += value.length;
      } else if (f.type === "email") {
        value = str(raw, 200).replace(/\s+/g, "").toLowerCase();
        if (value && !EMAIL_RE.test(value)) return res.status(400).json({ success: false, error: `«${f.label || "Почта"}» — проверьте адрес почты.` });
      } else {
        value = str(raw, 2000);
      }
      if (f.required && (f.type === "checkbox" ? !value : !String(value).length)) {
        missing.push(f.label || f.id);
        continue;
      }
      clean[f.id] = value;
    }
    if (missing.length) {
      return res.status(400).json({
        success: false,
        error: `Заполните обязательные поля: ${missing.join(", ")}`,
      });
    }
    // Файлы лежат в самой заявке, а документ Firestore — 1 МБ: без общей
    // границы два «разрешённых» файла вместе уронили бы запись ошибкой 500.
    if (fileChars > FILE_LIMITS.maxTotalChars) {
      return res.status(413).json({
        success: false,
        error: `Все приложенные файлы вместе больше ${FILE_LIMITS.maxFileKb} КБ. Приложите меньше или отправьте ссылкой.`,
      });
    }

    // Внешний сайт может прислать ключи, которых нет среди объявленных
    // полей: анкету правят в кабинете, и сайт успевает отстать. Такие
    // значения принимаем, но по тем же правилам, что и свои, — иначе
    // белый список выше не значит ничего и в заявку попадёт что угодно,
    // включая мегабайтные строки и вложенные объекты.
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const known = new Set(fields.map((f: any) => String(f.id)));
      let extras = 0;
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (known.has(k) || clean[k] !== undefined) continue;
        if (++extras > 30) break;                       // не даём раздуть заявку
        if (!/^[\w.-]{1,80}$/.test(k)) continue;         // ключ — не произвольный текст
        if (v === null || typeof v === "boolean" || typeof v === "number") { clean[k] = v; continue; }
        if (typeof v !== "string") continue;            // объекты и массивы не принимаем
        if (/^\s*data:/i.test(v)) continue;             // файлы идут своим полем
        clean[k] = str(v, 2000);
      }
    }

    if (JSON.stringify(clean).length > 700 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Заявка слишком большая — уменьшите приложенные файлы.",
      });
    }

    // Имя, телефон, почта и специфические поля StudyFree (включая прямое соответствие ID)
    const pick = (role: string) => {
      const id = roleFieldId(form, role);
      return id ? str(clean[id], 500) : "";
    };

    const applicantName = pick("name");
    const applicantPhone = pick("phone");
    // Почта — из поля типа «Почта»; у старых форм — по названию поля.
    const emailField = fields.find((x: any) => x.type === "email" && String(clean[x.id] || "").includes("@"));
    const applicantEmail = emailField ? String(clean[emailField.id]) : pick("email");
    const participationFormat = pick("format");
    const teamName = pick("teamName");
    const teamCode = pick("teamCode");
    const teamPassword = pick("teamPassword");
    const presentationUrl = pick("presentationUrl");

    // Повторная отправка правит СВОЮ заявку — только по её секрету: ключу
    // правки (editToken, выдаётся при подаче) или коду QR, который знает лишь
    // сам заявитель. Поиск — строго в этой форме и организации. Раньше
    // находили по id документа из любой школы и по `upsert_by` (почта, любое
    // поле, даже status=approved) — без входа переписывали чужую заявку и
    // получали её билет. `upsert_by` без секрета теперь не правит ничего:
    // заявка создаётся новой (для правки по полю — защищённый /submissions/upsert).
    const secret = str(
      req.body.editToken || req.body.token || req.body.code || req.body.qrToken ||
      data?.editToken || data?.token || data?.code || data?.qrToken, 100
    );
    const existingDocSnap = await findOwnSubmission(String(formId), String(form.tenantId || ""), secret);

      if (existingDocSnap) {
        const existingRef = existingDocSnap.ref;
        const existingData = existingDocSnap.data() || {};
        const mergedData = { ...(existingData.data || {}), ...clean };

        await existingRef.update({
          data: mergedData,
          applicantName: applicantName || existingData.applicantName || "",
          applicantPhone: applicantPhone || existingData.applicantPhone || "",
          applicantEmail: applicantEmail || existingData.applicantEmail || "",
          participationFormat: participationFormat || existingData.participationFormat || "",
          teamName: teamName || existingData.teamName || "",
          teamCode: teamCode || existingData.teamCode || "",
          teamPassword: teamPassword || existingData.teamPassword || "",
          presentationUrl: presentationUrl || existingData.presentationUrl || "",
          updatedAt: admin.firestore.Timestamp.now(),
          history: admin.firestore.FieldValue.arrayUnion({
            status: existingData.status || "new",
            at: admin.firestore.Timestamp.now(),
            by: "applicant_update",
            note: "Заявка обновлена заявителем",
          }),
        });

        // Обновляем строку в таблице
        await settle(appendToSheet(form, String(formId), {
          applicantName: applicantName || existingData.applicantName,
          applicantPhone: applicantPhone || existingData.applicantPhone,
          applicantEmail: applicantEmail || existingData.applicantEmail,
          status: existingData.status || "new",
          qrToken: existingData.qrToken,
          data: mergedData,
        }));

        return res.json({
          success: true,
          updated: true,
          submissionId: existingDocSnap.id,
          qrToken: existingData.qrToken,
          ...(existingData.editToken ? { editToken: existingData.editToken } : {}),
          trackUrl: `/track/${existingData.qrToken}`,
          mode: formMode(form),
          message: "Заявка успешно обновлена!",
        });
      }

    // Если токена нет или документа не нашлось — создаём новую запись
    const qrToken = makeToken();
    const editToken = makeEditToken();
    const ref = db().collection(SUBS).doc();
    await ref.set({
      tenantId: form.tenantId || "",
      formId: String(formId),
      formTitle: form.title || "Заявка",
      qrToken,
      editToken,
      applicantName, applicantPhone, applicantEmail,
      participationFormat, teamName, teamCode, teamPassword, presentationUrl,
      status: "new" as Status,
      data: clean,
      history: [{ status: "new", at: admin.firestore.Timestamp.now(), by: "" }],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await settle(appendToSheet(form, String(formId), {
      applicantName, applicantPhone, applicantEmail,
      status: "new", qrToken, data: clean,
    }));

    // Колокольчик и Telegram — сотрудникам, подписанным на заявки этой формы.
    await notifyFormWatchers(form, String(formId), { name: applicantName, contact: applicantPhone || applicantEmail }, ref.id);

    // ✉️ Письмо по шаблону формы, если выбран; иначе — стандартный электронный билет.
    const templated = applicantEmail && form.emailTemplateId
      ? await emailForm({ id: ref.id, formId: String(formId), applicantName, applicantEmail, qrToken }, form)
      : null;
    if (applicantEmail && applicantEmail.includes("@") && (!templated || templated.reason === "Шаблон не найден")) {
      const emailDetails: Record<string, string> = {};
      if (participationFormat) emailDetails["Формат участия"] = participationFormat;
      if (teamName) emailDetails["Команда"] = teamName;

      await settle(sendFormTicketEmail({
        tenantId: form.tenantId,
        to: applicantEmail,
        applicantName: applicantName || "Участник",
        eventTitle: form.title || "Мероприятие",
        qrToken,
        ticketUrl: `${await appUrl()}/track/${encodeURIComponent(qrToken)}`,
        details: emailDetails,
      }).catch(err => console.warn("[Forms/Submit] Ticket email send notice:", err?.message)));
    }

    return res.json({
      success: true,
      updated: false,
      submissionId: ref.id,
      qrToken,
      editToken,
      trackUrl: `/track/${qrToken}`,
      mode: formMode(form),
      message: "Заявка принята.",
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/send-ticket — повторно прислать билет на почту.
 *
 * Без входа, поэтому письмо уходит ТОЛЬКО на почту, сохранённую в самой
 * заявке: присланный адрес служит лишь для поиска своей заявки и сверяется с
 * ней. Раньше адрес из запроса был важнее сохранённого — чужой билет уходил
 * на любую почту, а с одним адресом и выдуманным кодом сервер рассылал
 * «билеты» от имени организации кому угодно. Частота ограничена: с адреса —
 * 5 запросов за 10 минут, на одну заявку — одно письмо в 2 минуты.
 */
const sendTicketLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, error: "Слишком много запросов. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
});
const TICKET_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

router.post("/send-ticket", sendTicketLimiter, async (req: any, res: any) => {
  try {
    const qrToken = str(req.body?.qrToken || req.body?.code, 100);
    const submissionId = str(req.body?.submissionId, 100);
    const email = str(req.body?.email, 200).replace(/\s+/g, "").toLowerCase();
    const formId = str(req.body?.formId, 200);
    if (!qrToken && !submissionId && !email) {
      return res.status(400).json({ success: false, error: "Укажите код заявки или почту" });
    }

    // Своя заявка: по коду QR, по id (только вместе с совпадающей почтой) или по почте.
    let snap: any = null;
    if (qrToken) {
      const q = await db().collection(SUBS).where("qrToken", "==", qrToken.toUpperCase()).limit(1).get();
      if (!q.empty) snap = q.docs[0];
    } else if (submissionId && email) {
      const d = await db().collection(SUBS).doc(submissionId).get();
      if (d.exists) snap = d;
    } else if (email) {
      let q: any = db().collection(SUBS).where("applicantEmail", "==", email);
      if (formId) q = q.where("formId", "==", formId);
      const all = (await q.limit(20).get()).docs.filter((d: any) => !d.data().deleted);
      all.sort((x: any, y: any) => (y.data().createdAt?.toMillis?.() || 0) - (x.data().createdAt?.toMillis?.() || 0));
      snap = all[0] || null;
    }
    const sub = snap?.data?.() || null;
    const stored = String(sub?.applicantEmail || "").trim().toLowerCase();
    // Один ответ на «не нашли» и «адрес не тот» — по нему не перебрать, чья это заявка.
    if (!sub || sub.deleted || !sub.qrToken || (formId && sub.formId !== formId) || !stored.includes("@") || (email && email !== stored)) {
      return res.status(404).json({ success: false, error: "Заявка с такими данными не найдена" });
    }
    const gate = await checkTenantOpen(String(sub.tenantId || ""), "forms");
    if (!gate.ok) return res.status(410).json({ success: false, error: "Приём заявок закрыт." });

    const t = sub.ticketSentAt;
    const last = typeof t?.toMillis === "function" ? t.toMillis() : Number(t?.seconds ?? t?._seconds ?? 0) * 1000;
    if (Date.now() - last < TICKET_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ success: false, error: "Билет только что отправлен. Проверьте почту, в том числе «Спам»." });
    }
    await snap.ref.update({ ticketSentAt: admin.firestore.Timestamp.now() });

    const fsnap = sub.formId ? await db().collection(FORMS).doc(String(sub.formId)).get().catch(() => null) : null;
    const eventTitle = (fsnap?.exists ? String(fsnap.data()?.title || "") : "") || sub.formTitle || "Мероприятие";
    const details: Record<string, string> = {};
    if (sub.participationFormat) details["Формат участия"] = sub.participationFormat;
    if (sub.teamName) details["Команда"] = sub.teamName;

    const result = await sendFormTicketEmail({
      tenantId: sub.tenantId,
      to: stored,
      applicantName: sub.applicantName || "Участник",
      eventTitle,
      qrToken: String(sub.qrToken || ""),
      ticketUrl: `${await appUrl()}/track/${encodeURIComponent(String(sub.qrToken || ""))}`,
      details,
    });
    if (!result.sent) {
      return res.status(500).json({ success: false, error: result.reason || "Ошибка отправки письма" });
    }
    return res.json({ success: true, message: "Билет отправлен на почту из заявки" });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** Rate limiting middleware: max 30 requests per minute */
const formsApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: "TOO_MANY_REQUESTS",
    message: "Превышен лимит запросов. Максимум 30 запросов в минуту.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Извлечение контекста тенанта и токенов из заголовков или параметров */
function extractTenantContext(req: any): { tenantId?: string; apiKey?: string; userToken?: string } {
  const apiKey = (req.headers["x-api-key"] || req.headers["api-key"] || req.headers["x-tenant-api-key"] || req.query.api_key || req.query.apiKey || "") as string;
  const headerTenantId = (req.headers["x-tenant-id"] || req.headers["tenant-id"] || "") as string;
  const bodyTenantId = (req.body?.tenant_id || req.body?.tenantId || req.query?.tenant_id || req.query?.tenantId || "") as string;
  const authHeader = (req.headers["authorization"] || "") as string;
  const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  return {
    tenantId: (headerTenantId || bodyTenantId).trim(),
    apiKey: apiKey.trim(),
    userToken,
  };
}


/** Роли полей формы, которые сервер понимает сам (имя, телефон, команда…). Если у формы есть `fieldMap`, берём поле оттуда, иначе ищем по названию. */
const FIELD_ROLES: Record<string, RegExp> = {
  name: /фамили|имя|фио|name/i, phone: /телефон|phone|моб/i, email: /e-?mail|почт/i,
  format: /формат|format/i, teamName: /название команды|team name/i, teamCode: /код команды|team code/i,
  teamPassword: /пароль команды|team password|парол|password/i, presentationUrl: /презентаци|presentation/i,
};
function roleFieldId(form: any, role: string): string {
  const fields: any[] = Array.isArray(form?.fields) ? form.fields : [];
  const mapped = form?.fieldMap?.[role];
  if (mapped && fields.some(f => f.id === mapped)) return String(mapped);
  const re = FIELD_ROLES[role];
  const f = fields.find(x => x.type !== "section" && (re.test(String(x.label || "")) || re.test(String(x.id || ""))));
  return f ? String(f.id) : "";
}

/** Вспомогательная функция маскирования и очистки чувствительных полей (паролей команд) */
function sanitizeSubmissionFields(sub: any, form?: any): any {
  if (!sub || typeof sub !== "object") return sub;
  const cleanSub = { ...sub };

  delete cleanSub.editToken;
  delete cleanSub.teamPassword;
  delete cleanSub.team_password;
  delete cleanSub.password;

  if (cleanSub.data && typeof cleanSub.data === "object") {
    const cleanData = { ...cleanSub.data };
    const pwId = roleFieldId(form, "teamPassword");
    if (pwId) delete cleanData[pwId];
    delete cleanData.teamPassword;
    delete cleanData.team_password;
    delete cleanData.password;
    delete cleanData["пароль команды"];
    delete cleanData["Пароль команды"];
    cleanSub.data = cleanData;
  }

  return cleanSub;
}

/** Логирование аудита вызовов API */
async function logApiAudit(req: any, action: string, details: Record<string, any>) {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim();
    const { tenantId } = extractTenantContext(req);
    await db().collection("audit_logs").add({
      action,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      ip,
      tenantId: tenantId || details.tenantId || "unknown",
      userId: req.user?.uid || req.user?.email || "api_key",
      details,
      timestamp: admin.firestore.Timestamp.now(),
    });
  } catch (err) {
    console.error("[Audit Log Error]", err);
  }
}

/** Авторизация API запросов по секретному ключу / Bearer токену / API key */
/**
 * Доступ к API заявок (поиск, upsert, правка).
 *
 * Кто проходит и к чему:
 * - секрет платформы (только из окружения STUDYFREE_SECRET_KEY /
 *   TENANT_SECRET_KEY) — интеграция платформы, все организации;
 * - сотрудник по входу Firebase — только СВОЯ организация и только с правами
 *   на заявки (раньше проходил любой вошедший пользователь);
 * - ключ API организации — только эта организация (раньше ключ одной школы
 *   открывал заявки другой).
 * Организация вызывающего подставляется в x-tenant-id: обработчики сверяют её
 * с организацией формы, и за пределы своей школы не выйти. Запасной секрет,
 * зашитый в код, убран — репозиторий публичный.
 */
/** Сравнение секретов за постоянное время — без подсказок по таймингу. */
function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
/**
 * Ключи API организации лежат в tenant_secrets/{id} — туда не дотягиваются
 * правила клиента (документ организации читает любой её сотрудник, и ключ в
 * нём был виден всем). Старое место — запасное, пока ключи не перенесены.
 */
async function tenantKeys(tenantId: string): Promise<string[]> {
  const [s, t] = await Promise.all([db().collection("tenant_secrets").doc(tenantId).get(), db().collection("tenants").doc(tenantId).get()]);
  return [s.data()?.apiKey, s.data()?.secretKey, t.data()?.apiKey, t.data()?.secretKey].filter((k): k is string => typeof k === "string" && k.length >= 16 && !isCompromised(k));
}
/** Хэши секретов, побывавших в коде (sha256): такие ключи считаются раскрытыми. */
/** Ключ API хранится хэшем (выпуск — Администрирование → Интеграции). */
const keyHash = (k: string) => crypto.createHash("sha256").update(String(k)).digest("hex");
/** Запрос из браузера с сайта не из списка — отказ; сервер-сервер (без Origin) — как раньше. */
function originAllowed(req: any, sec: any): boolean {
  const list: string[] = Array.isArray(sec?.allowedOrigins) ? sec.allowedOrigins : [];
  const origin = String(req.headers?.origin || "");
  return !list.length || !origin || list.includes(origin);
}
const COMPROMISED_SECRETS = new Set(["3e8e1ddeb8df23cc78218f00f217ce6e03223e404a85806506bd09eaf2d726fe"]);
const isCompromised = (v: string) => COMPROMISED_SECRETS.has(crypto.createHash("sha256").update(String(v)).digest("hex"));
async function authenticateFormApi(req: any, res: any, next: any) {
  try {
    const { tenantId, apiKey, userToken } = extractTenantContext(req);
    const secretHeader = String(req.headers["x-api-secret"] || req.headers["x-secret-key"] || req.headers["authorization"] || "");
    const SERVER_SECRET = process.env.STUDYFREE_SECRET_KEY || process.env.TENANT_SECRET_KEY || "";
    const bind = (t: string) => { req.headers["x-tenant-id"] = t; };

    const isSecret = (sec: string) => !!sec && [userToken, apiKey, secretHeader].some(v => !!v && (safeEq(v, sec) || safeEq(v, `Bearer ${sec}`)));
    // Секрет платформы — только из окружения. Ключей отдельных организаций в
    // коде нет: они лежат в tenant_secrets. Значения, которые когда-то были в
    // публичном репозитории, не принимаются ни в какой роли.
    if (SERVER_SECRET && !isCompromised(SERVER_SECRET) && isSecret(SERVER_SECRET)) return next();

    let user = req.user;
    if (!user && userToken) { try { user = await verifySession(userToken); } catch { /* не токен входа — может быть ключ */ } }
    if (user?.uid) {
      req.user = user;
      if (user.isSuperadmin === true) return next();
      if (!tenantId) return res.status(400).json({ success: false, error: "TENANT_REQUIRED", message: "Укажите организацию: заголовок x-tenant-id" });
      if (!(await canManageForms(user, tenantId))) return res.status(403).json({ success: false, error: "FORBIDDEN", message: "Нет прав на заявки этой организации" });
      bind(tenantId);
      return next();
    }

    const providedKey = apiKey || (secretHeader.startsWith("Bearer ") ? secretHeader.slice(7) : secretHeader);
    if (providedKey && providedKey.length >= 16 && !isCompromised(providedKey)) {
      if (tenantId) {
        const sec = (await db().collection("tenant_secrets").doc(tenantId).get()).data();
        const byHash = !!sec?.apiKeyHash && safeEq(String(sec.apiKeyHash), keyHash(providedKey));
        if (byHash || (await tenantKeys(tenantId)).some(k => safeEq(k, providedKey))) {
          if (!originAllowed(req, sec)) return res.status(403).json({ success: false, error: "ORIGIN_NOT_ALLOWED", message: "Этот сайт не разрешён для ключа организации" });
          bind(tenantId); return next();
        }
      } else {
        const h = await db().collection("tenant_secrets").where("apiKeyHash", "==", keyHash(providedKey)).limit(1).get();
        const k = h.empty ? await db().collection("tenant_secrets").where("apiKey", "==", providedKey).limit(1).get() : h;
        const old = k.empty ? await db().collection("tenants").where("apiKey", "==", providedKey).limit(1).get() : null;
        const hit = !k.empty ? k.docs[0] : old && !old.empty ? old.docs[0] : null;
        if (hit) {
          const sec = !k.empty ? k.docs[0].data() : (await db().collection("tenant_secrets").doc(hit.id).get()).data();
          if (!originAllowed(req, sec)) return res.status(403).json({ success: false, error: "ORIGIN_NOT_ALLOWED", message: "Этот сайт не разрешён для ключа организации" });
          bind(hit.id); return next();
        }
      }
    }

    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Доступ запрещен. Требуется заголовок Authorization (Bearer <TOKEN>) или X-API-Key / X-API-Secret.",
    });
  } catch (e: any) {
    console.error("[forms api auth]", e);
    return res.status(500).json({ success: false, error: "AUTH_ERROR", message: "Ошибка проверки доступа" });
  }
}

/**
 * POST /api/forms/submissions/search — Универсальный поиск заявок (Защищенный API)
 */
router.post("/submissions/search", formsApiLimiter, authenticateFormApi, async (req: any, res: any) => {
  try {
    const formId = str(req.body.form_id || req.body.formId, 200);
    if (!formId) {
      return res.status(400).json({ success: false, error: "Параметр form_id обязателен" });
    }

    const formSnap = await db().collection(FORMS).doc(formId).get();
    if (!formSnap.exists) {
      return res.status(404).json({ success: false, error: "Форма не найдена" });
    }
    const form = formSnap.data()!;

    const { tenantId: clientTenantId } = extractTenantContext(req);
    if (clientTenantId && clientTenantId !== form.tenantId && !req.user?.isSuperadmin) {
      return res.status(403).json({ success: false, error: "Форма принадлежит другой организации" });
    }

    const gate = await checkTenantOpen(form.tenantId, "forms");
    if (!gate.ok && !req.user?.isSuperadmin) {
      return res.status(gate.status || 403).json({ success: false, error: gate.error });
    }

    const filter = req.body.filter || {};
    const searchVal = str(filter.value, 1000).toLowerCase();
    const targetField = str(filter.field_id || filter.fieldId || filter.field_name || filter.fieldName, 200);
    const exactMatch = filter.exact_match !== false && filter.exactMatch !== false;

    const limit = Math.min(Math.max(Number(req.body.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.body.offset) || 0, 0);

    const snap = await db().collection(SUBS)
      .where("formId", "==", formId)
      .limit(1000)
      .get();

    let docs = snap.docs.filter(d => !d.data().deleted);

    if (searchVal) {
      const cleanSearchVal = searchVal.replace(/[^a-z0-9а-яё]/gi, "");

      docs = docs.filter(d => {
        const sub = d.data();
        const dataObj = sub.data || {};

        const checkValue = (raw: any): boolean => {
          if (raw === undefined || raw === null) return false;
          const valStr = String(raw).trim().toLowerCase();
          const cleanValStr = valStr.replace(/[^a-z0-9а-яё]/gi, "");

          if (exactMatch) {
            if (valStr === searchVal) return true;
            if (cleanSearchVal && cleanValStr === cleanSearchVal) return true;
            return false;
          } else {
            if (valStr.includes(searchVal)) return true;
            if (cleanSearchVal && cleanValStr.includes(cleanSearchVal)) return true;
            return false;
          }
        };

        if (targetField) {
          if (checkValue(dataObj[targetField])) return true;
          if (checkValue(sub[targetField])) return true;
          const fieldDef = (Array.isArray(form.fields) ? form.fields : []).find(
            (f: any) => String(f.id) === targetField || String(f.label || "").toLowerCase() === targetField.toLowerCase()
          );
          if (fieldDef && checkValue(dataObj[fieldDef.id])) return true;
          return false;
        } else {
          for (const key of Object.keys(dataObj)) {
            if (checkValue(dataObj[key])) return true;
          }
          const topFields = [
            sub.applicantName, sub.applicantPhone, sub.applicantEmail,
            sub.teamName, sub.teamCode, sub.qrToken, sub.participationFormat, sub.presentationUrl
          ];
          for (const topVal of topFields) {
            if (checkValue(topVal)) return true;
          }
          return false;
        }
      });
    }

    docs.sort((a, b) => {
      const tA = a.data().createdAt?.toMillis?.() || 0;
      const tB = b.data().createdAt?.toMillis?.() || 0;
      return tB - tA;
    });

    const total = docs.length;
    const pagedDocs = docs.slice(offset, offset + limit);

    const submissions = pagedDocs.map(d => {
      const sub = d.data();
      const dec = decisionOf(resolveDecisions(form), sub.status);
      const status = dec.id;
      const item = {
        id: d.id,
        submission_id: d.id,
        code: sub.qrToken || d.id,
        qrToken: sub.qrToken || d.id,
        form_id: sub.formId,
        tenant_id: sub.tenantId,
        status,
        status_label: dec.label,
        applicant_name: sub.applicantName || "",
        applicant_email: sub.applicantEmail || "",
        applicant_phone: sub.applicantPhone || "",
        team_name: sub.teamName || "",
        team_code: sub.teamCode || "",
        participation_format: sub.participationFormat || "",
        presentation_url: sub.presentationUrl || "",
        data: sub.data || {},
        history: sub.history || [],
        created_at: sub.createdAt || null,
        updated_at: sub.updatedAt || null,
      };
      return sanitizeSubmissionFields(item, form);
    });

    void logApiAudit(req, "SUBMISSIONS_SEARCH", { formId, total, limit, offset, tenantId: form.tenantId });

    return res.json({
      success: true,
      total,
      limit,
      offset,
      submissions,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/submissions/upsert — Универсальное создание или обновление заявки (Защищенный API)
 */
router.post("/submissions/upsert", formsApiLimiter, authenticateFormApi, async (req: any, res: any) => {
  try {
    const formId = str(req.body.form_id || req.body.formId, 200);
    if (!formId) {
      return res.status(400).json({ success: false, error: "Параметр form_id обязателен" });
    }

    const formSnap = await db().collection(FORMS).doc(formId).get();
    if (!formSnap.exists) {
      return res.status(404).json({ success: false, error: "Форма не найдена" });
    }
    const form = formSnap.data()!;

    const { tenantId: clientTenantId } = extractTenantContext(req);
    if (clientTenantId && clientTenantId !== form.tenantId && !req.user?.isSuperadmin) {
      return res.status(403).json({ success: false, error: "Форма принадлежит другой организации" });
    }

    const gate = await checkTenantOpen(form.tenantId, "forms");
    if (!gate.ok && !req.user?.isSuperadmin) {
      return res.status(gate.status || 403).json({ success: false, error: gate.error });
    }

    const { match_by, matchBy, token, code, qrToken, submission_id, submissionId, data, status: newStatus } = req.body || {};
    const inputData = typeof data === "object" && data !== null ? data : {};

    const fields: any[] = Array.isArray(form.fields) ? form.fields : [];

    const clean: Record<string, any> = {};
    for (const f of fields) {
      const raw = inputData[f.id] ?? inputData[f.label];
      if (raw !== undefined && f.type !== "section") {
        clean[f.id] = f.type === "checkbox" ? Boolean(raw) : f.type === "multi" ? cleanMulti(f, raw).value : str(raw, 2000);
      }
    }
    // Те же рамки, что и при обычной подаче: ключи сверх объявленных полей
    // принимаются, но ограниченно — иначе через эту ручку в заявку можно
    // записать что угодно.
    {
      const known = new Set(fields.map((f: any) => String(f.id)));
      let extras = 0;
      for (const [k, v] of Object.entries(inputData as Record<string, unknown>)) {
        if (known.has(k) || clean[k] !== undefined) continue;
        if (++extras > 30) break;
        if (!/^[\w.-]{1,80}$/.test(k)) continue;
        if (v === null || typeof v === "boolean" || typeof v === "number") { clean[k] = v; continue; }
        if (typeof v !== "string") continue;
        if (/^\s*data:/i.test(v)) continue;
        clean[k] = str(v, 2000);
      }
    }

    const pick = (role: string) => {
      const id = roleFieldId(form, role);
      return id ? str(clean[id], 500) : "";
    };

    const applicantName = pick("name") || str(req.body.applicantName || req.body.applicant_name, 500);
    const applicantPhone = pick("phone") || str(req.body.applicantPhone || req.body.applicant_phone, 500);
    const applicantEmail = pick("email") || str(req.body.applicantEmail || req.body.applicant_email, 500);
    const participationFormat = pick("format") || str(req.body.participationFormat || req.body.participation_format, 500);
    const teamName = pick("teamName") || str(req.body.teamName || req.body.team_name, 500);
    const teamCode = pick("teamCode") || str(req.body.teamCode || req.body.team_code, 500);
    const teamPassword = pick("teamPassword") || str(req.body.teamPassword || req.body.team_password, 500);
    const presentationUrl = pick("presentationUrl") || str(req.body.presentationUrl || req.body.presentation_url, 500);

    let existingDocSnap: any = null;

    const directToken = str(token || code || qrToken || submission_id || submissionId, 100);
    if (directToken) {
      const byTokenSnap = await db().collection(SUBS).where("formId", "==", formId).where("qrToken", "==", directToken).limit(1).get();
      if (!byTokenSnap.empty) {
        existingDocSnap = byTokenSnap.docs[0];
      } else {
        const byIdSnap = await db().collection(SUBS).doc(directToken).get();
        if (byIdSnap.exists && byIdSnap.data()?.formId === formId) {
          existingDocSnap = byIdSnap;
        }
      }
    }

    const matchObj = match_by || matchBy;
    if (!existingDocSnap && matchObj && matchObj.value) {
      const matchVal = str(matchObj.value, 500).toLowerCase();
      const cleanMatchVal = matchVal.replace(/[^a-z0-9а-яё]/gi, "");
      const matchField = str(matchObj.field_id || matchObj.fieldId, 200);

      const allSubSnap = await db().collection(SUBS).where("formId", "==", formId).limit(500).get();
      for (const d of allSubSnap.docs) {
        const subData = d.data();
        if (subData.deleted) continue;
        const dataMap = subData.data || {};

        const checkMatch = (val: any) => {
          if (!val) return false;
          const s = String(val).trim().toLowerCase();
          const cleanS = s.replace(/[^a-z0-9а-яё]/gi, "");
          return s === matchVal || (cleanMatchVal && cleanS === cleanMatchVal);
        };

        if (matchField) {
          if (checkMatch(dataMap[matchField]) || checkMatch(subData[matchField])) {
            existingDocSnap = d;
            break;
          }
        } else {
          if (checkMatch(subData.qrToken) || checkMatch(subData.teamCode) || checkMatch(subData.applicantEmail)) {
            existingDocSnap = d;
            break;
          }
        }
      }
    }

    const validStatus = typeof newStatus === "string" && resolveDecisions(form).some(d => d.id === newStatus) ? newStatus : undefined;

    if (existingDocSnap) {
      const existingRef = existingDocSnap.ref;
      const existingData = existingDocSnap.data() || {};
      const mergedData = { ...(existingData.data || {}), ...clean };

      const updatePayload: Record<string, any> = {
        data: mergedData,
        applicantName: applicantName || existingData.applicantName || "",
        applicantPhone: applicantPhone || existingData.applicantPhone || "",
        applicantEmail: applicantEmail || existingData.applicantEmail || "",
        participationFormat: participationFormat || existingData.participationFormat || "",
        teamName: teamName || existingData.teamName || "",
        teamCode: teamCode || existingData.teamCode || "",
        teamPassword: teamPassword || existingData.teamPassword || "",
        presentationUrl: presentationUrl || existingData.presentationUrl || "",
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (validStatus && validStatus !== existingData.status) {
        updatePayload.status = validStatus;
        updatePayload.history = admin.firestore.FieldValue.arrayUnion({
          status: validStatus,
          at: admin.firestore.Timestamp.now(),
          by: "api_upsert",
          note: "Статус обновлён через API",
        });
      }

      await existingRef.update(updatePayload);

      await settle(appendToSheet(form, formId, {
        applicantName: updatePayload.applicantName,
        applicantPhone: updatePayload.applicantPhone,
        applicantEmail: updatePayload.applicantEmail,
        status: validStatus || existingData.status || "new",
        qrToken: existingData.qrToken,
        data: mergedData,
      }));

      void logApiAudit(req, "SUBMISSIONS_UPSERT", { formId, submissionId: existingDocSnap.id, action: "updated", tenantId: form.tenantId });

      return res.json({
        success: true,
        action: "updated",
        submission_id: existingDocSnap.id,
        code: existingData.qrToken || existingDocSnap.id,
        qrToken: existingData.qrToken || existingDocSnap.id,
        data: sanitizeSubmissionFields({ data: mergedData }, form).data,
        message: "Заявка успешно обновлена",
      });
    }

    const qrTokenVal = makeToken();
    const newRef = db().collection(SUBS).doc();
    const subDoc = {
      tenantId: form.tenantId || "",
      formId,
      formTitle: form.title || "Заявка",
      qrToken: qrTokenVal,
      applicantName, applicantPhone, applicantEmail,
      participationFormat, teamName, teamCode, teamPassword, presentationUrl,
      status: (validStatus || "new") as Status,
      data: clean,
      history: [{ status: validStatus || "new", at: admin.firestore.Timestamp.now(), by: "api_upsert" }],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await newRef.set(subDoc);

    await settle(appendToSheet(form, formId, {
      applicantName, applicantPhone, applicantEmail,
      status: validStatus || "new", qrToken: qrTokenVal, data: clean,
    }));

    void logApiAudit(req, "SUBMISSIONS_UPSERT", { formId, submissionId: newRef.id, action: "created", tenantId: form.tenantId });

    return res.json({
      success: true,
      action: "created",
      submission_id: newRef.id,
      code: qrTokenVal,
      qrToken: qrTokenVal,
      data: sanitizeSubmissionFields({ data: clean }, form).data,
      message: "Заявка успешно создана",
    });

  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/team/check — Поиск и проверка пароля команды (Rate limited)
 */
router.post("/team/check", formsApiLimiter, async (req: any, res: any) => {
  try {
    const formId = str(req.body.formId || req.body.form_id, 200);
    const code = str(req.body.code, 200);
    const password = str(req.body.password, 200);

    if (!formId || !code) {
      return res.status(400).json({ success: false, error: "Параметры formId и code обязательны" });
    }

    const cleanCode = code.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");

    const formSnap = await db().collection(FORMS).doc(formId).get();
    const form: any = formSnap.exists ? { id: formSnap.id, ...formSnap.data() } : { fields: [] };
    const codeFieldId = roleFieldId(form, "teamCode");
    const passFieldId = roleFieldId(form, "teamPassword");
    const nameFieldId = roleFieldId(form, "teamName");
    const formatFieldId = roleFieldId(form, "format");

    const snap = await db().collection(SUBS)
      .where("formId", "==", formId)
      .limit(500)
      .get();

    const matchedDoc = snap.docs.find(d => {
      const s = d.data();
      if (s.deleted) return false;
      const c1 = String(s.teamCode || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      const c2 = String(s.qrToken || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      const c3 = String((codeFieldId && s.data?.[codeFieldId]) || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      return c1 === cleanCode || c2 === cleanCode || c3 === cleanCode;
    });

    if (!matchedDoc) {
      return res.json({
        success: true,
        found: false,
        message: "Команда с таким кодом не найдена",
      });
    }

    const sub = matchedDoc.data();
    const storedPassword = String(sub.teamPassword || (passFieldId && sub.data?.[passFieldId]) || "").trim();

    let passwordMatches: boolean | undefined = undefined;
    if (password) {
      passwordMatches = !!storedPassword && safeEq(storedPassword, password.trim());
    }

    void logApiAudit(req, "TEAM_CHECK", { formId, code, found: true, passwordMatches: !!passwordMatches });

    // Без верного пароля — только «такая команда есть»: ни ответов заявки,
    // ни кода QR, ни id. Раньше по одному коду команды (его выбирают сами,
    // вроде «team1») отдавались все ответы и код билета.
    if (!passwordMatches) {
      return res.json({ success: true, found: true, passwordMatches: password ? false : undefined });
    }

    return res.json({
      success: true,
      found: true,
      submissionId: matchedDoc.id,
      code: sub.qrToken || sub.teamCode || matchedDoc.id,
      teamName: sub.teamName || (nameFieldId && sub.data?.[nameFieldId]) || "",
      participationFormat: sub.participationFormat || (formatFieldId && sub.data?.[formatFieldId]) || "",
      status: sub.status || "new",
      passwordMatches,
      data: sanitizeSubmissionFields({ data: sub.data || {} }, form).data,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PATCH /api/forms/submissions/:submission_id — Частичное обновление заявки (Защищенный API)
 * Поддерживает также POST /api/forms/submissions/:submission_id/update
 */
const patchSubmissionHandler = async (req: any, res: any) => {
  try {
    const submissionId = str(req.params.submission_id || req.params.submissionId, 200);
    if (!submissionId) {
      return res.status(400).json({ success: false, error: "INVALID_PARAMETERS", message: "Field 'submission_id' is required." });
    }

    let docSnap = await db().collection(SUBS).doc(submissionId).get();
    if (!docSnap.exists) {
      const byTokenSnap = await db().collection(SUBS).where("qrToken", "==", submissionId).limit(1).get();
      if (!byTokenSnap.empty) {
        docSnap = byTokenSnap.docs[0];
      }
    }

    if (!docSnap || !docSnap.exists) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Submission not found." });
    }

    const existingData = docSnap.data()!;
    const formId = existingData.formId;

    const formSnap = await db().collection(FORMS).doc(String(formId)).get();
    const form = formSnap.exists ? formSnap.data()! : null;

    const { tenantId: clientTenantId } = extractTenantContext(req);
    if (clientTenantId && clientTenantId !== existingData.tenantId && !req.user?.isSuperadmin) {
      return res.status(403).json({ success: false, error: "UNAUTHORIZED_ACCESS", message: "Form does not belong to the authenticated tenant." });
    }

    const fieldsPatch = req.body.fields || req.body.data || req.body;
    if (typeof fieldsPatch !== "object" || !fieldsPatch) {
      return res.status(400).json({ success: false, error: "INVALID_PARAMETERS", message: "fields object is required." });
    }

    const mergedFields = { ...(existingData.data || {}), ...fieldsPatch };

    const now = admin.firestore.Timestamp.now();
    await docSnap.ref.update({
      data: mergedFields,
      updatedAt: now,
      history: admin.firestore.FieldValue.arrayUnion({
        status: existingData.status || "new",
        at: now,
        by: "api_patch",
        note: "Поля обновлены через PATCH API",
      }),
    });

    if (form) {
      await settle(appendToSheet(form, String(formId), {
        applicantName: existingData.applicantName,
        applicantPhone: existingData.applicantPhone,
        applicantEmail: existingData.applicantEmail,
        status: existingData.status || "new",
        qrToken: existingData.qrToken,
        data: mergedFields,
      }));
    }

    void logApiAudit(req, "SUBMISSIONS_PATCH", { submissionId, formId, tenantId: existingData.tenantId });

    const cleanMerged = sanitizeSubmissionFields({ data: mergedFields }, form).data;

    return res.json({
      success: true,
      submission_id: docSnap.id,
      updated_at: new Date().toISOString(),
      fields: cleanMerged,
      data: cleanMerged,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR", message: e.message });
  }
};

router.patch("/submissions/:submission_id", formsApiLimiter, authenticateFormApi, patchSubmissionHandler);
router.post("/submissions/:submission_id/update", formsApiLimiter, authenticateFormApi, patchSubmissionHandler);

/**
 * GET /api/forms/track/:token — статус заявки по QR.
 *
 * Отдаём только то, что заявитель и так о себе знает: своё имя, статус и
 * даты. Содержимое заявки, внутренние заметки и tenantId сюда не попадают —
 * токен короткий, и по нему не должно открываться ничего лишнего.
 */
router.get("/track/:token", async (req: any, res: any) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ success: false, error: "Нужен код заявки" });

    let doc0: any = null;
    const byToken = await db().collection(SUBS).where("qrToken", "==", token).limit(1).get();
    if (!byToken.empty) doc0 = byToken.docs[0];
    else {
      // Старые заявки трекались по id документа — поддерживаем и их.
      const byId = await db().collection(SUBS).doc(token).get();
      if (byId.exists) doc0 = byId;
    }
    // Удалённая заявка — не найдена: её билет больше не действует.
    if (!doc0 || doc0.data()?.deleted) {
      return res.status(404).json({ success: false, error: "Заявка по этому коду не найдена." });
    }

    const s = doc0.data();
    // Режим формы нужен трекеру: в билетном режиме страница показывает
    // QR-билет — но только когда заявка одобрена. До того билета нет.
    const formSnap = s.formId ? await db().collection(FORMS).doc(String(s.formId)).get() : null;
    const formData: any = formSnap?.exists ? formSnap.data() : null;
    const mode = formMode(formData);
    const decs = resolveDecisions(formData);
    const cur = decisionOf(decs, s.status);
    const status: Status = cur.kind;

    const tenant = await loadTenant(String(s.tenantId || ""));
    const org = publicOrg(tenant);
    const page = formData ? await trackPage(String(s.tenantId || ""), formData, s, cur, String(tenant?.name || "")) : null;
    return res.json({
      success: true,
      org,
      submission: {
        code: s.qrToken || doc0.id,
        formId: s.formId || "",
        // Название — текущее у формы: её могли переименовать после подачи.
        formTitle: (formSnap?.exists ? String(formSnap.data()?.title || "") : "") || s.formTitle || "Заявка",
        applicantName: s.applicantName || "",
        status,
        statusId: cur.id,
        statusLabel: cur.label,
        statusColor: cur.color,
        mode,
        ticketActive: mode === "ticket" && TICKET_ACTIVE.includes(status),
        checkedInAt: s.checkedInAt || null,
        createdAt: s.createdAt || null,
        updatedAt: s.updatedAt || null,
        // Комментарий сотрудника отдаём заявителю: он для него и пишется —
        // «почему отказ», «когда ждать», «что донести». Раньше он оставался
        // только в кабинете, и человек видел голую смену статуса.
        history: (Array.isArray(s.history) ? s.history : []).map((h: any) => ({
          status: h.status,
          label: decisionOf(decs, h.status).label,
          color: decisionOf(decs, h.status).color,
          at: h.at || null,
          note: String(h.note || ""),
        })),
      },
      page,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/checkin — сканер билетов на входе.
 *
 * Волонтёр — сотрудник организации со своим аккаунтом: он входит в воркспейс,
 * открывает «Проверку билетов», наводит камеру на QR гостя. Один скан — один
 * запрос: сервер сам решает судьбу билета и сразу отмечает вход, чтобы у
 * двери не было двух тапов на гостя.
 *
 * Отметка в ТРАНЗАКЦИИ: два волонтёра, отсканировавшие один билет
 * одновременно, не должны оба увидеть зелёную рамку — билет, переснятый
 * скриншотом и посланный другу, обязан сгореть у второго.
 *
 * Ответ всегда success:true с полем result — сканеру нужно РИСОВАТЬ исход
 * (зелёная/красная рамка), а не разбирать HTTP-коды:
 *   ok        — пропустить, вход отмечен только что
 *   already   — УЖЕ ВХОДИЛ (checkedInAt), не пускать
 *   inactive  — билет не активен (не одобрен/не оплачен/отклонён)
 *   notticket — QR не от билетной формы
 */
router.post("/checkin", requireFirebaseAuth, async (req: any, res: any) => {
  // Замер по этапам: у двери скан дольше трёх секунд — это очередь людей, и
  // разбираться потом по одному «медленно было» нечем. В имитации входа
  // один скан из 550 завис на 133 секунды, и без разбивки по этапам не было
  // видно, где именно: в базе, в проверке прав или в самой отметке.
  const marks: Array<[string, number]> = [];
  const t0 = Date.now();
  const mark = (name: string) => marks.push([name, Date.now() - t0]);
  res.on("finish", () => {
    const total = Date.now() - t0;
    if (total > 3000) {
      console.warn(`[Checkin] медленный скан ${total} мс (HTTP ${res.statusCode}): ` +
        marks.map(([n, ms]) => `${n}=${ms}`).join(", "));
    }
  });

  try {
    const { token, requestId } = req.body || {};
    if (!token) return res.status(400).json({ success: false, error: "Нужен код билета" });
    // Мероприятия смены: сканер может передать формы, на которые сейчас пускают.
    const allowedForms: string[] = (Array.isArray(req.body?.formIds) ? req.body.formIds : req.body?.formId ? [req.body.formId] : [])
      .map((x: unknown) => str(x, 200)).filter(Boolean).slice(0, 50);

    const byToken = await db().collection(SUBS).where("qrToken", "==", String(token).trim().toUpperCase()).limit(1).get();
    mark("поиск билета");
    if (byToken.empty) {
      return res.status(404).json({ success: false, error: "Билет не найден" });
    }
    const subRef = byToken.docs[0].ref;
    const sub = byToken.docs[0].data();
    // Удалённая заявка (дубль, подделка) — не билет.
    if (sub.deleted) {
      return res.status(404).json({ success: false, error: "Билет не найден" });
    }

    // Организация должна быть активна, а раздел билетов — не закрыт платформой.
    const gate = await checkTenantOpen(sub.tenantId, req.user?.isSuperadmin ? undefined : "tickets");
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    mark("организация");
    if (!(await canCheckTickets(req.user, String(sub.tenantId || "")))) {
      return res.status(403).json({ success: false, error: "Нет доступа к билетам этой организации" });
    }
    mark("права волонтёра");

    const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
    const form = formSnap.exists ? formSnap.data()! : null;
    const decs = resolveDecisions(form);
    mark("форма");
    const guestName = sub.applicantName || "Без имени";
    if (!form || formMode(form) !== "ticket" || String(form.tenantId || "") !== String(sub.tenantId || "")) {
      return res.json({ success: true, result: "notticket", guest: { name: guestName } });
    }
    // Билет на другое мероприятие: не пускаем и не «сжигаем» его.
    if (allowedForms.length && !allowedForms.includes(String(sub.formId || ""))) {
      const title = String(form.title || sub.formTitle || "");
      return res.json({ success: false, result: "wrongevent", error: `Билет на другое мероприятие${title ? `: «${title}»` : ""}`, guest: { name: guestName }, formTitle: title });
    }

    const outcome = await db().runTransaction(async tx => {
      const fresh = await tx.get(subRef);
      const cur = fresh.data()!;
      if (cur.deleted) return { result: "inactive" as const, status: kindOfStatus(decs, cur.status) };
      const curStatus: Status = kindOfStatus(decs, cur.status);
      if (curStatus === "checked_in") {
        // Та же самая попытка, повторённая после обрыва связи: сканер не
        // получил ответ и спрашивает снова с тем же идентификатором.
        // Гостю это не «уже входил» — он вошёл только что, по первому
        // запросу. Тот же билет с ДРУГИМ идентификатором (скриншот в руках
        // у друга) по-прежнему красный: отдельная попытка не может
        // повторить чужую.
        if (requestId && cur.checkinRequestId && cur.checkinRequestId === String(requestId).slice(0, 80)) {
          return { result: "ok" as const, status: curStatus, checkedInAt: cur.checkedInAt || null, retried: true };
        }
        return { result: "already" as const, status: curStatus, checkedInAt: cur.checkedInAt || null };
      }
      if (!TICKET_ACTIVE.includes(curStatus)) {
        return { result: "inactive" as const, status: curStatus };
      }
      const now = admin.firestore.Timestamp.now();
      const inId = checkedInId(decs);
      tx.update(subRef, {
        status: inId,
        checkedInAt: now,
        checkedInBy: req.user?.email || req.user?.uid || "scanner",
        ...(requestId ? { checkinRequestId: String(requestId).slice(0, 80) } : {}),
        updatedAt: now,
        history: admin.firestore.FieldValue.arrayUnion({
          status: inId, at: now,
          by: req.user?.email || req.user?.uid || "scanner", note: "",
        }),
      });
      return { result: "ok" as const, status: "checked_in" as Status, checkedInAt: now };
    });
    mark("отметка входа");
    {
      const inId = checkedInId(decs);
      if (outcome.result === "ok" && !("retried" in outcome) && ["auto", "at"].includes(decisionOf(decs, inId).notify.mode)) {
        await settle(afterStatusChange({ tenantId: String(sub.tenantId), submissionId: subRef.id, form: { ...form, id: formSnap.id }, statusId: inId, by: byOf(req) }));
      }
    }

    return res.json({
      success: true,
      result: outcome.result,
      guest: {
        name: guestName,
        status: outcome.status,
        statusLabel: (kindOfStatus(decs, sub.status) === outcome.status ? decisionOf(decs, sub.status) : decs.find(d => d.kind === outcome.status) || decisionOf(decs, outcome.status)).label,
        checkedInAt: "checkedInAt" in outcome ? outcome.checkedInAt : null,
      },
      formTitle: (formSnap.exists ? String(formSnap.data()?.title || "") : "") || sub.formTitle || "",
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────── Кабинет ───────────────────────────

/**
 * Кабинет заявок — по правам, а не по факту членства. Раньше любой активный
 * сотрудник (даже без единой галочки) менял статусы заявок и видел статистику.
 */
async function canManageForms(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  // «CRM: просмотр» менять и удалять заявки не даёт — только смотреть (canViewForms).
  return hasAnyPermission(db(), user, tenantId, ["team:manage", "certificates:issue", "crm:manage"]);
}
/** Смотреть заявки и статистику: те, кто ведёт заявки, плюс «CRM: просмотр». */
async function canViewForms(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  return hasAnyPermission(db(), user, tenantId, ["team:manage", "certificates:issue", "crm:manage", "crm:read"]);
}
/** Проверка билетов на входе: волонтёр с «Проверка билетов» или кто ведёт заявки. */
async function canCheckTickets(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  return hasAnyPermission(db(), user, tenantId, ["tickets:check", "team:manage", "certificates:issue", "crm:manage"]);
}

const byOf = (req: any) => ({ uid: String(req.user?.uid || ""), name: String(req.user?.email || req.user?.name || "") });

/** Заявка и форма организации для действий сотрудника; null — ответ уже отправлен. */
async function loadOwned(req: any, res: any, tenantId: string, submissionId: string) {
  if (!tenantId || !submissionId) { res.status(400).json({ success: false, error: "Bad request" }); return null; }
  if (!(await canManageForms(req.user, tenantId))) { res.status(403).json({ success: false, error: "Нет прав" }); return null; }
  const snap = await db().collection(SUBS).doc(submissionId).get();
  if (!snap.exists) { res.status(404).json({ success: false, error: "Заявка не найдена" }); return null; }
  const sub: any = snap.data();
  if (sub.tenantId !== tenantId) { res.status(403).json({ success: false, error: "Заявка другой организации" }); return null; }
  const fs = await db().collection(FORMS).doc(String(sub.formId || "")).get();
  if (!fs.exists || fs.data()?.tenantId !== tenantId) { res.status(404).json({ success: false, error: "Форма не найдена" }); return null; }
  return { sub: { ...sub, id: snap.id }, form: { ...fs.data(), id: fs.id } };
}

/**
 * POST /api/forms/notify — отправить письмо о текущем состоянии (после
 * подтверждения «вручную»). Одна заявка или пачка (submissionIds, до 200).
 */
router.post("/notify", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, submissionIds } = req.body || {};
    const ids: string[] = Array.isArray(submissionIds) ? [...new Set(submissionIds.map((x: unknown) => str(x, 200)).filter(Boolean))].slice(0, 200) as string[] : [str(submissionId, 200)];
    let sent = 0;
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const o = await loadOwned(req, res, String(tenantId || ""), id);
      if (!o) return;
      if (o.sub.deleted) { failed.push({ id, reason: "Заявка удалена" }); continue; }
      const decision = decisionOf(resolveDecisions(o.form), o.sub.status);
      // Ручная отправка заменяет отложенную: второго письма не будет.
      await cancelPending(tenantId, id);
      const r = await sendDecisionEmail({ sub: o.sub, form: o.form, decision, force: true, by: req.user?.email || "" });
      if (r.sent) sent++; else failed.push({ id, reason: r.reason || "Не отправлено" });
    }
    if (ids.length === 1 && !sent) return res.status(422).json({ success: false, error: failed[0]?.reason || "Не отправлено" });
    return res.json({ success: true, sent, failed });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/forms/notify-cancel — отменить отложенное письмо заявки. */
router.post("/notify-cancel", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId } = req.body || {};
    const o = await loadOwned(req, res, String(tenantId || ""), str(submissionId, 200));
    if (!o) return;
    const was = await cancelPending(tenantId, o.sub.id);
    return res.json({ success: true, cancelled: was });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PUT /api/forms/decisions — сохранить состояния формы. Очищаются на сервере;
 * состояние, в котором есть заявки, удалить нельзя; шаблон и страница — только
 * этой организации.
 */
router.put("/decisions", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, formId } = req.body || {};
    if (!tenantId || !formId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) return res.status(403).json({ success: false, error: "Нет прав" });
    const ref = db().collection(FORMS).doc(String(formId));
    const fs = await ref.get();
    if (!fs.exists) return res.status(404).json({ success: false, error: "Форма не найдена" });
    const form: any = fs.data();
    if (form.tenantId !== tenantId) return res.status(403).json({ success: false, error: "Форма другой организации" });

    const next = sanitizeDecisions(req.body.decisions, formModeOf(form));
    for (const d of next) {
      if (d.notify.emailTemplateId && !(await loadTemplate(tenantId, d.notify.emailTemplateId))) delete d.notify.emailTemplateId;
      if (d.notify.pageId && !(await pageDoc(tenantId, d.notify.pageId).get()).exists) delete d.notify.pageId;
    }
    const prev = resolveDecisions(form);
    const gone = prev.filter(p => !next.some(n => n.id === p.id));
    if (gone.length) {
      const subs = (await db().collection(SUBS).where("formId", "==", String(formId)).get()).docs.map(d => d.data()).filter(x => !x.deleted);
      const used = gone.map(g => ({ id: g.id, label: g.label, count: subs.filter(x => String(x.status || "new") === g.id).length })).filter(u => u.count);
      if (used.length) return res.status(409).json({ success: false, error: `В состоянии «${used[0].label}» есть заявки`, used });
    }
    await ref.set({ decisions: next, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    await writeAudit(db(), tenantId, { actor: actorOf(req.user), action: "form.decisions", section: "settings", target: { kind: "form", id: String(formId), name: String(form.title || "") }, detail: next.map(d => d.label).join(", ").slice(0, 300) }).catch(() => {});
    return res.json({ success: true, decisions: next });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PUT /api/forms/flow — этапы формы (что делают организаторы после смены
 * состояния). Очищаются на сервере; шаблон — только этой организации.
 */
router.put("/flow", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, formId } = req.body || {};
    if (!tenantId || !formId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) return res.status(403).json({ success: false, error: "Нет прав" });
    const ref = db().collection(FORMS).doc(String(formId));
    const fs = await ref.get();
    if (!fs.exists) return res.status(404).json({ success: false, error: "Форма не найдена" });
    const form: any = fs.data();
    if (form.tenantId !== tenantId) return res.status(403).json({ success: false, error: "Форма другой организации" });
    const flow = sanitizeFlow(req.body.flow, form);
    for (const st of flow.steps) if (st.emailTemplateId && !(await loadTemplate(tenantId, st.emailTemplateId))) delete st.emailTemplateId;
    await ref.set({ flow, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    await writeAudit(db(), tenantId, { actor: actorOf(req.user), action: "form.flow", section: "settings", target: { kind: "form", id: String(formId), name: String(form.title || "") }, detail: flow.steps.map(x => x.title).join(", ").slice(0, 300) || "без этапов" });
    return res.json({ success: true, flow });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/flow-step — этап у заявки: отметки и комментарий (save),
 * «Опубликовать» (publish, сразу или at), «Снять» (unpublish), отмена таймера.
 * Опубликованное не меняется, пока публикацию не снимут.
 */
router.post("/flow-step", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, stepId, action } = req.body || {};
    const o = await loadOwned(req, res, String(tenantId || ""), str(submissionId, 200));
    if (!o) return;
    if (o.sub.deleted) return res.status(409).json({ success: false, error: "Заявка в корзине" });
    if (!STEP_ID.test(String(stepId || ""))) return res.status(400).json({ success: false, error: "Неизвестный этап" });
    const flow = resolveFlow(o.form);
    const step = flow.steps.find(x => x.id === stepId);
    if (!step) return res.status(404).json({ success: false, error: "Этапа нет у формы" });
    const prev: StepState = o.sub.flow?.[step.id] || { marks: [], comment: "", published: null, by: "", byName: "", at: 0 };
    const by = byOf(req);
    const ref = db().collection(SUBS).doc(o.sub.id);
    const fresh = async () => ((await ref.get()).data()?.flow || {})[step.id] || null;

    if (action === "unpublish") {
      if (!prev.published) return res.json({ success: true, state: prev });
      await ref.update({
        [`flow.${step.id}.published`]: null, updatedAt: admin.firestore.Timestamp.now(),
        history: admin.firestore.FieldValue.arrayUnion({ status: String(o.sub.status || "new"), at: admin.firestore.Timestamp.now(), by: by.name, note: `Публикация этапа «${step.title}» снята` }),
      });
      return res.json({ success: true, state: await fresh() });
    }
    if (prev.published) return res.status(409).json({ success: false, error: "Этап опубликован — сначала снимите публикацию" });
    if (!stepActive(o.form, o.sub, flow.steps, step)) return res.status(409).json({ success: false, error: "У этой заявки этап сейчас недоступен" });

    if (action === "save") {
      const marks = Array.isArray(req.body.marks) ? [...new Set(req.body.marks.map(String))].filter(id => step.marks.some(m => m.id === id)) as string[] : prev.marks;
      const comment = step.comment && req.body.comment !== undefined ? String(req.body.comment ?? "").replace(/\r/g, "").trim().slice(0, 2000) : prev.comment;
      const st: StepState = { ...prev, marks, comment, by: by.uid, byName: by.name, at: Date.now() };
      // Отметок стало меньше нужного — таймер публикации снимается.
      if (st.publishAt && !canPublish(step, st)) { await cancelStepSchedule(String(tenantId), o.sub.id, step.id); st.publishAt = null; }
      await ref.update({ [`flow.${step.id}`]: JSON.parse(JSON.stringify(st)), updatedAt: admin.firestore.Timestamp.now() });
      return res.json({ success: true, state: st });
    }
    if (action === "cancel") {
      await cancelStepSchedule(String(tenantId), o.sub.id, step.id);
      return res.json({ success: true, state: await fresh() });
    }
    if (action === "publish") {
      if (!canPublish(step, prev)) return res.status(409).json({ success: false, error: step.minMarks > 1 ? `Отметьте хотя бы ${step.minMarks}` : "Отметьте хотя бы одну кнопку" });
      const at = Number(req.body.at);
      if (Number.isFinite(at) && at >= Date.now() + 60_000) {
        await scheduleStep(String(tenantId), o.sub.id, step.id, Math.floor(at), by);
        return res.json({ success: true, scheduled: Math.floor(at), state: await fresh() });
      }
      const r = await publishStep({ sub: o.sub, form: o.form, step, by });
      return res.json({ success: true, state: await fresh(), email: { sent: r.email.sent, reason: r.email.reason || "", to: r.email.to || "", skipped: !!r.email.skipped } });
    }
    return res.status(400).json({ success: false, error: "Неизвестное действие" });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/forms/status — смена статуса заявки сотрудником. */
router.post("/status", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, status, note } = req.body || {};
    if (!tenantId || !submissionId) return res.status(400).json({ success: false, error: "Bad request" });
    if (typeof status !== "string" || !DECISION_ID.test(status)) {
      return res.status(400).json({ success: false, error: "Неизвестный статус" });
    }
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const ref = db().collection(SUBS).doc(String(submissionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Заявка не найдена" });
    if (snap.data()!.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Заявка другой организации" });
    }

    // Статус должен существовать в режиме этой формы: «Гость пришёл» у заявки
    // на поступление — бессмыслица, которая потом путает всю статистику.
    const subFormSnap = await db().collection(FORMS).doc(String(snap.data()!.formId || "")).get();
    const decs = resolveDecisions(subFormSnap.exists ? subFormSnap.data() : null);
    if (!decs.some(d => d.id === status)) {
      return res.status(400).json({ success: false, error: "Этого состояния нет у формы" });
    }

    await ref.update({
      status,
      updatedAt: admin.firestore.Timestamp.now(),
      history: admin.firestore.FieldValue.arrayUnion({
        status, at: admin.firestore.Timestamp.now(),
        by: req.user?.email || "", note: str(note, 300),
      }),
    });
    // Колонка «Статус» в таблице должна совпадать с кабинетом.
    if (subFormSnap.exists) {
      await settle(upsertSheetRows({ ...subFormSnap.data(), id: subFormSnap.id }, [{ ...snap.data(), status }]));
    }
    const plan = subFormSnap.exists
      ? await afterStatusChange({ tenantId, submissionId: String(submissionId), form: { ...subFormSnap.data(), id: subFormSnap.id }, statusId: status, by: byOf(req) }).catch(() => null)
      : null;
    return res.json({ success: true, status, statusLabel: decisionOf(decs, status).label, notify: plan, ...(plan?.needConfirm ? { needConfirm: { label: plan.label || "" } } : {}) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Найти строку заявки в таблице формы по её коду в колонке F.
 * Возвращает номер строки или 0, если заявки в таблице нет.
 */
async function findSheetRow(tenantId: string, sheetId: string, qrToken: string): Promise<number> {
  if (!tenantId || !sheetId || !qrToken) return 0;
  const snap = await db().collection("tenants").doc(tenantId).collection("workspace_sheets").doc(sheetId).get();
  if (!snap.exists) return 0;
  const cells: Record<string, any> = snap.data()?.cells || {};
  for (const [key, value] of Object.entries(cells)) {
    if (!/^F\d+$/.test(key)) continue;
    if (String((value as any)?.rawValue || "") !== qrToken) continue;
    return Number((key.match(/\d+$/) || [])[0]) || 0;
  }
  return 0;
}

/**
 * Убрать строку заявки из таблицы — при удалении заявки в корзину.
 *
 * Строка удаляется целиком, а нижние подтягиваются вверх — как при
 * удалении строки в любой таблице. Раньше ячейки лишь очищались, и на
 * месте убранной заявки оставалась дыра: в списке заявки нет, а в таблице
 * зияет пустая строка, и посчитать участников по таблице нельзя.
 *
 * Сдвигаем ВСЮ строку, вместе с пометками, которые ведут в соседних
 * колонках: пометка написана напротив конкретного человека и должна
 * уехать вместе с ним, иначе она окажется напротив чужой заявки.
 */
async function clearSheetRow(form: any, qrToken: string): Promise<void> {
  try {
    const tenantId = String(form?.tenantId || "");
    const sheetId = String(form?.sheetId || "");
    const row = await findSheetRow(tenantId, sheetId, qrToken);
    if (!row) return;

    const sheetRef = db().collection("tenants").doc(tenantId).collection("workspace_sheets").doc(sheetId);
    const snap = await sheetRef.get();
    const cells: Record<string, any> = snap.data()?.cells || {};

    // Пересобираем лист без удалённой строки. Заменяем набор ячеек целиком:
    // при сдвиге часть ячеек освобождает свои прежние места, и слияние
    // оставило бы их там дубликатами.
    const next: Record<string, any> = {};
    for (const [key, value] of Object.entries(cells)) {
      const col = (key.match(/^[A-Z]+/) || [])[0];
      const at = Number((key.match(/\d+$/) || [])[0]);
      if (!col || !at) continue;
      if (at === row) continue;              // сама удалённая строка
      next[`${col}${at > row ? at - 1 : at}`] = value;
    }

    await sheetRef.update({
      cells: next,
      rowsCount: Math.max(1, Number(snap.data()?.rowsCount || 100) - 1),
      updatedAt: Date.now(),
    });
  } catch (e: any) {
    console.warn("[Forms/Sheet] Не удалось убрать строку из таблицы:", e.message);
  }
}

/**
 * POST /api/forms/publish — показывать заявку на витрине или убрать с неё.
 *
 * Решение про каждую заявку принимает человек: анкета анонимная, и люди
 * писали не для публикации.
 */
router.post("/publish", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, shown } = req.body || {};
    if (!tenantId || !submissionId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const ref = db().collection(SUBS).doc(String(submissionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Заявка не найдена" });
    if (snap.data()!.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Заявка другой организации" });
    }

    const publicShown = shown === true;
    await ref.update({
      publicShown,
      publicShownAt: publicShown ? admin.firestore.Timestamp.now() : admin.firestore.FieldValue.delete(),
      publicShownBy: publicShown ? (req.user?.email || "") : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return res.json({ success: true, publicShown });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/sheet/resync — пересобрать таблицу формы заново.
 *
 * Таблица дописывается по одной строке при каждой заявке, и со временем
 * расходится с кабинетом: остаются строки удалённых заявок, задвоенные
 * коды после повторной выгрузки, пропуски от сбоев записи. Проверить
 * глазами 450 строк невозможно — нужна кнопка «привести в порядок».
 *
 * Пересобираем ТОЛЬКО колонки заявки, слева направо. Всё, что человек
 * дописал правее, остаётся на месте — но привязка к своей строке
 * теряется, если порядок заявок изменился, поэтому в ответе честно
 * говорим, сколько строк переписано.
 */
router.post("/sheet/resync", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, formId } = req.body || {};
    if (!tenantId || !formId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const formSnap = await db().collection(FORMS).doc(String(formId)).get();
    if (!formSnap.exists || formSnap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Форма не найдена" });
    }
    const form = formSnap.data()!;
    const sheetId = String(form.sheetId || "");
    if (!sheetId) return res.status(409).json({ success: false, error: "У этой анкеты ещё нет таблицы — нажмите «В таблицу»." });

    const sheetRef = db().collection("tenants").doc(tenantId).collection("workspace_sheets").doc(sheetId);
    const sheetSnap = await sheetRef.get();
    if (!sheetSnap.exists) {
      return res.status(409).json({ success: false, error: "Таблица была удалена — нажмите «В таблицу», чтобы создать заново." });
    }

    const subsSnap = await db().collection(SUBS).where("formId", "==", String(formId)).limit(2000).get();
    const live = subsSnap.docs
      .map(d => d.data())
      .filter(x => !x.deleted)
      .sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

    const fields: any[] = (Array.isArray(form.fields) ? form.fields : []).filter((f: any) => f.type !== "file");
    const head = ["Дата", "Имя", "Телефон", "Почта", "Статус", "Код"].concat(fields.map((f: any) => String(f.label || f.id)));
    const width = head.length;

    const cells: Record<string, any> = { ...(sheetSnap.data()!.cells || {}) };

    // Стираем прежние колонки заявок целиком: иначе строки от удалённых
    // заявок остались бы хвостом внизу.
    for (const key of Object.keys(cells)) {
      const col = (key.match(/^[A-Z]+/) || [])[0] || "";
      if (col.length === 1 && col.charCodeAt(0) - 65 < width) delete cells[key];
    }

    const put = (row: number, values: string[]) => values.forEach((v, i) => {
      cells[`${columnName(i)}${row}`] = { rawValue: v, computedValue: v };
    });

    put(1, head);
    live.forEach((sub: any, i: number) => {
      put(i + 2, [
        sub.createdAt?.toDate ? sub.createdAt.toDate().toLocaleString("ru-RU") : "",
        String(sub.applicantName || ""),
        String(sub.applicantPhone || ""),
        String(sub.applicantEmail || ""),
        decisionOf(resolveDecisions(form), sub.status).label,
        String(sub.qrToken || ""),
      ].concat(fields.map((f: any) => String(sub.data?.[f.id] ?? ""))));
    });

    await sheetRef.update({
      cells,
      rowsCount: Math.max(100, live.length + 20),
      columnsCount: Math.max(Number(sheetSnap.data()!.columnsCount) || 26, width + 2),
      updatedAt: Date.now(),
      lastEditedByStaffId: req.user?.uid || "",
    });

    return res.json({ success: true, rows: live.length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/purge — стереть заявку окончательно.
 *
 * Корзина спасает от случайного нажатия, но из неё должен быть выход:
 * пробные заявки, спам и дубли нельзя держать вечно, а в выгрузку и в
 * счётчики они попадать не должны. Доступно только для того, что уже
 * лежит в корзине — чтобы стереть, нужно сначала осознанно удалить.
 *
 * Строка из таблицы убирается вместе с заявкой: иначе в выгрузке
 * остаются записи, которых в кабинете уже нет.
 */
router.post("/purge", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, all } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    // Очистить всю корзину разом — иначе сотни пробных заявок придётся
    // стирать по одной.
    if (all === true) {
      const snap = await db().collection(SUBS)
        .where("tenantId", "==", tenantId).where("deleted", "==", true).limit(500).get();

      let purged = 0;
      for (const d of snap.docs) {
        const sub = d.data();
        const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
        if (formSnap.exists) {
          await clearSheetRow({ ...formSnap.data(), id: formSnap.id }, String(sub.qrToken || ""));
        }
        await d.ref.delete();
        purged++;
      }
      return res.json({ success: true, purged });
    }

    if (!submissionId) return res.status(400).json({ success: false, error: "Bad request" });
    const ref = db().collection(SUBS).doc(String(submissionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Заявка не найдена" });

    const sub = snap.data()!;
    if (sub.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Заявка другой организации" });
    }
    // Только из корзины: стереть то, что на виду, одним нажатием нельзя.
    if (sub.deleted !== true) {
      return res.status(409).json({
        success: false,
        error: "Сначала уберите заявку в корзину — оттуда её можно стереть насовсем.",
      });
    }

    const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
    if (formSnap.exists) {
      await clearSheetRow({ ...formSnap.data(), id: formSnap.id }, String(sub.qrToken || ""));
    }
    await ref.delete();
    return res.json({ success: true, purged: 1 });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Привести значение к типу поля анкеты.
 *
 * Правка из кабинета обязана соблюдать ту же анкету, что и подача:
 * в списке — только его варианты, в галочке — да или нет, в дате — дата.
 * Иначе выгрузка и фильтры начинают находить «tru» и «Бишкек » рядом с
 * «true» и «Бишкек».
 */
// Плоский тип, а не размеченное объединение: проект собирается без
// strictNullChecks, и `if (!c.ok)` там не сужает тип (как и у TenantGate).
interface Coerced { ok: boolean; value?: any; error?: string }

function coerceFieldValue(f: any, raw: unknown): Coerced {
  const label = String(f?.label || f?.id || "поле");
  switch (f?.type) {
    case "file":
      return { ok: false, error: `«${label}» — файл, его правят только повторной подачей.` };
    case "checkbox":
      return { ok: true, value: raw === true || String(raw).toLowerCase() === "true" };
    case "select": {
      const v = str(raw, 500);
      const options: string[] = Array.isArray(f.options) ? f.options.map(String) : [];
      if (v && !options.includes(v)) return { ok: false, error: `В «${label}» нет варианта «${v}».` };
      return { ok: true, value: v };
    }
    case "date": {
      const v = str(raw, 20);
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `«${label}» — нужна дата.` };
      return { ok: true, value: v };
    }
    case "email": {
      const v = str(raw, 200).replace(/\s+/g, "").toLowerCase();
      if (v && !EMAIL_RE.test(v)) return { ok: false, error: `«${label}» — проверьте адрес почты.` };
      return { ok: true, value: v };
    }
    case "number": {
      const v = str(raw, 50).replace(",", ".");
      if (v && !Number.isFinite(Number(v))) return { ok: false, error: `«${label}» — нужно число.` };
      return { ok: true, value: v };
    }
    default:
      return { ok: true, value: str(raw, 2000) };
  }
}

/** Имя, телефон и почта заявки — из полей анкеты, как при подаче. */
function deriveContacts(fields: any[], data: Record<string, any>) {
  const pick = (re: RegExp) => {
    const f = fields.find((x: any) => re.test(String(x.label || "")) || re.test(String(x.id || "")));
    return f ? str(data?.[f.id], 200) : undefined;
  };
  return {
    applicantName: pick(/фамили|имя|фио|name/i),
    applicantPhone: pick(/телефон|phone|моб/i),
    applicantEmail: (() => { const f = fields.find((x: any) => x.type === "email" && String(data?.[x.id] || "").includes("@")); return f ? str(data[f.id], 200) : pick(/e-?mail|почт/i); })(),
  };
}

const sameValue = (a: unknown, b: unknown) =>
  typeof a === "boolean" || typeof b === "boolean" ? Boolean(a) === Boolean(b) : String(a ?? "") === String(b ?? "");

/** Запись в журнал правок — кто, когда, что было и что стало. */
const changeEntry = (by: string, f: any, from: unknown, to: unknown) => ({
  at: admin.firestore.Timestamp.now(),
  by,
  kind: "field",
  field: String(f.id),
  label: String(f.label || f.id),
  from: from === undefined ? "" : from,
  to,
});

/**
 * POST /api/forms/edit — исправить ответы в одной заявке.
 *
 * Бывает, что человек ошибся в телефоне или выбрал не тот формат, и
 * подавать заново ради одной опечатки — значит плодить дубли. Каждая
 * правка пишется в журнал «было → стало» с автором и временем: заявку
 * заполнял живой человек, и потом должно быть видно, что в ней меняли
 * сотрудники, а что он написал сам.
 *
 * Журнал — отдельное поле changes, не history: history видит заявитель на
 * странице отслеживания, а внутренние правки ему не адресованы.
 */
/**
 * Раскрыть короткую ссылку Canva (canva.link/…) до адреса дизайна, чтобы
 * кабинет мог показать презентацию внутри себя: браузер сам редирект
 * прочитать не может (CORS). Ходим ТОЛЬКО на canva.link и отдаём ответ
 * ТОЛЬКО если он ведёт на www.canva.com — иначе это был бы открытый прокси
 * на любые адреса, включая внутренние.
 */
router.post("/resolve-link", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  let url: URL;
  try { url = new URL(String(req.body?.url || "")); } catch { return res.status(400).json({ success: false, error: "Неверная ссылка" }); }
  if (url.protocol !== "https:" || url.hostname !== "canva.link") {
    return res.status(400).json({ success: false, error: "Раскрываются только ссылки canva.link" });
  }
  try {
    const r = await fetch(url.toString(), { redirect: "manual", signal: AbortSignal.timeout(6000) });
    const loc = r.headers.get("location") || "";
    const target = new URL(loc, url);
    if (target.protocol !== "https:" || target.hostname !== "www.canva.com") {
      return res.status(422).json({ success: false, error: "Ссылка ведёт не на Canva" });
    }
    return res.json({ success: true, url: target.toString() });
  } catch {
    return res.status(502).json({ success: false, error: "Canva не ответила" });
  }
});

router.post("/edit", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, data } = req.body || {};
    if (!tenantId || !submissionId || !data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ success: false, error: "Bad request" });
    }
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const ref = db().collection(SUBS).doc(String(submissionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Заявка не найдена" });
    const sub = snap.data()!;
    if (sub.tenantId !== tenantId) return res.status(403).json({ success: false, error: "Заявка другой организации" });

    const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
    if (!formSnap.exists) return res.status(404).json({ success: false, error: "Анкета этой заявки удалена" });
    const form = { ...formSnap.data(), id: formSnap.id } as any;
    const fields: any[] = Array.isArray(form.fields) ? form.fields : [];

    const by = req.user?.email || req.user?.uid || "";
    const merged: Record<string, any> = { ...(sub.data || {}) };
    const entries: any[] = [];
    for (const [fieldId, raw] of Object.entries(data as Record<string, unknown>)) {
      const f = fields.find((x: any) => String(x.id) === fieldId);
      if (!f) return res.status(400).json({ success: false, error: `В анкете нет поля «${fieldId}».` });
      const c = coerceFieldValue(f, raw);
      if (!c.ok) return res.status(400).json({ success: false, error: c.error });
      if (sameValue(merged[fieldId], c.value)) continue;
      entries.push(changeEntry(by, f, merged[fieldId], c.value));
      merged[fieldId] = c.value;
    }
    if (!entries.length) return res.json({ success: true, changed: 0 });

    const contacts = deriveContacts(fields, merged);
    const patch: Record<string, any> = {
      data: merged,
      updatedAt: admin.firestore.Timestamp.now(),
      changes: admin.firestore.FieldValue.arrayUnion(...entries),
    };
    for (const [k, v] of Object.entries(contacts)) if (v !== undefined) patch[k] = v;
    await ref.update(patch);

    await settle(upsertSheetRows(form, [{ ...sub, ...patch, data: merged }]));
    return res.json({ success: true, changed: entries.length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/bulk — одно действие сразу над многими заявками.
 *
 *   action: "status" — сменить статус (и при желании оставить заявителям
 *           один и тот же ответ, он появится у каждого на странице заявки);
 *   action: "field"  — поставить одно значение в одно поле.
 *
 * Заявки, к которым действие неприменимо, не роняют всю пачку: их
 * пропускаем и возвращаем список с причиной — «Гость пришёл» нельзя
 * поставить заявке на поступление, а поля «Команда» нет у заявок другой
 * анкеты.
 *
 * Пишем пачками по 400 документов, а таблицу каждой анкеты обновляем
 * одной записью — построчно сотня заявок упёрлась бы в лимит частоты
 * записи одного документа.
 */
router.post("/bulk", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionIds, action, status, note, fieldId, value } = req.body || {};
    if (!tenantId || !Array.isArray(submissionIds) || !submissionIds.length) {
      return res.status(400).json({ success: false, error: "Не выбрано ни одной заявки" });
    }
    const ids = [...new Set(submissionIds.map((x: unknown) => str(x, 200)).filter(Boolean))] as string[];
    if (ids.length > 500) return res.status(400).json({ success: false, error: "За раз — не больше 500 заявок" });
    if (action !== "status" && action !== "field") return res.status(400).json({ success: false, error: "Неизвестное действие" });
    if (action === "status" && !(typeof status === "string" && DECISION_ID.test(status))) return res.status(400).json({ success: false, error: "Неизвестный статус" });
    if (action === "field" && !fieldId) return res.status(400).json({ success: false, error: "Не выбрано поле" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const by = req.user?.email || req.user?.uid || "";
    const now = admin.firestore.Timestamp.now();
    const forms = new Map<string, any>();
    const loadForm = async (id: string) => {
      if (!forms.has(id)) {
        const f = await db().collection(FORMS).doc(id).get();
        forms.set(id, f.exists ? { ...f.data(), id: f.id } : null);
      }
      return forms.get(id);
    };

    const skipped: Array<{ id: string; name: string; reason: string }> = [];
    const updates: Array<{ ref: any; patch: Record<string, any>; after: Record<string, any>; formId: string }> = [];

    for (let i = 0; i < ids.length; i += 100) {
      const snaps = await db().getAll(...ids.slice(i, i + 100).map(id => db().collection(SUBS).doc(id)));
      for (const snap of snaps) {
        const sub: any = snap.data();
        const name = String(sub?.applicantName || "без имени");
        if (!snap.exists || sub.tenantId !== tenantId) { skipped.push({ id: snap.id, name, reason: "Заявка не найдена" }); continue; }
        const form = await loadForm(String(sub.formId || ""));
        if (!form) { skipped.push({ id: snap.id, name, reason: "Анкета удалена" }); continue; }

        if (action === "status") {
          if (!resolveDecisions(form).some(d => d.id === status)) {
            skipped.push({ id: snap.id, name, reason: `Состояния «${status}» нет у анкеты «${form.title || ""}»` });
            continue;
          }
          if (sub.status === status && !str(note, 300)) { skipped.push({ id: snap.id, name, reason: "Уже в этом статусе" }); continue; }
          const patch = {
            status, updatedAt: now,
            history: admin.firestore.FieldValue.arrayUnion({ status, at: now, by, note: str(note, 300) }),
          };
          updates.push({ ref: snap.ref, patch, after: { ...sub, status }, formId: form.id });
        } else {
          const fields: any[] = Array.isArray(form.fields) ? form.fields : [];
          const f = fields.find((x: any) => String(x.id) === String(fieldId));
          if (!f) { skipped.push({ id: snap.id, name, reason: `В анкете «${form.title || ""}» нет этого поля` }); continue; }
          const c = coerceFieldValue(f, value);
          if (!c.ok) return res.status(400).json({ success: false, error: c.error });
          if (sameValue(sub.data?.[f.id], c.value)) { skipped.push({ id: snap.id, name, reason: "Значение уже такое" }); continue; }
          const merged = { ...(sub.data || {}), [f.id]: c.value };
          const patch: Record<string, any> = {
            data: merged, updatedAt: now,
            changes: admin.firestore.FieldValue.arrayUnion(changeEntry(by, f, sub.data?.[f.id], c.value)),
          };
          for (const [k, v] of Object.entries(deriveContacts(fields, merged))) if (v !== undefined) patch[k] = v;
          updates.push({ ref: snap.ref, patch, after: { ...sub, ...patch, data: merged }, formId: form.id });
        }
      }
    }

    for (let i = 0; i < updates.length; i += 400) {
      const batch = db().batch();
      updates.slice(i, i + 400).forEach(u => batch.update(u.ref, u.patch));
      await batch.commit();
    }

    // Таблицы — по одной записи на анкету.
    const byForm = new Map<string, any[]>();
    updates.forEach(u => byForm.set(u.formId, [...(byForm.get(u.formId) || []), u.after]));
    await settle(Promise.all([...byForm.entries()].map(([fid, subs]) => upsertSheetRows(forms.get(fid), subs))), 8000);

    // Письма по состоянию: «через N минут» и «в заданное время» ставятся здесь,
    // «вручную» — клиент спросит подтверждение одной фразой на всех.
    const confirmIds: string[] = [];
    let confirmLabel = "";
    if (action === "status") {
      await settle(Promise.all(updates.slice(0, 200).map(async u => {
        const plan = await afterStatusChange({ tenantId, submissionId: u.ref.id, form: forms.get(u.formId), statusId: status, by: byOf(req) }).catch(() => null);
        if (plan?.needConfirm) { confirmIds.push(u.ref.id); confirmLabel = plan.label || ""; }
      })), 8000);
    }
    return res.json({ success: true, updated: updates.length, skipped, ...(confirmIds.length ? { needConfirm: { ids: confirmIds, label: confirmLabel } } : {}) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/delete — убрать заявку из списка или вернуть обратно.
 *
 * В корзину, а не насовсем: заявку заполнял живой человек, и восстановить
 * её иначе нечем — повторно он её не подаст. Случайное нажатие в таблице
 * из сотни строк иначе стоило бы потерянного участника.
 *
 * Сама запись остаётся в базе с пометкой, кто и когда убрал: спор «я
 * подавал заявку, а меня нет» разбирается по ней.
 */
router.post("/delete", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, restore } = req.body || {};
    if (!tenantId || !submissionId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const ref = db().collection(SUBS).doc(String(submissionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Заявка не найдена" });
    if (snap.data()!.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Заявка другой организации" });
    }

    const now = admin.firestore.Timestamp.now();
    const by = req.user?.email || req.user?.uid || "";
    const sub = snap.data()!;
    const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
    const form = formSnap.exists ? { ...formSnap.data(), id: formSnap.id } : null;

    if (restore === true) {
      await ref.update({
        deleted: admin.firestore.FieldValue.delete(),
        deletedAt: admin.firestore.FieldValue.delete(),
        deletedBy: admin.firestore.FieldValue.delete(),
        updatedAt: now,
      });
      // Возвращённая заявка снова попадает в таблицу: из корзины она
      // выходит в общий список, и таблица должна это показывать.
      if (form) await settle(appendToSheet(form, String(sub.formId || ""), sub));
      return res.json({ success: true, restored: true });
    }

    await ref.update({ deleted: true, deletedAt: now, deletedBy: by, updatedAt: now });
    // Убранная заявка не должна оставаться в таблице рядом с действующими:
    // она в корзине, и в выгрузке ей не место.
    if (form) await settle(clearSheetRow(form, String(sub.qrToken || "")));
    return res.json({ success: true, deleted: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/form-state — закрыть/открыть приём, в архив, вернуть, стереть форму.
 * Стереть можно только форму из архива и без заявок; всё пишется в журнал.
 */
router.post("/form-state", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, formId, action } = req.body || {};
    if (!tenantId || !formId || !["close", "open", "archive", "restore", "purge"].includes(String(action))) {
      return res.status(400).json({ success: false, error: "Bad request" });
    }
    if (!(await canManageForms(req.user, String(tenantId)))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection(FORMS).doc(String(formId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Форма не найдена" });
    }
    const form = snap.data()!;
    const now = admin.firestore.Timestamp.now();
    const by = req.user?.email || req.user?.uid || "";
    let detail = "";
    if (action === "close") {
      await ref.update({ active: false, updatedAt: now });
      detail = "приём закрыт";
    } else if (action === "open") {
      if (form.archived) return res.status(400).json({ success: false, error: "Форма в архиве — сначала верните её" });
      await ref.update({ active: true, updatedAt: now });
      detail = "приём открыт";
    } else if (action === "archive") {
      await ref.update({ archived: true, archivedAt: now, archivedBy: by, active: false, updatedAt: now });
      detail = "в архив";
    } else if (action === "restore") {
      await ref.update({ archived: admin.firestore.FieldValue.delete(), archivedAt: admin.firestore.FieldValue.delete(), archivedBy: admin.firestore.FieldValue.delete(), updatedAt: now });
      detail = "возвращена из архива";
    } else {
      if (!form.archived) return res.status(400).json({ success: false, error: "Стереть можно только форму из архива" });
      const any = await db().collection(SUBS).where("formId", "==", String(formId)).limit(1).get();
      if (!any.empty) return res.status(409).json({ success: false, error: "У формы есть заявки — стереть её нельзя, оставьте в архиве" });
      await ref.delete();
      detail = "стёрта насовсем";
    }
    await writeAudit(db(), String(tenantId), {
      actor: actorOf(req.user), action: `form.${action}`, section: "data",
      target: { kind: "form", id: String(formId), name: String(form.title || "") }, detail,
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/sheet — запомнить таблицу, в которую форма выгружает ответы.
 *
 * Таблица привязывается к форме, чтобы повторный перенос обновлял ту же
 * самую, а не плодил новые с одинаковым названием.
 */
router.post("/sheet", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, formId, sheetId } = req.body || {};
    if (!tenantId || !formId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManageForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const ref = db().collection(FORMS).doc(String(formId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Форма не найдена" });
    }

    const id = str(sheetId, 200);
    await ref.update({
      sheetId: id || admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return res.json({ success: true, sheetId: id || null });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/forms/stats — сводка по заявкам, по каждой форме отдельно.
 *
 * Это то, ради чего конструктор и нужен: сколько заявок пришло по каждой
 * форме, в каких они статусах, сколько новых и как быстро их обрабатывают.
 */
router.get("/stats", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!tenantId) return res.status(400).json({ success: false, error: "Нужен tenantId" });
    if (!(await canViewForms(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }

    const [formsSnap, subsSnap] = await Promise.all([
      db().collection(FORMS).where("tenantId", "==", tenantId).get(),
      db().collection(SUBS).where("tenantId", "==", tenantId).get(),
    ]);

    const subs = subsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const ms = (t: any) => t?.toMillis?.() ?? (t?._seconds ? t._seconds * 1000 : 0);
    const DAY = 86400000;
    const now = Date.now();

    const perForm = formsSnap.docs.map(d => {
      const f = d.data();
      const mine = subs.filter(s => s.formId === d.id);
      const decs = resolveDecisions(f);
      const byStatus: Record<string, number> = {};
      for (const st of STATUSES) byStatus[st] = mine.filter(s => kindOfStatus(decs, s.status) === st).length;

      // Среднее время до первого решения: сколько заявка ждала, прежде чем
      // её сдвинули с «новой». Пока никто не сдвинул — не считаем.
      const decided = mine
        .map(s => {
          const moved = (Array.isArray(s.history) ? s.history : []).find((h: any) => kindOfStatus(decs, h.status) !== "new");
          return moved ? ms(moved.at) - ms(s.createdAt) : null;
        })
        .filter((n): n is number => typeof n === "number" && n > 0);

      return {
        id: d.id,
        title: f.title || "Без названия",
        active: f.active !== false,
        qrTrackingEnabled: f.qrTrackingEnabled !== false,
        fields: Array.isArray(f.fields) ? f.fields.length : 0,
        total: mine.length,
        byStatus,
        pending: byStatus.new + byStatus.review,
        last7: mine.filter(s => now - ms(s.createdAt) < 7 * DAY).length,
        lastAt: mine.length ? Math.max(...mine.map(s => ms(s.createdAt))) : null,
        avgDecisionHours: decided.length
          ? Math.round((decided.reduce((a, b) => a + b, 0) / decided.length) / 3600000 * 10) / 10
          : null,
        // Конверсия: доля дошедших до одобрения среди уже решённых.
        conversion: (() => {
          const closed = byStatus.approved + byStatus.rejected;
          return closed ? Math.round((byStatus.approved / closed) * 100) : null;
        })(),
      };
    }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

    const byStatusAll: Record<string, number> = {};
    const decsOf = new Map(formsSnap.docs.map(d => [d.id, resolveDecisions(d.data())] as const));
    for (const st of STATUSES) byStatusAll[st] = subs.filter(s => kindOfStatus(decsOf.get(s.formId) || resolveDecisions(null), s.status) === st).length;

    return res.json({
      success: true,
      totals: {
        forms: formsSnap.size,
        submissions: subs.length,
        pending: byStatusAll.new + byStatusAll.review,
        last7: subs.filter(s => now - ms(s.createdAt) < 7 * DAY).length,
        byStatus: byStatusAll,
      },
      forms: perForm,
      statuses: STATUSES.map(s => ({ key: s, label: STATUS_LABEL[s] })),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
