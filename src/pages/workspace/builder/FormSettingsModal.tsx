import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { Button, InfoHint, Modal, Tabs, toast } from "../../../components/ui";
import { FORM_STATUSES, STATUS_LABEL } from "../../../shared/formStatuses";
import {
  DECISION_PALETTE, MAX_DECISIONS, NOTIFY_MIN_DELAY, NOTIFY_MODES, resolveDecisions,
  type Decision, type NotifyMode,
} from "../../../shared/formDecisions";
import ResultPageEditor from "../resultPages/ResultPageEditor";
import FormGeneralTab from "./FormGeneralTab";
import FlowEditor from "./FlowEditor";
import { resolveFlow, type FormFlow } from "../../../shared/formFlow";
import { rpApi, type PageRow } from "../resultPages/resultPagesApi";

const field = "bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]";

/** datetime-local ↔ миллисекунды (местное время). */
const toLocal = (ms?: number) => {
  if (!ms) return "";
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).getTime() : undefined);

async function saveApi(tenantId: string, formId: string, decisions: Decision[]) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch("/api/forms/decisions", {
    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenantId, formId, decisions }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(j.error || `Ошибка ${r.status}`);
  return j.decisions as Decision[];
}

const snap = (l: Decision[]) => JSON.stringify(l);

