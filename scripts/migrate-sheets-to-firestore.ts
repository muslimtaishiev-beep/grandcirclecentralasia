#!/usr/bin/env node
/**
 * Migration Script: Google Sheets → Firebase Firestore
 *
 * Reads exported test results from Google Sheets (TSV/JSON)
 * and imports them into Firestore `submissions` collection.
 *
 * Usage:
 *   1. Export "Результаты тестов" sheet as TSV
 *   2. Save as `scripts/data/test_results.tsv`
 *   3. Run: npx tsx scripts/migrate-sheets-to-firestore.ts
 *
 * Safety:
 *   - DRY_RUN=true by default (prints, doesn't write)
 *   - Set DRY_RUN=false to actually write to Firestore
 *   - All records get tenantId: "school_grand_circle"
 *   - Idempotent: uses shortId + testId as dedup key
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";
const TENANT_ID = "school_grand_circle";
const TENANT_NAME = "Grand Circle Central Asia";
const BATCH_SIZE = 400; // Firestore limit: 500 per batch

// ── FIREBASE INIT ───────────────────────────────────────────────────────────
function initFirebase() {
  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized from serviceAccountKey.json");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized from env");
  } else {
    console.error("❌ No Firebase credentials found!");
    process.exit(1);
  }
  return admin.firestore();
}

// ── TSV PARSER ──────────────────────────────────────────────────────────────
interface SheetRow {
  date: string;           // "28.07.2026, 14:29:41"
  studentName: string;
  grade: string;
  russian: string;
  math: string;
  logic: string;
  totalScore: string;
  testId: string;         // UUID
  timestamp: string;      // epoch ms
  cheated: string;        // "ДА" / "НЕТ"
  shortId: string;
  answersJson: string;    // "{}" or full JSON
  englishScore: string;
  status: string;         // "ЗАВЕРШЕН" / "ПРИОСТАНОВЛЕН" / "В ПРОЦЕССЕ"
  diagnosticsJson: string;
}

function parseTSV(filePath: string): SheetRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Skip header row
  const dataLines = lines.slice(1);
  const rows: SheetRow[] = [];

  for (const line of dataLines) {
    const cols = line.split("\t");
    if (cols.length < 11) continue; // Skip malformed rows

    rows.push({
      date: (cols[0] || "").trim(),
      studentName: (cols[1] || "").trim(),
      grade: (cols[2] || "").trim(),
      russian: (cols[3] || "0").trim(),
      math: (cols[4] || "0").trim(),
      logic: (cols[5] || "0").trim(),
      totalScore: (cols[6] || "0").trim(),
      testId: (cols[7] || "").trim(),
      timestamp: (cols[8] || "").trim(),
      cheated: (cols[9] || "НЕТ").trim(),
      shortId: (cols[10] || "").trim(),
      answersJson: (cols[11] || "{}").trim(),
      englishScore: (cols[12] || "0").trim(),
      status: (cols[13] || "").trim(),
      diagnosticsJson: (cols[14] || "{}").trim(),
    });
  }

  return rows;
}

// ── TRANSFORM: Sheet Row → Firestore Submission ─────────────────────────────
interface FirestoreSubmission {
  id: string;
  tenantId: string;
  testId: string;
  sessionId: string;
  studentName: string;
  studentShortId: string;
  grade: number;
  submittedAt: admin.firestore.Timestamp;
  cheated: boolean;
  scores: {
    russian: number;
    math: number;
    logic: number;
    english: number;
    total: number;
  };
  answersJson: string;
  diagnostics: Array<{
    topic: string;
    subject: string;
    earned: number;
    possible: number;
  }>;
  diagnosticSummary: string | null;
  proctoring: {
    honestyIndex: number;
    totalViolations: number;
    evidenceFolderUrl: string | null;
    logs: any[];
  };
  status: string;
  _migration: {
    source: string;
    migratedAt: string;
    originalRowIndex: number;
  };
}

function transformRow(row: SheetRow, rowIndex: number): FirestoreSubmission | null {
  // Skip rows with no student name or no shortId
  if (!row.studentName || !row.shortId) {
    console.warn(`  ⚠ Skipping row ${rowIndex}: no name or shortId`);
    return null;
  }

  // Parse timestamp
  let submittedAt: admin.firestore.Timestamp;
  if (row.timestamp && !isNaN(Number(row.timestamp))) {
    submittedAt = admin.firestore.Timestamp.fromMillis(Number(row.timestamp));
  } else {
    submittedAt = admin.firestore.Timestamp.now();
  }

  // Parse scores
  const russian = parseInt(row.russian) || 0;
  const math = parseInt(row.math) || 0;
  const logic = parseInt(row.logic) || 0;
  const english = parseInt(row.englishScore) || 0;
  const total = parseInt(row.totalScore) || (russian + math + logic);

  // Parse diagnostics JSON
  let diagnostics: FirestoreSubmission["diagnostics"] = [];
  let diagnosticSummary: string | null = null;

  if (row.diagnosticsJson && row.diagnosticsJson !== "{}" && row.diagnosticsJson !== "{}") {
    try {
      const parsed = JSON.parse(row.diagnosticsJson);
      if (typeof parsed === "object" && parsed !== null) {
        diagnostics = Object.entries(parsed).map(([topic, data]: [string, any]) => ({
          topic,
          subject: data.subject || "unknown",
          earned: data.earned || 0,
          possible: data.possible || 0,
        }));
      }
    } catch {
      // diagnosticsJson might be the summary string, not JSON
      if (row.diagnosticsJson.includes("🟢") || row.diagnosticsJson.includes("🔴")) {
        diagnosticSummary = row.diagnosticsJson;
      }
    }
  }

  // Generate stable document ID from shortId + testId (idempotent)
  const docId = `sub_${row.shortId}_${row.testId.slice(0, 8)}`;

  return {
    id: docId,
    tenantId: TENANT_ID,
    testId: row.testId || randomUUID(),
    sessionId: row.testId || randomUUID(),
    studentName: row.studentName,
    studentShortId: row.shortId,
    grade: parseInt(row.grade) || 0,
    submittedAt,
    cheated: row.cheated === "ДА",
    scores: { russian, math, logic, english, total },
    answersJson: row.answersJson || "{}",
    diagnostics,
    diagnosticSummary,
    proctoring: {
      honestyIndex: 100,
      totalViolations: 0,
      evidenceFolderUrl: null,
      logs: [],
    },
    status: row.status || "ЗАВЕРШЕН",
    _migration: {
      source: "google_sheets",
      migratedAt: new Date().toISOString(),
      originalRowIndex: rowIndex,
    },
  };
}

// ── ENSURE TENANT DOCUMENT EXISTS ───────────────────────────────────────────
async function ensureTenantExists(db: admin.firestore.Firestore) {
  const tenantRef = db.collection("tenants").doc(TENANT_ID);
  const snap = await tenantRef.get();

  if (!snap.exists) {
    console.log(`📌 Creating tenant document: ${TENANT_ID}`);
    await tenantRef.set({
      id: TENANT_ID,
      slug: "grand-circle",
      name: TENANT_NAME,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      branding: {
        logoUrl: null,
        primaryColor: "#0C3674",
        loginMessage: null,
      },
      settings: {
        maxStudents: 1000,
        allowedDomains: [],
        proctoringEnabled: true,
        storageProvider: "google_drive",
        gasUrl: process.env.VITE_GAS_URL || null,
        gasApiKey: null, // Never store in Firestore — use env
      },
      contacts: {
        email: "info@grandcircle.kz",
        phone: "",
      },
    });
    console.log("  ✅ Tenant created");
  } else {
    console.log(`  ℹ Tenant ${TENANT_ID} already exists`);
  }
}

// ── BATCH WRITE TO FIRESTORE ────────────────────────────────────────────────
async function writeSubmissions(
  db: admin.firestore.Firestore,
  submissions: FirestoreSubmission[]
) {
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
    const chunk = submissions.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const sub of chunk) {
      const ref = db.collection("submissions").doc(sub.id);

      // Check if already exists (idempotent)
      const existing = await ref.get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      const { id, ...data } = sub;
      batch.set(ref, data);
      written++;
    }

    if (written > 0) {
      await batch.commit();
      console.log(`  📦 Batch committed: ${written} docs (skipped ${skipped} existing)`);
    }
  }

  return { written, skipped };
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  📊 Migration: Google Sheets → Firebase Firestore");
  console.log(`  🏷  Tenant: ${TENANT_ID}`);
  console.log(`  🔒 DRY_RUN: ${DRY_RUN ? "YES (no writes)" : "NO (LIVE!)"}`);
  console.log("═══════════════════════════════════════════════\n");

  // 1. Find data file
  const dataDir = path.join(__dirname, "data");
  const tsvPath = path.join(dataDir, "test_results.tsv");
  const jsonPath = path.join(dataDir, "test_results.json");

  let rows: SheetRow[];

  if (fs.existsSync(tsvPath)) {
    console.log(`📄 Reading TSV: ${tsvPath}`);
    rows = parseTSV(tsvPath);
  } else if (fs.existsSync(jsonPath)) {
    console.log(`📄 Reading JSON: ${jsonPath}`);
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    rows = Array.isArray(raw) ? raw : raw.data || [];
  } else {
    console.error(`❌ No data file found! Place your export at:`);
    console.error(`   ${tsvPath}`);
    console.error(`   ${jsonPath}`);
    console.error(`\n📋 How to export:`);
    console.error(`   1. Open Google Sheets "Результаты тестов"`);
    console.error(`   2. File → Download → Tab-separated values (.tsv)`);
    console.error(`   3. Save to scripts/data/test_results.tsv`);
    process.exit(1);
  }

  console.log(`  📊 Rows read: ${rows.length}\n`);

  // 2. Transform rows
  const submissions: FirestoreSubmission[] = [];
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const sub = transformRow(rows[i], i);
    if (sub) {
      submissions.push(sub);
    } else {
      errors++;
    }
  }

  console.log(`  ✅ Valid submissions: ${submissions.length}`);
  console.log(`  ⚠ Skipped/errors: ${errors}\n`);

  // 3. Print sample
  if (submissions.length > 0) {
    console.log("── Sample document (first row) ──");
    const sample = submissions[0];
    console.log(JSON.stringify({
      id: sample.id,
      tenantId: sample.tenantId,
      studentName: sample.studentName,
      studentShortId: sample.studentShortId,
      grade: sample.grade,
      scores: sample.scores,
      cheated: sample.cheated,
      status: sample.status,
      diagnosticsCount: sample.diagnostics.length,
    }, null, 2));
    console.log("────────────────────────────────\n");
  }

  // 4. Grade distribution
  const gradeCount: Record<string, number> = {};
  const statusCount: Record<string, number> = {};
  for (const s of submissions) {
    gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
    statusCount[s.status || "unknown"] = (statusCount[s.status || "unknown"] || 0) + 1;
  }
  console.log("📊 Distribution by grade:", gradeCount);
  console.log("📊 Distribution by status:", statusCount);
  console.log();

  if (DRY_RUN) {
    console.log("🔒 DRY RUN — no data written to Firestore.");
    console.log("   To write for real: DRY_RUN=false npx tsx scripts/migrate-sheets-to-firestore.ts");
    return;
  }

  // 5. Initialize Firebase and write
  const db = initFirebase();

  console.log("\n🔥 Writing to Firestore...\n");
  await ensureTenantExists(db);

  const result = await writeSubmissions(db, submissions);
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  ✅ Migration complete!`);
  console.log(`  📝 Written: ${result.written} documents`);
  console.log(`  ⏭ Skipped: ${result.skipped} (already exist)`);
  console.log(`  🏷 Tenant: ${TENANT_ID}`);
  console.log(`  📁 Collection: submissions`);
  console.log(`═══════════════════════════════════════════════`);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
