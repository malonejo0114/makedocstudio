"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getAccessTokenWithRefresh(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return data.session.access_token;
  }

  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token ?? null;
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
  let token = await getAccessTokenWithRefresh();
  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const makeRequest = async (accessToken: string) => {
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, {
      ...init,
      headers,
    });
  };

  let response = await makeRequest(token);

  if (response.status === 401) {
    const refreshedToken = await getAccessTokenWithRefresh();
    if (refreshedToken && refreshedToken !== token) {
      token = refreshedToken;
      response = await makeRequest(token);
    }
  }

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
    const payloadTooLarge =
      response.status === 413 ||
      errorFromJson.includes("FUNCTION_PAYLOAD_TOO_LARGE") ||
      rawText.includes("FUNCTION_PAYLOAD_TOO_LARGE");
    if (payloadTooLarge) {
      throw new Error(
        "업로드 이미지 용량이 너무 큽니다. 3MB 이하(권장 2000px 이하)로 줄여 다시 시도해 주세요.",
      );
    }
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
