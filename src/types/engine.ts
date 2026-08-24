import { Timestamp } from "firebase/firestore";

// ────────────────────────────────────────────────────────────────────────────
// 1. TENANT & BRANDING SETTINGS
// ────────────────────────────────────────────────────────────────────────────

export interface TenantBranding {
  logoUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  faviconUrl: string;
}

export interface TenantEmailSettings {
  senderName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  replyTo: string;
}

export interface Tenant {
  id: string; // e.g. "school_logos", "clinic_nova"
  name: string;
  subdomain: string; // e.g. "logos.studyfreeforum.com"
  customDomain?: string; // e.g. "exam.logos.kg"
  branding: TenantBranding;
  emailSettings: TenantEmailSettings;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. STAFF MEMBER & GRANULAR PBAC/RBAC PERMISSION MATRIX
// ────────────────────────────────────────────────────────────────────────────

export interface ModulePermission {
  moduleId: string; // Custom function ID or built-in module key (e.g., "crm", "proctoring", "issue-certificate")
  moduleName?: string;
  canView: boolean;
  canEdit: boolean;
  canExecute: boolean; // Permission to run process / issue document / trigger action
  canExport: boolean;
  visibleFields: string[]; // Field-level data masking (e.g., ["studentName", "grade", "score"])
}

export interface StaffMember {
  id: string;
  tenantId: string;
  userId: string;
  fullName: string;
  email: string;
  departmentId: string; // e.g. "dept_admissions", "dept_finance"
  branchId?: string;
  role: 'owner' | 'admin' | 'manager' | 'teacher' | 'custom';
  customPermissions: ModulePermission[];
  status: 'active' | 'suspended';
  createdAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. NO-CODE CUSTOM BUSINESS FUNCTIONS & WORKFLOW PIPELINES
// ────────────────────────────────────────────────────────────────────────────

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'file' | 'formula' | 'signature';
  required: boolean;
  options?: string[];
  placeholder?: string;
  validationRule?: string; // Regex string or formula rule
}

export interface PipelineCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export type WorkflowAction = 
  | { type: 'GENERATE_PDF'; templateHtml: string; outputFileName: string; attachQrTracker: boolean }
  | { type: 'SEND_EMAIL'; templateId: string; toField: string; fromAlias: string; subject: string }
  | { type: 'SEND_TELEGRAM_NOTIFICATION'; chatTarget: 'client' | 'staff_group'; textTemplate: string; botToken?: string; chatId?: string }
  | { type: 'CREATE_CRM_LEAD'; pipelineId: string; initialStage: string }
  | { type: 'SCHEDULE_EVENT'; durationMinutes: number; calendarDepartmentId: string }
  | { type: 'GENERATE_INVOICE_QR'; amountField: string; gateway: 'kaspi' | 'mbank' | 'stripe' }
  | { type: 'MUTATE_DATABASE_RECORD'; targetCollection: string; operation: 'create' | 'update' };

export interface CustomBusinessFunction {
  id: string;
  tenantId: string;
  name: string; // e.g. "Выписка академической справки", "Бронирование консультации"
  slug: string; // e.g. "issue-transcript", "book-slot"
  targetAudience: 'public_client' | 'internal_staff' | 'hybrid';
  icon: string;
  description: string;
  
  formFields: FormFieldDefinition[];

  pipeline: {
    trigger: 'on_form_submit' | 'on_status_change' | 'on_payment_success' | 'manual_button';
    conditions?: PipelineCondition[];
    actions: WorkflowAction[];
  };

  accessControl: {
    allowedDepartments: string[];
    allowedRoles: string[];
    requiresApproval: boolean;
    approverRoleId?: string;
  };

  createdAt?: string;
  updatedAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. AUDIT TRAIL & LOGGING SCHEMA
// ────────────────────────────────────────────────────────────────────────────

export interface AuditTrailLog {
  id: string;
  tenantId: string;
  who: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    ip: string;
    userAgent?: string;
  };
  functionId: string;
  functionSlug: string;
  actionType: string;
  status: 'success' | 'failed';
  payloadDiff: Record<string, any>;
  errorMessage?: string;
  timestamp: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. LANDING PAGE & SITE BUILDER
// ────────────────────────────────────────────────────────────────────────────

export type BlockType = 
  | 'HERO' 
  | 'FEATURES_GRID' 
  | 'FUNCTION_EMBED'    // Вставка кастомной функции из FunctionStudio
  | 'PRICING_TABLE' 
  | 'TESTIMONIALS' 
  | 'FAQ_ACCORDION' 
  | 'FOOTER';

export interface SiteBlock {
  id: string;
  type: BlockType;
  order: number;
  config: {
    title?: string;
    subtitle?: string;
    backgroundColor?: string;
    textColor?: string;
    embeddedFunctionId?: string;
    items?: Array<{
      id: string;
      title: string;
      description: string;
      icon?: string;
      avatarUrl?: string;
      authorRole?: string;
    }>;
    ctaText?: string;
    ctaLink?: string;
  };
}

export interface TenantLandingPage {
  id: string;
  tenantId: string;
  slug: string;
  isPublished: boolean;
  seo: {
    metaTitle: string;
    metaDescription: string;
    ogImageUrl?: string;
  };
  theme: {
    fontFamily: string;
    primaryColor: string;
    accentColor: string;
  };
  blocks: SiteBlock[];
  updatedAt: number;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. DOCUMENT TEMPLATING ENGINE
// ────────────────────────────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  tenantId: string; // "GLOBAL" or tenant ID
  name: string;
  htmlContent: string;
  variables: {
    key: string;
    label: string;
    type: 'text' | 'date' | 'number';
  }[];
  layout: 'A4-portrait' | 'A4-landscape';
  createdAt?: number;
  updatedAt?: number;
}
