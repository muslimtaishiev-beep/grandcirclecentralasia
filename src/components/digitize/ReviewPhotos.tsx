import { useState } from "react";
import { X } from "lucide-react";

/** Оригиналы страниц: прокручиваются, по нажатию — крупно. */
export default function ReviewPhotos({ pages }: { pages: string[] }) {
  const [big, setBig] = useState<string | null>(null);
  return (
    <>
      <div className="space-y-2">
        {pages.map((p, i) => (
          <button key={i} type="button" onClick={() => setBig(p)} className="block w-full relative border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-app)]">
            <img src={p} alt={`Страница ${i + 1}`} className="w-full h-auto block" />
            <span className="absolute top-1 left-1 text-[11px] px-1.5 rounded bg-black/60 text-white">{i + 1}</span>
          </button>
        ))}
      </div>
      {big && (
        <div className="fixed inset-0 z-[70] bg-black/90 overflow-auto" onClick={() => setBig(null)}>
          <button type="button" className="fixed top-3 right-3 p-2 rounded-full bg-white/20 text-white" title="Закрыть"><X className="w-5 h-5" /></button>
          <img src={big} alt="" className="w-full max-w-none sm:max-w-4xl mx-auto block" />
        </div>
      )}
    </>
  );
}
