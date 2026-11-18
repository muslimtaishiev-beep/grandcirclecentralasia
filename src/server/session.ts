import admin from "firebase-admin";

/**
 * Проверка входа с учётом «выйти везде».
 *
 * Firebase сам не отклоняет токен после revokeRefreshTokens: токен живёт до
 * часа. Поэтому сравниваем момент входа (auth_time) с моментом отзыва
 * (tokensValidAfterTime): вошли раньше отзыва — сеанс завершён. Момент отзыва
 * читаем из Auth не чаще раза в минуту на пользователя.
 */
const cache = new Map<string, { at: number; ms: number }>();

export async function revokedAfter(uid: string): Promise<number> {
  const c = cache.get(uid);
  if (c && Date.now() - c.at < 60_000) return c.ms;
  let ms = 0;
  try {
    const u = await admin.auth().getUser(uid);
    ms = u.tokensValidAfterTime ? Date.parse(u.tokensValidAfterTime) || 0 : 0;
  } catch { ms = c?.ms || 0; }
  cache.set(uid, { at: Date.now(), ms });
  return ms;
}

/** Завершить все сеансы пользователя (и сразу на этом экземпляре сервера). */
export async function revokeAllSessions(uid: string): Promise<void> {
  await admin.auth().revokeRefreshTokens(uid);
  cache.set(uid, { at: Date.now(), ms: Math.floor(Date.now() / 1000) * 1000 });
}

/** Токен входа: подпись, срок и не завершён ли сеанс. */
export async function verifySession(token: string): Promise<admin.auth.DecodedIdToken> {
  const d = await admin.auth().verifyIdToken(token);
  const after = await revokedAfter(d.uid);
  if (after && (Number(d.auth_time) || 0) * 1000 < after) {
    throw Object.assign(new Error("Сеанс завершён — войдите снова"), { code: "SESSION_REVOKED" });
  }
  return d;
}
