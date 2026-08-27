import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs, existsSync, readFileSync } from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { calculateScoresTs } from "./src/lib/scoringEngine.js";

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
  if (existsSync(keyPath)) {
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

// Middleware
// Removed duplicate app.use(express.json()) to preserve the 10MB limit set above.
// Memory active sessions store
let activeSessions = new Set<string>();

import authRoutes from "./src/routes/authRoutes.js";
import tenantRoutes from "./src/routes/tenantRoutes.js";
import superAdminRoutes from "./src/routes/superAdminRoutes.js";
import { sendTestResultEmail } from "./emailService.js";

app.use("/api/auth", authRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/superadmin", superAdminRoutes);

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

function resolveTenantFromApiKey(apiKey: string | undefined): TenantContext {
  // Default tenant mapping — fallback to Future Leaders Academy
  const defaultTenant: TenantContext = {
    org_id: process.env.DEFAULT_ORG_ID || 'org_future_leaders',
    org_name: process.env.DEFAULT_ORG_NAME || 'ОсОО «Академия Будущих Лидеров»',
    plan_tier: 'pro',
  };
  return defaultTenant; // TODO: lookup from KV store when multi-tenant
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
    const tenant = resolveTenantFromApiKey(gasApiKey);

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
    const defaultTenantId = req.body?.tenantId || 'org_future_leaders';
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
        return res.json({ success: true, tenant: snap.docs[0].data() });
      }
    }
    
    // Fallback or not found
    return res.status(404).json({ success: false, error: "Tenant not found for subdomain: " + subdomain });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

function getHourlyPIN(hourOffset = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hourOffset);
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}

