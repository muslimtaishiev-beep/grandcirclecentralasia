import QRCode from "qrcode";
import { SCALES, visibleSections, type QAttachment, type QTemplate } from "../shared/questionnaires";

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
