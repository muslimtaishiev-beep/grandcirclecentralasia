import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { AutomationRule, AutomationExecutionLog } from '../types/automations';

export function useAutomations(tenantId: string) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationExecutionLog[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'tenants', tenantId, 'automation_rules'));
    const unsub = onSnapshot(q, (snap) => {
      setRules(snap.docs.map(d => ({ ...d.data(), id: d.id } as AutomationRule)));
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'tenants', tenantId, 'automation_logs'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as AutomationExecutionLog)));
    });
    return () => unsub();
  }, [tenantId]);

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    if (!tenantId) return;
    const ref = doc(db, 'tenants', tenantId, 'automation_rules', ruleId);
    await updateDoc(ref, { isActive });
  };

  return {
    rules,
    logs,
    toggleRule
  };
}
