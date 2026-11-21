import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, ListTree, Monitor, Plus, Save, SlidersHorizontal, Smartphone, Trash2, X } from "lucide-react";
import ResultExperience from "../../../components/resultPage/ResultExperience";
import { Button, Spinner, Tabs, confirmDialog, toast } from "../../../components/ui";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { DEFAULT_VARIANT_KEY, PRESETS, SAMPLE_RESULT_DATA, fillVariant, presetVariant, resultSampleVars, type LetterStep, type ResultPage, type Variant } from "../../../shared/resultPages";
import { FocusCtx, type FocusTarget, type OrgInfo } from "./EditorKit";
import { LeftPanel, RightPanel, type Patch, type Sel } from "./EditorPanels";
import TemplateGallery from "./TemplateGallery";
import { rpApi, type OutcomeRow } from "./resultPagesApi";

type Device = "desktop" | "phone";

function useNarrow(): boolean {
  const [n, setN] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setN(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return n;
}

const letterOf = (v: Variant): LetterStep => v.steps[v.steps.length - 1] as LetterStep;
const snap = (name: string, variants: Record<string, Variant>) => JSON.stringify({ name, variants });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/**
 * Полноэкранный редактор страницы результатов: слева шаги и блоки, по центру
 * живое письмо, справа свойства выбранного и оформление.
 */
export default function ResultPageEditor({ tenantId, pageId, onClose, onBound, outcomes: outcomesProp, pageKind }: {
  tenantId: string; pageId?: string | null; onClose: () => void; onBound: (pageId: string, name: string) => void;
  /** Свои исходы (вкладки вариантов) вместо исходов анкеты кандидата — например, состояния формы заявок. */
  outcomes?: { id: string; label: string }[];
  /** "form": страница заявки — в предпросмотре подставляются имя, форма и статус. */
  pageKind?: "form";
}) {
  const narrow = useNarrow();
  const [pid, setPid] = useState<string | null>(pageId || null);
  const [loading, setLoading] = useState(!!pageId);
  const [name, setName] = useState("");
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [saved, setSaved] = useState(snap("", {}));
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [org, setOrg] = useState<OrgInfo>({ name: "", logoUrl: null });
  const [key, setKey] = useState(DEFAULT_VARIANT_KEY);
  const [sel, setSel] = useState<Sel>({ t: "theme" });
  const [viewStep, setViewStep] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [gallery, setGallery] = useState(!pageId);
  const [drawer, setDrawer] = useState<"left" | "right" | null>(null);
  const [saving, setSaving] = useState(false);
  const lastFocus = useRef<FocusTarget | null>(null);
  const lastItem = useRef<Sel | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!outcomesProp) rpApi(tenantId, "/outcomes").then(j => setOutcomes(j.outcomes || [])).catch(() => {});
    emailApi(tenantId).then(j => setOrg({ name: String(j.org?.name || ""), logoUrl: j.org?.logoUrl || null })).catch(() => {});
  }, [tenantId, !!outcomesProp]);
  useEffect(() => {
    if (outcomesProp) setOutcomes(outcomesProp.map(o => ({ id: o.id, label: o.label, final: false, trial: false })));
  }, [outcomesProp]);
  const sampleVars = useMemo(() => (pageKind === "form" ? { ...resultSampleVars(), имя: "Асанов Тимур", форма: "Регистрация на форум", статус: "Одобрено" } : resultSampleVars()), [pageKind]);

  const open = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const p = (await rpApi(tenantId, `/${id}`)).page as ResultPage;
      setPid(id); setName(p.name); setVariants(p.variants); setSaved(snap(p.name, p.variants));
      setKey(DEFAULT_VARIANT_KEY);
      const d = p.variants[DEFAULT_VARIANT_KEY];
      setSel(d ? { t: "step", id: letterOf(d).id } : { t: "theme" });
      setViewStep(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { if (pageId) open(pageId); }, [pageId, open]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const upd = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, gallery]);

  const variant: Variant | undefined = variants[key];
  const dirty = !!pid && snap(name, variants) !== saved;
  const patch: Patch = useCallback(fn => setVariants(vs => (vs[key] ? { ...vs, [key]: fn(vs[key]) } : vs)), [key]);
  const filled = useMemo(() => (variant ? fillVariant(variant, sampleVars) : null), [variant, sampleVars]);
  const stepId = variant && viewStep && variant.steps.some(s => s.id === viewStep) ? viewStep : variant ? letterOf(variant).id : undefined;

  const pickKey = (k: string) => {
    setKey(k); setViewStep(null);
    const v = variants[k];
    setSel(v ? { t: "step", id: letterOf(v).id } : { t: "theme" });
  };
  const select = (s: Sel) => {
    setSel(s);
    if (s.t !== "theme") lastItem.current = s;
    if (s.t === "step") setViewStep(s.id);
    if (s.t === "block" && variant) setViewStep(letterOf(variant).id);
  };
  const selectFromPreview = (s: Sel) => { select(s); if (narrow) setDrawer("right"); };
  const selectFromRight = (s: Sel | "item") => select(s === "item" ? lastItem.current || (variant ? { t: "step", id: letterOf(variant).id } : { t: "theme" }) : s);
  const selectFromLeft = (s: Sel) => { select(s); if (narrow) setDrawer(null); };

  const createVariant = (from: Variant) => {
    setVariants(vs => ({ ...vs, [key]: clone(from) }));
    setSel({ t: "step", id: letterOf(from).id }); setViewStep(null);
  };
  const dropVariant = async () => {
    if (!(await confirmDialog({ title: "Удалить этот вариант?", message: "Для этого исхода будет показана версия «По умолчанию».", confirmLabel: "Удалить", danger: true }))) return;
    setVariants(vs => { const n = { ...vs }; delete n[key]; return n; });
    setSel({ t: "theme" });
  };

  const save = async () => {
    if (!pid) return;
    if (!name.trim()) { toast.error("Назовите страницу"); return; }
    setSaving(true);
    try {
      await rpApi(tenantId, `/${pid}`, { method: "PUT", body: JSON.stringify({ name: name.trim(), variants }) });
      setSaved(snap(name, variants));
      toast.success("Сохранено");
      onBound(pid, name.trim());
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const close = async () => {
    if (dirty && !(await confirmDialog({ title: "Закрыть без сохранения?", message: "Несохранённые изменения пропадут.", confirmLabel: "Закрыть", danger: true }))) return;
    onClose();
  };
  const picked = async (id: string, nm: string) => {
    if (dirty && !(await confirmDialog({ title: "Сменить страницу без сохранения?", confirmLabel: "Сменить", danger: true }))) return;
    await open(id);
    setGallery(false);
    onBound(id, nm);
  };

  const tabs = [
    { id: DEFAULT_VARIANT_KEY, label: "По умолчанию" },
    ...outcomes.map(o => ({ id: o.id, label: o.label, icon: variants[o.id] ? undefined : <Plus className="w-3 h-3" /> })),
  ];

  // Рамка устройства: вписывается в центр, письмо рисуется в натуральную ширину.
  const frameW = device === "phone" ? 390 : 1000;
  const availW = Math.max(120, box.w - 32);
  const availH = Math.max(120, box.h - 32);
  const scale = device === "phone" ? Math.min(1, availH / 820, availW / 390) : Math.min(1, availW / 1000);
  const frameH = device === "phone" ? 820 : Math.round(availH / scale);

  const leftEl = variant ? <LeftPanel variant={variant} sel={sel} onSelect={selectFromLeft} patch={patch} pageKind={pageKind} /> : null;
  const rightEl = variant ? <RightPanel tenantId={tenantId} variant={variant} sel={sel} onSelect={selectFromRight} patch={patch} org={org} /> : null;
  const asideBase = "bg-[var(--bg-surface)] overflow-y-auto";

  return (
    <FocusCtx.Provider value={{ last: lastFocus }}>
      <div className="fixed inset-0 z-[60] bg-[var(--bg-app)] flex flex-col text-[var(--text-main)]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
          <button className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)]" onClick={close} aria-label="Закрыть"><X className="w-4 h-4" /></button>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Название страницы" maxLength={80} disabled={!pid}
            className="flex-1 min-w-[140px] max-w-md bg-transparent border border-transparent hover:border-[var(--border-color)] focus:border-[var(--accent)] rounded-lg px-2 py-1.5 text-sm font-semibold outline-none" />
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => setGallery(true)}>Шаблоны</Button>
            <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden">
              {([["desktop", Monitor, "Компьютер"], ["phone", Smartphone, "Телефон"]] as const).map(([d, Icon, l]) => (
                <button key={d} title={l} aria-label={l} onClick={() => setDevice(d)} className={`px-2.5 h-8 ${device === d ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-surface-hover)]"}`}><Icon className="w-4 h-4" /></button>
              ))}
            </div>
            <Button size="sm" variant="primary" loading={saving} disabled={!pid || !dirty} icon={<Save className="w-3.5 h-3.5" />} onClick={save}>Сохранить</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
          <div className="flex-1 min-w-0"><Tabs tabs={tabs} value={key} onChange={pickKey} /></div>
          {variant && key !== DEFAULT_VARIANT_KEY && <Button size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={dropVariant}>Удалить вариант</Button>}
          {narrow && variant && (<>
            <button className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)]" aria-label="Шаги и блоки" onClick={() => setDrawer(d => (d === "left" ? null : "left"))}><ListTree className="w-4 h-4" /></button>
            <button className="p-2 rounded-lg hover:bg-[var(--bg-surface-hover)]" aria-label="Свойства" onClick={() => setDrawer(d => (d === "right" ? null : "right"))}><SlidersHorizontal className="w-4 h-4" /></button>
          </>)}
        </div>

        <div className="flex-1 min-h-0 flex relative">
          {!narrow && variant && <aside className={`${asideBase} w-72 shrink-0 border-r border-[var(--border-color)]`}>{leftEl}</aside>}

          <div ref={stage} className="flex-1 min-w-0 overflow-hidden relative flex items-center justify-center bg-[var(--bg-surface-hover)]">
            {loading ? <Spinner /> : !variant ? (
              <div className="p-4 space-y-3 max-w-md text-center">
                <div className="text-sm font-semibold">Для этого исхода своего варианта нет</div>
                <div className="flex flex-col gap-2">
                  {variants[DEFAULT_VARIANT_KEY] && <Button variant="primary" onClick={() => createVariant(variants[DEFAULT_VARIANT_KEY])}>Создать из «По умолчанию»</Button>}
                  {PRESETS.map(p => <Button key={p.id} variant="secondary" onClick={() => { const v = presetVariant(p.id); if (v) createVariant(v); }}>Создать из «{p.name}»</Button>)}
                </div>
              </div>
            ) : filled && (
              <div style={{ width: frameW * scale, height: frameH * scale }} className="shadow-2xl rounded-lg overflow-hidden bg-black/5 shrink-0">
                <div style={{ width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                  <ResultExperience variant={filled} data={SAMPLE_RESULT_DATA} org={org} mode="preview" device={device} stepId={stepId}
                    selectedBlockId={sel.t === "block" ? sel.id : null} selectedStepId={sel.t === "step" ? sel.id : null}
                    onSelectBlock={id => selectFromPreview({ t: "block", id })} onSelectStep={id => selectFromPreview({ t: "step", id })} />
                </div>
              </div>
            )}
          </div>

          {!narrow && variant && <aside className={`${asideBase} w-80 shrink-0 border-l border-[var(--border-color)]`}>{rightEl}</aside>}

          {narrow && variant && drawer && (<>
            <div className="absolute inset-0 z-10 bg-black/40" onClick={() => setDrawer(null)} />
            <aside className={`${asideBase} absolute top-0 bottom-0 z-20 w-[88%] max-w-[340px] shadow-2xl ${drawer === "left" ? "left-0" : "right-0"}`}>{drawer === "left" ? leftEl : rightEl}</aside>
          </>)}

          {gallery && <TemplateGallery tenantId={tenantId} org={org} currentId={pid} onPick={picked} onClose={() => (pid ? setGallery(false) : onClose())} />}
        </div>
      </div>
    </FocusCtx.Provider>
  );
}
