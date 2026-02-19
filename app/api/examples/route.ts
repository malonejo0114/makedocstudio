import { NextResponse } from "next/server";

import EXAMPLE_SEED from "@/config/examples.seed.json";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();
    const localItems = EXAMPLE_SEED.map((item) => ({
      id: item.id,
      title: item.title,
      tags: item.tags,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      createdAt: item.createdAt,
    }));

    const featured = await supabase
      .from("templates")
      .select("id, title, tags, image_url, is_featured, created_at")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(12);

    let dbRows =
      featured.error || !featured.data
        ? []
        : featured.data.map((row) => ({
            id: row.id,
            title: row.title,
            tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
            imageUrl: row.image_url,
            isFeatured: row.is_featured,
            createdAt: row.created_at,
          }));

    if (dbRows.length < 6) {
      const fallback = await supabase
        .from("templates")
        .select("id, title, tags, image_url, is_featured, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (!fallback.error && fallback.data) {
        dbRows = fallback.data.map((row) => ({
          id: row.id,
          title: row.title,
          tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
          imageUrl: row.image_url,
          isFeatured: row.is_featured,
          createdAt: row.created_at,
        }));
      }
    }

    const merged = [...localItems];
    for (const row of dbRows) {
      if (
        merged.some((item) => item.id === row.id || item.imageUrl === row.imageUrl)
      ) {
        continue;
      }
      merged.push(row);
    }

    return NextResponse.json(
      {
        items: merged.slice(0, 12),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "예시 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
