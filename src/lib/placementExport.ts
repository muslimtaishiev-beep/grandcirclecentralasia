import Papa from "papaparse";

/**
 * Выгрузки среза: список потока в таблицу и официальный протокол по ученику.
 *
 * The stream export is what the завуч hands to the admissions committee, so it
 * carries the decision alongside the score — a list of percentages without the
 * placement is not actionable. The per-student document is a printable record
 * with the topic breakdown, which is what a parent asking "why this class?"
 * needs to be shown.
 */

export interface PlacementResult {
  id: string; shortId: string; grade: number;
  studentName: string; studentPhone?: string; studentEmail?: string;
  correct: number; total: number; percent: number;
  recommendation: string; finalDecision?: string; approved?: boolean;
  superseded?: boolean; retakeReason?: string;
  sections?: {
    key: string; title: string; correct: number; total: number; percent: number;
    byTopic?: Record<string, { correct: number; total: number }>;
    byDifficulty?: Record<string, { correct: number; total: number }>;
  }[];
  startedAt?: any; finishedAt?: any;
}

/**
 * A cell that begins with =, +, - or @ is executed as a formula when the file
 * is opened in Excel. Prefixing with an apostrophe keeps the text readable and
 * inert — the same guard the manager dashboard's export uses.
 */
function safeCell(value: unknown): string {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const asDate = (v: any): string => {
  try {
    const d = v?.toDate ? v.toDate() : v?._seconds ? new Date(v._seconds * 1000) : v ? new Date(v) : null;
    return d ? d.toLocaleString("ru-RU") : "";
  } catch { return ""; }
};

const sectionOf = (r: PlacementResult, key: string) =>
  (r.sections || []).find(s => s.key === key);

/** Таблица по потоку — то, что уходит в приёмную комиссию. */
export function exportStreamCSV(results: PlacementResult[], gradeFilter?: number): void {
  const rows = results
    .filter(r => !r.superseded)
    .filter(r => !gradeFilter || Number(r.grade) === gradeFilter)
    .sort((a, b) => Number(a.grade) - Number(b.grade) || b.percent - a.percent)
    .map(r => {
      const math = sectionOf(r, "math");
      const eng = sectionOf(r, "english");
      return {
        "Класс поступления": r.grade,
        "Ученик": safeCell(r.studentName),
        "ID": safeCell(r.shortId),
        "Телефон": safeCell(r.studentPhone || ""),
        "E-mail": safeCell(r.studentEmail || ""),
        "Математика": math ? `${math.correct}/${math.total}` : "",
        "Английский": eng ? `${eng.correct}/${eng.total}` : "",
        "Всего баллов": `${r.correct}/${r.total}`,
        "Процент": r.percent,
        "Расчёт системы": safeCell(r.recommendation),
        "Решение школы": safeCell(r.finalDecision || ""),
        "Утверждено": r.approved ? "да" : "нет",
        "Экзамен завершён": asDate(r.finishedAt),
      };
    });

  // A BOM keeps Cyrillic readable when Excel opens the file by double-click.
  const csv = Papa.unparse(rows, { delimiter: ";" });
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Срез_знаний_${gradeFilter ? gradeFilter + "класс_" : "поток_"}${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Протокол по одному ученику — открывается в отдельном окне, печатается в PDF. */
export function openStudentReport(r: PlacementResult, schoolName = ""): boolean {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;

  const topicRows = (r.sections || []).flatMap(s =>
    Object.entries(s.byTopic || {}).map(([topic, v]) => {
      const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
      return `<tr>
        <td>${esc(s.title)}</td>
        <td>${esc(topic)}</td>
        <td class="mono">${v.correct} / ${v.total}</td>
        <td class="mono">${pct}%</td>
        <td><div class="bar"><i style="width:${pct}%;background:${
          pct >= 70 ? "#2f7a4d" : pct >= 45 ? "#b4801f" : "#b03a35"}"></i></div></td>
      </tr>`;
    }));

  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <title>Протокол среза ${esc(r.shortId)} — ${esc(r.studentName)}</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #14181f; margin: 0; }
      h1 { font-size: 18px; text-transform: uppercase; letter-spacing: .04em;
           border-bottom: 2px solid #14181f; padding-bottom: 10px; margin-bottom: 6px; }
      .sub { color: #6b7280; font-size: 12px; margin: 0 0 22px; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280;
           margin: 22px 0 8px; }
      .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 32px; font-size: 13px; }
      .facts div { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f1f3; padding: 4px 0; }
      .facts span:first-child { color: #6b7280; }
      .score { border: 1px solid #d8dbe0; border-radius: 6px; padding: 14px 18px; display: flex;
               align-items: baseline; gap: 14px; }
      .score b { font-size: 30px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; border-bottom: 2px solid #cbd0d6; padding: 6px 10px 6px 0; color: #6b7280;
           font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
      td { border-bottom: 1px solid #f0f1f3; padding: 6px 10px 6px 0; vertical-align: middle; }
      tr { page-break-inside: avoid; }
      .mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
      .bar { width: 110px; height: 8px; background: #eef0f3; border-radius: 4px; overflow: hidden; }
      .bar i { display: block; height: 100%; border-radius: 4px; }
      .verdict { border: 1px solid #d8dbe0; background: #fafbfc; border-radius: 6px; padding: 12px 16px; font-size: 13px; }
      .sign { margin-top: 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 12px; color: #6b7280; }
      .sign div { border-top: 1px solid #b8bdc4; padding-top: 6px; }
      footer { margin-top: 26px; font-size: 11px; color: #9aa0a8; border-top: 1px solid #eef0f3; padding-top: 8px; }
    </style></head><body>
    <h1>Протокол вступительного среза знаний</h1>
    <p class="sub">${esc(schoolName)}${schoolName ? " · " : ""}сформирован ${new Date().toLocaleString("ru-RU")}</p>

    <h2>Сведения об экзаменуемом</h2>
    <div class="facts">
      <div><span>Фамилия и имя</span><span><b>${esc(r.studentName)}</b></span></div>
      <div><span>Идентификатор</span><span class="mono">${esc(r.shortId)}</span></div>
      <div><span>Класс поступления</span><span>${esc(r.grade)}</span></div>
      <div><span>Телефон</span><span>${esc(r.studentPhone || "—")}</span></div>
      <div><span>Экзамен начат</span><span>${esc(asDate(r.startedAt) || "—")}</span></div>
      <div><span>Экзамен завершён</span><span>${esc(asDate(r.finishedAt) || "—")}</span></div>
    </div>

    <h2>Результат</h2>
    <div class="score">
      <b>${r.percent}%</b>
      <span>${r.correct} правильных из ${r.total}</span>
    </div>

    ${(r.sections || []).length ? `<h2>По разделам</h2>
    <table><thead><tr><th>Раздел</th><th>Верно</th><th>Процент</th></tr></thead><tbody>
      ${(r.sections || []).map(s => `<tr>
        <td>${esc(s.title)}</td>
        <td class="mono">${s.correct} / ${s.total}</td>
        <td class="mono">${s.percent}%</td></tr>`).join("")}
    </tbody></table>` : ""}

    ${topicRows.length ? `<h2>По темам</h2>
    <table><thead><tr><th>Раздел</th><th>Тема</th><th>Верно</th><th>%</th><th></th></tr></thead>
    <tbody>${topicRows.join("")}</tbody></table>` : ""}

    <h2>Заключение</h2>
    <div class="verdict">
      Расчёт системы по установленной шкале: <b>${esc(r.recommendation)}</b>.
      ${r.finalDecision && r.finalDecision !== r.recommendation
        ? `<br>Решение школы: <b>${esc(r.finalDecision)}</b>.`
        : r.approved ? "<br>Решение утверждено школой." : "<br>Решение школы не утверждено на момент формирования протокола."}
      ${r.retakeReason ? `<br>Отметка о пересдаче: ${esc(r.retakeReason)}` : ""}
    </div>

    <div class="sign">
      <div>Завуч / председатель комиссии</div>
      <div>Дата, подпись</div>
    </div>

    <footer>Протокол сформирован автоматически по результатам вступительного среза знаний.
      Баллы рассчитаны системой; решение о зачислении принимает учебное заведение.</footer>
    </body></html>`);
  w.document.close();
  // Give the layout a beat before the print dialog, or it opens over a blank page.
  w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 350);
  return true;
}
