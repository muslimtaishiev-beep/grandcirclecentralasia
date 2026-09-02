import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Users, User } from 'lucide-react';
import { ScheduleLessonSlot } from '../../../../types/edu';
import { scheduleService } from '../../../../services/edu/scheduleService';
import { useWorkspaceConfig } from '../../../../lib/useWorkspaceConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  selectedDate?: Date; // To pre-fill date
  slotToEdit?: ScheduleLessonSlot;
}

export default function ScheduleSlotModal({ isOpen, onClose, tenantId, selectedDate, slotToEdit }: Props) {
  // Терминология и обязательность полей — из настроек организации: у школы
  // урок без кабинета не бывает, у ивент-агентства «площадка» опциональна.
  const wsConfig = useWorkspaceConfig();
  const terms = wsConfig.terms;
  const needTeacher = wsConfig.schedule.requireTeacher;
  const needRoom = wsConfig.schedule.requireRoom;
  const [groupId, setGroupId] = useState(slotToEdit?.groupId || '');
  const [teacherStaffId, setTeacherStaffId] = useState(slotToEdit?.teacherStaffId || '');
  const [roomId, setRoomId] = useState(slotToEdit?.roomId || '');
  const [date, setDate] = useState(selectedDate ? selectedDate.toISOString().split('T')[0] : '');
  const [startTime, setStartTime] = useState(slotToEdit ? slotToEdit.startTime.split('T')[1].substring(0,5) : '10:00');
  const [endTime, setEndTime] = useState(slotToEdit ? slotToEdit.endTime.split('T')[1].substring(0,5) : '11:30');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Обязательность преподавателя и кабинета настраивается организацией.
    if (!groupId || !date || !startTime || !endTime
        || (needTeacher && !teacherStaffId) || (needRoom && !roomId)) {
      setError('Заполните все обязательные поля');
      return;
    }

    const startIso = `${date}T${startTime}:00.000Z`; // Mocking UTC format for simplicity
    const endIso = `${date}T${endTime}:00.000Z`;

    try {
      setLoading(true);
      const data = {
        groupId,
        // Раньше здесь сохранялись 'Mock Group'/'Mock Teacher'/'Mock Room' —
        // мусорные подписи навсегда оставались в каждом созданном занятии.
        groupName: groupId,
        teacherStaffId,
        teacherName: teacherStaffId,
        roomId,
        roomName: roomId,
        startTime: startIso,
        endTime: endIso,
        status: 'scheduled' as const,
        tenantId,
      };

      if (slotToEdit) {
        // Here we'd also validate conflict, but passing ignoreLessonId
        await scheduleService.validateScheduleConflict(tenantId, roomId, teacherStaffId, startIso, endIso, slotToEdit.id);
        await scheduleService.updateLesson(tenantId, slotToEdit.id, data);
      } else {
        await scheduleService.createLesson(tenantId, data);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border-color)]">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold">{slotToEdit ? `Редактировать: ${terms.lesson.toLowerCase()}` : `Новое занятие: ${terms.lesson.toLowerCase()}`}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-600 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Дата</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="date" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Начало</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Конец</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">{terms.group} <span className="text-red-500">*</span></label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder={terms.group}
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">
              {terms.teacher} {needTeacher
                ? <span className="text-red-500">*</span>
                : <span className="font-normal text-[var(--text-muted)]">— необязательно</span>}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder={terms.teacher}
                value={teacherStaffId}
                onChange={e => setTeacherStaffId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">
              {terms.room} {needRoom
                ? <span className="text-red-500">*</span>
                : <span className="font-normal text-[var(--text-muted)]">— необязательно</span>}
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder={terms.room}
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl hover:bg-slate-200 transition"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-[var(--accent)] text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
