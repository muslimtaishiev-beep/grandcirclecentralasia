import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLive } from "../../../lib/useLive";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ArchiveRestore, ArrowDown, ArrowUp, Archive, CalendarClock, Download, FileDown, History, Loader2, Mail, QrCode, Search, Send, Trash2, UserPlus, Users } from "lucide-react";
import { STAGE_LABEL, type Stage } from "../../../shared/admissions";
import { gradeOf } from "../../../shared/questionnaires";
import { Button, EmptyState, Spinner, Table, Tabs, confirmDialog, toast, useUrlTab } from "../../../components/ui";
import { card, input } from "../journals/components/ui";
import { TONE, useAdmissionApi, type Me, type Row } from "./admissionApi";
import ApplicantCard from "./ApplicantCard";
import NewApplicantModal from "./NewApplicantModal";
import AttemptViewer from "../exams/AttemptViewer";
import QrScanModal from "./QrScanModal";
import TemplatesTab from "./TemplatesTab";
import HistoryModal from "./HistoryModal";
import { downloadSessionById } from "./sessionPdf";
import { PublishWhenModal, SkippedModal, SplitPublishButton, outcomeText, type PublishOutcome } from "./PublishControls";

/**
 * «Поступающие»: список с поиском по ФИО и №, фильтры по классу и этапу,
 * сортировка, массовые действия, архив, новая карточка, сканер QR. Всё, что
 * выбрано (поиск, фильтры, сортировка, вкладка, открытая карточка), хранится в
 * адресе — ссылкой можно поделиться, перезагрузка ничего не сбрасывает.
 */
const no = (n: number) => String(n).padStart(4, "0");
const PAGE = 50;
type SortKey = "created" | "no" | "name" | "grade" | "stage";
const SORTS: SortKey[] = ["created", "no", "name", "grade", "stage"];
const STAGE_ORDER = Object.keys(STAGE_LABEL) as Stage[];

/**
 * mode: «admin» — приём (завести, QR, направление, тест, решение); «staff» — только свои анкеты.
 * classGrades — страница класса (вступительный тест): только его поступающие, без вкладок.
 */
