import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { createNotification } from './useNotifications';

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  trigger: {
    type: 'CRM_DEAL_STAGE_CHANGE' | 'NEW_CONTACT' | 'NEW_TASK';
    targetStage?: string;
  };
  action: {
    type: 'CREATE_TASK' | 'SEND_NOTIFICATION' | 'ADD_CHAT_MESSAGE';
    taskTitle?: string;
    notificationTitle?: string;
    notificationBody?: string;
    assigneeRole?: string;
  };
  createdAt?: any;
}

export function useAutomations(tenantId: string | undefined) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setRules([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'automations'),
      where('tenantId', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AutomationRule[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AutomationRule);
      });
      setRules(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const addRule = async (rule: Omit<AutomationRule, 'id' | 'createdAt'>) => {
    if (!tenantId) return;
    await addDoc(collection(db, 'automations'), {
      ...rule,
      tenantId,
      createdAt: serverTimestamp()
    });
  };

  const toggleRule = async (ruleId: string, active: boolean) => {
    await updateDoc(doc(db, 'automations', ruleId), { active });
  };

  const deleteRule = async (ruleId: string) => {
    await deleteDoc(doc(db, 'automations', ruleId));
  };

  return { rules, loading, addRule, toggleRule, deleteRule };
}

// Function to trigger automations matching an event
export async function triggerAutomation(
  tenantId: string,
  triggerType: 'CRM_DEAL_STAGE_CHANGE' | 'NEW_CONTACT' | 'NEW_TASK',
  payload: { title?: string; stage?: string; contactName?: string; userId?: string }
) {
  try {
    const q = query(
      collection(db, 'automations'),
      where('tenantId', '==', tenantId),
      where('active', '==', true)
    );
    const snap = await getDocs(q);

    snap.forEach(async (docSnap) => {
      const rule = docSnap.data() as AutomationRule;
      if (rule.trigger.type !== triggerType) return;

      // Filter by stage if required
      if (rule.trigger.targetStage && rule.trigger.targetStage !== payload.stage) {
        return;
      }

      // Execute Action
      if (rule.action.type === 'SEND_NOTIFICATION' && payload.userId) {
        await createNotification({
          tenantId,
          userId: payload.userId,
          title: rule.action.notificationTitle || `🤖 Робот: ${rule.name}`,
          body: rule.action.notificationBody || `Сработало авто-правило для ${payload.title || payload.contactName || 'объекта'}`,
          type: 'system'
        });
      } else if (rule.action.type === 'CREATE_TASK') {
        await addDoc(collection(db, 'tasks'), {
          tenantId,
          title: `🤖 [Авто-задача] ${rule.action.taskTitle || 'Проверить объект'}`,
          description: `Автоматически создано правилом: ${rule.name}. Объект: ${payload.title || payload.contactName}`,
          status: 'todo',
          priority: 'high',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    });
  } catch (err) {
    console.error('Failed to trigger automation:', err);
  }
}
