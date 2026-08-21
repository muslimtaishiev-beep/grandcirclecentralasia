export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'trial';

export interface ScheduleEvent {
  id: string;
  tenantId: string;
  title: string;
  groupName: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  startTime: string; // HH:mm format, e.g. "14:00"
  endTime: string;   // HH:mm format, e.g. "15:30"
  color?: string;
  studentIds?: string[];
  createdAt?: any;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  eventId: string;
  eventTitle: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  deductedFromSubscriptionId?: string;
  markedByUserId: string;
  markedAt: any;
}

export interface StudentSubscription {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  packageName: string; // e.g. "8 уроков", "12 уроков", "Индивидуальный"
  totalLessons: number;
  remainingLessons: number;
  price: number;
  isPaid: boolean;
  status: 'active' | 'frozen' | 'expired';
  validUntil: string; // YYYY-MM-DD
  createdAt: any;
}

export interface FamilyProfile {
  id: string;
  tenantId: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  children: {
    studentId: string;
    studentName: string;
    grade?: string;
  }[];
  familyBalance: number; // Single family wallet in KZT/KGS/UZS/USD
  createdAt: any;
}

export interface TeacherPayrollRecord {
  id: string;
  tenantId: string;
  teacherId: string;
  teacherName: string;
  month: string; // YYYY-MM
  totalLessonsTaught: number;
  totalStudentsAttended: number;
  calculatedSalary: number;
  rateType: 'hourly' | 'per_student' | 'percentage';
  rateValue: number;
  status: 'draft' | 'approved' | 'paid';
  updatedAt: any;
}
