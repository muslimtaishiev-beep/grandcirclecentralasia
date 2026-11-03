import {
  computeStats, displayValue, entryStatus, leaderboard, noShowLabel, STATUS_LABEL, todayIso,
  type Journal, type JournalEntry, type StatRow,
} from "../../../shared/journals";

/**
 * Выгрузка журнала в Excel (.xlsx).
 *
 * exceljs грузится только по нажатию «Скачать»: библиотека весит около
 * мегабайта, а нужна она редко. Всё считается теми же функциями, что и
 * экран статистики, — цифры в файле и на экране совпадают.
 */
type Cell = string | number | null;
type Sheet = { name: string; head: string[]; rows: Cell[][]; widths?: number[] };

/** Имя листа: Excel запрещает []:*?/\ и длину больше 31. */
const sheetName = (s: string, used: Set<string>) => {
  let n = s.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Лист";
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${n.slice(0, 27)} (${i})`;
  used.add(n.toLowerCase());
  return n;
};

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, " ").trim();
const ruDate = (iso: string) => { const [y, m, d] = iso.split("-"); return d ? `${d}.${m}.${y}` : iso; };

async function download(sheets: Sheet[], filename: string) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const used = new Set<string>();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sheetName(sh.name, used), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(sh.head);
    for (const r of sh.rows) ws.addRow(r.map(v => (v === null || v === undefined ? "" : v)));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
    head.alignment = { vertical: "middle", wrapText: true };
    sh.head.forEach((h, i) => {
      const longest = Math.max(h.length, ...sh.rows.slice(0, 500).map(r => String(r[i] ?? "").length));
      ws.getColumn(i + 1).width = sh.widths?.[i] ?? Math.min(48, Math.max(8, longest + 2));
    });
    if (sh.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.head.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${fileSafe(filename)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Записи как в таблице журнала — то, что сейчас отобрано фильтрами. */
function entriesSheet(j: Journal, entries: JournalEntry[], name = "Записи", today = todayIso()): Sheet {
  const cols = j.columns;
  const person = cols.find(c => c.id === j.settings.personColumnId);
  const groupOf = new Map((person?.options || []).map(o => [o.label, o.group || ""]));
  const withGroup = !!person && groupOf.size > 0 && [...groupOf.values()].some(Boolean);
  const head: string[] = [];
  for (const c of cols) {
    head.push(c.label);
    if (withGroup && c.id === person!.id) head.push("Класс / группа");
  }
  head.push("Статус", "Создано", "Кто внёс");
  const rows = entries.map(e => {
    const r: Cell[] = [];
    for (const c of cols) {
      const v = e.values?.[c.id];
      if (c.type === "qr_sign") r.push(v?.signedAt ? `подписано ${new Date(v.signedAt).toLocaleString("ru-RU")}` : "");
      else if (c.type === "name_sign") r.push(v?.name ? `${v.name}, ${new Date(v.at).toLocaleString("ru-RU")}` : "");
      else if (c.type === "number" && typeof v === "number") r.push(v);
      else r.push(displayValue(c, v));
      if (withGroup && c.id === person!.id) r.push(groupOf.get(String(v ?? "")) || "");
    }
    r.push(STATUS_LABEL[entryStatus(j, e, today)], new Date(e.createdAt).toLocaleString("ru-RU"), e.createdByName || "");
    return r;
  });
  return { name, head, rows };
}

export function exportEntriesXlsx(j: Journal, entries: JournalEntry[], filtered: boolean) {
  return download([entriesSheet(j, entries)], `${j.title}${filtered ? " (отбор)" : ""} — ${new Date().toLocaleDateString("ru-RU")}`);
}

/**
 * Статистика: сводка, лидерборд не отработанных, должники поимённо,
 * разбивки по группам, колонкам-спискам и месяцам — каждый срез на своём листе.
 */
export function exportStatsXlsx(j: Journal, entries: JournalEntry[], period: { from?: string; to?: string }) {
  const today = todayIso();
  const s = computeStats(j, entries, today);
  const lb = leaderboard(j, entries, today);
  const person = j.columns.find(c => c.id === j.settings.personColumnId);
  const who = person?.label || "Кто";
  const noShow = noShowLabel(j);
  const hasNoShow = j.columns.some(c => c.type === "checkbox");
  const periodText = period.from || period.to
    ? `${period.from ? `с ${ruDate(period.from)}` : ""}${period.to ? ` по ${ruDate(period.to)}` : ""}`.trim()
    : "за всё время";

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const sheets: Sheet[] = [{
    name: "Сводка",
    head: ["Показатель", "Значение"],
    widths: [42, 22],
    rows: [
      ["Журнал", j.title],
      ["Период", periodText],
      ["Выгружено", new Date().toLocaleString("ru-RU")],
      ["Всего записей", s.total],
      ["Закрыто (отработано)", s.done],
      ["Не закрыто", s.open + s.overdue],
      ["  из них просрочено", s.overdue],
      ["Доля закрытых, %", pct(s.done, s.total)],
      [`Разных: ${who.toLowerCase()}`, s.people.length],
      [`С незакрытыми записями: ${who.toLowerCase()}`, lb.filter(r => r.unfinished > 0).length],
      ...s.signatures.map(x => [`${x.column.label}: подписано / нет`, `${x.signed} / ${x.unsigned}`] as Cell[]),
    ],
  }];

  if (lb.length) {
    const debtors = lb.filter(r => r.unfinished > 0 || r.noShow > 0);
    sheets.push({
      name: "Лидерборд не отработанных",
      head: ["Место", who, "Класс / группа", "Не отработано", "Просрочено", ...(hasNoShow ? [noShow] : []), "Всего записей", "Отработано", "Последняя запись"],
      rows: debtors.map((r, i) => [i + 1, r.person, r.group, r.unfinished, r.overdue, ...(hasNoShow ? [r.noShow] : []), r.total, r.done, r.lastDate ? ruDate(r.lastDate) : ""]),
    });
    sheets.push({
      name: `${who} — все`,
      head: [who, "Класс / группа", "Всего записей", "Отработано", "Не отработано", "Просрочено", ...(hasNoShow ? [noShow] : [])],
      rows: [...lb].sort((a, b) => b.total - a.total || a.person.localeCompare(b.person, "ru"))
        .map(r => [r.person, r.group, r.total, r.done, r.unfinished, r.overdue, ...(hasNoShow ? [r.noShow] : [])]),
    });
  }

  const open = entries.filter(e => entryStatus(j, e, today) !== "done");
  if (open.length) sheets.push(entriesSheet(j, open, "Не отработано — записи", today));

  const breakdown = (name: string, head: string, rows: StatRow[]): Sheet => ({
    name, head: [head, "Всего", "Отработано", "Не отработано", "Просрочено", "Доля закрытых, %"],
    rows: rows.map(r => [r.label, r.total, r.done, r.open + r.overdue, r.overdue, pct(r.done, r.total)]),
  });
  if (s.byGroup.length) sheets.push(breakdown("По классам", "Класс / группа", s.byGroup));
  // «Не заполнено» — отдельной строкой: сколько записей ещё ждут, например,
  // вида отработки от завуча.
  for (const b of s.byColumn) {
    if (!b.rows.length && !b.empty) continue;
    const sh = breakdown(b.column.label, b.column.label, b.rows);
    if (b.empty) sh.rows.push(["(не заполнено)", b.empty, null, null, null, null]);
    sheets.push(sh);
  }
  if (s.signers.length) sheets.push(breakdown("Кто подписывал", "Подписал", s.signers));
  if (s.byMonth.length) sheets.push(breakdown("По месяцам", "Месяц", s.byMonth.map(r => ({ ...r, label: r.label.split("-").reverse().join(".") }))));

  return download(sheets, `${j.title} — статистика ${periodText} — ${new Date().toLocaleDateString("ru-RU")}`);
}