/** «Настройки формы» (шестерёнка на карточке): состояния заявки и что уходит заявителю при смене. */
export default function FormSettingsModal({ tenantId, form, subs, qrLogo, onClose }: {
  tenantId: string; form: any; subs: any[]; qrLogo?: string; onClose: () => void;
}) {
  const [tab, setTab] = useState("general");
  const [flow, setFlow] = useState<FormFlow>(() => resolveFlow(form));
  const [flowOpen, setFlowOpen] = useState(false);
  const [list, setList] = useState<Decision[]>(() => resolveDecisions(form));
  /** Настройки уведомления открываются по «Настроить» — обычно они не нужны. */
  const [openNotify, setOpenNotify] = useState<Set<string>>(() => new Set());
  const notifySummary = (d: Decision) => {
    const n = d.notify;
    if (n.mode === "auto") return `через ${n.delayMin} мин`;
    if (n.mode === "at") return n.at ? `в ${new Date(n.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "в заданное время";
    if (n.mode === "manual") return "вручную при смене";
    return "не отправлять";
  };
  const [saved, setSaved] = useState(() => snap(resolveDecisions(form)));
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [editor, setEditor] = useState<{ decisionId: string; pageId: string | null } | null>(null);

  useEffect(() => {
    emailApi(tenantId).then(j => setTemplates((j.templates || []).filter((x: any) => x.kind === "form" || x.kind === "any"))).catch(() => {});
  }, [tenantId]);
  const loadPages = () => rpApi(tenantId).then(j => setPages(j.pages || [])).catch(() => {});
  useEffect(() => { loadPages(); }, [tenantId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of subs) if (s.formId === form.id && !s.deleted) c[s.status || "new"] = (c[s.status || "new"] || 0) + 1;
    return c;
  }, [subs, form.id]);
  const dirty = snap(list) !== saved;

  const patch = (id: string, p: Partial<Decision>) => setList(l => l.map(d => (d.id === id ? { ...d, ...p } : d)));
  const patchNotify = (id: string, p: Partial<Decision["notify"]>) => setList(l => l.map(d => (d.id === id ? { ...d, notify: { ...d.notify, ...p } } : d)));
  const move = (i: number, dir: -1 | 1) => setList(l => { const n = [...l]; const j = i + dir; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = () => setList(l => [...l, {
    id: `d_${Math.random().toString(36).slice(2, 8)}`, label: "Новое состояние", color: DECISION_PALETTE[l.length % DECISION_PALETTE.length], kind: "review",
    notify: { mode: "none", delayMin: 5 },
  }]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const next = await saveApi(tenantId, form.id, list);
      setList(next); setSaved(snap(next));
      toast.success("Сохранено");
      return true;
    } catch (e: any) { toast.error(e.message); return false; }
    finally { setSaving(false); }
  };

  const openEditor = async (d: Decision) => {
    // Страница хранит варианты по id состояний, поэтому состояния должны быть на сервере.
    if (dirty && !(await save())) return;
    setEditor({ decisionId: d.id, pageId: d.notify.pageId || null });
  };

  const pageName = (id?: string) => pages.find(p => p.id === id)?.name || "Страница выбрана";

  return (
    <>
      <Modal title={`Настройки формы · ${form.title || ""}`} onClose={onClose} wide>
        <div className="space-y-4">
          <Tabs tabs={[{ id: "general", label: "Общее" }, { id: "decisions", label: "Решения" }, { id: "flow", label: "Этапы" }]} value={tab} onChange={setTab} />
          <div className={tab === "general" ? "" : "hidden"}>
            <FormGeneralTab tenantId={tenantId} form={form} qrLogo={qrLogo} onClose={onClose} />
          </div>
          <div className={`space-y-3 ${tab === "flow" ? "" : "hidden"}`}>
            {flow.steps.length > 0 && (
              <ul className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] divide-y divide-[var(--border-color)]">
                {flow.steps.map(s => <li key={s.id} className="px-3 py-2 text-sm truncate">{s.title}</li>)}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--text-muted)]">Этапов: {flow.steps.length}</span>
              <Button variant="primary" onClick={() => setFlowOpen(true)}>Открыть конструктор</Button>
            </div>
          </div>
          <div className={`space-y-3 ${tab === "decisions" ? "" : "hidden"}`}>
            {list.map((d, i) => {
              const used = counts[d.id] || 0;
              const system = (FORM_STATUSES as readonly string[]).includes(d.id);
              const lockDelete = d.id === "new" || used > 0;
              return (
                <div key={d.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="color" value={d.color} onChange={e => patch(d.id, { color: e.target.value })} aria-label="Цвет"
                      className="w-8 h-8 rounded-lg border border-[var(--border-color)] bg-transparent p-0.5 cursor-pointer" />
                    <input value={d.label} maxLength={40} onChange={e => patch(d.id, { label: e.target.value })} aria-label="Название" className={`${field} flex-1 min-w-[140px] font-semibold`} />
                    <select value={d.kind} disabled={system} onChange={e => patch(d.id, { kind: e.target.value as Decision["kind"] })} aria-label="Тип" className={field}>
                      {FORM_STATUSES.map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                    </select>
                    <InfoHint>Тип определяет поведение: билет и сканер работают у «Одобрено», «Оплачено», «Гость пришёл»; по типам считается статистика.</InfoHint>
                    {used > 0 && <span className="text-xs text-[var(--text-muted)] tabular-nums">{used}</span>}
                    <div className="ml-auto flex items-center">
                      <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" aria-label="Ниже" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" aria-label="Удалить" disabled={lockDelete} title={used > 0 ? `В состоянии заявок: ${used}` : d.id === "new" ? "Начальное состояние" : "Удалить"}
                        onClick={() => setList(l => l.filter(x => x.id !== d.id))} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-red-500 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {!openNotify.has(d.id) ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-2 text-sm">
                      <span className="text-[var(--text-muted)]">Уведомление: {notifySummary(d)}{d.notify.pageId ? ` · страница: ${pageName(d.notify.pageId)}` : ""}</span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpenNotify(o => new Set(o).add(d.id))}>Настроить</Button>
                    </div>
                  ) : (
                  <div className="space-y-2 border-t border-[var(--border-color)] pt-3">
                    <div className="flex items-center"><div className="text-xs font-semibold text-[var(--text-muted)]">Уведомление</div>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpenNotify(o => { const n = new Set(o); n.delete(d.id); return n; })}>Свернуть</Button></div>
                    <div className="flex flex-wrap gap-1.5">
                      {NOTIFY_MODES.map(m => (
                        <button key={m.id} type="button" onClick={() => patchNotify(d.id, { mode: m.id as NotifyMode })}
                          className={`px-3 py-1.5 rounded-lg text-xs border ${d.notify.mode === m.id ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"}`}>{m.label}</button>
                      ))}
                    </div>
                    {d.notify.mode === "auto" && (
                      <label className="flex items-center gap-2 text-sm">
                        <span>Через</span>
                        <input type="number" min={NOTIFY_MIN_DELAY} step={1} value={d.notify.delayMin}
                          onChange={e => patchNotify(d.id, { delayMin: Math.floor(Number(e.target.value)) || NOTIFY_MIN_DELAY })}
                          onBlur={() => d.notify.delayMin < NOTIFY_MIN_DELAY && patchNotify(d.id, { delayMin: NOTIFY_MIN_DELAY })}
                          className={`${field} w-20`} />
                        <span>мин (от {NOTIFY_MIN_DELAY})</span>
                      </label>
                    )}
                    {d.notify.mode === "at" && (
                      <input type="datetime-local" value={toLocal(d.notify.at)} onChange={e => patchNotify(d.id, { at: fromLocal(e.target.value) })} className={field} aria-label="Когда отправить" />
                    )}
                    {d.notify.mode !== "none" && (
                      <label className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Письмо</span>
                        <select value={d.notify.emailTemplateId || ""} onChange={e => patchNotify(d.id, { emailTemplateId: e.target.value || undefined })} className={`${field} max-w-full`}>
                          <option value="">Стандартное</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Страница отслеживания</span>
                      {d.notify.pageId && <span className="text-[var(--text-muted)]">{pageName(d.notify.pageId)}</span>}
                      <Button size="sm" variant="secondary" onClick={() => void openEditor(d)}>{d.notify.pageId ? "Открыть редактор" : "Выбрать или создать"}</Button>
                      {d.notify.pageId && <Button size="sm" variant="ghost" onClick={() => patchNotify(d.id, { pageId: undefined })}>Убрать</Button>}
                    </div>
                  </div>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} disabled={list.length >= MAX_DECISIONS} onClick={add}>Добавить состояние</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>Закрыть</Button>
                <Button variant="primary" loading={saving} disabled={!dirty || list.some(d => !d.label.trim())} onClick={() => void save()}>Сохранить</Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      {flowOpen && <FlowEditor tenantId={tenantId} form={{ ...form, flow }} onClose={() => setFlowOpen(false)} onSaved={setFlow} />}
      {editor && (
        <ResultPageEditor tenantId={tenantId} pageId={editor.pageId} pageKind="form"
          outcomes={list.map(d => ({ id: d.id, label: d.label }))}
          onClose={() => setEditor(null)}
          onBound={(pid, name) => {
            // Привязка сразу и в базу: страница уже сохранена, состояние — тоже.
            setPages(p => (p.some(x => x.id === pid) ? p.map(x => (x.id === pid ? { ...x, name } : x)) : [...p, { id: pid, name, updatedAt: Date.now(), outcomes: [] }]));
            setList(l => l.map(d => (d.id === editor.decisionId ? { ...d, notify: { ...d.notify, pageId: pid } } : d)));
            setEditor(e => (e ? { ...e, pageId: pid } : e));
            loadPages();
          }} />
      )}
    </>
  );
}
