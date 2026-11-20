import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ScheduleLessonSlot } from '../../types/edu';
import { normTime } from '../../shared/edu';

/**
 * Расписание: чтение — прямо из базы (живое обновление), запись — только через
 * сервер (src/lib/eduApi.ts → /api/edu): там проверяются права, пересечения и журнал.
 */
class ScheduleService {
  /** Занятия с даты `fromDay` по `toDay` включительно (ГГГГ-ММ-ДД). */
  subscribeToSchedule(tenantId: string, fromDay: string, toDay: string, onUpdate: (slots: ScheduleLessonSlot[]) => void, onError?: (e: Error) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'edu_schedule'),
      where('startTime', '>=', fromDay),
      where('startTime', '<', `${toDay}T99`)
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => {
        const x = d.data() as ScheduleLessonSlot;
        // Старые записи хранили время с «Z» — пояс отбрасываем.
        return { ...x, id: d.id, startTime: normTime(x.startTime), endTime: normTime(x.endTime) } as ScheduleLessonSlot;
      }).filter(s => s.startTime && s.endTime));
    }, (e) => onError?.(e));
  }
}

export const scheduleService = new ScheduleService();
