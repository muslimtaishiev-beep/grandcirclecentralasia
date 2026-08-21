/**
 * Firebase Firestore Schema Types — B2B SaaS Testing Platform
 *
 * Flat architecture: every document carries `tenantId` for data isolation.
 * Security Rules enforce that users can only read/write within their tenant.
 *
 * Collection paths:
 *   /tenants/{tenantId}
 *   /tests/{testId}
 *   /questions/{questionId}
 *   /exam_sessions/{sessionId}
 *   /submissions/{submissionId}
 */

import { Timestamp } from "firebase/firestore";

// ────────────────────────────────────────────────────────────────────────────
// 1. TENANTS (Организации / Школы)
// ────────────────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;                    // URL-friendly identifier: "grand-circle"
  name: string;                    // "Grand Circle Central Asia"
  createdAt: Timestamp;
  status: "active" | "suspended" | "trial";

  branding: {
    logoUrl: string | null;
    primaryColor: string;          // hex: "#0C3674"
    loginMessage: string | null;
  };

  settings: {
    maxStudents: number;           // Plan limit
    allowedDomains: string[];      // Restrict email domains (optional)
    proctoringEnabled: boolean;
    storageProvider: "firebase_storage" | "google_drive";
    gasUrl: string | null;         // GAS endpoint for this tenant (справки, CRM backup)
    gasApiKey: string | null;      // Encrypted or hashed
  };

  contacts: {
    email: string;
    phone: string;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. TESTS (Тесты)
// ────────────────────────────────────────────────────────────────────────────

export interface Test {
  id: string;
  tenantId: string;

  title: string;                   // "Вступительный тест 2026"
  description: string;
  subjects: TestSubject[];         // ["russian", "math", "logic", "english"]
  targetGrades: number[];          // [7, 8, 9, 10, 11]

  timeLimitMinutes: number;        // 0 = unlimited
  status: "draft" | "published" | "archived";

  // Question IDs per grade — different sets for different grades
  questionSets: Record<string, string[]>; // { "9": ["q_abc", "q_def", ...] }

  proctoringConfig: {
    requireCamera: boolean;
    requireMicrophone: boolean;
    strictMode: boolean;
    violationThreshold: number;    // Max violations before auto-terminate
    enabledDetectors: ProctoringDetector[];
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TestSubject = "russian" | "math" | "logic" | "english";

export type ProctoringDetector =
  | "GAZE_TRACKING"
  | "FACE_COUNT"
  | "HAND_TRACKING"
  | "AUDIO_ANALYSIS"
  | "TAB_SWITCH"
  | "PHONE_DETECTION"
  | "GESTURE_DECODER"
  | "LIP_READING";  // Listed but disabled (returns "Нарушений не выявлено")

// ────────────────────────────────────────────────────────────────────────────
// 3. QUESTIONS (Банк вопросов)
// ────────────────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  tenantId: string;

  /** Original key from GAS, e.g. "russian_1", "ma_1_9", "logic_3" */
  originalKey: string;

  subject: TestSubject;
  grade: number;                   // 7, 8, 9, 10, 11

  type: "single_choice" | "multiple_choice" | "text_input" | "matching" | "ordering";
  text: string;
  imageUrl?: string;

  options?: QuestionOption[];

  /**
   * Correct answer(s) — format depends on type:
   * - single_choice: ["option_id"]
   * - multiple_choice: ["opt_a", "opt_c"]
   * - text_input: ["exact_string"] or ["variant1", "variant2"] (case-insensitive)
   * - matching: JSON string of correct mapping
   * - ordering: JSON string of correct order
   */
  correctAnswers: string[];

  weight: number;                  // Points for correct answer
  topic: string;                   // Diagnostic topic: "Орфография: Корни и приставки"
  tags: string[];

  createdAt: Timestamp;
}

export interface QuestionOption {
  id: string;                      // "opt_" + nanoid
  text: string;
  imageUrl?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. EXAM SESSIONS (Активные сессии)
// ────────────────────────────────────────────────────────────────────────────

export interface ExamSession {
  id: string;                      // UUID (same as testId from current system)
  tenantId: string;

  testId: string;
  studentName: string;
  studentShortId: string;          // 6-digit code: "570490"
  grade: number;
  isTester: boolean;
  isRetake: boolean;

  status: "REGISTERED" | "IN_PROGRESS" | "SUSPENDED" | "SUBMITTED" | "TERMINATED";

  startedAt: Timestamp;
  expiresAt: Timestamp | null;

  /** Live answers — synced periodically and on suspend */
  currentAnswers: Record<string, string | string[]>;  // { questionKey: answer }

  /** Phase tracking for multi-phase tests (main + english) */
  currentPhase: "main" | "english";
  completedPhases: string[];

  /** Browser/device telemetry */
  deviceInfo: {
    userAgent: string;
    screenResolution: string;
    ip: string;
  };

  /** Proctoring telemetry pings (lightweight, every 10s) */
  lastTelemetryAt: Timestamp | null;

  updatedAt: Timestamp;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SUBMISSIONS (Результаты — IMMUTABLE после создания)
// ────────────────────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  tenantId: string;

  testId: string;                  // Link to Test
  sessionId: string;               // Link to ExamSession
  studentName: string;
  studentShortId: string;
  grade: number;

  submittedAt: Timestamp;

  /** Did student switch tabs / get caught cheating? */
  cheated: boolean;

  /** Scores per subject */
  scores: {
    russian: number;
    math: number;
    logic: number;
    english: number;
    total: number;
  };

  /** Raw answers JSON — exactly as submitted by student */
  answersJson: string;             // JSON.stringify of answers object

  /** Diagnostic breakdown by topic */
  diagnostics: DiagnosticEntry[];

  /** Human-readable diagnostic summary */
  diagnosticSummary: string | null; // "🟢 СИЛЬНЫЕ СТОРОНЫ: ..."

  /** Proctoring evidence */
  proctoring: {
    honestyIndex: number;          // 0-100
    totalViolations: number;
    evidenceFolderUrl: string | null;
    logs: ProctoringLogEntry[];
  };

  /** Migration metadata */
  _migration?: {
    source: "google_sheets" | "live";
    migratedAt: string;            // ISO timestamp
    originalRowIndex?: number;
  };
}

export interface DiagnosticEntry {
  topic: string;                   // "Алгебра: Вычисления и преобразования"
  subject: TestSubject;
  earned: number;
  possible: number;
}

export interface ProctoringLogEntry {
  timestamp: number;               // ms from session start
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. GLOBAL USERS & RBAC (Глобальные пользователи и роли)
// ────────────────────────────────────────────────────────────────────────────

export interface CustomRole {
  id: string;
  name: string;                     // "Управляющий", "Работник", "Инструктор", etc.
  description?: string;
  permissions: RolePermissions;
}

export interface RolePermissions {
  canManageOrganization: boolean;   // Изменение настроек школы
  canManageUsers: boolean;          // Добавление/Удаление работников
  canCreateTests: boolean;         // Редактирование банков вопросов и тестов
  canReviewSubmissions: boolean;   // Просмотр и проверка результатов тестирования
  canViewAnalytics: boolean;       // Доступ к отчетам и аналитике
  canManageSchedule: boolean;      // Расписание и журнал
  canViewFinancials: boolean;      // Финансы и выплаты
}

export interface PlatformUser {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  avatarUrl: string | null;
  globalRole: "superadmin" | "user";
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: string;                  // "Управляющий" | "Работник" | customRole.name
  customRoleId?: string;
  permissions: Partial<RolePermissions>;
  status: "active" | "invited" | "suspended";
  invitedBy: string;
  joinedAt: Timestamp;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. TENANT INVITES (Заявки на создание организации)
// ────────────────────────────────────────────────────────────────────────────

export interface TenantInvite {
  id: string;
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  contactPerson: string;
  description: string;
  requestedAt: Timestamp;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  rejectReason: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// COLLECTION PATHS (for use in queries)
// ────────────────────────────────────────────────────────────────────────────

export const FIRESTORE_COLLECTIONS = {
  TENANTS: "tenants",
  TENANT_INVITES: "tenant_invites",
  USERS: "users",
  MEMBERSHIPS: "memberships",
  TESTS: "tests",
  QUESTIONS: "questions",
  EXAM_SESSIONS: "exam_sessions",
  SUBMISSIONS: "submissions",
} as const;
