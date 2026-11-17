import QRCode from "qrcode";
import { SCALES, answerText, itemVisible, normFor, normText, visibleSections, type QAnswers, type QAttachment, type QTemplate } from "../shared/questionnaires";

/**
 * Печать по приёму. На каждой бумаге — QR и № поступающего: любую бумагу
 * можно отсканировать и попасть к нужному ребёнку (сотрудник — в карточку,
 * ученик по направлению — в свой тест, родитель — в свою анкету).
 * На направлении — ни слова о здоровье: оно уходит из кабинета на руки.
 */
export interface PrintOrg { name: string; logoUrl?: string | null }
export interface PrintChild { refNo: number; name: string; grade: string; birthDate?: string }

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const no = (n: number) => `№ ${String(n).padStart(4, "0")}`;
const today = () => new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
export const linkUrl = (token: string, section?: string) => `${window.location.origin}/a/${token}${section ? `?s=${encodeURIComponent(section)}` : ""}`;
const qr = (value: string) => QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 360 });

const CSS = `
@page{size:A4;margin:14mm}
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11pt}
.sheet{page-break-after:always}.sheet:last-child{page-break-after:auto}
.head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
.head img.logo{height:42px;max-width:150px;object-fit:contain}.head .org{font-weight:700;font-size:12pt}
.head .who{flex:1}.head .who b{font-size:13pt}.head .meta{color:#444;font-size:9.5pt}
.head .qr{width:92px;height:92px}.head .no{font:700 14pt monospace;text-align:center}
h1{font-size:18pt;margin:6px 0 4px}h2{font-size:12.5pt;margin:14px 0 6px}
.big{display:flex;gap:22px;align-items:center;margin:16px 0}.big img{width:230px;height:230px}
.field{border-bottom:1px solid #999;min-height:22px;margin:6px 0 10px}
table{width:100%;border-collapse:collapse;font-size:9.5pt}td,th{border:1px solid #444;padding:4px 5px;vertical-align:top}th{background:#f1f1f1}
.box{display:inline-block;width:11px;height:11px;border:1px solid #111;margin-right:4px;vertical-align:-1px}
.hint{color:#555;font-size:9pt}.stim{width:100%;max-height:235mm;object-fit:contain}
.grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:52mm;border:1px solid #111}.grid div{border:1px solid #111}
.sign{margin-top:28px;display:flex;justify-content:space-between;font-size:10pt}
`;

async function head(org: PrintOrg, c: PrintChild, url: string, title: string) {
  const code = await qr(url);
  return `<div class="head">
    ${org.logoUrl ? `<img class="logo" src="${esc(org.logoUrl)}" alt="">` : `<div class="org">${esc(org.name)}</div>`}
    <div class="who"><div class="meta">${esc(title)}</div><b>${esc(c.name)}</b><div class="meta">Поступает в ${esc(c.grade)} класс${c.birthDate ? ` · дата рождения ${esc(new Date(c.birthDate).toLocaleDateString("ru-RU"))}` : ""}</div></div>
    <div><img class="qr" src="${code}" alt=""><div class="no">${no(c.refNo)}</div></div>
  </div>`;
}
const page = (title: string, body: string) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;

