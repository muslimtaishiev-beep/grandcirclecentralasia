import admin from "firebase-admin";

/**
 * Проверка входа с учётом «выйти везде», блокировки и снятия суперадмина.
 *
 * Firebase сам не отклоняет токен после revokeRefreshTokens: токен живёт до
 * часа. Поэтому сравниваем момент входа (auth_time) с моментом отзыва
 * (tokensValidAfterTime): вошли раньше отзыва — сеанс завершён. Учётная
 * запись читается из Auth не чаще раза в минуту на пользователя.
 *
 * Проверка закрыта при сбое: удалённый аккаунт — отказ; ошибка Auth без
 * прежнего значения в кэше — отказ.
 */
interface AccountState { at: number; ms: number; disabled: boolean }
const cache = new Map<string, AccountState>();
const TTL = 60_000;

const denied = (message: string, code = "SESSION_REVOKED") => Object.assign(new Error(message), { code });

async function accountState(uid: string): Promise<AccountState> {
  const c = cache.get(uid);
  if (c && Date.now() - c.at < TTL) return c;
  try {
    const u = await admin.auth().getUser(uid);
    const s: AccountState = {
      at: Date.now(),
      ms: u.tokensValidAfterTime ? Date.parse(u.tokensValidAfterTime) || 0 : 0,
      disabled: u.disabled === true,
    };
    cache.set(uid, s);
    return s;
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      cache.delete(uid);
      throw denied("Учётная запись удалена");
    }
    if (c) return c;
    throw denied("Не удалось проверить сеанс — войдите снова", "SESSION_CHECK_FAILED");
  }
}

/** Момент отзыва сеансов пользователя (мс). */
export async function revokedAfter(uid: string): Promise<number> {
  return (await accountState(uid)).ms;
}

/** Завершить все сеансы пользователя (и сразу на этом экземпляре сервера). */
export async function revokeAllSessions(uid: string): Promise<void> {
  await admin.auth().revokeRefreshTokens(uid);
  const c = cache.get(uid);
  cache.set(uid, { at: Date.now(), ms: Math.floor(Date.now() / 1000) * 1000, disabled: c?.disabled ?? false });
}

/** Сбросить кэш учётной записи — после блокировки или смены статуса. */
export function forgetAccount(uid: string): void {
  cache.delete(uid);
  saCache.delete(uid);
}

/**
 * Суперадмин — только при записи в superadmins. Метка в токене живёт до
 * часа и после снятия не пропадает сама, поэтому сверяется с базой.
 */
const saCache = new Map<string, { at: number; ok: boolean }>();
async function stillSuperadmin(uid: string): Promise<boolean> {
  const c = saCache.get(uid);
  if (c && Date.now() - c.at < TTL) return c.ok;
  let ok = false;
  try { ok = (await admin.firestore().collection("superadmins").doc(uid).get()).exists; }
  catch { ok = false; }
  saCache.set(uid, { at: Date.now(), ok });
  return ok;
}

/** Токен входа: подпись, срок, блокировка, не завершён ли сеанс. */
export async function verifySession(token: string): Promise<admin.auth.DecodedIdToken> {
  const d = await admin.auth().verifyIdToken(token);
  const s = await accountState(d.uid);
  if (s.disabled) throw denied("Учётная запись отключена");
  if (s.ms && (Number(d.auth_time) || 0) * 1000 < s.ms) throw denied("Сеанс завершён — войдите снова");
  if ((d as any).isSuperadmin === true && !(await stillSuperadmin(d.uid))) (d as any).isSuperadmin = false;
  return d;
}
