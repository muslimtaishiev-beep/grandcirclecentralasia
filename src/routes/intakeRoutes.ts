import { Router } from "express";
import admin from "firebase-admin";
import crypto from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import {
  ENTRY_STATUSES, ENTRY_STATUS_LABEL, BOOKING_STATUS_LABEL, ANSWERS_LIMITS,
  isEntryStatus, type EntryStatus, type BookingStatus, type AnswerValue,
} from "../shared/intakeTypes.js";
import { hasAnyPermission } from "../server/access.js";
import { checkTenantOpen, requireScreen, loadTenant } from "../server/tenantAccess.js";
import { audit } from "../server/audit.js";

/**
 * Приём заявок с внешних сайтов и бронирование ресурсов.
 *
 * Зачем отдельно от formRoutes: конструктор форм задаёт анкету за клиента —
 * плоский список полей семи типов. Организации со своим сайтом этого мало
 * (состав команды повторяющимися блоками, ветвление, свои проверки), а
 * дописывать в конструктор поля под каждого клиента — это возвращение к
 * коду под одну организацию, из которого проект уже выбирался.
 *
 * Поэтому здесь платформа НЕ диктует анкету. Внешний сайт верстает форму
 * какую хочет и присылает заявку в свободном виде; договор — только контакты
 * (по ним кабинет ищет человека и связывается с ним) плюс произвольные
 * ответы, в которые сервер не смотрит, а лишь меряет объём.
 *
 * Что наружу НЕ уходит: чужие заявки, имена забронировавших, tenantId,
 * внутренние заметки, токены других участников.
 */

const router = Router();
const db = () => admin.firestore();

const STREAMS = "intake_streams";
const ENTRIES = "intake_entries";
const RESOURCES = "bookable_resources";
const BOOKINGS = "resource_bookings";

/** Человекочитаемый код без похожих друг на друга символов. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeToken(len = 16): string {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);

/** Что о организации можно показать анониму на чужом сайте. */
function publicOrg(t: any) {
  if (!t) return null;
  const b = t.branding && typeof t.branding === "object" ? t.branding : {};
  return {
    name: String(t.name || ""),
    logoUrl: b.logoUrl || null,
    primaryColor: b.primaryColor || null,
  };
}

/**
 * Разрешённые источники запросов для организации.
 *
 * Список доменов — поле тенанта, а не константа в коде: у следующего клиента
 * со своим сайтом не должно быть повода править и выкладывать сервер.
 */
function tenantOrigins(t: any): string[] {
  const raw = Array.isArray(t?.publicOrigins) ? t.publicOrigins : [];
  return raw.map((o: unknown) => str(o, 200).replace(/\/+$/, "").toLowerCase()).filter(Boolean);
}

/**
 * CORS только для публичной части и только по списку организации.
 *
 * Глобальный CORS проекта пропускает любой источник (обе ветки его колбэка
 * одинаковы), и чинить его здесь нельзя: реальные домены прода в том списке
 * давно не поддерживались, включение сломало бы прод молча. Поэтому строгая
 * проверка навешивается точечно.
 *
 * credentials НЕ включаем: публичные ручки опознают человека по токену в
 * пути, а не по куке, поэтому браузеру незачем слать креденшелы — и весь
 * класс атак с чужого сайта через куку исчезает.
 */
function publicCors(tenant: any, req: any, res: any): boolean {
  const origin = str(req.headers?.origin, 200).replace(/\/+$/, "").toLowerCase();
  if (!origin) return true; // curl, серверные вызовы, переход по ссылке
  const allowed = tenantOrigins(tenant);
  if (!allowed.includes(origin)) {
    // Снимаем разрешающий заголовок, выставленный общим CORS проекта: тот
    // пропускает любой источник, и без этой строки браузер постороннего
    // сайта СМОГ БЫ прочитать наш ответ с отказом. Отказ должен быть и на
    // уровне ответа, и на уровне заголовков.
    res.removeHeader("Access-Control-Allow-Origin");
    res.removeHeader("Access-Control-Allow-Credentials");
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return true;
}

const FORBIDDEN_ORIGIN = "Этот сайт не подключён к организации. Обратитесь к организатору.";

/**
 * Проверка свободной части заявки.
 *
 * Смысл ответов — дело внешнего сайта, форма — наше: без рамок база забьётся
 * мусором, кабинет не покажет заявку, а выгрузка не соберётся. Ограничиваем
 * глубину, число ключей и длину строк; массив состава команды на пять человек
 * проходит с большим запасом.
 *
 * data:-строки отклоняем отдельно: файлы в этой версии не принимаем, а
 * незамеченный base64 раздувает документ до предела Firestore.
 */
function validateAnswers(value: unknown, depth = 0, counter = { keys: 0 }): string | null {
  if (depth > ANSWERS_LIMITS.maxDepth) {
    return `Слишком глубокая вложенность ответов (максимум ${ANSWERS_LIMITS.maxDepth} уровней).`;
  }
  if (value === null || typeof value === "boolean") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? null : "Числовое значение недопустимо.";
  }
  if (typeof value === "string") {
    if (value.length > ANSWERS_LIMITS.maxStringLength) {
      return `Слишком длинный ответ (максимум ${ANSWERS_LIMITS.maxStringLength} символов).`;
    }
    if (/^\s*data:/i.test(value)) {
      return "Файлы в заявке не принимаются — пришлите ссылку на файл.";
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > ANSWERS_LIMITS.maxArrayLength) {
      return `Слишком длинный список (максимум ${ANSWERS_LIMITS.maxArrayLength} элементов).`;
    }
    for (const item of value) {
      const err = validateAnswers(item, depth + 1, counter);
      if (err) return err;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (++counter.keys > ANSWERS_LIMITS.maxKeys) {
        return `Слишком много полей в заявке (максимум ${ANSWERS_LIMITS.maxKeys}).`;
      }
      if (key.length > 100) return "Слишком длинное название поля.";
      const err = validateAnswers((value as Record<string, unknown>)[key], depth + 1, counter);
      if (err) return err;
    }
    return null;
  }
  return "Недопустимое значение в заявке.";
}

