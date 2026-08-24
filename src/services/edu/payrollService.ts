import { db } from '../../lib/firebase';
import { collection, doc, query, where, getDocs, setDoc, updateDoc, onSnapshot, increment } from 'firebase/firestore';
import { TeacherPayrollRecord, TeacherPayrollRate } from '../../types/edu';

class PayrollService {
  subscribeToPayroll(tenantId: string, month: string, onUpdate: (records: TeacherPayrollRecord[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'edu_payroll'),
      where('monthPeriod', '==', month)
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as TeacherPayrollRecord)));
    });
  }

  async getTeacherRate(tenantId: string, teacherStaffId: string): Promise<TeacherPayrollRate | null> {
    const q = query(collection(db, 'tenants', tenantId, 'edu_payroll_rates'), where('teacherStaffId', '==', teacherStaffId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as TeacherPayrollRate;
  }

  async logConductedLesson(tenantId: string, teacherStaffId: string, monthPeriod: string) {
    // Idempotency issue could arise here if called multiple times per lesson.
    // In production, we'd log the specific lesson ID to avoid double counting.
    // For this prototype, we'll increment the total lessons.
    
    const recordId = `${teacherStaffId}_${monthPeriod}`;
    const ref = doc(db, 'tenants', tenantId, 'edu_payroll', recordId);
    
    // Fetch rate
    const rate = await this.getTeacherRate(tenantId, teacherStaffId);
    let amountEarned = 0;
    if (rate && rate.calculationType === 'fixed_per_lesson') {
      amountEarned = rate.rateValue;
    }

    try {
      await updateDoc(ref, {
        totalLessonsConducted: increment(1),
        baseEarnings: increment(amountEarned),
        finalTotal: increment(amountEarned)
      });
    } catch (e: any) {
      if (e.code === 'not-found') {
        // Create new record
        await setDoc(ref, {
          tenantId,
          teacherStaffId,
          teacherName: 'Teacher ' + teacherStaffId.substring(0, 4), // Should fetch real name
          monthPeriod,
          totalLessonsConducted: 1,
          totalHours: 1,
          baseEarnings: amountEarned,
          bonuses: 0,
          deductions: 0,
          finalTotal: amountEarned,
          currency: 'KGS',
          status: 'draft'
        } as Omit<TeacherPayrollRecord, 'id'>);
      }
    }
  }

  async approvePayroll(tenantId: string, recordId: string) {
    const ref = doc(db, 'tenants', tenantId, 'edu_payroll', recordId);
    await updateDoc(ref, {
      status: 'approved'
    });
  }

  async markAsPaid(tenantId: string, recordId: string) {
    const ref = doc(db, 'tenants', tenantId, 'edu_payroll', recordId);
    await updateDoc(ref, {
      status: 'paid',
      paidAt: Date.now()
    });
  }
}

export const payrollService = new PayrollService();
