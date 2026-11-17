import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PERMISSIONS, type PermissionKey } from "../../../shared/permissions";
import { SCALES, type QItem, type QKind, type QNorm, type QSection, type QTemplate } from "../../../shared/questionnaires";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import type { Api } from "./admissionApi";
import { CandidateFormCard } from "./CandidateFormEditor";

/**
 * Анкеты приёма — конструктор. Кто заполняет и кто видит целиком — права
 * в самом шаблоне: этап «до теста» можно отдать любой должности.
 */
const KIND_LABEL: Record<QKind, string> = { text: "Строка", longtext: "Текст", date: "Дата", number: "Число", phone: "Телефон", choice: "Один вариант", multi: "Несколько вариантов", rating: "Оценка по шкале", note: "Пояснение" };
const fmtGrades = (g?: number[]) => {
  if (!g?.length) return "";
  const out: string[] = []; let s = g[0], p = g[0];
  for (const x of [...g.slice(1), NaN]) { if (x === p + 1) { p = x; continue; } out.push(s === p ? `${s}` : `${s}–${p}`); s = p = x; }
  return out.join(", ");
};
const parseGrades = (v: string) => [...new Set(v.split(/[,;\s]+/).flatMap(part => { const m = part.match(/^(\d{1,2})(?:[-–](\d{1,2}))?$/); if (!m) return []; const a = Number(m[1]), b = Number(m[2] ?? m[1]); return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i); }))].filter(n => n <= 12).sort((a, b) => a - b);
const permLabel = (k: PermissionKey | null) => (k ? PERMISSIONS.find(p => p.key === k)?.label || k : "—");