/** Открыт ли поток прямо сейчас: выключен, ещё не начался, уже закрыт, заполнен. */
function streamClosedReason(s: any): string | null {
  if (!s || s.active === false) return "Приём заявок закрыт.";
  const now = Date.now();
  const opensAt = s.opensAt?.toMillis ? s.opensAt.toMillis() : null;
  const closesAt = s.closesAt?.toMillis ? s.closesAt.toMillis() : null;
  if (opensAt && now < opensAt) return "Приём заявок ещё не начался.";
  if (closesAt && now > closesAt) return "Приём заявок завершён.";
  const cap = num(s.capacity, 0);
  if (cap > 0 && num(s.taken, 0) >= cap) return "Свободных мест не осталось.";
  return null;
}

/** Ресурс глазами постороннего: сколько свободно, но не кто занял. */
function publicResource(id: string, r: any) {
  const capacity = num(r.capacity, 0);
  const taken = num(r.taken, 0);
  return {
    id,
    title: String(r.title || ""),
    description: String(r.description || ""),
    group: String(r.group || ""),
    capacity,
    taken,
    free: Math.max(0, capacity - taken),
    startsAt: r.startsAt || null,
    endsAt: r.endsAt || null,
    createdByParticipant: Boolean(r.createdByEntryId),
    active: r.active !== false,
  };
}

/** Заявка глазами её автора: без tenantId и внутренних заметок. */
function publicEntry(id: string, e: any) {
  const status: EntryStatus = isEntryStatus(e.status) ? e.status : "new";
  return {
    id,
    token: String(e.token || ""),
    status,
    statusLabel: ENTRY_STATUS_LABEL[status],
    contact: e.contact || {},
    answers: e.answers || {},
    createdAt: e.createdAt || null,
    history: (Array.isArray(e.history) ? e.history : []).map((h: any) => ({
      status: h.status,
      label: ENTRY_STATUS_LABEL[h.status as EntryStatus] || h.status,
      at: h.at || null,
    })),
  };
}

/**
 * Загрузка заявки по токену вместе с потоком и организацией.
 *
 * tenantId берётся ИЗ ДОКУМЕНТА, никогда из запроса: иначе подстановка
 * чужого идентификатора открыла бы чужие данные.
 */
async function loadByToken(token: string) {
  const clean = str(token, 40);
  if (!clean) return null;
  const snap = await db().collection(ENTRIES).where("token", "==", clean).limit(1).get();
  if (snap.empty) return null;
  const entryDoc = snap.docs[0];
  const entry = entryDoc.data();
  const streamSnap = await db().collection(STREAMS).doc(String(entry.streamId || "")).get();
  const tenant = await loadTenant(String(entry.tenantId || ""));
  return { entryDoc, entry, stream: streamSnap.exists ? streamSnap.data() : null, tenant };
}

/** Брони заявки — с названиями ресурсов, чтобы участник видел, что занял. */
async function bookingsOfEntry(entryId: string) {
  const snap = await db().collection(BOOKINGS).where("entryId", "==", entryId).get();
  const out: any[] = [];
  for (const d of snap.docs) {
    const b = d.data();
    const r = await db().collection(RESOURCES).doc(String(b.resourceId)).get();
    const status: BookingStatus = b.status || "active";
    out.push({
      id: d.id,
      resourceId: b.resourceId,
      resourceTitle: r.exists ? String(r.data()!.title || "") : "",
      group: r.exists ? String(r.data()!.group || "") : "",
      status,
      statusLabel: BOOKING_STATUS_LABEL[status] || status,
      joinCode: r.exists && b.isOwner ? r.data()!.joinCode || null : null,
      createdAt: b.createdAt || null,
    });
  }
  return out;
}

