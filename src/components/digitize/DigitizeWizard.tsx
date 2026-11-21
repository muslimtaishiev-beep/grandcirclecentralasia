import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Table2, BookOpen, Plus, Loader2 } from "lucide-react";
import { Button, Modal, toast, card } from "../ui";
import { useAuth } from "../../contexts/AuthContext";
import { useDigitizeApi } from "../../pages/workspace/digitize/digitizeApi";
import { useJournalApi, type JournalListItem } from "../../pages/workspace/journals/journalApi";
import type { Journal, JournalColumn, JournalEntry } from "../../shared/journals";
import type { DigitizeMode, DigitizeResponse, DigitizeResult, DigitizedScan } from "../../shared/digitize";
import PagesStep, { type PageItem } from "./PagesStep";
import ReviewPhotos from "./ReviewPhotos";
import ReviewDocument from "./ReviewDocument";
import ReviewTable from "./ReviewTable";
import ReviewJournal, { NewJournalColumns } from "./ReviewJournal";
import {
  buildEntries, countJournalErrors, mergeDocument, mergeJournal, mergeTable, newColumnsToJournal, tableToNewJournal,
  saveDocument, saveJournalRows, saveNewJournal, saveOriginal, saveSheet,
  type Api, type DocDraft, type JournalRowDraft, type NewJournalDraft, type SaveContext, type Saved, type TableDraft,
} from "./saveDigitized";

export interface DigitizeWizardProps {
  tenantId: string;
  /** Открыт из журнала: режим «Журнал», цель — этот журнал, выбора нет. */
  journal?: Journal;
  onClose: () => void;
  /** После сохранения. entries — созданные записи, если сохраняли в журнал. */
  onSaved?: (r: { scan: DigitizedScan | null; entries?: JournalEntry[] }) => void;
}

type Step = "pages" | "target" | "recognize" | "review";
type Target = { kind: "document" } | { kind: "table" } | { kind: "journal"; journal: Journal; role: string } | { kind: "newJournal" };
type Draft =
  | { kind: "document"; doc: DocDraft }
  | { kind: "table"; table: TableDraft }
  | { kind: "journal"; journal: Journal; rows: JournalRowDraft[] }
  | { kind: "newJournal"; nj: NewJournalDraft };

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const msg = (e: unknown) => (e instanceof Error ? e.message : "Ошибка");
const chip = "flex items-center gap-3 w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-left text-[var(--text-main)] font-medium hover:border-[var(--accent)] transition";