export default function TemplatesTab({ api }: { api: Api }) {
  const [list, setList] = useState<QTemplate[] | null>(null);
  const [canEdit, setCanEdit] = useState<Record<string, boolean>>({});
  const [canCreate, setCanCreate] = useState(false);
  const [editing, setEditing] = useState<QTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const j = await api("/templates"); setList(j.templates); setCanEdit(j.canEdit); setCanCreate(j.canCreate); } catch (e: any) { setError(e.message); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!list) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  const blank = (audience: "staff" | "parent"): QTemplate => ({ id: "", title: audience === "parent" ? "Анкета для родителей" : "Новая анкета", description: "", audience, fillPermission: audience === "staff" ? "psych:conduct" : null, viewPermission: "psych:view", sensitive: true, sections: [{ id: "s1", title: "Блок 1", items: [{ id: "i1", kind: "rating", label: "Показатель", scale: "norm4", comment: true }] }], outcome: audience === "staff" ? { label: "Заключение", options: [{ id: "ok", label: "Рекомендован", description: "", allowsTest: true, tone: "good" }, { id: "no", label: "Не рекомендован", description: "", allowsTest: false, tone: "bad" }] } : null, attachments: [], version: 0 });
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        {list.map(t => (
          <div key={t.id} className={`${card} p-4 space-y-2`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[var(--text-main)]">{t.title}</div>
                <div className="text-xs text-[var(--text-muted)]">{t.audience === "parent" ? "Заполняет родитель по ссылке" : `Заполняет: ${permLabel(t.fillPermission)}`} · Видит целиком: {permLabel(t.viewPermission)} · версия {t.version}</div>
              </div>
              {canEdit[t.id] && <button className={btn} onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /> Изменить</button>}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{t.sections.length} блоков · {t.sections.reduce((n, s) => n + s.items.length, 0)} пунктов{t.outcome ? ` · итог: ${t.outcome.options.map(o => o.label).join(" / ")}` : ""}{t.attachments.length ? ` · материалов: ${t.attachments.length}` : ""}</div>
          </div>
        ))}
        <CandidateFormCard api={api} parent={list.find(t => t.audience === "parent")} />
      </div>
      {!list.length && <p className="text-sm text-[var(--text-muted)]">Анкет пока нет.</p>}
      {canCreate && (
        <div className="flex gap-2">
          <button className={btn} onClick={() => setEditing(blank("staff"))}><Plus className="w-4 h-4" /> Анкета сотрудника</button>
          {!list.some(t => t.audience === "parent") && <button className={btn} onClick={() => setEditing(blank("parent"))}><Plus className="w-4 h-4" /> Анкета родителя</button>}
        </div>
      )}
      {editing && <Editor t={editing} api={api} parent={list.find(t => t.audience === "parent")} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function Editor({ t: initial, api, parent, onClose, onSaved }: { t: QTemplate; api: Api; parent?: QTemplate; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = useState<QTemplate>(() => JSON.parse(JSON.stringify(initial)));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSec = (k: number, p: Partial<QSection>) => setT({ ...t, sections: t.sections.map((s, j) => (j === k ? { ...s, ...p } : s)) });
  const setItem = (k: number, n: number, p: Partial<QItem>) => setSec(k, { items: t.sections[k].items.map((i, j) => (j === n ? { ...i, ...p } : i)) });
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return arr; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (t.id) await api(`/templates/${t.id}`, { method: "PUT", body: JSON.stringify(t) });
      else await api("/templates", { method: "POST", body: JSON.stringify(t) });
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  const staffPerms = PERMISSIONS.filter(p => !["chat:use", "tasks:use", "docs:use", "sheets:use", "tickets:check"].includes(p.key));
  return (
    <Modal title={t.id ? `Анкета: ${initial.title}` : "Новая анкета"} onClose={onClose} xwide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><span className={label}>Название</span><input className={input} value={t.title} onChange={e => setT({ ...t, title: e.target.value })} /></div>
          <div className="sm:col-span-2"><span className={label}>Пояснение (видно заполняющему)</span><textarea rows={2} className={input} value={t.description} onChange={e => setT({ ...t, description: e.target.value })} /></div>
          {t.audience === "staff" && <div><span className={label}>Кто заполняет</span><select className={input} value={t.fillPermission || ""} onChange={e => setT({ ...t, fillPermission: (e.target.value || null) as PermissionKey | null })}>{staffPerms.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>}
          <div><span className={label}>Кто ещё видит целиком</span><select className={input} value={t.viewPermission || ""} onChange={e => setT({ ...t, viewPermission: (e.target.value || null) as PermissionKey | null })}><option value="">Никто, кроме заполняющих</option>{staffPerms.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.sensitive} onChange={e => setT({ ...t, sensitive: e.target.checked })} /> Данные о здоровье и развитии — остальным только итог</label>
          {t.audience === "parent" && <div className="sm:col-span-2"><span className={label}>Текст согласия</span><textarea rows={2} className={input} value={t.consentText || ""} onChange={e => setT({ ...t, consentText: e.target.value })} /></div>}
        </div>

        {t.sections.map((s, k) => (
          <div key={s.id} className="rounded-xl border border-[var(--border-color)] p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <input className={`${input} flex-1 min-w-[200px] font-semibold`} value={s.title} onChange={e => setSec(k, { title: e.target.value })} />
              <input className={`${input} !w-32`} placeholder="Классы: все" value={fmtGrades(s.grades)} onChange={e => setSec(k, { grades: parseGrades(e.target.value) })} title="Например 2–11 или 1, 3, 5" />
              <button className={btn} onClick={() => setT({ ...t, sections: move(t.sections, k, -1) })}><ChevronUp className="w-4 h-4" /></button>
              <button className={btn} onClick={() => setT({ ...t, sections: move(t.sections, k, 1) })}><ChevronDown className="w-4 h-4" /></button>
              <button className={btn} onClick={() => confirm("Удалить блок?") && setT({ ...t, sections: t.sections.filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4 text-rose-600" /></button>
            </div>
            {s.items.map((i, n) => {
              const key = `${s.id}/${i.id}`;
              return (
                <div key={i.id} className="rounded-lg border border-[var(--border-color)]">
                  <button type="button" className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen(open === key ? null : key)}>
                    <span className="flex-1 truncate text-[var(--text-main)]">{i.label}</span>
                    <span className="text-xs text-[var(--text-muted)]">{KIND_LABEL[i.kind]}{i.grades?.length ? ` · ${fmtGrades(i.grades)} кл.` : ""}{i.norms?.length ? " · нормы" : ""}</span>
                    <ChevronDown className={`w-4 h-4 transition ${open === key ? "rotate-180" : ""}`} />
                  </button>
                  {open === key && <ItemEditor i={i} t={t} parent={parent} set={p => setItem(k, n, p)}
                    onMove={d => setSec(k, { items: move(s.items, n, d) })} onDelete={() => setSec(k, { items: s.items.filter((_, j) => j !== n) })} />}
                </div>
              );
            })}
            <button className={btn} onClick={() => { const id = uid("i"); setSec(k, { items: [...s.items, { id, kind: t.audience === "staff" ? "rating" : "text", label: "Новый пункт", ...(t.audience === "staff" ? { scale: "norm4" as const, comment: true } : {}) }] }); setOpen(`${s.id}/${id}`); }}><Plus className="w-4 h-4" /> Пункт</button>
          </div>
        ))}
        <button className={btn} onClick={() => setT({ ...t, sections: [...t.sections, { id: uid("s"), title: `Блок ${t.sections.length + 1}`, items: [{ id: uid("i"), kind: "text", label: "Новый пункт" }] }] })}><Plus className="w-4 h-4" /> Блок</button>

        {t.audience === "staff" && (
          <div className="rounded-xl border border-[var(--border-color)] p-3 space-y-2">
            <input className={`${input} font-semibold`} value={t.outcome?.label || "Заключение"} onChange={e => setT({ ...t, outcome: { label: e.target.value, options: t.outcome?.options || [] } })} />
            {(t.outcome?.options || []).map((o, k) => (
              <div key={o.id} className="grid sm:grid-cols-[1fr_1.4fr_auto_auto_auto] gap-1.5 items-center">
                <input className={input} value={o.label} onChange={e => setT({ ...t, outcome: { ...t.outcome!, options: t.outcome!.options.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) } })} />
                <input className={input} placeholder="Пояснение" value={o.description} onChange={e => setT({ ...t, outcome: { ...t.outcome!, options: t.outcome!.options.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)) } })} />
                <select className={`${input} !w-auto`} value={o.tone} onChange={e => setT({ ...t, outcome: { ...t.outcome!, options: t.outcome!.options.map((x, j) => (j === k ? { ...x, tone: e.target.value as any } : x)) } })}><option value="good">зелёный</option><option value="warn">жёлтый</option><option value="bad">красный</option></select>
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap"><input type="checkbox" checked={o.allowsTest} onChange={e => setT({ ...t, outcome: { ...t.outcome!, options: t.outcome!.options.map((x, j) => (j === k ? { ...x, allowsTest: e.target.checked } : x)) } })} /> пускает к тесту</label>
                <button className={btn} onClick={() => setT({ ...t, outcome: { ...t.outcome!, options: t.outcome!.options.filter((_, j) => j !== k) } })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button className={btn} onClick={() => setT({ ...t, outcome: { label: t.outcome?.label || "Заключение", options: [...(t.outcome?.options || []), { id: uid("r"), label: "Итог", description: "", allowsTest: false, tone: "warn" }] } })}><Plus className="w-4 h-4" /> Вариант итога</button>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border-color)] p-3 space-y-2">
          <div className="font-semibold text-sm">Материалы</div>
          {t.attachments.map((m, k) => (
            <div key={m.id} className="grid sm:grid-cols-[1fr_1.4fr_auto_7rem_auto] gap-1.5 items-center">
              <input className={input} value={m.name} onChange={e => setT({ ...t, attachments: t.attachments.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
              <input className={input} placeholder="Ссылка на картинку или PDF" value={m.url} onChange={e => setT({ ...t, attachments: t.attachments.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })} />
              <select className={`${input} !w-auto`} value={m.kind} onChange={e => setT({ ...t, attachments: t.attachments.map((x, j) => (j === k ? { ...x, kind: e.target.value as any } : x)) })}><option value="show">показать ребёнку</option><option value="sheet">лист ребёнку (с QR)</option></select>
              <input className={input} placeholder="Классы" value={fmtGrades(m.grades)} onChange={e => setT({ ...t, attachments: t.attachments.map((x, j) => (j === k ? { ...x, grades: parseGrades(e.target.value) } : x)) })} />
              <button className={btn} onClick={() => setT({ ...t, attachments: t.attachments.filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button className={btn} onClick={() => setT({ ...t, attachments: [...t.attachments, { id: uid("a"), name: "Материал", url: "https://", kind: "show" }] })}><Plus className="w-4 h-4" /> Материал</button>
        </div>

        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="sticky bottom-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !t.title.trim()} onClick={save}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}

function ItemEditor({ i, t, parent, set, onMove, onDelete }: { i: QItem; t: QTemplate; parent?: QTemplate; set: (p: Partial<QItem>) => void; onMove: (d: number) => void; onDelete: () => void }) {
  const lines = (v: string) => v.split("\n").map(x => x.trim()).filter(Boolean);
  const measures = i.measures || [];
  return (
    <div className="border-t border-[var(--border-color)] p-3 space-y-2.5">
      <div className="grid sm:grid-cols-[1fr_auto_8rem] gap-2">
        <input className={input} value={i.label} onChange={e => set({ label: e.target.value })} />
        <select className={`${input} !w-auto`} value={i.kind} onChange={e => set({ kind: e.target.value as QKind, ...(e.target.value === "rating" ? { scale: i.scale || "norm4" } : {}) })}>{(Object.keys(KIND_LABEL) as QKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        <input className={input} placeholder="Классы: все" value={fmtGrades(i.grades)} onChange={e => set({ grades: parseGrades(e.target.value) })} />
      </div>
      <input className={input} placeholder="Подсказка" value={i.hint || ""} onChange={e => set({ hint: e.target.value })} />
      <div className="flex flex-wrap gap-3 text-sm">
        {i.kind !== "rating" && i.kind !== "note" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!i.required} onChange={e => set({ required: e.target.checked })} /> обязательный</label>}
        {i.kind !== "note" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={i.kind === "rating" ? i.comment !== false : !!i.comment} onChange={e => set({ comment: e.target.checked })} /> поле для комментария</label>}
        {i.kind === "rating" && <select className={`${input} !w-auto`} value={i.scale || "norm4"} onChange={e => set({ scale: e.target.value as any })}>{(Object.keys(SCALES) as (keyof typeof SCALES)[]).map(k => <option key={k} value={k}>{SCALES[k].map(x => x.short).join(" / ")}</option>)}</select>}
      </div>
      {t.audience === "parent" && ["text", "date", "phone"].includes(i.kind) && (
        <div className="flex items-center gap-2 text-sm"><span className="text-[var(--text-muted)]">Заполняет поле карточки:</span>
          <select className={`${input} !w-auto`} value={i.bind || ""} onChange={e => set({ bind: (e.target.value || undefined) as QItem["bind"] })}>
            <option value="">—</option>
            <option value="child.name">ФИО ребёнка</option>
            <option value="child.birthDate">Дата рождения</option>
            <option value="child.school">Школа, из которой переходит</option>
            <option value="parent.name">ФИО родителя</option>
            <option value="parent.phone">Телефон родителя</option>
          </select>
        </div>
      )}
      {(i.kind === "choice" || i.kind === "multi") && (
        <div><span className={label}>Варианты (каждый с новой строки)</span>
          <textarea rows={3} className={input} value={(i.options || []).map(o => o.label).join("\n")} onChange={e => set({ options: lines(e.target.value).map((l, k) => ({ id: i.options?.[k]?.id || `o${k + 1}`, label: l })) })} /></div>
      )}
      {t.audience === "staff" && (
        <div className="space-y-1.5">
          <span className={label}>Вопросы методики по классам</span>
          {(i.prompts || []).map((p, k) => (
            <div key={k} className="flex gap-1.5">
              <input className={`${input} !w-24`} placeholder="Все классы" value={fmtGrades(p.grades)} onChange={e => set({ prompts: (i.prompts || []).map((x, j) => (j === k ? { ...x, grades: parseGrades(e.target.value) } : x)) })} />
              <textarea rows={2} className={`${input} flex-1`} value={p.text} onChange={e => set({ prompts: (i.prompts || []).map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })} />
              <button className={btn} onClick={() => set({ prompts: (i.prompts || []).filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button className={btn} onClick={() => set({ prompts: [...(i.prompts || []), { grades: [], text: "" }] })}><Plus className="w-4 h-4" /> Вопросы</button>
        </div>
      )}
      {i.kind === "rating" && (
        <div className="space-y-1.5">
          <span className={label}>Цифры, которые вносит специалист</span>
          <div className="flex flex-wrap gap-1.5">
            {measures.map((m, k) => (
              <span key={m.id} className="inline-flex items-center gap-1">
                <input className={`${input} !w-40`} value={m.label} onChange={e => set({ measures: measures.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} />
                <button className="text-rose-600 text-xs" onClick={() => set({ measures: measures.filter((_, j) => j !== k), norms: (i.norms || []).filter(n => !JSON.stringify(n.metric).includes(`"${m.id}"`)) })}>×</button>
              </span>
            ))}
            <button className={btn} onClick={() => set({ measures: [...measures, { id: `m${Date.now().toString(36)}`, label: "Значение" }] })}><Plus className="w-4 h-4" /> Цифра</button>
          </div>
          {measures.length > 0 && (
            <>
              <span className={label}>Нормы по классам — подсказка оценки</span>
              {(i.norms || []).map((n, k) => {
                const upd = (p: Partial<QNorm>) => set({ norms: (i.norms || []).map((x, j) => (j === k ? { ...x, ...p } : x)) });
                const metricKey = "measure" in n.metric ? n.metric.measure : "sum" in n.metric ? `sum:${n.metric.sum.join("+")}` : `ratio:${n.metric.ratio.join("/")}`;
                return (
                  <div key={k} className="flex flex-wrap gap-1.5 items-center text-sm">
                    <input className={`${input} !w-24`} placeholder="Классы" value={fmtGrades(n.grades)} onChange={e => upd({ grades: parseGrades(e.target.value) })} />
                    <select className={`${input} !w-auto`} value={metricKey} onChange={e => { const v = e.target.value; upd({ metric: v.startsWith("sum:") ? { sum: v.slice(4).split("+") } : v.startsWith("ratio:") ? { ratio: v.slice(6).split("/") as [string, string] } : { measure: v } }); }}>
                      {measures.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      {measures.length > 1 && <option value={`sum:${measures.map(m => m.id).join("+")}`}>сумма всех</option>}
                      {measures.length > 1 && <option value={`ratio:${measures[0].id}/${measures[1].id}`}>{measures[0].label} / {measures[1].label}, %</option>}
                    </select>
                    <select className={`${input} !w-auto`} value={n.better} onChange={e => upd({ better: e.target.value as any })}><option value="higher">больше — лучше</option><option value="lower">меньше — лучше</option></select>
                    норма <input type="number" className={`${input} !w-20`} value={n.norm} onChange={e => upd({ norm: Number(e.target.value) })} />
                    трудности с <input type="number" className={`${input} !w-20`} value={n.mild} onChange={e => upd({ mild: Number(e.target.value) })} />
                    <input className={`${input} !w-36`} placeholder="Подпись (норма 8–10)" value={n.label || ""} onChange={e => upd({ label: e.target.value })} />
                    <button className={btn} onClick={() => set({ norms: (i.norms || []).filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
              <button className={btn} onClick={() => set({ norms: [...(i.norms || []), { grades: [], metric: { measure: measures[0].id }, better: "higher", norm: 0, mild: 0 }] })}><Plus className="w-4 h-4" /> Норма</button>
            </>
          )}
        </div>
      )}
      {t.audience === "staff" && parent && i.kind !== "rating" && (
        <div><span className={label}>Показать рядом ответы родителя</span>
          <div className="flex flex-wrap gap-1.5">{parent.sections.flatMap(s => s.items).map(p => {
            const on = (i.showParent || []).includes(p.id);
            return <button key={p.id} type="button" onClick={() => set({ showParent: on ? (i.showParent || []).filter(x => x !== p.id) : [...(i.showParent || []), p.id] })} className={`px-2 py-1 rounded-full text-xs border ${on ? "bg-violet-600 border-violet-600 text-white" : "border-[var(--border-color)]"}`}>{p.label}</button>;
          })}</div></div>
      )}
      {t.attachments.length > 0 && (
        <div><span className={label}>Материалы к пункту</span>
          <div className="flex flex-wrap gap-1.5">{t.attachments.map(m => {
            const on = (i.materials || []).includes(m.id);
            return <button key={m.id} type="button" onClick={() => set({ materials: on ? (i.materials || []).filter(x => x !== m.id) : [...(i.materials || []), m.id] })} className={`px-2 py-1 rounded-full text-xs border ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)]"}`}>{m.name}</button>;
          })}</div></div>
      )}
      <div className="flex gap-1.5 justify-end">
        <button className={btn} onClick={() => onMove(-1)}><ChevronUp className="w-4 h-4" /></button>
        <button className={btn} onClick={() => onMove(1)}><ChevronDown className="w-4 h-4" /></button>
        <button className={`${btn} text-rose-600`} onClick={() => confirm("Удалить пункт?") && onDelete()}><Trash2 className="w-4 h-4" /> Удалить</button>
      </div>
    </div>
  );
}
