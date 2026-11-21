import { useState } from "react";
import { ArrowDown, ArrowUp, Camera, Crop, Trash2, Upload } from "lucide-react";
import { DIGITIZE_LIMITS } from "../../shared/digitize";
import { btn } from "../ui";
import PageCropper, { type CroppedPage } from "./PageCropper";

export interface PageItem { id: string; file: File; page: CroppedPage }

/** Шаг «Страницы»: съёмка/загрузка, обрезка по одной, порядок. */
export default function PagesStep({ pages, onChange }: { pages: PageItem[]; onChange: (p: PageItem[]) => void }) {
  const [queue, setQueue] = useState<File[]>([]);
  const [recrop, setRecrop] = useState<number | null>(null);
  const room = DIGITIZE_LIMITS.maxPages - pages.length - queue.length;

  const add = (files: FileList | null) => {
    if (!files) return;
    setQueue(q => [...q, ...Array.from(files).slice(0, Math.max(0, room))]);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const n = [...pages]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };

  const cropFile = recrop !== null ? pages[recrop]?.file : queue[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} ${room <= 0 ? "opacity-50 pointer-events-none" : ""}`}><Camera className="w-4 h-4" /> Сфотографировать
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { add(e.target.files); e.target.value = ""; }} /></label>
        <label className={`${btn} ${room <= 0 ? "opacity-50 pointer-events-none" : ""}`}><Upload className="w-4 h-4" /> Загрузить
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { add(e.target.files); e.target.value = ""; }} /></label>
        <span className="self-center text-sm text-[var(--text-muted)]">{pages.length} / {DIGITIZE_LIMITS.maxPages}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pages.map((p, i) => (
          <div key={p.id} className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-app)]">
            <div className="relative">
              <img src={p.page.store} alt={`Страница ${i + 1}`} className="w-full h-36 object-contain" />
              <span className="absolute top-1 left-1 text-[11px] px-1.5 rounded bg-black/60 text-white">{i + 1}</span>
            </div>
            <div className="flex justify-between p-1 text-[var(--text-muted)]">
              <button type="button" title="Выше" disabled={i === 0} onClick={() => move(i, -1)} className="p-2 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" title="Ниже" disabled={i === pages.length - 1} onClick={() => move(i, 1)} className="p-2 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" title="Обрезать заново" onClick={() => setRecrop(i)} className="p-2"><Crop className="w-4 h-4" /></button>
              <button type="button" title="Убрать" onClick={() => onChange(pages.filter(x => x.id !== p.id))} className="p-2 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {cropFile && (
        <div className="fixed inset-0 z-[60] bg-[var(--bg-app)] overflow-auto">
          <PageCropper
            key={recrop !== null ? `r${recrop}` : `${queue.length}-${cropFile.name}`}
            file={cropFile}
            onCancel={() => { if (recrop !== null) setRecrop(null); else setQueue(q => q.slice(1)); }}
            onDone={page => {
              if (recrop !== null) { onChange(pages.map((p, i) => (i === recrop ? { ...p, page } : p))); setRecrop(null); return; }
              onChange([...pages, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file: cropFile, page }]);
              setQueue(q => q.slice(1));
            }}
          />
        </div>
      )}
    </div>
  );
}
