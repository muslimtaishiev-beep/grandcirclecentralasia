import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, MapPin } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useScheduleCalendar } from '../../../hooks/edu/useScheduleCalendar';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import { format, startOfWeek, addDays, getHours } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function ScheduleCalendarPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  
  const {
    currentDate,
    view,
    setView,
    slots,
    filters,
    setFilters,
    nextWeek,
    prevWeek,
    goToday
  } = useScheduleCalendar(activeTenant?.id);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 13 }).map((_, i) => i + 8); // 8:00 to 20:00

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      {/* Header Toolbar */}
      <div className="p-4 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex bg-[var(--bg-surface)] rounded-xl p-1 border border-[var(--border-color)]">
            <button 
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${view === 'day' ? 'bg-[var(--bg-panel)] shadow text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              День
            </button>
            <button 
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${view === 'week' ? 'bg-[var(--bg-panel)] shadow text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              Неделя
            </button>
            <button 
              onClick={() => setView('rooms')}
              className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${view === 'rooms' ? 'bg-[var(--bg-panel)] shadow text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              Кабинеты
            </button>
          </div>

          <div className="h-6 w-px bg-[var(--border-color)]"></div>

          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-surface)] transition">
              <ChevronLeft className="w-4 h-4 text-[var(--text-main)]" />
            </button>
            <button onClick={goToday} className="px-3 py-2 border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-surface)] transition text-sm font-bold text-[var(--text-main)]">
              Сегодня
            </button>
            <button onClick={nextWeek} className="p-2 border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-surface)] transition">
              <ChevronRight className="w-4 h-4 text-[var(--text-main)]" />
            </button>
            <span className="ml-2 font-bold text-[var(--text-main)] capitalize">
              {format(currentDate, 'LLLL yyyy', { locale: ru })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={filters.teacherId || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, teacherId: e.target.value || undefined }))}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none"
          >
            <option value="">Все преподаватели</option>
            <option value="t1">Джон Доу</option>
          </select>
          <button 
            onClick={() => { setSelectedSlot(null); setIsModalOpen(true); }}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Новый урок
          </button>
        </div>
      </div>

      {/* Calendar Grid (Week View implementation) */}
      <div className="flex-1 overflow-auto bg-[var(--bg-app)] relative">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="flex sticky top-0 z-10 bg-[var(--bg-panel)] border-b border-[var(--border-color)]">
            <div className="w-16 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] z-20"></div>
            {days.map(day => (
              <div key={day.toISOString()} className="flex-1 text-center py-3 border-r border-[var(--border-color)]">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{format(day, 'EEEE', { locale: ru })}</div>
                <div className={`text-lg font-black ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {hours.map(hour => (
              <div key={hour} className="flex border-b border-[var(--border-color)] h-20 group">
                <div className="w-16 shrink-0 border-r border-[var(--border-color)] flex items-start justify-center pt-2 relative bg-[var(--bg-app)] z-10">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{hour}:00</span>
                </div>
                {days.map(day => (
                  <div key={day.toISOString()} className="flex-1 border-r border-[var(--border-color)] relative">
                    {/* Render slots here based on day and hour */}
                    {slots.filter(s => {
                      const slotDate = new Date(s.startTime);
                      return format(slotDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && getHours(slotDate) === hour;
                    }).map(slot => (
                      <div 
                        key={slot.id}
                        onClick={() => { setSelectedSlot(slot); setIsModalOpen(true); }}
                        className="absolute inset-x-1 top-1 bottom-1 rounded-lg p-2 cursor-pointer transition shadow-sm hover:shadow-md border bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 overflow-hidden flex flex-col z-20"
                      >
                        <div className="text-xs font-bold truncate">{slot.groupName}</div>
                        <div className="text-[10px] font-medium opacity-80 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {slot.roomName}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ScheduleSlotModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        tenantId={activeTenant?.id}
        slotToEdit={selectedSlot}
      />
    </div>
  );
}
