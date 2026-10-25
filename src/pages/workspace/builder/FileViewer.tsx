import React, { useEffect, useMemo, useState } from 'react';
import { Download, X, FileText } from 'lucide-react';
import { fileInfo, formatSize, inlineMime } from '../../../shared/uploads';

export interface ViewerFile {
  /** Подпись поля анкеты, куда приложен файл. */
  label: string;
  /** Значение поля: data-URL файла. */
  value: string;
}

interface Props {
  title: string;
  files: ViewerFile[];
  onClose: () => void;
}

const base64ToBlob = (value: string, type: string): Blob | null => {
  try {
    const bin = atob(value.slice(value.indexOf(',') + 1).replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    return null;
  }
};

/**
 * Просмотр приложенных к заявке файлов. Показываем на странице только то,
 * что безопасно (картинки, PDF, текст, аудио и видео); остальное — Word,
 * PowerPoint, архивы — предлагаем скачать. Тип, написанный загрузившим,
 * не доверяем: он только выбирает из белого списка, а всё прочее
 * отдаётся как нейтральный бинарный файл.
 */
export default function FileViewer({ title, files, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const current = files[Math.min(idx, files.length - 1)];
  const info = useMemo(() => (current ? fileInfo(current.value) : null), [current]);
  const shown = info ? inlineMime(info.mime) : null;

  // Файл превращаем в blob-ссылку, а не вставляем data-URL в страницу:
  // так PDF открывается встроенным просмотрщиком браузера, а память
  // освобождается, когда окно закрыто.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!current || !info) { setUrl(null); return; }
    const blob = base64ToBlob(current.value, shown || 'application/octet-stream');
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [current, info, shown]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col p-2 sm:p-4" onClick={onClose}>
      <div className="flex items-center gap-2 pb-2 text-white" onClick={e => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{title}</div>
          {info && (
            <div className="text-[11px] opacity-70 truncate">
              {current.label ? `${current.label} · ` : ''}{info.name} · {formatSize(info.size)}
            </div>
          )}
        </div>
        {url && info && (
          <a href={url} download={info.name}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold">
            <Download className="w-3.5 h-3.5" /> Скачать
          </a>
        )}
        <button onClick={onClose} aria-label="Закрыть просмотр" className="shrink-0 p-1.5 rounded-lg hover:bg-white/15">
          <X className="w-5 h-5" />
        </button>
      </div>

      {files.length > 1 && (
        <div className="flex gap-1.5 pb-2 overflow-x-auto" onClick={e => e.stopPropagation()}>
          {files.map((f, i) => {
            const fi = fileInfo(f.value);
            return (
              <button key={i} onClick={() => setIdx(i)}
                className={`shrink-0 max-w-[14rem] truncate px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  i === idx ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                {f.label || fi?.name || `Файл ${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {!info || !url ? (
          <p className="text-sm text-slate-500 p-6 text-center">Файл повреждён и не открывается.</p>
        ) : shown?.startsWith('image/') ? (
          <img src={url} alt={info.name} className="max-w-full max-h-full object-contain" />
        ) : shown === 'application/pdf' ? (
          <iframe src={url} title={info.name} className="w-full h-full border-0" />
        ) : shown === 'text/plain' ? (
          <iframe src={url} title={info.name} sandbox="" className="w-full h-full border-0 bg-white" />
        ) : shown?.startsWith('audio/') ? (
          <audio src={url} controls className="w-full max-w-md" />
        ) : shown?.startsWith('video/') ? (
          <video src={url} controls className="max-w-full max-h-full" />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center text-slate-600">
            <FileText className="w-10 h-10 text-slate-400" />
            <div className="text-sm font-semibold break-all">{info.name}</div>
            <p className="text-xs text-slate-500 max-w-xs">
              Этот формат (Word, PowerPoint, архив и подобные) прямо на странице не показывается.
              Скачайте файл и откройте на своём устройстве.
            </p>
            <a href={url} download={info.name}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500">
              <Download className="w-4 h-4" /> Скачать
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
