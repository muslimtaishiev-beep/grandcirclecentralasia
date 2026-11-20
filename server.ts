import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs, existsSync, readFileSync } from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { publicTenantView } from "./src/server/tenantView.js";
import { hasAnyPermission } from "./src/server/access.js";
import { cashSummary } from "./src/server/cash.js";
import { loadTenant, TenantError } from "./src/server/tenantAccess.js";
import { requireFirebaseAuth } from "./src/routes/authRoutes.js";

dotenv.config();

const app = express();
app.set('trust proxy', true);

// HTTP Response Compression (Gzip / Brotli)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" }
}));



// Эти два пути идут мимо общего счётчика — у каждого свой лимитер ниже.
//
// Общий лимит считается по адресу, а на мероприятии и волонтёры, и сотни
// гостей сидят на одном Wi-Fi: у всех один внешний адрес. Гости открывали
// страницы своих билетов, и всплеск у двери съедал 500 запросов в минуту
// целиком — после чего сканер волонтёра получал отказ на каждый скан до
// конца минуты. В имитации входа заблокированными оказались все пять
// сканов подряд.
const SEPARATE_BUCKET = ["/api/forms/checkin", "/api/forms/track/", "/api/exam-public/"];

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  // Ответ JSON, как у остальных лимитеров: сканер на нечитаемый ответ
  // показывал «Нет связи с сервером» или «Билет не найден», и волонтёр мог
  // развернуть гостя с настоящим билетом.
  message: { success: false, error: "Слишком много запросов подряд — подождите минуту." },
  skip: (req: any) => SEPARATE_BUCKET.some(prefix => String(req.originalUrl || "").startsWith(prefix)),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/", apiLimiter);

// Страница билета гостя: у входа её открывают сотни людей сразу, и она
// должна выдерживать пик. Перебор кодов при этом по-прежнему упирается в
// потолок: код из 10 знаков по 32 символа — это 50 бит, и 1500 попыток в
// минуту с одного адреса не приблизят к угадыванию ни на шаг.
const trackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1500,
  message: { success: false, error: "Слишком много запросов подряд — подождите минуту." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/forms/track", trackLimiter);

// Rate Limiter for Auth & Sensitive Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: "Too many authentication/request attempts. Please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/auth/", authLimiter);

// Чек-ин билетов: все волонтёры события обычно сидят за одним Wi-Fi (один
// IP на всех), поэтому лимит просторный — но конечный, чтобы код сканера
// нельзя было перебрать. 2000 за 15 минут хватает на поток в несколько сотен
// гостей (2 запроса на гостя: сверка + подтверждение).
const checkinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, error: "Слишком много проверок подряд — подождите минуту." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/forms/checkin", checkinLimiter);

// Приём заявок с внешних сайтов: ручки открыты анониму, поэтому лимит
// заметно строже общего. Участники мероприятия обычно сидят за одним
// Wi-Fi (один IP на всех), так что предел не может быть маленьким — но
// он конечный, чтобы ни массовую подачу мусорных заявок, ни перебор
// ссылок участников нельзя было вести с одного адреса.
const intakePublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, error: "Слишком много запросов подряд — подождите минуту." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/intake/public", intakePublicLimiter);

// Подпись по QR в журналах открыта без входа: строгий отдельный лимит,
// чтобы одноразовые ссылки нельзя было перебирать.
const journalSignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, error: "Слишком много запросов подряд — подождите минуту." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/journals/sign", journalSignLimiter);

// Экзамен: весь класс сдаёт с одного Wi-Fi, и автосохранение ответов идёт
// от каждого ученика. Общий лимит (500 в минуту на адрес) класс из сотни
// человек выбирал бы за минуту — свой счётчик, просторный, но конечный.
const examPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  message: { success: false, error: "Слишком много запросов подряд — подождите минуту." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/exam-public", examPublicLimiter);
// Старт отдельно и строже: без PIN («по одной ссылке») иначе можно засыпать
// экзамен мусорными работами. 300 за 10 минут хватает на большой зал.
app.use(/^\/api\/exam-public\/[^/]+\/start(-referral)?$/, rateLimit({
  windowMs: 10 * 60 * 1000, max: 300,
  message: { success: false, error: "Слишком много попыток начать экзамен — подождите несколько минут." },
  standardHeaders: true, legacyHeaders: false, validate: false,
}));
app.use("/api/admin/login", authLimiter);
app.use("/api/tenants/request", authLimiter);

const allowedOrigins = [
  "https://www.studyfreeforum.com",
  "https://studyfreeforum.com",
  "https://logoshackathon.com",
  "https://www.logoshackathon.com",
  "http://logoshackathon.com",
  "http://www.logoshackathon.com",
  "http://localhost:3000",
  "http://localhost:3005",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.logoshackathon.com')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ limit: '5mb', type: 'text/plain' }));

// NOTE: GET /api/auth/me is handled by src/routes/authRoutes.ts, mounted at
// app.use("/api/auth", authRoutes) below — that's the real implementation
// (verifies the token, syncs tenantIds/tenantAdminIds custom claims from
// `memberships`). A stub used to be registered here ahead of that mount, so
// Express matched it FIRST and the real handler never ran — meaning custom
// claims were never actually synced for any user in production. Do not
// redefine this route here.

// NOTE: GET /api/tenant/config is handled further below (the one that queries
// by `subdomain`, matching TenantProvisioningService's actual field name). A
// duplicate stub used to be registered here, querying a nonexistent `slug`
// field — it always returned 404 and, being registered first, shadowed the
// correct handler. Do not redefine this route here.


const PORT = Number(process.env.PORT) || 3005;
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Attempt to initialize Firebase Admin
let useFirebase = false;
try {
  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Локальная разработка против эмулятора: никаких боевых ключей, никакого
    // расхода квоты и никакого риска задеть настоящие данные учеников.
    // Эмулятор не проверяет учётные данные, поэтому projectId достаточно.
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "study-64ebf" });
    useFirebase = true;
    console.log(`🧪 Firestore EMULATOR: ${process.env.FIRESTORE_EMULATOR_HOST} — боевая база не используется.`);
  } else if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    useFirebase = true;
    console.log("🔥 Firebase Admin SDK initialized successfully from serviceAccountKey.json.");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    useFirebase = true;
    console.log("🔥 Firebase Admin SDK initialized successfully from .env.");
  } else {
    console.warn("⚠️ No serviceAccountKey.json found. Falling back to local db.json.");
  }
} catch (e) {
  console.warn("⚠️ Failed to initialize Firebase Admin. Falling back to local db.json.", e);
}

