/**
 * Файлы в заявках — единственный источник правил.
 *
 * Импортируется и сервером (авторитетная проверка), и браузером (чтобы
 * человек узнал о запрете до отправки, а не после).
 *
 * Хранилища файлов у проекта нет: файл лежит в самой заявке строкой
 * data-URL, как и фото документа. Отсюда потолок: документ Firestore — 1 МБ.
 * Формат значения:
 *   data:<mime>;name=<имя в URL-кодировке>;base64,<данные>
 * Старые значения без имени (data:image/jpeg;base64,…) читаются как есть.
 *
 * Принимаем любой формат, кроме установщиков и исполняемых файлов. Проверяем
 * не только расширение: APK, переименованный в .pdf, остаётся ZIP-архивом
 * с AndroidManifest.xml, и по содержимому он опознаётся.
 */

export const FILE_LIMITS = {
  /** Длина одного значения (символов data-URL). */
  maxFieldChars: 880 * 1024,
  /** Все файлы одной заявки вместе: в документе есть и другие поля. */
  maxTotalChars: 900 * 1024,
  /** То же в килобайтах файла для сообщений человеку (base64 раздувает на треть). */
  maxFileKb: 650,
} as const;

/** Расширения, которые не принимаем никогда. */
const BLOCKED_EXT = new Set([
  // Android / iOS
  "apk", "apks", "xapk", "aab", "ipa",
  // Windows
  "exe", "msi", "msix", "dll", "scr", "com", "bat", "cmd", "ps1", "psm1", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "hta", "lnk", "cpl", "reg", "msc", "pif", "gadget",
  // macOS / Linux
  "app", "dmg", "pkg", "command", "sh", "bash", "zsh", "run", "bin", "deb", "rpm", "appimage",
  // Java
  "jar", "class",
  // Открываются в браузере и исполняют скрипты
  "html", "htm", "xhtml", "svg", "svgz",
]);

/** Для имён вида «счёт.exe.pdf»: исполняемые расширения в середине имени. */
const BLOCKED_INNER_EXT = new Set([
  "apk", "exe", "msi", "scr", "bat", "cmd", "com", "ps1", "vbs", "js", "jar", "lnk", "hta", "sh",
]);

const BLOCKED_MIME = [
  /android\.package-archive/i,
  /x-msdownload|x-dosexec|x-msdos-program|portable-executable|x-msi\b/i,
  /x-executable|x-mach-binary|x-elf|x-sharedlib/i,
  /x-sh\b|x-shellscript|x-csh|x-perl|x-bat/i,
  /javascript|ecmascript/i,
  /^text\/html|xhtml/i,
  /svg/i,
  /java-archive|x-java/i,
  /x-apple-diskimage|x-ios-app/i,
];

const BLOCKED_REASON = "Установщики, исполняемые файлы и скрипты (APK, EXE, JS, HTML и подобные) прикладывать нельзя.";

export interface FileInfo {
  mime: string;
  name: string;
  /** Размер самого файла в байтах (по длине base64). */
  size: number;
}

export const isFileValue = (v: unknown): v is string =>
  typeof v === "string" && /^\s*data:/i.test(v);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
};

/** Имя файла без путей, управляющих и bidi-символов, не длиннее 120. */
export const cleanFileName = (raw: string): string =>
  raw.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "").trim().slice(0, 120);

export function fileInfo(value: string): FileInfo | null {
  if (!isFileValue(value)) return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const head = value.slice(5, comma).trim();
  const parts = head.split(";");
  const mime = (parts[0] || "").toLowerCase();
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime) || !parts.includes("base64")) return null;
  let name = "";
  for (const p of parts.slice(1)) {
    if (p.toLowerCase().startsWith("name=")) {
      try { name = cleanFileName(decodeURIComponent(p.slice(5))); } catch { name = ""; }
    }
  }
  if (!name) name = `file.${EXT_BY_MIME[mime] || "bin"}`;
  const payload = value.length - comma - 1;
  const pad = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return { mime, name, size: Math.max(0, Math.floor((payload * 3) / 4) - pad) };
}

/** Собрать значение поля из файла. Имя — в URL-кодировке, чтобы не сломать разбор. */
export function buildFileValue(mime: string, name: string, base64: string): string {
  return `data:${mime};name=${encodeURIComponent(cleanFileName(name))};base64,${base64}`;
}

