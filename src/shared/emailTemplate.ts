/**
 * Шаблоны писем организации: админ собирает письмо (логотип, фото,
 * заголовок, текст, кнопка), а платформа шлёт его сама — после направления,
 * теста или отправки формы. Один и тот же renderEmail рисует письмо и в
 * «телефоне» редактора, и в настоящей отправке.
 *
 * Текст — простой: пустая строка — новый абзац, **так** — жирный. HTML не
 * принимается: всё экранируется, подстановки тоже.
 */

export type EmailLogo = "org" | "custom" | "none";

export interface EmailTemplate {
  id?: string;
  tenantId?: string;
  name: string;
  subject: string;
  title: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  logo: EmailLogo;
  logoUrl: string;
  imageUrl: string;
  footer: string;
  color: string;
  /** Для какого письма шаблон: от этого — какие подстановки сработают и где его можно выбрать. */
  kind: EmailKind;
  updatedAt?: number;
}

export const EMPTY_EMAIL_TEMPLATE: EmailTemplate = {
  name: "", subject: "", title: "", body: "", buttonText: "", buttonUrl: "{{ссылка}}",
  logo: "org", logoUrl: "", imageUrl: "", footer: "", color: "#4f46e5", kind: "any",
};

/** События, после которых уходят письма. */
export type EmailEvent = "referral" | "tested" | "form" | "parent_form" | "decision" | "results_ready";
/** Все события писем — для списков и журнала. */
export const EMAIL_EVENTS: EmailEvent[] = ["referral", "tested", "form", "parent_form", "decision", "results_ready"];
export type EmailKind = EmailEvent | "any";

export const EMAIL_KINDS: { id: EmailKind; label: string }[] = [
  { id: "referral", label: "Направление" },
  { id: "tested", label: "После теста" },
  { id: "form", label: "Заявка" },
  { id: "parent_form", label: "Анкета родителю" },
  { id: "decision", label: "Решение по поступающему" },
  { id: "results_ready", label: "Результаты готовы" },
  { id: "any", label: "Любое" },
];

/**
 * Подстановка: откуда берётся в каждом письме. Нет события в from — в этом
 * письме подстановка останется пустой.
 */
export interface EmailVar { key: string; sample: string; from: Partial<Record<EmailEvent, string>> }

export const EMAIL_VARS: EmailVar[] = [
  { key: "имя", sample: "Айгуль Асанова", from: { results_ready: "ФИО родителя из карточки", parent_form: "ФИО родителя из карточки", decision: "ФИО родителя из карточки", referral: "ФИО родителя из карточки", tested: "Родитель поступающего или ученик из регистрации", form: "ФИО из заявки" } },
  { key: "ребёнок", sample: "Асанов Тимур", from: { results_ready: "ФИО ребёнка из карточки", parent_form: "ФИО ребёнка из карточки", decision: "ФИО ребёнка из карточки", referral: "ФИО ребёнка из карточки", tested: "ФИО ребёнка (поступающие)" } },
  { key: "класс", sample: "5", from: { results_ready: "Класс поступления", parent_form: "Класс поступления", decision: "Класс поступления", referral: "Класс поступления", tested: "Класс поступления (поступающие)" } },
  { key: "экзамен", sample: "Вступительный экзамен, 5 класс", from: { results_ready: "Название экзамена", referral: "Экзамен направления", tested: "Название экзамена" } },
  { key: "код", sample: "482913", from: { referral: "Код входа на экзамен" } },
  { key: "балл", sample: "42 из 50", from: { tested: "Только если результат открыт ученику сразу" } },
  { key: "процент", sample: "84%", from: { tested: "Только если результат открыт ученику сразу" } },
  { key: "номер", sample: "1047", from: { tested: "Номер работы — для поиска результата" } },
  { key: "решение", sample: "Принят", from: { decision: "Решение из анкеты кандидата" } },
  { key: "обратная_связь", sample: "Сильные стороны…", from: { decision: "Обратная связь из анкеты кандидата" } },
  { key: "форма", sample: "Регистрация на форум", from: { form: "Название формы" } },
  { key: "статус", sample: "Одобрено", from: { form: "Новое состояние заявки" } },
  { key: "этап", sample: "Распределение по форумам", from: { form: "Этап заявки, который опубликовали" } },
  { key: "отметки", sample: "Первый форум, Второй форум", from: { form: "Отметки организаторов на этапе" } },
  { key: "комментарий", sample: "Ждём вас на встрече в пятницу.", from: { form: "Комментарий организаторов на этапе (пусто — абзац не показывается)" } },
  { key: "ссылка", sample: "https://www.studyfreeforum.com/a/demo", from: { results_ready: "Страница результатов по ссылке", parent_form: "Анкета родителя по ссылке", decision: "Направление с результатами (после обратной связи)", referral: "Направление с QR", tested: "Направление (поступающие) или страница результата", form: "Билет с QR (если включён)" } },
  { key: "организация", sample: "Ваша организация", from: { results_ready: "Название организации", parent_form: "Название организации", decision: "Название организации", referral: "Название организации", tested: "Название организации", form: "Название организации" } },
];

