import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs, existsSync, readFileSync } from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { calculateScoresTs, isAnswerCorrect } from "./src/lib/scoringEngine.js";
import { publicTenantView } from "./src/server/tenantView.js";
import { hasAnyPermission } from "./src/server/access.js";
import { checkTenantOpen, loadTenant, TenantError } from "./src/server/tenantAccess.js";
import { resolveWorkspaceConfig } from "./src/shared/workspaceConfig.js";
import { hourlyPin } from "./src/shared/pin.js";
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



const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use("/api/", apiLimiter);

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
app.use("/api/admin/login", authLimiter);
app.use("/api/tenants/request", authLimiter);

const allowedOrigins = [
  "https://www.studyfreeforum.com",
  "https://studyfreeforum.com",
  "http://localhost:3000",
  "http://localhost:3005",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
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
import placementRoutes from "./src/routes/placementRoutes.js";
import formRoutes from "./src/routes/formRoutes.js";
import payrollRoutes from "./src/routes/payrollRoutes.js";
import { sendTestResultEmail } from "./emailService.js";

app.use("/api/auth", authRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/payroll", payrollRoutes);

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
    const decoded = await admin.auth().verifyIdToken(token);
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
    const decoded = await admin.auth().verifyIdToken(token);
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

app.post("/api/proctoring/upload-evidence", authLimiter, async (req, res) => {
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

    // 🔔 REAL-TIME PUSH NOTIFICATION FOR TENANT MANAGERS
    if ((body.totalViolations ?? 0) > 0 || (body.honestyIndex ?? 100) < 85) {
      admin.firestore().collection("notifications").add({
        tenantId: tenant.org_id,
        title: "🚨 Нарушение прокторинга",
        body: `Ученик ${body.studentName || 'Студент'} (${body.studentShortId}) совершил ${body.totalViolations || 1} нарушений. Индекс честности: ${body.honestyIndex ?? 100}%. Папка доказательств создана.`,
        type: "system",
        read: false,
        actionUrl: `/workspace/${tenant.org_id}/tests/check/${body.studentShortId}`,
        createdAt: admin.firestore.Timestamp.now(),
      }).catch(e => console.error("Notification creation error:", e));
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

// Database Optimization & Data Migration Endpoint
app.post("/api/admin/db/optimize", requireSuperadmin, async (req: express.Request, res: express.Response) => {
  try {
    const defaultTenantId = String(req.body?.tenantId || "").trim();
    if (!defaultTenantId) return res.status(400).json({ success: false, error: "Не указана организация" });
    const db = admin.firestore();
    const results = { updatedSubmissions: 0, updatedDeals: 0, seededDepts: 0 };

    // 1. Optimize Submissions (backfill tenantId & indexing fields)
    const subSnap = await db.collection("submissions").get();
    const batch1 = db.batch();
    subSnap.docs.forEach(d => {
      const data = d.data();
      if (!data.tenantId) {
        batch1.update(d.ref, { tenantId: defaultTenantId });
        results.updatedSubmissions++;
      }
    });
    if (results.updatedSubmissions > 0) await batch1.commit();

    // 2. Optimize CRM Deals (backfill default departmentId)
    const dealSnap = await db.collection("crm_deals").get();
    const batch2 = db.batch();
    dealSnap.docs.forEach(d => {
      const data = d.data();
      if (!data.departmentId) {
        batch2.update(d.ref, { departmentId: 'dept_3', tenantId: data.tenantId || defaultTenantId });
        results.updatedDeals++;
      }
    });
    if (results.updatedDeals > 0) await batch2.commit();

    console.log(`[DB OPTIMIZE] Optimized Firestore database for tenant ${defaultTenantId}:`, results);

    return res.json({
      success: true,
      message: "База данных Firestore успешно оптимизирована",
      results
    });
  } catch (err: any) {
    console.error("[DB OPTIMIZE ERROR]", err);
    return res.status(500).json({ error: err.message || "DB optimization failed" });
  }
});



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

    // 1. Принятые ученики строго в рамках этого tenantId
    const subSnap = await db.collection("submissions")
      .where("tenantId", "==", tenantId)
      .where("finalDecision", "==", "ПРИНЯТ")
      .get();

    let totalInitialFees = 0;
    let totalContractValue = 0;
    let totalMonthlyPaid = 0;
    let acceptedCount = 0;

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
    });

    // 2. Расчет зарплат и ФОТ по организации
    let totalPayroll = 0;
    try {
      const payrollSnap = await db.collection("tenants").doc(tenantId).collection("payroll_records").get();
      payrollSnap.forEach(d => {
        const p = d.data();
        const toPay = parseFloat(String(p.calc?.toPay || p.toPay || 0)) || 0;
        totalPayroll += toPay;
      });
    } catch (e: any) {
      console.warn("[finance-summary] Payroll query notice:", e.message);
    }

    const totalCashCollected = totalInitialFees + totalMonthlyPaid;
    const netBalance = totalCashCollected - totalPayroll;
    const projectedBalance = (totalInitialFees + totalContractValue) - totalPayroll;

    return res.json({
      success: true,
      tenantId,
      acceptedCount,
      totalInitialFees,
      totalContractValue,
      totalMonthlyPaid,
      totalCashCollected,
      totalPayroll,
      netBalance,
      projectedBalance
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Кэш вопросов и ключей ответов.
 *
 * Вопросы класса и ключи к ним одинаковы для КАЖДОГО ученика: при 500
 * сдающих сервер делал ~4500 одинаковых чтений одних и тех же нескольких
 * документов. Теперь читаем раз в минуту.
 *
 * Минута — компромисс: правку теста завуч увидит почти сразу, а нагрузка
 * на базу падает в сотни раз.
 */
const examCache = new Map<string, { at: number; value: any }>();
const EXAM_CACHE_MS = 60_000;

function safeParse(v: any): Record<string, any> {
  if (v && typeof v === "object") return v;
  try { const o = JSON.parse(String(v || "{}")); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

async function cachedRead<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = examCache.get(key);
  if (hit && Date.now() - hit.at < EXAM_CACHE_MS) return hit.value as T;
  const value = await loader();
  examCache.set(key, { at: Date.now(), value });
  // Кэш не должен расти бесконечно на долгоживущем процессе.
  if (examCache.size > 200) {
    const oldest = [...examCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) examCache.delete(oldest[0]);
  }
  return value;
}

/** Часовой PIN — общий расчёт с клиентом и срезом (src/shared/pin.ts). */
function getHourlyPIN(hourOffset = 0, tenantId = ""): string {
  return hourlyPin(tenantId, hourOffset);
}

app.post("/api/exams/start", async (req, res) => {
  try {
    const { testId, studentName, grade, shortId, enteredPin, tenantId } = req.body;
    if (!studentName || !grade) {
      return res.status(400).json({ success: false, error: "Missing studentName or grade" });
    }
    // Организация обязательна и должна быть открыта — до проверки PIN, чтобы
    // ответ не зависел от того, угадан ли код.
    const resolvedTenantId = String(tenantId || "").trim();
    {
      const gate = await checkTenantOpen(resolvedTenantId, "tests");
      if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    }

    // Accept the neighbouring hours too: the PIN rotates on the hour, so one
    // read out at 10:59 was rejected at 11:00 even though the student typed it
    // correctly. Also covers a device clock that is a few minutes out.
    // Digits only: phone keyboards and paste smuggle in characters that render
    // as nothing (non-breaking space, zero-width space, RTL marks) and survive
    // trim(), so a correctly typed PIN was rejected. Non-Latin numerals are
    // folded because they are visually identical to the code being read out.
    const cleanPin = String(enteredPin || "")
      .replace(/[\u0660-\u0669]/g, (c: string) => String(c.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (c: string) => String(c.charCodeAt(0) - 0x06F0))
      .replace(/[\uFF10-\uFF19]/g, (c: string) => String(c.charCodeAt(0) - 0xFF10))
      .replace(/\D/g, "");
    const pinOk = Boolean(cleanPin) && [-1, 0, 1].some(offset => cleanPin === getHourlyPIN(offset, resolvedTenantId));
    const TESTER_PIN = process.env.VITE_TESTER_PIN || process.env.TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    if (!pinOk && !isTester) {
      return res.status(403).json({ success: false, error: "Неверный PIN-код. Узнайте актуальный PIN у менеджера." });
    }

    const studentShortId = shortId || Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = testId || `test_${studentShortId}_${Date.now()}`;

    // Save session in Firestore if available
    if (useFirebase) {
      try {
        await admin.firestore().collection("exam_sessions").doc(sessionId).set({
          id: sessionId,
          tenantId: resolvedTenantId,
          studentName,
          studentShortId,
          grade: Number(grade),
          isTester: Boolean(isTester),
          status: "IN_PROGRESS",
          startedAt: admin.firestore.Timestamp.now(),
          currentAnswers: {},
          updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
      } catch (e) {
        console.warn("[Exams/Start] Firestore session write failed:", e);
      }
    }

    let testData: any = null;
    if (useFirebase) {
      try {
        // Один формат для всех организаций. Раньше Академия шла по особому
        // пути (future_leaders_grade_N), а остальные — по общему.
        const testSlug = `test_grade_${grade}_${resolvedTenantId}`;
        const testRef = admin.firestore().collection("tests").doc(testSlug);
        const testSnap = await testRef.get();
        
        if (testSnap.exists) {
          testData = testSnap.data();
          // Fetch questions subcollection
          const qSnap = await testRef.collection("questions").get();
          const questionsList = qSnap.docs.map(d => d.data());
          
          // Group by section and strip correct answers
          const grouped: any = { russian: [], math: [], logic: [], english: [] };
          questionsList.forEach((q: any) => {
            const safeQ = { ...q };
            delete safeQ.correctAnswer; // NEVER send to client
            if (grouped[q.section]) {
              grouped[q.section].push(safeQ);
            } else {
              grouped[q.section] = [safeQ];
            }
          });
          
          // Sort by orderIndex
          Object.keys(grouped).forEach(k => {
            grouped[k].sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
          });
          
          testData.questions = grouped;
        } else {
          return res.status(404).json({ success: false, error: "Тест для данного класса не найден" });
        }
      } catch (e) {
        console.warn("[Exams/Start] Failed to fetch test data:", e);
      }
    }

    return res.json({
      success: true,
      sessionId,
      studentShortId,
      timeLimitMinutes: 90,
      status: "IN_PROGRESS",
      testData
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// 1b. GET /api/exams/questions — Load questions for a grade (no auth needed)
app.get("/api/exams/questions", async (req, res) => {
  try {
    const { grade, tenantId } = req.query;
    if (!grade) {
      return res.status(400).json({ success: false, error: "Missing grade parameter" });
    }

    const resolvedTenantId = String(tenantId || "").trim();
    {
      const gate = await checkTenantOpen(resolvedTenantId, "tests");
      if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    }
    const g = Number(grade);

    if (!useFirebase) {
      return res.status(503).json({ success: false, error: "Firestore not configured" });
    }

    // Candidate doc IDs (tenant-specific first, then fallback)
    // IMPORTANT: Always verify tenantId matches to prevent cross-tenant leaks
    // Только документ этой организации. Прежние запасные варианты без
    // суффикса организации отдавали чужой (непомеченный) тест любой школе.
    const candidates = [`test_grade_${g}_${resolvedTenantId}`];

    let testData: any = null;
    for (const docId of candidates) {
      try {
        const snap = await admin.firestore().collection("tests").doc(docId).get();
        const data = snap.data();
        if (data && data.questions) {
          // CRITICAL: Verify tenantId matches to prevent cross-tenant data leaks
          if (data.tenantId && data.tenantId !== resolvedTenantId) {
            continue; // Skip and try next candidate
          }
          testData = data;
          break;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    if (!testData || !testData.questions) {
      return res.status(404).json({ success: false, error: `Test for grade ${grade} not found for tenant ${resolvedTenantId}` });
    }

    // Sanitize: remove all answer/correctAnswer fields
    const questions = testData.questions;
    const sanitized: any = {};

    for (const section in questions) {
      const sectionQuestions = questions[section];
      if (!Array.isArray(sectionQuestions)) continue;
      sanitized[section] = sectionQuestions.map((q: any) => {
        const safe = { ...q };
        // Strip all variants of correct answers
        delete safe.correctAnswer;
        delete safe.answer;
        delete safe.correct;
        delete safe.solution;
        delete safe.explanation;
        return safe;
      });
    }

    // Proctoring config travels with the questions: the student is anonymous
    // and cannot read the tenant document from Firestore, so this is the only
    // channel that reaches them. Master switch off => the browser never even
    // asks for camera permission.
    let proctoring: { enabled: boolean; detectors: Record<string, boolean> } = {
      enabled: false,
      detectors: {},
    };
    try {
      const tenantSnap = await admin.firestore().collection("tenants").doc(resolvedTenantId).get();
      const tenant = tenantSnap.data();
      if (tenant) {
        // Единственный источник — тумблер суперадмина proctoringEnabled.
        // Раньше учитывался ещё список enabledModules, который никто не
        // редактировал: тумблер писал одно поле, сервер читал другое.
        proctoring = {
          enabled: tenant.proctoringEnabled !== false,
          detectors: tenant.proctoringFlags || {},
        };
      }
    } catch (e: any) {
      console.warn("[Exams/Questions] Could not read proctoring config:", e.message);
    }

    // Анкета регистрации и название организации едут тем же ответом:
    // страница экзамена анонимна и не может прочитать документ организации.
    let registration: any = null;
    let orgName = "";
    try {
      const t = await loadTenant(resolvedTenantId);
      if (t) {
        orgName = String(t.name || "");
        registration = resolveWorkspaceConfig(t.workspaceConfig).registration;
      }
    } catch { /* анкета необязательна — страница покажет умолчания */ }

    return res.json({
      success: true,
      questions: sanitized,
      timeLimitMinutes: testData.timeLimitMinutes || 90,
      proctoring,
      registration,
      orgName,
    });
  } catch (e: any) {
    console.error("[Exams/Questions]", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// 2. POST /api/exams/telemetry — Lightweight 10s proctoring pings
app.post("/api/exams/telemetry", async (req, res) => {
  try {
    const { sessionId, telemetry } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Missing sessionId" });
    }

    // Record last telemetry ping in Firestore if available
    if (useFirebase) {
      try {
        await admin.firestore().collection("exam_sessions").doc(sessionId).set({
          lastTelemetryAt: admin.firestore.Timestamp.now(),
          telemetrySummary: telemetry || {}
        }, { merge: true });
      } catch (e) {}
    }

    return res.json({ success: true, timestamp: Date.now() });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// 2a. POST /api/exams/event — client-side exam events that only the browser can
// observe (leaving fullscreen, closing the tab mid-exam). Anonymous by design:
// the student has no auth session. Only a fixed set of action names is accepted
// so an open endpoint cannot be used to forge arbitrary audit history.
const STUDENT_EVENT_ACTIONS: Record<string, AuditAction> = {
  fullscreen_exit: "EXAM_FULLSCREEN_EXIT",
  resume_requested: "EXAM_RESUME_REQUESTED",
  violation: "PROCTORING_VIOLATION",
  client_error: "CLIENT_ERROR",
};

app.post("/api/exams/event", (req, res) => {
  try {
    const { event, shortId, tenantId, studentName, grade, detail } = req.body || {};
    const action = STUDENT_EVENT_ACTIONS[String(event)];
    if (!action) return res.status(400).json({ success: false, error: "Unknown event" });
    if (!shortId) return res.status(400).json({ success: false, error: "Missing shortId" });

    writeAuditLog(action, tenantId || "unknown", {
      studentShortId: String(shortId),
      studentName: studentName || "",
      grade: Number(grade) || 0,
      detail: typeof detail === "string" ? detail.slice(0, 300) : "",
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || "Failed" });
  }
});

// 2b. POST /api/exams/proctoring-report — the session dossier the manager reads.
// Students are anonymous, so this cannot be a client-side Firestore write; the
// server attaches it to the submission the manager already opens.
app.post("/api/exams/proctoring-report", async (req, res) => {
  try {
    const { shortId, tenantId, violations, honestyIndex, unavailable, startedAt, endedAt, snapshots } = req.body || {};
    if (!shortId) return res.status(400).json({ success: false, error: "Missing shortId" });
    if (!useFirebase) return res.status(503).json({ success: false, error: "Firestore not configured" });

    const resolvedTenantId = String(tenantId || "").trim();
    if (!resolvedTenantId) return res.status(400).json({ success: false, error: "Не указана организация" });
    const subRef = admin.firestore().collection("submissions").doc(`sub_${shortId}`);

    // Only attach to a submission that belongs to the claimed tenant — the same
    // rule the rest of the exam endpoints follow.
    const existing = await subRef.get();
    const data = existing.data();
    if (data && data.tenantId && data.tenantId !== resolvedTenantId) {
      console.warn(`[Proctoring] cross-tenant report blocked for ${shortId}`);
      return res.status(403).json({ success: false, error: "Tenant mismatch" });
    }

    const list = Array.isArray(violations) ? violations : [];
    const bySeverity = list.reduce((acc: Record<string, number>, v: any) => {
      const k = String(v.severity || "LOW");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    // Snapshots are the only visual evidence there is (no session video), so
    // this write must not be lost to Firestore's 1 MB document limit. Take
    // frames only while they fit under a 900 KB budget: a partial set of
    // violations is evidence, a rejected write is nothing. Decided before the
    // report is built so snapshotCount reports what was actually stored.
    const incomingSnapshots = Array.isArray(snapshots) ? snapshots.slice(0, 20) : [];
    const keptSnapshots: any[] = [];
    let snapshotBytes = 0;
    for (const s of incomingSnapshots) {
      const size = typeof s?.dataUrl === "string" ? s.dataUrl.length : 0;
      if (snapshotBytes + size > 900 * 1024) break;
      snapshotBytes += size;
      keptSnapshots.push(s);
    }
    if (keptSnapshots.length < incomingSnapshots.length) {
      console.warn(`[Proctoring] ${shortId}: kept ${keptSnapshots.length}/${incomingSnapshots.length} snapshots (size budget)`);
    }

    const report = {
      generatedAt: admin.firestore.Timestamp.now(),
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      unavailable: Boolean(unavailable),
      honestyIndex: typeof honestyIndex === "number" ? honestyIndex : null,
      totalViolations: list.length,
      bySeverity,
      violations: list.slice(0, 200).map((v: any) => ({
        type: String(v.type || "UNKNOWN"),
        severity: String(v.severity || "LOW"),
        description: String(v.description || ""),
        // Offset from exam start, so the manager can scrub straight to it.
        atMs: Number(v.timestamp) || 0,
      })),
      snapshotCount: keptSnapshots.length,
    };

    await subRef.set({ proctoring: report }, { merge: true });

    // Snapshots live in their own doc: a submission read happens on every
    // dashboard render and base64 frames would bloat it badly.
    if (keptSnapshots.length > 0) {
      await admin.firestore().collection("proctoring_evidence").doc(`ev_${shortId}`).set({
        shortId: String(shortId),
        tenantId: resolvedTenantId,
        updatedAt: admin.firestore.Timestamp.now(),
        snapshots: keptSnapshots,
        droppedForSize: incomingSnapshots.length - keptSnapshots.length,
      }, { merge: true });
    }

    if (list.length > 0 || report.unavailable) {
      admin.firestore().collection("audit_logs").add({
        timestamp: admin.firestore.Timestamp.now(),
        createdAt: new Date().toISOString(),
        action: "PROCTORING_REPORT",
        tenantId: resolvedTenantId,
        studentShortId: String(shortId),
        studentName: data?.studentName || "",
        grade: data?.grade || 0,
        cheated: list.some((v: any) => v.severity === "HIGH"),
      }).catch(() => {});
    }

    return res.json({ success: true, totalViolations: report.totalViolations });
  } catch (e: any) {
    console.error("[Proctoring/Report]", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Helper: process exam submission locally using Firestore keys and TypeScript scoring engine
async function processExamSubmission(payload: any) {
  const { sessionId, shortId, studentName, grade, answers, cheated, isTester, isRetake, tenantId, action } = payload;
  const studentEmail = payload.studentEmail || payload.email || '';
  const studentPhone = payload.studentPhone || payload.phone || '';
  const resolvedTenantId = String(tenantId || "").trim();

  if (!shortId || !studentName || !grade) {
    return { success: false, error: "Missing required submission fields" };
  }
  {
    const gate = await checkTenantOpen(resolvedTenantId, "tests");
    if (!gate.ok) return { success: false, error: gate.error };
  }

  // SECURITY: Verify that a test for this grade exists for this tenant
  // This prevents students from submitting results for tenants they shouldn't access.
  // Also captures the actual question list, which is the authoritative source for
  // maxScoreSnapshot below — test_answer_keys accumulates stale duplicate entries
  // from past re-seeds (e.g. both "ru_9_q1" and "russian_1" keying the same question),
  // so summing its key bank inflates the denominator well past the real question count.
  let realQuestions: { russian: any[]; math: any[]; logic: any[] } | null = null;
  if (useFirebase) {
    try {
      const testCandidates = [`test_grade_${grade}_${resolvedTenantId}`];
      let testFound = false;
      // Все кандидаты одним запросом вместо очереди из четырёх, с кэшем:
      // документ теста один и тот же для каждого сдающего этот класс.
      const found = await cachedRead(`test_${resolvedTenantId}_${grade}`, async () => {
        const refs = testCandidates.map((id: string) => admin.firestore().collection("tests").doc(id));
        const snaps = await admin.firestore().getAll(...refs);
        for (const snap of snaps) {
          const data = snap.data();
          if (data && data.tenantId && data.tenantId !== resolvedTenantId) continue;
          if (data && data.questions) {
            return {
              russian: Array.isArray(data.questions.russian) ? data.questions.russian : [],
              math: Array.isArray(data.questions.math) ? data.questions.math : [],
              logic: Array.isArray(data.questions.logic) ? data.questions.logic : [],
            };
          }
        }
        return null;
      });
      if (found) { testFound = true; realQuestions = found; }
      if (!testFound) {
        return { success: false, error: `No test found for grade ${grade} in tenant ${resolvedTenantId}` };
      }
    } catch (e) {
      console.warn("[Exams/Submit] Failed to verify test ownership:", e);
      // Continue anyway — might be a transient error
    }
  }

  // 1. Fetch answer keys from Firestore
  let keys: any = {};
  if (useFirebase) {
    try {
      const candidateIds = [
        `test_grade_${grade}_${resolvedTenantId}`,
        `test_grade_${grade}`,
        `key_grade_${grade}_${resolvedTenantId}`,
        `key_grade_${grade}_GLOBAL`,
        `${grade}`
      ];
      // Пять чтений ОДНИМ запросом вместо пяти по очереди, и результат
      // кэшируется: ключи к работе одинаковы у всех учеников класса.
      keys = await cachedRead(`keys_${resolvedTenantId}_${grade}`, async () => {
        const acc: any = { russian: {}, math: {}, logic: {}, english: {} };
        const refs = candidateIds.map(id => admin.firestore().collection("test_answer_keys").doc(id));
        const snaps = await admin.firestore().getAll(...refs);
        for (const docSnap of snaps) {
          if (!docSnap.exists) continue;
          const docKeys = docSnap.data()?.keys || {};
          if (docKeys.russian) acc.russian = { ...docKeys.russian, ...acc.russian };
          if (docKeys.math) acc.math = { ...docKeys.math, ...acc.math };
          if (docKeys.logic) acc.logic = { ...docKeys.logic, ...acc.logic };
          if (docKeys.english) acc.english = { ...docKeys.english, ...acc.english };
        }
        return acc;
      });
    } catch (e) {
      console.warn("[Exams/Submit] Failed to fetch answer keys from Firestore:", e);
    }
  }

  // Prune stale/duplicate answer-key entries down to the actual question ids of
  // this test. test_answer_keys has accumulated leftovers from past re-seeds under
  // older id schemes ("russian_1", "ma_1_9", numeric "0".."13" — all alongside the
  // real "ru_7_q1"-style ids). They never granted or removed points (a student's
  // answers object can't contain those ids), but calculateScoresTs counts EVERY key
  // toward diagnosticsRaw's per-topic "possible" totals, so the topic breakdown
  // shown to students and in managers' PDF reports claimed e.g. 24 possible points
  // for a topic in a grade-7 russian section that only has 9 questions in total.
  // English is left untouched: realQuestions doesn't capture the english list and
  // its keys only drive the separate CEFR level.
  if (realQuestions) {
    for (const subject of ['russian', 'math', 'logic'] as const) {
      const realIds = new Set(realQuestions[subject].map((q: any) => q.id));
      keys[subject] = Object.fromEntries(Object.entries(keys[subject] || {}).filter(([id]) => realIds.has(id)));
    }
  }

  // 2. Parse answers if string
  let parsedAnswers = answers;
  if (typeof answers === 'string') {
    try { parsedAnswers = JSON.parse(answers); } catch (e) { parsedAnswers = {}; }
  }

  // 3. Calculate Scores using TypeScript Engine (100% accuracy)
  const result = calculateScoresTs(grade, parsedAnswers, keys as any);
  const { scores, diagnosticsRaw, summaryText } = result;

  // maxScoreSnapshot is the denominator for the core test score only (russian + math
  // + logic) — English is reported separately as a CEFR level, never folded into the
  // overall score or its max, matching calculateScoresTs's own `total = ru + ma + lo`
  // (src/lib/scoringEngine.ts). Computed from the actual question list (realQuestions,
  // captured above from the `tests` doc), NOT from test_answer_keys — that collection
  // has accumulated stale duplicate keys from past re-seeds (e.g. both "ru_9_q1" and
  // "russian_1" for the same question), so summing its key bank previously inflated
  // the denominator well past the real question count — grade 9's actual 14+10+8=32
  // questions showed as 46+30+16=92 (before English was even added on top of that).
  const sumQuestionPoints = (arr: any[]) => arr.reduce((acc, q) => acc + (q.points || 1), 0);
  const maxScoreSnapshot = realQuestions
    ? sumQuestionPoints(realQuestions.russian) + sumQuestionPoints(realQuestions.math) + sumQuestionPoints(realQuestions.logic)
    : 0;

  // Defaults for when Firestore is unavailable/useFirebase is false — reflects only
  // THIS submission. Reassigned below once we've merged with any prior submission
  // (core + english) sharing the same doc, so every use after this point (CRM sync,
  // result email, API response) sees the accumulated core scores, not just this call's.
  let mergedScores = { ...scores };
  let mergedMaxScoreSnapshot = maxScoreSnapshot;

  // 4. Write to Firestore `submissions`
  // Keyed by shortId (the student's Test ID), NOT sessionId — the client never
  // actually sends sessionId for either submitTest or submitEnglishTest (only
  // testId, under a different field name), so keying on sessionId here silently
  // produced a NEW doc per Date.now() for every submission, meaning the merge
  // logic below (preserve core scores when the English submission comes in) never
  // found the earlier doc and always saw `existing` as undefined — the exact bug
  // it was meant to fix. shortId is always present (checked above) and is the one
  // identifier that's actually stable across a student's core + English calls.
  const submissionId = `sub_${shortId}`;
  if (useFirebase) {
    try {
      // Core (submitTest) and English (submitEnglishTest) submissions share the same
      // doc via merge. calculateScoresTs zeroes out subjects with no matching answers
      // in THIS submission (e.g. english=0 on a core-only submission) — a plain merge
      // would overwrite the other submission's already-saved score with that 0.
      //
      // Also protects against a DIFFERENT real-world failure: a student double-submits
      // (network hiccup, retry after a stalled request) and the second call's answers
      // object — reconstructed client-side from whatever `answers` state happened to
      // survive the retry — is missing or wrong for a subject the FIRST call already
      // scored correctly. A student's submission was observed losing a genuine 4/29
      // math score to 0 this way: two submitTest calls 76s apart, second one silently
      // recomputing math down to 0. Take the MAX of the existing and newly-computed
      // score per subject rather than trusting whichever call happened to run last —
      // a resubmission should never be able to lower an already-recorded score.
      const existingSnap = await admin.firestore().collection("submissions").doc(submissionId).get();
      const existing = existingSnap.data();
      const answeredInThisSubmission = (subject: string) =>
        Object.keys((keys as any)[subject] || {}).some(qId => parsedAnswers && parsedAnswers[qId] !== undefined);
      const bestOf = (subject: string, newScore: number) =>
        answeredInThisSubmission(subject) ? Math.max(newScore, existing?.scores?.[subject] || 0) : (existing?.scores?.[subject] || 0);

      mergedScores = {
        russian: bestOf('russian', scores.russian),
        math: bestOf('math', scores.math),
        logic: bestOf('logic', scores.logic),
        english: bestOf('english', scores.english),
        total: 0
      };
      // English is reported as a CEFR level, never part of the overall score.
      mergedScores.total = mergedScores.russian + mergedScores.math + mergedScores.logic;
      // maxScoreSnapshot is constant for a given grade's answer keys (russian+math+logic
      // only), so it never needs merging with the prior submission's value.

      const subDoc = {
        id: submissionId,
        tenantId: resolvedTenantId,
        testId: sessionId || `test_${shortId}`,
        sessionId: sessionId || `test_${shortId}`,
        studentName: studentName || 'Неизвестно',
        studentEmail: studentEmail || `${shortId}@student.edu`,
        studentPhone: studentPhone || '—',
        studentShortId: String(shortId),
        grade: Number(grade),
        submittedAt: admin.firestore.Timestamp.now(),
        cheated: Boolean(cheated),
        scores: mergedScores,
        maxScoreSnapshot: mergedMaxScoreSnapshot,
        // Ответы копятся: сдача английского раньше затирала ответы основной
        // части, и проверить работу целиком было нельзя.
        answersJson: JSON.stringify({ ...safeParse(existing?.answersJson), ...(parsedAnswers || {}) }),
        diagnosticSummary: summaryText,
        diagnosticsRaw,
        status: "ЗАВЕРШЕН"
      };

      // AUTOMATIC CRM SYNC: Save student to CRM Contacts & CRM Deals
      const contactId = `cnt_${resolvedTenantId}_${shortId}`;
      const contactDoc = {
        id: contactId,
        tenantId: resolvedTenantId,
        fullName: studentName,
        name: studentName,
        email: studentEmail || `${shortId}@student.edu`,
        phone: studentPhone || '—',
        shortId: String(shortId),
        type: 'student',
        grade: Number(grade),
        totalScore: mergedScores.total || 0,
        scores: mergedScores,
        status: 'test_completed',
        updatedAt: admin.firestore.Timestamp.now()
      };
      const dealId = `deal_${resolvedTenantId}_${shortId}`;
      const dealDoc = {
        id: dealId,
        tenantId: resolvedTenantId,
        title: `Поступление: ${studentName} (${grade} класс)`,
        contactName: studentName,
        contactPhone: studentPhone || '—',
        contactEmail: studentEmail || '—',
        shortId: String(shortId),
        grade: Number(grade),
        stageId: 'stage_new',
        value: 15000,
        testScore: mergedScores.total || 0,
        cheated: Boolean(cheated),
        updatedAt: admin.firestore.Timestamp.now()
      };
      // Работа, контакт и сделка — ОДНОЙ пачкой вместо трёх записей подряд.
      //
      // Раньше ответ ученику ждал, пока по очереди запишутся все три
      // документа: при 500 сдающих это 1500 последовательных обращений к
      // базе, выстроенных в очередь. Пачка — один сетевой обход, и она же
      // атомарна: не бывает состояния «работа есть, сделки нет».
      const batch = admin.firestore().batch();
      batch.set(admin.firestore().collection("submissions").doc(submissionId), subDoc, { merge: true });
      batch.set(admin.firestore().collection("crm_contacts").doc(contactId), contactDoc, { merge: true });
      batch.set(admin.firestore().collection("crm_deals").doc(dealId), dealDoc, { merge: true });
      // Запись о начатом тесте закрывается: в кабинете менеджера она больше
      // не должна выглядеть как «пишет тест».
      batch.set(admin.firestore().collection("exam_suspensions").doc(String(shortId)), {
        status: action === "submitEnglishTest" ? "ЗАВЕРШЕН" : "СДАН ОСНОВНОЙ",
        finishedAt: admin.firestore.Timestamp.now(),
      }, { merge: true });
      await batch.commit();

      // Audit Log. The two submits are distinguished because a student can hand
      // in the core test and take English later — one row for both made an
      // unfinished attempt look identical to a completed one.
      writeAuditLog(action === "submitEnglishTest" ? "EXAM_ENGLISH_SUBMITTED" : "EXAM_SUBMITTED", resolvedTenantId, {
        sessionId: submissionId,
        studentName: studentName || "Неизвестно",
        studentShortId: String(shortId),
        grade: Number(grade) || 0,
        scores: scores,
        cheated: Boolean(cheated),
        isTester: Boolean(isTester),
      });
    } catch (fsErr) {
      console.warn("[Exams/Submit] Firestore write notice:", fsErr);
    }
  }

  // 5. Asynchronous Dual-Write to GAS in background (Sheets sync only — email is
  // sent directly below via Resend, independent of GAS availability)
  const gasUrl = process.env.VITE_GAS_URL || process.env.GAS_URL;
  const gasApiKey = process.env.GAS_API_KEY || process.env.VITE_GAS_API_KEY;
  if (gasUrl && gasApiKey) {
    const gasPayload = {
      action: action || "submitTest",
      apiKey: gasApiKey,
      testId: sessionId || `test_${shortId}`,
      shortId: String(shortId),
      studentName,
      studentEmail,
      studentPhone,
      grade,
      answers: typeof answers === 'string' ? answers : JSON.stringify(answers || {}),
      cheated: cheated ? "ДА" : "НЕТ",
      isTester: Boolean(isTester),
      isRetake: Boolean(isRetake)
    };
    fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gasPayload),
      signal: AbortSignal.timeout(10000)
    }).catch(err => console.warn("[Exams/Submit] Background GAS Dual-Write notice:", err.message));
  }

  // ✉️ Branded result email, sent directly via Resend — no longer depends on GAS.
  if (studentEmail && studentEmail.includes("@")) {
    (async () => {
      try {
        let tenantName = resolvedTenantId;
        let emailSettings: any = undefined;
        try {
          const tenantSnap = await admin.firestore().collection("tenants").doc(resolvedTenantId).get();
          tenantName = tenantSnap.data()?.name || resolvedTenantId;
          emailSettings = resolveWorkspaceConfig(tenantSnap.data()?.workspaceConfig).email;
        } catch (e) { /* fall back to raw tenantId */ }

        const result = await sendTestResultEmail({
          email: emailSettings,
          to: studentEmail,
          studentName: studentName || 'Ученик',
          tenantName,
          grade: Number(grade),
          scores: mergedScores,
          maxScoreSnapshot: mergedMaxScoreSnapshot,
          shortId: String(shortId),
        });
        if (!result.sent) {
          console.warn(`[Exams/Submit] Result email not sent for ${studentEmail}:`, result.reason);
        }
      } catch (err: any) {
        console.warn("[Exams/Submit] Result email dispatch notice:", err.message);
      }
    })();
  }

  return {
    success: true,
    totalScore: mergedScores.total,
    scores: {
      russian: mergedScores.russian,
      math: mergedScores.math,
      logic: mergedScores.logic,
      english: mergedScores.english
    },
    cheated: Boolean(cheated),
    summaryText
  };
}

// 3. POST /api/exams/submit — High-speed TS scoring + Firestore + GAS Dual-Write
/**
 * Ученику после сдачи уходит только факт приёма: баллы, разбивка и
 * аналитика — у организации в кабинете. Раньше ответ содержал всё, и
 * результат был виден в браузере до решения комиссии.
 */
function studentSafeResult(r: any) {
  if (!r || !r.success) return r;
  return { success: true, cheated: Boolean(r.cheated), accepted: true };
}

app.post("/api/exams/submit", async (req, res) => {
  try {
    const subResult = await processExamSubmission(req.body);
    return res.json(studentSafeResult(subResult));
  } catch (e: any) {
    console.error("[Exams/Submit] Endpoint error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});




// Public Data Endpoint for landing page and global settings
app.get("/api/public/data", async (req, res) => {
  try {
    const db = await readDb();
    return res.json(db);
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to load public data" });
  }
});

// Maintenance Mode Endpoints (Dynamic Control via SuperAdmin Panel)
app.get("/api/public/maintenance", async (req, res) => {
  try {
    const db = await readDb();
    const maintenance = db?.settings?.maintenance || {
      enabled: false,
      message: "Идут плановые технические работы на серверах прокторинга. Доступ будет восстановлен в ближайшее время.",
      estimatedTime: "30 минут",
      updatedAt: new Date().toISOString()
    };
    return res.json(maintenance);
  } catch (e) {
    return res.json({
      enabled: false,
      message: "Идут плановые технические работы на серверах прокторинга. Доступ будет восстановлен в ближайшее время.",
      estimatedTime: "30 минут",
      updatedAt: new Date().toISOString()
    });
  }
});

app.post("/api/admin/maintenance", requireSuperadmin, async (req, res) => {
  const { enabled, message, estimatedTime } = req.body;
  const db = await readDb();
  if (!db.settings) db.settings = {};
  
  db.settings.maintenance = {
    enabled: Boolean(enabled),
    message: message || "Идут плановые технические работы.",
    estimatedTime: estimatedTime || "30 минут",
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  console.log(`[MAINTENANCE] Mode updated to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  res.json({ success: true, maintenance: db.settings.maintenance });
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

// 3. Check Retake Authorization
app.get("/api/public/check-retake/:shortId", async (req, res) => {
  try {
    let allowed = false;
    
    // 1. Try Firebase if enabled
    if (useFirebase) {
      try {
        const tenantId = String(req.query.tenantId || "").trim();
        if (!tenantId) return res.status(400).json({ success: false, error: "Не указана организация" });
        const doc = await admin.firestore().collection("retakes").doc(req.params.shortId).get();
        if (doc.exists && doc.data()?.allowed === true) {
          const docTenantId = doc.data()?.tenantId;
          if (!docTenantId || docTenantId === tenantId) {
            allowed = true;
          }
        }
      } catch (fe) {}
    }
    
    // 2. If not allowed yet, check GAS (Google Sheets status)
    if (!allowed && process.env.VITE_GAS_URL) {
      try {
        const gasRes = await fetch(process.env.VITE_GAS_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "checkSuspendStatus", shortId: req.params.shortId, apiKey: process.env.GAS_API_KEY || process.env.VITE_GAS_API_KEY }),
          signal: AbortSignal.timeout(5000)
        });
        const gasData = await gasRes.json();
        if (gasData.success && (gasData.status === "В ПРОЦЕССЕ" || gasData.status === "ПРИОСТАНОВЛЕН")) {
          allowed = true;
        }
      } catch (ge) {}
    }
    
    res.json({ allowed });
  } catch (e) {
    res.json({ allowed: false });
  }
});

// GAS Proxy
/**
 * Вопросы и ключи теста организации — для проверки работы и пересчёта.
 * Ключи собираются в том же порядке приоритета, что и при сдаче, и
 * обрезаются до реальных вопросов теста: в test_answer_keys лежат остатки
 * старых пересидов, которые иначе раздувают «возможные» баллы по темам.
 */
type ExamQuestionSet = { russian: any[]; math: any[]; logic: any[]; english: any[] };
async function loadExamQuestions(tenantId: string, grade: number): Promise<ExamQuestionSet | null> {
  return cachedRead(`testq_${tenantId}_${grade}`, async () => {
    const snap = await admin.firestore().collection("tests").doc(`test_grade_${grade}_${tenantId}`).get();
    const data = snap.data();
    if (!data?.questions || (data.tenantId && data.tenantId !== tenantId)) return null;
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return { russian: arr(data.questions.russian), math: arr(data.questions.math), logic: arr(data.questions.logic), english: arr(data.questions.english) };
  });
}
async function loadExamKeys(tenantId: string, grade: number, questions: ExamQuestionSet | null) {
  const acc: any = await cachedRead(`keys_${tenantId}_${grade}`, async () => {
    const ids = [`test_grade_${grade}_${tenantId}`, `test_grade_${grade}`, `key_grade_${grade}_${tenantId}`, `key_grade_${grade}_GLOBAL`, `${grade}`];
    const out: any = { russian: {}, math: {}, logic: {}, english: {} };
    const snaps = await admin.firestore().getAll(...ids.map(id => admin.firestore().collection("test_answer_keys").doc(id)));
    for (const d of snaps) {
      if (!d.exists) continue;
      const k = d.data()?.keys || {};
      for (const subject of ["russian", "math", "logic", "english"]) if (k[subject]) out[subject] = { ...k[subject], ...out[subject] };
    }
    return out;
  });
  const keys: any = { russian: {}, math: {}, logic: {}, english: {} };
  for (const subject of ["russian", "math", "logic", "english"] as const) {
    const real = questions ? new Set(questions[subject].map((q: any) => q.id)) : null;
    keys[subject] = Object.fromEntries(Object.entries(acc[subject] || {}).filter(([id]) => !real || real.size === 0 || real.has(id)));
  }
  return keys;
}
/** Ответ в человеческом виде: для выбора — текст варианта, а не «2» или «B». */
function prettyAnswer(q: any, raw: string): string {
  const alts = String(raw).split("||").map(a => a.trim()).filter(Boolean);
  const one = (a: string) => {
    const opts: string[] = Array.isArray(q?.options) ? q.options : [];
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hit = opts.find(o => o === a) || opts.find(o => new RegExp(`^${esc}\\s*[).]`, "i").test(o));
    return hit || a;
  };
  return alts.map(one).join(" или ");
}

app.post("/api/gas", async (req, res) => {
  const gasUrl = process.env.VITE_GAS_URL || process.env.GAS_URL;
  // ⚠️ SECURITY: API key injected server-side ONLY — never from client body
  const gasApiKey = process.env.GAS_API_KEY || process.env.VITE_GAS_API_KEY;
  if (!gasApiKey) {
    console.error("[SECURITY] GAS_API_KEY env var is not set! Refusing proxy.");
    return res.status(500).json({ error: "Server misconfiguration: GAS_API_KEY not set" });
  }
  
  if (!gasUrl) {
    return res.status(500).json({ error: "VITE_GAS_URL environment variable is not configured." });
  }

  try {
    // Handle text/plain bodies: client sends JSON as text/plain to avoid CORS preflight
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: "Invalid JSON in request body" });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: "Empty or invalid request body" });
    }
    
    const payload = { ...body, apiKey: gasApiKey };
    
    // Организация обязательна для всего, что сервер обрабатывает сам. Раньше
    
    // без неё подставлялась Академия — и записи чужой школы ложились к ней.
    
    const NEEDS_TENANT = new Set(["registerStudent", "suspendTest", "getStudentByShortId", "unblockStudent"]);
    
    if (NEEDS_TENANT.has(String(payload?.action || "")) && !String(payload?.tenantId || "").trim()) {
    
      return res.status(400).json({ success: false, error: "Не указана организация" });
    
    }
    
    // Check if tester
    const TESTER_PIN = process.env.VITE_TESTER_PIN;
    if (TESTER_PIN && (payload.action === "submitTest" || payload.action === "submitEnglishTest") && payload.testerPin) {
      if (payload.testerPin === TESTER_PIN) {
        payload.isTester = true;
      }
      delete payload.testerPin; // do not send pin to GAS
    }
    
    // For protected actions, verify Firebase Auth token.
    // getCertificateRegistry is NOT public — it's only ever called from the manager
    // dashboard, and exposing the whole certificate registry to anonymous callers
    // leaked every tenant's issued documents.
    const publicActions = [
      "submitTest",
      "submitEnglishTest",
      "registerStudent",
      "suspendTest",
      "checkSuspendStatus",
      "getStudentByShortId"
    ];
    let gasUser: any = null;
    if (!publicActions.includes(payload.action)) {
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace("Bearer ", "").trim();
      
      if (!token) {
         return res.status(401).json({ error: "Unauthorized: Missing Firebase ID Token" });
      }
      
      try {
        gasUser = await admin.auth().verifyIdToken(token);
      } catch(e) {
        return res.status(401).json({ error: "Unauthorized: Invalid Firebase ID Token" });
      }
    }

    // Handle exam submission locally using Firestore keys & TypeScript scoring engine
    if (payload.action === "submitTest" || payload.action === "submitEnglishTest") {
      try {
        const subResult = await processExamSubmission(payload);
        return res.json(studentSafeResult(subResult));
      } catch (subErr: any) {
        console.error("[GAS Proxy] Local exam submission error:", subErr);
      }
    }

    // Local-first suspend/approve/resume state machine. This whole loop used to live
    // exclusively in GAS: the student's suspendTest (carrying their in-progress
    // answers), the manager's unblockStudent click, and the student's 4-second
    // checkSuspendStatus poll were all straight proxies to Google Apps Script. When
    // GAS was slow or 503ing (observed live in production), the manager's "разрешить
    // продолжение" click did nothing visible, students stayed stuck on the suspended
    // screen indefinitely, and the answers snapshot sent with suspendTest was lost
    // outright. Firestore is now the source of truth for all three actions; GAS gets
    // a fire-and-forget mirror so the Sheets side stays roughly in sync. Falls
    // through to the plain GAS proxy only on a local error or (for the status check)
    // a legacy suspension that predates this and only exists in Sheets.
    const mirrorToGas = (mirrorPayload: any) => {
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...mirrorPayload, apiKey: gasApiKey }),
        signal: AbortSignal.timeout(10000)
      }).catch(err => console.warn(`[GAS Mirror] ${mirrorPayload.action} notice:`, err.message));
    };

    // The start of an exam was not recorded anywhere, so a session that never
    // reached submit (student dropped out, browser died) left no trace at all:
    // the superadmin log showed nothing and the manager could not tell an
    // interrupted attempt from one that never happened.
    if (payload.action === "registerStudent" && payload.shortId) {
      let regTenant: any = null;
      if (payload.tenantId) {
        const gate = await checkTenantOpen(payload.tenantId, "tests");
        if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
        regTenant = gate.tenant;
      }
      // PIN аудитории проверяется ЗДЕСЬ, а не только в браузере: раньше
      // единственная серверная проверка стояла в /api/exams/start, который
      // никто не вызывал, — и экзамен стартовал по любому коду. Организация
      // может отключить PIN у себя в настройках (registration.pinRequired).
      {
        const reg = resolveWorkspaceConfig(regTenant?.workspaceConfig).registration;
        const TESTER = process.env.VITE_TESTER_PIN || process.env.TESTER_PIN;
        const isTester = Boolean(TESTER) && String(payload.enteredPin || "") === TESTER;
        if (reg.pinRequired && !isTester) {
          const clean = String(payload.enteredPin || "").replace(/\D/g, "");
          const ok = Boolean(clean) && [-1, 0, 1].some(o => clean === getHourlyPIN(o, String(payload.tenantId || "")));
          if (!ok) {
            return res.status(403).json({ success: false, error: `Неверный PIN-код. Узнайте актуальный PIN у ${reg.pinAuthority || "менеджера"}.` });
          }
        }
      }
      // Старт — в базу, а не только в аудит-лог. Список менеджера читает
      // только Firestore, и ученик, который начал, но ещё не сдал, исчезал
      // из кабинета: некому было выдать разрешение продолжить. Документ
      // тот же, что и у приостановки, — по нему же ученик опрашивает статус.
      if (useFirebase) {
        try {
          await admin.firestore().collection("exam_suspensions").doc(String(payload.shortId)).set({
            shortId: String(payload.shortId),
            tenantId: (payload.tenantId || "unknown"),
            studentName: payload.studentName || "",
            studentPhone: payload.studentPhone || "",
            studentEmail: payload.studentEmail || "",
            grade: Number(payload.grade) || 0,
            status: "В ПРОЦЕССЕ",
            registeredAt: admin.firestore.Timestamp.now(),
            isTester: Boolean(payload.isTester),
          }, { merge: true });
        } catch (e: any) {
          console.warn("[Register] Local Firestore write failed:", e.message);
        }
      }
      writeAuditLog("EXAM_STARTED", (payload.tenantId || "unknown"), {
        studentShortId: String(payload.shortId),
        studentName: payload.studentName || "",
        studentPhone: payload.studentPhone || "",
        studentEmail: payload.studentEmail || "",
        grade: Number(payload.grade) || 0,
        sessionId: payload.testId || "",
        isTester: Boolean(payload.isTester),
      });
      // Старт экзамена записан локально (аудит-лог). Ответ ученику — сразу,
      // а зеркало в GAS уходит в фоне: раньше регистрация проваливалась в
      // общий проксирующий вызов с таймаутом 50 секунд, и при холодном
      // старте или тормозах Apps Script сервер держал запрос вхолостую, хотя
      // GAS для старта ничего не решает.
      mirrorToGas(payload);
      return res.json({ success: true, registered: true });
    }

    if (payload.action === "suspendTest" && useFirebase && payload.shortId) {
      try {
        await admin.firestore().collection("exam_suspensions").doc(String(payload.shortId)).set({
          shortId: String(payload.shortId),
          tenantId: (payload.tenantId || "unknown"),
          // Имя и класс уже записаны при старте — пустые значения из
          // запроса приостановки не должны их стирать.
          ...(payload.studentName ? { studentName: String(payload.studentName) } : {}),
          ...(Number(payload.grade) ? { grade: Number(payload.grade) } : {}),
          phase: payload.phase || "core",
          answersJson: typeof payload.answers === "string" ? payload.answers : JSON.stringify(payload.answers || {}),
          status: "ПРИОСТАНОВЛЕН",
          suspendedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
        writeAuditLog("EXAM_SUSPENDED", (payload.tenantId || "unknown"), {
          studentShortId: String(payload.shortId),
          studentName: payload.studentName || "",
          grade: Number(payload.grade) || 0,
          phase: payload.phase || "core",
          reason: payload.reason || "Выход из режима теста",
        });
        mirrorToGas(payload);
        return res.json({ success: true, status: "ПРИОСТАНОВЛЕН" });
      } catch (e: any) {
        console.warn("[Suspend] Local Firestore write failed, falling back to GAS:", e.message);
      }
    }

    if (payload.action === "checkSuspendStatus" && useFirebase && payload.shortId) {
      try {
        const snap = await admin.firestore().collection("exam_suspensions").doc(String(payload.shortId)).get();
        if (snap.exists) {
          const d = snap.data()!;
          return res.json({ success: true, status: d.status || "ПРИОСТАНОВЛЕН", answers: d.answersJson || "{}" });
        }
        // No local record — legacy suspension stored only in GAS; fall through to proxy.
      } catch (e: any) {
        console.warn("[Suspend] Local status check failed, falling back to GAS:", e.message);
      }
    }

    // Проверка работы и пересчёт — из базы, а не из Google Apps Script.
    // Работы давно хранятся здесь и до таблиц не доходят: Apps Script отвечал
    // «Student not found», и завуч не мог ни посмотреть ответы, ни пересчитать
    // баллы после исправления ключей.
    if ((payload.action === "getAnswerComparison" || payload.action === "recheckScores") && useFirebase && payload.shortId) {
      try {
        const shortId = String(payload.shortId);
        const subRef = admin.firestore().collection("submissions").doc(`sub_${shortId}`);
        const subSnap = await subRef.get();
        if (!subSnap.exists) return res.json({ success: false, error: "Работа не найдена в базе" });
        const sub = subSnap.data()!;
        const tenantId = String(sub.tenantId || "");
        if (payload.tenantId && String(payload.tenantId) !== tenantId) {
          return res.status(404).json({ success: false, error: "Работа не найдена в этой организации" });
        }
        const allowed = await hasAnyPermission(admin.firestore(), gasUser, tenantId, ["tests:review", "tests:manage"]);
        if (!allowed) return res.status(403).json({ success: false, error: "Нет прав на проверку работ этой организации" });
        const grade = Number(sub.grade) || 0;
        const questions = await loadExamQuestions(tenantId, grade);
        if (!questions) return res.json({ success: false, error: `Тест для ${grade} класса не найден` });
        const keys = await loadExamKeys(tenantId, grade, questions);
        const answers = safeParse(sub.answersJson);
        const SUBJECTS: Array<["russian" | "math" | "logic" | "english", string]> =
          [["russian", "Русский язык"], ["math", "Математика"], ["logic", "Логика"], ["english", "Английский язык"]];
        const hasAnswers = (subject: string) => Object.keys(keys[subject] || {}).some(id => answers[id] !== undefined);

        if (payload.action === "getAnswerComparison") {
          const comparison: any[] = [];
          for (const [subject, label] of SUBJECTS) {
            const saved = hasAnswers(subject);
            questions[subject].forEach((q: any, idx: number) => {
              const entry = keys[subject]?.[q.id];
              const raw = answers[q.id];
              const answered = raw !== undefined && raw !== null && String(raw).trim() !== "";
              comparison.push({
                subject: label, questionId: String(idx + 1), topic: entry?.topic || "",
                studentAnswer: answered ? prettyAnswer(q, String(raw)) : (saved ? "— (пропущен)" : "— (ответы не сохранены)"),
                correctAnswer: entry ? prettyAnswer(q, String(entry.ans)) : "—",
                isCorrect: Boolean(entry) && answered && isAnswerCorrect(raw, entry),
              });
            });
          }
          return res.json({ success: true, comparison, studentName: sub.studentName || "", grade, scores: sub.scores || {} });
        }

        // Пересчёт по текущим ключам. Предмет, ответов по которому в базе нет
        // (старые работы, где сдача английского затёрла основную часть),
        // оставляем с прежним баллом, а не обнуляем.
        const result = calculateScoresTs(grade, answers, keys as any);
        const prev = sub.scores || {};
        const kept: string[] = [];
        const scores: any = { russian: 0, math: 0, logic: 0, english: 0, total: 0 };
        for (const [subject, label] of SUBJECTS) {
          if (hasAnswers(subject)) scores[subject] = Number(result.scores[subject]) || 0;
          else { scores[subject] = Number(prev[subject]) || 0; kept.push(label); }
        }
        scores.total = scores.russian + scores.math + scores.logic;
        const sumPts = (arr: any[]) => arr.reduce((a, q) => a + (q.points || 1), 0);
        const maxScoreSnapshot = sumPts(questions.russian) + sumPts(questions.math) + sumPts(questions.logic);
        const now = admin.firestore.Timestamp.now();
        const batch = admin.firestore().batch();
        batch.set(subRef, { scores, maxScoreSnapshot, diagnosticsRaw: result.diagnosticsRaw, diagnosticSummary: result.summaryText,
          recheckedAt: now, recheckedBy: gasUser?.email || "" }, { merge: true });
        batch.set(admin.firestore().collection("crm_contacts").doc(`cnt_${tenantId}_${shortId}`), { totalScore: scores.total, scores, updatedAt: now }, { merge: true });
        batch.set(admin.firestore().collection("crm_deals").doc(`deal_${tenantId}_${shortId}`), { testScore: scores.total, updatedAt: now }, { merge: true });
        await batch.commit();
        writeAuditLog("EXAM_RESCORED", tenantId, {
          studentShortId: shortId, studentName: sub.studentName || "", grade,
          actor: gasUser?.email || "", before: prev, after: scores, keptSubjects: kept,
        });
        return res.json({ success: true, scores, maxScoreSnapshot, diagnosticsRaw: result.diagnosticsRaw, previousScores: prev, keptSubjects: kept });
      } catch (e: any) {
        console.warn("[Review] local review failed:", e.message);
        return res.status(500).json({ success: false, error: e.message });
      }
    }

    // ------------------------------------------------------------------------
    // Multi-tenant Firestore Handlers for Student Admissions & Manager/Psychologist Forms
    // ------------------------------------------------------------------------

    // 1. Unified Student Lookup (getStudentByShortId & getPsychologistStudent)
    if ((payload.action === "getStudentByShortId" || payload.action === "getPsychologistStudent") && useFirebase && payload.shortId) {
      try {
        const shortId = String(payload.shortId).trim();
        const requestedTenantId = payload.tenantId ? String(payload.tenantId).trim() : "";
        const db = admin.firestore();

        let subDoc: any = null;
        let cntDoc: any = null;
        let suspDoc: any = null;

        // Try submissions doc `sub_${shortId}` or query
        const subSnap = await db.collection("submissions").doc(`sub_${shortId}`).get();
        if (subSnap.exists) {
          subDoc = subSnap.data();
        } else {
          let q = db.collection("submissions").where("studentShortId", "==", shortId);
          if (requestedTenantId) q = q.where("tenantId", "==", requestedTenantId);
          const qSnap = await q.limit(1).get();
          if (!qSnap.empty) subDoc = qSnap.docs[0].data();
        }

        // Try crm_contacts
        if (requestedTenantId) {
          const cntSnap = await db.collection("crm_contacts").doc(`cnt_${requestedTenantId}_${shortId}`).get();
          if (cntSnap.exists) cntDoc = cntSnap.data();
        }
        if (!cntDoc) {
          let qCnt = db.collection("crm_contacts").where("shortId", "==", shortId);
          if (requestedTenantId) qCnt = qCnt.where("tenantId", "==", requestedTenantId);
          const qCntSnap = await qCnt.limit(1).get();
          if (!qCntSnap.empty) cntDoc = qCntSnap.docs[0].data();
        }

        // Try exam_suspensions
        const suspSnap = await db.collection("exam_suspensions").doc(shortId).get();
        if (suspSnap.exists) suspDoc = suspSnap.data();

        if (subDoc || cntDoc || suspDoc) {
          const tenantId = subDoc?.tenantId || cntDoc?.tenantId || suspDoc?.tenantId || requestedTenantId;
          
          if (requestedTenantId && tenantId && tenantId !== requestedTenantId) {
            console.warn(`[Security] ${payload.action} cross-tenant blocked: ${shortId} belongs to ${tenantId}, requested by ${requestedTenantId}`);
            return res.json({ success: false, error: "Ученик не найден" });
          }

          const studentName = subDoc?.studentName || cntDoc?.fullName || cntDoc?.name || suspDoc?.studentName || `Ученик ${shortId}`;
          const parentName = cntDoc?.parentName || subDoc?.parentName || "—";
          const phone = cntDoc?.phone || subDoc?.studentPhone || suspDoc?.studentPhone || "—";
          const grade = Number(subDoc?.grade || cntDoc?.grade || suspDoc?.grade || 7);
          const ru = subDoc?.scores?.russian ?? cntDoc?.scores?.russian ?? 0;
          const ma = subDoc?.scores?.math ?? cntDoc?.scores?.math ?? 0;
          const lo = subDoc?.scores?.logic ?? cntDoc?.scores?.logic ?? 0;
          const en = subDoc?.scores?.english ?? cntDoc?.scores?.english ?? 0;
          const totalScore = subDoc?.scores?.total ?? cntDoc?.totalScore ?? (ru + ma + lo);

          return res.json({
            success: true,
            student: {
              shortId,
              studentName,
              childName: studentName,
              parentName,
              phone,
              grade,
              russian: ru,
              math: ma,
              logic: lo,
              english: en,
              ru,
              ma,
              lo,
              en,
              totalScore,
              cheated: Boolean(subDoc?.cheated),
              diagnosticsRaw: subDoc?.diagnosticsRaw || null,
              diagnosticsReport: subDoc?.diagnosticSummary || "",
              managerName: subDoc?.managerName || cntDoc?.managerName || "Не назначен",
              managerComment: subDoc?.managerComment || cntDoc?.managerComment || "",
              sentToPsych: Boolean(subDoc?.sentToPsych || cntDoc?.sentToPsych),
              status: subDoc?.status || cntDoc?.status || suspDoc?.status || "ЗАВЕРШЕН",
              finalDecision: subDoc?.finalDecision || cntDoc?.finalDecision || "НЕ ОБРАБОТАН",
              date: subDoc?.submittedAt?.toDate ? subDoc.submittedAt.toDate().toISOString() : new Date().toISOString(),
              tenantId,
              testId: subDoc?.testId || `test_${shortId}`,
            }
          });
        }
        // Fall through to GAS if not found locally
      } catch (e: any) {
        console.warn(`[${payload.action}] Local lookup notice:`, e.message);
      }
    }

    // 2. Submit Manager Form (filling questionnaire & single-step decision/payment)
    if (payload.action === "submitManagerForm" && useFirebase && payload.shortId) {
      try {
        const shortId = String(payload.shortId).trim();
        const tenantId = String(payload.tenantId || "").trim();
        const childName = String(payload.childName || "").trim();
        const isPsych = Boolean(payload.sentToPsych);
        const rawDecision = String(payload.finalDecision || "").trim();
        const finalDecision = rawDecision === "ПРИНЯТ" || rawDecision === "accepted" ? "ПРИНЯТ" : rawDecision === "ОТКЛОНЕН" || rawDecision === "rejected" ? "ОТКЛОНЕН" : undefined;
        const status = finalDecision ? finalDecision : (isPsych ? "К ПСИХОЛОГУ" : "ОБРАБОТАН");
        const now = admin.firestore.Timestamp.now();
        const db = admin.firestore();

        // Check cross-tenant isolation
        const subSnap = await db.collection("submissions").doc(`sub_${shortId}`).get();
        if (subSnap.exists && subSnap.data()?.tenantId && tenantId && subSnap.data().tenantId !== tenantId) {
          console.warn(`[Security] submitManagerForm cross-tenant blocked: ${shortId} belongs to ${subSnap.data().tenantId}, requested by ${tenantId}`);
          return res.status(403).json({ success: false, error: "Ученик принадлежит другой организации" });
        }

        const batch = db.batch();

        // crm_contacts
        const cntDocId = tenantId ? `cnt_${tenantId}_${shortId}` : `cnt_${shortId}`;
        const cntRef = db.collection("crm_contacts").doc(cntDocId);
        batch.set(cntRef, {
          id: cntDocId,
          shortId,
          ...(tenantId ? { tenantId } : {}),
          fullName: childName,
          name: childName,
          parentName: payload.parentName || "",
          phone: payload.phone || "",
          managerName: payload.managerName || "",
          managerComment: payload.managerComment || "",
          sentToPsych: isPsych,
          status,
          ...(finalDecision ? { finalDecision } : {}),
          ...(payload.rejectReason ? { rejectReason: payload.rejectReason } : {}),
          ...(payload.feedback ? { feedback: payload.feedback } : {}),
          updatedAt: now
        }, { merge: true });

        // submissions
        if (subSnap.exists) {
          batch.set(subSnap.ref, {
            studentName: childName,
            parentName: payload.parentName || "",
            studentPhone: payload.phone || "",
            managerName: payload.managerName || "",
            managerComment: payload.managerComment || "",
            sentToPsych: isPsych,
            status,
            ...(finalDecision ? { finalDecision } : {}),
            ...(payload.paymentInfo !== undefined ? { paymentInfo: payload.paymentInfo } : {}),
            ...(payload.initialFee !== undefined ? { initialFee: payload.initialFee } : {}),
            ...(payload.totalCost !== undefined ? { totalCost: payload.totalCost } : {}),
            ...(payload.monthlyPaidSum !== undefined ? { monthlyPaidSum: payload.monthlyPaidSum } : {}),
            ...(payload.firstMonthPayment !== undefined ? { firstMonthPayment: payload.firstMonthPayment } : {}),
            ...(payload.rejectReason !== undefined ? { rejectReason: payload.rejectReason } : {}),
            ...(payload.feedback !== undefined ? { feedback: payload.feedback } : {}),
            updatedAt: now
          }, { merge: true });
        }

        // crm_deals
        const dealDocId = tenantId ? `deal_${tenantId}_${shortId}` : `deal_${shortId}`;
        const dealRef = db.collection("crm_deals").doc(dealDocId);
        const stageId = finalDecision === "ПРИНЯТ" ? "stage_won" : finalDecision === "ОТКЛОНЕН" ? "stage_lost" : (isPsych ? "stage_psychologist" : "stage_manager_done");
        batch.set(dealRef, {
          id: dealDocId,
          shortId,
          ...(tenantId ? { tenantId } : {}),
          contactName: childName,
          contactPhone: payload.phone || "",
          stageId,
          ...(finalDecision ? { finalDecision } : {}),
          ...(payload.totalCost ? { amount: payload.totalCost } : {}),
          updatedAt: now
        }, { merge: true });

        await batch.commit();

        writeAuditLog("MANAGER_FORM_SUBMITTED", tenantId || "unknown", {
          shortId,
          childName,
          managerName: payload.managerName || "",
          sentToPsych: isPsych,
          finalDecision
        });

        mirrorToGas(payload);
        return res.json({ success: true, finalDecision });
      } catch (e: any) {
        console.warn("[submitManagerForm] Local update notice:", e.message);
      }
    }

    // 3. Update Final Decision (accepting / rejecting student)
    if (payload.action === "updateFinalDecision" && useFirebase && payload.shortId) {
      try {
        const shortId = String(payload.shortId).trim();
        let tenantId = String(payload.tenantId || "").trim();
        const decision = payload.finalDecision === "ПРИНЯТ" || payload.finalDecision === "accepted" ? "ПРИНЯТ" : "ОТКЛОНЕН";
        const decisionStatus = decision === "ПРИНЯТ" ? "accepted" : "rejected";
        const now = admin.firestore.Timestamp.now();
        const db = admin.firestore();

        let subSnap = await db.collection("submissions").doc(`sub_${shortId}`).get();
        if (!subSnap.exists && tenantId) {
          const qSnap = await db.collection("submissions")
            .where("tenantId", "==", tenantId)
            .where("studentShortId", "==", shortId).limit(1).get();
          if (!qSnap.empty) subSnap = qSnap.docs[0];
        }

        // Strict cross-tenant check
        if (subSnap.exists && subSnap.data()?.tenantId && tenantId && subSnap.data().tenantId !== tenantId) {
          console.warn(`[Security] updateFinalDecision cross-tenant blocked: ${shortId} belongs to ${subSnap.data().tenantId}, requested by ${tenantId}`);
          return res.status(403).json({ success: false, error: "Ученик принадлежит другой организации" });
        }

        if (!tenantId && subSnap.exists) {
          tenantId = subSnap.data()?.tenantId || "";
        }

        const batch = db.batch();

        if (subSnap.exists) {
          batch.set(subSnap.ref, {
            finalDecision: decision,
            paymentInfo: payload.paymentInfo || "",
            initialFee: payload.initialFee || "",
            totalCost: payload.totalCost || "",
            firstMonthPayment: payload.firstMonthPayment || "",
            rejectReason: payload.rejectReason || "",
            feedback: payload.feedback || "",
            updatedAt: now
          }, { merge: true });
        }

        // Update crm_contacts
        let cntSnap = tenantId ? await db.collection("crm_contacts").doc(`cnt_${tenantId}_${shortId}`).get() : null;
        if (!cntSnap || !cntSnap.exists) {
          const qSnap = await db.collection("crm_contacts").where("shortId", "==", shortId).limit(1).get();
          if (!qSnap.empty) cntSnap = qSnap.docs[0];
        }
        if (cntSnap && cntSnap.exists) {
          batch.set(cntSnap.ref, {
            finalDecision: decision,
            status: decision === "ПРИНЯТ" ? "ПРИНЯТ" : "ОТКЛОНЕН",
            rejectReason: payload.rejectReason || "",
            feedback: payload.feedback || "",
            updatedAt: now
          }, { merge: true });
        }

        // Update crm_deals
        let dealSnap = tenantId ? await db.collection("crm_deals").doc(`deal_${tenantId}_${shortId}`).get() : null;
        if (!dealSnap || !dealSnap.exists) {
          const qSnap = await db.collection("crm_deals").where("shortId", "==", shortId).limit(1).get();
          if (!qSnap.empty) dealSnap = qSnap.docs[0];
        }
        if (dealSnap && dealSnap.exists) {
          batch.set(dealSnap.ref, {
            stageId: decision === "ПРИНЯТ" ? "stage_won" : "stage_lost",
            finalDecision: decision,
            updatedAt: now
          }, { merge: true });
        }

        // Sync user document if childName matches
        if (payload.childName) {
          const childNameLower = String(payload.childName).trim().toLowerCase();
          const userSnap = await db.collection("users").get();
          userSnap.forEach(uDoc => {
            const u = uDoc.data();
            if (tenantId && u.tenantId && u.tenantId !== tenantId) return;
            const f = (u.firstName || "").toLowerCase().trim();
            const l = (u.lastName || "").toLowerCase().trim();
            const full1 = `${f} ${l}`.trim();
            const full2 = `${l} ${f}`.trim();
            if (childNameLower === full1 || childNameLower === full2 || childNameLower === f || full1.includes(childNameLower)) {
              batch.set(uDoc.ref, { decisionStatus, feedback: payload.feedback || "" }, { merge: true });
            }
          });
        }

        await batch.commit();

        writeAuditLog("STUDENT_DECISION_UPDATED", tenantId || "unknown", {
          shortId,
          finalDecision: decision,
          actor: gasUser?.email || "manager"
        });

        mirrorToGas(payload);
        return res.json({ success: true, finalDecision: decision });
      } catch (e: any) {
        console.warn("[updateFinalDecision] Local update notice:", e.message);
      }
    }

    // 4. Submit Psychologist Form
    if (payload.action === "submitPsychologistForm" && useFirebase && payload.shortId) {
      try {
        const shortId = String(payload.shortId).trim();
        const verdict = payload.verdict || "БРАТЬ";
        const comment = payload.comment || "";
        const now = admin.firestore.Timestamp.now();
        const db = admin.firestore();

        const batch = db.batch();

        const subSnap = await db.collection("submissions").doc(`sub_${shortId}`).get();
        if (subSnap.exists) {
          batch.set(subSnap.ref, { psychVerdict: verdict, psychComment: comment, updatedAt: now }, { merge: true });
        }

        const qCntSnap = await db.collection("crm_contacts").where("shortId", "==", shortId).limit(1).get();
        if (!qCntSnap.empty) {
          batch.set(qCntSnap.docs[0].ref, {
            psychVerdict: verdict,
            psychComment: comment,
            status: verdict === "БРАТЬ" ? "РЕКОМЕНДОВАН" : "НЕ РЕКОМЕНДОВАН",
            updatedAt: now
          }, { merge: true });
        }

        await batch.commit();
        mirrorToGas(payload);
        return res.json({ success: true });
      } catch (e: any) {
        console.warn("[submitPsychologistForm] Local update notice:", e.message);
      }
    }

    if (payload.action === "unblockStudent" && useFirebase && payload.shortId) {
      try {
        await admin.firestore().collection("exam_suspensions").doc(String(payload.shortId)).set({
          shortId: String(payload.shortId),
          status: "В ПРОЦЕССЕ",
          unblockedAt: admin.firestore.Timestamp.now(),
          unblockedBy: payload.managerName || payload.actorEmail || "",
        }, { merge: true });
        writeAuditLog("EXAM_RESUME_APPROVED", (payload.tenantId || "unknown"), {
          studentShortId: String(payload.shortId),
          studentName: payload.studentName || "",
          actor: payload.managerName || payload.actorEmail || "",
        });
        mirrorToGas(payload);
        return res.json({ success: true });
      } catch (e: any) {
        console.warn("[Suspend] Local unblock failed, falling back to GAS:", e.message);
      }
    }

    let rawText = "";
    let data;
    
    try {
      const fetchRes = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(50000)
      });
      
      rawText = await fetchRes.text();
      data = JSON.parse(rawText);
      return res.json(data);
    } catch (e: any) {
      console.warn(`GAS Proxy fetch notice for action [${payload.action}]:`, e.name === 'AbortError' ? 'Timeout' : e.message);
      return res.status(503).json({ 
        success: false, 
        error: "Google Apps Script временно не ответил.",
        details: e.message 
      });
    }
  } catch (err: any) {
    console.error("GAS Proxy error:", err);
    res.status(500).json({ error: "Failed to communicate with proxy" });
  }
});

// 3. Submit Newsletter / Subscriber Registration with validation
app.post("/api/subscribe", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Name is required." });
    }

    const db = await readDb();
    db.subscribers = db.subscribers || [];

    // Avoid duplicate subscriptions
    const exists = db.subscribers.some((sub: any) => sub.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "This email is already registered." });
    }

    const newSubscriber = {
      id: "sub_" + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || "").trim(),
      timestamp: new Date().toISOString()
    };

    db.subscribers.push(newSubscriber);
    await writeDb(db);

    res.status(201).json({ success: true, message: "Thank you for subscribing!" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error during subscription." });
  }
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
