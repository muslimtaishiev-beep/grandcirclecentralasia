import React, { useEffect, useState } from "react";
import { EmptyState, Spinner, Table } from "../../../components/ui";
import type { Api } from "./examApi";

interface HistoryRow { id: string; action: string; detail: string; attemptId: string | null; at: number; by: { uid: string; name: string } }

/** История экзамена и его работ: кто, когда и что изменил. */
export default function HistoryTab({ api, examId }: { api: Api; examId: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api(`/exams/${examId}/history`).then(j => setRows(j.rows)).catch(e => setError(e.message)); }, [api, examId]);
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!rows) return <div className="py-12 flex justify-center"><Spinner /></div>;
  if (!rows.length) return <EmptyState title="Записей пока нет" />;
  return (
    <Table minWidth={560}>
      <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Подробности</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{new Date(r.at).toLocaleString("ru-RU")}</td>
            <td className="text-xs">{r.by?.name || "—"}</td>
            <td className="font-medium">{r.action}{r.attemptId ? <span className="text-[var(--text-muted)] font-normal"> · работа</span> : ""}</td>
            <td className="text-xs text-[var(--text-muted)]">{r.detail}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
