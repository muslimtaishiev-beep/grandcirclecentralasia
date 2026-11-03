import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import FancyQr, { QR_THEMES, QrThemePicker, downloadQr, type QrTheme } from "../../components/forms/FancyQr";
import { compressImageToDataUrl } from "../../lib/compressImage";
import { buildFileValue, checkFileValue, fileInfo, formatSize, isFileValue, FILE_LIMITS } from "../../shared/uploads";

/**
 * Публичная страница заявки — то, что открывается по ссылке из конструктора.
 *
 * Раньше конструктор давал ссылку /form/:id, а такого маршрута не было: она
 * вела в пустоту. Заполнить созданную форму было негде.
 *
 * Заявитель анонимен, поэтому и чтение формы, и отправка идут через сервер:
 * правила Firestore требуют доступа к тенанту, которого у человека с улицы
 * нет и быть не должно.
 */

type Field = {
  id: string; label: string; required: boolean;
  type: "text" | "textarea" | "select" | "file" | "date" | "number" | "checkbox";
  options?: string[]; placeholder?: string;
};
type Form = {
  id: string; title: string; description: string;
  fields: Field[]; qrTrackingEnabled: boolean;
  mode?: "application" | "ticket";
};
/** Организация и её тексты для публичных страниц — из настроек воркспейса. */
type Org = {
  id: string; name: string; logoUrl?: string | null; markUrl?: string | null; primaryColor?: string | null;
  tickets?: {
    publicTitle?: string; closedTitle?: string; closedMessage?: string;
    submitButtonLabel?: string; successTitle?: string; successMessage?: string;
    ticketWord?: string; supportPhone?: string;
  };
};

