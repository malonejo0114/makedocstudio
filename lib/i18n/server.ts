import { cookies, headers } from "next/headers";

import { detectLocaleFromRequest, LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/config";

export function getRequestLocale(): Locale {
  const cookieStore = cookies();
  const headerStore = headers();
  return detectLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value || null,
    acceptLanguage: headerStore.get("accept-language"),
    country: headerStore.get("x-vercel-ip-country"),
  });
}
