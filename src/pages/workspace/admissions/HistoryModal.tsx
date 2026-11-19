import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Modal } from "../journals/components/ui";

/** Что произошло — подписи событий истории поступающего. */
export const AUDIT: Record<string, string> = {
  created: "Карточка создана", edited: "Изменена карточка", deleted: "Карточка удалена", viewed: "Открыл анкеты с данными о здоровье",
  parent_form_started: "Начата анкета родителя", parent_form: "Родитель заполнил анкету",
  form_started: "Начата сессия", form_done: "Анкета завершена", form_reopened: "Анкета открыта для правки", form_edited: "Изменена завершённая анкета",
  referral_issued: "Направлен на тест", referral_changed: "Направление изменено", referral_manual: "Направление выдано вручную", referral_revoked: "Направление снято",
  referral_emailed: "Направление отправлено на почту", email_sent: "Письмо отправлено", email_failed: "Письмо не ушло",
  test_started: "Начал тест", test_section: "Закончил часть теста", tested: "Тест сдан", attempt: "Работа",
  paper_results: "Внесены результаты на бумаге", paper_deleted: "Удалены результаты на бумаге",
  candidate: "Изменена анкета кандидата", decision: "Решение", feedback: "Обратная связь", relink: "Перевыпущен QR",
};

interface Entry { action: string; detail?: string; byName?: string; at: number; changes?: { label: string; from: string; to: string }[] }

export default function HistoryModal({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  const list = [...entries].sort((a, b) => b.at - a.at);
  return (
    <Modal title="История" onClose={onClose} wide>
      <ul className="text-sm divide-y divide-[var(--border-color)]">
        {list.map((x, k) => <Row key={k} x={x} />)}
        {!list.length && <li className="py-6 text-center text-[var(--text-muted)]">Пока пусто</li>}
      </ul>
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
