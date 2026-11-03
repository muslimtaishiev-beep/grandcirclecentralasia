import React, { useEffect, useMemo, useState } from "react";
import { Loader2, QrCode, Camera, Trash2, PenLine, History, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import {
  entryStatus, isPhotoValue, STATUS_LABEL, todayIso,
  type Journal, type JournalColumn, type JournalEntry, type JournalRole, type QrSignature,
} from "../../../../shared/journals";
import { photoToValue } from "../journalApi";
import { Modal, OptionPicker, TriToggle, btn, btnPrimary, input, label } from "./ui";

type Api = (path: string, init?: RequestInit) => Promise<any>;

/**
 * Карточка записи: создание и дозаполнение.
 *
 * Запись живёт долго: классный руководитель вносит нарушение утром, завуч
 * на обеде назначает вид отработки, ученик подписывает по QR после
 * отработки, куратор — в конце дня. Поэтому любое поле можно заполнить
 * или исправить позже, а каждая правка попадает в историю.
 */
export default function EntryPanel({
  journal, role, entry, api, onSaved, onClose, onShowQr,
}: {
  journal: Journal;
  role: JournalRole;
  entry: JournalEntry | null;
  api: Api;
  onSaved: (entries: JournalEntry[]) => void;
  onClose: () => void;
  onShowQr: (entry: JournalEntry, column: JournalColumn) => void;
}) {
  const creating = !entry;
  const personCol = journal.columns.find(c => c.id === journal.settings.personColumnId && c.type === "select");
  const [full, setFull] = useState<JournalEntry | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [people, setPeople] = useState<string[]>([]);
  const [signName, setSignName] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (creating) {
      const d: Record<string, any> = {};
      for (const c of journal.columns) if (c.type === "date" && c.defaultToday) d[c.id] = todayIso();
      setDraft(d);
      return;
    }
    let live = true;
    api(`/${journal.id}/entries/${entry!.id}`)
      .then(j => { if (live) { setFull(j.entry); setDraft({ ...j.entry.values }); } })
      .catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [api, creating, entry, journal]);

  const current = full || entry;
  const canEdit = (c: JournalColumn) => role !== "view" && (!c.managersOnly || role === "manage");
  const set = (id: string, v: any) => setDraft(p => ({ ...p, [id]: v }));

  const changed = useMemo(() => {
    const out: Record<string, any> = {};
    for (const c of journal.columns) {
      if (c.type === "qr_sign" || c.type === "name_sign") continue;
      if (creating && personCol && c.id === personCol.id) continue;
      const before = creating ? undefined : current?.values?.[c.id];
      const after = draft[c.id];
      if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) out[c.id] = after ?? null;
    }
    return out;
  }, [draft, current, journal.columns, creating, personCol]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (creating) {
        const names = personCol ? people : [];
        if (personCol && !names.length) throw new Error(`Выберите: «${personCol.label}»`);
        const signs: Record<string, string> = {};
        for (const [k, v] of Object.entries(signName)) if (v.trim()) signs[k] = v.trim();
        const base = { ...changed, ...signs };
        const list = personCol ? names.map(n => ({ values: { ...base, [personCol.id]: n } })) : [{ values: base }];
        const j = await api(`/${journal.id}/entries`, { method: "POST", body: JSON.stringify({ entries: list }) });
        onSaved(j.entries);
        onClose();
      } else {
        if (!Object.keys(changed).length) { onClose(); return; }
        const j = await api(`/${journal.id}/entries/${entry!.id}`, { method: "PATCH", body: JSON.stringify({ values: changed }) });
        onSaved([j.entry]);
        onClose();
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  /** Подпись по имени и отмена подписи — сразу, отдельным запросом: сервер сверяет имя. */
  const patchNow = async (values: Record<string, any>) => {
    if (!entry) return;
    setBusy(true); setError(null);
    try {
      const j = await api(`/${journal.id}/entries/${entry.id}`, { method: "PATCH", body: JSON.stringify({ values }) });
      const fresh = await api(`/${journal.id}/entries/${entry.id}`);
      setFull(fresh.entry);
      setDraft(d => ({ ...d, ...Object.fromEntries(Object.keys(values).map(k => [k, fresh.entry.values[k]])) }));
      setSignName({});
      onSaved([j.entry]);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const attach = async (id: string, f: File | undefined) => {
    if (!f) return;
    const r = await photoToValue(f);
    if ("error" in r) setError(r.error); else set(id, r.value);
  };

  const field = (c: JournalColumn) => {
    const v = draft[c.id];
    const locked = !canEdit(c);
    switch (c.type) {
      case "select":
        if (creating && personCol && c.id === personCol.id) {
          return (
            <>
              <OptionPicker options={c.options || []} multiple values={people} onChangeMany={setPeople} placeholder="Поиск по имени или классу…" />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Можно выбрать несколько — создастся по записи на каждого. Введите класс, чтобы добавить его целиком.</p>
            </>
          );
        }
        return <OptionPicker options={c.options || []} value={v || null} onChange={x => set(c.id, x)} disabled={locked} />;
      case "date":
        return <input type="date" className={input} value={v || ""} onChange={e => set(c.id, e.target.value || null)} disabled={locked} />;
      case "number":
        return <input type="number" className={input} value={v ?? ""} onChange={e => set(c.id, e.target.value === "" ? null : Number(e.target.value))} disabled={locked} />;
      case "text":
        return <textarea rows={2} className={input} value={v || ""} onChange={e => set(c.id, e.target.value || null)} disabled={locked} />;
      case "checkbox":
        return <TriToggle value={v} yes={c.yesLabel || "Да"} no={c.noLabel || "Нет"} onChange={x => set(c.id, x)} disabled={locked} />;
      case "photo":
        return (
          <div className="flex items-center gap-3">
            {isPhotoValue(v) && <a href={v} target="_blank" rel="noreferrer"><img src={v} alt="" className="h-20 w-20 object-cover rounded-lg border border-[var(--border-color)]" /></a>}
            {v?.photo && !isPhotoValue(v) && <span className="text-xs text-[var(--text-muted)]">Загрузка фото…</span>}
            {!locked && (
              <label className={btn}>
                <Camera className="w-4 h-4" /> {v ? "Заменить" : "Сфотографировать"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => attach(c.id, e.target.files?.[0])} />
              </label>
            )}
            {!locked && v && <button type="button" className={btn} onClick={() => set(c.id, null)}><Trash2 className="w-4 h-4" /></button>}
          </div>
        );
      case "name_sign": {
        const sig = current?.values?.[c.id];
        if (sig?.name) {
          return (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium"><ShieldCheck className="w-4 h-4" /> {sig.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{new Date(sig.at).toLocaleString("ru-RU")} · ввёл(а) {sig.byName}</span>
              {!creating && canEdit(c) && <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => patchNow({ [c.id]: null })}>Снять подпись</button>}
            </div>
          );
        }
        if (locked) return <span className="text-sm text-[var(--text-muted)]">Не подписано</span>;
        return (
          <div className="flex gap-2">
            <input className={input} placeholder="Фамилия и имя" value={signName[c.id] || ""} onChange={e => setSignName(p => ({ ...p, [c.id]: e.target.value }))} />
            {!creating && <button type="button" className={btnPrimary} disabled={busy || !signName[c.id]?.trim()} onClick={() => patchNow({ [c.id]: signName[c.id] })}><PenLine className="w-4 h-4" /> Подписать</button>}
          </div>
        );
      }
      case "qr_sign": {
        const sig = current?.values?.[c.id] as (QrSignature & { changedAfter?: boolean }) | undefined;
        if (sig?.signedAt) return <SignatureDetails column={c} sig={sig} canCancel={role === "manage"} onCancel={() => patchNow({ [c.id]: null })} />;
        if (creating) return <span className="text-sm text-[var(--text-muted)]">QR для подписи появится после сохранения записи</span>;
        if (locked) return <span className="text-sm text-[var(--text-muted)]">Не подписано</span>;
        return <button type="button" className={btn} onClick={() => current && onShowQr(current, c)}><QrCode className="w-4 h-4" /> Показать QR для подписи</button>;
      }
    }
  };

  const status = current ? entryStatus(journal, { values: { ...current.values, ...draft } }) : null;

  return (
    <Modal title={creating ? "Новая запись" : "Запись журнала"} onClose={onClose} wide>
      {!creating && !full && !error && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>}
      {(creating || full) && (
        <div className="space-y-4">
          {status && (
            <div className="text-xs text-[var(--text-muted)]">
              Статус: <b className={status === "done" ? "text-emerald-600" : status === "overdue" ? "text-rose-600" : "text-amber-600"}>{STATUS_LABEL[status]}</b>
              {current && <> · создал(а) {current.createdByName} {new Date(current.createdAt).toLocaleString("ru-RU")}</>}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {journal.columns.map(c => (
              <div key={c.id} className={["text", "qr_sign", "name_sign", "photo"].includes(c.type) || (creating && c.id === personCol?.id) ? "sm:col-span-2" : ""}>
                <span className={label}>
                  {c.label}
                  {c.managersOnly && <Lock className="inline w-3 h-3 ml-1 -mt-0.5" aria-label="только ответственный" />}
                </span>
                {field(c)}
                {c.hint && <p className="text-[11px] text-[var(--text-muted)] mt-1">{c.hint}</p>}
              </div>
            ))}
          </div>

          {error && <div className="text-sm text-rose-600 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button className={btn} onClick={onClose}>Закрыть</button>
            {role !== "view" && (
              <button className={btnPrimary} onClick={save} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? (people.length > 1 ? `Создать ${people.length} записей` : "Создать запись") : "Сохранить"}
              </button>
            )}
          </div>

          {full?.changes && full.changes.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--text-muted)] flex items-center gap-1.5"><History className="w-4 h-4" /> История изменений ({full.changes.length})</summary>
              <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                {[...full.changes].reverse().map((h, i) => {
                  const c = journal.columns.find(x => x.id === h.columnId);
                  return (
                    <li key={i} className="text-xs text-[var(--text-muted)]">
                      <span className="tabular-nums">{new Date(h.at).toLocaleString("ru-RU")}</span> · {h.byName} · <b className="text-[var(--text-main)]">{c?.label || h.columnId}</b>: {h.from || "—"} → {h.to || "—"}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      )}
      {!creating && !full && error && <div className="text-sm text-rose-600">{error}</div>}
    </Modal>
  );
}

/** Подпись по QR со всем, что о ней известно. */
export function SignatureDetails({ column, sig, canCancel, onCancel }: {
  column: JournalColumn; sig: QrSignature & { changedAfter?: boolean }; canCancel?: boolean; onCancel?: () => void;
}) {
  const m = sig.meta || ({} as QrSignature["meta"]);
  const device = useMemo(() => {
    const ua = m.userAgent || "";
    const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : "";
    const br = /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
    return [os, br].filter(Boolean).join(", ") || ua.slice(0, 60);
  }, [m.userAgent]);
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm space-y-1.5">
      <div className="flex items-center gap-1.5 text-emerald-600 font-semibold"><ShieldCheck className="w-4 h-4" /> Подписано {new Date(sig.signedAt).toLocaleString("ru-RU")}</div>
      {sig.changedAfter && (
        <div className="flex items-center gap-1.5 text-amber-600 text-xs"><AlertTriangle className="w-3.5 h-3.5" /> Запись меняли после подписи — проверьте историю изменений</div>
      )}
      {(column.subfields || []).map(s => {
        const a = sig.answers?.[s.id];
        if (a === undefined || a === "") return null;
        return (
          <div key={s.id} className="text-xs">
            <span className="text-[var(--text-muted)]">{s.label}: </span>
            {s.type === "checkbox" ? (a ? "✓ да" : "нет")
              : s.type === "photo" ? (isPhotoValue(a) ? <a href={a as string} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">открыть фото</a> : "фото приложено")
              : <b>{String(a)}</b>}
          </div>
        );
      })}
      <div className="text-[11px] text-[var(--text-muted)] grid sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span>Устройство: {device || "—"}</span>
        <span>IP: {m.ip || "—"}</span>
        <span>Часовой пояс: {m.timezone || "—"}</span>
        <span>Экран: {m.screen || "—"}{m.touch ? ", сенсорный" : ""}</span>
        <span>QR выдал(а): {m.issuedByName || "—"}</span>
        <span>QR выдан: {m.issuedAt ? new Date(m.issuedAt).toLocaleString("ru-RU") : "—"}</span>
        <span className="sm:col-span-2 font-mono">Отпечаток записи: {m.entryHash || "—"}</span>
      </div>
      {canCancel && onCancel && (
        <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => { if (confirm(`Отменить подпись «${column.label}»? Понадобится подписать заново.`)) onCancel(); }}>Отменить подпись</button>
      )}
    </div>
  );
}
