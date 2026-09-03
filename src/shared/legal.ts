/**
 * Реквизиты организации — для справок, сертификатов, шаблонов документов и
 * писем.
 *
 * До этого во всех документах платформы были зашиты реквизиты одной
 * организации: ИНН, адрес, телефон, печать и подпись Академии печатались на
 * справках любой компании. Теперь каждая организация хранит свои реквизиты
 * в документе tenants/{id}.legal и правит их в настройках; документы берут
 * данные оттуда, а без реквизитов печатают только название организации.
 */
export interface LegalProfile {
  /** Официальное название: «ОсОО «Академия…»». */
  legalName: string;
  /** Название на втором языке (для двуязычных бланков). */
  nameKg?: string;
  city?: string;
  address?: string;
  addressKg?: string;
  phone?: string;
  /** Служебная почта — наружу не отдаётся. */
  email?: string;
  inn?: string;
  license?: string;
  /** Должность подписанта на справках. */
  signatoryTitle?: string;
  signatoryName?: string;
  /** Печать и логотип — только https:// или путь от корня сайта. */
  stampUrl?: string;
  stampColor?: string;
  logoUrl?: string;
  /** Факсимиле подписи и угловой штамп — для шаблонов документов. */
  signatureUrl?: string;
  cornerStampUrl?: string;
}

const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const cleanUrl = (v: unknown) => {
  const s = clean(v, 500);
  return /^(https:\/\/|\/)[^\s"'<>]*$/.test(s) ? s : "";
};
const cleanColor = (v: unknown) => {
  const s = clean(v, 20);
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : "";
};

/** Санитизация того, что прислал владелец: только известные поля, без мусора. */
export function sanitizeLegal(input: unknown): LegalProfile {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: LegalProfile = { legalName: clean(i.legalName, 160) };
  const opt: (keyof LegalProfile)[] = ["nameKg", "city", "address", "addressKg", "phone", "email", "inn", "license", "signatoryTitle", "signatoryName"];
  for (const k of opt) { const v = clean(i[k]); if (v) (out as any)[k] = v; }
  const stampUrl = cleanUrl(i.stampUrl); if (stampUrl) out.stampUrl = stampUrl;
  const logoUrl = cleanUrl(i.logoUrl); if (logoUrl) out.logoUrl = logoUrl;
  const signatureUrl = cleanUrl(i.signatureUrl); if (signatureUrl) out.signatureUrl = signatureUrl;
  const cornerStampUrl = cleanUrl(i.cornerStampUrl); if (cornerStampUrl) out.cornerStampUrl = cornerStampUrl;
  const stampColor = cleanColor(i.stampColor); if (stampColor) out.stampColor = stampColor;
  return out;
}

/** Реквизиты для документов: из legal, а если пусто — только название организации. */
export function resolveLegalProfile(tenant: { name?: unknown; legal?: unknown } | null | undefined): LegalProfile {
  const l = tenant?.legal && typeof tenant.legal === "object" ? (tenant.legal as Partial<LegalProfile>) : {};
  return {
    ...l,
    legalName: clean(l.legalName, 160) || clean(tenant?.name, 160) || "",
    signatoryTitle: clean(l.signatoryTitle) || "Директор",
  };
}

/** Что можно отдать без входа (публичные страницы, сертификат ученика). */
export function publicLegal(legal: unknown): Omit<LegalProfile, "email"> | null {
  if (!legal || typeof legal !== "object") return null;
  const { email: _e, ...rest } = legal as LegalProfile;
  return rest;
}
