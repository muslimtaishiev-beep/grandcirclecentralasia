import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CustomBusinessFunction, WorkflowAction, AuditTrailLog, StaffMember } from '../types/engine';

export interface ExecutionContext {
  tenantId: string;
  user: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    ip?: string;
    userAgent?: string;
  };
  formValues: Record<string, any>;
  qrToken?: string;
}

export class WorkflowExecutionService {
  
  /**
   * Primary entry point for executing a Custom Business Function Pipeline
   */
  public static async executeFunction(
    businessFunction: CustomBusinessFunction,
    context: ExecutionContext
  ): Promise<{ success: boolean; executedActions: string[]; auditLogId: string; errors?: string[] }> {
    const { pipeline } = businessFunction;
    const executedActions: string[] = [];
    const errors: string[] = [];

    // 1. Evaluate Pipeline Conditions
    if (pipeline.conditions && pipeline.conditions.length > 0) {
      const conditionsPassed = this.evaluateConditions(pipeline.conditions, context.formValues);
      if (!conditionsPassed) {
        return {
          success: false,
          executedActions: [],
          auditLogId: '',
          errors: ['Условия пайплайна не выполнены. Исполнение остановлено.']
        };
      }
    }

    // 2. Generate unique QR Token if needed and not present
    const qrToken = context.qrToken || `QR_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 3. Execute Actions Sequentially (ActionExecutionEngine)
    for (const action of pipeline.actions) {
      try {
        await this.dispatchAction(action, context, qrToken);
        executedActions.push(action.type);
      } catch (err: any) {
        console.error(`[Workflow Engine Error] Action ${action.type} failed:`, err);
        errors.push(`Action ${action.type}: ${err.message}`);
      }
    }

    // 4. Record Immutable Audit Log to Firestore
    const auditLogId = await this.recordAuditTrail(businessFunction, context, executedActions, errors);

    return {
      success: errors.length === 0,
      executedActions,
      auditLogId,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Action Execution Factory (ActionExecutionEngine)
   */
  private static async dispatchAction(
    action: WorkflowAction,
    context: ExecutionContext,
    qrToken: string
  ): Promise<void> {
    switch (action.type) {
      
      case 'GENERATE_PDF':
        // CraftDynamicPdf: Replace variables in HTML template & generate QR verification token
        await this.executeGeneratePdf(action, context, qrToken);
        break;

      case 'SEND_EMAIL':
        // SendBrandedEmail: Send email from tenant SMTP alias
        await this.executeSendEmail(action, context);
        break;

      case 'SEND_TELEGRAM_NOTIFICATION':
        // TelegramAlertBot: Send push alert to staff Telegram chat
        await this.executeTelegramAlert(action, context, qrToken);
        break;

      case 'CREATE_CRM_LEAD':
        // LeadAutoScreening: Create CRM deal in pipeline stage
        await this.executeCreateCrmLead(action, context);
        break;

      case 'SCHEDULE_EVENT':
        // SlotScheduler: Book slot & generate WebRTC room
        await this.executeScheduleEvent(action, context);
        break;

      case 'GENERATE_INVOICE_QR':
        // TriggerPaymentQr: Generate payment invoice & QR
        await this.executeGenerateInvoiceQr(action, context);
        break;

      case 'MUTATE_DATABASE_RECORD':
        // Firestore record mutation
        await this.executeDatabaseMutation(action, context);
        break;

      default:
        console.warn(`[Workflow Engine] Unsupported action type: ${(action as any).type}`);
    }
  }

  /**
   * Action Helper: GENERATE_PDF (CraftDynamicPdf)
   */
  private static async executeGeneratePdf(
    action: { type: 'GENERATE_PDF'; templateHtml: string; outputFileName: string; attachQrTracker: boolean },
    context: ExecutionContext,
    qrToken: string
  ): Promise<void> {
    let renderedHtml = action.templateHtml;
    // Variable interpolation {{fieldName}}
    Object.entries(context.formValues).forEach(([key, val]) => {
      renderedHtml = renderedHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(val || ''));
    });

    if (action.attachQrTracker) {
      const verificationUrl = `${window.location.origin}/track/${qrToken}`;
      renderedHtml += `<div style="margin-top:20px;text-align:right;"><p>QR Подлинности: ${qrToken}</p><p>${verificationUrl}</p></div>`;
    }

    // Save generated PDF record to Firestore collection "documents"
    const docId = `pdf_${Date.now()}_${qrToken}`;
    await setDoc(doc(db, 'documents', docId), {
      tenantId: context.tenantId,
      title: action.outputFileName,
      renderedHtml,
      qrToken,
      applicantName: context.formValues.fullName || context.user.fullName,
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  /**
   * Action Helper: SEND_EMAIL (SendBrandedEmail)
   */
  private static async executeSendEmail(
    action: { type: 'SEND_EMAIL'; templateId: string; toField: string; fromAlias: string; subject: string },
    context: ExecutionContext
  ): Promise<void> {
    const recipientEmail = context.formValues[action.toField] || context.user.email;
    try {
      await fetch('/api/auth/send-employee-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recipientEmail,
          fullName: context.formValues.fullName || context.user.fullName,
          tenantName: context.tenantId,
          subject: action.subject
        })
      });
    } catch (e) {
      console.warn("Email API trigger fallback:", e);
    }
  }

  /**
   * Action Helper: SEND_TELEGRAM_NOTIFICATION (TelegramAlertBot)
   */
  private static async executeTelegramAlert(
    action: { type: 'SEND_TELEGRAM_NOTIFICATION'; chatTarget: 'client' | 'staff_group'; textTemplate: string; botToken?: string; chatId?: string },
    context: ExecutionContext,
    qrToken: string
  ): Promise<void> {
    let messageText = action.textTemplate;
    Object.entries(context.formValues).forEach(([key, val]) => {
      messageText = messageText.replace(new RegExp(`{{${key}}}`, 'g'), String(val || ''));
    });

    // Save telegram notification payload for bot listener
    await addDoc(collection(db, 'notifications'), {
      tenantId: context.tenantId,
      type: 'telegram_bot_alert',
      messageText,
      qrToken,
      chatTarget: action.chatTarget,
      createdAt: serverTimestamp()
    });
  }

  /**
   * Action Helper: CREATE_CRM_LEAD (LeadAutoScreening)
   */
  private static async executeCreateCrmLead(
    action: { type: 'CREATE_CRM_LEAD'; pipelineId: string; initialStage: string },
    context: ExecutionContext
  ): Promise<void> {
    const dealId = `deal_${Date.now()}`;
    await setDoc(doc(db, 'crm_deals'), {
      id: dealId,
      tenantId: context.tenantId,
      title: context.formValues.fullName ? `Заявка: ${context.formValues.fullName}` : 'Новая сделка',
      value: Number(context.formValues.amount || context.formValues.value) || 0,
      column: action.initialStage || 'new',
      contactId: context.formValues.phone || context.user.email,
      source: 'workflow_builder',
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  /**
   * Action Helper: SCHEDULE_EVENT (SlotScheduler)
   */
  private static async executeScheduleEvent(
    action: { type: 'SCHEDULE_EVENT'; durationMinutes: number; calendarDepartmentId: string },
    context: ExecutionContext
  ): Promise<void> {
    const roomCode = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await addDoc(collection(db, 'schedule_events'), {
      tenantId: context.tenantId,
      departmentId: action.calendarDepartmentId,
      title: `Встреча / Запись (${context.formValues.fullName || 'Заявитель'})`,
      durationMinutes: action.durationMinutes,
      videoRoomUrl: `${window.location.origin}/workspace/${context.tenantId}/chat?room=${roomCode}`,
      createdAt: serverTimestamp()
    });
  }

  /**
   * Action Helper: GENERATE_INVOICE_QR (TriggerPaymentQr)
   */
  private static async executeGenerateInvoiceQr(
    action: { type: 'GENERATE_INVOICE_QR'; amountField: string; gateway: 'kaspi' | 'mbank' | 'stripe' },
    context: ExecutionContext
  ): Promise<void> {
    const amount = Number(context.formValues[action.amountField]) || 1000;
    await addDoc(collection(db, 'subscriptions'), {
      tenantId: context.tenantId,
      applicantName: context.formValues.fullName || context.user.fullName,
      amount,
      gateway: action.gateway,
      status: 'pending_payment',
      createdAt: serverTimestamp()
    });
  }

  /**
   * Action Helper: MUTATE_DATABASE_RECORD
   */
  private static async executeDatabaseMutation(
    action: { type: 'MUTATE_DATABASE_RECORD'; targetCollection: string; operation: 'create' | 'update' },
    context: ExecutionContext
  ): Promise<void> {
    const docId = `rec_${Date.now()}`;
    await setDoc(doc(db, action.targetCollection, docId), {
      tenantId: context.tenantId,
      ...context.formValues,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  /**
   * Evaluates conditions against form fields
   */
  private static evaluateConditions(
    conditions: { field: string; operator: string; value: any }[],
    formValues: Record<string, any>
  ): boolean {
    return conditions.every(cond => {
      const actualVal = formValues[cond.field];
      switch (cond.operator) {
        case 'equals': return actualVal === cond.value;
        case 'not_equals': return actualVal !== cond.value;
        case 'greater_than': return Number(actualVal) > Number(cond.value);
        case 'less_than': return Number(actualVal) < Number(cond.value);
        case 'contains': return String(actualVal || '').toLowerCase().includes(String(cond.value).toLowerCase());
        default: return true;
      }
    });
  }

  /**
   * Writes Immutable Audit Log Entry to Firestore collection "audit_logs"
   */
  private static async recordAuditTrail(
    businessFunction: CustomBusinessFunction,
    context: ExecutionContext,
    executedActions: string[],
    errors: string[]
  ): Promise<string> {
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const logEntry: AuditTrailLog = {
      id: logId,
      tenantId: context.tenantId,
      who: {
        userId: context.user.userId,
        fullName: context.user.fullName,
        email: context.user.email,
        role: context.user.role,
        ip: context.user.ip || '127.0.0.1',
        userAgent: context.user.userAgent || 'Browser'
      },
      functionId: businessFunction.id,
      functionSlug: businessFunction.slug,
      actionType: executedActions.join(', '),
      status: errors.length === 0 ? 'success' : 'failed',
      payloadDiff: context.formValues,
      errorMessage: errors.join('; ') || undefined,
      timestamp: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'audit_logs', logId), {
        ...logEntry,
        createdAt: serverTimestamp()
      });
    } catch(e) {
      console.warn("Audit log save notice:", e);
    }

    return logId;
  }
}
