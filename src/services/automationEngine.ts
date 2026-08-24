import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { AutomationRule, AutomationTriggerType, AutomationActionConfig } from '../types/automations';

class AutomationEngine {
  async emitTenantEvent(tenantId: string, triggerType: AutomationTriggerType, payload: Record<string, any>) {
    try {
      // 1. Fetch active rules for this trigger
      const q = query(
        collection(db, 'tenants', tenantId, 'automation_rules'),
        where('isActive', '==', true),
        where('triggerType', '==', triggerType)
      );
      
      const snap = await getDocs(q);
      const rules = snap.docs.map(d => ({ ...d.data(), id: d.id } as AutomationRule));

      // 2. Evaluate each rule sequentially (for simplicity in MVP)
      for (const rule of rules) {
        const isMatch = this.evaluateConditions(rule, payload);
        
        if (isMatch) {
          await this.executeRule(tenantId, rule, payload);
        } else {
          await this.logExecution(tenantId, rule.id, rule.name, triggerType, 'skipped_conditions', payload);
        }
      }
    } catch (e) {
      console.error('Event Engine Error:', e);
    }
  }

  private evaluateConditions(rule: AutomationRule, payload: Record<string, any>): boolean {
    // Check trigger filters if any
    if (rule.triggerFilter) {
      for (const [key, val] of Object.entries(rule.triggerFilter)) {
        if (val && payload[key] !== val) return false;
      }
    }

    // Check custom conditions
    for (const cond of rule.conditions) {
      const val = payload[cond.field];
      switch (cond.operator) {
        case 'equals': if (val !== cond.value) return false; break;
        case 'not_equals': if (val === cond.value) return false; break;
        case 'greater_than': if (val <= cond.value) return false; break;
        case 'contains': if (!String(val).includes(String(cond.value))) return false; break;
      }
    }

    return true;
  }

  private async executeRule(tenantId: string, rule: AutomationRule, payload: Record<string, any>) {
    try {
      for (const action of rule.actions) {
        await this.runAction(tenantId, action, payload);
      }
      
      // Update rule stats
      const ruleRef = doc(db, 'tenants', tenantId, 'automation_rules', rule.id);
      await updateDoc(ruleRef, {
        executionCount: increment(1),
        lastTriggeredAt: Date.now()
      });

      await this.logExecution(tenantId, rule.id, rule.name, rule.triggerType, 'success', payload);
    } catch (e: any) {
      await this.logExecution(tenantId, rule.id, rule.name, rule.triggerType, 'failed', payload, e.message);
    }
  }

  private async runAction(tenantId: string, action: AutomationActionConfig, payload: Record<string, any>) {
    // In a real architecture, this would publish to PubSub/Cloud Tasks
    // and worker functions would process the specific integrations.
    console.log(`[AutomationEngine] Executing ${action.type}`, action.payload, 'with payload:', payload);

    switch (action.type) {
      case 'SEND_CHAT_NOTIFICATION':
        // chatService.sendMessage(...)
        break;
      case 'SEND_TELEGRAM_ALERT':
        // fetch('/api/telegram/send', ...)
        break;
      case 'CREATE_CRM_TASK':
        // taskService.createTask(...)
        break;
      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  private async logExecution(
    tenantId: string, 
    ruleId: string, 
    ruleName: string,
    triggerType: AutomationTriggerType, 
    status: 'success' | 'failed' | 'skipped_conditions', 
    payload: any, 
    errorDetails?: string
  ) {
    const ref = doc(collection(db, 'tenants', tenantId, 'automation_logs'));
    await setDoc(ref, {
      tenantId,
      ruleId,
      ruleName,
      triggerType,
      status,
      payloadSnapshot: payload,
      errorDetails: errorDetails || null,
      timestamp: Date.now()
    });
  }
}

export const automationEngine = new AutomationEngine();
