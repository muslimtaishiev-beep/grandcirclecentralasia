/**
 * Вызов Gemini с ответом строго по JSON-схеме.
 *
 * Модели перебираются по очереди: у Google отдельные модели бывают
 * перегружены (503), выведены из оборота для новых ключей (404) или упираются
 * в квоту (429) — тогда пробуем следующую. Список задаётся GEMINI_OCR_MODELS
 * через запятую, чтобы сменить модель без выкладки кода.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-3-flash-preview", "gemini-3.8-flash", "gemini-3.5-flash"];
const ATTEMPT_TIMEOUT_MS = 90_000;
/** На этих ответах есть смысл попробовать другую модель. */
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

export class GeminiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function models(): string[] {
  const env = String(process.env.GEMINI_OCR_MODELS || "").split(",").map(s => s.trim()).filter(Boolean);
  return env.length ? env : DEFAULT_MODELS;
}

export interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }

export interface GeminiJsonOptions {
  system: string;
  parts: GeminiPart[];
  /** OpenAPI-подмножество схемы Gemini (type: OBJECT/ARRAY/STRING…). */
  schema: Record<string, unknown>;
}

/** Возвращает разобранный JSON и имя модели, которая ответила. */
export async function geminiJson<T>(opts: GeminiJsonOptions): Promise<{ data: T; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(503, "Распознавание не настроено на сервере");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
    },
  });

  let last: GeminiError | null = null;
  for (const model of models()) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const r = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: ac.signal,
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = String(j?.error?.message || `HTTP ${r.status}`).slice(0, 300);
        last = new GeminiError(r.status, msg);
        console.warn(`[gemini] ${model}: ${r.status} ${msg}`);
        if (RETRYABLE.has(r.status)) continue;
        throw last;
      }
      const cand = j?.candidates?.[0];
      const text = (cand?.content?.parts || []).filter((p: any) => typeof p?.text === "string" && !p.thought).map((p: any) => p.text).join("");
      if (!text) {
        last = new GeminiError(502, cand?.finishReason === "SAFETY" ? "ИИ отказался обработать изображение" : "ИИ вернул пустой ответ");
        continue;
      }
      try {
        return { data: JSON.parse(text) as T, model };
      } catch {
        last = new GeminiError(502, "ИИ вернул неполный ответ — страница слишком большая");
        continue;
      }
    } catch (e: any) {
      if (e instanceof GeminiError && !RETRYABLE.has(e.status)) throw e;
      last = e?.name === "AbortError" ? new GeminiError(504, "ИИ не ответил вовремя") : (e instanceof GeminiError ? e : new GeminiError(502, String(e?.message || e)));
      console.warn(`[gemini] ${model}: ${last.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const quota = last?.status === 429;
  throw new GeminiError(quota ? 429 : 503, quota ? "Исчерпан лимит запросов к ИИ — попробуйте позже" : "ИИ сейчас недоступен — попробуйте через минуту");
}
