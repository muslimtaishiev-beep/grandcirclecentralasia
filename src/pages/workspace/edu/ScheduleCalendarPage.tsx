import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, MapPin, BookOpen, CopyPlus } from 'lucide-react';
import { Button, PageHeader, Spinner, EmptyState, toast, confirmDialog, input } from '../../../components/ui';
import { useWorkspaceTerms } from '../../../lib/useWorkspaceConfig';
import { apiCall, post } from '../../../lib/eduApi';
import { layoutDay, minutesOf, type EduDirectory } from '../../../shared/edu';
import { useScheduleCalendar, addDaysStr, weekStartOf, type ScheduleView } from '../../../hooks/edu/useScheduleCalendar';
import type { ScheduleLessonSlot } from '../../../types/edu';
import ScheduleSlotModal, { type StaffItem } from './components/ScheduleSlotModal';
import DirectoryModal from './components/DirectoryModal';

const H0 = 7, H1 = 22, PX = 56; // сетка с 7:00 до 22:00
const EMPTY_DIR: EduDirectory = { rooms: [], groups: [], plans: [], timezone: 'UTC' };
const dayTitle = (s: string, opt: Intl.DateTimeFormatOptions) => new Date(`${s}T12:00:00`).toLocaleDateString('ru-RU', opt);
const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-200',
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-200',
  canceled: 'bg-slate-100 border-slate-300 text-slate-500 line-through dark:bg-slate-700/40 dark:border-slate-600',
};

