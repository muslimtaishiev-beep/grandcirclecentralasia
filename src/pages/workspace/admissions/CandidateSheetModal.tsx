import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, History, Loader2, Lock, Pencil, RotateCcw, X } from "lucide-react";
import { useLive } from "../../../lib/useLive";
import { candidateOf, type Applicant, type CandidateInfo } from "../../../shared/admissions";
import { NEUTRAL_CANDIDATE_FORM, type CandidateFormConfig } from "../../../shared/candidateForm";
import { tenantLogos } from "../../../shared/legal";
import { candidateSheet, sheetDocument } from "../../../lib/admissionPrint";
import { sessionSheets, sessionsOf, type SessionForm } from "./sessionPdf";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import { confirmDialog } from "../../../components/ui";
import type { Api } from "./admissionApi";
import { candidateDoc, latestTest, saveCandidate, sheetFields, topicFeedback, type ParentForm, type SheetField, type TestSummary } from "./candidateForm";
import { SOURCE_SLOT } from "../../../shared/candidateIntake";
import HistoryModal from "./HistoryModal";

/**
 * «Анкета кандидата» в окне: сам лист, как в PDF. «Редактировать» — все
 * заполняемые части листа (поля берутся из настроек анкеты организации,
 * так что новые поля появятся здесь сами). Поля карточки правятся в
 * карточке, остальные — правкой поверх анкеты родителя; каждая правка
 * пишется в историю (кнопка «История»).
 */
type FormDoc = SessionForm;
interface Data {
  applicant: Applicant; forms: FormDoc[]; attempts: TestSummary[]; audit: any[];
  me: { admission: boolean; academic: boolean; name?: string };
  candidateForm: CandidateFormConfig | null;
  /** Ответы для «Сведений об ученике» из всех источников: родитель, ученик перед тестом, карточка. */
  sheet?: ParentForm;
}
type Draft = Omit<CandidateInfo, "by" | "at" | "decisionLabel" | "decisionFinal" | "overrides">;
type Vals = Record<string, string | string[] | null>;

const draftOf = (a: Applicant, me: Data["me"]): Draft => {
  const c = candidateOf(a);
  return {
    responsible: c?.responsible || me.name || "", conclusion: c?.conclusion || "", feedback: c?.feedback || "", feedbackGiven: !!c?.feedbackGiven,
    decision: c?.decision || null, trialFrom: c?.trialFrom || "", trialTo: c?.trialTo || "", klass: c?.klass || a.child.grade || "",
    reviewDate: c?.reviewDate || "", parentNotified: c?.parentNotified ?? null, nextContact: c?.nextContact || "",
  };
};
/** «Ответственный» в листе — это поле самой анкеты кандидата (черновик), а не правка поверх. */
const own = (f: SheetField) => f.source === "responsible";
const valsOf = (fs: SheetField[]): Vals => Object.fromEntries(fs.filter(f => !own(f)).map(f => [f.id, f.options.length ? f.options.filter(o => o.on).map(o => o.id) : f.value]));
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

