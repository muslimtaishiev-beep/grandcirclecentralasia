import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Plus, Loader2, Upload, Save, Archive, Users } from "lucide-react";
import {
  COLUMN_TYPE_HINT, COLUMN_TYPE_LABEL, ROLE_LABEL, newId, optionsToTable, parseOptionsTable,
  type Journal, type JournalAccess, type JournalColumn, type JournalColumnType, type JournalRole,
  type JournalSettings, type SignSubfield, type SignSubfieldType,
} from "../../../../shared/journals";
import type { Employee } from "../journalApi";
import { btn, btnPrimary, card, input, label } from "./ui";

type Api = (path: string, init?: RequestInit) => Promise<any>;

const SUB_LABEL: Record<SignSubfieldType, string> = { checkbox: "Галочка с текстом", text: "Поле для текста", photo: "Фото" };

/**
 * Настройки журнала — для ответственного. Колонки, справочники, правила
 * закрытия записи и доступ. Справочники (ученики, виды нарушений) обычно
 * уже есть в Excel — их вставляют целиком, а не вбивают по одному.
 */
export default function JournalSettingsTab({ journal, api, onSaved, onArchived }: {
  journal: Journal; api: Api; onSaved: (j: Journal) => void; onArchived: () => void;
}) {
  const [title, setTitle] = useState(journal.title);
  const [description, setDescription] = useState(journal.description);
  const [columns, setColumns] = useState<JournalColumn[]>(journal.columns);
  const [settings, setSettings] = useState<JournalSettings>(journal.settings);
  const [access, setAccess] = useState<JournalAccess>(journal.access);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { api("/employees").then(j => setEmployees(j.employees || [])).catch(() => {}); }, [api]);

  const dirty = JSON.stringify({ title, description, columns, settings, access })
    !== JSON.stringify({ title: journal.title, description: journal.description, columns: journal.columns, settings: journal.settings, access: journal.access });
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const upd = (id: string, patch: Partial<JournalColumn>) => setColumns(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) => setColumns(cs => {
    const n = [...cs]; const j = i + d;
    if (j < 0 || j >= n.length) return cs;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const remove = (c: JournalColumn) => {
    if (!confirm(`Удалить колонку «${c.label}»? Уже внесённые в неё данные перестанут показываться.`)) return;
    setColumns(cs => cs.filter(x => x.id !== c.id));
    setSettings(s => ({
      ...s, doneColumnIds: s.doneColumnIds.filter(x => x !== c.id),
      deadlineColumnId: s.deadlineColumnId === c.id ? undefined : s.deadlineColumnId,
      personColumnId: s.personColumnId === c.id ? undefined : s.personColumnId,
      dateColumnId: s.dateColumnId === c.id ? undefined : s.dateColumnId,
    }));
  };
  const add = (type: JournalColumnType) => {
    const c: JournalColumn = { id: newId("c"), type, label: COLUMN_TYPE_LABEL[type] };
    if (type === "select") c.options = [];
    if (type === "checkbox") { c.yesLabel = "Да"; c.noLabel = "Нет"; }
    if (type === "qr_sign") { c.subfields = [{ id: newId("s"), type: "checkbox", label: "Подтверждаю", required: true }]; c.tokenTtlHours = 24; }
    if (type === "name_sign") { c.allowedNames = []; c.allowEmployees = true; }
    setColumns(cs => [...cs, c]);
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const j = await api(`/${journal.id}`, { method: "PUT", body: JSON.stringify({ title, description, columns, settings, access }) });
      setColumns(j.journal.columns); setSettings(j.journal.settings); setAccess(j.journal.access);
      onSaved(j.journal);
      setNotice("Сохранено"); setTimeout(() => setNotice(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const archive = async () => {
    if (!confirm(`Убрать журнал «${journal.title}» в архив? Он пропадёт из списка у всех.`)) return;
    try { await api(`/${journal.id}`, { method: "DELETE" }); onArchived(); }
    catch (e: any) { setError(e.message); }
  };

  const dates = columns.filter(c => c.type === "date");
  const people = columns.filter(c => c.type === "select" || c.type === "text");
  const memberRows = Object.entries(access.members);
  const empName = (uid: string) => employees.find(e => e.uid === uid)?.name || uid;
  const notMembers = employees.filter(e => !access.members[e.uid]);

  return (
    <div className="space-y-4 pb-24">
      <section className={`${card} p-4 grid sm:grid-cols-2 gap-3`}>
        <div><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><span className={label}>Описание</span><input className={input} value={description} onChange={e => setDescription(e.target.value)} /></div>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold text-[var(--text-main)]">Колонки</h3>
        {columns.map((c, i) => (
          <div key={c.id} className={`${card} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)]">{COLUMN_TYPE_LABEL[c.type]}</span>
              <input className={`${input} flex-1 min-w-[180px] font-semibold`} value={c.label} onChange={e => upd(c.id, { label: e.target.value })} />
              <button className={btn} onClick={() => move(i, -1)} disabled={i === 0} title="Выше"><ArrowUp className="w-4 h-4" /></button>
              <button className={btn} onClick={() => move(i, 1)} disabled={i === columns.length - 1} title="Ниже"><ArrowDown className="w-4 h-4" /></button>
              <button className={btn} onClick={() => remove(c)} title="Удалить"><Trash2 className="w-4 h-4 text-rose-600" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><span className={label}>Подсказка</span><input className={input} value={c.hint || ""} onChange={e => upd(c.id, { hint: e.target.value })} placeholder="Необязательно" /></div>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] sm:pt-5">
                <input type="checkbox" checked={!!c.managersOnly} onChange={e => upd(c.id, { managersOnly: e.target.checked })} />
                Заполняет только ответственный (например завуч)
              </label>
            </div>
            {c.type === "select" && <OptionsEditor column={c} onChange={options => upd(c.id, { options })} />}
            {c.type === "checkbox" && (
              <div className="grid grid-cols-2 gap-3">
                <div><span className={label}>Подпись «да»</span><input className={input} value={c.yesLabel || ""} onChange={e => upd(c.id, { yesLabel: e.target.value })} /></div>
                <div><span className={label}>Подпись «нет»</span><input className={input} value={c.noLabel || ""} onChange={e => upd(c.id, { noLabel: e.target.value })} /></div>
              </div>
            )}
            {c.type === "date" && (
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
                <input type="checkbox" checked={!!c.defaultToday} onChange={e => upd(c.id, { defaultToday: e.target.checked })} /> В новой записи — сегодняшняя дата
              </label>
            )}
            {c.type === "qr_sign" && <SubfieldsEditor column={c} columns={columns} onChange={patch => upd(c.id, patch)} />}
            {c.type === "name_sign" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className={label}>Разрешённые имена — по одному в строке</span>
                  <NamesEditor names={c.allowedNames || []} onChange={allowedNames => upd(c.id, { allowedNames })} />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{(c.allowedNames || []).length} имён. Порядок слов и отчество не важны, ё = е.</p>
                </div>
                <label className="flex items-start gap-2 text-sm text-[var(--text-main)] sm:pt-5">
                  <input type="checkbox" className="mt-1" checked={c.allowEmployees !== false} onChange={e => upd(c.id, { allowEmployees: e.target.checked })} />
                  Также подходят имена всех сотрудников организации
                </label>
              </div>
            )}
          </div>
        ))}
        <div className={`${card} p-4`}>
          <span className={label}>Добавить колонку</span>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(COLUMN_TYPE_LABEL) as JournalColumnType[]).map(t => (
              <button key={t} className="text-left p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition" onClick={() => add(t)}>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]"><Plus className="w-3.5 h-3.5" /> {COLUMN_TYPE_LABEL[t]}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{COLUMN_TYPE_HINT[t]}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <h3 className="font-bold text-[var(--text-main)]">Правила и статистика</h3>
        <div>
          <span className={label}>Запись закрыта, когда заполнены</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {columns.map(c => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm text-[var(--text-main)]">
                <input type="checkbox" checked={settings.doneColumnIds.includes(c.id)}
                  onChange={e => setSettings(s => ({ ...s, doneColumnIds: e.target.checked ? [...s.doneColumnIds, c.id] : s.doneColumnIds.filter(x => x !== c.id) }))} />
                {c.label}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Для отметки «да / нет» засчитывается только «да».</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <ColSelect title="Кто в записи (для статистики по людям)" value={settings.personColumnId} cols={people} onChange={v => setSettings(s => ({ ...s, personColumnId: v }))} />
          <ColSelect title="Основная дата (периоды)" value={settings.dateColumnId} cols={dates} onChange={v => setSettings(s => ({ ...s, dateColumnId: v }))} />
          <ColSelect title="Срок (после него — просрочено)" value={settings.deadlineColumnId} cols={dates} onChange={v => setSettings(s => ({ ...s, deadlineColumnId: v }))} />
        </div>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2"><Users className="w-4 h-4" /> Доступ</h3>
        <p className="text-xs text-[var(--text-muted)]">Журнал видят только сотрудники организации. Администраторы организации и создатель журнала — всегда ответственные.</p>
        <div className="max-w-sm">
          <span className={label}>Все сотрудники</span>
          <select className={input} value={access.everyone} onChange={e => setAccess(a => ({ ...a, everyone: e.target.value as JournalAccess["everyone"] }))}>
            <option value="none">Не видят журнал</option>
            {(Object.keys(ROLE_LABEL) as JournalRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div>
          <span className={label}>Поимённо</span>
          {memberRows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Никого не добавлено</p>}
          <div className="space-y-1.5">
            {memberRows.map(([uid, r]) => (
              <div key={uid} className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-[160px] text-sm text-[var(--text-main)]">{empName(uid)}</span>
                <select className={`${input} !w-auto`} value={r} onChange={e => setAccess(a => ({ ...a, members: { ...a.members, [uid]: e.target.value as JournalRole } }))}>
                  {(Object.keys(ROLE_LABEL) as JournalRole[]).map(x => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
                </select>
                <button className={btn} onClick={() => setAccess(a => { const m = { ...a.members }; delete m[uid]; return { ...a, members: m }; })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {notMembers.length > 0 && (
            <select className={`${input} mt-2 max-w-sm`} value="" onChange={e => e.target.value && setAccess(a => ({ ...a, members: { ...a.members, [e.target.value]: "edit" } }))}>
              <option value="">+ Добавить сотрудника…</option>
              {notMembers.map(e => <option key={e.uid} value={e.uid}>{e.name}{e.email && e.email !== e.name ? ` (${e.email})` : ""}</option>)}
            </select>
          )}
        </div>
      </section>

      <button className={`${btn} text-rose-600`} onClick={archive}><Archive className="w-4 h-4" /> Убрать журнал в архив</button>

      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:bottom-4 md:right-4 z-40 flex flex-col-reverse md:flex-row items-stretch md:items-center gap-2 md:gap-3">
        {error && <div className="text-sm text-rose-600 bg-[var(--bg-surface)] border border-rose-500/30 rounded-lg px-3 py-2 shadow md:max-w-md">{error}</div>}
        {notice && <div className="text-sm text-emerald-600 bg-[var(--bg-surface)] border border-emerald-500/30 rounded-lg px-3 py-2 shadow">{notice}</div>}
        {dirty && !notice && <div className="text-sm text-amber-600 bg-[var(--bg-surface)] border border-amber-500/30 rounded-lg px-3 py-2 shadow">Есть несохранённые изменения</div>}
        <button className={`${btnPrimary} shadow-lg px-5 py-3 justify-center`} onClick={save} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Сохранить настройки
        </button>
      </div>
    </div>
  );
}

/** Имена правятся как текст и разбираются на строки при выходе из поля. */
function NamesEditor({ names, onChange }: { names: string[]; onChange: (n: string[]) => void }) {
  const [text, setText] = useState(names.join("\n"));
  return (
    <textarea rows={4} className={`${input} font-mono text-xs`} value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => onChange([...new Set(text.split(/\r?\n/).map(x => x.split("\t")[0].trim()).filter(Boolean))])}
      placeholder={"Иванова Анна Сергеевна\nПетров Иван"} />
  );
}

function ColSelect({ title, value, cols, onChange }: { title: string; value?: string; cols: JournalColumn[]; onChange: (v?: string) => void }) {
  return (
    <div>
      <span className={label}>{title}</span>
      <select className={input} value={value || ""} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">— нет —</option>
        {cols.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Варианты списка: вставка из таблицы или загрузка CSV.
 *
 * Вставленное применяется сразу, без отдельной кнопки: раньше список
 * попадал в журнал только по «Применить», и после «Сохранить настройки»
 * вставленные ученики молча терялись.
 */
function OptionsEditor({ column, onChange }: { column: JournalColumn; onChange: (o: JournalColumn["options"]) => void }) {
  const [text, setText] = useState(() => optionsToTable(column.options));
  const [initial] = useState(() => column.options || []);
  const [open, setOpen] = useState(false);
  const opts = column.options || [];
  const groups = new Set(opts.map(o => o.group).filter(Boolean));
  const edit = (t: string) => { setText(t); onChange(parseOptionsTable(t)); };
  const readFile = async (f?: File) => {
    if (!f) return;
    const added = parseOptionsTable(await f.text()).filter(p => !opts.some(o => o.label.toLowerCase() === p.label.toLowerCase()));
    const next = [...opts, ...added];
    onChange(next);
    setText(optionsToTable(next));
    setOpen(true);
  };
  return (
    <div className="rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b className="text-[var(--text-main)]">{opts.length}</b><span className="text-[var(--text-muted)]">вариантов{groups.size ? ` · ${groups.size} групп` : ""}</span>
        <span className="text-[var(--text-muted)] truncate max-w-full">{opts.slice(0, 5).map(o => o.label).join(", ")}{opts.length > 5 ? "…" : ""}</span>
        <div className="flex-1" />
        <button className={btn} onClick={() => setOpen(v => !v)}>{open ? "Свернуть" : "Изменить список"}</button>
        <label className={btn}><Upload className="w-4 h-4" /> Из файла CSV<input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      {open && (
        <>
          <p className="text-[11px] text-[var(--text-muted)]">
            Скопируйте столбцы из Excel или Google Таблиц и вставьте сюда. Первый столбец — вариант, второй (необязательно) — группа, например класс ученика: по группам строится статистика. Не забудьте «Сохранить настройки».
          </p>
          <textarea rows={8} className={`${input} font-mono text-xs`} value={text} onChange={e => edit(e.target.value)}
            placeholder={"Иванов Иван\t7А\nПетрова Мария\t7А\nСидоров Пётр\t8Б"} />
          <button className={btn} onClick={() => { onChange(initial); setText(optionsToTable(initial)); }}>Вернуть как было</button>
        </>
      )}
    </div>
  );
}

/** Мини-форма, которую видит подписывающий по QR. */
function SubfieldsEditor({ column, columns, onChange }: { column: JournalColumn; columns: JournalColumn[]; onChange: (p: Partial<JournalColumn>) => void }) {
  const subs = column.subfields || [];
  const set = (id: string, p: Partial<SignSubfield>) => onChange({ subfields: subs.map(s => (s.id === id ? { ...s, ...p } : s)) });
  const matchable = columns.filter(c => c.id !== column.id && (c.type === "select" || c.type === "text"));
  return (
    <div className="rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] p-3 space-y-2">
      <div className="text-sm font-semibold text-[var(--text-main)]">Что видит человек после сканирования</div>
      {subs.map(s => (
        <div key={s.id} className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] w-full sm:w-28">{SUB_LABEL[s.type]}</span>
          <input className={`${input} flex-1 min-w-[180px]`} value={s.label} onChange={e => set(s.id, { label: e.target.value })} />
          {s.type === "text" && (
            <select className={`${input} !w-auto`} value={s.matchColumnId || ""} onChange={e => set(s.id, { matchColumnId: e.target.value || undefined })} title="Сверка с записью">
              <option value="">Без сверки</option>
              {matchable.map(c => <option key={c.id} value={c.id}>Сверять с «{c.label}»</option>)}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs text-[var(--text-main)]"><input type="checkbox" checked={s.required} onChange={e => set(s.id, { required: e.target.checked })} /> обязательно</label>
          <button className={btn} onClick={() => onChange({ subfields: subs.filter(x => x.id !== s.id) })} disabled={subs.length === 1}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SUB_LABEL) as SignSubfieldType[]).map(t => (
          <button key={t} className={btn} onClick={() => onChange({ subfields: [...subs, { id: newId("s"), type: t, label: t === "checkbox" ? "Подтверждаю" : t === "text" ? "Фамилия и имя" : "Фото", required: t !== "photo" }] })}>
            <Plus className="w-3.5 h-3.5" /> {SUB_LABEL[t]}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-[var(--text-muted)]">QR действует, ч:</span>
        <input type="number" min={1} max={336} className={`${input} !w-20`} value={column.tokenTtlHours || 24} onChange={e => onChange({ tokenTtlHours: Number(e.target.value) || 24 })} />
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">При сверке человек должен написать то же имя, что в записи: так подпись нельзя поставить за другого, просто отсканировав чужой QR.</p>
    </div>
  );
}