export function openHtml(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

/** Направление на тест: QR ведёт ученика в его тест (сотрудника — в карточку). */
export async function referralHTML(org: PrintOrg, c: PrintChild, o: { token: string; examTitle: string; psychName: string; outcome: string }) {
  const url = linkUrl(o.token);
  const big = await qr(url);
  return page(`Направление ${no(c.refNo)}`, `<div class="sheet">
    ${await head(org, c, url, "Направление на вступительное тестирование")}
    <h1>Направление на тестирование</h1>
    <p>Выдано: <b>${esc(c.name)}</b>, поступающему в ${esc(c.grade)} класс.</p>
    <p>Тест: <b>${esc(o.examTitle || `вступительный тест, ${c.grade} класс`)}</b></p>
    <p>Собеседование с психологом пройдено.</p>
    <div class="big"><img src="${big}" alt=""><div>
      <p><b>Как начать тест</b></p>
      <p>1. В аудитории отсканируйте этот код камерой телефона.</p>
      <p>2. Откроется ваш тест — имя и класс уже заполнены.</p>
      <p>3. Введите PIN, который назовёт организатор.</p>
      <p class="hint">Номер поступающего: <b>${no(c.refNo)}</b>. Не передавайте направление другим.</p>
    </div></div>
    <div class="sign"><span>Психолог: ${esc(o.psychName)} ______________</span><span>${esc(today())}</span></div>
  </div>`);
}

/** Приглашение родителю (QR на анкету онлайн) + бумажная анкета для тех, у кого нет телефона. */
export async function parentHTML(org: PrintOrg, c: PrintChild, o: { parentToken: string; cardToken: string; template: QTemplate }) {
  const url = linkUrl(o.parentToken);
  const big = await qr(url);
  const rows = o.template.sections.map(s => `<h2>${esc(s.title)}</h2>` + s.items.map(i => {
    if (i.kind === "multi" || i.kind === "choice") return `<div>${esc(i.label)}: ${(i.options || []).map(x => `<span class="box"></span>${esc(x.label)}`).join(" &nbsp; ")}</div><div class="field"></div>`;
    return `<div>${esc(i.label)}</div><div class="field"${i.kind === "longtext" ? ' style="min-height:48px"' : ""}></div>`;
  }).join("")).join("");
  return page(`Анкета для родителей ${no(c.refNo)}`, `<div class="sheet">
    ${await head(org, c, url, "Анкета для родителей")}
    <h1>${esc(o.template.title)}</h1>
    <p>${esc(o.template.description)}</p>
    <div class="big"><img src="${big}" alt=""><div>
      <p><b>Заполните анкету на телефоне</b></p>
      <p>Наведите камеру на код — откроется анкета вашего ребёнка. Это займёт 5 минут.</p>
      <p class="hint">Нет телефона под рукой — заполните бумажный вариант на следующей странице и отдайте психологу.</p>
    </div></div>
  </div><div class="sheet">
    ${await head(org, c, linkUrl(o.cardToken, "parent"), "Анкета для родителей (бумажный вариант)")}
    ${rows}
    ${o.template.consentText ? `<p class="hint" style="margin-top:14px"><span class="box"></span>${esc(o.template.consentText)}</p>` : ""}
    <div class="sign"><span>Подпись родителя ______________</span><span>Дата ____________</span></div>
  </div>`);
}

/** Бланк психолога для записей на сессии — под класс ребёнка, с QR карточки. */
export async function staffBlankHTML(org: PrintOrg, c: PrintChild, o: { cardToken: string; template: QTemplate; grade: number | null }) {
  const body = visibleSections(o.template, o.grade).map(s => {
    const ratings = s.items.filter(i => i.kind === "rating");
    const other = s.items.filter(i => i.kind !== "rating" && i.kind !== "note");
    const scale = SCALES[ratings[0]?.scale || "norm4"];
    const table = ratings.length ? `<table><tr><th style="width:34%">Показатель</th>${scale.map(x => `<th style="width:8%">${esc(x.short)}</th>`).join("")}<th>Результат, характер трудностей, помощь</th></tr>${ratings.map(i => `<tr><td>${esc(i.label)}${i.measures?.length ? `<div class="hint">${i.measures.map(m => `${esc(m.label)}: ____`).join("; ")}</div>` : ""}</td>${scale.map(() => `<td style="text-align:center"><span class="box"></span></td>`).join("")}<td></td></tr>`).join("")}</table>` : "";
    return `<h2>${esc(s.title)}</h2>${table}${other.map(i => `<div>${esc(i.label)}</div><div class="field"></div>`).join("")}`;
  }).join("");
  const outcome = o.template.outcome ? `<h2>${esc(o.template.outcome.label)}</h2>${o.template.outcome.options.map(x => `<p><span class="box"></span><b>${esc(x.label)}.</b> ${esc(x.description)}</p>`).join("")}` : "";
  return page(`${o.template.title} ${no(c.refNo)}`, `<div class="sheet">
    ${await head(org, c, linkUrl(o.cardToken, o.template.id), o.template.title)}
    <p class="meta">Дата: ____________ &nbsp; Специалист: ______________________</p>
    ${body}${outcome}
  </div>`);
}

/**
 * Бланк сессии, заполненный: те же графы, что на бумажном бланке, с
 * отметками, цифрами проб, комментариями и заключением. Его скачивает
 * администрация, чтобы не просить психолога печатать.
 */
export async function sessionSheet(org: PrintOrg, c: PrintChild, o: { cardToken: string; template: QTemplate; grade: number | null; answers: QAnswers; outcome: string | null; byName: string; at: number | null }) {
  const t = o.template;
  const body = visibleSections(t, o.grade).map(s => {
    const items = s.items.filter(i => itemVisible(i, o.grade));
    const ratings = items.filter(i => i.kind === "rating");
    const other = items.filter(i => i.kind !== "rating" && i.kind !== "note");
    const scale = SCALES[ratings[0]?.scale || "norm4"];
    const table = ratings.length ? `<table><tr><th style="width:30%">Показатель</th>${scale.map(x => `<th style="width:8%">${esc(x.short)}</th>`).join("")}<th>Результат, характер трудностей, помощь</th></tr>${ratings.map(i => {
      const a = o.answers[i.id];
      const m = (i.measures || []).filter(x => a?.measures?.[x.id] != null).map(x => `${esc(x.label)}: <b>${esc(a!.measures![x.id])}</b>${x.suffix ? ` ${esc(x.suffix)}` : ""}`).join("; ");
      const n = normFor(i, o.grade);
      return `<tr><td>${esc(i.label)}</td>${scale.map(x => `<td style="text-align:center;font-weight:700">${a?.rating === x.id ? "✓" : ""}</td>`).join("")}<td>${m ? `<div>${m}${n ? ` <span class="hint">(${esc(normText(n))})</span>` : ""}</div>` : ""}${a?.comment ? `<div>${esc(a.comment)}</div>` : ""}</td></tr>`;
    }).join("")}</table>` : "";
    const rest = other.map(i => { const v = answerText(i, o.answers[i.id]); return `<div style="margin:6px 0"><span class="hint">${esc(i.label)}</span><div>${v ? esc(v) : "—"}${o.answers[i.id]?.comment ? ` · ${esc(o.answers[i.id]!.comment)}` : ""}</div></div>`; }).join("");
    return `<h2>${esc(s.title)}</h2>${table}${rest}`;
  }).join("");
  const outcome = t.outcome ? `<h2>${esc(t.outcome.label)}</h2>${t.outcome.options.map(x => `<p>${x.id === o.outcome ? "☑" : "☐"} ${x.id === o.outcome ? `<b>${esc(x.label)}.</b>` : `${esc(x.label)}.`} <span class="hint">${esc(x.description)}</span></p>`).join("")}` : "";
  const date = o.at ? new Date(o.at).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }) : today();
  return `<div class="sheet">
    ${await head(org, c, linkUrl(o.cardToken, t.id), t.title)}
    <p class="meta">Дата: <b>${esc(date)}</b> &nbsp; Специалист: <b>${esc(o.byName)}</b></p>
    ${body}${outcome}
    <div class="sign"><span>Специалист: ${esc(o.byName)} ______________</span><span>${esc(date)}</span></div>
  </div>`;
}

