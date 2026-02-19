import { z } from "zod";

export const AspectRatioSchema = z.enum(["1:1", "4:5", "9:16"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const AlignSchema = z.enum(["left", "center", "right"]);
export type TextAlign = z.infer<typeof AlignSchema>;

export const NormalizedBoxSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);
export type NormalizedBox = z.infer<typeof NormalizedBoxSchema>;

export const LayoutTextSchema = z.object({
  box: NormalizedBoxSchema,
  align: AlignSchema,
  maxLines: z.number().int().min(1).max(10),
  paddingPx: z.number().int().min(0).max(200),
  minFontPx: z.number().int().min(8).max(200),
});
export type LayoutText = z.infer<typeof LayoutTextSchema>;

export const LayoutCtaSchema = LayoutTextSchema.extend({
  radiusPx: z.number().int().min(0).max(9999),
});
export type LayoutCta = z.infer<typeof LayoutCtaSchema>;

export const LayoutMediaSchema = z.object({
  box: NormalizedBoxSchema,
  paddingPx: z.number().int().min(0).max(200),
  fit: z.enum(["contain", "cover"]),
});
export type LayoutMedia = z.infer<typeof LayoutMediaSchema>;

export const LayoutCanvasSchema = z.object({
  width: z.number().int().min(64),
  height: z.number().int().min(64),
  aspectRatio: AspectRatioSchema,
  safeMarginRatio: z.number().min(0).max(0.3),
  gridPx: z.number().int().min(1).max(64),
});
export type LayoutCanvas = z.infer<typeof LayoutCanvasSchema>;

const LayoutSchemaV1 = z.object({
  version: z.literal(1),
  canvas: LayoutCanvasSchema,
  headline: LayoutTextSchema,
  subtext: LayoutTextSchema,
  cta: LayoutCtaSchema,
});

const LayoutSchemaV2 = z.object({
  version: z.literal(2),
  canvas: LayoutCanvasSchema,
  hero: LayoutMediaSchema,
  logo: LayoutMediaSchema,
  headline: LayoutTextSchema,
  subtext: LayoutTextSchema,
  cta: LayoutCtaSchema,
  badge: LayoutTextSchema.optional(),
  legal: LayoutTextSchema.optional(),
});

export type LayoutJson = z.infer<typeof LayoutSchemaV2>;

export const LayoutSchema: z.ZodType<LayoutJson> = z
  .union([LayoutSchemaV2, LayoutSchemaV1])
  .transform((value): LayoutJson => {
    if (value.version === 2) return value;
    const fallback = createDefaultLayout(value.canvas.aspectRatio);
    return {
      ...fallback,
      canvas: value.canvas,
      headline: value.headline,
      subtext: value.subtext,
      cta: value.cta,
    };
  });

export type BoxPx = { x: number; y: number; w: number; h: number };

export function getCanvasPreset(aspectRatio: AspectRatio): {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
} {
  if (aspectRatio === "4:5") {
    return { aspectRatio, width: 1080, height: 1350 };
  }
  if (aspectRatio === "9:16") {
    return { aspectRatio, width: 1080, height: 1920 };
  }
  return { aspectRatio: "1:1", width: 1080, height: 1080 };
}

export function denormalizeBox(
  box: NormalizedBox,
  canvas: { width: number; height: number },
): BoxPx {
  const [x, y, w, h] = box;
  return {
    x: x * canvas.width,
    y: y * canvas.height,
    w: w * canvas.width,
    h: h * canvas.height,
  };
}

export function normalizeBox(
  box: BoxPx,
  canvas: { width: number; height: number },
): NormalizedBox {
  const safe = clampBoxPx(box, canvas, { minW: 1, minH: 1 });
  return [
    safe.x / canvas.width,
    safe.y / canvas.height,
    safe.w / canvas.width,
    safe.h / canvas.height,
  ];
}

export function clampBoxPx(
  box: BoxPx,
  canvas: { width: number; height: number },
  opts?: { minW?: number; minH?: number },
): BoxPx {
  const minW = opts?.minW ?? 24;
  const minH = opts?.minH ?? 24;

  const w = Math.min(Math.max(box.w, minW), canvas.width);
  const h = Math.min(Math.max(box.h, minH), canvas.height);
  const x = Math.min(Math.max(box.x, 0), canvas.width - w);
  const y = Math.min(Math.max(box.y, 0), canvas.height - h);
  return { x, y, w, h };
}

export function createDefaultLayout(aspectRatio: AspectRatio): LayoutJson {
  const preset = getCanvasPreset(aspectRatio);

  const base: LayoutCanvas = {
    width: preset.width,
    height: preset.height,
    aspectRatio: preset.aspectRatio,
    safeMarginRatio: 0.1,
    gridPx: 8,
  };

  const heroBox: NormalizedBox =
    aspectRatio === "9:16"
      ? [0.08, 0.42, 0.84, 0.38]
      : aspectRatio === "4:5"
        ? [0.08, 0.46, 0.84, 0.3]
        : [0.08, 0.5, 0.84, 0.26];

  const logoBox: NormalizedBox =
    aspectRatio === "9:16"
      ? [0.08, 0.035, 0.22, 0.08]
      : aspectRatio === "4:5"
        ? [0.08, 0.05, 0.22, 0.08]
        : [0.08, 0.05, 0.22, 0.1];

  const headlineBox: NormalizedBox =
    aspectRatio === "9:16"
      ? [0.08, 0.08, 0.84, 0.16]
      : aspectRatio === "4:5"
        ? [0.08, 0.1, 0.84, 0.18]
        : [0.08, 0.1, 0.84, 0.22];

  const subBox: NormalizedBox =
    aspectRatio === "9:16"
      ? [0.08, 0.25, 0.84, 0.12]
      : aspectRatio === "4:5"
        ? [0.08, 0.3, 0.84, 0.14]
        : [0.08, 0.34, 0.84, 0.16];

  const ctaBox: NormalizedBox =
    aspectRatio === "9:16"
      ? [0.08, 0.84, 0.5, 0.08]
      : aspectRatio === "4:5"
        ? [0.08, 0.82, 0.5, 0.1]
        : [0.08, 0.8, 0.5, 0.12];

  return {
    version: 2,
    canvas: base,
    hero: {
      box: heroBox,
      paddingPx: 8,
      fit: "contain",
    },
    logo: {
      box: logoBox,
      paddingPx: 6,
      fit: "contain",
    },
    headline: {
      box: headlineBox,
      align: "left",
      maxLines: 2,
      paddingPx: 24,
      minFontPx: 28,
    },
    subtext: {
      box: subBox,
      align: "left",
      maxLines: 3,
      paddingPx: 24,
      minFontPx: 24,
    },
    cta: {
      box: ctaBox,
      align: "center",
      maxLines: 1,
      paddingPx: 22,
      minFontPx: 24,
      radiusPx: 999,
    },
  };
}

export function layoutSafeZonePx(canvas: LayoutCanvas): BoxPx {
  const marginX = Math.round(canvas.width * canvas.safeMarginRatio);
  const marginY = Math.round(canvas.height * canvas.safeMarginRatio);
  return {
    x: marginX,
    y: marginY,
    w: canvas.width - marginX * 2,
    h: canvas.height - marginY * 2,
  };
}
