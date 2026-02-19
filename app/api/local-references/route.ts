import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import {
  readReferenceMetadata,
  sanitizeMetadata,
  writeReferenceMetadata,
} from "@/lib/referenceMetadata";

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

export async function GET() {
  try {
    const root = process.cwd();
    const dir = path.join(root, "public", "reference-library");
    const metadata = await readReferenceMetadata();

    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items = files
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => {
        const safeName = encodeURIComponent(filename);
        const meta = metadata[filename] ?? {};
        return {
          id: `local-${filename}`,
          filename,
          category: meta.category || "로컬",
          image_url: `/reference-library/${safeName}`,
          description: meta.description || `로컬 파일: ${filename}`,
          tags: meta.tags ?? [],
          visual_guide: meta.visual_guide ?? "",
          headline_style: meta.headline_style ?? "",
          sub_text_style: meta.sub_text_style ?? "",
          cta_style: meta.cta_style ?? "",
          created_at: new Date(0).toISOString(),
          source: "local",
        };
      });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("[/api/local-references] failed:", error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const filename =
      typeof payload?.filename === "string" ? payload.filename.trim() : "";

    if (!isValidFilename(filename) || !isImageFile(filename)) {
      return NextResponse.json(
        { error: "Valid image filename is required." },
        { status: 400 },
      );
    }

    const root = process.cwd();
    const imagePath = path.join(root, "public", "reference-library", filename);
    try {
      await fs.access(imagePath);
    } catch {
      return NextResponse.json(
        { error: `File not found: ${filename}` },
        { status: 404 },
      );
    }

    const metaUpdate = sanitizeMetadata(payload);
    const metadata = await readReferenceMetadata();
    metadata[filename] = {
      ...metadata[filename],
      ...metaUpdate,
    };

    await writeReferenceMetadata(metadata);

    return NextResponse.json(
      {
        ok: true,
        filename,
        metadata: metadata[filename],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/local-references] save failed:", error);
    return NextResponse.json({ error: "Failed to save metadata." }, { status: 500 });
  }
}
