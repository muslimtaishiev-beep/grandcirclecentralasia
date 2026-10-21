/**
 * Вкладка, открытая до выкатки, просит файлы прошлой сборки — на Vercel их
 * уже нет (404). Лечится одной перезагрузкой: свежий index.html знает новые
 * имена. Но перезагружать без ограничения нельзя: если файл не грузится по
 * другой причине (нет интернета), страница уходит в бесконечный круг и
 * кабинет «не открывается». Поэтому — не чаще раза в минуту на вкладку.
 */
const KEY = 'stale_build_reload_at';
const WINDOW_MS = 60_000;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS|is not a valid JavaScript MIME type/i;

export const isChunkLoadError = (err: unknown): boolean =>
  CHUNK_ERROR.test(String((err as any)?.message ?? err ?? ''));

/** true — перезагрузка запущена; false — уже пробовали недавно, показываем ошибку. */
export const reloadForStaleBuild = (): boolean => {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* приватный режим */ }
  if (Date.now() - last < WINDOW_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* приватный режим */ }
  window.location.reload();
  return true;
};
