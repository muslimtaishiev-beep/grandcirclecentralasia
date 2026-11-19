import DOMPurify from "dompurify";

/**
 * HTML блока документа: только разметка текста, без скриптов, обработчиков,
 * встраиваемых окон и форм. Блок пишут сотрудники, а открывают коллеги —
 * сырой HTML в нём был бы хранимым XSS.
 */
const DOC_TAGS = [
  "b", "strong", "i", "em", "u", "s", "strike", "del", "ins", "mark", "sub", "sup",
  "span", "font", "br", "a", "code", "small", "big", "div", "p", "img",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "hr",
];
const DOC_ATTRS = ["href", "target", "rel", "style", "color", "face", "size", "title", "src", "alt", "width", "height", "align"];

export function cleanDocHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: DOC_TAGS,
    ALLOWED_ATTR: DOC_ATTRS,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}