export const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

/** Как значение выглядит в таблице и выгрузке: не сам файл, а его имя. */
export function fileLabel(value: unknown): string {
  const info = typeof value === "string" ? fileInfo(value) : null;
  return info ? `[файл] ${info.name} (${formatSize(info.size)})` : String(value ?? "");
}

const ext = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const ascii = (bytes: Uint8Array, from: number, to: number): string => {
  let s = "";
  const end = Math.min(bytes.length, to);
  for (let i = from; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

/** Ищем ASCII-метку в байтах, не создавая гигантскую строку целиком. */
function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const CHUNK = 64 * 1024;
  const keep = needle.length - 1;
  for (let off = 0; off < bytes.length; off += CHUNK) {
    const from = Math.max(0, off - keep);
    if (ascii(bytes, from, off + CHUNK).includes(needle)) return true;
  }
  return false;
}

/**
 * Проверка самого файла: имя, объявленный тип и содержимое.
 * Возвращает текст ошибки для человека или null, если файл можно принять.
 */
export function inspectUpload(name: string, mime: string, bytes: Uint8Array): string | null {
  if (!name || /[\u0000-\u001f\u007f‪-‮⁦-⁩]/.test(name)) return "Недопустимое имя файла.";

  const parts = name.toLowerCase().split(".");
  if (BLOCKED_EXT.has(ext(name))) return BLOCKED_REASON;
  if (parts.length > 2 && parts.slice(1, -1).some(p => BLOCKED_INNER_EXT.has(p))) return BLOCKED_REASON;
  if (BLOCKED_MIME.some(re => re.test(mime))) return BLOCKED_REASON;

  const b = bytes;
  // Исполняемые форматы по сигнатуре — что бы ни написано в имени.
  if (b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a) return BLOCKED_REASON;                       // MZ: exe, dll
  if (b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return BLOCKED_REASON; // ELF
  if (b.length >= 4) {
    const sig = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    // Mach-O (все варианты), «fat»-бинарник и Java class делят CAFEBABE.
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(sig)) return BLOCKED_REASON;
  }
  if (b.length >= 2 && b[0] === 0x23 && b[1] === 0x21) return BLOCKED_REASON;                       // #! скрипт

  // ZIP: APK, AAB и JAR — это архивы с узнаваемым содержимым.
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) {
    if (containsAscii(b, "AndroidManifest.xml") || containsAscii(b, "classes.dex")
      || containsAscii(b, "BundleConfig.pb") || containsAscii(b, "META-INF/MANIFEST.MF")) return BLOCKED_REASON;
  }

  // Текст, который браузер открыл бы как страницу.
  const head = ascii(b, 0, 600).toLowerCase().replace(/^﻿/, "").trimStart();
  if (/^(<!doctype html|<html|<script|<svg|<\?xml[^>]*>\s*<svg)/.test(head)) return BLOCKED_REASON;

  return null;
}

/** Полная проверка значения поля-файла (серверная и клиентская). */
export function checkFileValue(value: string): { ok: boolean; error?: string; info?: FileInfo } {
  const info = fileInfo(value);
  if (!info) return { ok: false, error: "Файл повреждён, приложите его ещё раз." };
  if (value.length > FILE_LIMITS.maxFieldChars) {
    return { ok: false, error: `Файл больше ${FILE_LIMITS.maxFileKb} КБ. Сожмите его или отправьте ссылкой (Google Drive, Canva).` };
  }
  const comma = value.indexOf(",");
  const bytes = base64ToBytes(value.slice(comma + 1));
  if (!bytes) return { ok: false, error: "Файл повреждён, приложите его ещё раз." };
  const bad = inspectUpload(info.name, info.mime, bytes);
  return bad ? { ok: false, error: bad } : { ok: true, info };
}

/**
 * Что кабинет может показать прямо на странице. Тип, указанный загрузившим,
 * не доверяем: всё, чего нет в списке, только скачивается.
 */
const INLINE_MIME = /^(image\/(png|jpeg|gif|webp|avif|bmp)|application\/pdf|text\/plain|audio\/(mpeg|mp3|ogg|wav|webm|mp4|aac)|video\/(mp4|webm|ogg|quicktime))$/;
export const inlineMime = (mime: string): string | null => (INLINE_MIME.test(mime) ? mime : null);
