import { Router } from "express";
import admin from "firebase-admin";
import crypto from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import {
  FORM_STATUSES, STATUS_LABEL, MODE_STATUSES, TICKET_ACTIVE,
  isFormStatus, type FormStatus, type FormMode,
} from "../shared/formStatuses.js";
import { hasAnyPermission } from "../server/access.js";
import { checkTenantOpen, requireScreen, loadTenant } from "../server/tenantAccess.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";

/** Что о организации можно показать заявителю: название, брендинг, тексты билетов. */
function publicOrg(t: any) {
  if (!t) return null;
  const b = t.branding && typeof t.branding === "object" ? t.branding : {};
  return {
    id: t.id, name: String(t.name || ""),
    logoUrl: b.logoUrl || null, primaryColor: b.primaryColor || null,
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
 * Дописать заявку строкой в таблицу формы.
 *
 * Пишем на сервере, а не в кабинете: заявка приходит, когда кабинет может
 * быть ни у кого не открыт, и строка всё равно должна появиться.
 *
 * Только ДОПИСЫВАЕМ вниз, ничего не перезаписывая: в таблице люди ведут
 * свои пометки в соседних колонках, и перестройка листа стирала бы их
 * работу при каждой новой заявке.
 *
 * Ошибку глотаем: таблица — удобство, а падение записи в неё не должно
 * оборачиваться для человека отказом в приёме заявки.
 */
async function appendToSheet(form: any, formId: string, submission: Record<string, any>): Promise<void> {
  try {
    const tenantId = String(form?.tenantId || "");
    const sheetId = String(form?.sheetId || "");
    if (!tenantId || !sheetId) return;

    const sheetRef = db().collection("tenants").doc(tenantId).collection("workspace_sheets").doc(sheetId);
    const snap = await sheetRef.get();
    if (!snap.exists) return;

    const sheet = snap.data() || {};
    const cells: Record<string, any> = sheet.cells || {};

    // Куда писать: сразу под последней занятой строкой. Так строка встаёт
    // в конец даже если кто-то дописывал свои строки руками.
    let lastRow = 1;
    for (const key of Object.keys(cells)) {
      const row = Number((key.match(/\d+$/) || [])[0]);
      if (Number.isFinite(row) && row > lastRow) lastRow = row;
    }
    const targetRow = lastRow + 1;

    const fields: any[] = (Array.isArray(form.fields) ? form.fields : []).filter((f: any) => f.type !== "file");
    const values = [
      new Date().toLocaleString("ru-RU"),
      String(submission.applicantName || ""),
      String(submission.applicantPhone || ""),
      String(submission.applicantEmail || ""),
      STATUS_LABEL[(submission.status || "new") as Status] || "",
      String(submission.qrToken || ""),
    ].concat(fields.map((f: any) => String(submission.data?.[f.id] ?? "")));

    const patch: Record<string, any> = {
      updatedAt: Date.now(),
      rowsCount: Math.max(Number(sheet.rowsCount) || 100, targetRow + 10),
    };
    // Пустой ответ записываем пустой ячейкой, а не пропускаем: пропуск
    // оставлял в этом месте то, что лежало там раньше, и строка выглядела
    // собранной из разных заявок.
    values.forEach((value, i) => {
      patch[`cells.${columnName(i)}${targetRow}`] = { rawValue: value, computedValue: value };
    });
    await sheetRef.update(patch);
  } catch (e: any) {
    console.warn("[Forms/Sheet] Не удалось дописать заявку в таблицу:", e.message);
  }
}

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
        const status: Status = STATUSES.includes(sub.status) ? sub.status : "new";

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
          code: sub.qrToken || d.id,
          createdAt: sub.createdAt || null,
          status,
          statusLabel: STATUS_LABEL[status],
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
    const resolved = alive.filter(d => ["approved", "paid", "checked_in"].includes(String(d.data().status || "")));

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
    for (const f of fields) {
      const raw = (data as any)[f.id];
      let value: any;
      if (f.type === "checkbox") {
        value = Boolean(raw);
      } else if (f.type === "file") {
        // Файл приходит сжатым data-URL с клиента.
        value = String(raw ?? "");
        if (value && !value.startsWith("data:image/")) {
          return res.status(400).json({
            success: false,
            error: `Поле «${f.label}» принимает только изображение (JPG/PNG).`,
          });
        }
        if (value.length > 400 * 1024) {
          return res.status(413).json({
            success: false,
            error: `Файл в поле «${f.label}» слишком большой. Сфотографируйте документ ещё раз.`,
          });
        }
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

    // Включаем поддержку сырых ключей для внешних запросов API, если data передана словарем
    if (typeof data === "object") {
      Object.keys(data).forEach(k => {
        if (!clean[k]) clean[k] = data[k];
      });
    }

    if (JSON.stringify(clean).length > 700 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Заявка слишком большая — уменьшите приложенные файлы.",
      });
    }

    // Имя, телефон, почта и специфические поля StudyFree (включая прямое соответствие ID)
    const pick = (re: RegExp, exactId?: string) => {
      if (exactId && clean[exactId] !== undefined && String(clean[exactId]).trim()) {
        return str(clean[exactId], 500);
      }
      const f = fields.find(x => re.test(String(x.label || "")) || re.test(String(x.id || "")));
      return f ? str(clean[f.id], 500) : "";
    };

    const applicantName = pick(/фамили|имя|фио|name/i, "field_1790767291933");
    const applicantPhone = pick(/телефон|phone|моб/i, "field_1790768013294");
    const applicantEmail = pick(/e-?mail|почт/i, "field_1790767998828");
    const participationFormat = pick(/формат|format/i, "field_1790768170123");
    const teamName = pick(/название команды|team name/i, "field_1790768063759");
    const teamCode = pick(/код команды|team code/i, "field_1790768090009");
    const teamPassword = pick(/пароль команды|team password/i, "field_1790768091708");
    const presentationUrl = pick(/презентаци|presentation/i, "field_1790940529090");

    // ПРОВЕРКА RE-SUBMISSION / UPDATE ПО TOKEN, CODE, QRTOKEN ИЛИ UPSERT_BY
    const upsertObj = req.body.upsert_by || req.body.upsertBy;
    const inputToken = str(
      req.body.token || req.body.code || req.body.qrToken || req.body.submissionId ||
      data?.token || data?.code || data?.qrToken, 100
    );

    let existingDocSnap: any = null;

    if (inputToken) {
      // Ищем существующую заявку по qrToken или по ID документа
      const byTokenSnap = await db().collection(SUBS)
        .where("formId", "==", String(formId))
        .where("qrToken", "==", inputToken)
        .limit(1).get();

      if (!byTokenSnap.empty) {
        existingDocSnap = byTokenSnap.docs[0];
      } else {
        const byIdSnap = await db().collection(SUBS).doc(inputToken).get();
        if (byIdSnap.exists) {
          existingDocSnap = byIdSnap;
        }
      }
    }

    if (!existingDocSnap && upsertObj && upsertObj.value) {
      const upsertField = str(upsertObj.field_id || upsertObj.fieldId, 200);
      const upsertVal = str(upsertObj.value, 500).toLowerCase();
      const cleanUpsertVal = upsertVal.replace(/[^a-z0-9а-яё]/gi, "");

      const allSubSnap = await db().collection(SUBS).where("formId", "==", String(formId)).limit(500).get();
      for (const d of allSubSnap.docs) {
        const subData = d.data();
        if (subData.deleted) continue;
        const dataMap = subData.data || {};

        const checkMatch = (val: any) => {
          if (!val) return false;
          const s = String(val).trim().toLowerCase();
          const cleanS = s.replace(/[^a-z0-9а-яё]/gi, "");
          return s === upsertVal || (cleanUpsertVal && cleanS === cleanUpsertVal);
        };

        if (upsertField) {
          if (checkMatch(dataMap[upsertField]) || checkMatch(subData[upsertField])) {
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
        void appendToSheet(form, String(formId), {
          applicantName: applicantName || existingData.applicantName,
          applicantPhone: applicantPhone || existingData.applicantPhone,
          applicantEmail: applicantEmail || existingData.applicantEmail,
          status: existingData.status || "new",
          qrToken: existingData.qrToken,
          data: mergedData,
        });

        return res.json({
          success: true,
          updated: true,
          qrToken: existingData.qrToken,
          trackUrl: `/track/${existingData.qrToken}`,
          mode: formMode(form),
          message: "Заявка успешно обновлена!",
        });
      }

    // Если токена нет или документа не нашлось — создаём новую запись
    const qrToken = makeToken();
    const ref = db().collection(SUBS).doc();
    await ref.set({
      tenantId: form.tenantId || "",
      formId: String(formId),
      formTitle: form.title || "Заявка",
      qrToken,
      applicantName, applicantPhone, applicantEmail,
      participationFormat, teamName, teamCode, teamPassword, presentationUrl,
      status: "new" as Status,
      data: clean,
      history: [{ status: "new", at: admin.firestore.Timestamp.now(), by: "" }],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    void appendToSheet(form, String(formId), {
      applicantName, applicantPhone, applicantEmail,
      status: "new", qrToken, data: clean,
    });

    return res.json({
      success: true,
      updated: false,
      qrToken,
      trackUrl: `/track/${qrToken}`,
      mode: formMode(form),
      message: "Заявка принята.",
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
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

/**
 * POST /api/forms/submissions/search — Универсальный поиск заявок
 */
router.post("/submissions/search", async (req: any, res: any) => {
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
            sub.teamName, sub.teamCode, sub.teamPassword, sub.qrToken, sub.participationFormat, sub.presentationUrl
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
      const status: Status = STATUSES.includes(sub.status) ? sub.status : "new";
      return {
        id: d.id,
        submission_id: d.id,
        code: sub.qrToken || d.id,
        qrToken: sub.qrToken || d.id,
        form_id: sub.formId,
        tenant_id: sub.tenantId,
        status,
        status_label: STATUS_LABEL[status] || status,
        applicant_name: sub.applicantName || "",
        applicant_email: sub.applicantEmail || "",
        applicant_phone: sub.applicantPhone || "",
        team_name: sub.teamName || "",
        team_code: sub.teamCode || "",
        team_password: sub.teamPassword || "",
        participation_format: sub.participationFormat || "",
        presentation_url: sub.presentationUrl || "",
        data: sub.data || {},
        history: sub.history || [],
        created_at: sub.createdAt || null,
        updated_at: sub.updatedAt || null,
      };
    });

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
 * POST /api/forms/submissions/upsert — Универсальное создание или обновление заявки
 */
router.post("/submissions/upsert", async (req: any, res: any) => {
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
      if (raw !== undefined) {
        clean[f.id] = f.type === "checkbox" ? Boolean(raw) : str(raw, 2000);
      }
    }
    Object.keys(inputData).forEach(k => {
      if (clean[k] === undefined) clean[k] = inputData[k];
    });

    const pick = (re: RegExp, exactId?: string) => {
      if (exactId && clean[exactId] !== undefined && String(clean[exactId]).trim()) {
        return str(clean[exactId], 500);
      }
      const f = fields.find(x => re.test(String(x.label || "")) || re.test(String(x.id || "")));
      return f ? str(clean[f.id], 500) : "";
    };

    const applicantName = pick(/фамили|имя|фио|name/i, "field_1790767291933") || str(req.body.applicantName || req.body.applicant_name, 500);
    const applicantPhone = pick(/телефон|phone|моб/i, "field_1790768013294") || str(req.body.applicantPhone || req.body.applicant_phone, 500);
    const applicantEmail = pick(/e-?mail|почт/i, "field_1790767998828") || str(req.body.applicantEmail || req.body.applicant_email, 500);
    const participationFormat = pick(/формат|format/i, "field_1790768170123") || str(req.body.participationFormat || req.body.participation_format, 500);
    const teamName = pick(/название команды|team name/i, "field_1790768063759") || str(req.body.teamName || req.body.team_name, 500);
    const teamCode = pick(/код команды|team code/i, "field_1790768090009") || str(req.body.teamCode || req.body.team_code, 500);
    const teamPassword = pick(/пароль команды|team password/i, "field_1790768091708") || str(req.body.teamPassword || req.body.team_password, 500);
    const presentationUrl = pick(/презентаци|presentation/i, "field_1790940529090") || str(req.body.presentationUrl || req.body.presentation_url, 500);

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

    const validStatus = STATUSES.includes(newStatus) ? newStatus : undefined;

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

      void appendToSheet(form, formId, {
        applicantName: updatePayload.applicantName,
        applicantPhone: updatePayload.applicantPhone,
        applicantEmail: updatePayload.applicantEmail,
        status: validStatus || existingData.status || "new",
        qrToken: existingData.qrToken,
        data: mergedData,
      });

      return res.json({
        success: true,
        action: "updated",
        submission_id: existingDocSnap.id,
        code: existingData.qrToken || existingDocSnap.id,
        qrToken: existingData.qrToken || existingDocSnap.id,
        data: mergedData,
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

    void appendToSheet(form, formId, {
      applicantName, applicantPhone, applicantEmail,
      status: validStatus || "new", qrToken: qrTokenVal, data: clean,
    });

    return res.json({
      success: true,
      action: "created",
      submission_id: newRef.id,
      code: qrTokenVal,
      qrToken: qrTokenVal,
      data: clean,
      message: "Заявка успешно создана",
    });

  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/forms/team/check — Поиск и проверка пароля команды
 */
router.post("/team/check", async (req: any, res: any) => {
  try {
    const formId = str(req.body.formId || req.body.form_id, 200);
    const code = str(req.body.code, 200);
    const password = str(req.body.password, 200);

    if (!formId || !code) {
      return res.status(400).json({ success: false, error: "Параметры formId и code обязательны" });
    }

    const cleanCode = code.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");

    const snap = await db().collection(SUBS)
      .where("formId", "==", formId)
      .limit(500)
      .get();

    const matchedDoc = snap.docs.find(d => {
      const s = d.data();
      if (s.deleted) return false;
      const c1 = String(s.teamCode || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      const c2 = String(s.qrToken || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      const c3 = String(s.data?.field_1790768090009 || "").toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
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
    const storedPassword = String(sub.teamPassword || sub.data?.field_1790768091708 || "").trim();

    let passwordMatches: boolean | undefined = undefined;
    if (password) {
      passwordMatches = storedPassword === password.trim();
    }

    return res.json({
      success: true,
      found: true,
      submissionId: matchedDoc.id,
      code: sub.qrToken || sub.teamCode || matchedDoc.id,
      teamName: sub.teamName || sub.data?.field_1790768063759 || "",
      participationFormat: sub.participationFormat || sub.data?.field_1790768170123 || "",
      status: sub.status || "new",
      passwordMatches,
      data: sub.data || {},
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PATCH /api/forms/submissions/:submission_id — Частичное обновление заявки
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
      void appendToSheet(form, String(formId), {
        applicantName: existingData.applicantName,
        applicantPhone: existingData.applicantPhone,
        applicantEmail: existingData.applicantEmail,
        status: existingData.status || "new",
        qrToken: existingData.qrToken,
        data: mergedFields,
      });
    }

    return res.json({
      success: true,
      submission_id: docSnap.id,
      updated_at: new Date().toISOString(),
      fields: mergedFields,
      data: mergedFields,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR", message: e.message });
  }
};

router.patch("/submissions/:submission_id", patchSubmissionHandler);
router.post("/submissions/:submission_id/update", patchSubmissionHandler);

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
    if (!doc0) {
      return res.status(404).json({ success: false, error: "Заявка по этому коду не найдена." });
    }

    const s = doc0.data();
    const status: Status = STATUSES.includes(s.status) ? s.status : "new";

    // Режим формы нужен трекеру: в билетном режиме страница показывает
    // QR-билет — но только когда заявка одобрена. До того билета нет.
    const formSnap = s.formId ? await db().collection(FORMS).doc(String(s.formId)).get() : null;
    const mode = formMode(formSnap?.exists ? formSnap.data() : null);

    const org = publicOrg(await loadTenant(String(s.tenantId || "")));
    return res.json({
      success: true,
      org,
      submission: {
        code: s.qrToken || doc0.id,
        formId: s.formId || "",
        formTitle: s.formTitle || "Заявка",
        applicantName: s.applicantName || "",
        status,
        statusLabel: STATUS_LABEL[status],
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
          label: STATUS_LABEL[h.status as Status] || h.status,
          at: h.at || null,
          note: String(h.note || ""),
        })),
      },
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
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, error: "Нужен код билета" });

    const byToken = await db().collection(SUBS).where("qrToken", "==", String(token).trim().toUpperCase()).limit(1).get();
    if (byToken.empty) {
      return res.status(404).json({ success: false, error: "Билет не найден" });
    }
    const subRef = byToken.docs[0].ref;
    const sub = byToken.docs[0].data();

    // Организация должна быть активна, а раздел билетов — не закрыт платформой.
    const gate = await checkTenantOpen(sub.tenantId, req.user?.isSuperadmin ? undefined : "tickets");
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    if (!(await canCheckTickets(req.user, String(sub.tenantId || "")))) {
      return res.status(403).json({ success: false, error: "Нет доступа к билетам этой организации" });
    }

    const formSnap = await db().collection(FORMS).doc(String(sub.formId || "")).get();
    const form = formSnap.exists ? formSnap.data()! : null;
    const guestName = sub.applicantName || "Без имени";
    if (!form || formMode(form) !== "ticket") {
      return res.json({ success: true, result: "notticket", guest: { name: guestName } });
    }

    const outcome = await db().runTransaction(async tx => {
      const fresh = await tx.get(subRef);
      const cur = fresh.data()!;
      const curStatus: Status = isFormStatus(cur.status) ? cur.status : "new";
      if (curStatus === "checked_in") {
        return { result: "already" as const, status: curStatus, checkedInAt: cur.checkedInAt || null };
      }
      if (!TICKET_ACTIVE.includes(curStatus)) {
        return { result: "inactive" as const, status: curStatus };
      }
      const now = admin.firestore.Timestamp.now();
      tx.update(subRef, {
        status: "checked_in",
        checkedInAt: now,
        updatedAt: now,
        history: admin.firestore.FieldValue.arrayUnion({
          status: "checked_in", at: now,
          by: req.user?.email || req.user?.uid || "scanner", note: "",
        }),
      });
      return { result: "ok" as const, status: "checked_in" as Status, checkedInAt: now };
    });

    return res.json({
      success: true,
      result: outcome.result,
      guest: {
        name: guestName,
        status: outcome.status,
        statusLabel: STATUS_LABEL[outcome.status],
        checkedInAt: "checkedInAt" in outcome ? outcome.checkedInAt : null,
      },
      formTitle: sub.formTitle || "",
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
  return hasAnyPermission(db(), user, tenantId, ["team:manage", "certificates:issue", "crm:manage", "crm:read"]);
}
/** Проверка билетов на входе: волонтёр с «Проверка билетов» или кто ведёт заявки. */
async function canCheckTickets(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  return hasAnyPermission(db(), user, tenantId, ["tickets:check", "team:manage", "certificates:issue", "crm:manage"]);
}

/** POST /api/forms/status — смена статуса заявки сотрудником. */
router.post("/status", requireFirebaseAuth, requireScreen("forms"), async (req: any, res: any) => {
  try {
    const { tenantId, submissionId, status, note } = req.body || {};
    if (!tenantId || !submissionId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!isFormStatus(status)) {
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
    const allowed = MODE_STATUSES[formMode(subFormSnap.exists ? subFormSnap.data() : null)];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Статус «${STATUS_LABEL[status]}» недоступен для этой формы`,
      });
    }

    await ref.update({
      status,
      updatedAt: admin.firestore.Timestamp.now(),
      history: admin.firestore.FieldValue.arrayUnion({
        status, at: admin.firestore.Timestamp.now(),
        by: req.user?.email || "", note: str(note, 300),
      }),
    });
    return res.json({ success: true, status, statusLabel: STATUS_LABEL[status as Status] });
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
      if (form) void appendToSheet(form, String(sub.formId || ""), sub);
      return res.json({ success: true, restored: true });
    }

    await ref.update({ deleted: true, deletedAt: now, deletedBy: by, updatedAt: now });
    // Убранная заявка не должна оставаться в таблице рядом с действующими:
    // она в корзине, и в выгрузке ей не место.
    if (form) void clearSheetRow(form, String(sub.qrToken || ""));
    return res.json({ success: true, deleted: true });
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
    if (!(await canManageForms(req.user, tenantId))) {
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
      const byStatus: Record<string, number> = {};
      for (const st of STATUSES) byStatus[st] = mine.filter(s => s.status === st).length;

      // Среднее время до первого решения: сколько заявка ждала, прежде чем
      // её сдвинули с «новой». Пока никто не сдвинул — не считаем.
      const decided = mine
        .map(s => {
          const moved = (Array.isArray(s.history) ? s.history : []).find((h: any) => h.status !== "new");
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
    for (const st of STATUSES) byStatusAll[st] = subs.filter(s => s.status === st).length;

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