/**
 * Занять место — единственная точка, где растёт счётчик.
 *
 * Транзакция ровно по образцу отметки билета на входе (formRoutes): два
 * человека, нажавшие «забронировать» на последнее место одновременно, не
 * должны оба его получить.
 *
 * Счётчик считается через чтение и запись внутри транзакции, а НЕ через
 * FieldValue.increment: инкремент — трансформация, она не участвует в
 * обнаружении конфликта, и пара «прочитал последнее свободное, записал +1»
 * не откатилась бы. Вместимость уехала бы молча, и увидели бы это в день
 * мероприятия по числу людей в зале.
 *
 * Идентификатор брони детерминированный — bk_<ресурс>_<заявка>: одна заявка
 * физически не может занять один ресурс дважды, без единой проверки.
 */
async function takeSeat(resourceId: string, entryId: string, opts: { isOwner?: boolean } = {}) {
  const resourceRef = db().collection(RESOURCES).doc(resourceId);
  const bookingRef = db().collection(BOOKINGS).doc(`bk_${resourceId}_${entryId}`);

  return db().runTransaction(async tx => {
    const resSnap = await tx.get(resourceRef);
    if (!resSnap.exists) return { result: "notfound" as const };
    const r = resSnap.data()!;
    if (r.active === false) return { result: "closed" as const };

    const bookingSnap = await tx.get(bookingRef);
    if (bookingSnap.exists && bookingSnap.data()!.status === "active") {
      return { result: "already" as const };
    }

    const capacity = num(r.capacity, 0);
    const taken = num(r.taken, 0);
    if (capacity > 0 && taken >= capacity) return { result: "full" as const, free: 0 };

    const now = admin.firestore.Timestamp.now();
    tx.update(resourceRef, { taken: taken + 1, updatedAt: now });
    tx.set(bookingRef, {
      tenantId: r.tenantId,
      resourceId,
      entryId,
      status: "active" as BookingStatus,
      isOwner: Boolean(opts.isOwner),
      createdAt: bookingSnap.exists ? bookingSnap.data()!.createdAt || now : now,
      updatedAt: now,
    }, { merge: true });

    return { result: "ok" as const, free: Math.max(0, capacity - taken - 1), bookingId: bookingRef.id };
  });
}

/**
 * Освободить место.
 *
 * Счётчик уменьшается ТОЛЬКО если бронь была активной: иначе двойное нажатие
 * «отменить» (или отмена уже приостановленной брони) увело бы вместимость в
 * минус, и на последнее место сели бы двое.
 */
async function releaseSeat(bookingId: string, nextStatus: BookingStatus, by: string) {
  const bookingRef = db().collection(BOOKINGS).doc(bookingId);

  return db().runTransaction(async tx => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) return { result: "notfound" as const };
    const b = bookingSnap.data()!;
    if (b.status !== "active") return { result: "already" as const, status: b.status };

    const resourceRef = db().collection(RESOURCES).doc(String(b.resourceId));
    const resSnap = await tx.get(resourceRef);
    const now = admin.firestore.Timestamp.now();

    if (resSnap.exists) {
      const taken = num(resSnap.data()!.taken, 0);
      tx.update(resourceRef, { taken: Math.max(0, taken - 1), updatedAt: now });
    }
    tx.update(bookingRef, { status: nextStatus, updatedAt: now, releasedBy: by });
    return { result: "ok" as const, resourceId: String(b.resourceId) };
  });
}

/**
 * Снять брони заявки — при отклонении или отмене.
 *
 * Брони переводятся в held, а не удаляются: место возвращается в общий счёт,
 * но история остаётся — иначе спор «я бронировал, а меня нет» разобрать
 * нечем, и вернуть человека одним нажатием нельзя.
 */
async function releaseEntryBookings(entryId: string, by: string): Promise<number> {
  const snap = await db().collection(BOOKINGS)
    .where("entryId", "==", entryId).where("status", "==", "active").get();
  let released = 0;
  for (const d of snap.docs) {
    const out = await releaseSeat(d.id, "held", by);
    if (out.result === "ok") released++;
  }
  return released;
}

// ─────────────────────────── Публичная часть ───────────────────────────
//
// Аноним с чужого сайта: организацию и её настройки сервер берёт из
// документа потока или заявки, клиент их не передаёт.

