import { useEffect, useState } from 'react';
import { Button, Modal, toast, confirmDialog, input, label } from '../../../../components/ui';
import { post, put, del } from '../../../../lib/eduApi';
import { useWorkspaceConfig } from '../../../../lib/useWorkspaceConfig';
import type { EduDirectory } from '../../../../shared/edu';
import type { ScheduleLessonSlot, LessonStatus } from '../../../../types/edu';

export interface StaffItem { id: string; name: string }
interface Props {
  tenantId: string;
  dir: EduDirectory;
  teachers: StaffItem[];
  /** Занятие для правки; null — новое. */
  slot: ScheduleLessonSlot | null;
  /** Подставляемые при создании день и час. */
  defaults?: { date: string; start?: string; roomId?: string };
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_LABEL: Record<string, string> = { scheduled: 'Запланировано', completed: 'Проведено', canceled: 'Отменено' };
const hhmm = (t: string) => t.slice(11, 16);
const plusHour = (s: string) => { const [h, m] = s.split(':').map(Number); return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

/** Окно занятия: поля заполняются из занятия, значения — только из справочников организации. */
export default function ScheduleSlotModal({ tenantId, dir, teachers, slot, defaults, onClose, onSaved }: Props) {
  const wsConfig = useWorkspaceConfig();
  const terms = wsConfig.terms;
  const needTeacher = wsConfig.schedule.requireTeacher;
  const needRoom = wsConfig.schedule.requireRoom;
  const start0 = defaults?.start || '10:00';

  const [groupId, setGroupId] = useState(slot?.groupId || '');
  const [teacherStaffId, setTeacherStaffId] = useState(slot?.teacherStaffId || '');
  const [roomId, setRoomId] = useState(slot?.roomId || defaults?.roomId || '');
  const [date, setDate] = useState(slot ? slot.startTime.slice(0, 10) : (defaults?.date || ''));
  const [startTime, setStartTime] = useState(slot ? hhmm(slot.startTime) : start0);
  const [endTime, setEndTime] = useState(slot ? hhmm(slot.endTime) : plusHour(start0));
  const [topic, setTopic] = useState(slot?.topic || '');
  const [status, setStatus] = useState<LessonStatus>((slot?.status as LessonStatus) || 'scheduled');
  const [repeat, setRepeat] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Окно держит поля своей записи: при смене занятия подставляем заново.
  useEffect(() => {
    setGroupId(slot?.groupId || ''); setTeacherStaffId(slot?.teacherStaffId || ''); setRoomId(slot?.roomId || defaults?.roomId || '');
    setDate(slot ? slot.startTime.slice(0, 10) : (defaults?.date || '')); setStartTime(slot ? hhmm(slot.startTime) : start0);
    setEndTime(slot ? hhmm(slot.endTime) : plusHour(start0)); setTopic(slot?.topic || ''); setStatus((slot?.status as LessonStatus) || 'scheduled'); setRepeat(1); setError('');
  }, [slot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!groupId || !date || !startTime || !endTime || (needTeacher && !teacherStaffId) || (needRoom && !roomId)) { setError('Заполните обязательные поля'); return; }
    const body = { groupId, teacherStaffId, roomId, startTime: `${date}T${startTime}`, endTime: `${date}T${endTime}`, topic, status };
    setBusy(true);
    try {
      if (slot) await put(`/api/edu/${tenantId}/lessons/${slot.id}`, body);
      else {
        const r = await post<{ created: string[]; skipped: string[] }>(`/api/edu/${tenantId}/lessons`, { ...body, repeatWeeks: repeat });
        if (r.skipped.length) toast.error(`Пропущено из-за пересечений: ${r.skipped.length}`);
      }
      onSaved(); onClose();
    } catch (err: any) { setError(err.message || 'Ошибка сохранения'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!slot || !(await confirmDialog({ title: `Удалить: ${terms.lesson.toLowerCase()}?`, confirmLabel: 'Удалить', danger: true }))) return;
    setBusy(true);
    try { await del(`/api/edu/${tenantId}/lessons/${slot.id}`); onSaved(); onClose(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const req = <span className="text-red-500">*</span>;
  return (
    <Modal title={slot ? `Правка: ${terms.lesson.toLowerCase()}` : `Новое: ${terms.lesson.toLowerCase()}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1"><span className={label}>Дата</span><input type="date" className={input} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><span className={label}>Начало</span><input type="time" className={input} value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
          <div><span className={label}>Конец</span><input type="time" className={input} value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        </div>
        <div><span className={label}>{terms.group} {req}</span>
          <select className={input} value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">—</option>{dir.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select></div>
        <div><span className={label}>{terms.teacher} {needTeacher && req}</span>
          <select className={input} value={teacherStaffId} onChange={e => setTeacherStaffId(e.target.value)}>
            <option value="">—</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div><span className={label}>{terms.room} {needRoom && req}</span>
          <select className={input} value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">—</option>{dir.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></div>
        <div><span className={label}>Тема</span><input className={input} value={topic} maxLength={200} onChange={e => setTopic(e.target.value)} /></div>
        {slot ? (
          <div><span className={label}>Статус</span>
            <select className={input} value={status} onChange={e => setStatus(e.target.value as LessonStatus)}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
        ) : (
          <div><span className={label}>Повторять еженедельно, раз</span>
            <input type="number" min={1} max={52} className={input} value={repeat} onChange={e => setRepeat(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} /></div>
        )}
        <div className="flex flex-wrap gap-2 justify-between pt-2">
          {slot ? <Button variant="danger" onClick={remove} disabled={busy}>Удалить</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="primary" loading={busy}>Сохранить</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
