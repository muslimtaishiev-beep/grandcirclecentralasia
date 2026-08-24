export type SystemFeatureModule = 
  | 'MODULE_ANTI_CHEAT_PROCTORING'   // Полноэкранный локдаун, трекинг смены вкладок, веб-камера
  | 'MODULE_STUDENT_QR_IDENTIFIERS'  // Генерация QR-паспортов, часовые PIN-коды, верификация
  | 'MODULE_DIAGNOSTIC_PDF_ENGINE'   // Автогенерация PDF-отчетов с графиками по предметам
  | 'MODULE_EDU_CORE_JOURNAL'        // Расписание, журнал, абонементы, зарплаты
  | 'MODULE_CRM_PIPELINES'           // Воронки продаж, карточки контактов, сделки
  | 'MODULE_WEBRTC_CONFERENCING'     // Видеоконференции и шеринг экрана
  | 'MODULE_NOCODE_FUNCTION_STUDIO'  // Конструктор кастомных бизнес-функций
  | 'MODULE_SITE_LANDING_BUILDER'    // Wix-подобный конструктор публичных страниц
  | 'MODULE_COLLAB_DOCS_SHEETS';     // Встроенные документы и таблицы

export interface TenantFeatureConfig {
  moduleId: SystemFeatureModule;
  isEnabled: boolean;
  settings?: Record<string, any>;
}

export interface TenantDomainConfig {
  tenantId: string;
  subdomain: string; // "futureleaders", "oxford-bishkek"
  customDomain?: string; // "portal.futureleaders.edu"
  isVerified: boolean;
  sslActive: boolean;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  brandColors?: {
    primary: string;
    accent: string;
  };
  tierId: 'starter' | 'business' | 'enterprise';
  status: 'active' | 'frozen' | 'pending';
  enabledModules: SystemFeatureModule[];
  ownerEmail: string;
  createdAt: number;
  updatedAt: number;
}
