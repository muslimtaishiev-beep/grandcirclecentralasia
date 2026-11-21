import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Modal } from "../journals/components/ui";
import { Button, Spinner, toast } from "../../../components/ui";
import type { Api } from "./admissionApi";

/** Что произошло — подписи событий истории поступающего и раздела. */
export const AUDIT: Record<string, string> = {
  created: "Карточка создана", edited: "Изменена карточка", deleted: "Карточка удалена навсегда", archived: "Карточка убрана в архив", restored: "Карточка возвращена из архива",
  viewed: "Открыл анкеты с данными о здоровье",
  intake: "Ученик дополнил сведения перед тестом", parent_form_started: "Начата анкета родителя", parent_form: "Родитель заполнил анкету", parent_form_reset: "Анкета родителя очищена и выдана заново", published: "Результаты опубликованы", unpublished: "Публикация результатов снята", publish_scheduled: "Публикация запланирована", publish_cancelled: "Запланированная публикация отменена",
  form_started: "Начата анкета", form_done: "Анкета завершена", form_reopened: "Анкета открыта для правки", form_edited: "Изменена завершённая анкета", form_reset: "Анкета сброшена",
  referral_issued: "Направлен на тест", referral_changed: "Направление изменено", referral_manual: "Направление выдано вручную", referral_revoked: "Направление снято", referral_restored: "Направление возвращено",
  referral_emailed: "Направление отправлено на почту", email_sent: "Письмо отправлено", email_failed: "Письмо не ушло",
  test_started: "Начал тест", test_section: "Закончил часть теста", tested: "Тест сдан", attempt: "Работа",
  paper_results: "Внесены результаты на бумаге", paper_deleted: "Удалены результаты на бумаге",
  candidate: "Изменена анкета кандидата", decision: "Решение", feedback: "Обратная связь", relink: "Перевыпущен QR",
  template_created: "Создана анкета", template_edited: "Изменена анкета", template_copied: "Анкета скопирована", template_archived: "Анкета убрана в архив", template_restored: "Анкета возвращена из архива", template_deleted: "Анкета удалена",
  candidate_form_edited: "Изменён вид анкеты кандидата", settings_edited: "Изменены письма родителю",
};

const KINDS: [string, string][] = [["", "Все"], ["forms", "Анкеты"], ["referral", "Направление"], ["test", "Тест"], ["decision", "Решение"], ["email", "Письма"], ["card", "Карточка"], ["views", "Просмотры"]];
interface Entry { action: string; detail?: string; byName?: string; at: number; changes?: { label: string; from: string; to: string }[] }

/** История: по 100 записей, «Ещё» подгружает прежние; scope «section» — история раздела (анкеты, удаления). */
export default function HistoryModal({ api, applicantId, scope = "card", onClose }: { api: Api; applicantId?: string; scope?: "card" | "section"; onClose: () => void }) {
  const [list, setList] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const base = scope === "section" ? "/history" : `/applicants/${applicantId}/history`;
  const load = useCallback(async (before?: number, k = kind) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (before) q.set("before", String(before));
      if (k && scope === "card") q.set("kind", k);
      const j = await api(`${base}${q.size ? `?${q}` : ""}`);
      setList(prev => (before ? [...prev, ...j.items] : j.items)); setMore(!!j.more);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, [api, base, kind, scope]);
  useEffect(() => { void load(undefined, kind); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal title={scope === "section" ? "История раздела" : "История"} onClose={onClose} wide>
      {scope === "card" && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${kind === k ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)]"}`}>{l}</button>)}
        </div>
      )}
      <ul className="text-sm divide-y divide-[var(--border-color)]">
        {list.map((x, k) => <Row key={`${x.at}_${k}`} x={x} />)}
        {!list.length && !loading && <li className="py-6 text-center text-[var(--text-muted)]">Пока пусто</li>}
      </ul>
      {loading && <Spinner />}
      {more && !loading && <div className="pt-3 flex justify-center"><Button onClick={() => void load(list[list.length - 1]?.at)}>Ещё</Button></div>}
    </Modal>
  );
}

function Row({ x }: { x: Entry }) {
  const [open, setOpen] = useState(false);
  const n = x.changes?.length || 0;
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">{new Date(x.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        <span className="flex-1 min-w-0 text-[var(--text-main)]">
          <b className="font-semibold">{AUDIT[x.action] || x.action}</b>{x.detail ? <span className="text-[var(--text-muted)]"> · {x.detail}</span> : null}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{x.byName}</span>
      </div>
      {n > 0 && (
        <>
          <button type="button" onClick={() => setOpen(v => !v)} className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> Изменения · {n}
          </button>
          {open && (
            <ul className="mt-1.5 space-y-1 rounded-lg bg-[var(--bg-surface-hover)] p-2">
              {x.changes!.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium text-[var(--text-main)]">{c.label}:</span>{" "}
                  <span className="line-through text-[var(--text-muted)]">{c.from || "—"}</span>{" → "}
                  <span className="text-[var(--text-main)]">{c.to || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