/** Данные «Анкеты кандидата на поступление» — собираются из карточки, анкеты родителя и теста. */
export interface CandidateDoc {
  date: number | null;
  responsible: string;
  child: { name: string; birthDate: string; grade: string; school: string };
  refNo: number | null;
  /** Только для поступающих в 7 класс. */
  program: string;
  grades3: string; grades3Subjects: string;
  studentPhone: string; parentName: string; parentPhone: string;
  whySchool: string; source: string;
  stages: { consult: boolean; tested: boolean; feedback: boolean };
  subjects: { title: string; percent: number | null; band: 0 | 1 | 2 | null; own: string | null }[];
  overall: string;
  conclusion: string;
  feedback: string;
  decision: "enroll" | "trial" | "rejected" | "pending" | null;
  trialFrom: string; trialTo: string; klass: string; reviewDate: string;
  parentNotified: boolean | null; nextContact: string; decisionBy: string;
  /** QR ученика: до теста — тест, после — его результаты; сотруднику — карточка. */
  qrUrl: string | null;
}

const CAND_CSS = `
.cand{font-size:10pt;line-height:1.35}
.cand .top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.cand .top img.logo{height:46px;max-width:140px;object-fit:contain}
.cand .top .t{flex:1;text-align:center}.cand .top .t b{display:block;font-size:12.5pt;letter-spacing:.02em}
.cand .top .t span{display:block;font-weight:700;font-size:12pt;margin-top:4px}
.cand .top .q{text-align:center}.cand .top .q img{width:84px;height:84px}.cand .top .q div{font:700 11pt monospace}
.cand h3{font-size:10.5pt;margin:9px 0 2px;text-transform:uppercase}
.cand .ln{display:flex;flex-wrap:wrap;gap:2px 6px;align-items:flex-end;margin:3px 0;line-height:1.2}
.cand .ln .k{white-space:nowrap;padding-bottom:5px}.cand .ln .v{flex:1;min-width:60px;border-bottom:1px solid #777;min-height:20px;padding:0 4px 6px;font-weight:600}
.cand .ln .cb{padding-bottom:5px}.cand .hint{display:block;margin-bottom:6px}
.cand .row{display:flex;gap:16px}.cand .row>.ln{flex:1}
.cand .cb{white-space:nowrap;margin-right:6px}
.cand table{margin-top:4px}.cand td,.cand th{padding:4px 6px 10px;line-height:1.25}
.cand .box2{border:1px solid #777;min-height:60px;padding:6px 8px 10px;white-space:pre-wrap}
.cand .note{font-size:9pt;color:#444;margin-top:8px}
`;

