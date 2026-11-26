import admin from "firebase-admin";
import { appUrl } from "./emailEvents.js";

/**
 * Хранилище файлов организации (Firebase Storage). Бакет закрыт: браузер
 * кладёт файлы по подписанной ссылке на запись и читает по подписанной
 * ссылке на чтение — обе выдаёт сервер после проверки доступа.
 */
export const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "study-64ebf.firebasestorage.app";
export const bucket = () => admin.storage().bucket(BUCKET);

let corsReady: Promise<void> | null = null;
const MARK = "x-goog-content-length-range";
/**
 * Один раз: бакет принимает PUT с домена сайта (дописывается к существующим
 * правилам, лишнее не трогаем). Хранилище берёт первое подходящее правило —
 * нужные заголовки дописываются и в уже существующие.
 */
export function ensureBucketCors(): Promise<void> {
  if (corsReady) return corsReady;
  corsReady = (async () => {
    const b = bucket();
    const [meta] = await b.getMetadata();
    const cors: any[] = Array.isArray(meta?.cors) ? meta.cors : [];
    if (cors.some(r => (r.responseHeader || []).includes(MARK))) return;
    const origin = [...new Set([await appUrl(), "http://localhost:5173", "http://localhost:3000"])];
    const patched = cors.map(r => ({ ...r, responseHeader: [...new Set([...(r.responseHeader || []), "Content-Type", MARK])] }));
    await b.setCorsConfiguration([...patched, { origin, method: ["PUT", "GET", "HEAD"], responseHeader: ["Content-Type", MARK], maxAgeSeconds: 3600 }]);
  })().catch(e => { console.error("[storage] cors:", e?.message || e); corsReady = null; });
  return corsReady;
}
