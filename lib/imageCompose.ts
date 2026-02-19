"use client";

import type { LayoutJson } from "@/lib/layoutSchema";
import { denormalizeBox } from "@/lib/layoutSchema";
import { autofitTextToBox } from "@/lib/textAutofit";

type ComposeInput = {
  backgroundDataUrl: string;
  layout: LayoutJson;
  headline: string;
  subText: string;
  ctaText: string;
  badgeText?: string;
  legalText?: string;
  heroImageDataUrl?: string;
  logoImageDataUrl?: string;
  appScreenshotDataUrl?: string;
  deviceMockup?: "phone" | "none";
  options?: {
    fontFamily?: string;
    autoReadabilityPanel?: boolean;
  };
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compose."));
    img.src = src;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(l1: number, l2: number): number {
  const [a, b] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function sampleRegionLuminance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): { avg: number; stdev: number } {
  const samples = 90;
  const values: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    const sx = Math.floor(x + Math.random() * Math.max(1, w));
    const sy = Math.floor(y + Math.random() * Math.max(1, h));
    const data = ctx.getImageData(sx, sy, 1, 1).data;
    const lum = relativeLuminance(data[0], data[1], data[2]);
    values.push(lum);
  }

  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / values.length;
  return { avg, stdev: Math.sqrt(variance) };
}

function pickTextColorForBackground(bgLum: number): string {
  // Simple split: use white on dark, deep navy on bright.
  return bgLum < 0.42 ? "#ffffff" : "#0b1220";
}

function drawReadabilityPanel(params: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  bgLum: number;
}) {
  const { ctx, x, y, w, h, bgLum } = params;
  const panel =
    bgLum < 0.42 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.55)";
  roundRectPath(ctx, x, y, w, h, 26);
  ctx.fillStyle = panel;
  ctx.fill();
}

