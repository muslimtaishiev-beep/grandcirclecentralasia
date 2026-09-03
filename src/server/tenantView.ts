/**
 * Что из документа организации можно показывать кому.
 *
 * Документ tenants/{id} хранит и публичное (название, цвета), и служебное
 * (ключи интеграций, настройки почты, лимиты). Раньше он целиком читался
 * без входа — и через API, и через правила Firestore. Теперь наружу уходит
 * только явный список полей.
 */
export const normalizeTenantStatus = (raw: unknown): "active" | "suspended" =>
  /^suspended$/i.test(String(raw ?? "")) ? "suspended" : "active";

/** Публичное представление — для анонимных страниц (экзамен, лендинг, QR). */
export function publicTenantView(t: any) {
  if (!t) return null;
  const b = t.branding && typeof t.branding === "object" ? t.branding : {};
  return {
    id: t.id,
    name: t.name || "",
    slug: t.slug || "",
    subdomain: t.subdomain || "",
    status: normalizeTenantStatus(t.status),
    branding: {
      logoUrl: b.logoUrl ?? null,
      primaryColor: b.primaryColor ?? null,
      loginMessage: b.loginMessage ?? null,
    },
    brandColor: t.brandColor ?? null,
    workspaceConfig: t.workspaceConfig ?? null,
    legal: t.legal && typeof t.legal === "object" ? t.legal : null,
  };
}

/** Представление для сотрудника организации: без ключей и почтовых настроек. */
export function stripTenantSecrets<T extends Record<string, any>>(t: T): T {
  const out: any = { ...t };
  delete out.apiKey;
  delete out.emailSettings;
  if (out.settings && typeof out.settings === "object") {
    const { gasApiKey: _k, gasUrl: _u, ...rest } = out.settings;
    out.settings = rest;
  }
  return out as T;
}
