export type AutomationTriggerType = 
  | 'on_deal_stage_changed'
  | 'on_attendance_marked_absent'
  | 'on_subscription_depleted'
  | 'on_custom_function_submit'
  | 'on_task_overdue';

export type AutomationActionType = 
  | 'SEND_CHAT_NOTIFICATION'
  | 'SEND_TELEGRAM_ALERT'
  | 'SEND_BRANDED_EMAIL'
  | 'CREATE_CRM_TASK'
  | 'GENERATE_DYNAMIC_DOCUMENT';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'contains';
  value: any;
}

export interface AutomationActionConfig {
  type: AutomationActionType;
  payload: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  triggerType: AutomationTriggerType;
  triggerFilter?: {
    pipelineId?: string;
    targetStageId?: string;
    groupId?: string;
    functionId?: string;
  };
  conditions: AutomationCondition[];
  actions: AutomationActionConfig[];
  executionCount: number;
  lastTriggeredAt?: number;
  createdAt: number;
}

export interface AutomationExecutionLog {
  id: string;
  tenantId: string;
  ruleId: string;
  ruleName: string;
  triggerType: AutomationTriggerType;
  status: 'success' | 'failed' | 'skipped_conditions';
  errorDetails?: string;
  payloadSnapshot: Record<string, any>;
  timestamp: number;
}