function drawImageIntoBox(params: {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  box: { x: number; y: number; w: number; h: number };
  paddingPx: number;
  fit: "contain" | "cover";
}) {
  const { ctx, img, box, paddingPx, fit } = params;
  const innerX = box.x + paddingPx;
  const innerY = box.y + paddingPx;
  const innerW = Math.max(box.w - paddingPx * 2, 1);
  const innerH = Math.max(box.h - paddingPx * 2, 1);

  const scale =
    fit === "cover"
      ? Math.max(innerW / img.width, innerH / img.height)
      : Math.min(innerW / img.width, innerH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = innerX + (innerW - drawW) / 2;
  const dy = innerY + (innerH - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function drawImageCover(params: {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const { ctx, img, x, y, w, h } = params;
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = x + (w - drawW) / 2;
  const dy = y + (h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

async function renderPhoneScreenshotMockup(params: {
  ctx: CanvasRenderingContext2D;
  screenshotUrl: string;
  box: { x: number; y: number; w: number; h: number };
}) {
  const { ctx, screenshotUrl, box } = params;
  const frameUrl = "/device-mockups/phone-frame.png";
  const [frame, shot] = await Promise.all([loadImage(frameUrl), loadImage(screenshotUrl)]);

  const fw = frame.width;
  const fh = frame.height;

  // Fit the device into the hero box.
  const scale = Math.min(box.w / fw, box.h / fh);
  const drawW = fw * scale;
  const drawH = fh * scale;
  const dx = box.x + (box.w - drawW) / 2;
  const dy = box.y + (box.h - drawH) / 2;

  // Screen rect: matches the SVG generator used for phone-frame.png.
  const screen = {
    x: 110 * scale,
    y: 180 * scale,
    w: (fw - 220) * scale,
    h: (fh - 360) * scale,
    r: 80 * scale,
  };

  ctx.save();
  roundRectPath(ctx, dx + screen.x, dy + screen.y, screen.w, screen.h, screen.r);
  ctx.clip();
  drawImageCover({
    ctx,
    img: shot,
    x: dx + screen.x,
    y: dy + screen.y,
    w: screen.w,
    h: screen.h,
  });
  ctx.restore();

  // Frame overlay.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(frame, dx, dy, drawW, drawH);
  ctx.restore();
}

function renderTextInBox(params: {
  ctx: CanvasRenderingContext2D;
  box: { x: number; y: number; w: number; h: number };
  config: { align: "left" | "center" | "right"; maxLines: number; paddingPx: number; minFontPx: number };
  text: string;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
  autoPanel: boolean;
}) {
  const { ctx, box, config, text, fontFamily, fontWeight, lineHeight, autoPanel } = params;
  const innerX = box.x + config.paddingPx;
  const innerY = box.y + config.paddingPx;
  const innerW = Math.max(box.w - config.paddingPx * 2, 1);
  const innerH = Math.max(box.h - config.paddingPx * 2, 1);

  const stats = sampleRegionLuminance(ctx, box.x, box.y, box.w, box.h);
  const textColor = pickTextColorForBackground(stats.avg);

  if (autoPanel) {
    const blackLum = 0;
    const whiteLum = 1;
    const best =
      textColor === "#ffffff"
        ? contrastRatio(stats.avg, whiteLum)
        : contrastRatio(stats.avg, blackLum);
    const busy = stats.stdev > 0.19;
    if (busy || best < 4) {
      drawReadabilityPanel({
        ctx,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        bgLum: stats.avg,
      });
    }
  }

  const fit = autofitTextToBox({
    text,
    boxWidthPx: box.w,
    boxHeightPx: box.h,
    paddingPx: config.paddingPx,
    maxLines: config.maxLines,
    minFontSizePx: config.minFontPx,
    lineHeight,
    measureForFont: (fontSizePx) => (candidate) => {
      ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
      return ctx.measureText(candidate).width;
    },
  });

  ctx.save();
  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";
  ctx.font = `${fontWeight} ${fit.fontSizePx}px ${fontFamily}`;
  ctx.textAlign = config.align;

  const anchorX =
    config.align === "left"
      ? innerX
      : config.align === "center"
        ? innerX + innerW / 2
        : innerX + innerW;

  let cursorY = innerY;
  for (const line of fit.lines) {
    ctx.fillText(line, anchorX, cursorY);
    cursorY += fit.lineHeightPx;
    if (cursorY > innerY + innerH + 1) break;
  }
  ctx.restore();
}

function renderTextBlock(params: {
  ctx: CanvasRenderingContext2D;
  layout: LayoutJson;
  kind: "headline" | "subtext";
  text: string;
  fontFamily: string;
  autoPanel: boolean;
}) {
  const { ctx, layout, kind, text, fontFamily, autoPanel } = params;
  const config = kind === "headline" ? layout.headline : layout.subtext;
  const box = denormalizeBox(config.box, layout.canvas);
  renderTextInBox({
    ctx,
    box,
    config,
    text,
    fontFamily,
    fontWeight: kind === "headline" ? 800 : 600,
    lineHeight: 1.15,
    autoPanel,
  });
}

function renderCta(params: {
  ctx: CanvasRenderingContext2D;
  layout: LayoutJson;
  text: string;
  fontFamily: string;
}) {
  const { ctx, layout, text, fontFamily } = params;
  const config = layout.cta;
  const box = denormalizeBox(config.box, layout.canvas);

  const bg = "#0f766e";
  const border = "rgba(2,6,23,0.18)";

  ctx.save();
  // Button
  roundRectPath(ctx, box.x, box.y, box.w, box.h, config.radiusPx);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();

  // Text
  const fit = autofitTextToBox({
    text,
    boxWidthPx: box.w,
    boxHeightPx: box.h,
    paddingPx: config.paddingPx,
    maxLines: 1,
    minFontSizePx: config.minFontPx,
    lineHeight: 1,
    measureForFont: (fontSizePx) => (candidate) => {
      ctx.font = `800 ${fontSizePx}px ${fontFamily}`;
      return ctx.measureText(candidate).width;
    },
  });

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fit.fontSizePx}px ${fontFamily}`;
  ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
  ctx.restore();
}

export async function composeDeterministicCreative(
  input: ComposeInput,
): Promise<string> {
  const { layout } = input;
  const w = layout.canvas.width;
  const h = layout.canvas.height;
  const fontFamily =
    input.options?.fontFamily ||
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  const autoPanel = input.options?.autoReadabilityPanel ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available.");
  }

  const bg = await loadImage(input.backgroundDataUrl);

  // Cover-draw the background.
  const scale = Math.max(w / bg.width, h / bg.height);
  const drawW = bg.width * scale;
  const drawH = bg.height * scale;
  const dx = (w - drawW) / 2;
  const dy = (h - drawH) / 2;
  ctx.drawImage(bg, dx, dy, drawW, drawH);

  const screenshotUrl = input.appScreenshotDataUrl?.trim();
  const mockup = input.deviceMockup ?? "none";
  const heroUrl = input.heroImageDataUrl?.trim();

  if (screenshotUrl && mockup === "phone") {
    try {
      const heroBox = denormalizeBox(layout.hero.box, layout.canvas);
      await renderPhoneScreenshotMockup({ ctx, screenshotUrl, box: heroBox });
    } catch {
      // ignore screenshot mockup failures
    }
  } else if (heroUrl) {
    try {
      const heroImg = await loadImage(heroUrl);
      const heroBox = denormalizeBox(layout.hero.box, layout.canvas);
      ctx.save();
      ctx.globalAlpha = 1;
      drawImageIntoBox({
        ctx,
        img: heroImg,
        box: heroBox,
        paddingPx: layout.hero.paddingPx,
        fit: layout.hero.fit,
      });
      ctx.restore();
    } catch {
      // ignore hero render failures
    }
  }

  const logoUrl = input.logoImageDataUrl?.trim();
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoBox = denormalizeBox(layout.logo.box, layout.canvas);
      ctx.save();
      ctx.globalAlpha = 1;
      drawImageIntoBox({
        ctx,
        img: logoImg,
        box: logoBox,
        paddingPx: layout.logo.paddingPx,
        fit: layout.logo.fit,
      });
      ctx.restore();
    } catch {
      // ignore logo render failures
    }
  }

  const headline = input.headline.trim();
  const subText = input.subText.trim();
  const cta = input.ctaText.trim();
  const badge = (input.badgeText ?? "").trim();
  const legal = (input.legalText ?? "").trim();

  if (headline) {
    renderTextBlock({
      ctx,
      layout,
      kind: "headline",
      text: headline,
      fontFamily,
      autoPanel,
    });
  }
  if (subText) {
    renderTextBlock({
      ctx,
      layout,
      kind: "subtext",
      text: subText,
      fontFamily,
      autoPanel,
    });
  }
  if (cta) {
    renderCta({ ctx, layout, text: cta, fontFamily });
  }
  if (badge && layout.badge) {
    const box = denormalizeBox(layout.badge.box, layout.canvas);
    const bgStats = sampleRegionLuminance(ctx, box.x, box.y, box.w, box.h);
    const fill =
      bgStats.avg < 0.42 ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.35)";
    const textColor = bgStats.avg < 0.42 ? "#0b1220" : "#ffffff";
    ctx.save();
    roundRectPath(ctx, box.x, box.y, box.w, box.h, Math.round(box.h / 2));
    ctx.fillStyle = fill;
    ctx.fill();
    const fit = autofitTextToBox({
      text: badge,
      boxWidthPx: box.w,
      boxHeightPx: box.h,
      paddingPx: layout.badge.paddingPx,
      maxLines: layout.badge.maxLines,
      minFontSizePx: layout.badge.minFontPx,
      lineHeight: 1,
      measureForFont: (fontSizePx) => (candidate) => {
        ctx.font = `800 ${fontSizePx}px ${fontFamily}`;
        return ctx.measureText(candidate).width;
      },
    });
    ctx.fillStyle = textColor;
    ctx.textAlign = layout.badge.align;
    ctx.textBaseline = "middle";
    ctx.font = `800 ${fit.fontSizePx}px ${fontFamily}`;
    const innerX = box.x + layout.badge.paddingPx;
    const innerW = Math.max(box.w - layout.badge.paddingPx * 2, 1);
    const anchorX =
      layout.badge.align === "left"
        ? innerX
        : layout.badge.align === "center"
          ? innerX + innerW / 2
          : innerX + innerW;
    ctx.fillText(fit.lines.join(" "), anchorX, box.y + box.h / 2);
    ctx.restore();
  }
  if (legal && layout.legal) {
    const box = denormalizeBox(layout.legal.box, layout.canvas);
    renderTextInBox({
      ctx,
      box,
      config: layout.legal,
      text: legal,
      fontFamily,
      fontWeight: 500,
      lineHeight: 1.1,
      autoPanel: false,
    });
  }

  return canvas.toDataURL("image/png");
}
