import { DECISION_LABEL, examAnalytics, type Attempt, type Exam } from "../../../shared/examRun";

/**
 * Результаты экзамена в Excel: строка на ученика, матрица ответов,
 * аналитика по вопросам и темам. exceljs — по нажатию.
 */
type Cell = string | number | null;

const STATUS: Record<Attempt["status"], string> = { in_progress: "Сдаёт", finished: "Сдано", annulled: "Аннулировано" };
const dt = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("ru-RU") : "");

export async function exportExamXlsx(exam: Exam, attempts: Attempt[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const add = (name: string, head: string[], rows: Cell[][], widths: number[] = []) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1, xSplit: name === "Ответы" ? 2 : 0 }] });
    ws.addRow(head);
    for (const r of rows) ws.addRow(r.map(v => (v == null ? "" : v)));
    const h = ws.getRow(1); h.font = { bold: true }; h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
    head.forEach((t, i) => { ws.getColumn(i + 1).width = widths[i] ?? Math.min(40, Math.max(8, t.length + 2)); });
    if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } };
    return ws;
  };
  const s = exam.settings;
  const list = attempts.filter(a => !a.superseded);

  add("Результаты", [
    "№ работы", "ФИО", ...(s.registration.phone ? ["Телефон"] : []), ...(s.registration.email ? ["Почта"] : []), ...(s.registration.level ? [s.registration.levelLabel] : []),
    "Статус", "Начало", "Окончание", "Минут", "Баллы", "Из", "%",
    ...exam.sections.map(x => `${x.title}, %`),
    ...(s.scoring.marks.enabled ? ["Отметка"] : []), ...(s.scoring.band ? ["Балл 1–5"] : []), ...(s.scoring.scale.length ? ["Уровень"] : []),
    ...(s.results.groups.length ? ["Группа"] : []), ...(s.results.decisions ? ["Решение", "Комментарий"] : []),
    "Проверка", "Опубликовано", ...(s.proctoring.enabled ? ["Индекс честности", "Грубых нарушений", "Всего нарушений"] : []),
  ], list.map(a => {
    const r = a.result;
    return [
      a.shortId, a.student.name, ...(s.registration.phone ? [a.student.phone] : []), ...(s.registration.email ? [a.student.email] : []), ...(s.registration.level ? [a.student.level] : []),
      STATUS[a.status], dt(a.startedAt), dt(a.finishedAt), a.finishedAt ? Math.round((a.finishedAt - a.startedAt) / 60000) : null,
      r?.earned ?? null, r?.max ?? null, r?.percent ?? null,
      ...exam.sections.map(x => r?.sections.find(y => y.id === x.id)?.percent ?? null),
      ...(s.scoring.marks.enabled ? [r?.mark ?? null] : []), ...(s.scoring.band ? [r?.band ?? null] : []), ...(s.scoring.scale.length ? [r?.scaleLabel ?? ""] : []),
      ...(s.results.groups.length ? [a.group || ""] : []), ...(s.results.decisions ? [a.decision ? DECISION_LABEL[a.decision.value] : "", a.decision?.comment || ""] : []),
      a.review?.status === "done" ? "проверено" : "", a.published ? "да" : "",
      ...(s.proctoring.enabled ? [a.proctoring?.unavailable ? "нет камеры" : a.proctoring?.honestyIndex ?? "", a.proctoring?.bySeverity?.HIGH ?? 0, a.proctoring?.totalViolations ?? 0] : []),
    ];
  }), [10, 28]);

  // Матрица ответов: столбец на вопрос, в ячейке ответ и отметка.
  const qids: string[] = [];
  for (const a of list) for (const it of a.result?.items || []) if (!qids.includes(it.qid)) qids.push(it.qid);
  qids.sort();
  add("Ответы", ["№ работы", "ФИО", ...qids], list.filter(a => a.result).map(a => {
    const m = new Map(a.result!.items.map(i => [i.qid, i]));
    return [a.shortId, a.student.name, ...qids.map(q => { const i = m.get(q); return i ? `${i.correct ? "✓" : i.earned > 0 ? "½" : "✗"} ${i.answer}`.trim() : null; })];
  }), [10, 28, ...qids.map(() => 16)]);

  const an = examAnalytics(list, s, Object.fromEntries(exam.sections.map(x => [x.id, x.title])));
  add("Вопросы", ["Вопрос", "Раздел", "Тема", "Отвечали", "Верно", "% верных", "Частые неверные ответы"],
    an.questions.map(q => [q.qid, exam.sections.find(x => x.id === q.sectionId)?.title || "", q.topic, q.asked, q.correct, q.percent, q.wrong.map(w => `${w.answer} (${w.count})`).join("; ")]),
    [12, 18, 30, 10, 8, 10, 60]);
  add("Темы", ["Тема", "Ответов", "Средний %"], an.topics.map(t => [t.topic, t.asked, t.avgPercent]), [40, 10, 12]);

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${exam.title.replace(/[\\/:*?"<>|]/g, " ")} — результаты ${new Date().toLocaleDateString("ru-RU")}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
