export type LessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled';
export type AttendanceStatus = 'present' | 'absent_unexcused' | 'absent_excused' | 'late';
export type SubscriptionType = 'lessons_pack' | 'time_period' | 'deposit_balance';
export type PayrollCalculationType = 'fixed_per_lesson' | 'hourly_rate' | 'revenue_share_percent';

export interface ClassroomRoom {
  id: string;
  tenantId: string;
  name: string;
  capacity: number;
  colorTag: string;
}

export interface AcademicGroup {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  primaryTeacherStaffId: string;
  defaultRoomId?: string;
  studentContactIds: string[];
  color: string;
  status: 'active' | 'archived';
  createdAt: number;
}

export interface ScheduleLessonSlot {
  id: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  teacherStaffId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  topic?: string;
  homework?: string;
  status: LessonStatus;
  webrtcRoomId?: string;
  createdAt: number;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  lessonId: string;
  studentContactId: string;
  studentName: string;
  status: AttendanceStatus;
  grade?: number;
  comment?: string;
  isDeductedFromSubscription: boolean;
  updatedByStaffId: string;
  updatedAt: number;
}

export interface StudentSubscription {
  id: string;
  tenantId: string;
  studentContactId: string;
  studentName: string;
  groupId?: string;
  type: SubscriptionType;
  totalLessons: number;
  remainingLessons: number;
  pricePaid: number;
  currency: 'USD' | 'KGS' | 'KZT';
  startDate: string;
  expiryDate: string;
  isFrozen: boolean;
  frozenUntilDate?: string;
  status: 'active' | 'expired' | 'depleted' | 'frozen';
  createdAt: number;
}

export interface TeacherPayrollRate {
  teacherStaffId: string;
  calculationType: PayrollCalculationType;
  rateValue: number;
}

export interface TeacherPayrollRecord {
  id: string;
  tenantId: string;
  teacherStaffId: string;
  teacherName: string;
  monthPeriod: string; // "2026-08"
  totalLessonsConducted: number;
  totalHours: number;
  baseEarnings: number;
  bonuses: number;
  deductions: number;
  finalTotal: number;
  currency: 'USD' | 'KGS' | 'KZT';
  status: 'draft' | 'approved' | 'paid';
  paidAt?: number;
}
