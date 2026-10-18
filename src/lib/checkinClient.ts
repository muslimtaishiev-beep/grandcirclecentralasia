/**
 * Отправка скана билета на сервер — отдельно от экрана сканера.
 *
 * Здесь вся логика «что делать, если связь подвела»: таймаут, один
 * повтор и идентификатор попытки. Отдельным модулем, чтобы проверять её
 * без камеры и браузера: у экрана сканера ручного ввода нет, а ошибки
 * связи у двери — самое вероятное, что пойдёт не так.
 */

/** Код билета → идентификатор попытки, оставшейся без ответа. */
export type PendingMap = Map<string, { id: string; at: number }>;

/** Сколько ждём ответа на одну попытку. */
export const ATTEMPT_TIMEOUT_MS = 8000;
/** Как долго помним попытку без ответа: волонтёр наводит на код заново. */
export const PENDING_TTL_MS = 3 * 60 * 1000;

export type CheckinOutcome =
  | { kind: "response"; body: any }   // сервер ответил (даже отказом)
  | { kind: "offline" };              // ответа нет: обе попытки без связи

const randomId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).slice(0, 80);

export async function performCheckin(opts: {
  token: string;
  idToken: string;
  pending: PendingMap;
  url?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  now?: () => number;
  newId?: () => string;
}): Promise<CheckinOutcome> {
  const {
    token, idToken, pending,
    url = "/api/forms/checkin",
    fetchFn = fetch,
    timeoutMs = ATTEMPT_TIMEOUT_MS,
    retryDelayMs = 400,
    now = Date.now,
    newId = randomId,
  } = opts;

  // Одна попытка — один идентификатор. Повтор после обрыва узнаётся
  // сервером по нему и не называется гостю «уже входил» за вход, который
  // сам же сервер только что отметил.
  //
  // Идентификатор живёт ДОЛЬШЕ одного вызова: если оба запроса остались
  // без ответа, волонтёр наводит на тот же код заново — и новый скан
  // обязан нести прежний идентификатор. Иначе сервер, уже принявший
  // первый запрос, ответит красным «уже входил» гостю, вошедшему секунду
  // назад. Забываем идентификатор, как только пришёл любой ответ.
  const t = now();
  const known = pending.get(token);
  const reuse = !!known && t - known.at < PENDING_TTL_MS;
  const requestId = reuse ? known!.id : newId();
  pending.set(token, { id: requestId, at: reuse ? known!.at : t });

  // Без таймаута зависший запрос держал сканер заблокированным: в
  // имитации входа запросы стояли от 7 до 75 секунд, а волонтёр молча
  // ничего не мог сканировать.
  const attempt = async (): Promise<any> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token, requestId }),
      });
      // Не JSON (ответ прокси, страница ошибки) — не «билет не найден», а сбой связи.
      const body = await res.json().catch(() => null);
      if (!body) throw new Error("not-json");
      return body;
    } finally { clearTimeout(timer); }
  };

  try {
    let body: any;
    try {
      body = await attempt();
    } catch {
      // Один автоматический повтор: обрыв Wi-Fi у двери — обычное дело.
      await new Promise(r => setTimeout(r, retryDelayMs));
      body = await attempt();
    }
    pending.delete(token);          // ответ получен — попытка закрыта
    return { kind: "response", body };
  } catch {
    return { kind: "offline" };     // идентификатор остаётся для повторного скана
  }
}