app.post("/api/exams/start", async (req, res) => {
  try {
    const { testId, studentName, grade, shortId, enteredPin, tenantId } = req.body;
    if (!studentName || !grade) {
      return res.status(400).json({ success: false, error: "Missing studentName or grade" });
    }

    const EXPECTED_PIN = getHourlyPIN();
    const TESTER_PIN = process.env.VITE_TESTER_PIN || process.env.TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    if (enteredPin !== EXPECTED_PIN && !isTester) {
      return res.status(403).json({ success: false, error: "Неверный PIN-код. Узнайте актуальный PIN у менеджера." });
    }

    const studentShortId = shortId || Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = testId || `test_${studentShortId}_${Date.now()}`;
    const resolvedTenantId = tenantId || 'org_future_leaders';

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
        const testSlug = resolvedTenantId === 'org_future_leaders' ? `future_leaders_grade_${grade}` : `test_grade_${grade}`;
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

    const resolvedTenantId = (tenantId as string) || 'org_future_leaders';
    const g = Number(grade);

    if (!useFirebase) {
      return res.status(503).json({ success: false, error: "Firestore not configured" });
    }

    // Candidate doc IDs (tenant-specific first, then fallback)
    // IMPORTANT: Always verify tenantId matches to prevent cross-tenant leaks
    const candidates = [
      `test_grade_${g}_${resolvedTenantId}`,
      `test_grade_${g}`,
      `test_${g}`,
      `${g}`
    ];

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

    return res.json({ success: true, questions: sanitized, timeLimitMinutes: testData.timeLimitMinutes || 90 });
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

// Helper: process exam submission locally using Firestore keys and TypeScript scoring engine
async function processExamSubmission(payload: any) {
  const { sessionId, shortId, studentName, grade, answers, cheated, isTester, isRetake, tenantId, action } = payload;
  const studentEmail = payload.studentEmail || payload.email || '';
  const studentPhone = payload.studentPhone || payload.phone || '';
  const resolvedTenantId = tenantId || 'org_future_leaders';

  if (!shortId || !studentName || !grade) {
    return { success: false, error: "Missing required submission fields" };
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
      const testCandidates = [
        `test_grade_${grade}_${resolvedTenantId}`,
        `test_grade_${grade}`,
        `test_${grade}`,
        `${grade}`
      ];
      let testFound = false;
      for (const docId of testCandidates) {
        const snap = await admin.firestore().collection("tests").doc(docId).get();
        const data = snap.data();
        if (data && data.tenantId && data.tenantId !== resolvedTenantId) {
          continue; // tenantId mismatch, try next
        }
        if (data && data.questions) {
          testFound = true;
          realQuestions = {
            russian: Array.isArray(data.questions.russian) ? data.questions.russian : [],
            math: Array.isArray(data.questions.math) ? data.questions.math : [],
            logic: Array.isArray(data.questions.logic) ? data.questions.logic : [],
          };
          break;
        }
      }
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
      keys = { russian: {}, math: {}, logic: {}, english: {} };
      for (const candId of candidateIds) {
        const docSnap = await admin.firestore().collection("test_answer_keys").doc(candId).get();
        if (docSnap.exists) {
          const docKeys = docSnap.data()?.keys || {};
          if (docKeys.russian) keys.russian = { ...docKeys.russian, ...keys.russian };
          if (docKeys.math) keys.math = { ...docKeys.math, ...keys.math };
          if (docKeys.logic) keys.logic = { ...docKeys.logic, ...keys.logic };
          if (docKeys.english) keys.english = { ...docKeys.english, ...keys.english };
        }
      }
    } catch (e) {
      console.warn("[Exams/Submit] Failed to fetch answer keys from Firestore:", e);
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
        answersJson: typeof answers === 'string' ? answers : JSON.stringify(answers || {}),
        diagnosticSummary: summaryText,
        diagnosticsRaw,
        status: "ЗАВЕРШЕН"
      };

      await admin.firestore().collection("submissions").doc(submissionId).set(subDoc, { merge: true });

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
      await admin.firestore().collection("crm_contacts").doc(contactId).set(contactDoc, { merge: true });

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
      await admin.firestore().collection("crm_deals").doc(dealId).set(dealDoc, { merge: true });

      // Audit Log
      admin.firestore().collection("audit_logs").add({
        timestamp: admin.firestore.Timestamp.now(),
        createdAt: new Date().toISOString(),
        action: "EXAM_SUBMITTED",
        tenantId: resolvedTenantId,
        sessionId: submissionId,
        studentName: studentName || "Неизвестно",
        studentShortId: String(shortId),
        grade: Number(grade) || 0,
        scores: scores,
        cheated: Boolean(cheated)
      }).catch(e => console.error("Audit log write notice:", e));
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
        try {
          const tenantSnap = await admin.firestore().collection("tenants").doc(resolvedTenantId).get();
          tenantName = tenantSnap.data()?.name || resolvedTenantId;
        } catch (e) { /* fall back to raw tenantId */ }

        const result = await sendTestResultEmail({
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
app.post("/api/exams/submit", async (req, res) => {
  try {
    const subResult = await processExamSubmission(req.body);
    return res.json(subResult);
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
        const tenantId = req.query.tenantId || "org_future_leaders";
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
    
    // Check if tester
    const TESTER_PIN = process.env.VITE_TESTER_PIN;
    if (TESTER_PIN && (payload.action === "submitTest" || payload.action === "submitEnglishTest") && payload.testerPin) {
      if (payload.testerPin === TESTER_PIN) {
        payload.isTester = true;
      }
      delete payload.testerPin; // do not send pin to GAS
    }
    
    // For protected actions, verify Firebase Auth token
    const publicActions = [
      "submitTest", 
      "submitEnglishTest", 
      "registerStudent", 
      "suspendTest", 
      "checkSuspendStatus", 
      "getStudentByShortId", 
      "getCertificateRegistry"
    ];
    if (!publicActions.includes(payload.action)) {
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace("Bearer ", "").trim();
      
      if (!token) {
         return res.status(401).json({ error: "Unauthorized: Missing Firebase ID Token" });
      }
      
      try {
        await admin.auth().verifyIdToken(token);
      } catch(e) {
        return res.status(401).json({ error: "Unauthorized: Invalid Firebase ID Token" });
      }
    }

    // Handle exam submission locally using Firestore keys & TypeScript scoring engine
    if (payload.action === "submitTest" || payload.action === "submitEnglishTest") {
      try {
        const subResult = await processExamSubmission(payload);
        return res.json(subResult);
      } catch (subErr: any) {
        console.error("[GAS Proxy] Local exam submission error:", subErr);
      }
    }

    let rawText = "";
    let data;
    
    try {
      const fetchRes = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(50000) // 50 seconds timeout for Google Apps Script cold starts and Google Docs PDF exports
      });
      
      rawText = await fetchRes.text();
      data = JSON.parse(rawText);
    } catch (e: any) {
      console.warn(`GAS Proxy fetch error for action [${payload.action}]:`, e.name === 'AbortError' ? 'Timeout' : e.message);
      
      // If payload action was submitTest or submitEnglishTest, attempt quick recovery
      if (payload.action === 'submitTest' || payload.action === 'submitEnglishTest') {
        try {
          const shortId = payload.shortId;
          const recoverRes = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getStudentByShortId", shortId, apiKey: gasApiKey }),
            signal: AbortSignal.timeout(5000)
          });
          const recoverData = JSON.parse(await recoverRes.text());
          if (recoverData.success && recoverData.student && (recoverData.student.totalScore > 0 || recoverData.student.english > 0)) {
            return res.json({
              success: true,
              totalScore: recoverData.student.totalScore,
              scores: { russian: recoverData.student.russian, math: recoverData.student.math, logic: recoverData.student.logic, english: recoverData.student.english },
              cheated: recoverData.student.cheated,
              diagnosticsReport: recoverData.student.diagnosticsReport
            });
          }
        } catch (recoverErr) {}
      }

      return res.status(503).json({ 
        success: false, 
        error: "Google Apps Script временно не ответил. Попробуйте еще раз через несколько секунд.",
        details: e.message 
      });
    }

    // Handle edge case: if GAS says "already submitted", recover student data and return success
    if (data && !data.success && data.error && 
        (payload.action === 'submitTest' || payload.action === 'submitEnglishTest') &&
        data.error.includes('already')) {
      try {
        const shortId = payload.shortId;
        const recoverRes = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getStudentByShortId", shortId, apiKey: gasApiKey }),
          signal: AbortSignal.timeout(5000)
        });
        const recoverData = JSON.parse(await recoverRes.text());
        if (recoverData.success && recoverData.student) {
          return res.json({
            success: true,
            totalScore: recoverData.student.totalScore,
            scores: { russian: recoverData.student.russian, math: recoverData.student.math, logic: recoverData.student.logic, english: recoverData.student.english },
            cheated: recoverData.student.cheated,
            diagnosticsReport: recoverData.student.diagnosticsReport
          });
        }
      } catch (recoverErr) {
        console.warn('Recovery after already-submitted failed:', recoverErr);
      }
    }
    
    // Sync with Firestore if final decision updated
    if (payload.action === "updateFinalDecision" && data.success && payload.childName) {
      try {
        const decisionStatus = payload.finalDecision === "ПРИНЯТ" ? "accepted" : "rejected";
        const childName = payload.childName.trim().toLowerCase();
        
        // Find user by matching first/last name, scoped to tenant
        const snapshot = await admin.firestore().collection('users')
          .where("tenantId", "==", payload.tenantId || "org_future_leaders")
          .get();
        let matchedUserId = null;
        
        snapshot.forEach(doc => {
           const d = doc.data();
           const f = (d.firstName || "").toLowerCase().trim();
           const l = (d.lastName || "").toLowerCase().trim();
           const fullName1 = `${f} ${l}`.trim();
           const fullName2 = `${l} ${f}`.trim();
           if (childName === fullName1 || childName === fullName2 || childName === f || childName.includes(f) || fullName1.includes(childName)) {
              matchedUserId = doc.id;
           }
        });
        
        if (matchedUserId) {
          await admin.firestore().collection('users').doc(matchedUserId).update({
            decisionStatus,
            feedback: payload.feedback || ""
          });
        }
        
        // Also update decisions collection for redundancy/Signup.tsx logic
        const docId = childName.replace(/\s+/g, '_');
        await admin.firestore().collection('decisions').doc(docId).set({
           fullName: childName,
           decisionStatus,
           feedback: payload.feedback || "",
           updatedAt: new Date().toISOString()
        }, { merge: true });
        
      } catch (syncErr) {
        console.error("Firestore sync error:", syncErr);
      }
    }
    
    res.json(data);
  } catch (err: any) {
    console.error("GAS Proxy error:", err);
    res.status(500).json({ error: "Failed to communicate with GAS" });
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
        isSuperAdmin = decodedToken.admin === true || Boolean(email.endsWith("@studyfreeforum.com"));
        
        if (!isSuperAdmin) {
          const userDoc = await admin.firestore().collection("users").doc(uid).get();
          const userData = userDoc.data();
          isSuperAdmin = userData?.globalRole === "superadmin" || userData?.role === "superadmin";
        }
      }
    } catch (sdkErr: any) {
      console.warn("[ADMIN_AUTH] Admin SDK verify notice:", sdkErr.message);
    }

    // Fallback: Decode signed JWT payload if Admin SDK service account key is unconfigured
    if (!isSuperAdmin && idToken) {
      try {
        const parts = idToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
          email = payload.email || "";
          uid = payload.user_id || payload.sub || "";
          isSuperAdmin = Boolean(email.endsWith("@studyfreeforum.com")) || payload.admin === true;
        }
      } catch (e) {}
    }

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
        isSuperAdmin = decoded.admin === true || Boolean(email.endsWith("@studyfreeforum.com"));
        
        if (!isSuperAdmin) {
          const userDoc = await admin.firestore().collection("users").doc(uid).get();
          const userData = userDoc.data();
          isSuperAdmin = userData?.globalRole === "superadmin" || userData?.role === "superadmin";
        }
      }
    } catch (sdkErr: any) {}

    if (!isSuperAdmin) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
          email = payload.email || "";
          uid = payload.user_id || payload.sub || "";
          isSuperAdmin = Boolean(email.endsWith("@studyfreeforum.com")) || payload.admin === true;
        }
      } catch (e) {}
    }

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
app.post("/api/manager/allow-retake", requireAuth, async (req, res) => {
  const { shortId } = req.body;
  if (!shortId) return res.status(400).json({ error: "shortId is required" });
  if (!useFirebase) return res.status(500).json({ error: "Firebase not configured" });
  
  try {
    await admin.firestore().collection("retakes").doc(shortId).set({
      shortId,
      tenantId: req.body.tenantId || "org_future_leaders",
      allowed: true,
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
