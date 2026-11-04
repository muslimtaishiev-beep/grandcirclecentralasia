/**
 * Печатные документы экзамена: сертификат и отчёт ученика.
 *
 * Открываются в отдельном окне и печатаются браузером (A4, поля, PDF) — как
 * прежний сертификат среза. Всё, что раньше было зашито («Вступительный
 * срез», математика и английский, SAT), берётся из настроек экзамена и
 * реквизитов организации.
 */

export interface PrintResult {
  percent: number; earned: number; max: number; correct: number; total: number;
  sections: { title: string; earned: number; max: number; percent: number; correct: number; total: number }[];
  topics?: { topic: string; percent: number; earned: number; max: number }[];
  mark?: number | null; band?: number | null; scaleLabel?: string | null; group?: string | null; decision?: string | null;
  finishedAt?: number | null;
  /** Части оценки — каждая своим итогом; hideTotal — общий итог не печатаем. */
  parts?: { title: string; value: string }[];
  hideTotal?: boolean;
}
export interface PrintData {
  title: string;
  examTitle: string;
  student: { name: string; level?: string; shortId: string };
  orgName: string;
  logoUrl?: string | null;
  school?: { legalName?: string; signatoryTitle?: string; signatoryName?: string; stampUrl?: string | null } | null;
  photo?: string | null;
  result: PrintResult;
}

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (ms?: number | null) => new Date(ms || Date.now()).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
const n1 = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

