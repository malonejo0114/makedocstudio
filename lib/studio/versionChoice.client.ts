"use client";

export type StudioVersionChoice = "classic" | "update";

const STUDIO_VERSION_STORAGE_KEY = "mkdoc:studio:version-choice";

export function getStudioVersionRoute(version: StudioVersionChoice): string {
  return version === "classic" ? "/studio-classic" : "/studio";
}

export function getStoredStudioVersionChoice(): StudioVersionChoice | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STUDIO_VERSION_STORAGE_KEY);
  if (raw === "classic" || raw === "update") return raw;
  return null;
}

export function setStoredStudioVersionChoice(version: StudioVersionChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDIO_VERSION_STORAGE_KEY, version);
}

export function clearStoredStudioVersionChoice() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STUDIO_VERSION_STORAGE_KEY);
}
