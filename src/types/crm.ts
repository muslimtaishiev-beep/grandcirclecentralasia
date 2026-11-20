export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  probabilityPercent: number;
  isWonStage?: boolean;
  isLostStage?: boolean;
}

export interface CrmPipeline {
  id: string;
  tenantId: string;
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
  departmentId?: string;
  /** Валюта сумм воронки; по умолчанию — системная. */
  currency?: string;
  createdAt: number;
}

export interface CrmDeal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: number;
  currency: string;
  contactId: string;
  /** Подписи из старых записей (приём, тесты) — без карточки контакта. */
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  grade?: string | number;
  testScore?: number;
  archived?: boolean;
  archivedAt?: number;
  archivedBy?: string;
  assigneeStaffId?: string;
  source?: 'website_form' | 'manual' | 'dynamic_function' | 'referral' | 'admission';
  customFunctionSubmissionId?: string;
  status: 'open' | 'won' | 'lost';
  lossReason?: string;
  tags: string[];
  expectedCloseDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrmContact {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  companyName?: string;
  type: 'student' | 'parent' | 'corporate_client' | 'partner' | 'lead' | 'employee';
  tags: string[];
  status?: 'active' | 'archived';
  archivedAt?: number;
  totalDealsCount: number;
  totalRevenueGenerated: number;
  createdAt: number;
  updatedAt: number;
}

export interface CrmActivityLog {
  id: string;
  tenantId: string;
  targetType: 'deal' | 'contact';
  targetId: string;
  authorStaffId: string;
  authorName: string;
  action: 'stage_changed' | 'note_added' | 'call_logged' | 'function_executed' | 'deal_created' | 'deal_updated' | 'deal_archived' | 'deal_restored' | 'contact_archived' | 'contact_restored' | 'contact_deleted' | 'pipeline_saved';
  details: string;
  timestamp: number;
}