/** Префлайт браузера: без него POST с чужого домена не уйдёт. */
router.options("/public/*", async (req: any, res: any) => {
  const origin = str(req.headers?.origin, 200);
  if (origin) {
    // Префлайт отвечает «спрашивай» — сам запрос всё равно проверит источник
    // по списку организации, которую на этом шаге мы ещё не знаем.
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  return res.status(204).end();
});

/** GET /api/intake/public/stream/:streamId — можно ли подавать заявку и что бронировать. */
router.get("/public/stream/:streamId", async (req: any, res: any) => {
  try {
    const snap = await db().collection(STREAMS).doc(str(req.params.streamId, 200)).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Приём не найден." });
    const s = snap.data()!;

    const gate = await checkTenantOpen(s.tenantId, "intake");
    const tenant = gate.ok ? gate.tenant : await loadTenant(String(s.tenantId || ""));
    if (!publicCors(tenant, req, res)) {
      return res.status(403).json({ success: false, error: FORBIDDEN_ORIGIN });
    }
    if (!gate.ok) {
      return res.status(410).json({ success: false, closed: true, error: "Приём заявок закрыт.", org: publicOrg(tenant) });
    }

    const closed = streamClosedReason(s);
    const capacity = num(s.capacity, 0);
    return res.json({
      success: true,
      org: publicOrg(tenant),
      stream: {
        id: snap.id,
        title: String(s.title || ""),
        description: String(s.description || ""),
        closed: Boolean(closed),
        closedReason: closed,
        requireApproval: s.requireApproval === true,
        maxBookingsPerEntry: num(s.maxBookingsPerEntry, 0) || null,
        free: capacity > 0 ? Math.max(0, capacity - num(s.taken, 0)) : null,
        opensAt: s.opensAt || null,
        closesAt: s.closesAt || null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/intake/public/stream/:streamId/resources — что свободно. */
router.get("/public/stream/:streamId/resources", async (req: any, res: any) => {
  try {
    const snap = await db().collection(STREAMS).doc(str(req.params.streamId, 200)).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Приём не найден." });
    const s = snap.data()!;
    const tenant = await loadTenant(String(s.tenantId || ""));
    if (!publicCors(tenant, req, res)) {
      return res.status(403).json({ success: false, error: FORBIDDEN_ORIGIN });
    }

    const allowed: string[] = Array.isArray(s.allowedResourceIds) ? s.allowedResourceIds.map(String) : [];
    const list = await db().collection(RESOURCES).where("tenantId", "==", s.tenantId).get();
    const resources = list.docs
      .filter(d => d.data().active !== false)
      .filter(d => !allowed.length || allowed.includes(d.id))
      .map(d => publicResource(d.id, d.data()))
      .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.title.localeCompare(b.title, "ru"));

    return res.json({ success: true, resources });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/intake/public/stream/:streamId/submit — заявка с внешнего сайта.
 *
 * Тело: { contact: {name, email, phone}, answers: {...что угодно...} }.
 * Контакты обязательны — по ним кабинет ищет человека и связывается с ним;
 * всё остальное платформу не касается.
 */
router.post("/public/stream/:streamId/submit", async (req: any, res: any) => {
  try {
    const streamId = str(req.params.streamId, 200);
    const streamRef = db().collection(STREAMS).doc(streamId);
    const streamSnap = await streamRef.get();
    if (!streamSnap.exists) return res.status(404).json({ success: false, error: "Приём не найден." });
    const s = streamSnap.data()!;

    const gate = await checkTenantOpen(s.tenantId, "intake");
    const tenant = gate.ok ? gate.tenant : await loadTenant(String(s.tenantId || ""));
    if (!publicCors(tenant, req, res)) {
      return res.status(403).json({ success: false, error: FORBIDDEN_ORIGIN });
    }
    if (!gate.ok) return res.status(410).json({ success: false, closed: true, error: "Приём заявок закрыт." });

    const closed = streamClosedReason(s);
    if (closed) return res.status(410).json({ success: false, closed: true, error: closed });

    const body = req.body || {};
    const contactIn = body.contact && typeof body.contact === "object" ? body.contact : {};
    const contact = {
      name: str(contactIn.name, 200),
      email: str(contactIn.email, 200).toLowerCase(),
      phone: str(contactIn.phone, 50),
    };
    if (!contact.name) return res.status(400).json({ success: false, error: "Укажите имя." });
    if (!contact.email && !contact.phone) {
      return res.status(400).json({ success: false, error: "Укажите почту или телефон для связи." });
    }
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      return res.status(400).json({ success: false, error: "Проверьте адрес почты." });
    }

    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, AnswerValue>
      : {};
    const invalid = validateAnswers(answers);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    if (JSON.stringify(answers).length > ANSWERS_LIMITS.maxBytes) {
      return res.status(413).json({ success: false, error: "Заявка слишком большая." });
    }

    // Повторная заявка тем же человеком в тот же поток не плодит записи:
    // человек, нажавший «отправить» дважды, должен остаться одним участником
    // с одним местом, а не занять два.
    const dupKey = contact.email || contact.phone;
    if (dupKey) {
      const dup = await db().collection(ENTRIES)
        .where("streamId", "==", streamId)
        .where("dupKey", "==", dupKey)
        .limit(1).get();
      if (!dup.empty) {
        const e = dup.docs[0].data();
        return res.json({
          success: true, duplicate: true, token: e.token,
          message: "Заявка уже принята — ссылка та же.",
        });
      }
    }

    const token = makeToken(16);
    const now = admin.firestore.Timestamp.now();
    const entryRef = db().collection(ENTRIES).doc();
    await entryRef.set({
      tenantId: s.tenantId,
      streamId,
      streamTitle: String(s.title || ""),
      token,
      dupKey,
      contact,
      answers,
      status: "new" as EntryStatus,
      history: [{ status: "new", at: now, by: "" }],
      createdAt: now,
      updatedAt: now,
    });

    // Счётчик заявок потока — тем же способом, что и места: без транзакции
    // два одновременных отправителя перезаписали бы значение друг друга.
    if (num(s.capacity, 0) > 0) {
      await db().runTransaction(async tx => {
        const fresh = await tx.get(streamRef);
        if (!fresh.exists) return;
        tx.update(streamRef, { taken: num(fresh.data()!.taken, 0) + 1, updatedAt: now });
      });
    }

    audit("INTAKE_ENTRY_CREATED", String(s.tenantId || ""), {
      streamId, entryId: entryRef.id, applicantName: contact.name,
    });

    return res.json({
      success: true,
      token,
      entryId: entryRef.id,
      requireApproval: s.requireApproval === true,
      message: "Заявка принята.",
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** Общая часть всех ручек «моей» заявки: найти по токену и проверить источник. */
async function myGate(req: any, res: any) {
  const found = await loadByToken(req.params.token);
  if (!found) {
    res.status(404).json({ success: false, error: "Заявка по этой ссылке не найдена." });
    return null;
  }
  if (!publicCors(found.tenant, req, res)) {
    res.status(403).json({ success: false, error: FORBIDDEN_ORIGIN });
    return null;
  }
  return found;
}

/** GET /api/intake/public/my/:token — своя заявка, свои брони, что доступно. */
router.get("/public/my/:token", async (req: any, res: any) => {
  try {
    const found = await myGate(req, res);
    if (!found) return;
    const { entryDoc, entry, stream, tenant } = found;

    const allowed: string[] = Array.isArray(stream?.allowedResourceIds) ? stream!.allowedResourceIds.map(String) : [];
    const list = await db().collection(RESOURCES).where("tenantId", "==", entry.tenantId).get();
    const resources = list.docs
      .filter(d => d.data().active !== false)
      .filter(d => !allowed.length || allowed.includes(d.id))
      .map(d => publicResource(d.id, d.data()));

    const status: EntryStatus = isEntryStatus(entry.status) ? entry.status : "new";
    const canBook = stream?.requireApproval === true ? status === "approved" : status !== "rejected" && status !== "cancelled";

    return res.json({
      success: true,
      org: publicOrg(tenant),
      entry: publicEntry(entryDoc.id, entry),
      stream: stream ? { id: entry.streamId, title: String(stream.title || ""), requireApproval: stream.requireApproval === true } : null,
      canBook,
      bookings: await bookingsOfEntry(entryDoc.id),
      resources,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/public/my/:token/book — занять место. */
router.post("/public/my/:token/book", async (req: any, res: any) => {
  try {
    const found = await myGate(req, res);
    if (!found) return;
    const { entryDoc, entry, stream } = found;

    const status: EntryStatus = isEntryStatus(entry.status) ? entry.status : "new";
    if (status === "rejected" || status === "cancelled") {
      return res.status(403).json({ success: false, error: "Заявка отклонена — бронирование недоступно." });
    }
    if (stream?.requireApproval === true && status !== "approved") {
      return res.status(403).json({ success: false, error: "Бронирование откроется после одобрения заявки." });
    }

    const resourceId = str(req.body?.resourceId, 200);
    if (!resourceId) return res.status(400).json({ success: false, error: "Не указано, что бронировать." });

    // Ресурс обязан принадлежать той же организации: иначе по своей ссылке
    // можно было бы занять место в чужой организации.
    const resSnap = await db().collection(RESOURCES).doc(resourceId).get();
    if (!resSnap.exists || resSnap.data()!.tenantId !== entry.tenantId) {
      return res.status(404).json({ success: false, error: "Не найдено." });
    }
    const allowed: string[] = Array.isArray(stream?.allowedResourceIds) ? stream!.allowedResourceIds.map(String) : [];
    if (allowed.length && !allowed.includes(resourceId)) {
      return res.status(403).json({ success: false, error: "Это недоступно для вашей заявки." });
    }

    const limit = num(stream?.maxBookingsPerEntry, 0);
    if (limit > 0) {
      const mine = await db().collection(BOOKINGS)
        .where("entryId", "==", entryDoc.id).where("status", "==", "active").get();
      if (mine.size >= limit) {
        return res.status(409).json({ success: false, result: "limit", error: `Можно занять не больше ${limit}.` });
      }
    }

    const out = await takeSeat(resourceId, entryDoc.id);
    if (out.result === "notfound") return res.status(404).json({ success: false, error: "Не найдено." });
    if (out.result === "closed") return res.status(409).json({ success: false, result: "closed", error: "Запись сюда закрыта." });
    if (out.result === "full") return res.status(409).json({ success: false, result: "full", error: "Свободных мест не осталось." });
    if (out.result === "already") return res.json({ success: true, result: "already", message: "Уже забронировано." });

    audit("INTAKE_BOOKING_CREATED", String(entry.tenantId || ""), {
      entryId: entryDoc.id, resourceId, applicantName: entry.contact?.name || "",
    });
    return res.json({ success: true, result: "ok", free: out.free, bookings: await bookingsOfEntry(entryDoc.id) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/public/my/:token/cancel — освободить своё место. */
router.post("/public/my/:token/cancel", async (req: any, res: any) => {
  try {
    const found = await myGate(req, res);
    if (!found) return;
    const { entryDoc, entry } = found;

    const resourceId = str(req.body?.resourceId, 200);
    if (!resourceId) return res.status(400).json({ success: false, error: "Не указано, что отменять." });

    const out = await releaseSeat(`bk_${resourceId}_${entryDoc.id}`, "cancelled", "participant");
    if (out.result === "notfound") return res.status(404).json({ success: false, error: "Бронь не найдена." });
    if (out.result === "already") return res.status(409).json({ success: false, result: "already", error: "Бронь уже неактивна." });

    audit("INTAKE_BOOKING_CANCELLED", String(entry.tenantId || ""), {
      entryId: entryDoc.id, resourceId, applicantName: entry.contact?.name || "",
    });
    return res.json({ success: true, result: "ok", bookings: await bookingsOfEntry(entryDoc.id) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/intake/public/my/:token/create — участник заводит свой ресурс.
 *
 * Так получаются команды: организация разрешает создание, участник создаёт
 * запись и получает код, остальные вступают по коду. Отдельной сущности
 * «команда» в коде нет — это тот же занимаемый ресурс.
 */
router.post("/public/my/:token/create", async (req: any, res: any) => {
  try {
    const found = await myGate(req, res);
    if (!found) return;
    const { entryDoc, entry, stream } = found;

    if (stream?.allowParticipantResources !== true) {
      return res.status(403).json({ success: false, error: "Создание недоступно." });
    }
    const status: EntryStatus = isEntryStatus(entry.status) ? entry.status : "new";
    if (stream?.requireApproval === true && status !== "approved") {
      return res.status(403).json({ success: false, error: "Откроется после одобрения заявки." });
    }

    const title = str(req.body?.title, 120);
    if (!title) return res.status(400).json({ success: false, error: "Нужно название." });

    const capacity = Math.min(Math.max(num(req.body?.capacity, num(stream?.participantResourceCapacity, 5)), 1), 100);
    const now = admin.firestore.Timestamp.now();
    const resourceRef = db().collection(RESOURCES).doc();
    await resourceRef.set({
      tenantId: entry.tenantId,
      title,
      description: str(req.body?.description, 500),
      group: str(stream?.participantResourceGroup, 60),
      capacity,
      taken: 0,
      active: true,
      allowEntryCreated: true,
      joinCode: makeToken(6),
      createdByEntryId: entryDoc.id,
      createdAt: now,
      updatedAt: now,
    });

    // Создатель сразу занимает своё место: иначе он числился бы вне того,
    // что сам завёл, и счёт мест разошёлся бы с реальностью.
    const out = await takeSeat(resourceRef.id, entryDoc.id, { isOwner: true });
    audit("INTAKE_RESOURCE_CREATED", String(entry.tenantId || ""), {
      entryId: entryDoc.id, resourceId: resourceRef.id, title,
    });

    const created = await resourceRef.get();
    return res.json({
      success: true,
      result: out.result,
      resource: publicResource(resourceRef.id, created.data()),
      joinCode: created.data()!.joinCode,
      bookings: await bookingsOfEntry(entryDoc.id),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/public/my/:token/join — вступить по коду. */
router.post("/public/my/:token/join", async (req: any, res: any) => {
  try {
    const found = await myGate(req, res);
    if (!found) return;
    const { entryDoc, entry, stream } = found;

    const status: EntryStatus = isEntryStatus(entry.status) ? entry.status : "new";
    if (stream?.requireApproval === true && status !== "approved") {
      return res.status(403).json({ success: false, error: "Откроется после одобрения заявки." });
    }

    const code = str(req.body?.joinCode, 40).toUpperCase();
    if (!code) return res.status(400).json({ success: false, error: "Нужен код." });

    // Поиск строго внутри своей организации: код короткий, и без этого
    // условия он мог бы совпасть с кодом в другой организации.
    const snap = await db().collection(RESOURCES)
      .where("tenantId", "==", entry.tenantId)
      .where("joinCode", "==", code)
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: "Код не найден." });

    const out = await takeSeat(snap.docs[0].id, entryDoc.id);
    if (out.result === "closed") return res.status(409).json({ success: false, result: "closed", error: "Запись закрыта." });
    if (out.result === "full") return res.status(409).json({ success: false, result: "full", error: "Свободных мест не осталось." });
    if (out.result === "already") return res.json({ success: true, result: "already", message: "Вы уже здесь." });

    audit("INTAKE_BOOKING_CREATED", String(entry.tenantId || ""), {
      entryId: entryDoc.id, resourceId: snap.docs[0].id, viaCode: true,
    });
    return res.json({
      success: true, result: "ok",
      resource: publicResource(snap.docs[0].id, snap.docs[0].data()),
      bookings: await bookingsOfEntry(entryDoc.id),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────── Кабинет организации ───────────────────────────

async function canManageIntake(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin === true) return true;
  return hasAnyPermission(db(), user, tenantId, ["intake:manage", "crm:manage"]);
}

/** Организация запрошенного документа обязана совпадать с запрошенной. */
function sameTenant(snap: any, tenantId: string): boolean {
  return snap.exists && snap.data().tenantId === tenantId;
}

const guard = [requireFirebaseAuth, requireScreen("intake")];

/** GET /api/intake/streams?tenantId= — потоки приёма. */
router.get("/streams", ...guard, async (req: any, res: any) => {
  try {
    const tenantId = str(req.query.tenantId, 200);
    if (!(await canManageIntake(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const snap = await db().collection(STREAMS).where("tenantId", "==", tenantId).get();
    const streams = snap.docs.map(d => ({ id: d.id, ...d.data(), closedReason: streamClosedReason(d.data()) }));
    return res.json({ success: true, streams, publicOrigins: tenantOrigins(req.tenant) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/streams — создать или изменить поток. */
router.post("/streams", ...guard, async (req: any, res: any) => {
  try {
    const { tenantId, id } = req.body || {};
    const tid = str(tenantId, 200);
    if (!(await canManageIntake(req.user, tid))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const title = str(req.body?.title, 120);
    if (!title) return res.status(400).json({ success: false, error: "Нужно название приёма." });

    const now = admin.firestore.Timestamp.now();
    const patch: Record<string, unknown> = {
      tenantId: tid,
      title,
      description: str(req.body?.description, 1000),
      active: req.body?.active !== false,
      requireApproval: req.body?.requireApproval === true,
      allowParticipantResources: req.body?.allowParticipantResources === true,
      participantResourceGroup: str(req.body?.participantResourceGroup, 60),
      participantResourceCapacity: Math.min(Math.max(num(req.body?.participantResourceCapacity, 5), 1), 100),
      capacity: Math.max(0, num(req.body?.capacity, 0)),
      maxBookingsPerEntry: Math.max(0, num(req.body?.maxBookingsPerEntry, 0)),
      allowedResourceIds: Array.isArray(req.body?.allowedResourceIds)
        ? req.body.allowedResourceIds.map((x: unknown) => str(x, 200)).filter(Boolean).slice(0, 100)
        : [],
      updatedAt: now,
      updatedBy: req.user?.email || req.user?.uid || "",
    };
    for (const key of ["opensAt", "closesAt"] as const) {
      const raw = req.body?.[key];
      const ms = raw ? Date.parse(String(raw)) : NaN;
      patch[key] = Number.isFinite(ms) ? admin.firestore.Timestamp.fromMillis(ms) : null;
    }

    if (id) {
      const ref = db().collection(STREAMS).doc(str(id, 200));
      const snap = await ref.get();
      if (!sameTenant(snap, tid)) return res.status(404).json({ success: false, error: "Приём не найден." });
      await ref.update(patch);
      audit("INTAKE_STREAM_UPDATED", tid, { streamId: ref.id, actorEmail: req.user?.email || "" });
      return res.json({ success: true, id: ref.id });
    }

    const ref = db().collection(STREAMS).doc();
    await ref.set({ ...patch, taken: 0, createdAt: now });
    audit("INTAKE_STREAM_CREATED", tid, { streamId: ref.id, actorEmail: req.user?.email || "" });
    return res.json({ success: true, id: ref.id });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/intake/resources?tenantId= — что можно занять. */
router.get("/resources", ...guard, async (req: any, res: any) => {
  try {
    const tenantId = str(req.query.tenantId, 200);
    if (!(await canManageIntake(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const snap = await db().collection(RESOURCES).where("tenantId", "==", tenantId).get();
    return res.json({ success: true, resources: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/resources — создать или изменить ресурс. */
router.post("/resources", ...guard, async (req: any, res: any) => {
  try {
    const { tenantId, id } = req.body || {};
    const tid = str(tenantId, 200);
    if (!(await canManageIntake(req.user, tid))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const title = str(req.body?.title, 120);
    if (!title) return res.status(400).json({ success: false, error: "Нужно название." });

    const now = admin.firestore.Timestamp.now();
    const patch: Record<string, unknown> = {
      tenantId: tid,
      title,
      description: str(req.body?.description, 1000),
      group: str(req.body?.group, 60),
      capacity: Math.max(0, num(req.body?.capacity, 0)),
      active: req.body?.active !== false,
      allowEntryCreated: req.body?.allowEntryCreated === true,
      updatedAt: now,
      updatedBy: req.user?.email || req.user?.uid || "",
    };
    for (const key of ["startsAt", "endsAt"] as const) {
      const raw = req.body?.[key];
      const ms = raw ? Date.parse(String(raw)) : NaN;
      patch[key] = Number.isFinite(ms) ? admin.firestore.Timestamp.fromMillis(ms) : null;
    }

    if (id) {
      const ref = db().collection(RESOURCES).doc(str(id, 200));
      const snap = await ref.get();
      if (!sameTenant(snap, tid)) return res.status(404).json({ success: false, error: "Не найдено." });
      // Счётчик занятых мест не трогаем: он живёт только внутри транзакции
      // бронирования, и правка «руками» рассинхронизировала бы его с бронями.
      await ref.update(patch);
      audit("INTAKE_RESOURCE_UPDATED", tid, { resourceId: ref.id, actorEmail: req.user?.email || "" });
      return res.json({ success: true, id: ref.id });
    }

    const ref = db().collection(RESOURCES).doc();
    await ref.set({ ...patch, taken: 0, joinCode: req.body?.withJoinCode ? makeToken(6) : null, createdAt: now });
    audit("INTAKE_RESOURCE_CREATED", tid, { resourceId: ref.id, actorEmail: req.user?.email || "" });
    return res.json({ success: true, id: ref.id });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/intake/entries?tenantId=&streamId= — заявки с бронями. */
router.get("/entries", ...guard, async (req: any, res: any) => {
  try {
    const tenantId = str(req.query.tenantId, 200);
    if (!(await canManageIntake(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    let q: any = db().collection(ENTRIES).where("tenantId", "==", tenantId);
    const streamId = str(req.query.streamId, 200);
    if (streamId) q = q.where("streamId", "==", streamId);
    const snap = await q.orderBy("createdAt", "desc").limit(500).get();

    // Брони одним запросом на всю страницу, а не по одной на заявку: иначе
    // список из 500 участников — это 500 обращений к базе подряд.
    const bookings = await db().collection(BOOKINGS).where("tenantId", "==", tenantId).get();
    const byEntry = new Map<string, any[]>();
    for (const b of bookings.docs) {
      const d = b.data();
      const arr = byEntry.get(String(d.entryId)) || [];
      arr.push({ id: b.id, resourceId: d.resourceId, status: d.status, isOwner: Boolean(d.isOwner) });
      byEntry.set(String(d.entryId), arr);
    }

    const entries = snap.docs.map((d: any) => {
      const e = d.data();
      const status: EntryStatus = isEntryStatus(e.status) ? e.status : "new";
      return {
        id: d.id,
        streamId: e.streamId,
        streamTitle: e.streamTitle || "",
        contact: e.contact || {},
        answers: e.answers || {},
        status,
        statusLabel: ENTRY_STATUS_LABEL[status],
        createdAt: e.createdAt || null,
        bookings: byEntry.get(d.id) || [],
      };
    });
    return res.json({ success: true, entries });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/intake/entries/status — одобрить или отклонить заявку. */
router.post("/entries/status", ...guard, async (req: any, res: any) => {
  try {
    const tenantId = str(req.body?.tenantId, 200);
    if (!(await canManageIntake(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const status = str(req.body?.status, 40);
    if (!isEntryStatus(status)) {
      return res.status(400).json({ success: false, error: "Неизвестный статус." });
    }
    const ref = db().collection(ENTRIES).doc(str(req.body?.entryId, 200));
    const snap = await ref.get();
    if (!sameTenant(snap, tenantId)) return res.status(404).json({ success: false, error: "Заявка не найдена." });

    const now = admin.firestore.Timestamp.now();
    const by = req.user?.email || req.user?.uid || "";
    await ref.update({
      status,
      updatedAt: now,
      history: admin.firestore.FieldValue.arrayUnion({
        status, at: now, by, note: str(req.body?.note, 300),
      }),
    });

    // Отклонённая заявка не должна держать место. Снимаем брони НЕ блокируя
    // ответ: сбой здесь не должен ломать саму смену статуса.
    let released = 0;
    if (status === "rejected" || status === "cancelled") {
      released = await releaseEntryBookings(ref.id, by).catch(() => 0);
    }
    audit("INTAKE_ENTRY_STATUS", tenantId, { entryId: ref.id, status, actorEmail: by, releasedBookings: released });
    return res.json({ success: true, status, releasedBookings: released });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/intake/origins — какие сайты могут обращаться к публичной части.
 *
 * Список доменов — данные организации, а не константа в коде: подключение
 * следующего сайта не должно требовать правки и выкладки сервера.
 */
router.post("/origins", ...guard, async (req: any, res: any) => {
  try {
    const tenantId = str(req.body?.tenantId, 200);
    if (!(await canManageIntake(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const raw = Array.isArray(req.body?.origins) ? req.body.origins : [];
    const origins: string[] = [];
    for (const item of raw.slice(0, 20)) {
      const value = str(item, 200).replace(/\/+$/, "").toLowerCase();
      if (!value) continue;
      if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(value)) {
        return res.status(400).json({ success: false, error: `Неверный адрес: ${value}. Нужен вид https://example.com` });
      }
      if (!origins.includes(value)) origins.push(value);
    }
    await db().collection("tenants").doc(tenantId).update({ publicOrigins: origins });
    const { invalidateTenant } = await import("../server/tenantAccess.js");
    invalidateTenant(tenantId);
    audit("INTAKE_ORIGINS_UPDATED", tenantId, { origins, actorEmail: req.user?.email || "" });
    return res.json({ success: true, origins });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
