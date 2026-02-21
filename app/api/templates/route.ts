import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase";

function isMissingAnalysisJsonColumn(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("analysis_json") ||
    (message.includes("column") && message.includes("templates"))
  );
}

function containsQuery(title: string, tags: string[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [title.toLowerCase(), ...tags.map((tag) => tag.toLowerCase())].some((text) =>
    text.includes(q),
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const featuredOnly = url.searchParams.get("featured") === "1";

    const supabase = getSupabaseServiceClient();
    let req = supabase
      .from("templates")
      .select("id, title, tags, image_url, analysis_json, is_featured, created_at")
      .order("created_at", { ascending: false });

    if (featuredOnly) {
      req = req.eq("is_featured", true);
    }

    let rows: any = await req.limit(120);
    if (isMissingAnalysisJsonColumn(rows.error)) {
      let fallbackReq = supabase
        .from("templates")
        .select("id, title, tags, image_url, is_featured, created_at")
        .order("created_at", { ascending: false });
      if (featuredOnly) {
        fallbackReq = fallbackReq.eq("is_featured", true);
      }
      rows = await fallbackReq.limit(120);
    }

    if (rows.error) {
      return NextResponse.json(
        { error: `템플릿을 불러오지 못했습니다. (${rows.error.message})` },
        { status: 500 },
      );
    }

    const items = (rows.data ?? [])
      .map((row: any) => ({
        id: row.id,
        title: row.title,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        imageUrl: row.image_url,
        analysisJson: (row as { analysis_json?: unknown }).analysis_json ?? null,
        isFeatured: row.is_featured,
        createdAt: row.created_at,
      }))
      .filter((item: any) => containsQuery(item.title, item.tags, query));

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
