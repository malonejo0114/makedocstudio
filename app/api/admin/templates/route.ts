import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServiceClient } from "@/lib/supabase";

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  analysisJson: z.unknown().optional(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeExt(file: File): string {
  const ext = path.extname(file.name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ext;
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  return ".png";
}

function tryParseAnalysisJson(raw: string): unknown | null {
  const input = raw.trim();
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("analysisJson 형식이 올바른 JSON이 아닙니다.");
  }
}

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
    message.includes("column") && message.includes("templates")
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();
    let rows: any = await supabase
      .from("templates")
      .select("id, title, tags, image_url, analysis_json, is_featured, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (isMissingAnalysisJsonColumn(rows.error)) {
      rows = await supabase
        .from("templates")
        .select("id, title, tags, image_url, is_featured, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(300);
    }

    if (rows.error) {
      return NextResponse.json(
        { error: `템플릿 목록을 불러오지 못했습니다. (${rows.error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        items: (rows.data ?? []).map((row: any) => ({
          id: row.id,
          title: row.title,
          tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
          imageUrl: row.image_url,
          analysisJson: (row as { analysis_json?: unknown }).analysis_json ?? null,
          isFeatured: row.is_featured,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 목록 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const titleRaw = String(formData.get("title") || "").trim();
    const tagsRaw = String(formData.get("tags") || "");
    const featuredRaw = String(formData.get("isFeatured") || "false");
    const analysisJsonRaw = String(formData.get("analysisJson") || "");

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "업로드할 이미지를 선택해 주세요." }, { status: 400 });
    }

    const title = titleRaw || "새 템플릿";
    const tags = normalizeTags(tagsRaw);
    const isFeatured = featuredRaw === "true";
    const analysisJson = tryParseAnalysisJson(analysisJsonRaw);

    const ext = normalizeExt(image);
    const key = `templates/${Date.now()}-${sanitizeName(path.parse(image.name).name || "tpl")}${ext}`;

    const supabase = getSupabaseServiceClient();
    const upload = await supabase.storage
      .from("studio-assets")
      .upload(key, Buffer.from(await image.arrayBuffer()), {
        contentType: image.type || "image/png",
        upsert: false,
      });

    if (upload.error) {
      return NextResponse.json(
        { error: `템플릿 이미지 업로드 실패 (${upload.error.message})` },
        { status: 500 },
      );
    }

    const imageUrl = supabase.storage.from("studio-assets").getPublicUrl(key).data.publicUrl;

    let insert: any = await supabase
      .from("templates")
      .insert({
        title,
        tags,
        image_url: imageUrl,
        analysis_json: analysisJson,
        is_featured: isFeatured,
      })
      .select("id, title, tags, image_url, analysis_json, is_featured, created_at, updated_at")
      .single();

    if (isMissingAnalysisJsonColumn(insert.error)) {
      insert = await supabase
        .from("templates")
        .insert({
          title,
          tags,
          image_url: imageUrl,
          is_featured: isFeatured,
        })
        .select("id, title, tags, image_url, is_featured, created_at, updated_at")
        .single();
    }

    if (insert.error || !insert.data) {
      return NextResponse.json(
        { error: `템플릿 저장 실패 (${insert.error?.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        item: {
          id: insert.data.id,
          title: insert.data.title,
          tags: Array.isArray(insert.data.tags) ? insert.data.tags.map(String) : [],
          imageUrl: insert.data.image_url,
          analysisJson: (insert.data as { analysis_json?: unknown }).analysis_json ?? null,
          isFeatured: insert.data.is_featured,
          createdAt: insert.data.created_at,
          updatedAt: insert.data.updated_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "수정 요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
    if (parsed.data.isFeatured !== undefined) updates.is_featured = parsed.data.isFeatured;
    if (parsed.data.analysisJson !== undefined) updates.analysis_json = parsed.data.analysisJson;

    const supabase = getSupabaseServiceClient();
    let row: any = await supabase
      .from("templates")
      .update(updates)
      .eq("id", parsed.data.id)
      .select("id, title, tags, image_url, analysis_json, is_featured, created_at, updated_at")
      .single();

    if (isMissingAnalysisJsonColumn(row.error)) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.analysis_json;
      row = await supabase
        .from("templates")
        .update(fallbackUpdates)
        .eq("id", parsed.data.id)
        .select("id, title, tags, image_url, is_featured, created_at, updated_at")
        .single();
    }

    if (row.error || !row.data) {
      return NextResponse.json(
        { error: `템플릿 수정 실패 (${row.error?.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        item: {
          id: row.data.id,
          title: row.data.title,
          tags: Array.isArray(row.data.tags) ? row.data.tags.map(String) : [],
          imageUrl: row.data.image_url,
          analysisJson: (row.data as { analysis_json?: unknown }).analysis_json ?? null,
          isFeatured: row.data.is_featured,
          createdAt: row.data.created_at,
          updatedAt: row.data.updated_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 수정 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = DeleteSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "삭제 요청 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();
    const row = await supabase.from("templates").delete().eq("id", parsed.data.id).select("id").single();

    if (row.error || !row.data) {
      return NextResponse.json({ error: "템플릿을 삭제할 수 없습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: row.data.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "템플릿 삭제 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
