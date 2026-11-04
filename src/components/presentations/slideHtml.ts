import DOMPurify from "dompurify";

/**
 * Слайд Claude Slides → безопасный HTML для нашей страницы.
 *
 * Слайд — <section> с инлайн-стилями на холсте 1920×1080. Что с ним делаем:
 * - заметки докладчика (<aside>) вынимаем отдельно;
 * - живые блоки <x-embed> (свои стили и скрипт) заменяем местом под
 *   изолированное окно: их скрипт работает только внутри iframe без доступа
 *   к нашей странице;
 * - «/_blob/<id>» подменяем подписанными ссылками на файлы;
 * - x-shape / x-icon / x-connector — в обычные блоки;
 * - всё остальное чистит DOMPurify: никаких скриптов и обработчиков.
 */

export interface PreparedSlide {
  id: string;
  html: string;
  notes: string;
  /** Встроенные живые страницы: место (data-embed) → документ для iframe. */
  embeds: { key: string; srcdoc: string }[];
  transition: "fade" | "push" | "none";
  builds: number;
}

const blobUrl = (assets: Record<string, string>) => (s: string) =>
  s.replace(/\/_blob\/([a-z0-9]{8,64})/g, (_, id) => assets[id] || "");

const SHAPE_RADIUS: Record<string, string> = { rounded: "24px", ellipse: "50%" };

export function prepareSlide(id: string, raw: string, assets: Record<string, string>): PreparedSlide {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${raw}</body>`, "text/html");
  const section = doc.querySelector("section") || doc.body;
  const sub = blobUrl(assets);

  const aside = section.querySelector(":scope > aside");
  const notes = aside?.textContent?.trim() || "";
  aside?.remove();

  const embeds: PreparedSlide["embeds"] = [];
  section.querySelectorAll("x-embed").forEach((el, i) => {
    const key = `${id}-e${i}`;
    // Содержимое — целиком, со <style> и <script>: оно уходит в изолированный iframe.
    embeds.push({ key, srcdoc: `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body>${sub(el.innerHTML)}</body></html>` });
    const ph = doc.createElement("div");
    ph.setAttribute("data-embed", key);
    ph.setAttribute("style", el.getAttribute("style") || "");
    el.replaceWith(ph);
  });

  section.querySelectorAll("x-shape").forEach(el => {
    const d = doc.createElement("div");
    const kind = el.getAttribute("kind") || "rect";
    d.setAttribute("style", `${el.getAttribute("style") || ""};${SHAPE_RADIUS[kind] ? `border-radius:${SHAPE_RADIUS[kind]};` : ""}`);
    d.innerHTML = el.innerHTML;
    el.replaceWith(d);
  });
  section.querySelectorAll("x-icon, x-connector").forEach(el => el.remove());

  section.querySelectorAll("[src]").forEach(el => {
    const v = sub(el.getAttribute("src") || "");
    if (v) el.setAttribute("src", v); else el.removeAttribute("src");
  });
  section.querySelectorAll("[data-video]").forEach(el => el.setAttribute("data-video", sub(el.getAttribute("data-video") || "")));
  section.querySelectorAll("[style*='/_blob/']").forEach(el => el.setAttribute("style", sub(el.getAttribute("style") || "")));

  const transition = (section.getAttribute("data-transition") || "fade") as string;
  const builds = section.querySelectorAll("[data-build-in]").length;

  // Холст слайда: размер и точка отсчёта для закреплённых (position:absolute) детей.
  const style = section.getAttribute("style") || "";
  section.setAttribute("style", `${style};position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box`);

  const html = DOMPurify.sanitize(section.outerHTML, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: ["data-embed", "data-video", "data-video-sound", "data-build-in", "data-transition", "target"],
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "textarea", "select", "button", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["srcset"],
  });
  return { id, html, notes, embeds, transition: transition === "push" ? "push" : transition === "none" ? "none" : "fade", builds };
}

/**
 * Базовые стили холста — по справочнику формата Claude Slides (format.md,
 * styles.md): размеры заголовков и абзацев по умолчанию, «без display —
 * колонка», таблицы с линиями и отступами ячеек, слои по порядку.
 */
export const SLIDE_CSS = `
.slide-root section *{margin:0;box-sizing:border-box}
.slide-root section{display:flex;flex-direction:column;align-items:stretch;text-align:left;line-height:1.4;font-size:32px;font-weight:400}
/* «Без display — колонка»; у блока с display:flex без направления — строка, как в CSS. */
.slide-root section div:not([style*="display"]){display:flex;flex-direction:column}
/* Слои — по порядку в слайде: «Later children paint over earlier ones». Без
   этого закреплённый фон (сетка) ложился поверх текста — позиционированный
   элемент всегда рисуется над обычным. Инлайн position:absolute сильнее. */
.slide-root section > *{position:relative}
.slide-root section h1{font-size:96px;font-weight:600;line-height:1.1}
.slide-root section h2{font-size:64px;font-weight:600;line-height:1.15}
.slide-root section h3{font-size:44px;font-weight:600;line-height:1.2}
.slide-root section p,.slide-root section li{font-size:inherit;font-weight:inherit}
.slide-root section img,.slide-root section video,.slide-root section svg{display:block;max-width:none}
.slide-root section ul,.slide-root section ol{padding-left:1.2em}
.slide-root section ul{list-style:disc}.slide-root section ol{list-style:decimal}
.slide-root section table{border-collapse:collapse;width:100%}
.slide-root section th,.slide-root section td{border:2px solid color-mix(in srgb,currentColor 28%,transparent);padding:.35em .6em;vertical-align:top;text-align:left}
.slide-root section th{font-weight:700}
.slide-root section a{color:inherit;text-decoration:underline}
.slide-root section hr{border:0;border-top:2px solid currentColor}
.slide-root [data-embed] iframe{pointer-events:none}
.slide-root [data-build-in]{transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1)}
.slide-root [data-build-in].pending{opacity:0}
.slide-root [data-build-in^="rise"].pending{transform:translateY(40px)}
.slide-root [data-build-in^="drop"].pending{transform:translateY(-40px)}
.slide-root [data-build-in^="left"].pending{transform:translateX(-60px)}
.slide-root [data-build-in^="right"].pending{transform:translateX(60px)}
.slide-root [data-build-in^="pop"].pending,.slide-root [data-build-in^="scale"].pending{transform:scale(.85)}
`;
