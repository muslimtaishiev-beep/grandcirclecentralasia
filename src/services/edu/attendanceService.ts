import { db } from '../../lib/firebase';
import { collection, doc, query, where, getDocs, setDoc, updateDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { AttendanceRecord, AttendanceStatus, StudentSubscription } from '../../types/edu';
import { payrollService } from './payrollService';

class AttendanceService {
  subscribeToGroupAttendance(tenantId: string, groupId: string, month: string, onUpdate: (records: AttendanceRecord[]) => void) {
    // A simplified query. In production, we'd query by lessonIds for that month.
    // Assuming lessonId contains the date or we fetch lessons first.
    const q = query(
      collection(db, 'tenants', tenantId, 'edu_attendance'),
      where('lessonId', '>=', month),
      where('lessonId', '<=', month + '\uf8ff')
    );
    return onSnapshot(q, (snap) => {
      // Client filters by groupId (if we added it to the record, which would be smart)
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord)));
    });
  }

  async markAttendance(
    tenantId: string, 
    groupId: string,
    lessonId: string, 
    studentContactId: string, 
    studentName: string, 
    status: AttendanceStatus, 
    staffId: string,
    teacherStaffId: string // Need teacher ID to log payroll
  ) {
    const batch = writeBatch(db);
    const recordId = `${lessonId}_${studentContactId}`;
    const recordRef = doc(db, 'tenants', tenantId, 'edu_attendance', recordId);
    
    let isDeducted = false;

    if (status === 'present' || status === 'absent_unexcused' || status === 'late') {
      // Find active subscription
      const subQ = query(
        collection(db, 'tenants', tenantId, 'edu_subscriptions'),
        where('studentContactId', '==', studentContactId),
        where('status', '==', 'active')
      );
      const subSnap = await getDocs(subQ);
      
      if (!subSnap.empty) {
        const subDoc = subSnap.docs[0];
        const subData = subDoc.data() as StudentSubscription;
        
        if (subData.remainingLessons > 0) {
          const newRemaining = subData.remainingLessons - 1;
          const newStatus = newRemaining === 0 ? 'depleted' : 'active';
          
          batch.update(subDoc.ref, {
            remainingLessons: newRemaining,
            status: newStatus
          });
          isDeducted = true;
        }
      }
    }

    batch.set(recordRef, {
      tenantId,
      groupId,
      lessonId,
      studentContactId,
      studentName,
      status,
      isDeductedFromSubscription: isDeducted,
      updatedByStaffId: staffId,
      updatedAt: Date.now()
    } as Omit<AttendanceRecord, 'id'>, { merge: true });

    await batch.commit();

    // Trigger payroll background update for the teacher
    if (status === 'present') {
      // Simple logic: if at least one student is present, the lesson counts towards payroll
      // This could be optimized to run only once per lesson
      const month = lessonId.substring(0, 7); // Assuming lessonId starts with YYYY-MM
      await payrollService.logConductedLesson(tenantId, teacherStaffId, month);
    }
  }
}

export const attendanceService = new AttendanceService();
