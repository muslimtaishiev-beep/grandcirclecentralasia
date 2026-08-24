import { useState, useEffect, useMemo } from 'react';
import { scheduleService } from '../../services/edu/scheduleService';
import { ScheduleLessonSlot } from '../../types/edu';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, formatISO } from 'date-fns';

export function useScheduleCalendar(tenantId: string) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'rooms'>('week');
  const [slots, setSlots] = useState<ScheduleLessonSlot[]>([]);
  const [filters, setFilters] = useState<{ teacherId?: string; groupId?: string }>({});

  const dateRange = useMemo(() => {
    return {
      start: formatISO(startOfWeek(currentDate, { weekStartsOn: 1 })),
      end: formatISO(endOfWeek(currentDate, { weekStartsOn: 1 }))
    };
  }, [currentDate]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = scheduleService.subscribeToSchedule(tenantId, dateRange.start, dateRange.end, (data) => {
      setSlots(data);
    });
    return () => unsub();
  }, [tenantId, dateRange.start, dateRange.end]);

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      if (filters.teacherId && slot.teacherStaffId !== filters.teacherId) return false;
      if (filters.groupId && slot.groupId !== filters.groupId) return false;
      return true;
    });
  }, [slots, filters]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const addSlot = async (slotData: Omit<ScheduleLessonSlot, 'id' | 'createdAt'>) => {
    await scheduleService.createLesson(tenantId, slotData);
  };

  return {
    currentDate,
    view,
    setView,
    slots: filteredSlots,
    filters,
    setFilters,
    nextWeek,
    prevWeek,
    goToday,
    addSlot
  };
}
