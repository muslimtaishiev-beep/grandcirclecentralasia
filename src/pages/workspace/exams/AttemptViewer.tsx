import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Exam } from "../../../shared/examRun";
import { Modal } from "../journals/components/ui";
import { useExamApi } from "./examApi";
import AttemptModal, { AttemptPanel } from "./AttemptModal";

/**
 * Работа ученика (ответы, результат, прокторинг) — из любого места: из списка
 * поступающих, карточки, страницы «Сейчас». Сам подгружает экзамен работы.
 */
export default function AttemptViewer({ tenant, attemptId, examId, onClose, onChanged }: {
  tenant: any; attemptId: string; examId: string; onClose: () => void; onChanged?: () => void;
}) {
  const api = useExamApi(String(tenant?.id || ""), "exam-admin");
  const [exam, setExam] = useState<Exam | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api(`/exams/${examId}`).then(j => { setExam(j.exam); setCanEdit(!!j.canEdit); }).catch(e => setError(e.message));
  }, [api, examId]);
  if (!exam) return (
    <Modal title="Работа" onClose={onClose} xwide>
      {error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}
    </Modal>
  );
  return <AttemptModal attemptId={attemptId} exam={exam} api={api} tenant={tenant} canEdit={canEdit} onChanged={() => onChanged?.()} onClose={onClose} />;
}

/** Та же работа, но прямо на странице (вкладка «Тест и решение» карточки поступающего). */
export function AttemptInline({ tenant, attemptId, examId, onChanged, refreshKey }: { tenant: any; attemptId: string; examId: string; onChanged?: () => void; refreshKey?: unknown }) {
  const api = useExamApi(String(tenant?.id || ""), "exam-admin");
  const [exam, setExam] = useState<Exam | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api(`/exams/${examId}`).then(j => { setExam(j.exam); setCanEdit(!!j.canEdit); }).catch(e => setError(e.message));
  }, [api, examId]);
  if (!exam) return <div className="rounded-xl border border-[var(--border-color)] p-4">{error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}</div>;
  return <AttemptPanel embedded attemptId={attemptId} exam={exam} api={api} tenant={tenant} canEdit={canEdit} onChanged={() => onChanged?.()} refreshKey={refreshKey} />;
}
