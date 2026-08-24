import { useState, useEffect } from 'react';
import { payrollService } from '../../services/edu/payrollService';
import { TeacherPayrollRecord } from '../../types/edu';

export function useTeacherPayroll(tenantId: string, monthPeriod: string) {
  const [records, setRecords] = useState<TeacherPayrollRecord[]>([]);

  useEffect(() => {
    if (!tenantId || !monthPeriod) return;
    const unsub = payrollService.subscribeToPayroll(tenantId, monthPeriod, (data) => {
      setRecords(data);
    });
    return () => unsub();
  }, [tenantId, monthPeriod]);

  const approve = async (recordId: string) => {
    await payrollService.approvePayroll(tenantId, recordId);
  };

  const markPaid = async (recordId: string) => {
    await payrollService.markAsPaid(tenantId, recordId);
  };

  return {
    records,
    approve,
    markPaid
  };
}