export default function DigitizeWizard({ tenantId, journal, onClose, onSaved }: DigitizeWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const digitizeApi = useDigitizeApi(tenantId);
  const journalApi = useJournalApi(tenantId);

  const [step, setStep] = useState<Step>("pages");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [target, setTarget] = useState<Target | null>(journal ? { kind: "journal", journal, role: "edit" } : null);
  const [journals, setJournals] = useState<JournalListItem[] | null>(null);
  const [pickingJournal, setPickingJournal] = useState(false);
  const [targetErr, setTargetErr] = useState("");
  const [busyTarget, setBusyTarget] = useState(false);

  const [results, setResults] = useState<(DigitizeResult | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [running, setRunning] = useState(false);
  const [recErr, setRecErr] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<"photo" | "text">("text");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const dirty = pages.length > 0 || step !== "pages";
  const close = () => { if (dirty && !window.confirm("Закрыть без сохранения?")) return; abortRef.current?.abort(); onClose(); };
  useEffect(() => () => abortRef.current?.abort(), []);

  const mode: DigitizeMode | null = !target ? null : target.kind === "document" ? "document" : target.kind === "table" || target.kind === "newJournal" ? "table" : "journal";

  // ── Куда ──
  const loadJournals = async () => {
    setPickingJournal(true); setTargetErr("");
    try {
      const j = await journalApi("") as { journals: JournalListItem[] };
      setJournals(j.journals.filter(x => x.role !== "view" && !x.archivedAt));
    } catch (e) { setTargetErr(msg(e)); }
  };
  const chooseJournal = async (id: string) => {
    setBusyTarget(true); setTargetErr("");
    try {
      const j = await journalApi(`/${id}`) as { journal: Journal; role: string };
      pick({ kind: "journal", journal: j.journal, role: j.role });
    } catch (e) { setTargetErr(msg(e)); } finally { setBusyTarget(false); }
  };

  // ── Распознавание ──
  const run = useCallback(async (tgt: Target, base: (DigitizeResult | null)[], pgs: PageItem[]) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true); setRecErr("");
    const acc = [...base];
    while (acc.length < pgs.length) acc.push(null);
    const m: DigitizeMode = tgt.kind === "document" ? "document" : tgt.kind === "journal" ? "journal" : "table";
    for (let i = 0; i < pgs.length; i++) {
      if (acc[i]) continue;
      setCurrent(i);
      try {
        const firstTable = acc.find((r): r is Extract<DigitizeResult, { mode: "table" }> => !!r && r.mode === "table");
        const body = { mode: m, image: pgs[i].page.recognize, ...(tgt.kind === "journal" ? { journalId: tgt.journal.id } : {}), ...(m === "table" && firstTable ? { continueHeaders: firstTable.table.headers } : {}) };
        const r = await digitizeApi(`/recognize`, { method: "POST", body: JSON.stringify(body), signal: ac.signal }) as DigitizeResponse;
        acc[i] = r.result;
        setResults([...acc]);
        setUsage(r.usage);
      } catch (e) {
        setResults([...acc]);
        setRunning(false);
        if (!isAbort(e)) setRecErr(`Страница ${i + 1}: ${msg(e)}`);
        return;
      }
    }
    setResults([...acc]);
    setRunning(false);
    toReview(tgt, acc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitizeApi]);

  const toReview = (tgt: Target, res: (DigitizeResult | null)[]) => {
    if (tgt.kind === "document") setDraft({ kind: "document", doc: mergeDocument(res) });
    else if (tgt.kind === "table") setDraft({ kind: "table", table: mergeTable(res) });
    else if (tgt.kind === "journal") setDraft({ kind: "journal", journal: tgt.journal, rows: mergeJournal(res) });
    else setDraft({ kind: "newJournal", nj: tableToNewJournal(mergeTable(res)) });
    setStep("review");
  };

  const pick = (t: Target) => { setTarget(t); setResults([]); setRecErr(""); setStep("recognize"); };
  // Журнал выбран в списке → сразу распознаём.
  useEffect(() => {
    if (step === "recognize" && target && !running && results.length === 0 && !recErr && pages.length) void run(target, [], pages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, target]);

  const cancel = () => { abortRef.current?.abort(); setStep(journal ? "pages" : "target"); setResults([]); };

  // ── Сохранение ──
  const save = async () => {
    if (!draft || !user || !mode) return;
    setSaving(true); setSaveErr("");
    const ctx: SaveContext = { tenantId, staffId: user.uid, authorName: user.displayName || user.email || "Сотрудник", journalApi: journalApi as Api, digitizeApi: digitizeApi as Api };
    let saved: Saved;
    let scanTitle = "";
    try {
      if (draft.kind === "document") { saved = await saveDocument(ctx, draft.doc); scanTitle = draft.doc.title; }
      else if (draft.kind === "table") { saved = await saveSheet(ctx, draft.table); scanTitle = draft.table.title; }
      else if (draft.kind === "journal") { saved = await saveJournalRows(ctx, draft.journal.id, draft.journal.title, draft.journal.columns, draft.rows); scanTitle = draft.journal.title; }
      else { saved = await saveNewJournal(ctx, draft.nj); scanTitle = draft.nj.title; }
    } catch (e) {
      setSaveErr(msg(e)); toast.error(msg(e)); setSaving(false); return;
    }
    let scan: DigitizedScan | null = null;
    try { scan = await saveOriginal(ctx, draft.kind === "newJournal" ? "journal" : mode, saved, scanTitle, pages.map(p => p.page.store)); }
    catch { toast.error("Оригинал не сохранился"); }
    toast.success("Сохранено");
    onSaved?.({ scan, entries: saved.entries });
    onClose();
    if (!journal) {
      const route = saved.type === "document" ? "docs" : saved.type === "sheet" ? "sheets" : "journals";
      navigate(`/workspace/${tenantId}/${route}/${saved.id}`);
    }
  };

  // ── Отрисовка ──
  const jcols = (j: Journal): JournalColumn[] => j.columns.filter(c => ["text", "number", "date", "select", "checkbox"].includes(c.type));
  const canSave = !!draft && !saving && (
    draft.kind === "journal" ? countJournalErrors(jcols(draft.journal), draft.rows) === 0 && draft.rows.length > 0
    : draft.kind === "newJournal" ? draft.nj.cols.some(c => !c.skip) && countJournalErrors(newColumnsToJournal(draft.nj.cols), draft.nj.rows) === 0
    : draft.kind === "table" ? draft.table.headers.length > 0
    : draft.doc.blocks.length > 0);

  const editor = !draft ? null
    : draft.kind === "document" ? <ReviewDocument draft={draft.doc} onChange={doc => setDraft({ kind: "document", doc })} />
    : draft.kind === "table" ? <ReviewTable draft={draft.table} onChange={table => setDraft({ kind: "table", table })} />
    : draft.kind === "journal" ? <ReviewJournal columns={jcols(draft.journal)} rows={draft.rows} onChange={rows => setDraft({ ...draft, rows })} />
    : (
      <div className="space-y-4">
        <NewJournalColumns title={draft.nj.title} onTitle={title => setDraft({ kind: "newJournal", nj: { ...draft.nj, title } })} cols={draft.nj.cols} onCols={cols => setDraft({ kind: "newJournal", nj: { ...draft.nj, cols } })} />
        <ReviewJournal columns={newColumnsToJournal(draft.nj.cols)} rows={draft.nj.rows} onChange={rows => setDraft({ kind: "newJournal", nj: { ...draft.nj, rows } })} />
      </div>
    );

  return (
    <Modal title="Оцифровка" onClose={close} xwide>
      {step === "pages" && (
        <div className="space-y-4">
          <PagesStep pages={pages} onChange={setPages} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Отмена</Button>
            <Button variant="primary" disabled={!pages.length} onClick={() => { if (journal) pick(target as Target); else setStep("target"); }}>Далее</Button>
          </div>
        </div>
      )}

      {step === "target" && (
        <div className="space-y-3 max-w-lg">
          {!pickingJournal ? (
            <>
              <button type="button" className={chip} onClick={() => pick({ kind: "document" })}><FileText className="w-5 h-5" /> Документ</button>
              <button type="button" className={chip} onClick={() => pick({ kind: "table" })}><Table2 className="w-5 h-5" /> Таблица</button>
              <button type="button" className={chip} onClick={loadJournals}><BookOpen className="w-5 h-5" /> Журнал</button>
            </>
          ) : (
            <>
              <button type="button" className={chip} onClick={() => { setPickingJournal(false); pick({ kind: "newJournal" }); }}><Plus className="w-5 h-5" /> Новый журнал</button>
              {!journals && !targetErr && <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />}
              {journals?.map(j => <button key={j.id} type="button" disabled={busyTarget} className={chip} onClick={() => void chooseJournal(j.id)}><BookOpen className="w-5 h-5" /> {j.title}</button>)}
            </>
          )}
          {targetErr && <div role="alert" className="text-sm text-rose-600">{targetErr}</div>}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="secondary" onClick={() => { if (pickingJournal) setPickingJournal(false); else setStep("pages"); }}>Назад</Button>
          </div>
        </div>
      )}

      {step === "recognize" && (
        <div className="space-y-4 max-w-lg">
          {running && <div className="flex items-center gap-2 text-[var(--text-main)]"><Loader2 className="w-5 h-5 animate-spin" /> Страница {current + 1} из {pages.length}</div>}
          {recErr && (
            <div role="alert" className="text-sm text-rose-600 space-y-2">
              <div>{recErr}</div>
              <div className="flex gap-2">
                {target && <Button variant="primary" onClick={() => void run(target, results, pages)}>Повторить</Button>}
                {results.some(Boolean) && target && <Button variant="secondary" onClick={() => toReview(target, results)}>К проверке</Button>}
              </div>
            </div>
          )}
          {usage && <div className="text-xs text-[var(--text-muted)]">{usage.used} / {usage.limit}</div>}
          <Button variant="secondary" onClick={cancel}>{running ? "Отменить" : "Назад"}</Button>
        </div>
      )}

      {step === "review" && draft && (
        <div className="space-y-3">
          <div className="flex sm:hidden gap-1 p-1 rounded-lg bg-[var(--bg-app)]">
            {(["photo", "text"] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)} className={`flex-1 py-1.5 rounded-md text-sm ${view === v ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)]"}`}>{v === "photo" ? "Фото" : "Текст"}</button>
            ))}
          </div>
          <div className="sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
            <div className={`${view === "photo" ? "" : "hidden"} sm:block sm:max-h-[70vh] sm:overflow-y-auto sm:sticky sm:top-16 sm:self-start`}><ReviewPhotos pages={pages.map(p => p.page.store)} /></div>
            <div className={`${view === "text" ? "" : "hidden"} sm:block min-w-0`}>{editor}</div>
          </div>
          {saveErr && <div role="alert" className="text-sm text-rose-600">{saveErr}</div>}
          <div className={`${card} sticky bottom-0 flex items-center justify-between gap-2 p-3`}>
            <span className="text-xs text-[var(--text-muted)]">{usage ? `${usage.used} / ${usage.limit}` : ""}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Отмена</Button>
              <Button variant="primary" loading={saving} disabled={!canSave} onClick={() => void save()}>Сохранить</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
