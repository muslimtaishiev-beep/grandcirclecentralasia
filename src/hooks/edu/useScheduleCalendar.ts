import { useState, useEffect, useMemo } from 'react';
import { scheduleService } from '../../services/edu/scheduleService';
import { ScheduleLessonSlot } from '../../types/edu';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDaysStr = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return dayStr(d);
};
/** Понедельник недели, в которую входит день. */
export const weekStartOf = (s: string) => {
  const d = new Date(`${s}T12:00:00`); const w = (d.getDay() + 6) % 7; return addDaysStr(s, -w);
};

export type ScheduleView = 'day' | 'week' | 'rooms';
export interface ScheduleFilters { teacherId?: string; groupId?: string; roomId?: string }

/** Календарь расписания: выбранный день, вид, фильтры и занятия за нужный диапазон. */
export function useScheduleCalendar(tenantId: string, today: string) {
  const [current, setCurrent] = useState(today);
  const [view, setView] = useState<ScheduleView>('week');
  const [slots, setSlots] = useState<ScheduleLessonSlot[]>([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ScheduleFilters>({});

  // Когда пояс организации загрузился и «сегодня» уточнилось — переходим на него один раз.
  useEffect(() => { setCurrent(today); }, [today]);

  const range = useMemo(() => view === 'week'
    ? { from: weekStartOf(current), to: addDaysStr(weekStartOf(current), 6) }
    : { from: current, to: current }, [current, view]);

  useEffect(() => {
    if (!tenantId) return;
    setError('');
    const unsub = scheduleService.subscribeToSchedule(tenantId, range.from, range.to, setSlots, e => setError(e.message));
    return () => unsub();
  }, [tenantId, range.from, range.to]);

  const filtered = useMemo(() => slots.filter(s =>
    (!filters.teacherId || s.teacherStaffId === filters.teacherId) &&
    (!filters.groupId || s.groupId === filters.groupId) &&
    (!filters.roomId || s.roomId === filters.roomId)), [slots, filters]);

  const step = view === 'week' ? 7 : 1;
  return {
    current, setCurrent, view, setView, slots: filtered, error, filters, setFilters, range,
    next: () => setCurrent(c => addDaysStr(c, step)),
    prev: () => setCurrent(c => addDaysStr(c, -step)),
    goToday: () => setCurrent(today),
  };
}
