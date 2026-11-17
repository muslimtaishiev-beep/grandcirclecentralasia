import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Download, Loader2, Plus, QrCode, Search, UserPlus } from "lucide-react";
import { STAGE_LABEL, type Stage } from "../../../shared/admissions";
import { gradeOf } from "../../../shared/questionnaires";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import { TONE, useAdmissionApi, type Me, type Row } from "./admissionApi";
import ApplicantCard from "./ApplicantCard";
import QrScanModal from "./QrScanModal";
import TemplatesTab from "./TemplatesTab";

/**
 * «Поступающие»: список с поиском по ФИО и №, фильтры по классу и этапу,
 * новая карточка, сканер QR. Карточка открывается поверх (?open=<id>&tab=),
 * так на неё ведут QR и ссылки из экзаменов.
 */
const no = (n: number) => String(n).padStart(4, "0");

export default function AdmissionsPage({ embedded }: { embedded?: boolean } = {}) {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const api = useAdmissionApi(tenantId);
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<Me>({ admission: false, psych: false, psychView: false, academic: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [stage, setStage] = useState<"" | Stage>("");
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState(false);
  const tab = params.get("view") === "templates" ? "templates" : "list";
  const open = params.get("open");

  const load = useCallback(async () => {
    if (!tenantId) return;
    try { const j = await api("/applicants"); setRows(j.applicants); setMe(j.me); setError(null); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, tenantId]);
  useEffect(() => { void load(); }, [load]);

  const grades = useMemo(() => [...new Set(rows.map(r => gradeOf(r.child.grade)).filter((g): g is number => g !== null))].sort((a, b) => a - b), [rows]);
  const visible = rows.filter(r => {
    const t = q.trim().toLowerCase();
    if (t && !(`${r.child.name} ${r.parent.name} ${r.parent.phone}`.toLowerCase().includes(t) || no(r.refNo).includes(t.replace(/\D/g, "") || "—"))) return false;
    if (grade && String(gradeOf(r.child.grade)) !== grade) return false;
    if (stage && r.stage !== stage) return false;
    return true;
  });
  const openCard = (id: string | null, tabKey?: string) => {
    const p = new URLSearchParams(params);
    if (id) { p.set("open", id); if (tabKey) p.set("ctab", tabKey); else p.delete("ctab"); } else { p.delete("open"); p.delete("ctab"); p.delete("s"); }
    setParams(p, { replace: true });
  };
  /** Ввели номер целиком — сразу в карточку. */
  const findNo = async (raw = q) => {
    const n = raw.replace(/\D/g, "");
    if (!n) return;
    const hit = rows.find(r => r.refNo === Number(n));
    if (hit) return openCard(hit.id);
    try { const j = await api(`/by-no/${n}`); openCard(j.id); } catch (e: any) { alert(e.message); }
  };
  const excel = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Поступающие");
    ws.addRow(["№", "ФИО ребёнка", "Класс", "Дата рождения", "Родитель", "Телефон", "Анкета родителя", "Психолог", ...(me.academic ? ["Тест", "Результат", "Решение"] : []), "Этап"]);
    for (const r of visible) ws.addRow([no(r.refNo), r.child.name, r.child.grade, r.child.birthDate, r.parent.name, r.parent.phone, r.parentForm.status === "done" ? "да" : "",
      Object.values(r.stages).map(s => `${s.title}: ${s.status === "done" ? s.outcomeLabel : "идёт"}`).join("; "),
      ...(me.academic ? [r.attempt?.examTitle || r.referral?.examTitle || (r.paperResults ? "на бумаге" : ""), r.attempt?.parts.map(p => `${p.title}: ${p.value}`).join("; ") || (r.attempt?.percent != null ? `${r.attempt.percent}%` : ""),
        r.decision || attemptDecision(r)] : []), STAGE_LABEL[r.stage]]);
    ws.getRow(1).font = { bold: true }; ws.columns.forEach(c => { c.width = 18; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf])); a.download = `Поступающие ${new Date().toLocaleDateString("ru-RU")}.xlsx`; a.click();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          {!embedded && <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Поступающие</h1>}
        </div>
        <form className="flex" onSubmit={e => { e.preventDefault(); const n = (e.currentTarget.elements.namedItem("no") as HTMLInputElement).value; if (n.trim()) void findNo(n); }}>
          <input name="no" inputMode="numeric" className={`${input} !w-28 rounded-r-none`} placeholder="№ 0001" />
          <button className={`${btn} rounded-l-none border-l-0`} type="submit"><Search className="w-4 h-4" /> Найти</button>
        </form>
        <button className={btn} onClick={() => setScan(true)}><QrCode className="w-4 h-4" /> Сканер</button>
        {(me.admission || me.psych) && <button className={btnPrimary} onClick={() => setCreating(true)}><UserPlus className="w-4 h-4" /> Поступающий</button>}
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {([["list", "Поступающие"], ["templates", "Анкеты"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { const p = new URLSearchParams(params); if (k === "templates") p.set("view", k); else p.delete("view"); setParams(p, { replace: true }); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
        ))}
      </div>

      {tab === "templates" ? <TemplatesTab api={api} /> : (
        <>
          <div className={`${card} p-3 flex flex-wrap gap-2 items-center`}>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} pl-9`} placeholder="ФИО, телефон или № поступающего" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && /^\D*\d+\D*$/.test(q)) void findNo(); }} />
            </div>
            {grades.length > 0 && (
              <select className={`${input} !w-auto`} value={grade} onChange={e => setGrade(e.target.value)}>
                <option value="">Все классы</option>{grades.map(g => <option key={g} value={g}>{g} класс</option>)}
              </select>
            )}
            <select className={`${input} !w-auto`} value={stage} onChange={e => setStage(e.target.value as any)}>
              <option value="">Все этапы</option>{(Object.keys(STAGE_LABEL) as Stage[]).filter(s => me.academic || !ACADEMIC_STAGES.has(s)).map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
            <button className={btn} onClick={excel} disabled={!visible.length}><Download className="w-4 h-4" /> Excel</button>
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div> : !rows.length ? (
            <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>Пока никого. {(me.admission || me.psych) && <button className="text-[var(--accent)] hover:underline" onClick={() => setCreating(true)}>Завести первого поступающего</button>}</div>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[860px]">
                <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)] bg-[var(--bg-panel)]">
                  <tr>{["№", "Ребёнок", "Класс", "Анкета род.", "Психолог", ...(me.academic ? ["Тест", "Решение"] : []), "Этап"].map(h => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={() => openCard(r.id)}>
                      <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{no(r.refNo)}</td>
                      <td className="px-3 py-2"><div className="font-medium text-[var(--text-main)]">{r.child.name}</div><div className="text-[11px] text-[var(--text-muted)]">{r.parent.name}{r.parent.phone ? ` · ${r.parent.phone}` : ""}</div></td>
                      <td className="px-3 py-2">{r.child.grade}</td>
                      <td className="px-3 py-2">{r.parentForm.status === "done" ? <span className="text-emerald-700">✓</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className="px-3 py-2">{Object.values(r.stages).map(s => <span key={s.templateId} className={`inline-block mr-1 mb-0.5 px-2 py-0.5 rounded text-[11px] font-medium ${s.status === "done" && s.tone ? TONE[s.tone] : "text-[var(--text-muted)] bg-[var(--bg-surface-hover)]"}`}>{s.status === "done" ? s.outcomeLabel : "идёт"}</span>)}{!Object.keys(r.stages).length && <span className="text-[var(--text-muted)]">—</span>}</td>
                      {me.academic && <td className="px-3 py-2 text-xs">
                        {r.attempt ? <><div className="text-[var(--text-main)]">{r.attempt.examTitle}</div><div className="text-[var(--text-muted)]">{r.attempt.status === "in_progress" ? "пишет" : r.attempt.parts.map(p => `${p.title}: ${p.value}`).join(" · ") || (r.attempt.percent != null ? `${r.attempt.percent}%` : "сдан")}</div></>
                          : r.referral ? <span className="text-sky-700">направлен{r.referral.manual ? " (вручную)" : ""}</span> : r.paperResults ? "на бумаге" : <span className="text-[var(--text-muted)]">—</span>}
                      </td>}
                      {me.academic && <td className="px-3 py-2 text-xs">{r.decision || attemptDecision(r) || "—"}</td>}
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-[var(--text-muted)]">{STAGE_LABEL[r.stage]}</td>
                    </tr>
                  ))}
                  {!visible.length && <tr><td colSpan={me.academic ? 8 : 6} className="py-8 text-center text-[var(--text-muted)]">Ничего не найдено</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {creating && <CreateModal api={api} onClose={() => setCreating(false)} onDone={async id => { setCreating(false); await load(); openCard(id, "profile"); }} />}
      {scan && <QrScanModal onClose={() => setScan(false)} />}
      {open && <ApplicantCard key={open} id={open} api={api} tenant={activeTenant} initialTab={params.get("ctab") || undefined} section={params.get("s") || undefined} onClose={() => openCard(null)} onChanged={load} />}
    </div>
  );
}

const attemptDecision = (r: Row) => r.attempt?.decision || "";
/** Этапы после направления — академическая часть, психологу не показываются. */
const ACADEMIC_STAGES = new Set<Stage>(["testing", "tested", "decided"]);

function CreateModal({ api, onClose, onDone }: { api: ReturnType<typeof useAdmissionApi>; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ name: "", birthDate: "", grade: "", parentName: "", phone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const j = await api("/applicants", { method: "POST", body: JSON.stringify({ child: { name: f.name, birthDate: f.birthDate, grade: f.grade }, parent: { name: f.parentName, phone: f.phone }, note: f.note }) });
      onDone(j.id);
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Новый поступающий" onClose={onClose}>
      <div className="space-y-3">
        <div><span className={label}>ФИО ребёнка</span><input className={input} value={f.name} onChange={set("name")} autoFocus /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className={label}>Поступает в класс</span><input className={input} inputMode="numeric" value={f.grade} onChange={set("grade")} placeholder="7" /></div>
          <div><span className={label}>Дата рождения</span><input type="date" className={input} value={f.birthDate} onChange={set("birthDate")} /></div>
        </div>
        <div><span className={label}>ФИО родителя</span><input className={input} value={f.parentName} onChange={set("parentName")} /></div>
        <div><span className={label}>Телефон родителя</span><input className={input} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="+996 …" /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !f.name.trim() || !f.grade.trim()} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Завести</button>
        </div>
      </div>
    </Modal>
  );
}
