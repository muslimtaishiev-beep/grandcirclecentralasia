import type { DocBlock } from '../../types/collab';
import { cleanDocHtml } from '../../lib/docHtml';
import { generateShortId } from '../../lib/utils';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Подставить значения в {{ключ}}; незаполненное остаётся пустой чертой. */
export function fillTemplateVars(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = (values[key] || '').trim();
    return v ? esc(v) : '__________';
  });
}

/** HTML шаблона организации → блоки документа (заголовки, абзацы, списки, разделители). */
export function templateHtmlToBlocks(html: string): DocBlock[] {
  const root = new DOMParser().parseFromString(`<body>${cleanDocHtml(html)}</body>`, 'text/html').body;
  const blocks: DocBlock[] = [];
  const push = (type: DocBlock['type'], content: string, extra: Partial<DocBlock> = {}) =>
    blocks.push({ id: generateShortId(), type, content, ...extra });
  const alignOf = (el: Element): DocBlock['align'] | undefined => {
    const a = (el.getAttribute('align') || (el as HTMLElement).style?.textAlign || '').toLowerCase();
    return a === 'center' || a === 'right' || a === 'justify' ? a : undefined;
  };
  const walk = (nodes: ChildNode[]) => {
    let loose = '';
    const flush = () => { if (loose.replace(/<[^>]*>/g, '').trim()) push('paragraph', loose.trim()); loose = ''; };
    for (const n of nodes) {
      if (n.nodeType === Node.TEXT_NODE) { loose += esc(n.textContent || ''); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (['b', 'strong', 'i', 'em', 'u', 'span', 'a', 'br', 'font', 'small', 'sub', 'sup'].includes(tag)) { loose += el.outerHTML; continue; }
      flush();
      const al = alignOf(el);
      const extra: Partial<DocBlock> = al ? { align: al } : {};
      if (tag === 'h1') push('heading_1', el.innerHTML, extra);
      else if (tag === 'h2') push('heading_2', el.innerHTML, extra);
      else if (tag === 'h3' || tag === 'h4') push('heading_3', el.innerHTML, extra);
      else if (tag === 'hr') push('divider', '');
      else if (tag === 'blockquote') push('quote', el.innerHTML, extra);
      else if (tag === 'pre') push('code_block', el.textContent || '');
      else if (tag === 'img') push('image', el.getAttribute('src') || '', { imageUrl: el.getAttribute('src') || '' });
      else if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll(':scope > li').forEach(li => push(tag === 'ul' ? 'bullet_list' : 'numbered_list', li.innerHTML));
      } else if (el.querySelector('h1,h2,h3,h4,p,ul,ol,hr,div,table')) walk(Array.from(el.childNodes));
      else if (el.textContent?.trim()) push('paragraph', el.innerHTML, extra);
    }
    flush();
  };
  walk(Array.from(root.childNodes));
  return blocks.length ? blocks : [{ id: generateShortId(), type: 'paragraph', content: '' }];
}
