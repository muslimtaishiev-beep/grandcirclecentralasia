import { useState, useEffect } from 'react';
import { attendanceService } from '../../services/edu/attendanceService';
import { AttendanceRecord, AttendanceStatus } from '../../types/edu';
import { useAuth } from '../../contexts/AuthContext';

export function useAttendanceJournal(tenantId: string, groupId: string, month: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!tenantId || !groupId || !month) return;
    const unsub = attendanceService.subscribeToGroupAttendance(tenantId, groupId, month, (data) => {
      setRecords(data);
    });
    return () => unsub();
  }, [tenantId, groupId, month]);

  const markAttendance = async (
    lessonId: string, 
    studentContactId: string, 
    studentName: string, 
    status: AttendanceStatus,
    teacherStaffId: string
  ) => {
    if (!user) return;
    // Optimistic update
    const recordId = `${lessonId}_${studentContactId}`;
    setRecords(prev => {
      const exists = prev.find(r => r.id === recordId);
      if (exists) {
        return prev.map(r => r.id === recordId ? { ...r, status } : r);
      }
      return [...prev, {
        id: recordId,
        tenantId,
        groupId,
        lessonId,
        studentContactId,
        studentName,
        status,
        isDeductedFromSubscription: false, // will be resolved on server
        updatedByStaffId: user.uid,
        updatedAt: Date.now()
      }];
    });

    await attendanceService.markAttendance(
      tenantId,
      groupId,
      lessonId,
      studentContactId,
      studentName,
      status,
      user.uid,
      teacherStaffId
    );
  };

  return {
    records,
    markAttendance
  };
}
