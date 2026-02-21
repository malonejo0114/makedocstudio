import { getSupabaseServiceClient } from "@/lib/supabase";

const TABLE = "prompt_overrides";

type PromptOverrideRow = {
  filename: string;
  content: string | null;
  updated_at: string | null;
};

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("prompt_overrides")
  );
}

export async function getPromptOverride(filename: string): Promise<{ content: string; updatedAt: string } | null> {
  const key = filename.trim();
  if (!key) return null;

  try {
    const supabase = getSupabaseServiceClient();
    const query = await supabase
      .from(TABLE)
      .select("filename, content, updated_at")
      .eq("filename", key)
      .maybeSingle();

    if (query.error) {
      if (isMissingTableError(query.error)) return null;
      throw new Error(`프롬프트 오버라이드 조회 실패 (${query.error.message})`);
    }

    if (!query.data) return null;
    return {
      content: String(query.data.content ?? ""),
      updatedAt: String(query.data.updated_at ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export async function listPromptOverrides() {
  try {
    const supabase = getSupabaseServiceClient();
    const query = await supabase
      .from(TABLE)
      .select("filename, content, updated_at");

    if (query.error) {
      if (isMissingTableError(query.error)) return new Map<string, { content: string; updatedAt: string }>();
      throw new Error(`프롬프트 오버라이드 목록 조회 실패 (${query.error.message})`);
    }

    const map = new Map<string, { content: string; updatedAt: string }>();
    for (const row of (query.data ?? []) as PromptOverrideRow[]) {
      const filename = String(row.filename || "").trim();
      if (!filename) continue;
      map.set(filename, {
        content: String(row.content ?? ""),
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
      });
    }
    return map;
  } catch {
    return new Map<string, { content: string; updatedAt: string }>();
  }
}

export async function savePromptOverride(filename: string, content: string) {
  const key = filename.trim();
  if (!key) {
    throw new Error("파일명이 비어 있습니다.");
  }

  const supabase = getSupabaseServiceClient();
  const upsert = await supabase
    .from(TABLE)
    .upsert(
      {
        filename: key,
        content,
      },
      {
        onConflict: "filename",
        ignoreDuplicates: false,
      },
    )
    .select("filename, content, updated_at")
    .single();

  if (upsert.error || !upsert.data) {
    if (isMissingTableError(upsert.error)) {
      throw new Error(
        "prompt_overrides 테이블이 없습니다. Supabase SQL Editor에서 최신 마이그레이션(20260222_000015_runtime_hotfixes.sql)을 실행해 주세요.",
      );
    }
    throw new Error(`프롬프트 오버라이드 저장 실패 (${upsert.error?.message ?? "unknown"})`);
  }

  return {
    content: String(upsert.data.content ?? ""),
    updatedAt: String(upsert.data.updated_at ?? new Date().toISOString()),
  };
}
