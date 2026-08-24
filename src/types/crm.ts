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
  createdAt: number;
}

export interface CrmDeal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: number;
  currency: 'USD' | 'KGS' | 'KZT';
  contactId: string;
  assigneeStaffId?: string;
  source: 'website_form' | 'manual' | 'dynamic_function' | 'referral';
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
  type: 'student' | 'parent' | 'corporate_client' | 'partner';
  tags: string[];
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
  action: 'stage_changed' | 'note_added' | 'call_logged' | 'function_executed';
  details: string;
  timestamp: number;
}