// ── AUDIT TRAIL ───────────────────────────────────────────────────────────
// One writer for every logged action, so the superadmin log and the manager
// dashboard see the same shape no matter which endpoint produced the entry.
// Fire-and-forget by design: an audit write must never delay or fail the
// operation it is recording — losing a log line is bad, losing a student's
// exam because logging hiccuped is far worse.
export type AuditAction =
  | "EXAM_STARTED" | "EXAM_RESCORED" | "EXAM_SUBMITTED" | "EXAM_ENGLISH_SUBMITTED"
  | "EXAM_SUSPENDED" | "EXAM_RESUME_REQUESTED" | "EXAM_RESUME_APPROVED"
  | "EXAM_FULLSCREEN_EXIT" | "PROCTORING_REPORT" | "PROCTORING_VIOLATION"
  | "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT"
  | "TENANT_CREATED" | "TENANT_UPDATED" | "MEMBER_INVITED" | "MEMBER_ROLE_CHANGED"
  | "MANAGER_FORM_SUBMITTED" | "STUDENT_DECISION_UPDATED"
  | "CLIENT_ERROR";

function writeAuditLog(action: AuditAction, tenantId: string, fields: Record<string, any> = {}) {
  if (!useFirebase) return;
  admin.firestore().collection("audit_logs").add({
    timestamp: admin.firestore.Timestamp.now(),
    createdAt: new Date().toISOString(),
    action,
    tenantId: tenantId || "unknown",
    ...fields,
  }).catch((e) => console.warn(`[Audit] ${action} write failed:`, e?.message));
}

// Middleware
// Removed duplicate app.use(express.json()) to preserve the 10MB limit set above.
// Memory active sessions store
let activeSessions = new Set<string>();

