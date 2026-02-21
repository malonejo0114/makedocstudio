"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signOutStudioUser() {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function authFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  let payload: unknown = null;
  let rawText = "";

  if (contentType.toLowerCase().includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    rawText = await response.text().catch(() => "");
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    const errorFromJson =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error ?? "")
        : "";
    const fallbackText = rawText
      ? rawText.replace(/\s+/g, " ").slice(0, 180)
      : `요청 처리 중 오류가 발생했습니다. (HTTP ${response.status})`;
    throw new Error(errorFromJson || fallbackText);
  }

  if (payload !== null) {
    return payload as T;
  }

  return {} as T;
}

export function formatKrw(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