export default function CandidateSheetModal({ applicantId, api, tenant, startEditing, onClose, onChanged }: {
  applicantId: string; api: Api; tenant: any; startEditing?: boolean; onClose: () => void; onChanged?: () => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!!startEditing);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "pdf">("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [vals, setVals] = useState<Vals>({});
  const [pane, setPane] = useState<"form" | "sheet">("form");
  const org = useMemo(() => ({ name: String(tenant?.name || ""), logoUrl: tenantLogos(tenant).logoUrl }), [tenant]);

  const load = useCallback(async () => {
    try { const j: Data = await api(`/applicants/${applicantId}`); setD(j); setError(null); return j; }
    catch (e: any) { setError(e.message); return null; }
  }, [api, applicantId]);
  useEffect(() => {
    void load().then(j => {
      const cfg = j?.candidateForm || NEUTRAL_CANDIDATE_FORM;
      if (j && cfg.showPhoto !== false) api(`/applicants/${applicantId}/photo`).then(p => setPhoto(p.photo || null)).catch(() => {});
    });
  }, [load, api, applicantId]);

  const cfg = d?.candidateForm || NEUTRAL_CANDIDATE_FORM;
  const parentForm: ParentForm = d?.sheet || null;
  /** Вторая страница и дальше — заполненные бланки специалистов (психолог), если они видны этому сотруднику. */
  const sessions = useMemo(() => (d ? sessionsOf(d.forms) : []), [d]);
  const test = d ? latestTest(d.attempts) : null;
  const fields = useMemo(() => (d ? sheetFields({ form: cfg, applicant: d.applicant, parentForm, test }) : []), [d, cfg, parentForm, test]);
  const canEdit = !!d?.me.admission;

  // Начать правку — с текущих значений.
  const begin = useCallback(() => { if (!d) return; setDraft(draftOf(d.applicant, d.me)); setVals(valsOf(fields)); setEditing(true); }, [d, fields]);
  useEffect(() => { if (startEditing && d && !draft) begin(); }, [startEditing, d, draft, begin]);
  const dirty = editing && !!d && !!draft && (!same(draft, draftOf(d.applicant, d.me)) || !same(vals, valsOf(fields)));
  // Чужие изменения — обновить окно, но не во время несохранённой правки.
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  useLive(tenant?.id, ["admissions"], m => { if (!dirtyRef.current && (!m || !m.id || m.id === applicantId)) void load(); });

  // Лист: в правке — из черновика, иначе — сохранённый.
  const preview = useMemo<Applicant | null>(() => {
    if (!d) return null;
    if (!editing || !draft) return d.applicant;
    const a = d.applicant; const child = { ...a.child }; const parent = { ...a.parent };
    const overrides: Record<string, string | string[]> = { ...(candidateOf(a)?.overrides || {}) };
    for (const f of fields) {
      if (own(f)) continue;
      const v = vals[f.id];
      if (f.card) {
        const [k, key] = SOURCE_SLOT[f.source];
        ((k === "child" ? child : parent) as any)[key] = String(v ?? "");
      } else if (v === null) delete overrides[f.id];
      else if (!same(v, valsOf([f])[f.id])) overrides[f.id] = v as string | string[];
    }
    const chosen = cfg.decisions.find(x => x.id === draft.decision);
    return { ...a, child, parent, decision: null, candidate: { ...draft, decisionLabel: chosen?.label || "", decisionFinal: !!chosen?.final, overrides, by: d.me.name || "", at: Date.now() } };
  }, [d, editing, draft, vals, fields, cfg]);

  const [html, setHtml] = useState("");
  useEffect(() => {
    if (!preview) return;
    let stop = false;
    const t = setTimeout(async () => {
      const sheet = await candidateSheet(org, candidateDoc({ form: cfg, orgName: org.name, applicant: preview, parentForm, test, photo }));
      const extra = d && sessions.length ? await sessionSheets(org, d.applicant, sessions, d.forms) : "";
      if (!stop) setHtml(sheetDocument(sheet + extra));
    }, 200);
    return () => { stop = true; clearTimeout(t); };
  }, [preview, org, cfg, parentForm, test, photo, d, sessions]);

  const save = async () => {
    if (!d || !draft) return;
    setBusy("save"); setError(null);
    try {
      const initial = valsOf(fields);
      const changed = Object.fromEntries(fields.filter(f => !own(f) && !same(vals[f.id], initial[f.id])).map(f => [f.id, vals[f.id]]));
      await api(`/applicants/${applicantId}/candidate`, { method: "PUT", body: JSON.stringify({ ...draft, fields: changed }) });
      await load(); setEditing(false); setDraft(null); onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };
  const pdf = async () => {
    if (!d) return;
    setBusy("pdf");
    try {
      const extra = sessions.length ? await sessionSheets(org, d.applicant, sessions, d.forms) : "";
      await saveCandidate(org, candidateDoc({ form: cfg, orgName: org.name, applicant: d.applicant, parentForm, test, photo }), d.applicant.child.name, extra);
    }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };
  const close = async () => { if (dirty && !(await confirmDialog({ title: "Закрыть без сохранения?", message: "Правки анкеты кандидата не сохранены.", confirmLabel: "Закрыть", danger: true }))) return; onClose(); };

  if (!d) return <Modal title={cfg.title} onClose={onClose} xwide>{error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}</Modal>;
  const a = d.applicant;
  return (
    <Modal title={`${cfg.title} · ${a.child.name}`} onClose={close} xwide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button className={btnPrimary} disabled={busy === "save" || !dirty} onClick={save}>{busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>
              <button className={btn} disabled={busy === "save"} onClick={async () => { if (!dirty || (await confirmDialog({ title: "Отменить правки?", confirmLabel: "Отменить", danger: true }))) { setEditing(false); setDraft(null); } }}><X className="w-4 h-4" /> Отмена</button>
              <div className="lg:hidden inline-flex rounded-lg border border-[var(--border-color)] p-0.5 text-sm">
                {(["form", "sheet"] as const).map(p => <button key={p} onClick={() => setPane(p)} className={`px-3 py-1 rounded-md ${pane === p ? "bg-[var(--accent)] text-white" : "text-[var(--text-main)]"}`}>{p === "form" ? "Форма" : "Лист"}</button>)}
              </div>
            </>
          ) : canEdit && <button className={btnPrimary} onClick={begin}><Pencil className="w-4 h-4" /> Редактировать</button>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {canEdit && <button className={btn} onClick={() => setHistory(true)}><History className="w-4 h-4" /> История</button>}
            <button className={btn} disabled={busy === "pdf"} onClick={pdf}>{busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF</button>
          </div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className={editing ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start" : ""}>
          {editing && draft && (
            <div className={pane === "sheet" ? "hidden lg:block" : ""}>
              <EditForm fields={fields} vals={vals} setVals={setVals} draft={draft} setDraft={setDraft} cfg={cfg} test={test} locked={!!candidateOf(a)?.published} />
            </div>
          )}
          <div className={editing && pane === "form" ? "hidden lg:block" : ""}>
            <Sheet html={html} />
          </div>
        </div>
      </div>
      {history && <HistoryModal api={api} applicantId={applicantId} onClose={() => setHistory(false)} />}
    </Modal>
  );
}

/** Лист A4 в окне: масштабируется под ширину, высота — по содержимому. */
function Sheet({ html }: { html: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState(1123);
  const W = 794; // 210 мм
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  // Высота — по содержимому листа (не по окну iframe).
  const measure = () => { const doc = frame.current?.contentDocument; if (doc?.body) setH(Math.max(300, Math.ceil(doc.body.getBoundingClientRect().height) + 4)); };
  return (
    <div ref={box} className="w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-white" style={{ height: html ? h * scale : 300 }}>
      {html ? (
        <iframe ref={frame} title="Анкета кандидата" srcDoc={html} sandbox="allow-same-origin" onLoad={measure}
          style={{ width: W, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block" }} />
      ) : <div className="h-full grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}
    </div>
  );
}

const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium border ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)]"}`;

function EditForm({ fields, vals, setVals, draft, setDraft, cfg, test, locked }: {
  /** Результаты опубликованы: то, что видит семья, не меняется, пока публикацию не снимут. */ locked?: boolean;
  fields: SheetField[]; vals: Vals; setVals: React.Dispatch<React.SetStateAction<Vals>>;
  draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft | null>>; cfg: CandidateFormConfig; test: TestSummary | null;
}) {
  const set = (p: Partial<Draft>) => setDraft(x => (x ? { ...x, ...p } : x));
  const setV = (id: string, v: string | string[] | null) => setVals(x => ({ ...x, [id]: v }));
  const auto = test ? topicFeedback(test.topics, cfg.topics) : "";
  const trial = !!cfg.decisions.find(x => x.id === draft.decision)?.trial;
  const h = (t: string) => <h3 className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] pt-1">{t}</h3>;
  return (
    <div className="space-y-3">
      {h("Сведения об ученике")}
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map(f => {
          if (own(f)) return (
            <div key={f.id}><span className={label}>{f.label}</span><input className={input} value={draft.responsible} onChange={e => set({ responsible: e.target.value })} /></div>
          );
          const v = vals[f.id];
          const reset = !f.card && (f.overridden || v === null) && (
            <button type="button" title="Вернуть из анкеты" aria-label="Вернуть из анкеты" className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)]" onClick={() => setV(f.id, null)}><RotateCcw className="w-3.5 h-3.5" /></button>
          );
          return (
            <div key={f.id} className={f.half || f.kind === "text" && !f.options.length && f.value.length < 40 ? "" : "sm:col-span-2"}>
              <div className="flex items-center justify-between gap-2"><span className={label}>{f.label}</span>{v !== null && reset}</div>
              {f.options.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {f.options.map(o => {
                    const picked = Array.isArray(v) ? v : f.options.filter(x => x.on).map(x => x.id);
                    const on = picked.includes(o.id);
                    return <button key={o.id} type="button" className={chip(on)} onClick={() => setV(f.id, f.kind === "multi" ? (on ? picked.filter(x => x !== o.id) : [...picked, o.id]) : (on ? [] : [o.id]))}>{o.label}</button>;
                  })}
                </div>
              ) : (
                <input className={input} type={f.kind === "date" ? "date" : "text"} value={v === null ? "" : String(v ?? "")} placeholder={v === null ? "из анкеты" : ""}
                  onChange={e => setV(f.id, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">{h("Результат")}{locked && <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Lock className="w-3.5 h-3.5" /> Опубликовано — правки закрыты</span>}</div>
      <fieldset disabled={locked} className="space-y-3 disabled:opacity-60 min-w-0">
      <div className="grid sm:grid-cols-2 gap-3">
        {!fields.some(own) && <div><span className={label}>Ответственный</span><input className={input} value={draft.responsible} onChange={e => set({ responsible: e.target.value })} /></div>}
        <div><span className={label}>Общий результат / заключение</span><input className={input} value={draft.conclusion} onChange={e => set({ conclusion: e.target.value })} placeholder={test ? test.parts.map(p => `${p.title}: ${p.value}`).join(", ") || `${test.percent ?? ""}%` : ""} /></div>
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <span className={label}>Обратная связь родителю / подробное примечание</span>
          {auto && <button type="button" className="text-xs text-[var(--accent)] hover:underline mb-1" onClick={() => set({ feedback: draft.feedback ? `${draft.feedback}\n${auto}` : auto })}>Из разбора по темам</button>}
        </div>
        <textarea rows={4} className={input} value={draft.feedback} onChange={e => set({ feedback: e.target.value })} placeholder={auto || cfg.feedbackHint} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--text-main)]"><input type="checkbox" checked={draft.feedbackGiven} onChange={e => set({ feedbackGiven: e.target.checked })} /> Обратная связь дана</label>

      {h("Решение по кандидату")}
      <div className="flex flex-wrap gap-1.5">{cfg.decisions.map(v => <button key={v.id} type="button" role="checkbox" aria-checked={draft.decision === v.id} className={chip(draft.decision === v.id)} onClick={() => set({ decision: draft.decision === v.id ? null : v.id })}>{draft.decision === v.id ? "☑" : "☐"} {v.label}</button>)}</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {trial && <>
          <div><span className={label}>Пробный период с</span><input type="date" className={input} value={draft.trialFrom} onChange={e => set({ trialFrom: e.target.value })} /></div>
          <div><span className={label}>по</span><input type="date" className={input} value={draft.trialTo} onChange={e => set({ trialTo: e.target.value })} /></div>
        </>}
        {cfg.extras.klass && <div><span className={label}>Класс</span><input className={input} value={draft.klass} onChange={e => set({ klass: e.target.value })} /></div>}
      </div>
      </fieldset>
      <div className="grid sm:grid-cols-2 gap-3">
        {cfg.extras.reviewDate && <div><span className={label}>Повторное рассмотрение</span><input type="date" className={input} value={draft.reviewDate} onChange={e => set({ reviewDate: e.target.value })} /></div>}
        {cfg.extras.parentNotified && <div>
          <span className={label}>Родитель уведомлён об условиях</span>
          <div className="flex gap-1.5">{([[true, "Да"], [false, "Нет"]] as const).map(([v, l]) => <button key={l} type="button" className={chip(draft.parentNotified === v)} onClick={() => set({ parentNotified: draft.parentNotified === v ? null : v })}>{l}</button>)}</div>
        </div>}
        {cfg.extras.nextContact && <div><span className={label}>Следующий контакт</span><input className={input} value={draft.nextContact} onChange={e => set({ nextContact: e.target.value })} /></div>}
      </div>
    </div>
  );
}
