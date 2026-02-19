import sharp from "sharp";

import type { BoxPx, LayoutJson, NormalizedBox } from "@/lib/layoutSchema";
import { denormalizeBox, layoutSafeZonePx } from "@/lib/layoutSchema";

function rgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function rectSvg(box: BoxPx, style: string): string {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const w = Math.round(box.w);
  const h = Math.round(box.h);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${style} />`;
}

function labelSvg(params: {
  box: BoxPx;
  label: string;
  color: string;
}): string {
  const x = Math.round(params.box.x + 8);
  const y = Math.round(params.box.y + 18);
  const safeLabel = params.label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<text x="${x}" y="${y}" font-family="ui-sans-serif,system-ui,-apple-system" font-size="14" font-weight="700" fill="${params.color}">${safeLabel}</text>`;
}

export function formatNormalizedBox(box: NormalizedBox): string {
  return JSON.stringify(box.map((v) => Math.round(v * 10000) / 10000));
}

export function buildGuideOverlaySvg(layout: LayoutJson, opts?: { showSafeZone?: boolean }) {
  const { width, height } = layout.canvas;

  const heroPx = denormalizeBox(layout.hero.box, layout.canvas);
  const logoPx = denormalizeBox(layout.logo.box, layout.canvas);
  const headlinePx = denormalizeBox(layout.headline.box, layout.canvas);
  const subPx = denormalizeBox(layout.subtext.box, layout.canvas);
  const ctaPx = denormalizeBox(layout.cta.box, layout.canvas);
  const badgePx = layout.badge ? denormalizeBox(layout.badge.box, layout.canvas) : null;
  const legalPx = layout.legal ? denormalizeBox(layout.legal.box, layout.canvas) : null;

  const headlineColor = "#ff2bd6"; // magenta
  const subColor = "#22d3ee"; // cyan
  const ctaColor = "#84cc16"; // lime
  const heroColor = "#fb923c"; // orange
  const logoColor = "#a855f7"; // violet
  const badgeColor = "#facc15"; // amber
  const legalColor = "#94a3b8"; // slate

  const safeZone = layoutSafeZonePx(layout.canvas);

  const safeZoneLayer = opts?.showSafeZone
    ? [
        rectSvg(
          safeZone,
          `fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2" stroke-dasharray="10 8"`,
        ),
        `<text x="${Math.round(safeZone.x + 8)}" y="${Math.round(
          safeZone.y + 18,
        )}" font-family="ui-sans-serif,system-ui,-apple-system" font-size="14" font-weight="700" fill="rgba(255,255,255,0.65)">SAFE_ZONE</text>`,
      ].join("")
    : "";

  const boxLayer = [
    rectSvg(
      heroPx,
      `fill="${rgba(heroColor, 0.08)}" stroke="${heroColor}" stroke-width="4"`,
    ),
    labelSvg({ box: heroPx, label: "HERO_BOX", color: heroColor }),
    rectSvg(
      logoPx,
      `fill="${rgba(logoColor, 0.08)}" stroke="${logoColor}" stroke-width="4"`,
    ),
    labelSvg({ box: logoPx, label: "LOGO_BOX", color: logoColor }),
    rectSvg(
      headlinePx,
      `fill="${rgba(headlineColor, 0.1)}" stroke="${headlineColor}" stroke-width="4"`,
    ),
    labelSvg({ box: headlinePx, label: "HEADLINE_BOX", color: headlineColor }),
    rectSvg(
      subPx,
      `fill="${rgba(subColor, 0.1)}" stroke="${subColor}" stroke-width="4"`,
    ),
    labelSvg({ box: subPx, label: "SUBTEXT_BOX", color: subColor }),
    rectSvg(
      ctaPx,
      `fill="${rgba(ctaColor, 0.1)}" stroke="${ctaColor}" stroke-width="4"`,
    ),
    labelSvg({ box: ctaPx, label: "CTA_BOX", color: ctaColor }),
    badgePx
      ? rectSvg(
          badgePx,
          `fill="${rgba(badgeColor, 0.08)}" stroke="${badgeColor}" stroke-width="4"`,
        )
      : "",
    badgePx ? labelSvg({ box: badgePx, label: "BADGE_BOX", color: badgeColor }) : "",
    legalPx
      ? rectSvg(
          legalPx,
          `fill="${rgba(legalColor, 0.06)}" stroke="${legalColor}" stroke-width="4"`,
        )
      : "",
    legalPx ? labelSvg({ box: legalPx, label: "LEGAL_BOX", color: legalColor }) : "",
  ].join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="rgba(0,0,0,0)" />`,
    safeZoneLayer,
    boxLayer,
    `</svg>`,
  ].join("");

  return svg;
}

export async function renderGuideOverlayPngBase64(
  layout: LayoutJson,
  opts?: { showSafeZone?: boolean },
) {
  const svg = buildGuideOverlaySvg(layout, opts);
  const pngBuffer = await sharp(Buffer.from(svg), { density: 72 })
    .resize(layout.canvas.width, layout.canvas.height, { fit: "fill" })
    .png()
    .toBuffer();
  const base64 = pngBuffer.toString("base64");
  return {
    mimeType: "image/png" as const,
    base64,
    dataUrl: `data:image/png;base64,${base64}`,
  };
}
