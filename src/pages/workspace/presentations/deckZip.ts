import { ASSET_ID, LIMITS, blobIdsIn, type PresentationFace, type PresentationSlide } from "../../../shared/presentations";

/**
 * Файл с компьютера → презентация для загрузки.
 *
 * .zip колоды Claude Slides: где-то внутри лежат deck.json и папка slides/
 * с файлом на слайд; видео и картинки — файлы с именем-id из «/_blob/<id>»
 * (в папке _blob/, blobs/, assets/ или рядом — неважно, ищем по имени).
 * .html — одна самостоятельная страница (любой артефакт, сохранённый файлом).
 */
export interface ParsedDeck {
  kind: "slides" | "html";
  title: string;
  slides: PresentationSlide[];
  faces: Record<string, PresentationFace>;
  files: Record<string, { blob: Blob; type: string }>;
  /** Слайды ссылаются на файлы, которых в архиве нет. */
  missing: string[];
}

const EXT_TYPE: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf",
};

/** Тип по первым байтам — у файлов из «_blob» часто нет расширения. */
function sniff(b: Uint8Array): string | null {
  const s = (o: number, t: string) => t.split("").every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b[0] === 0x89 && s(1, "PNG")) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (s(0, "GIF8")) return "image/gif";
  if (s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  if (s(0, "RIFF") && s(8, "WAVE")) return "audio/wav";
  if (s(4, "ftyp")) return s(8, "qt  ") ? "video/quicktime" : s(8, "M4A ") ? "audio/mp4" : "video/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (s(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (s(0, "OggS")) return "audio/ogg";
  if (s(0, "wOF2")) return "font/woff2";
  if (s(0, "wOFF")) return "font/woff";
  const head = new TextDecoder().decode(b.slice(0, 200)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

export async function parseDeckFile(file: File): Promise<ParsedDeck> {
  if (/\.html?$/i.test(file.name)) {
    const text = await file.text();
    const title = (text.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1] || file.name.replace(/\.html?$/i, "")).trim();
    return { kind: "html", title, slides: [], faces: {}, files: { index: { blob: new Blob([text], { type: "text/html" }), type: "text/html" } }, missing: [] };
  }
  if (!/\.zip$/i.test(file.name)) throw new Error("Нужен .zip колоды Claude Slides или .html-файл");

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(f.name));
  const deckEntry = entries.filter(f => /(^|\/)deck\.json$/i.test(f.name)).sort((a, b) => a.name.length - b.name.length)[0];
  if (!deckEntry) throw new Error("В архиве нет deck.json — это не колода Claude Slides. Как собрать архив — в подсказке ниже.");
  const base = deckEntry.name.replace(/deck\.json$/i, "");
  let deck: any;
  try { deck = JSON.parse(await deckEntry.async("string")); } catch { throw new Error("deck.json повреждён — не читается как JSON"); }

  const slideFiles = new Map(entries.filter(f => f.name.startsWith(`${base}slides/`) && /\.html$/i.test(f.name)).map(f => [f.name.slice(base.length + 7, -5), f]));
  if (!slideFiles.size) throw new Error("В архиве нет папки slides/ со слайдами");
  // Порядок — из deck.json; файлы, которых в нём нет, — в конец, как в плеере Claude.
  const order: string[] = [...(Array.isArray(deck.order) ? deck.order.map(String) : []), ...[...slideFiles.keys()].sort()];
  const slides: PresentationSlide[] = [];
  for (const id of [...new Set(order)]) {
    const f = slideFiles.get(id); if (!f) continue;
    slides.push({ id, html: await f.async("string") });
  }
  if (slides.length > LIMITS.slides) throw new Error(`Слайдов больше ${LIMITS.slides}`);

  const wanted = new Set(slides.flatMap(s => blobIdsIn(s.html)));
  const files: ParsedDeck["files"] = {};
  for (const f of entries) {
    const name = f.name.split("/").pop() || "";
    const id = name.replace(/\.[a-z0-9]{1,5}$/i, "").toLowerCase();
    if (!ASSET_ID.test(id) || !wanted.has(id) || files[id]) continue;
    const bytes = await f.async("uint8array");
    const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "").toLowerCase();
    const type = sniff(bytes) || EXT_TYPE[ext];
    if (!type) continue;
    files[id] = { blob: new Blob([bytes], { type }), type };
  }
  const faces: Record<string, PresentationFace> = {};
  for (const [k, v] of Object.entries(deck.faces && typeof deck.faces === "object" ? deck.faces : {})) {
    const f: any = v; if (f?.family && f?.href) faces[k] = { family: String(f.family), href: String(f.href) };
  }
  return {
    kind: "slides", title: String(deck.title || file.name.replace(/\.zip$/i, "")).slice(0, LIMITS.title),
    slides, faces, files, missing: [...wanted].filter(id => !files[id]),
  };
}

/** Загрузка файла по подписанной ссылке — напрямую в хранилище, с прогрессом. */
export function putFile(url: string, blob: Blob, type: string, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", type);
    x.upload.onprogress = e => onProgress(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Хранилище ответило ${x.status}`)));
    x.onerror = () => reject(new Error("Нет связи с хранилищем"));
    x.send(blob);
  });
}
