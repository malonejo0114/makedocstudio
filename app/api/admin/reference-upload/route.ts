import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function sanitizeBaseName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function resolveExtension(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName;
  }

  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
}

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "multipart/form-data 형식으로 요청해 주세요." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const preferredNameRaw = formData.get("filename");
    const storageTarget = readText(formData, "storageTarget") || "supabase";
    const preferredName =
      typeof preferredNameRaw === "string" ? preferredNameRaw.trim() : "";
    const category = readText(formData, "category") || "관리자 템플릿";
    const description = readText(formData, "description");
    const visualGuide = readText(formData, "visual_guide");
    const headlineStyle = readText(formData, "headline_style");
    const subTextStyle = readText(formData, "sub_text_style");
    const ctaStyle = readText(formData, "cta_style");

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        { error: "업로드할 이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }

    const extension = resolveExtension(image.name, image.type);
    if (!extension) {
      return NextResponse.json(
        { error: "지원하지 않는 이미지 형식입니다. (jpg, png, webp)" },
        { status: 400 },
      );
    }

    const base = sanitizeBaseName(preferredName || path.parse(image.name).name) || "ref";
    const filename = `${Date.now()}-${base}${extension}`;

    if (storageTarget === "local") {
      const dir = path.join(process.cwd(), "public", "reference-library");
      const target = path.join(dir, filename);

      await fs.mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await image.arrayBuffer());
      await fs.writeFile(target, buffer);

      return NextResponse.json(
        {
          ok: true,
          source: "local",
          filename,
          image_url: `/reference-library/${encodeURIComponent(filename)}`,
        },
        { status: 200 },
      );
    }

    if (storageTarget !== "supabase") {
      return NextResponse.json(
        { error: "storageTarget must be 'supabase' or 'local'." },
        { status: 400 },
      );
    }

    let supabase;
    try {
      supabase = getSupabaseServiceClient();
    } catch (err) {
      return NextResponse.json(
        { error: errorMessage(err, "Supabase 관리자 키 설정이 필요합니다.") },
        { status: 500 },
      );
    }
    const storagePath = `reference-templates/${filename}`;
    const bytes = Buffer.from(await image.arrayBuffer());
    const upload = await supabase.storage
      .from("references")
      .upload(storagePath, bytes, {
        contentType: image.type || "image/jpeg",
        upsert: false,
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

    const richInsert = await supabase
      .from("reference_templates")
      .insert({
        category,
        image_url: publicUrl,
        description: description || null,
        visual_guide: visualGuide || null,
        headline_style: headlineStyle || null,
        sub_text_style: subTextStyle || null,
        cta_style: ctaStyle || null,
      })
      .select(
        "id, category, image_url, description, created_at, visual_guide, headline_style, sub_text_style, cta_style",
      )
      .single();

    if (!richInsert.error) {
      return NextResponse.json(
        { ok: true, source: "supabase", row: richInsert.data, filename, storagePath },
        { status: 200 },
      );
    }

    const legacyInsert = await supabase
      .from("reference_templates")
      .insert({
        category,
        image_url: publicUrl,
        description: description || null,
      })
      .select("id, category, image_url, description, created_at")
      .single();

    if (legacyInsert.error) {
      return NextResponse.json(
        {
          error: `DB insert failed: ${richInsert.error.message} | fallback: ${legacyInsert.error.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        source: "supabase",
        mode: "legacy",
        row: legacyInsert.data,
        filename,
        storagePath,
        image_url: publicUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/admin/reference-upload] failed:", error);
    return NextResponse.json(
      { error: errorMessage(error, "레퍼런스 업로드에 실패했습니다.") },
      { status: 500 },
    );
  }
}
