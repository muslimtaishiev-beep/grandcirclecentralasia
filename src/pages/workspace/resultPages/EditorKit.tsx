import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import ResultExperience from "../../../components/resultPage/ResultExperience";
import { Button, toast } from "../../../components/ui";
import { SAMPLE_RESULT_DATA, fillVariant, resultSampleVars, type MediaRef, type Variant } from "../../../shared/resultPages";
import { uploadMedia } from "./resultPagesApi";

export interface OrgInfo { name: string; logoUrl: string | null }

/** Последнее выбранное текстовое поле: туда вставляются переменные. */
export interface FocusTarget { el: HTMLInputElement | HTMLTextAreaElement; set: (v: string) => void }
export const FocusCtx = createContext<{ last: React.MutableRefObject<FocusTarget | null> }>({ last: { current: null } });

const fieldCls = "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]";

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{title}</h4>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function TextField({ label, value, onChange, multiline, placeholder, max = 200 }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; max?: number;
}) {
  const ctx = useContext(FocusCtx);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const focus = () => { if (ref.current) ctx.last.current = { el: ref.current, set: onChange }; };
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      {multiline
        ? <textarea ref={ref} rows={7} maxLength={max} className={`${fieldCls} resize-y`} value={value} placeholder={placeholder} onFocus={focus} onChange={e => onChange(e.target.value)} />
        : <input ref={ref} maxLength={max} className={fieldCls} value={value} placeholder={placeholder} onFocus={focus} onChange={e => onChange(e.target.value)} />}
    </label>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> <span>{children}</span>
    </label>
  );
}

/** Файл (загрузка в хранилище организации) или https-ссылка. */
export function MediaField({ tenantId, value, onChange, accept, label }: {
  tenantId: string; value: MediaRef | null; onChange: (m: MediaRef | null) => void; accept: "video" | "image" | "both"; label: string;
}) {
  const [pct, setPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const types = accept === "video" ? "video/mp4,video/webm" : accept === "image" ? "image/jpeg,image/png" : "video/mp4,video/webm,image/jpeg,image/png";
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPct(0);
    try { onChange(await uploadMedia(tenantId, f, setPct)); toast.success("Файл загружен"); }
    catch (e: any) { toast.error(e.message || "Не удалось загрузить"); }
    finally { setPct(null); if (fileRef.current) fileRef.current.value = ""; }
  };
  const has = !!value && (value.source === "upload" ? !!value.path : !!value.url);
  return (
    <div className="space-y-2">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      {has && value!.source === "upload" && <div className="text-sm text-[var(--text-main)] truncate">{value!.name || "Загруженный файл"}</div>}
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept={types} className="hidden" onChange={e => pick(e.target.files?.[0])} />
        <Button size="sm" variant="secondary" disabled={pct !== null} icon={pct !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} onClick={() => fileRef.current?.click()}>
          {pct !== null ? `${pct}%` : "Загрузить файл"}
        </Button>
        {has && <Button size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => onChange(null)}>Убрать</Button>}
      </div>
      {pct !== null && <div className="h-1.5 rounded-full bg-[var(--bg-surface-hover)] overflow-hidden"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} /></div>}
      <input className={fieldCls} placeholder="или ссылка https://…" value={value?.source === "url" ? value.url : ""} onChange={e => onChange(e.target.value ? { source: "url", url: e.target.value } : null)} />
    </div>
  );
}

/** Миниатюра страницы: живой предпросмотр, уменьшенный и без кликов. */
export function Thumb({ variant, org, width, stepId }: { variant: Variant; org: OrgInfo; width: number; stepId?: string }) {
  const filled = useMemo(() => {
    const v = fillVariant(variant, resultSampleVars());
    return { ...v, theme: { ...v.theme, confetti: false } };
  }, [variant]);
  return (
    <div style={{ width, height: Math.round(width * 0.68), overflow: "hidden", position: "relative", borderRadius: 6 }}>
      <div style={{ width: 1000, height: 680, transform: `scale(${width / 1000})`, transformOrigin: "0 0", pointerEvents: "none", position: "absolute", top: 0, left: 0 }}>
        <ResultExperience variant={filled} data={SAMPLE_RESULT_DATA} org={org} mode="preview" device="desktop" stepId={stepId} />
      </div>
    </div>
  );
}