const BASE_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f2f4; font-family: Georgia, "Times New Roman", serif; color: #14181f; }
  .sheet { width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff; padding: 18mm 16mm 14mm; position: relative; box-shadow: 0 2px 20px rgba(0,0,0,.15); }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .noprint { display: none !important; } }
  @media screen and (max-width: 820px) { html, body { overflow-x: hidden; } .sheet { zoom: .46; margin: 8px auto; } }
  .bar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #fff; border-bottom: 1px solid #ddd; font-family: system-ui, sans-serif; }
  .bar button { padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; font-size: 14px; cursor: pointer; }
  .bar button.primary { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 12mm; border-bottom: 3px double #14181f; padding-bottom: 8mm; }
  .head img.logo { max-height: 22mm; max-width: 70mm; object-fit: contain; }
  .org { font-size: 13pt; font-weight: bold; }
  .doctype { font-size: 9pt; color: #55606e; margin-top: 2mm; letter-spacing: .12em; text-transform: uppercase; }
  .refno { text-align: right; font-size: 9pt; color: #55606e; font-family: ui-monospace, monospace; white-space: nowrap; }
  h1 { font-size: 22pt; text-align: center; margin: 12mm 0 2mm; letter-spacing: .02em; }
  .sub { text-align: center; color: #55606e; font-size: 11pt; }
  .who { display: flex; gap: 8mm; align-items: center; margin: 10mm 0 6mm; }
  .who img { width: 30mm; height: 38mm; object-fit: cover; border: 1px solid #ccd; }
  .name { font-size: 18pt; font-weight: bold; }
  .meta { color: #55606e; font-size: 10.5pt; margin-top: 2mm; }
  .overall { display: flex; gap: 6mm; margin: 6mm 0; flex-wrap: wrap; }
  .tile { border: 1.5px solid #14181f; padding: 4mm 6mm; min-width: 34mm; text-align: center; }
  .tile b { display: block; font-size: 20pt; }
  .tile span { font-size: 8.5pt; color: #55606e; text-transform: uppercase; letter-spacing: .08em; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 11pt; }
  th { text-align: left; font-size: 8.5pt; color: #55606e; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1.5px solid #14181f; padding: 2mm 2mm; }
  td { padding: 2.5mm 2mm; border-bottom: 1px solid #dde; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar-cell { width: 40%; }
  .meter { height: 3mm; background: #e7eaf0; border-radius: 2mm; overflow: hidden; }
  .meter i { display: block; height: 100%; background: #1d4ed8; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16mm; font-size: 10.5pt; }
  .sign .line { border-top: 1px solid #14181f; width: 60mm; padding-top: 1.5mm; color: #55606e; font-size: 9pt; }
  .stamp { width: 36mm; height: 36mm; object-fit: contain; opacity: .9; }
  .foot { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; font-size: 8pt; color: #8a93a0; text-align: center; }
  h2 { font-size: 13pt; margin: 8mm 0 2mm; }
`;

function head(d: PrintData, doctype: string) {
  return `<div class="head">
    <div>${d.logoUrl ? `<img class="logo" src="${esc(d.logoUrl)}" alt="">` : `<div class="org">${esc(d.school?.legalName || d.orgName)}</div>`}
      <div class="doctype">${esc(doctype)}</div></div>
    <div class="refno">№ ${esc(d.student.shortId)}<br>${esc(fmtDate(d.result.finishedAt))}</div>
  </div>`;
}

function tiles(r: PrintResult) {
  const t: string[] = r.hideTotal ? [] : [`<div class="tile"><b>${n1(r.percent)}%</b><span>результат</span></div>`, `<div class="tile"><b>${n1(r.earned)} / ${n1(r.max)}</b><span>баллов</span></div>`];
  for (const p of r.parts || []) t.push(`<div class="tile"><b style="font-size:${p.value.length > 8 ? 13 : 17}pt">${esc(p.value)}</b><span>${esc(p.title)}</span></div>`);
  if (r.hideTotal) { if (r.group) t.push(`<div class="tile"><b style="font-size:15pt">${esc(r.group)}</b><span>группа</span></div>`); return `<div class="overall">${t.join("")}</div>`; }
  if (r.band != null) t.push(`<div class="tile"><b>${r.band.toFixed(1).replace(".", ",")}</b><span>балл 1–5</span></div>`);
  if (r.mark != null) t.push(`<div class="tile"><b>${r.mark}</b><span>отметка</span></div>`);
  if (r.scaleLabel) t.push(`<div class="tile"><b style="font-size:13pt">${esc(r.scaleLabel)}</b><span>уровень</span></div>`);
  if (r.group) t.push(`<div class="tile"><b style="font-size:15pt">${esc(r.group)}</b><span>группа</span></div>`);
  return `<div class="overall">${t.join("")}</div>`;
}

const meter = (p: number) => `<div class="meter"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;

function sectionsTable(r: PrintResult) {
  return `<table><thead><tr><th>Раздел</th><th class="num">Баллы</th><th class="num">Верных</th><th class="num">Процент</th><th class="bar-cell"></th></tr></thead><tbody>
    ${r.sections.map(s => `<tr><td>${esc(s.title)}</td><td class="num">${n1(s.earned)} / ${n1(s.max)}</td><td class="num">${s.correct} / ${s.total}</td><td class="num">${n1(s.percent)}%</td><td class="bar-cell">${meter(s.percent)}</td></tr>`).join("")}
  </tbody></table>`;
}

function signature(d: PrintData) {
  return `<div class="sign">
    <div><div class="line">${esc(d.school?.signatoryTitle || "Руководитель")}${d.school?.signatoryName ? ` · ${esc(d.school.signatoryName)}` : ""}</div></div>
    ${d.school?.stampUrl ? `<img class="stamp" src="${esc(d.school.stampUrl)}" alt="">` : ""}
  </div>`;
}

function page(title: string, body: string) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}</style></head>
  <body><div class="bar noprint"><button class="primary" onclick="window.print()">Печать / PDF</button><button onclick="window.close()">Закрыть</button></div>${body}</body></html>`;
}

export function certificateHTML(d: PrintData): string {
  return page(`${d.title} — ${d.student.name}`, `<div class="sheet">
    ${head(d, d.title)}
    <h1>${esc(d.title)}</h1>
    <div class="sub">${esc(d.examTitle)}</div>
    <div class="who">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : ""}
      <div><div class="name">${esc(d.student.name)}</div><div class="meta">${d.student.level ? `${esc(d.student.level)} · ` : ""}работа № ${esc(d.student.shortId)} · ${esc(fmtDate(d.result.finishedAt))}</div></div></div>
    ${tiles(d.result)}
    ${sectionsTable(d.result)}
    ${signature(d)}
    <div class="foot">Подлинность можно проверить у организации по номеру работы ${esc(d.student.shortId)}.</div>
  </div>`);
}

/** Отчёт по темам: сильные стороны и зона роста — прежний «Анализ работы». */
export function reportHTML(d: PrintData): string {
  const topics = (d.result.topics || []).filter(t => t.topic && t.topic !== "—");
  const weak = topics.filter(t => t.percent < 60);
  const strong = topics.filter(t => t.percent >= 80);
  const list = (xs: typeof topics) => xs.length ? `<ul>${xs.map(t => `<li>${esc(t.topic)} — ${n1(t.percent)}%</li>`).join("")}</ul>` : `<p class="meta">—</p>`;
  return page(`Отчёт — ${d.student.name}`, `<div class="sheet">
    ${head(d, "Отчёт о результатах")}
    <h1 style="font-size:18pt">${esc(d.examTitle)}</h1>
    <div class="who"><div><div class="name">${esc(d.student.name)}</div><div class="meta">${d.student.level ? `${esc(d.student.level)} · ` : ""}работа № ${esc(d.student.shortId)}</div></div></div>
    ${tiles(d.result)}
    ${d.result.decision ? `<p><b>Решение:</b> ${esc(d.result.decision)}</p>` : ""}
    <h2>По разделам</h2>${sectionsTable(d.result)}
    ${topics.length ? `<h2>По темам</h2><table><thead><tr><th>Тема</th><th class="num">Баллы</th><th class="num">Процент</th><th class="bar-cell"></th></tr></thead><tbody>
      ${topics.map(t => `<tr><td>${esc(t.topic)}</td><td class="num">${n1(t.earned)} / ${n1(t.max)}</td><td class="num">${n1(t.percent)}%</td><td class="bar-cell">${meter(t.percent)}</td></tr>`).join("")}</tbody></table>
      <div style="display:flex;gap:10mm"><div style="flex:1"><h2>Сильные стороны</h2>${list(strong)}</div><div style="flex:1"><h2>Зона роста</h2>${list(weak)}</div></div>` : ""}
    ${signature(d)}
  </div>`);
}

/** Открыть документ в новом окне. false — браузер заблокировал окно. */
export function openPrint(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
