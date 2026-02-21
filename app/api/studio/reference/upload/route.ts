import path from "node:path";

import { NextResponse } from "next/server";

import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

type AssetType = "reference" | "product" | "logo" | "person";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function sanitizeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeExtension(file: File): string {
  const ext = path.extname(file.name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext;
  }

  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".png";
}

function parseAssetType(value: FormDataEntryValue | null): AssetType {
  if (value === "product" || value === "logo" || value === "person") {
    return value;
  }
  return "reference";
}

export async function POST(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("referenceImage");
    const assetType = parseAssetType(formData.get("assetType"));

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "업로드할 이미지를 선택해 주세요." },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "이미지 용량이 너무 큽니다. 파일당 최대 4MB까지 업로드할 수 있습니다." },
        { status: 413 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const ext = normalizeExtension(file);
    const base = sanitizeFilename(path.parse(file.name).name || assetType);
    const key = `users/${user.id}/studio-assets/${assetType}/${Date.now()}-${base}${ext}`;

    const supabase = getSupabaseServiceClient();
    const bytes = Buffer.from(await file.arrayBuffer());

    const upload = await supabase.storage
      .from("studio-assets")
      .upload(key, bytes, {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (upload.error) {
      return NextResponse.json(
        { error: `이미지 업로드에 실패했습니다. (${upload.error.message})` },
        { status: 500 },
      );
    }

    const url = supabase.storage.from("studio-assets").getPublicUrl(key).data.publicUrl;

    return NextResponse.json(
      {
        ok: true,
        assetType,
        imageUrl: url,
        referenceImageUrl: url,
        storagePath: key,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
