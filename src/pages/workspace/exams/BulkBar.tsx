import React, { useState } from "react";
import { Ban, Clock, EyeOff, Mail, MoreHorizontal, RefreshCw, Square, Trash2, X } from "lucide-react";
import { Button, Modal, confirmDialog, toast } from "../../../components/ui";
import { input } from "../../../components/ui";
import type { Api } from "./examApi";
import { PublishWhenModal, SplitPublishButton } from "../admissions/PublishControls";

/** Массовое действие над работами; итог — одним уведомлением. Возвращает true, если хоть что-то выполнено. */
export async function runBulk(api: Api, ids: string[], action: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const j = await api("/attempts-bulk", { method: "POST", body: JSON.stringify({ ids, action, ...extra }) });
    if (j.errors?.length) toast.error(`Выполнено: ${j.ok}, не удалось: ${j.errors.length} — ${j.errors[0].error}`);
    else toast.success(`Готово: ${j.ok}`);
    return j.ok > 0;
  } catch (e: any) { toast.error(e.message); return false; }
}

/** Панель над таблицей работ: появляется, когда отмечены строки. */
export default function BulkBar({ api, ids, canReview, canManage, onDone, onClear, readyMail }: {
  api: Api; ids: string[]; canReview: boolean; canManage: boolean; onDone: () => void; onClear: () => void;
  /** Есть экзамены со страницей результатов — в «Ещё» появляется отправка письма «Результаты готовы». */
  readyMail?: boolean;
}) {
  const [more, setMore] = useState(false);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  if (!ids.length) return null;
  const go = async (action: string, extra: Record<string, unknown> = {}, ask?: Parameters<typeof confirmDialog>[0]) => {
    if (ask && !(await confirmDialog(ask))) return;
    setBusy(true);
    const ok = await runBulk(api, ids, action, extra);
    setBusy(false);
    if (ok) { onClear(); onDone(); }
  };
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--bg-surface)] px-3 py-2 shadow">
      <span className="text-sm font-semibold text-[var(--text-main)] mr-1">Выбрано: {ids.length}</span>
      {canReview && <>
        <SplitPublishButton text="Опубликовать" loading={busy} onNow={() => void go("publish")} onSchedule={() => setPick(true)} />
        <Button size="sm" disabled={busy} icon={<EyeOff className="w-3.5 h-3.5" />} onClick={() => go("unpublish")}>Снять публикацию</Button>
        <Button size="sm" disabled={busy} icon={<Square className="w-3.5 h-3.5" />} onClick={() => go("finish", {}, { title: `Досдать работы: ${ids.length}?`, message: "Идущие работы завершатся с текущими ответами", confirmLabel: "Досдать" })}>Досдать</Button>
        {[5, 10].map(m => <Button key={m} size="sm" disabled={busy} icon={<Clock className="w-3.5 h-3.5" />} onClick={() => go("extend", { minutes: m })}>+{m} мин</Button>)}
        <Button size="sm" disabled={busy} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => go("recheck")}>Перепроверить</Button>
        {readyMail && (
          <div className="relative">
            <Button size="sm" variant="ghost" disabled={busy} aria-label="Ещё" aria-expanded={more} icon={<MoreHorizontal className="w-4 h-4" />} onClick={() => setMore(v => !v)} />
            {more && (
              <div className="absolute left-0 top-full mt-1 z-20 min-w-[240px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg p-1">
                <button type="button" className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm rounded-lg text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]" onClick={() => { setMore(false); void go("send_ready"); }}><Mail className="w-4 h-4" /> Отправить «Результаты готовы»</button>
              </div>
            )}
          </div>
        )}
      </>}
      {canManage && <>
        <Button size="sm" variant="secondary" disabled={busy} icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setReason("")}>Аннулировать</Button>
        <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => go("delete", {}, { title: `Убрать работы в корзину: ${ids.length}?`, message: "Их можно вернуть из корзины", confirmLabel: "В корзину", danger: true })}>В корзину</Button>
      </>}
      <button className="ml-auto p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]" title="Снять выбор" onClick={onClear}><X className="w-4 h-4" /></button>
      {pick && <PublishWhenModal title={`Запланировать публикацию: ${ids.length}`} onClose={() => setPick(false)} onPick={async at => { setPick(false); setBusy(true); const ok = await runBulk(api, ids, "publish", { at }); setBusy(false); if (ok) { onClear(); onDone(); } }} />}
      {reason !== null && (
        <Modal title={`Аннулировать работы: ${ids.length}`} onClose={() => setReason(null)}>
          <div className="space-y-3">
            <input className={input} autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Причина (увидят менеджеры)" />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setReason(null)}>Отмена</Button>
              <Button variant="danger" onClick={() => { const r = reason; setReason(null); void go("annul", { reason: r }); }}>Аннулировать</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
