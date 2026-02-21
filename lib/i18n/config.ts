export const LOCALE_COOKIE_NAME = "mkdoc_lang";

export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  return null;
}

export function detectLocaleFromRequest(input: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): Locale {
  const fromCookie = normalizeLocale(input.cookieLocale);
  if (fromCookie) return fromCookie;

  const country = (input.country || "").trim().toUpperCase();
  if (country && country !== "KR") {
    return "en";
  }

  const fromHeader = normalizeLocale(input.acceptLanguage);
  if (fromHeader) return fromHeader;

  return "ko";
}