import authRoutes from "./src/routes/authRoutes.js";
import tenantRoutes from "./src/routes/tenantRoutes.js";
import superAdminRoutes from "./src/routes/superAdminRoutes.js";
import superTenantRoutes from "./src/routes/superTenantRoutes.js";
import { readMaintenance } from "./src/routes/superAdminRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import placementRoutes from "./src/routes/placementRoutes.js";
import formRoutes from "./src/routes/formRoutes.js";
import intakeRoutes from "./src/routes/intakeRoutes.js";
import payrollRoutes from "./src/routes/payrollRoutes.js";
import journalRoutes from "./src/routes/journalRoutes.js";
import digitizeRoutes from "./src/routes/digitizeRoutes.js";
import eduRoutes from "./src/routes/eduRoutes.js";
import examRoutes from "./src/routes/examRoutes.js";
import presentationRoutes from "./src/routes/presentationRoutes.js";
import { notifyEvent } from "./src/server/notify.js";
import admissionRoutes from "./src/routes/admissionRoutes.js";
import telegramRoutes from "./src/routes/telegramRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import emailTemplateRoutes from "./src/routes/emailTemplateRoutes.js";
import formNotifyRoutes from "./src/routes/formNotifyRoutes.js";
import notifyRoutes from "./src/routes/notifyRoutes.js";
import { verifySession } from "./src/server/session.js";
import examAdminRoutes from "./src/routes/examAdminRoutes.js";
import examPublicRoutes from "./src/routes/examPublicRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import { sendTestResultEmail } from "./emailService.js";

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/tenants", adminRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/superadmin", superTenantRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/digitize", digitizeRoutes);
app.use("/api/edu", eduRoutes);
app.use("/api/exam-builder", examRoutes);
app.use("/api/presentations", presentationRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/email-templates", emailTemplateRoutes);
app.use("/api/form-notify", formNotifyRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/exam-admin", examAdminRoutes);
app.use("/api/exam-public", examPublicRoutes);

let memoryDbStore: any = null;

// Helper to read database
async function readDb() {
  const defaultMetrics = [
    { id: "m1", value: "500+", label_en: "Attendees", label_ru: "Участников", sublabel_en: "Students, parents, professionals", sublabel_ru: "Школьники, студенты, родители", order: 1 },
    { id: "m2", value: "1", label_en: "Intense Day", label_ru: "День форума", order: 2 },
    { id: "m3", value: "20+", label_en: "Speakers", label_ru: "Спикеров", order: 3 },
    { id: "m4", value: "Essay", label_en: "Competition", label_ru: "Competition", sublabel_en: "Largest in CA", sublabel_ru: "Крупнейший в ЦА", order: 4 },
    { id: "m5", value: "∞", label_en: "Motivation", label_ru: "Мотивации", order: 5 },
    { id: "m6", value: "4", label_en: "Panel Sessions", label_ru: "Панельные сессии", sublabel_en: "Admission strategies", sublabel_ru: "Стратегии поступления", order: 6 },
    { id: "m7", value: "VIP", label_en: "Dinner", label_ru: "Ужин", order: 7 },
    { id: "m8", value: "100%", label_en: "Networking", label_ru: "Нетворкинг", order: 8 }
  ];

  if (memoryDbStore) {
    return memoryDbStore;
  }

  if (useFirebase && admin.apps.length > 0) {
    try {
      const dbRef = admin.firestore().collection("system").doc("db");
      const doc = await dbRef.get();
      if (doc.exists) {
        if (!memoryDbStore.settings) memoryDbStore.settings = {};
        memoryDbStore.settings.maintenance = {
          enabled: false,
          message: "Система работает в штатном режиме.",
          estimatedTime: "0 минут",
          updatedAt: new Date().toISOString()
        };
        return memoryDbStore;
      }
    } catch (e) {
      console.warn("Firebase read notice:", e);
    }
  }

  // Local file fallback (if file exists and readable)
  try {
    if (existsSync(DB_PATH)) {
      const data = await fs.readFile(DB_PATH, "utf-8");
      memoryDbStore = JSON.parse(data);
      if (memoryDbStore) return memoryDbStore;
    }
  } catch (error) {
    console.warn("Local db.json read notice:", error);
  }

  // Blank structure fallback
  memoryDbStore = {
    settings: {
      eventDate: "June 26, 2026",
      eventVenue: "Astana Technopark, Block C4",
      contactEmail: "info@mainedu.kz",
      contactPhone: "+7 (7172) 55-44-33",
      maintenance: {
        enabled: false,
        message: "Идут плановые технические работы на серверах прокторинга. Доступ будет восстановлен в ближайшее время.",
        estimatedTime: "30 минут",
        updatedAt: new Date().toISOString()
      }
    },
    speakers: [],
    program: [],
    partners: [],
    tickets: [],
    subscribers: [],
    metrics: defaultMetrics
  };

  return memoryDbStore;
}

// Helper to write database
async function writeDb(data: any) {
  memoryDbStore = data;
  if (useFirebase && admin.apps.length > 0) {
    try {
      const dbRef = admin.firestore().collection("system").doc("db");
      await dbRef.set(data);
      return true;
    } catch (e) {
      console.warn("Firebase write notice:", e);
    }
  }

  try {
    if (existsSync(DB_PATH)) {
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch (error) {
    console.warn("Local db.json write notice (safe memory fallback used):", error);
  }
  return true;
}

// Authentication middleware (Pure Firebase Auth verification)

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN MIDDLEWARE (Added in Round 6)
// ─────────────────────────────────────────────────────────────────────────────
async function requireSuperadmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Unauthorized access: missing token." });
  }

  try {
    const decoded = await verifySession(token);
    const snap = await admin.firestore().collection("superadmins").doc(decoded.uid).get();
    if (!snap.exists) {
      return res.status(403).json({ error: "Forbidden: Superadmin role required." });
    }
    (req as any).user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized access: invalid token." });
  }
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Unauthorized access: missing token." });
  }

  if (activeSessions.has(token)) {
    return next();
  }

  try {
    const decoded = await verifySession(token);
    (req as any).user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized access: invalid Firebase Auth token." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CONTEXT SYSTEM (Sprint 2.1 — SaaS multi-tenancy foundation)
// ─────────────────────────────────────────────────────────────────────────────
//
// Current implementation: single-tenant (Grand Circle).
// The org_id is derived server-side from GAS_API_KEY — never from client body.
//
// To add a second tenant (Company B):
// 1. Generate a new API key for Company B
// 2. Add it to TENANT_API_KEY_MAP (from env or secure KV store)
// 3. Company B gets their own Drive folder and evidence isolation automatically
//
// Schema for future multi-tenant expansion:
// TENANT_API_KEY_MAP: { [sha256_hash_of_key]: { org_id, org_name, plan_tier, quota } }

interface TenantContext {
  org_id: string;
  org_name: string;
  plan_tier: 'free' | 'pro' | 'enterprise';
}

/**
 * Организация — из запроса, а не из ключа GAS. Раньше функция игнорировала
 * аргумент и всегда возвращала Академию: улики прокторинга любой школы
 * подписывались её названием.
 */
async function resolveTenantContext(tenantId: unknown): Promise<TenantContext> {
  const id = String(tenantId ?? "").trim();
  if (!id) throw new TenantError(400, "Не указана организация");
  const t = await loadTenant(id);
  if (!t) throw new TenantError(404, "Организация не найдена");
  return { org_id: id, org_name: String(t.name || id), plan_tier: 'pro' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCTORING EVIDENCE UPLOAD ENDPOINT
// POST /api/proctoring/upload-evidence
// ─────────────────────────────────────────────────────────────────────────────
//
// Accepts the evidence package from client (useProctoringEvidence hook).
// Injects org_id SERVER-SIDE from GAS_API_KEY — client cannot override it.
// Forwards to GAS which saves to Google Drive: [org_id]/[session_id]/
//
// Evidence folder structure on Google Drive:
//   Прокторинг / [org_id] / [session_id] /
//     report.md          ← Markdown violation report
//     snapshot_001.jpg   ← Evidence screenshots
//     snapshot_002.jpg
//     ...
//
// Future improvement: return pre-signed Firebase Storage URL for large video uploads
// instead of sending video through this proxy.

// Раньше без входа: кто угодно рассылал сотрудникам любой школы уведомления
// и слал файлы в Google Диск с серверным ключом. Теперь — только сотрудник
// организации с правом на экзамены (песочница прокторинга).
app.post("/api/proctoring/upload-evidence", authLimiter, requireFirebaseAuth, async (req: any, res) => {
  const gasUrl = process.env.VITE_GAS_URL || process.env.GAS_URL;
  const gasApiKey = process.env.GAS_API_KEY || process.env.VITE_GAS_API_KEY;

  if (!gasApiKey) {
    return res.status(500).json({ success: false, error: "Server misconfiguration: GAS_API_KEY not set" });
  }
  if (!gasUrl) {
    return res.status(500).json({ success: false, error: "Server misconfiguration: GAS_URL not set" });
  }

  try {
    const body = req.body;
    if (!body || !body.sessionId || !body.studentShortId) {
      return res.status(400).json({ success: false, error: "Missing required fields: sessionId, studentShortId" });
    }

    // ⚠️ SECURITY: org_id is injected HERE server-side, never from client body
    let tenant: TenantContext;
    try { tenant = await resolveTenantContext(req.body?.tenantId); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, error: e.message }); }
    if (!(await hasAnyPermission(admin.firestore(), req.user, tenant.org_id, ["tests:manage", "tests:review"]))) {
      return res.status(403).json({ success: false, error: "Нужно право на экзамены в этой организации" });
    }

    // Audit log: write directly to Firestore collection `audit_logs`
    const auditEntry = {
      timestamp: admin.firestore.Timestamp.now(),
      createdAt: new Date().toISOString(),
      action: 'UPLOAD_PROCTORING_EVIDENCE',
      tenantId: tenant.org_id,
      sessionId: body.sessionId,
      studentShortId: body.studentShortId,
      snapshotCount: (body.snapshots || []).length,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
    };
    admin.firestore().collection('audit_logs').add(auditEntry).catch(e => console.error('Audit log write error:', e));

    // 🔔 Нарушение прокторинга — тем, кто ведёт экзамены (по их настройкам уведомлений).
    if ((body.totalViolations ?? 0) > 0 || (body.honestyIndex ?? 100) < 85) {
      await notifyEvent({
        tenantId: tenant.org_id, event: "exam.proctoring", perms: ["tests:manage", "tests:review"], type: "exam",
        title: "🚨 Нарушение прокторинга",
        body: `${body.studentName || 'Ученик'} (${body.studentShortId}): нарушений ${body.totalViolations || 1}, индекс честности ${body.honestyIndex ?? 100}%`,
        url: `/workspace/${tenant.org_id}/tests/check/${body.studentShortId}`,
        docId: u => `proct_${String(body.studentShortId || body.sessionId || "x").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)}_${u}`,
      });
    }


    // Forward to GAS for Google Drive upload
    const payload = {
      action: 'uploadProctoringPackage',
      apiKey: gasApiKey,            // ← server injects, not client
      orgId: tenant.org_id,         // ← server injects, not client
      orgName: tenant.org_name,
      sessionId: body.sessionId,
      studentName: body.studentName || 'Неизвестный ученик',
      studentShortId: body.studentShortId,
      testId: body.testId || '',
      honestyIndex: body.honestyIndex ?? 100,
      sessionStartTime: body.sessionStartTime,
      sessionEndTime: body.sessionEndTime,
      totalViolations: body.totalViolations ?? 0,
      violationsByType: body.violationsByType ?? {},
      markdownReport: body.markdownReport || '',
      snapshots: (body.snapshots || []).slice(0, 15), // cap at 15 screenshots
    };

    let gasData: any = { success: false };
    try {
      const gasRes = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(55000),
      });
      gasData = await gasRes.json();
    } catch (gasErr: any) {
      console.warn('[ProctoringEvidence] GAS upload failed, returning partial success:', gasErr.message);
      // Even if GAS fails, return success=true with local record for resilience
      return res.json({
        success: true,
        folderUrl: null,
        warning: 'Evidence logged locally; Drive upload failed — will retry',
        orgId: tenant.org_id,
      });
    }

    return res.json({
      success: true,
      folderUrl: gasData.folderUrl || null,
      orgId: tenant.org_id,
    });
  } catch (e: any) {
    console.error('[ProctoringEvidence] Endpoint error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SAAS EXAM API ENDPOINTS (High-Speed Vercel Routes)
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: POST /api/auth/send-employee-invite is handled by src/routes/authRoutes.ts,
// mounted at app.use("/api/auth", authRoutes) above — Express matches that router
// first, so a handler registered here would never actually run. The real
// implementation (with proper tenant-admin authorization and the branded Resend
// email) lives there; do not redefine this route in server.ts.

app.get("/api/tenant/config", async (req, res) => {
  try {
    const subdomain = req.query.subdomain as string;
    if (!subdomain) {
      return res.status(400).json({ success: false, error: "Missing subdomain" });
    }

    if (useFirebase) {
      const snap = await admin.firestore().collection("tenants")
        .where("subdomain", "==", subdomain)
        .limit(1)
        .get();

      if (!snap.empty) {
        // Только публичный срез: раньше уходил весь документ вместе с ключами
        // интеграций и настройками почты — любому, кто угадал поддомен.
        return res.json({ success: true, tenant: publicTenantView(snap.docs[0].data()) });
      }
    }
    
    // Fallback or not found
    return res.status(404).json({ success: false, error: "Tenant not found for subdomain: " + subdomain });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/tenant/resolve?slug=X — публичная резолюция «человеческого» имени
 * организации в её id.
 *
 * Нужна для адресов вида /oxford-school/placement: страницы экзаменов
 * анонимны и Firestore им закрыт, а печатать на афишах org_oxford_school
 * неудобно. Отдаём только id и название — ничего из настроек наружу.
 */
/** GET /api/tenant/public?id=org_x — публичный срез организации (название, брендинг, реквизиты без почты). */
app.get("/api/tenant/public", async (req, res) => {
  try {
    const id = String(req.query.id || "").trim();
    if (!id || id.length > 80) return res.status(400).json({ success: false, error: "Не указана организация" });
    const t = await loadTenant(id);
    if (!t) return res.status(404).json({ success: false, error: "Организация не найдена" });
    return res.json({ success: true, tenant: publicTenantView(t) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/tenant/resolve", async (req, res) => {
  try {
    const slug = String(req.query.slug || "").toLowerCase().trim();
    if (!slug || slug.length > 60) {
      return res.status(400).json({ success: false, error: "Missing slug" });
    }
    const col = admin.firestore().collection("tenants");

    // 1. Прямое попадание в id (org_... или голое имя с - → _).
    for (const id of [slug, `org_${slug.replace(/-/g, "_")}`]) {
      const doc = await col.doc(id).get();
      if (doc.exists) {
        return res.json({ success: true, id: doc.id, name: doc.data()?.name || "" });
      }
    }
    // 2. По субдомену, затем по легаси-полю slug.
    for (const field of ["subdomain", "slug"]) {
      const snap = await col.where(field, "==", slug).limit(1).get();
      if (!snap.empty) {
        return res.json({ success: true, id: snap.docs[0].id, name: snap.docs[0].data()?.name || "" });
      }
    }
    return res.status(404).json({ success: false, error: "Организация не найдена" });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/tenant/finance-summary?tenantId=org_x — изолированный финансовый свод по организации (взносы, выручка, ФОТ зарплат, баланс кассы). */
app.get("/api/tenant/finance-summary", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ success: false, error: "Не указан ID организации" });
    }

    const db = admin.firestore();

    // Деньги организации — только её сотрудникам с правом на зарплаты и кассу
    // (полный доступ его включает). Раньше хватало любого входа на платформу:
    // посторонний читал выручку и список учеников любой школы по её id.
    if (!(await hasAnyPermission(db, req.user, tenantId, ["finance:view", "edu:payroll"]))) {
      return res.status(403).json({ success: false, error: "Недостаточно прав" });
    }

    // 1. Принятые ученики строго в рамках этого tenantId
    const subSnap = await db.collection("submissions")
      .where("tenantId", "==", tenantId)
      .where("finalDecision", "==", "ПРИНЯТ")
      .get();

    let totalInitialFees = 0;
    let totalContractValue = 0;
    let totalMonthlyPaid = 0;
    let acceptedCount = 0;

    const studentTransactions: any[] = [];

    subSnap.forEach(d => {
      const data = d.data();
      acceptedCount++;
      const initFeeStr = String(data.initialFee || "0").replace(/[^\d.]/g, "");
      const totCostStr = String(data.totalCost || "0").replace(/[^\d.]/g, "");
      const mPaidStr = String(data.monthlyPaidSum || data.firstMonthPaymentAmount || "0").replace(/[^\d.]/g, "");
      
      const initFee = parseFloat(initFeeStr) || 0;
      const totCost = parseFloat(totCostStr) || 0;
      const mPaid = parseFloat(mPaidStr) || 0;

      totalInitialFees += initFee;
      totalContractValue += totCost;
      totalMonthlyPaid += mPaid;

      studentTransactions.push({
        id: d.id,
        studentName: data.childName || data.studentName || "Ученик",
        grade: data.grade || "",
        paymentInfo: data.paymentInfo || "MBANK",
        initialFee: initFee,
        monthlyPaidSum: mPaid,
        totalCost: totCost,
        totalPaidIntoCash: initFee + mPaid,
        date: data.submittedAt || data.updatedAt || data.date || null
      });
    });

    // 2. Касса: ручные поступления и расходы, оплаты абонементов и выплаченные
    // зарплаты (на руки + налоги и взносы). Черновики и утверждённые, но не
    // выплаченные ведомости в баланс не входят.
    let totalPayroll = 0, payrollTaxes = 0, cashIncome = 0, cashExpense = 0, cashBalance = 0, currency = "KGS";
    try {
      const sum = await cashSummary(db, tenantId, "0000-01-01", "9999-12-31");
      totalPayroll = sum.payrollPaid; payrollTaxes = sum.payrollTaxes;
      cashIncome = sum.income; cashExpense = sum.expense; cashBalance = sum.closing; currency = sum.currency;
    } catch (e: any) {
      console.warn("[finance-summary] Cash query notice:", e.message);
    }

    // Анкеты приёма уже входят в кассу как «только чтение» — отдельно их не вычитаем.
    const totalCashCollected = cashIncome;
    const netBalance = cashBalance;
    const projectedBalance = netBalance + Math.max(0, totalContractValue - totalInitialFees - totalMonthlyPaid);

    return res.json({
      success: true,
      tenantId,
      acceptedCount,
      totalInitialFees,
      totalContractValue,
      totalMonthlyPaid,
      totalCashCollected,
      totalPayroll,
      payrollTaxes,
      cashExpense,
      currency,
      netBalance,
      projectedBalance,
      studentTransactions
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Старый контур экзаменов и прокси Google Apps Script закрыт.
 *
 * Интерфейс их не вызывает: новые экзамены — /api/exam-public и
 * /api/exam-admin (работы в tenants/{t}/exam_attempts), приём —
 * /api/admissions. Старые ручки были открыты без входа или без проверки
 * организации: перезапись и перенос чужих работ, подмена прокторинга и
 * приостановки, решения о приёме в чужую школу, правка профилей по имени.
 * Отвечаем 410, а не 404 — чтобы забытый внешний вызов было видно в логах.
 */
const RETIRED_ENDPOINTS: [string, string][] = [
  ["post", "/api/exams/start"],
  ["get", "/api/exams/questions"],
  ["post", "/api/exams/telemetry"],
  ["post", "/api/exams/event"],
  ["post", "/api/exams/proctoring-report"],
  ["post", "/api/exams/submit"],
  ["get", "/api/public/check-retake/:shortId"],
  ["post", "/api/gas"],
  ["post", "/api/subscribe"],
];
for (const [method, path] of RETIRED_ENDPOINTS) {
  (app as any)[method](path, (req: express.Request, res: express.Response) => {
    console.warn(`[retired] ${req.method} ${req.originalUrl}`);
    res.status(410).json({ success: false, error: "Этот способ больше не используется" });
  });
}

// Public Data Endpoint for landing page and global settings
app.get("/api/public/data", async (req, res) => {
  try {
    // Только то, что показывает сайт. Подписчики (имя, почта, телефон) и
    // служебные поля настроек наружу не отдаются — их видит суперадмин.
    const db = await readDb();
    const { password: _pw, adminPassword: _apw, ...settings } = (db?.settings || {}) as Record<string, any>;
    return res.json({
      settings,
      speakers: db?.speakers || [],
      program: db?.program || [],
      partners: db?.partners || [],
      tickets: db?.tickets || [],
      metrics: db?.metrics || [],
      universities: db?.universities || [],
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to load public data" });
  }
});

// Режим техработ — в Firestore (system/maintenance), общий для всех экземпляров.
app.get("/api/public/maintenance", async (_req, res) => {
  try { return res.json(await readMaintenance()); }
  catch { return res.json({ enabled: false }); }
});

// 2. Subscribe to newsletter
app.post("/api/public/subscribe", async (req, res) => {
  const { email, name, ticket } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const db = await readDb();
  if (!db.subscribers) db.subscribers = [];
  
  if (!db.subscribers.some((s: any) => s.email === email)) {
    db.subscribers.push({
      id: "sub_" + Date.now(),
      email,
      name: name || "",
      ticket: ticket || "",
      date: new Date().toISOString()
    });
    await writeDb(db);
  }
  res.status(201).json({ success: true });
});

// ADMIN ENDPOINTS

// 1. Administrative Login via Firebase Auth (Fail-Safe Verification)
app.post("/api/admin/login", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, error: "Missing Firebase Auth ID token." });
  }

  try {
    let email = "";
    let uid = "";
    let isSuperAdmin = false;

    try {
      if (admin.apps.length > 0) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        email = decodedToken.email || "";
        uid = decodedToken.uid;
        // Домен почты больше не даёт прав: сотрудник с рабочим адресом
        // становился суперадминистратором платформы. Только явный claim или
        // запись в users/superadmins ниже.
        // Суперадминство живёт в claim isSuperadmin и в коллекции superadmins —
        // их и проверяем. Убирая обход по домену почты, важно было не
        // отрезать настоящего суперадмина, чей users.globalRole равен "user".
        isSuperAdmin = decodedToken.admin === true || decodedToken.isSuperadmin === true;

        if (!isSuperAdmin) {
          // users.globalRole больше не учитывается: этот документ пишет сам
          // пользователь, и любой мог записать себе "superadmin".
          const saDoc = await admin.firestore().collection("superadmins").doc(uid).get();
          isSuperAdmin = saDoc.exists;
        }
      }
    } catch (sdkErr: any) {
      console.warn("[ADMIN_AUTH] Admin SDK verify notice:", sdkErr.message);
    }

    // NOTE: there used to be a fallback here that base64-decoded the JWT payload
    // WITHOUT verifying its signature and granted superadmin on a matching email
    // claim. That is a full authentication bypass — anyone could mint
    // `{"email":"x@studyfreeforum.com"}` as an unsigned token and be let straight
    // into the superadmin console (verified reproducible before removal). Admin SDK
    // verification is now the only accepted path; if it can't run, access is denied.

    if (!isSuperAdmin) {
      console.warn(`[ADMIN_AUTH] Access denied for: ${email || uid}`);
      return res.status(403).json({ success: false, error: "Отказ в доступе. Ваш аккаунт не имеет прав Супер-Администратора." });
    }

    activeSessions.add(idToken);
    console.log(`[ADMIN_AUTH] SuperAdmin verified for: ${email || uid}`);
    return res.json({ success: true, token: idToken, uid, email });
  } catch (err: any) {
    console.error("[ADMIN_AUTH] Login handler error:", err);
    return res.status(200).json({ success: true, token: idToken });
  }
});

// 2. Administrative Check Token via Firebase Auth (Fail-Safe Verification)
app.get("/api/admin/check", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (!token || token === "null" || token === "undefined") {
    return res.json({ success: false, valid: false });
  }

  try {
    let email = "";
    let uid = "";
    let isSuperAdmin = false;

    try {
      if (admin.apps.length > 0) {
        const decoded = await admin.auth().verifyIdToken(token);
        email = decoded.email || "";
        uid = decoded.uid;
        // Суперадминство живёт в claim isSuperadmin и в коллекции superadmins —
        // их и проверяем. Убирая обход по домену почты, важно было не
        // отрезать настоящего суперадмина, чей users.globalRole равен "user".
        isSuperAdmin = decoded.admin === true || decoded.isSuperadmin === true;

        if (!isSuperAdmin) {
          // users.globalRole больше не учитывается: этот документ пишет сам
          // пользователь, и любой мог записать себе "superadmin".
          const saDoc = await admin.firestore().collection("superadmins").doc(uid).get();
          isSuperAdmin = saDoc.exists;
        }
      }
    } catch (sdkErr: any) {}

    // Unsigned-JWT fallback removed here too — see /api/admin/login above.

    if (!isSuperAdmin) {
      return res.json({ success: false, valid: false });
    }

    activeSessions.add(token);
    return res.json({ success: true, valid: true, uid, email });
  } catch (e) {
    return res.json({ success: false, valid: false });
  }
});

// 3. Administrative Logout
app.post("/api/admin/logout", (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// 4. Manager Allow Retake
app.post("/api/manager/allow-retake", requireFirebaseAuth, async (req: any, res) => {
  const { shortId, tenantId } = req.body || {};
  if (!shortId) return res.status(400).json({ error: "shortId is required" });
  if (!tenantId) return res.status(400).json({ error: "Не указана организация" });
  if (!useFirebase) return res.status(500).json({ error: "Firebase not configured" });

  try {
    // Раньше хватало любого входа, а организация бралась из тела запроса:
    // сотрудник одной школы мог разрешать пересдачи в другой.
    const db = admin.firestore();
    const allowed = await hasAnyPermission(db, req.user, String(tenantId), ["tests:review", "tests:manage"]);
    if (!allowed) {
      return res.status(403).json({ error: "Нужно право «Проверка и прокторинг» в этой организации" });
    }
    await db.collection("retakes").doc(String(shortId)).set({
      shortId: String(shortId),
      tenantId: String(tenantId),
      allowed: true,
      allowedBy: req.user.uid,
      timestamp: new Date().toISOString()
    }, { merge: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to allow retake" });
  }
});

// 4. Get administrative state (with subscribers & actual settings with password)
app.get("/api/admin/data", requireSuperadmin, async (req, res) => {
  const db = await readDb();
  res.json(db);
});

// Update Administrative Settings
app.put("/api/admin/settings", requireSuperadmin, async (req, res) => {
  const { eventDate, eventVenue, contactEmail, contactPhone } = req.body;
  const db = await readDb();

  db.settings = {
    eventDate: eventDate || db.settings.eventDate,
    eventVenue: eventVenue || db.settings.eventVenue,
    contactEmail: contactEmail || db.settings.contactEmail,
    contactPhone: contactPhone || db.settings.contactPhone
  };

  await writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// --- Speakers CRUD ---
app.post("/api/admin/speakers", requireSuperadmin, async (req, res) => {
  const { name_ru, name_en, university, major_ru, major_en, admissionYear, story_ru, story_en, lectureTopic_ru, lectureTopic_en, lectureTime, colorTheme, isFeatured, avatarBase64, lat, lng } = req.body;
  
  if (!name_en || !university || !lectureTopic_en) {
    return res.status(400).json({ error: "Speaker name, university and topic are required." });
  }

  const db = await readDb();
  const nextId = String(Number(db.speakers.reduce((max: number, s: any) => Math.max(max, Number(s.id) || 0), 0)) + 1);

  const newSpeaker = {
    id: nextId,
    name_ru: name_ru || name_en,
    name_en: name_en,
    university: university,
    major_ru: major_ru || "",
    major_en: major_en || "",
    admissionYear: admissionYear || "",
    story_ru: story_ru || story_en || "",
    story_en: story_en || "",
    lectureTopic_ru: lectureTopic_ru || lectureTopic_en,
    lectureTopic_en: lectureTopic_en,
    lectureTime: lectureTime || "To Be Determined",
    colorTheme: colorTheme || "blue",
    isFeatured: isFeatured === true || isFeatured === "true",
    avatarBase64: avatarBase64 || "",
    lat: lat,
    lng: lng
  };

  db.speakers.push(newSpeaker);
  await writeDb(db);

  res.status(201).json({ success: true, speaker: newSpeaker });
});

app.post("/api/admin/speakers/bulk", requireSuperadmin, async (req, res) => {
  const { speakers } = req.body;
  if (!Array.isArray(speakers)) {
    return res.status(400).json({ error: "Invalid data format. Expected an array of speakers." });
  }

  const db = await readDb();
  let nextId = Number(db.speakers.reduce((max: number, s: any) => Math.max(max, Number(s.id) || 0), 0)) + 1;
  const newUniversitiesAdded: string[] = [];

  if (!db.universities) db.universities = [];

  for (const speaker of speakers) {
    if (!speaker.name_en || !speaker.university || !speaker.lectureTopic_en) {
      continue; // skip invalid records
    }
    
    // Check if university exists (case insensitive comparison)
    const uniExists = db.universities.some((u: any) => u.name.toLowerCase() === speaker.university.trim().toLowerCase());
    if (!uniExists && !newUniversitiesAdded.some(nu => nu.toLowerCase() === speaker.university.trim().toLowerCase())) {
      const nextUniId = String(Number(db.universities.reduce((max: number, u: any) => Math.max(max, Number(u.id) || 0), 0)) + 1);
      db.universities.push({
        id: nextUniId,
        name: speaker.university.trim(),
        domain: "",
        logoBase64: "",
        logoScale: 1
      });
      newUniversitiesAdded.push(speaker.university.trim());
    }

    const newSpeaker = {
      id: String(nextId++),
      name_ru: speaker.name_ru || speaker.name_en,
      name_en: speaker.name_en,
      university: speaker.university.trim(),
      major_ru: speaker.major_ru || "",
      major_en: speaker.major_en || "",
      admissionYear: speaker.admissionYear || "",
      story_ru: speaker.story_ru || speaker.story_en || "",
      story_en: speaker.story_en || "",
      lectureTopic_ru: speaker.lectureTopic_ru || speaker.lectureTopic_en,
      lectureTopic_en: speaker.lectureTopic_en,
      lectureTime: speaker.lectureTime || "To Be Determined",
      colorTheme: speaker.colorTheme || "blue",
      isFeatured: speaker.isFeatured === true || speaker.isFeatured === "true" || speaker.isFeatured === "TRUE" || speaker.isFeatured === "1",
      avatarBase64: "",
      lat: speaker.lat || "",
      lng: speaker.lng || ""
    };
    db.speakers.push(newSpeaker);
  }

  await writeDb(db);
  res.status(201).json({ success: true, count: speakers.length, newUniversitiesAdded });
});

app.put("/api/admin/speakers/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.speakers.findIndex((s: any) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Speaker not found." });
  }

  const { name_ru, name_en, university, major_ru, major_en, admissionYear, story_ru, story_en, lectureTopic_ru, lectureTopic_en, lectureTime, colorTheme, isFeatured, avatarBase64, lat, lng } = req.body;

  db.speakers[index] = {
    ...db.speakers[index],
    name_ru: name_ru !== undefined ? name_ru : db.speakers[index].name_ru,
    name_en: name_en !== undefined ? name_en : db.speakers[index].name_en,
    university: university !== undefined ? university : db.speakers[index].university,
    major_ru: major_ru !== undefined ? major_ru : db.speakers[index].major_ru,
    major_en: major_en !== undefined ? major_en : db.speakers[index].major_en,
    admissionYear: admissionYear !== undefined ? admissionYear : db.speakers[index].admissionYear,
    story_ru: story_ru !== undefined ? story_ru : db.speakers[index].story_ru,
    story_en: story_en !== undefined ? story_en : db.speakers[index].story_en,
    lectureTopic_ru: lectureTopic_ru !== undefined ? lectureTopic_ru : db.speakers[index].lectureTopic_ru,
    lectureTopic_en: lectureTopic_en !== undefined ? lectureTopic_en : db.speakers[index].lectureTopic_en,
    lectureTime: lectureTime !== undefined ? lectureTime : db.speakers[index].lectureTime,
    colorTheme: colorTheme !== undefined ? colorTheme : db.speakers[index].colorTheme,
    isFeatured: isFeatured !== undefined ? (isFeatured === true || isFeatured === "true") : db.speakers[index].isFeatured,
    avatarBase64: avatarBase64 !== undefined ? avatarBase64 : db.speakers[index].avatarBase64,
    lat: lat !== undefined ? lat : db.speakers[index].lat,
    lng: lng !== undefined ? lng : db.speakers[index].lng
  };

  await writeDb(db);
  res.json({ success: true, speaker: db.speakers[index] });
});

app.delete("/api/admin/speakers/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  
  if (db.speakers) {
    db.speakers = db.speakers.filter((s: any) => String(s.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Schedule / Program CRUD ---
app.post("/api/admin/program", requireSuperadmin, async (req, res) => {
  const { time, title_ru, title_en, description_ru, description_en, speakerId } = req.body;

  if (!time || !title_en) {
    return res.status(400).json({ error: "Time slots and titles are required." });
  }

  const db = await readDb();
  const nextId = "s_" + Date.now();

  const newSlot = {
    id: nextId,
    time: time,
    title_ru: title_ru || title_en,
    title_en: title_en,
    description_ru: description_ru || description_en || "",
    description_en: description_en || "",
    speakerId: speakerId || ""
  };

  db.program.push(newSlot);
  await writeDb(db);
  res.status(201).json({ success: true, slot: newSlot });
});

app.put("/api/admin/program/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.program.findIndex((slot: any) => slot.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Program block not found." });
  }

  const { time, title_ru, title_en, description_ru, description_en, speakerId } = req.body;

  db.program[index] = {
    ...db.program[index],
    time: time !== undefined ? time : db.program[index].time,
    title_ru: title_ru !== undefined ? title_ru : db.program[index].title_ru,
    title_en: title_en !== undefined ? title_en : db.program[index].title_en,
    description_ru: description_ru !== undefined ? description_ru : db.program[index].description_ru,
    description_en: description_en !== undefined ? description_en : db.program[index].description_en,
    speakerId: speakerId !== undefined ? speakerId : db.program[index].speakerId
  };

  await writeDb(db);
  res.json({ success: true, slot: db.program[index] });
});

app.delete("/api/admin/program/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  
  if (db.program) {
    db.program = db.program.filter((p: any) => String(p.id) !== String(id));
  }
  await writeDb(db);
  res.status(200).json({ success: true });
});

// --- Universities CRUD ---

app.post("/api/admin/universities", requireSuperadmin, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  
  const newUniversity = {
    id: "uni_" + Date.now(),
    name: req.body.name || "",
    domain: req.body.domain || "",
    logoBase64: req.body.logoBase64 || ""
  };
  
  db.universities.push(newUniversity);
  await writeDb(db);
  res.status(201).json({ success: true, university: newUniversity });
});

app.put("/api/admin/universities/:id", requireSuperadmin, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  const idx = db.universities.findIndex((u: any) => String(u.id) === String(req.params.id));
  if (idx !== -1) {
    db.universities[idx] = { ...db.universities[idx], ...req.body };
    await writeDb(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "University not found" });
  }
});

app.delete("/api/admin/universities/:id", requireSuperadmin, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  db.universities = db.universities.filter((u: any) => String(u.id) !== String(req.params.id));
  await writeDb(db);
  res.json({ success: true });
});

// --- Partners CRUD ---
app.post("/api/admin/partners", requireSuperadmin, async (req, res) => {
  const { name, role_ru, role_en, tier, url, logoUrl, logoBase64 } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Partner name is required." });
  }

  const db = await readDb();
  const nextId = "p_" + Date.now();

  const newPartner = {
    id: nextId,
    name: name,
    role_ru: role_ru || "",
    role_en: role_en || "",
    tier: tier || "partner",
    url: url || "",
    logoUrl: logoUrl || "",
    logoBase64: logoBase64 || ""
  };

  db.partners.push(newPartner);
  await writeDb(db);
  res.status(201).json({ success: true, partner: newPartner });
});

app.put("/api/admin/partners/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.partners.findIndex((p: any) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Partner not found." });
  }

  const { name, role_ru, role_en, tier, url, logoUrl, logoBase64 } = req.body;

  db.partners[index] = {
    ...db.partners[index],
    name: name !== undefined ? name : db.partners[index].name,
    role_ru: role_ru !== undefined ? role_ru : db.partners[index].role_ru,
    role_en: role_en !== undefined ? role_en : db.partners[index].role_en,
    tier: tier !== undefined ? tier : db.partners[index].tier,
    url: url !== undefined ? url : db.partners[index].url,
    logoUrl: logoUrl !== undefined ? logoUrl : db.partners[index].logoUrl,
    logoBase64: logoBase64 !== undefined ? logoBase64 : db.partners[index].logoBase64
  };

  await writeDb(db);
  res.json({ success: true, partner: db.partners[index] });
});

app.delete("/api/admin/partners/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();

  if (db.partners) {
    db.partners = db.partners.filter((p: any) => String(p.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Tickets CRUD ---
app.post("/api/admin/tickets", requireSuperadmin, async (req, res) => {
  const { name_ru, name_en, name_kg, price, features_ru, features_en, features_kg, url } = req.body;
  if (!name_en) return res.status(400).json({ error: "Ticket name is required." });
  
  const db = await readDb();
  const nextId = "t_" + Date.now();
  db.tickets.push({
    id: nextId, name_ru, name_en, name_kg, price, features_ru, features_en, features_kg, url
  });
  await writeDb(db);
  res.status(201).json({ success: true });
});



app.delete("/api/admin/tickets/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (db.tickets) {
    db.tickets = db.tickets.filter((t: any) => String(t.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Metrics CRUD ---
app.post("/api/admin/metrics", requireSuperadmin, async (req, res) => {
  const { value, label_ru, label_en, sublabel_ru, sublabel_en, order } = req.body;
  if (!value || !label_en) {
    return res.status(400).json({ error: "Value and English Label are required." });
  }

  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  const nextId = "m_" + Date.now();
  const newMetric = {
    id: nextId,
    value,
    label_ru: label_ru || label_en,
    label_en,
    sublabel_ru: sublabel_ru || "",
    sublabel_en: sublabel_en || "",
    order: order || db.metrics.length + 1
  };

  db.metrics.push(newMetric);
  db.metrics.sort((a: any, b: any) => a.order - b.order);
  await writeDb(db);
  res.status(201).json({ success: true, metric: newMetric });
});

app.put("/api/admin/metrics/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  const index = db.metrics.findIndex((m: any) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Metric not found." });
  }

  const { value, label_ru, label_en, sublabel_ru, sublabel_en, order } = req.body;

  db.metrics[index] = {
    ...db.metrics[index],
    value: value !== undefined ? value : db.metrics[index].value,
    label_ru: label_ru !== undefined ? label_ru : db.metrics[index].label_ru,
    label_en: label_en !== undefined ? label_en : db.metrics[index].label_en,
    sublabel_ru: sublabel_ru !== undefined ? sublabel_ru : db.metrics[index].sublabel_ru,
    sublabel_en: sublabel_en !== undefined ? sublabel_en : db.metrics[index].sublabel_en,
    order: order !== undefined ? order : db.metrics[index].order
  };

  db.metrics.sort((a: any, b: any) => a.order - b.order);
  await writeDb(db);
  res.json({ success: true, metric: db.metrics[index] });
});

app.delete("/api/admin/metrics/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  db.metrics = db.metrics.filter((m: any) => m.id !== id);
  await writeDb(db);
  res.json({ success: true });
});

// --- Tickets Configuration ---
app.put("/api/admin/tickets/:id", requireSuperadmin, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.tickets.findIndex((t: any) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Ticket category not found." });
  }

  const { name_ru, name_en, price, features_ru, features_en, url, utm_source, utm_medium, utm_campaign } = req.body;

  db.tickets[index] = {
    ...db.tickets[index],
    name_ru: name_ru !== undefined ? name_ru : db.tickets[index].name_ru,
    name_en: name_en !== undefined ? name_en : db.tickets[index].name_en,
    price: price !== undefined ? price : db.tickets[index].price,
    features_ru: features_ru !== undefined ? (Array.isArray(features_ru) ? features_ru : JSON.parse(features_ru)) : db.tickets[index].features_ru,
    features_en: features_en !== undefined ? (Array.isArray(features_en) ? features_en : JSON.parse(features_en)) : db.tickets[index].features_en,
    url: url !== undefined ? url : db.tickets[index].url,
    utm_source: utm_source !== undefined ? utm_source : db.tickets[index].utm_source,
    utm_medium: utm_medium !== undefined ? utm_medium : db.tickets[index].utm_medium,
    utm_campaign: utm_campaign !== undefined ? utm_campaign : db.tickets[index].utm_campaign
  };

  await writeDb(db);
  res.json({ success: true, ticket: db.tickets[index] });
});

// Export Subscribers to CSV
app.get("/api/admin/subscribers/export", requireSuperadmin, async (req, res) => {
  try {
    const db = await readDb();
    const subs = db.subscribers || [];

    // Construct CSV content
    let csvContent = '\uFEFF'; // Add BOM for excel support
    csvContent += "ID,Name,Email,Phone,Registration Date (UTC)\n";

    subs.forEach((s: any) => {
      // Escape potential quotes in values
      const name = `"${(s.name || "").replace(/"/g, '""')}"`;
      const email = `"${(s.email || "").replace(/"/g, '""')}"`;
      const phone = `"${(s.phone || "").replace(/"/g, '""')}"`;
      const date = `"${new Date(s.timestamp || "").toISOString()}"`;
      csvContent += `${s.id},${name},${email},${phone},${date}\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=educational_forum_mailing_list.csv");
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to compile mailing base database." });
  }
});


// Dev vs Production Setup for Vite Frontend Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully activated on http://localhost:${PORT}`);
  });
}

// Global Error Handler — Return Real Error Status
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[SERVER_ERROR]", err.message, { path: req.path, method: req.method });
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

// Only start the server locally. Vercel will import the app and use it as a serverless function.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
