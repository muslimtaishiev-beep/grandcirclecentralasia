import { Router } from "express";
import admin from "firebase-admin";
import crypto from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import {
  FORM_STATUSES, STATUS_LABEL, MODE_STATUSES, TICKET_ACTIVE,
  isFormStatus, type FormStatus, type FormMode,
} from "../shared/formStatuses.js";


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

// ─────────────────────────── Публичная часть ───────────────────────────

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
    if (f.active === false) {
      return res.status(410).json({
        success: false, closed: true,
        error: "Приём заявок по этой форме закрыт.",
      });
    }
    return res.json({
      success: true,
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

/** POST /api/forms/submit — отправка заявки посетителем. */
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
        // Файл приходит сжатым data-URL с клиента. Обычная обрезка до 2000
        // символов уничтожила бы base64, поэтому у файлов свой путь: только
        // изображения и лимит как у фото среза (placementRoutes) — этого
        // хватает для удостоверения, которое сверяют глазами на входе.
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
    // Общий предел заявки: лимит Firestore — 1 МБ на документ, и заявка с
    // двумя файлами не должна упереться в него уже при записи.
    if (JSON.stringify(clean).length > 700 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Заявка слишком большая — уменьшите приложенные файлы.",
      });
    }

    // Имя, телефон и почта нужны отдельно — по ним заявку ищут в кабинете.
    // Берём из полей, помеченных ролью, иначе угадываем по типу и названию.
    const pick = (re: RegExp) => {
      const f = fields.find(x => re.test(String(x.label || "")) || re.test(String(x.id || "")));
      return f ? str(clean[f.id], 200) : "";
    };
    const applicantName = pick(/фамили|имя|фио|name/i);
    const applicantPhone = pick(/телефон|phone|моб/i);
    const applicantEmail = pick(/e-?mail|почт/i);

    const qrToken = makeToken();
    const ref = db().collection(SUBS).doc();
    await ref.set({
      tenantId: form.tenantId || "",
      formId: String(formId),
      formTitle: form.title || "Заявка",
      qrToken,
      applicantName, applicantPhone, applicantEmail,
      status: "new" as Status,
      data: clean,
      // История статусов — основа отслеживания: и заявитель, и кабинет
      // видят не только текущее состояние, но и когда оно менялось.
      history: [{ status: "new", at: admin.firestore.Timestamp.now(), by: "" }],
      createdAt: admin.firestore.Timestamp.now(),
    });

    return res.json({
      success: true,
      qrToken,
      trackUrl: `/track/${qrToken}`,
      mode: formMode(form),
      message: "Заявка принята.",
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

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

    return res.json({
      success: true,
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
        history: (Array.isArray(s.history) ? s.history : []).map((h: any) => ({
          status: h.status,
          label: STATUS_LABEL[h.status as Status] || h.status,
          at: h.at || null,
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

    // Проверять билеты может любой действующий сотрудник ТОЙ ЖЕ организации:
    // волонтёров заводят как членов, а чужой организации ничего не откроется.
    if (!(await canManageForms(req.user, String(sub.tenantId || "")))) {
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

async function canManageForms(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  if (Array.isArray(user?.tenantAdminIds) && user.tenantAdminIds.includes(tenantId)) return true;
  const ms = await db().collection("memberships")
    .where("userId", "==", user?.uid || "")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .get();
  return !ms.empty;
}

/** POST /api/forms/status — смена статуса заявки сотрудником. */
router.post("/status", requireFirebaseAuth, async (req: any, res: any) => {
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
 * GET /api/forms/stats — сводка по заявкам, по каждой форме отдельно.
 *
 * Это то, ради чего конструктор и нужен: сколько заявок пришло по каждой
 * форме, в каких они статусах, сколько новых и как быстро их обрабатывают.
 */
router.get("/stats", requireFirebaseAuth, async (req: any, res: any) => {
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
