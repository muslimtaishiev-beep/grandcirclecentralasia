import { db } from '../../lib/firebase';
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ScheduleLessonSlot } from '../../types/edu';

class ScheduleService {
  subscribeToSchedule(tenantId: string, startDateIso: string, endDateIso: string, onUpdate: (slots: ScheduleLessonSlot[]) => void) {
    // In a real app we'd query by date range. Firestore inequality filters have limits,
    // so we typically filter in memory if the dataset is small, or use a composite index.
    const q = query(
      collection(db, 'tenants', tenantId, 'edu_schedule'),
      where('startTime', '>=', startDateIso),
      where('startTime', '<=', endDateIso)
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleLessonSlot)));
    });
  }

  async validateScheduleConflict(tenantId: string, roomId: string, teacherStaffId: string, startTime: string, endTime: string, ignoreLessonId?: string) {
    const q = query(
      collection(db, 'tenants', tenantId, 'edu_schedule'),
      where('startTime', '<', endTime)
    );
    
    const snap = await getDocs(q);
    const overlapping = snap.docs
      .map(d => ({ ...d.data(), id: d.id } as ScheduleLessonSlot))
      .filter(l => l.endTime > startTime && l.id !== ignoreLessonId);

    // Пустое поле — не измерение для конфликтов: у организаций, где кабинет
    // или ведущий необязательны, все занятия имели бы roomId === '' и
    // «конфликтовали» бы друг с другом поголовно.
    const roomConflict = roomId ? overlapping.find(l => l.roomId === roomId) : undefined;
    if (roomConflict) {
      throw new Error(`Конфликт кабинета: ${roomConflict.roomName || roomId} уже занят (${roomConflict.groupName || "другое занятие"})`);
    }

    const teacherConflict = teacherStaffId ? overlapping.find(l => l.teacherStaffId === teacherStaffId) : undefined;
    if (teacherConflict) {
      throw new Error(`Конфликт преподавателя: ${teacherConflict.teacherName || teacherStaffId} уже занят (${teacherConflict.groupName || "другое занятие"})`);
    }
  }

  async createLesson(tenantId: string, lesson: Omit<ScheduleLessonSlot, 'id' | 'createdAt'>) {
    await this.validateScheduleConflict(tenantId, lesson.roomId, lesson.teacherStaffId, lesson.startTime, lesson.endTime);
    
    const ref = doc(collection(db, 'tenants', tenantId, 'edu_schedule'));
    await setDoc(ref, {
      ...lesson,
      createdAt: Date.now()
    });
    return ref.id;
  }

  async updateLesson(tenantId: string, lessonId: string, updates: Partial<ScheduleLessonSlot>) {
    const ref = doc(db, 'tenants', tenantId, 'edu_schedule', lessonId);
    await updateDoc(ref, updates);
  }

  async deleteLesson(tenantId: string, lessonId: string) {
    const ref = doc(db, 'tenants', tenantId, 'edu_schedule', lessonId);
    await deleteDoc(ref);
  }
}

export const scheduleService = new ScheduleService();
