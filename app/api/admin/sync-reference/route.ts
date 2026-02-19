import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { readReferenceMetadata } from "@/lib/referenceMetadata";
import { getSupabaseServiceClient } from "@/lib/supabase";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function isValidFilename(filename: string): boolean {
  if (!filename || typeof filename !== "string") {
    return false;
  }
  if (filename.includes("/") || filename.includes("\\")) {
    return false;
  }
  return filename === path.basename(filename);
}

function mimeTypeFromExt(ext: string): string {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const filename =
      typeof payload?.filename === "string" ? payload.filename.trim() : "";

    if (!isValidFilename(filename) || !isImageFile(filename)) {
      return NextResponse.json({ error: "유효한 이미지 파일명이 필요합니다." }, { status: 400 });
    }

    const imagePath = path.join(process.cwd(), "public", "reference-library", filename);
    try {
      await fs.access(imagePath);
    } catch {
      return NextResponse.json({ error: `파일을 찾을 수 없습니다: ${filename}` }, { status: 404 });
    }

    const metadata = await readReferenceMetadata();
    const meta = metadata[filename] ?? {};
    const ext = path.extname(filename).toLowerCase();
    const contentType = mimeTypeFromExt(ext);

    const supabase = getSupabaseServiceClient();
    const bytes = await fs.readFile(imagePath);

    // Upload the local file into Supabase Storage so image_url is globally accessible.
    const storagePath = `reference-templates/${filename}`;
    const upload = await supabase.storage.from("references").upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      return NextResponse.json(
        { error: `Storage upload failed: ${upload.error.message}` },
        { status: 500 },
      );
    }

    const publicUrl = supabase.storage
      .from("references")
      .getPublicUrl(storagePath).data.publicUrl;

    const richPayload = {
      category: meta.category || "로컬-마이그레이션",
      image_url: publicUrl,
      description: meta.description || `Migrated from local file: ${filename}`,
      visual_guide: meta.visual_guide || "",
      headline_style: meta.headline_style || "",
      sub_text_style: meta.sub_text_style || "",
      cta_style: meta.cta_style || "",
    };

    let insertError: string | null = null;
    const richInsert = await supabase
      .from("reference_templates")
      .insert(richPayload)
      .select("id, category, image_url, description")
      .single();

    if (!richInsert.error) {
      return NextResponse.json(
        { ok: true, mode: "rich", row: richInsert.data, storagePath, image_url: publicUrl },
        { status: 200 },
      );
    }
    insertError = richInsert.error.message;

    const legacyInsert = await supabase
      .from("reference_templates")
      .insert({
        category: richPayload.category,
        image_url: publicUrl,
        description: richPayload.description,
      })
      .select("id, category, image_url, description")
      .single();

    if (legacyInsert.error) {
      return NextResponse.json(
        {
          error: "Supabase 저장 실패",
          detail: `${insertError} | fallback: ${legacyInsert.error.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, mode: "legacy", row: legacyInsert.data, storagePath, image_url: publicUrl },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/admin/sync-reference] failed:", error);
    return NextResponse.json({ error: "Supabase 동기화 실패" }, { status: 500 });
  }
}
