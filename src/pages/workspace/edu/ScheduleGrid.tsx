import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Plus, Clock, MapPin, User, AlertTriangle, CheckCircle, Filter, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ScheduleEvent } from '../../../types/edu';

export default function ScheduleGrid() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1); // 1 = Monday
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');

  // Clash Error State
  const [clashError, setClashError] = useState<string | null>(null);

  const days = [
    { id: 1, name: 'Понедельник' },
    { id: 2, name: 'Вторник' },
    { id: 3, name: 'Среда' },
    { id: 4, name: 'Четверг' },
    { id: 5, name: 'Пятница' },
    { id: 6, name: 'Суббота' },
    { id: 7, name: 'Воскресенье' },
  ];

  const roomsList = ['Кабинет 101 (Main)', 'Кабинет 102 (Lab)', 'Кабинет 201 (VIP)', 'Онлайн Зал (Zoom)'];

  useEffect(() => {
    if (!orgId) return;

    const q = query(collection(db, 'schedule_events'), where('tenantId', '==', orgId));
    const unsub = onSnapshot(q, (snap) => {
      const items: ScheduleEvent[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as ScheduleEvent));
      setEvents(items);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // Clash Detection Helper Function
  const checkClash = (
    newDay: number,
    newStart: string,
    newEnd: string,
    newRoom: string,
    newTeacher: string
  ): string | null => {
    for (const evt of events) {
      if (evt.dayOfWeek === newDay) {
        // Time Overlap Check: start1 < end2 AND start2 < end1
        if (newStart < evt.endTime && evt.startTime < newEnd) {
          if (evt.roomName === newRoom) {
            return `Накладка Кабинета: "${evt.roomName}" уже занят группой "${evt.groupName}" в это время (${evt.startTime} - ${evt.endTime}).`;
          }
          if (evt.teacherName.toLowerCase() === newTeacher.toLowerCase() && newTeacher.trim() !== '') {
            return `Накладка Преподавателя: "${evt.teacherName}" уже ведёт урок у группы "${evt.groupName}" (${evt.startTime} - ${evt.endTime}).`;
          }
        }
      }
    }
    return null;
  };

  const handleAddEvent = async () => {
    setClashError(null);

    if (!title || !groupName || !roomName || !teacherName) {
      setClashError('Заполните все обязательные поля!');
      return;
    }

    if (startTime >= endTime) {
      setClashError('Время окончания должно быть позже времени начала!');
      return;
    }

    // Run Clash Detection Algorithm
    const conflict = checkClash(dayOfWeek, startTime, endTime, roomName, teacherName);
    if (conflict) {
      setClashError(conflict);
      return;
    }

    try {
      await addDoc(collection(db, 'schedule_events'), {
        tenantId: orgId,
        title,
        groupName,
        subject: subject || 'Общий курс',
        teacherId: 'tch_' + Date.now(),
        teacherName,
        roomId: 'rm_' + Date.now(),
        roomName,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        createdAt: serverTimestamp(),
      });

      setIsModalOpen(false);
      setTitle('');
      setGroupName('');
      setSubject('');
      setTeacherName('');
      setRoomName('');
    } catch (err: any) {
      setClashError(err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Удалить занятие из расписания?')) {
      await deleteDoc(doc(db, 'schedule_events', id));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[var(--accent)]" /> Расписание Занятий
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Сетка кабинетов и преподавателей с автоматической детекцией конфликтов (Clash Detection)
          </p>
        </div>

        <button
          onClick={() => {
            setClashError(null);
            setIsModalOpen(true);
          }}
          className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4.5 h-4.5" /> Добавить занятие
        </button>
      </div>

      {/* Grid Timetable Display */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map((day) => {
          const dayEvents = events
            .filter((e) => e.dayOfWeek === day.id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div key={day.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm flex flex-col">
              {/* Day Header */}
              <div className="p-3 bg-[var(--bg-app)] border-b border-[var(--border-color)] text-center">
                <div className="font-bold text-xs font-mono uppercase tracking-wider text-[var(--text-main)]">{day.name}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{dayEvents.length} уроков</div>
              </div>

              {/* Day Events */}
              <div className="p-2 space-y-2 flex-1 min-h-[300px] bg-[var(--bg-surface)]">
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-[var(--text-muted)] italic">
                    Нет уроков
                  </div>
                ) : (
                  dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent)] p-3 rounded-lg shadow-xs transition group relative"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded">
                          {evt.startTime} - {evt.endTime}
                        </span>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="font-bold text-xs text-[var(--text-main)] leading-tight">{evt.title}</div>
                      <div className="text-[11px] text-[var(--accent)] font-medium mt-0.5">Группа: {evt.groupName}</div>

                      <div className="mt-2 space-y-1 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-color)]/50 pt-1.5">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-400" />
                          <span>{evt.teacherName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>{evt.roomName}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in duration-200">
            <h2 className="text-lg font-bold text-[var(--text-main)]">Новое Занятие в Расписании</h2>

            {clashError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start gap-2 text-xs text-red-500">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{clashError}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Название занятия</label>
                <input
                  type="text"
                  placeholder="напр. Английский язык B2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Группа</label>
                <input
                  type="text"
                  placeholder="Группа А-1"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Преподаватель</label>
                <input
                  type="text"
                  placeholder="Мария Иванова"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">День недели</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Кабинет</label>
                <select
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Выберите кабинет</option>
                  {roomsList.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Время начала</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Время окончания</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm hover:text-[var(--text-main)] transition"
              >
                Отмена
              </button>
              <button
                onClick={handleAddEvent}
                className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition shadow-sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
