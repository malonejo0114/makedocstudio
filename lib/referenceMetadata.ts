import { promises as fs } from "node:fs";
import path from "node:path";

export type LocalReferenceMetadata = {
  category?: string;
  description?: string;
  tags?: string[];
  visual_guide?: string;
  headline_style?: string;
  sub_text_style?: string;
  cta_style?: string;
};

export type LocalReferenceMetadataMap = Record<string, LocalReferenceMetadata>;

const DATA_DIR = path.join(process.cwd(), "data");
const METADATA_FILE = path.join(DATA_DIR, "reference-library.metadata.json");

function sanitizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export function sanitizeMetadata(input: unknown): LocalReferenceMetadata {
  const raw = (input ?? {}) as Record<string, unknown>;
  const next: LocalReferenceMetadata = {};

  const category = sanitizeText(raw.category);
  if (category !== undefined) next.category = category;

  const description = sanitizeText(raw.description);
  if (description !== undefined) next.description = description;

  const tags = sanitizeTags(raw.tags);
  if (tags !== undefined) next.tags = tags;

  const visualGuide = sanitizeText(raw.visual_guide);
  if (visualGuide !== undefined) next.visual_guide = visualGuide;

  const headlineStyle = sanitizeText(raw.headline_style);
  if (headlineStyle !== undefined) next.headline_style = headlineStyle;

  const subTextStyle = sanitizeText(raw.sub_text_style);
  if (subTextStyle !== undefined) next.sub_text_style = subTextStyle;

  const ctaStyle = sanitizeText(raw.cta_style);
  if (ctaStyle !== undefined) next.cta_style = ctaStyle;

  return next;
}

export async function readReferenceMetadata(): Promise<LocalReferenceMetadataMap> {
  try {
    const raw = await fs.readFile(METADATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: LocalReferenceMetadataMap = {};
    for (const [filename, meta] of Object.entries(parsed)) {
      result[filename] = sanitizeMetadata(meta);
    }
    return result;
  } catch {
    return {};
  }
}

export async function writeReferenceMetadata(
  map: LocalReferenceMetadataMap,
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(METADATA_FILE, JSON.stringify(map, null, 2), "utf-8");
}
