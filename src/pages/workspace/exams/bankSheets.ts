import { SHEET_COLUMNS, questionToSheetRow, type BankQuestion, type QuestionSet } from "../../../shared/exams";

/**
 * Банк вопросов ⇄ Excel. exceljs грузится только по нажатию — как в журналах.
 * Колонки — SHEET_COLUMNS из shared/exams: выгрузку можно поправить и
 * загрузить обратно.
 */

async function saveWorkbook(fill: (wb: any) => void, filename: string) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  fill(wb);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, " ");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const WIDTHS = [12, 11, 22, 10, 22, 10, 18, 7, 60, 26, 40, 30, 9, 30];

function bankSheet(wb: any, name: string, rows: string[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow([...SHEET_COLUMNS]);
  for (const r of rows) ws.addRow(r);
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getColumn(9).alignment = { wrapText: true, vertical: "top" };
  ws.getColumn(11).alignment = { wrapText: true, vertical: "top" };
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: SHEET_COLUMNS.length } };
  return ws;
}

export function exportBankXlsx(questions: BankQuestion[], title: string, sets: QuestionSet[] = []) {
  const names = new Map(sets.map(x => [x.id, x.name]));
  return saveWorkbook(wb => bankSheet(wb, "Вопросы", questions.map(q => questionToSheetRow(q, id => names.get(id) || id))), `${title} — ${new Date().toLocaleDateString("ru-RU")}.xlsx`);
}

/** Шаблон: пример на каждый простой тип и памятка. */
export function downloadTemplate(code = "MAT") {
  return saveWorkbook(wb => {
    bankSheet(wb, "Вопросы", [
      ["", code, "", "7;8", "Дроби", "1", "Выбор ответа", "1", "Сколько будет 1/2 + 1/4?", "", "1/4\n3/4\n2/6\n1", "3/4", "да", ""],
      ["", code, "", "7", "Уравнения", "2", "Ответ числом", "1", "Решите: 3x + 5 = 20", "", "", "5", "да", ""],
      ["", code, "", "", "Лексика", "1", "Ответ текстом", "1", "Как по-английски «яблоко»?", "", "", "apple||an apple", "да", ""],
      ["", code, "", "8", "Порядок", "2", "Упорядочить", "1", "Расположите числа по возрастанию", "", "5\n2\n9", "2,5,9", "да", ""],
    ]);
    const help = wb.addWorksheet("Памятка");
    help.getColumn(1).width = 26; help.getColumn(2).width = 90;
    [
      ["Колонка", "Что писать"],
      ["Номер", "Пусто — новый вопрос получит номер сам. КОД-0001 — обновить существующий вопрос."],
      ["Дисциплина", "Код дисциплины (MAT, ENG, LOG…). Неизвестный код можно создать при загрузке."],
      ["Наборы", "В какой набор банка входит вопрос (например «Вступительный 2026»). Несколько — через ;. Новый набор создастся при загрузке. Пусто — без набора."],
      ["Классы", "Через ; или запятую: 7;8. Пусто — вопрос подходит для всех."],
      ["Сложность", "1 — лёгкий, 2 — средний, 3 — сложный."],
      ["Тип", "Выбор ответа, Ответ текстом, Ответ числом, Упорядочить, Выбор в пропуске, Найти и исправить. Сложные типы удобнее создавать в редакторе."],
      ["Варианты", "Каждый вариант с новой строки (Alt+Enter в Excel) или через |. Для «Упорядочить» — элементы в любом порядке."],
      ["Правильный ответ", "Текст верного варианта или его буква (А, Б…). Несколько допустимых — через ||. Для «Упорядочить» — правильный порядок через запятую."],
      ["Данные (JSON)", "Разметка сложных типов. Заполняется при выгрузке — не меняйте, если не уверены."],
    ].forEach((r, i) => { const row = help.addRow(r); if (i === 0) row.font = { bold: true }; row.alignment = { wrapText: true, vertical: "top" }; });
  }, "Шаблон банка вопросов.xlsx");
}

/** Файл → заголовок и строки (xlsx через exceljs, csv/tsv — разбором). */
export async function readSheetFile(file: File): Promise<{ header: string[]; rows: string[][] }> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w: any) => /вопрос/i.test(w.name)) || wb.worksheets[0];
    const all: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      const vals: string[] = [];
      for (let c = 1; c <= Math.max(row.cellCount, SHEET_COLUMNS.length); c++) {
        const v = row.getCell(c).value;
        vals.push(v == null ? "" : typeof v === "object" ? (v.richText ? v.richText.map((t: any) => t.text).join("") : v.text ?? v.result ?? String(v)) : String(v));
      }
      all.push(vals);
    });
    return { header: all[0] || [], rows: all.slice(1) };
  }
  const text = (await file.text()).replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const delim = [";", "\t", ","].map(d => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === delim) { cur.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; cur.push(cell); rows.push(cur); cur = []; cell = ""; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  const nonEmpty = rows.filter(r => r.some(c => c.trim()));
  return { header: nonEmpty[0] || [], rows: nonEmpty.slice(1) };
}
