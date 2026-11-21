import admin from "firebase-admin";
import { fillVariant, DEFAULT_VARIANT_KEY, sanitizeResultPage, type MediaRef, type ResultData, type ResultPageView, type Step, type Variant } from "../shared/resultPages.js";

/** Страницы результатов: tenants/{t}/result_pages/{id}. Пишет только сервер. */
const db = () => admin.firestore();
export const RESULT_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "study-64ebf.firebasestorage.app";
export const resultBucket = () => admin.storage().bucket(RESULT_BUCKET);
export const pageDoc = (t: string, id: string) => db().collection("tenants").doc(t).collection("result_pages").doc(id);
const READ_TTL = 7 * 24 * 3600 * 1000;

/** Подписанная ссылка на чтение загруженного файла; не вышло — пусто (клиент пропустит видео). */
export async function readUrl(path: string): Promise<string> {
  try {
    const [u] = await resultBucket().file(path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + READ_TTL });
    return u;
  } catch (e: any) { console.error("[result-pages] sign:", e?.message || e); return ""; }
}

async function signMedia(m: MediaRef | null): Promise<MediaRef | null> {
  if (!m || m.source !== "upload" || !m.path) return m;
  return { ...m, url: await readUrl(m.path) };
}

/** Загруженные видео и картинки варианта — с подписанными ссылками на чтение (7 дней). */
export async function signVariant(v: Variant): Promise<Variant> {
  const steps: Step[] = [];
  for (const s of v.steps) {
    if (s.type === "video") steps.push({ ...s, media: (await signMedia(s.media))! });
    else if (s.type === "letter") {
      const blocks = [];
      for (const b of s.blocks) {
        if (b.type === "image") blocks.push({ ...b, media: (await signMedia(b.media))! });
        else if (b.type === "signature") blocks.push({ ...b, image: await signMedia(b.image) });
        else blocks.push(b);
      }
      steps.push({ ...s, blocks });
    } else steps.push(s);
  }
  return { ...v, steps };
}

export interface StoredPage { id: string; name: string; variants: Record<string, Variant>; updatedAt: number; updatedBy: string }

export async function loadPage(t: string, id: string): Promise<StoredPage | null> {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(String(id || ""))) return null;
  const d = (await pageDoc(t, id).get()).data();
  if (!d) return null;
  // Повторная очистка при чтении: в базе могло остаться то, что правила уже не пускают.
  const clean = sanitizeResultPage(d, Object.keys(d.variants || {}), t);
  return { id, name: clean.name || String(d.name || ""), variants: clean.variants, updatedAt: Number(d.updatedAt || 0), updatedBy: String(d.updatedBy || "") };
}

/** Вариант по исходу, иначе «по умолчанию»; переменные подставлены, ссылки на файлы подписаны. */
export async function buildView(t: string, pageId: string, outcomeId: string, vars: Record<string, string>, data: ResultData): Promise<ResultPageView | null> {
  const page = await loadPage(t, pageId);
  if (!page) return null;
  const key = page.variants[outcomeId] ? outcomeId : DEFAULT_VARIANT_KEY;
  const v = page.variants[key];
  if (!v) return null;
  const filled = fillVariant(v, vars);
  return { pageId, pageName: page.name, outcomeId: key, variant: await signVariant(filled), data };
}