export default function AdmissionsPage({ embedded, mode = "admin", classGrades }: { embedded?: boolean; mode?: "admin" | "staff"; classGrades?: number[] } = {}) {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const api = useAdmissionApi(tenantId);
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [archive, setArchive] = useState<Row[]>([]);
  const [me, setMe] = useState<Me>({ admission: false, conduct: false, viewAll: false, academic: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState(false);
  const [sectionHistory, setSectionHistory] = useState(false);
  const [result, setResult] = useState<{ id: string; examId: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const reception = me.admission && mode === "admin";
  const viewTabs = ["list", "archive", "templates"] as const;
  const [rawView, setView] = useUrlTab("view", viewTabs, "list");
  const view = classGrades ? "list" : rawView === "archive" && !reception ? "list" : rawView;
  const open = params.get("open");

  const q = params.get("q") || "";
  const grade = params.get("grade") || "";
  const stage = (params.get("stage") || "") as "" | Stage;
  const sort: SortKey = SORTS.includes(params.get("sort") as SortKey) ? (params.get("sort") as SortKey) : "created";
  const dir = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : sort === "created" ? "desc" : "asc";
  const setP = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    setParams(p, { replace: true }); setShown(PAGE);
  };

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const j = await api("/applicants"); setRows(j.applicants); setMe(j.me);
      if (j.me.admission) { const a = await api("/applicants?archived=1"); setArchive(a.applicants); }
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, tenantId]);
  useEffect(() => { void load(); }, [load]);
  // Кто угодно изменил поступающего или ученик прошёл тест — список обновляется сам.
  useLive(tenantId, ["admissions", "exams"], () => { void load(); });
  // Специалист завёл ученика или завершил анкету — список обновляется без перезагрузки.
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail?.type === "admission") void load(); };
    window.addEventListener("sf:notification", on);
    return () => window.removeEventListener("sf:notification", on);
  }, [load]);
  const [saving, setSaving] = useState<string | null>(null);
  const downloadSession = async (id: string) => {
    setSaving(id);
    try { await downloadSessionById(api, activeTenant, id); } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  };

  const source = view === "archive" ? archive : rows;
  const grades = useMemo(() => [...new Set(source.map(r => gradeOf(r.child.grade)).filter((g): g is number => g !== null))].sort((a, b) => a - b), [source]);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = source.filter(r => {
      if (classGrades) { const g = gradeOf(r.child.grade); if (g === null || !classGrades.includes(g)) return false; }
      if (t && !(`${r.child.name} ${r.parent.name} ${r.parent.phone}`.toLowerCase().includes(t) || no(r.refNo).includes(t.replace(/\D/g, "") || "—"))) return false;
      if (grade && String(gradeOf(r.child.grade)) !== grade) return false;
      if (stage && r.stage !== stage) return false;
      return true;
    });
    const key = (r: Row): number | string => sort === "no" ? r.refNo : sort === "name" ? r.child.name.toLowerCase() : sort === "grade" ? gradeOf(r.child.grade) ?? 99 : sort === "stage" ? STAGE_ORDER.indexOf(r.stage) : r.createdAt;
    const k = dir === "asc" ? 1 : -1;
    return [...list].sort((x, y) => (key(x) > key(y) ? k : key(x) < key(y) ? -k : 0));
  }, [source, q, grade, stage, sort, dir, classGrades]);
  const page = visible.slice(0, shown);

  /** Сразу QR и ссылка на тест — без поиска кнопки в карточке. */
  const openQr = (id: string) => { const p = new URLSearchParams(params); p.set("open", id); p.set("ctab", "test"); p.set("qr", "referral"); setParams(p, { replace: true }); };
  const openCard = (id: string | null, tabKey?: string) => {
    const p = new URLSearchParams(params);
    if (id) { p.set("open", id); if (tabKey) p.set("ctab", tabKey); else p.delete("ctab"); } else { p.delete("open"); p.delete("ctab"); p.delete("s"); p.delete("qr"); }
    setParams(p, { replace: true });
  };
  /** Ввели номер целиком — сразу в карточку. */
  const findNo = async (raw = q) => {
    const n = raw.replace(/\D/g, "");
    if (!n) return;
    const hit = rows.find(r => r.refNo === Number(n));
    if (hit) return openCard(hit.id);
    try { const j = await api(`/by-no/${n}`); openCard(j.id); } catch (e: any) { toast.error(e.message); }
  };
  const excel = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Поступающие");
    const acad = me.academic && mode === "admin";
    ws.addRow(["№", "ФИО ребёнка", "Класс", "Дата рождения", "Родитель", "Телефон", "Анкета родителя", "Этапы", ...(acad ? ["Тест", "Результат", "Решение"] : []), "Этап"]);
    for (const r of visible) ws.addRow([no(r.refNo), r.child.name, r.child.grade, r.child.birthDate, r.parent.name, r.parent.phone, r.parentForm.status === "done" ? "да" : "",
      Object.values(r.stages).map(s => `${s.title}: ${s.status === "done" ? s.outcomeLabel : "идёт"}`).join("; "),
      ...(acad ? [r.attempt?.examTitle || r.referral?.examTitle || (r.paperResults ? "на бумаге" : ""), r.attempt?.parts.map(p => `${p.title}: ${p.value}`).join("; ") || (r.attempt?.percent != null ? `${r.attempt.percent}%` : ""),
        r.decision] : []), STAGE_LABEL[r.stage]]);
    ws.getRow(1).font = { bold: true }; ws.columns.forEach(c => { c.width = 18; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf])); a.download = `Поступающие ${new Date().toLocaleDateString("ru-RU")}.xlsx`; a.click();
  };

  const allOnPage = page.length > 0 && page.every(r => picked.has(r.id));
  const togglePick = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setPicked(s => { const n = new Set(s); page.forEach(r => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; });
  const bulk = async (action: "archive" | "restore" | "parent_email") => {
    const ids = [...picked];
    if (!ids.length) return;
    if (action === "archive" && !(await confirmDialog({ title: `Убрать в архив: ${ids.length}`, confirmLabel: "В архив" }))) return;
    if (action === "parent_email" && !(await confirmDialog({ title: `Отправить анкету родителям: ${ids.length}`, confirmLabel: "Отправить" }))) return;
    setBusy(true);
    try {
      const j = await api("/applicants-bulk", { method: "POST", body: JSON.stringify({ ids, action }) });
      toast.success(`Готово: ${j.ok}`);
      if (j.failed?.length) toast.error(`Не получилось (${j.failed.length}): ${j.failed.slice(0, 3).join("; ")}`);
      setPicked(new Set()); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const [pubPick, setPubPick] = useState(false);
  const [pubOut, setPubOut] = useState<PublishOutcome | null>(null);
  const publishBulk = async (at?: number) => {
    const ids = [...picked];
    if (!ids.length) return;
    if (!at && !(await confirmDialog({ title: `Опубликовать результаты: ${ids.length}`, message: "Результаты откроются по QR, родителям уйдут письма. Без окончательного решения — пропустим.", confirmLabel: "Опубликовать" }))) return;
    setBusy(true);
    try {
      const j: PublishOutcome = await api("/applicants/publish-bulk", { method: "POST", body: JSON.stringify({ ids, ...(at ? { at } : {}) }) });
      toast.success(outcomeText(j));
      if (j.skipped.length) setPubOut(j);
      setPubPick(false); setPicked(new Set()); await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const purge = async (r: Row) => {
    if (!(await confirmDialog({ title: `Удалить навсегда: ${r.child.name}`, message: "Анкеты, ссылки, работы и история будут стёрты.", confirmLabel: "Удалить навсегда", danger: true }))) return;
    try { await api(`/applicants/${r.id}?purge=1`, { method: "DELETE" }); toast.success("Удалено"); await load(); } catch (e: any) { toast.error(e.message); }
  };
  const restore = async (r: Row) => {
    try { await api(`/applicants/${r.id}/restore`, { method: "POST" }); toast.success("Возвращено"); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const acad = me.academic && mode === "admin";
  const heads: { label: string; sort?: SortKey }[] = [
    { label: "№", sort: "no" }, { label: "Ребёнок", sort: "name" }, { label: "Класс", sort: "grade" }, { label: "Анкета род." }, { label: "Этапы" },
    ...(acad ? [{ label: "Тест" }, { label: "Решение" }] : []), { label: "Этап", sort: "stage" },
  ];
  const sortBy = (k: SortKey) => setP(sort === k ? { dir: dir === "asc" ? "desc" : "asc", sort: k } : { sort: k, dir: "" });
  const tabItems = [
    { id: "list", label: "Поступающие", count: classGrades ? undefined : rows.length },
    { id: "archive", label: "Архив", count: archive.length, hidden: !reception },
    { id: "templates", label: "Анкеты" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          {!embedded && <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Поступающие</h1>}
        </div>
        <form className="flex" onSubmit={e => { e.preventDefault(); const n = (e.currentTarget.elements.namedItem("no") as HTMLInputElement).value; if (n.trim()) void findNo(n); }}>
          <input name="no" inputMode="numeric" className={`${input} !w-28 rounded-r-none`} placeholder="№ 0001" aria-label="Номер поступающего" />
          <Button type="submit" className="rounded-l-none border-l-0" icon={<Search className="w-4 h-4" />}>Найти</Button>
        </form>
        <Button onClick={() => setScan(true)} icon={<QrCode className="w-4 h-4" />}>Сканер</Button>
        {view === "templates" && me.admission && <Button onClick={() => setSectionHistory(true)} icon={<History className="w-4 h-4" />}>История</Button>}
        {reception && !classGrades && <Button variant="primary" onClick={() => setCreating(true)} icon={<UserPlus className="w-4 h-4" />}>Поступающий</Button>}
      </div>

      {!classGrades && <Tabs tabs={tabItems} value={view} onChange={id => { setView(id as typeof view); setPicked(new Set()); setShown(PAGE); }} />}

      {view === "templates" ? <TemplatesTab api={api} tenantId={tenantId} /> : (
        <>
          <div className={`${card} p-3 flex flex-wrap gap-2 items-center`}>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} pl-9`} placeholder="ФИО, телефон или № поступающего" aria-label="Поиск" value={q} onChange={e => setP({ q: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && /^\D*\d+\D*$/.test(q)) void findNo(); }} />
            </div>
            {grades.length > 0 && !classGrades && (
              <select className={`${input} !w-auto`} value={grade} aria-label="Класс" onChange={e => setP({ grade: e.target.value })}>
                <option value="">Все классы</option>{grades.map(g => <option key={g} value={g}>{g} класс</option>)}
              </select>
            )}
            <select className={`${input} !w-auto`} value={stage} aria-label="Этап" onChange={e => setP({ stage: e.target.value })}>
              <option value="">Все этапы</option>{STAGE_ORDER.filter(s => acad || !ACADEMIC_STAGES.has(s)).map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
            <select className={`${input} !w-auto md:hidden`} value={`${sort}:${dir}`} aria-label="Сортировка" onChange={e => { const [s, d] = e.target.value.split(":"); setP({ sort: s === "created" ? "" : s, dir: d }); }}>
              <option value="created:desc">Сначала новые</option><option value="created:asc">Сначала старые</option><option value="name:asc">По имени</option><option value="grade:asc">По классу</option><option value="no:asc">По номеру</option>
            </select>
            <Button onClick={excel} disabled={!visible.length} icon={<Download className="w-4 h-4" />}>Excel</Button>
          </div>

          {reception && picked.size > 0 && (
            <div className={`${card} p-2.5 flex flex-wrap items-center gap-2 sticky top-2 z-10`}>
              <span className="text-sm font-medium text-[var(--text-main)] px-1">Выбрано: {picked.size}</span>
              {view === "archive"
                ? <Button loading={busy} onClick={() => bulk("restore")} icon={<ArchiveRestore className="w-4 h-4" />}>Вернуть</Button>
                : <>
                    <Button loading={busy} onClick={() => bulk("parent_email")} icon={<Mail className="w-4 h-4" />}>Анкета родителям на почту</Button>
                    {me.academic && <>
                      <SplitPublishButton text="Опубликовать" size="md" loading={busy} onNow={() => publishBulk()} onSchedule={() => setPubPick(true)} />
                    </>}
                    <Button loading={busy} onClick={() => bulk("archive")} icon={<Archive className="w-4 h-4" />}>В архив</Button>
                  </>}
              <Button variant="ghost" className="ml-auto" onClick={() => setPicked(new Set())}>Снять выбор</Button>
            </div>
          )}

          {error && <div className="text-sm text-rose-600">{error}</div>}
          {loading ? <Spinner /> : !source.length ? (
            <EmptyState icon={<Users />} title={view === "archive" ? "Архив пуст" : "Пока никого"}
              action={reception && view === "list" ? <Button variant="primary" onClick={() => setCreating(true)} icon={<UserPlus className="w-4 h-4" />}>Завести первого поступающего</Button> : undefined} />
          ) : !visible.length ? <EmptyState title="Ничего не найдено" action={<Button onClick={() => setP({ q: "", grade: "", stage: "" })}>Сбросить фильтры</Button>} /> : (
            <>
              <Table className="hidden md:block" minWidth={860}>
                <thead>
                  <tr>
                    {reception && <th className="w-8"><input type="checkbox" aria-label="Выбрать все на странице" checked={allOnPage} onChange={togglePage} /></th>}
                    {heads.map(h => (
                      <th key={h.label} className="whitespace-nowrap" aria-sort={h.sort && sort === h.sort ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                        {h.sort ? <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--text-main)]" onClick={() => sortBy(h.sort!)}>{h.label}{sort === h.sort && (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</button> : h.label}
                      </th>
                    ))}
                    {view === "archive" && <th />}
                  </tr>
                </thead>
                <tbody>
                  {page.map(r => (
                    <tr key={r.id} className="cursor-pointer" onClick={() => openCard(r.id)}>
                      {reception && <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Выбрать ${r.child.name}`} checked={picked.has(r.id)} onChange={() => togglePick(r.id)} /></td>}
                      <td className="font-mono text-[var(--text-muted)]">{no(r.refNo)}</td>
                      <td><div className="font-medium text-[var(--text-main)]">{r.child.name}{r.twin && <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400" title="Тот же ребёнок есть в другой карточке — откройте, чтобы объединить">дубль?</span>}</div><div className="text-[11px] text-[var(--text-muted)]">{r.parent.name}{r.parent.phone ? ` · ${r.parent.phone}` : ""}</div></td>
                      <td>{r.child.grade}</td>
                      <td>{r.parentForm.status === "done" ? <span className="text-emerald-700 dark:text-emerald-400">✓</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td>{Object.values(r.stages).map(s => <span key={s.templateId} className={`inline-block mr-1 mb-0.5 px-2 py-0.5 rounded text-[11px] font-medium ${s.status === "done" && s.tone ? TONE[s.tone] : s.status === "draft" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" : "text-[var(--text-muted)] bg-[var(--bg-surface-hover)]"}`}>{s.status === "done" ? s.outcomeLabel : "● идёт"}</span>)}{!Object.keys(r.stages).length && <span className="text-[var(--text-muted)]">—</span>}
                        {(me.conduct || me.viewAll) && Object.values(r.stages).some(s => s.status === "done") && (
                          <button className="ml-1 align-middle p-1 rounded-md text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50" title="Скачать бланк сессии" aria-label="Скачать бланк сессии" disabled={saving === r.id}
                            onClick={e => { e.stopPropagation(); void downloadSession(r.id); }}>{saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}</button>
                        )}</td>
                      {acad && <td className="text-xs">
                        {r.attempt ? <><div className="text-[var(--text-main)]">{r.attempt.examTitle}</div><div className="text-[var(--text-muted)]">{r.attempt.status === "in_progress" ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">● пишет сейчас</span> : r.attempt.parts.map(p => `${p.title}: ${p.value}`).join(" · ") || (r.attempt.percent != null ? `${r.attempt.percent}%` : "сдан")}</div>
                          <button className="mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20" onClick={e => { e.stopPropagation(); setResult({ id: r.attempt!.id, examId: r.attempt!.examId }); }}>Результаты</button></>
                          : r.referral ? <><span className="text-sky-700 dark:text-sky-400">направлен{r.referral.manual ? " (вручную)" : ""}</span>
                            {reception && view !== "archive" && <button className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20" onClick={e => { e.stopPropagation(); openQr(r.id); }}><QrCode className="w-3 h-3" /> QR на тест</button>}</> : r.referralBlocked ? <span className="text-amber-700 dark:text-amber-400">снято</span> : r.paperResults ? "на бумаге" : <span className="text-[var(--text-muted)]">—</span>}
                      </td>}
                      {acad && <td className="text-xs">{r.decision || "—"}</td>}
                      <td className="text-xs whitespace-nowrap text-[var(--text-muted)]">{STAGE_LABEL[mode === "staff" && ACADEMIC_STAGES.has(r.stage) ? "referred" : r.stage]}</td>
                      {view === "archive" && <td className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <Button size="sm" onClick={() => restore(r)} icon={<ArchiveRestore className="w-3.5 h-3.5" />}>Вернуть</Button>
                        {me.owner && <Button size="sm" variant="ghost" className="ml-1 text-rose-600" aria-label="Удалить навсегда" onClick={() => purge(r)} icon={<Trash2 className="w-3.5 h-3.5" />} />}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </Table>
              <ul className="md:hidden space-y-2">
                {page.map(r => (
                  <li key={r.id} className={`${card} p-3 flex items-start gap-2`} onClick={() => openCard(r.id)}>
                    {reception && <input type="checkbox" className="mt-1" aria-label={`Выбрать ${r.child.name}`} checked={picked.has(r.id)} onClick={e => e.stopPropagation()} onChange={() => togglePick(r.id)} />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-main)] truncate">{r.child.name}{r.twin && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700">дубль?</span>}</div>
                      <div className="text-xs text-[var(--text-muted)]">{no(r.refNo)} · {r.child.grade} класс · {STAGE_LABEL[mode === "staff" && ACADEMIC_STAGES.has(r.stage) ? "referred" : r.stage]}</div>
                      {view === "archive" && <div className="pt-1.5 flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <Button size="sm" onClick={() => restore(r)} icon={<ArchiveRestore className="w-3.5 h-3.5" />}>Вернуть</Button>
                        {me.owner && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => purge(r)} icon={<Trash2 className="w-3.5 h-3.5" />}>Удалить</Button>}
                      </div>}
                    </div>
                  </li>
                ))}
              </ul>
              {visible.length > shown && <div className="flex justify-center"><Button onClick={() => setShown(n => n + PAGE)}>Показать ещё · {visible.length - shown}</Button></div>}
            </>
          )}
        </>
      )}

      {creating && <NewApplicantModal api={api} grade={classGrades?.length === 1 ? String(classGrades[0]) : undefined} onClose={() => setCreating(false)} onDone={async id => {
        setCreating(false); await load();
        // Сразу QR анкеты для родителя — сканирует на месте, печать по желанию.
        const p = new URLSearchParams(params); p.set("open", id); p.set("ctab", "profile"); p.set("qr", "parent"); setParams(p, { replace: true });
      }} />}
      {pubPick && <PublishWhenModal onClose={() => setPubPick(false)} onPick={at => publishBulk(at)} />}
      {pubOut && <SkippedModal outcome={pubOut} names={Object.fromEntries(rows.map(r => [r.id, r.child.name]))} onClose={() => setPubOut(null)} />}
      {scan && <QrScanModal onClose={() => setScan(false)} />}
      {sectionHistory && <HistoryModal api={api} scope="section" onClose={() => setSectionHistory(false)} />}
      {result && <AttemptViewer tenant={activeTenant} attemptId={result.id} examId={result.examId} onClose={() => setResult(null)} onChanged={load} />}
      {open && <ApplicantCard key={open} id={open} api={api} tenant={activeTenant} staffMode={mode === "staff"} initialTab={params.get("ctab") || undefined} section={params.get("s") || undefined} autoQr={params.get("qr") === "parent" ? "parent" : params.get("qr") === "referral" ? "referral" : undefined} onClose={() => openCard(null)} onChanged={load} onMerged={id => openCard(id)} />}
    </div>
  );
}

/** Этапы после направления — академическая часть, исполнителям анкет не показываются. */
const ACADEMIC_STAGES = new Set<Stage>(["testing", "tested", "decided"]);