/** «Анкета кандидата на поступление» — по бумажному бланку школы, заполненная системой. */
export async function candidateSheet(org: PrintOrg, d: CandidateDoc) {
  const cb = (on: boolean | null | undefined, label: string) => `<span class="cb">${on ? "☑" : "☐"} ${esc(label)}</span>`;
  const ln = (k: string, v: string, style = "") => `<div class="ln"${style ? ` style="${style}"` : ""}><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const dt = (v: string) => (v ? new Date(v).toLocaleDateString("ru-RU") : "");
  const qrImg = d.qrUrl ? await qr(d.qrUrl) : "";
  const levels = ["Низкий", "Средний", "Отличный"];
  const rows = d.subjects.map(x => `<tr><td>${esc(x.title)}</td><td style="text-align:center;font-weight:700">${x.percent == null ? "" : `${String(x.percent).replace(".", ",")} %`}</td>
    <td>${levels.map((l, i) => cb(x.band === i, l)).join("")}${x.own ? `<b> · ${esc(x.own)}</b>` : ""}</td></tr>`).join("");
  return `<div class="sheet cand"><style>${CAND_CSS}</style>
    <div class="top">
      ${org.logoUrl ? `<img class="logo" src="${esc(org.logoUrl)}" alt="">` : ""}
      <div class="t"><b>${esc(org.name.toUpperCase())}</b><span>АНКЕТА КАНДИДАТА НА ПОСТУПЛЕНИЕ</span></div>
      ${qrImg ? `<div class="q"><img src="${qrImg}" alt="">${d.refNo ? `<div>${no(d.refNo)}</div>` : ""}</div>` : ""}
    </div>
    <div class="row">${ln("Дата обращения:", d.date ? new Date(d.date).toLocaleDateString("ru-RU") : "")}${ln("Ответственный:", d.responsible)}</div>
    <h3>1. Сведения об ученике</h3>
    ${ln("ФИО ученика:", d.child.name)}
    <div class="row">${ln("Дата рождения:", dt(d.child.birthDate))}${ln("Класс поступления:", d.child.grade ? `${d.child.grade} класс` : "")}</div>
    ${ln("Школа:", d.child.school)}
    ${d.program || d.child.grade.trim().startsWith("7") ? `<div class="ln"><span class="k">Для 7-го класса:</span> ${cb(d.program === "11-летняя", "11-летняя программа")}${cb(d.program === "12-летняя", "12-летняя программа")}</div>` : ""}
    <div class="ln"><span class="k">Есть ли оценки «3» за четверть?</span> ${cb(d.grades3 === "Да", "Да")}${cb(d.grades3 === "Нет", "Нет")}<span class="k">Предметы:</span><span class="v">${esc(d.grades3Subjects)}</span></div>
    <div class="row">${ln("Телефон ученика:", d.studentPhone)}${ln("ФИО родителя:", d.parentName)}</div>
    ${ln("Телефон родителя:", d.parentPhone)}
    ${ln("Почему выбрали школу?", d.whySchool)}
    ${ln("Откуда узнали о школе?", d.source)}
    <h3>2. Этапы поступления</h3>
    <div class="ln"><span class="k">Консультация:</span> ${cb(d.stages.consult, "Проведена")}${cb(!d.stages.consult, "Нет")}
      <span class="k">Тестирование:</span> ${cb(d.stages.tested, "Пройдено")}${cb(!d.stages.tested, "Нет")}
      <span class="k">Обратная связь:</span> ${cb(d.stages.feedback, "Да")}${cb(!d.stages.feedback, "Нет")}</div>
    <h3>3. Результаты тестирования</h3>
    <table><tr><th style="width:34%">Предмет</th><th style="width:18%">Результат, %</th><th>Уровень</th></tr>${rows || `<tr><td colspan="3" class="hint">Тест ещё не сдан</td></tr>`}</table>
    ${ln("Общий результат / заключение:", [d.overall, d.conclusion].filter(Boolean).join(" — "), "margin-top:6px")}
    <h3>4. Обратная связь родителю / подробное примечание</h3>
    <div class="hint">Сильные и слабые стороны, рекомендации, условия пробного периода, предупреждения родителю:</div>
    <div class="box2">${esc(d.feedback)}</div>
    <h3>5. Решение по кандидату</h3>
    <div class="ln">${cb(d.decision === "enroll", "Зачисление рекомендовано")}${cb(d.decision === "trial", "Пробный период")}${cb(d.decision === "rejected", "Отказ")}${cb(d.decision === "pending", "На рассмотрении")}</div>
    <div class="row">${ln("Пробный период: с", dt(d.trialFrom))}${ln("по", dt(d.trialTo))}${ln("Класс:", d.klass)}</div>
    <div class="row">${ln("Дата повторного рассмотрения:", dt(d.reviewDate))}<div class="ln"><span class="k">Родитель уведомлён об условиях:</span> ${cb(d.parentNotified === true, "Да")}${cb(d.parentNotified === false, "Нет")}</div></div>
    <div class="row">${ln("Следующий контакт:", d.nextContact)}${ln("Ответственный:", d.decisionBy)}${ln("Подпись:", "")}</div>
    <div class="note">Примечание: решение о зачислении и условиях обучения оформляется отдельно.</div>
  </div>`;
}

/** Стили печати, ограниченные одним блоком — чтобы PDF собирался прямо на странице, не задевая её. */
const scopeCss = (css: string, root: string) => css.replace(/@page\{[^}]*\}/, "").replace(/(^|\})\s*([^{}]+)\{/g, (_m, close: string, sel: string) =>
  `${close}${sel.split(",").map(x => x.trim()).map(x => (x === "body" ? root : `${root} ${x}`)).join(",")}{`);
const scopedCss = (root: string) => CSS.replace(/@page\{[^}]*\}/, "").replace(/(^|\})\s*([^{}]+)\{/g, (_m, close: string, sel: string) =>
  `${close}${sel.split(",").map(x => x.trim()).map(x => (x === "body" ? root : `${root} ${x}`)).join(",")}{`);

/** Скачать листы файлом PDF (A4), без окна печати. */
export async function downloadPdf(sheets: string, filename: string) {
  const html2pdf = (await import("html2pdf.js")).default as any;
  const host = document.createElement("div");
  host.className = "adm-pdf";
  // В документ не вставляем: html2pdf сам кладёт копию в свой скрытый слой.
  host.style.cssText = "width:186mm;background:#fff;color:#111;line-height:1.35;padding-bottom:4mm";
  // html2canvas опускает текст к нижней границе ячейки — даём строкам воздух.
  host.innerHTML = `<style>${scopedCss(".adm-pdf")} .adm-pdf td,.adm-pdf th{line-height:1.3;padding:4px 6px 8px} .adm-pdf p{margin:4px 0}</style>${sheets}`;
  // У анкеты кандидата свои стили внутри листа — тоже только для этого блока.
  host.querySelectorAll("style").forEach((st, i) => { if (i > 0) st.textContent = scopeCss(st.textContent || "", ".adm-pdf"); });
  await html2pdf().set({
    margin: 12, filename, image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#fff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "h2", ".sign"] },
  }).from(host).save();
}

export const pdfName = (title: string, c: PrintChild) => `${title} — ${c.name} — ${no(c.refNo)}.pdf`.replace(/[\\/:*?"<>|]/g, " ");

/** Лист, который заполняет ребёнок: корректурная проба, бланк памяти. */
export async function sheetHTML(org: PrintOrg, c: PrintChild, o: { cardToken: string; attachment: QAttachment; templateId: string }) {
  const a = o.attachment;
  const content = a.url === "/admission/sheet/memory"
    ? `<p class="hint">Запиши или нарисуй всё, что запомнил.</p><div class="grid">${Array.from({ length: 12 }, () => "<div></div>").join("")}</div>`
    : `<img class="stim" src="${esc(new URL(a.url, window.location.origin).toString())}" alt="">`;
  return page(`${a.name} ${no(c.refNo)}`, `<div class="sheet">
    ${await head(org, c, linkUrl(o.cardToken, o.templateId), a.name)}
    ${content}
  </div>`);
}
