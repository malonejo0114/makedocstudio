import sharp from "sharp";

import type { LayoutJson } from "@/lib/layoutSchema";
import { denormalizeBox } from "@/lib/layoutSchema";

type ZoneStat = { mean: number; stdev: number; areaPx: number };

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function computeGrayStats(buffer: Buffer): Promise<ZoneStat> {
  const img = sharp(buffer).greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  if (n <= 0) return { mean: 0, stdev: 0, areaPx: 0 };

  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i];
  const mean255 = sum / n;

  let varSum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const d = data[i] - mean255;
    varSum += d * d;
  }
  const variance255 = varSum / n;

  return {
    mean: mean255 / 255,
    stdev: Math.sqrt(variance255) / 255,
    areaPx: n,
  };
}

export async function scoreReservedZones(params: {
  imageBase64: string;
  mimeType: string;
  layout: LayoutJson;
}) {
  const buffer = Buffer.from(params.imageBase64, "base64");
  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width ?? params.layout.canvas.width;
  const height = meta.height ?? params.layout.canvas.height;

  const zones: Array<{ id: string; box: { x: number; y: number; w: number; h: number } }> = [
    { id: "hero", box: denormalizeBox(params.layout.hero.box, { width, height }) },
    { id: "logo", box: denormalizeBox(params.layout.logo.box, { width, height }) },
    { id: "headline", box: denormalizeBox(params.layout.headline.box, { width, height }) },
    { id: "subtext", box: denormalizeBox(params.layout.subtext.box, { width, height }) },
    { id: "cta", box: denormalizeBox(params.layout.cta.box, { width, height }) },
    ...(params.layout.badge
      ? [{ id: "badge", box: denormalizeBox(params.layout.badge.box, { width, height }) }]
      : []),
    ...(params.layout.legal
      ? [{ id: "legal", box: denormalizeBox(params.layout.legal.box, { width, height }) }]
      : []),
  ];

  const stats: Record<string, ZoneStat> = {};
  for (const z of zones) {
    const x = clampInt(z.box.x, 0, Math.max(0, width - 1));
    const y = clampInt(z.box.y, 0, Math.max(0, height - 1));
    const w = clampInt(z.box.w, 1, Math.max(1, width - x));
    const h = clampInt(z.box.h, 1, Math.max(1, height - y));

    const region = await image
      .clone()
      .extract({ left: x, top: y, width: w, height: h })
      .toBuffer();
    stats[z.id] = await computeGrayStats(region);
  }

  // Score: prefer low detail/variance in reserved zones.
  // Typical "clean" areas are ~0.06-0.14 stdev depending on gradients.
  const threshold = 0.16;
  let penalty = 0;
  for (const s of Object.values(stats)) {
    penalty += Math.max(0, s.stdev - threshold);
  }
  const score = Math.max(0, Math.round(100 - penalty * 220));

  return { score, stats, width, height };
}

