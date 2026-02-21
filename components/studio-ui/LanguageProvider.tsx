"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  LOCALE_COOKIE_NAME,
  type Locale,
  normalizeLocale,
} from "@/lib/i18n/config";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function persistLocale(locale: Locale) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${oneYear}; samesite=lax`;
  try {
    window.localStorage.setItem(LOCALE_COOKIE_NAME, locale);
  } catch {
    // ignore storage access failure
  }
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    try {
      const stored = normalizeLocale(window.localStorage.getItem(LOCALE_COOKIE_NAME));
      if (stored && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {
      // ignore storage access failure
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }
  return context;
}

export function useLocaleText<T>(messages: Record<Locale, T>): T {
  const { locale } = useLanguage();
  return messages[locale];
}