/** Встроенное письмо «Результаты готовы» — уходит, если в экзамене не выбран свой шаблон. */
export const DEFAULT_RESULTS_READY: EmailTemplate = {
  ...EMPTY_EMAIL_TEMPLATE, name: "Результаты готовы", kind: "results_ready",
  subject: "Результаты {{ребёнок}} готовы",
  title: "Результаты готовы",
  body: "Здравствуйте, {{имя}}!\n\nРезультаты экзамена **{{ребёнок}}** готовы. Откройте страницу, чтобы посмотреть их.",
  buttonText: "Открыть результаты", buttonUrl: "{{ссылка}}",
};

/** Встроенное письмо о смене состояния заявки — уходит, если у состояния не выбран свой шаблон. */
export const DEFAULT_FORM_STATUS: EmailTemplate = {
  ...EMPTY_EMAIL_TEMPLATE, name: "Состояние заявки", kind: "form",
  subject: "{{форма}}: {{статус}}",
  title: "{{статус}}",
  body: "Здравствуйте, {{имя}}!\n\nПо вашей заявке **{{форма}}** новое состояние: **{{статус}}**.",
  buttonText: "Открыть заявку", buttonUrl: "{{ссылка}}",
};

/** Название подстановки на кнопке — по смыслу в этом письме. */
export function varLabel(key: string, kind: EmailKind): string {
  if (key === "имя") return kind === "referral" ? "Родитель" : kind === "form" ? "ФИО из заявки" : "Имя получателя";
  if (key === "ссылка" && kind === "parent_form") return "Ссылка на анкету";
  if (key === "ссылка") return kind === "results_ready" ? "Ссылка на результаты" : kind === "referral" || kind === "decision" ? "Ссылка на направление" : kind === "tested" ? "Ссылка на результат" : kind === "form" ? "Ссылка на билет" : "Ссылка";
  return ({ ребёнок: "Ребёнок", класс: "Класс", экзамен: "Экзамен", код: "Код экзамена", балл: "Балл", процент: "Процент", номер: "Номер работы", форма: "Название формы", организация: "Организация", решение: "Решение", обратная_связь: "Обратная связь", этап: "Этап", отметки: "Отметки организаторов", комментарий: "Комментарий организаторов" } as Record<string, string>)[key] || key;
}

/** Подстановки, которые сработают в письме этого типа. */
export const varsFor = (kind: EmailKind): EmailVar[] => (kind === "any" ? EMAIL_VARS : EMAIL_VARS.filter(v => v.from[kind]));

/** {{…}} в тексте шаблона, которые в письме этого типа останутся пустыми. */
export function unknownVars(tpl: Pick<EmailTemplate, "subject" | "title" | "body" | "buttonText" | "buttonUrl" | "footer">, kind: EmailKind): string[] {
  const ok = new Set(varsFor(kind).map(v => v.key));
  const all = [tpl.subject, tpl.title, tpl.body, tpl.buttonText, tpl.buttonUrl, tpl.footer].join(" ").matchAll(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g);
  return [...new Set([...all].map(m => m[1]).filter(k => !ok.has(k)))];
}

export const sampleVars = (): Record<string, string> => Object.fromEntries(EMAIL_VARS.map(v => [v.key, v.sample]));

/** О чём письмо — по этим полям его переотправляют. */
export interface EmailCtx { applicantId?: string; attemptId?: string; examId?: string; submissionId?: string; formId?: string; statusId?: string; stepId?: string; label?: string }

