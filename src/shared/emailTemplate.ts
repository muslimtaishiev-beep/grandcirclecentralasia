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
  updatedAt?: number;
}

export const EMPTY_EMAIL_TEMPLATE: EmailTemplate = {
  name: "", subject: "", title: "", body: "", buttonText: "", buttonUrl: "{{ссылка}}",
  logo: "org", logoUrl: "", imageUrl: "", footer: "", color: "#4f46e5",
};

/** Где пригодится подстановка: в письмах приёма, теста, формы. */
export type EmailEvent = "referral" | "tested" | "form";

export interface EmailVar { key: string; label: string; sample: string; events: EmailEvent[] }

export const EMAIL_VARS: EmailVar[] = [
  { key: "имя", label: "Имя получателя", sample: "Айгуль Асанова", events: ["referral", "tested", "form"] },
  { key: "ребёнок", label: "Ребёнок", sample: "Асанов Тимур", events: ["referral", "tested"] },
  { key: "класс", label: "Класс", sample: "5", events: ["referral", "tested"] },
  { key: "экзамен", label: "Экзамен", sample: "Вступительный экзамен, 5 класс", events: ["referral", "tested"] },
  { key: "код", label: "Код экзамена", sample: "482913", events: ["referral"] },
  { key: "балл", label: "Балл", sample: "42 из 50", events: ["tested"] },
  { key: "процент", label: "Процент", sample: "84%", events: ["tested"] },
  { key: "номер", label: "Номер работы", sample: "1047", events: ["tested"] },
  { key: "форма", label: "Форма", sample: "Регистрация на форум", events: ["form"] },
  { key: "ссылка", label: "Ссылка", sample: "https://www.studyfreeforum.com/a/demo", events: ["referral", "tested", "form"] },
  { key: "организация", label: "Организация", sample: "Академия будущих лидеров", events: ["referral", "tested", "form"] },
];

export const sampleVars = (): Record<string, string> => Object.fromEntries(EMAIL_VARS.map(v => [v.key, v.sample]));

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
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Подставить {{ключ}} в простой текст (без HTML). Неизвестное — пусто. */
export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Текст → безопасный HTML: экранирование, подстановки, **жирный**, абзацы. */
function richText(text: string, vars: Record<string, string>, style: string): string {
  const html = esc(fillVars(text, vars)).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
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
  const v = { организация: org.name, ...vars };
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