export default function PublicForm() {
  const { formId } = useParams<{ formId: string }>();

  const [form, setForm] = useState<Form | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ qrToken: string; trackUrl: string } | null>(null);
  const [theme, setTheme] = useState<QrTheme>(QR_THEMES[0]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/forms/public/${formId}`);
      const j = await res.json();
      if (j.org) setOrg(j.org);
      if (!j.success) {
        if (j.closed) setClosed(true);
        setError(j.error || "Форма недоступна.");
        return;
      }
      setForm(j.form);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет.");
    } finally { setLoading(false); }
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!form) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id, data: values }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось отправить заявку."); return; }
      setDone({ qrToken: j.qrToken, trackUrl: j.trackUrl });
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <Shell><div className="text-center text-slate-400 py-16">Загружаем форму…</div></Shell>;
  }

  if (closed || (!form && error)) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-3">{closed ? "🔒" : "🔍"}</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {closed ? (org?.tickets?.closedTitle || "Приём заявок закрыт") : "Форма не найдена"}
          </h1>
          <p className="text-slate-500 text-sm">{error}</p>
          {org?.tickets?.supportPhone && (
            <p className="text-slate-500 text-sm mt-2">Вопросы: <a className="text-blue-600" href={`tel:${org.tickets.supportPhone}`}>{org.tickets.supportPhone}</a></p>
          )}
        </div>
      </Shell>
    );
  }

  // Заявка отправлена: показываем код отслеживания.
  if (done && form) {
    const trackUrl = `${window.location.origin}${done.trackUrl}`;
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-7 pb-5 text-center border-b border-slate-100">
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{org?.tickets?.successTitle || "Заявка принята!"}</h1>
            <p className="text-slate-500 text-sm">
              {org?.tickets?.successMessage || (form.mode === "ticket"
                ? `Сохраните этот код. Как только заявку одобрят, на странице отслеживания появится ваш ${(org?.tickets?.ticketWord || "билет").toLowerCase()} с QR-кодом для входа.`
                : "Сохраните этот код — по нему вы в любой момент узнаете статус заявки.")}
            </p>
          </div>

          <div className="p-6 flex flex-col items-center gap-4">
            <FancyQr value={trackUrl} theme={theme} size={260} logo={org?.markUrl} />

            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Код заявки</div>
              <div className="font-mono text-2xl font-bold tracking-widest text-slate-900">{done.qrToken}</div>
            </div>

            <QrThemePicker value={theme.key} onChange={setTheme} />

            <div className="grid sm:grid-cols-2 gap-2 w-full pt-2">
              <button onClick={() => downloadQr(trackUrl, theme, `Заявка-${done.qrToken}.png`, 1024, org?.markUrl)}
                className="py-3 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800">
                Скачать код
              </button>
              <Link to={done.trackUrl}
                className="py-3 rounded-xl font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 text-center">
                Проверить статус
              </Link>
            </div>

            <button
              onClick={() => { navigator.clipboard?.writeText(trackUrl); }}
              className="text-sm text-blue-600 font-semibold">
              Скопировать ссылку на отслеживание
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!form) return <Shell><div className="text-center text-slate-400 py-16">Форма недоступна.</div></Shell>;

  const set = (id: string, v: any) => setValues(p => ({ ...p, [id]: v }));

  /**
   * Приложить файл к полю. Фото сжимаем до JPEG, как раньше, — снимок с
   * телефона весит мегабайты и в заявку не влезет. Остальное берём как есть,
   * но то же правило, что и на сервере, применяем сразу: человек должен
   * узнать про запрещённый формат или лишний вес до отправки.
   */
  const attachFile = async (fieldId: string, file: File, asPhoto: boolean) => {
    setError(null);
    try {
      const isImage = file.type.startsWith("image/") && file.type !== "image/svg+xml";
      let value = "";
      if (isImage && (asPhoto || file.size > 300 * 1024)) {
        const r = await compressImageToDataUrl(file);
        if ("error" in r) {
          if (asPhoto) { setError(r.error); return; }
        } else {
          const base = file.name.replace(/\.[^.]+$/, "") || "photo";
          value = buildFileValue("image/jpeg", `${base}.jpg`, r.dataUrl.slice(r.dataUrl.indexOf(",") + 1));
        }
      }
      if (!value) {
        if (file.size > FILE_LIMITS.maxFileKb * 1024) {
          setError(`Файл больше ${FILE_LIMITS.maxFileKb} КБ. Сожмите его или отправьте ссылкой (Google Drive, Canva) в текстовом поле.`);
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        value = buildFileValue(file.type || "application/octet-stream", file.name || "file", btoa(bin));
      }
      const check = checkFileValue(value);
      if (!check.ok) { setError(check.error || "Файл не подходит."); return; }
      const others = Object.entries(values).filter(([id, v]) => id !== fieldId && isFileValue(v)).reduce((n, [, v]) => n + String(v).length, 0);
      if (others + value.length > FILE_LIMITS.maxTotalChars) {
        setError(`Все файлы вместе больше ${FILE_LIMITS.maxFileKb} КБ. Приложите меньше или отправьте ссылкой.`);
        return;
      }
      set(fieldId, value);
    } catch {
      setError("Не удалось прочитать файл — попробуйте другой.");
    }
  };
  const base = "w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition";

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          {(org?.name || org?.tickets?.publicTitle) && (
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {org?.logoUrl && <img src={org.logoUrl} alt="" className="h-10 w-auto max-w-[180px] object-contain" />}
              <span>{org?.tickets?.publicTitle || org?.name}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{form.title}</h1>
          {form.description && <p className="text-slate-500 text-sm mt-1">{form.description}</p>}
        </div>

        <div className="p-6 grid gap-4">
          {form.fields.map(f => (
            <div key={f.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {f.label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {f.type === "textarea" ? (
                <textarea value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)}
                  placeholder={f.placeholder} rows={4} className={base} />
              ) : f.type === "select" ? (
                <select value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} className={base}>
                  <option value="">Выберите…</option>
                  {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={!!values[f.id]}
                    onChange={e => set(f.id, e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300" />
                  <span className="text-sm text-slate-600">{f.placeholder || "Да"}</span>
                </label>
              ) : f.type === "file" ? (
                values[f.id] ? (() => {
                  const info = fileInfo(String(values[f.id]));
                  const isImg = !!info && /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(info.mime);
                  return (
                    <div className="flex items-center gap-3">
                      {isImg ? (
                        <img src={values[f.id]} alt="Приложенный файл"
                          className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="flex items-center gap-2.5 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                          <span className="text-2xl">📎</span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{info?.name}</div>
                            <div className="text-xs text-slate-400">{info ? formatSize(info.size) : ""}</div>
                          </div>
                        </div>
                      )}
                      <button type="button" onClick={() => set(f.id, "")}
                        className="text-sm text-blue-600 font-semibold shrink-0">Заменить</button>
                    </div>
                  );
                })() : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition text-center">
                      <span className="text-2xl">📷</span>
                      <span className="text-sm font-semibold text-slate-700">Фото</span>
                      <span className="text-xs text-slate-400">Камера или галерея, сожмётся само</span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) await attachFile(f.id, file, true);
                        }} />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition text-center">
                      <span className="text-2xl">📎</span>
                      <span className="text-sm font-semibold text-slate-700">Файл</span>
                      <span className="text-xs text-slate-400">PDF, Word, PowerPoint, архив… до {FILE_LIMITS.maxFileKb} КБ</span>
                      <input type="file" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) await attachFile(f.id, file, false);
                        }} />
                    </label>
                  </div>
                )
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)}
                  placeholder={f.placeholder} className={base} />
              )}
            </div>
          ))}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}

          <button onClick={submit} disabled={busy}
            style={!busy && org?.primaryColor ? { backgroundColor: org.primaryColor } : undefined}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg ${
              busy ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
            {busy ? "Отправляем…" : (org?.tickets?.submitButtonLabel || "Отправить заявку")}
          </button>

          {form.qrTrackingEnabled && (
            <p className="text-xs text-slate-400 text-center">
              После отправки вы получите QR-код для отслеживания статуса заявки.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}