/** Запись журнала отправок события. */
export const emailLogId = (event: EmailEvent, refId: string) => `${event}_${refId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 300);

/** Наш путь картинок шаблонов — его можно ставить без https. */
export const EMAIL_IMG_PREFIX = "/api/email-templates/img/";

const str = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
const line = (v: unknown, max: number) => str(v, max).replace(/\n/g, " ").trim();

/** Картинка: https-ссылка или файл из нашего хранилища шаблонов. */
export function cleanImg(v: unknown): string {
  const s = line(v, 500);
  if (s.startsWith(EMAIL_IMG_PREFIX) && /^[A-Za-z0-9_\/.-]+$/.test(s) && !s.includes("..")) return s;
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

/** Ссылка кнопки: https-адрес или подстановка {{…}} (проверяется после подстановки). */
function cleanButtonUrl(v: unknown): string {
  const s = line(v, 500);
  if (/^\{\{[^{}]{1,30}\}\}$/.test(s)) return s;
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

export function sanitizeEmailTemplate(raw: unknown): EmailTemplate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const logo: EmailLogo = r.logo === "custom" || r.logo === "none" ? r.logo : "org";
  return {
    name: line(r.name, 80),
    subject: line(r.subject, 200),
    title: line(r.title, 200),
    body: str(r.body, 5000).trim(),
    buttonText: line(r.buttonText, 60),
    buttonUrl: cleanButtonUrl(r.buttonUrl),
    logo,
    logoUrl: cleanImg(r.logoUrl),
    imageUrl: cleanImg(r.imageUrl),
    footer: str(r.footer, 500).trim(),
    color: /^#[0-9a-fA-F]{6}$/.test(String(r.color || "")) ? String(r.color) : EMPTY_EMAIL_TEMPLATE.color,
    kind: EMAIL_KINDS.some(k => k.id === r.kind) ? (r.kind as EmailKind) : "any",
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Подставить {{ключ}} в простой текст (без HTML). Неизвестное — пусто. */
export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/**
 * Абзац, где есть подстановки и все они пустые, не выводится: строка
 * «Комментарий организаторов: {{комментарий}}» исчезает, когда комментария нет.
 */
export function dropEmptyParagraphs(text: string, vars: Record<string, string>): string {
  return text.split(/\n{2,}/).filter(p => {
    const keys = [...p.matchAll(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g)].map(m => m[1]);
    return !keys.length || keys.some(k => String(vars[k] ?? "").trim());
  }).join("\n\n");
}

/** Текст → безопасный HTML: экранирование, подстановки, **жирный**, абзацы. */
function richText(text: string, vars: Record<string, string>, style: string): string {
  const html = esc(fillVars(dropEmptyParagraphs(text, vars), vars)).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  return html.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="${style}">${p.replace(/\n/g, "<br>")}</p>`).join("");
}

const absolute = (u: string, base: string) => (u.startsWith("/") ? `${base.replace(/\/+$/, "")}${u}` : u);

export interface EmailOrg { name: string; logoUrl: string | null; signature?: string }

/**
 * Письмо целиком. base — адрес сайта для наших картинок (в письме нужны
 * полные ссылки). Кнопка рисуется, только если после подстановки ссылка
 * — настоящий https-адрес.
 */
export function renderEmail(tpl: EmailTemplate, vars: Record<string, string>, org: EmailOrg, base: string): { subject: string; html: string } {
  const v = { ...vars, ...(org.name ? { организация: org.name } : {}) };
  const logoSrc = tpl.logo === "none" ? "" : tpl.logo === "custom" ? tpl.logoUrl : (org.logoUrl || "");
  const logo = logoSrc ? absolute(logoSrc, base) : "";
  const image = tpl.imageUrl ? absolute(tpl.imageUrl, base) : "";
  const href = fillVars(tpl.buttonUrl, v).trim();
  const button = tpl.buttonText && /^https:\/\/[^\s"'<>]+$/.test(href) ? href : "";
  const color = /^#[0-9a-fA-F]{6}$/.test(tpl.color) ? tpl.color : EMPTY_EMAIL_TEMPLATE.color;
  const title = fillVars(tpl.title, v);
  const P = "margin:0 0 14px;font-size:15px;line-height:23px;color:#334155;";
  const footer = tpl.footer || org.signature || "";

  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fillVars(tpl.subject, v))}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
${logo ? `<tr><td align="center" style="padding:24px 24px 8px;"><img src="${esc(logo)}" alt="${esc(org.name)}" style="max-height:64px;max-width:220px;display:block;border:0;"></td></tr>` : `<tr><td style="height:8px;background:${color};"></td></tr>`}
${image ? `<tr><td style="padding:16px 24px 0;"><img src="${esc(image)}" alt="" width="552" style="width:100%;max-width:552px;height:auto;display:block;border:0;border-radius:12px;"></td></tr>` : ""}
<tr><td style="padding:24px 28px 8px;">
${title ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:29px;color:#0f172a;">${esc(title)}</h1>` : ""}
${richText(tpl.body, v, P)}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td style="border-radius:10px;background:${color};"><a href="${esc(button)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(fillVars(tpl.buttonText, v))}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e2e8f0;background:#f8fafc;">
${footer ? richText(footer, v, "margin:0 0 8px;font-size:13px;line-height:19px;color:#475569;") : ""}
<p style="margin:0;font-size:11px;line-height:16px;color:#94a3b8;">Письмо отправлено автоматически.</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: fillVars(tpl.subject, v).trim() || org.name, html };
}
