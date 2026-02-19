"use client";

import { useCallback, useEffect, useState } from "react";

export type SiteLocale = "ko" | "en";

const STORAGE_KEY = "mkdoc-site-locale";
const DEFAULT_LOCALE: SiteLocale = "ko";

function normalizeLocale(value: string | null | undefined): SiteLocale {
  return value === "en" ? "en" : "ko";
}

function detectPreferredLocale(): SiteLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const browserLocale = window.navigator.language?.toLowerCase() ?? "";
  return browserLocale.startsWith("ko") ? "ko" : "en";
}

function getInitialLocale(): SiteLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return normalizeLocale(stored);
  }

  return detectPreferredLocale();
}

export function useSiteLocale() {
  const [locale, setLocaleState] = useState<SiteLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const next = getInitialLocale();
    setLocaleState(next);
    document.documentElement.lang = next;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const updated = normalizeLocale(event.newValue);
      setLocaleState(updated);
      document.documentElement.lang = updated;
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((next: SiteLocale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  return { locale, setLocale };
}