export default function ScheduleCalendarPage() {
  const terms = useWorkspaceTerms();
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || '';
  const [dir, setDir] = useState<EduDirectory>(EMPTY_DIR);
  const [teachers, setTeachers] = useState<StaffItem[]>([]);
  const [today, setToday] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<{ slot: ScheduleLessonSlot | null; defaults?: { date: string; start?: string; roomId?: string } } | null>(null);
  const [showDir, setShowDir] = useState(false);

  const loadDir = useCallback(async () => {
    if (!tenantId) return;
    try {
      const j = await apiCall<EduDirectory & { teachers: StaffItem[]; today: string }>(`/api/edu/${tenantId}/directory`);
      setDir({ rooms: j.rooms, groups: j.groups, plans: j.plans, timezone: j.timezone }); setTeachers(j.teachers); setToday(j.today);
    } catch (e: any) { toast.error(e.message); } finally { setReady(true); }
  }, [tenantId]);
  useEffect(() => { loadDir(); }, [loadDir]);

  const cal = useScheduleCalendar(tenantId, today);
  const { current, view, slots, filters, setFilters, range } = cal;

  const days = useMemo(() => view === 'week' ? Array.from({ length: 7 }, (_, i) => addDaysStr(weekStartOf(current), i)) : [current], [current, view]);
  // Колонки: дни (день/неделя) или кабинеты выбранного дня.
  const columns = useMemo(() => view === 'rooms'
    ? [...dir.rooms.map(r => ({ key: r.id, title: r.name, sub: '', pick: (s: ScheduleLessonSlot) => s.roomId === r.id, date: current, roomId: r.id })),
       ...(slots.some(s => !s.roomId) ? [{ key: '_', title: '—', sub: '', pick: (s: ScheduleLessonSlot) => !s.roomId, date: current, roomId: '' }] : [])]
    : days.map(d => ({ key: d, title: dayTitle(d, { weekday: 'short' }), sub: dayTitle(d, { day: 'numeric' }), pick: (s: ScheduleLessonSlot) => s.startTime.slice(0, 10) === d, date: d, roomId: '' })),
  [view, days, dir.rooms, slots, current]);

  const copyWeek = async () => {
    if (!(await confirmDialog({ title: 'Скопировать эту неделю на следующую?', confirmLabel: 'Скопировать' }))) return;
    try {
      const r = await post<{ created: number; skipped: string[] }>(`/api/edu/${tenantId}/lessons/copy-week`, { weekStart: weekStartOf(current), weeks: 1 });
      toast.success(`Создано: ${r.created}${r.skipped.length ? `, пропущено: ${r.skipped.length}` : ''}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const views: { id: ScheduleView; label: string }[] = [{ id: 'day', label: 'День' }, { id: 'week', label: 'Неделя' }, { id: 'rooms', label: terms.room }];
  const title = view === 'week' ? `${dayTitle(range.from, { day: 'numeric', month: 'short' })} — ${dayTitle(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}` : dayTitle(current, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const select = (v: string | undefined, set: (x: string | undefined) => void, all: string, items: { id: string; name: string }[]) => (
    <select className={`${input} !w-auto`} value={v || ''} onChange={e => set(e.target.value || undefined)}>
      <option value="">{all}</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );

  if (!ready) return <Spinner />;
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={'Расписание'} actions={<>
        <Button variant="secondary" icon={<BookOpen className="w-4 h-4" />} onClick={() => setShowDir(true)}>Справочники</Button>
        {view === 'week' && <Button variant="secondary" icon={<CopyPlus className="w-4 h-4" />} onClick={copyWeek}>Копировать неделю</Button>}
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing({ slot: null, defaults: { date: view === 'week' ? (current >= range.from && current <= range.to ? current : range.from) : current } })}>{`Новое: ${terms.lesson.toLowerCase()}`}</Button>
      </>} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg border border-[var(--border-color)] p-0.5">
          {views.map(v => <button key={v.id} onClick={() => cal.setView(v.id)} className={`px-3 py-1 text-sm rounded-md ${view === v.id ? 'bg-[var(--accent)] text-white font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{v.label}</button>)}
        </div>
        <Button variant="secondary" aria-label="Назад" icon={<ChevronLeft className="w-4 h-4" />} onClick={cal.prev} />
        <Button variant="secondary" onClick={cal.goToday}>Сегодня</Button>
        <Button variant="secondary" aria-label="Вперёд" icon={<ChevronRight className="w-4 h-4" />} onClick={cal.next} />
        <span className="font-semibold text-[var(--text-main)] capitalize">{title}</span>
        <div className="flex flex-wrap gap-2 ml-auto">
          {select(filters.teacherId, v => setFilters(f => ({ ...f, teacherId: v })), terms.teacher, teachers)}
          {select(filters.groupId, v => setFilters(f => ({ ...f, groupId: v })), terms.group, dir.groups)}
          {select(filters.roomId, v => setFilters(f => ({ ...f, roomId: v })), terms.room, dir.rooms)}
        </div>
      </div>
      {cal.error && <div role="alert" className="mb-3 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{cal.error}</div>}

      {dir.groups.length === 0 && <EmptyState title={`Добавьте ${terms.group.toLowerCase()}`} action={<Button variant="primary" onClick={() => setShowDir(true)}>Справочники</Button>} />}

      {(dir.groups.length > 0 || slots.length > 0) && (
        <div className="overflow-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="min-w-[760px]">
            <div className="flex sticky top-0 z-20 bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
              <div className="w-14 shrink-0" />
              {columns.map(c => (
                <div key={c.key} className="flex-1 min-w-0 text-center py-2 border-l border-[var(--border-color)]">
                  <div className="text-xs text-[var(--text-muted)] uppercase truncate px-1">{c.title}</div>
                  {c.sub && <div className={`text-lg font-bold ${c.date === today ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>{c.sub}</div>}
                </div>
              ))}
            </div>
            <div className="flex">
              <div className="w-14 shrink-0">
                {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} style={{ height: PX }} className="text-[11px] text-[var(--text-muted)] text-right pr-2 pt-1">{H0 + i}:00</div>)}
              </div>
              {columns.map(c => {
                const items = layoutDay(slots.filter(c.pick));
                return (
                  <div key={c.key} className="flex-1 min-w-0 relative border-l border-[var(--border-color)]" style={{ height: (H1 - H0) * PX }}>
                    {Array.from({ length: H1 - H0 }, (_, i) => (
                      <button key={i} type="button" aria-label={`Новое на ${H0 + i}:00`} onClick={() => setEditing({ slot: null, defaults: { date: c.date, start: `${String(H0 + i).padStart(2, '0')}:00`, roomId: c.roomId } })}
                        className="block w-full border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]" style={{ height: PX }} />
                    ))}
                    {items.map(({ item: s, col, cols }) => {
                      const top = Math.max(0, (minutesOf(s.startTime) - H0 * 60) / 60 * PX);
                      const h = Math.max(22, (minutesOf(s.endTime) - minutesOf(s.startTime)) / 60 * PX - 2);
                      return (
                        <button key={s.id} type="button" onClick={() => setEditing({ slot: s })}
                          style={{ top, height: h, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                          className={`absolute rounded-md border px-1.5 py-1 text-left overflow-hidden text-xs hover:shadow-md ${STATUS_CLASS[s.status] || STATUS_CLASS.scheduled}`}>
                          <div className="font-semibold truncate">{s.groupName}</div>
                          <div className="opacity-80 truncate">{s.startTime.slice(11)}–{s.endTime.slice(11)}</div>
                          {(s.roomName || s.teacherName) && <div className="opacity-80 truncate flex items-center gap-1">{s.roomName && <><MapPin className="w-3 h-3 shrink-0" />{s.roomName}</>}{s.roomName && s.teacherName ? ' · ' : ''}{s.teacherName}</div>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editing && <ScheduleSlotModal key={editing.slot?.id || 'new'} tenantId={tenantId} dir={dir} teachers={teachers} slot={editing.slot} defaults={editing.defaults} onClose={() => setEditing(null)} onSaved={() => { /* живая подписка обновит сетку */ }} />}
      {showDir && <DirectoryModal tenantId={tenantId} dir={dir} onClose={() => setShowDir(false)} onSaved={d => { setDir(d); loadDir(); }} />}
    </div>
  );
}
