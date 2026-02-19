import type { LayoutJson } from "@/lib/layoutSchema";

import { fillPromptTemplate, loadPromptTemplate } from "@/lib/promptLibrary.server";

function safeQuote(input: string): string {
  return input.replace(/"/g, '\\"');
}

export async function buildBackgroundOnlyPrompt(input: {
  visualGuide: string;
  aspectRatio: string;
  width: number;
  height: number;
}): Promise<string> {
  const template = await loadPromptTemplate("background_only");
  return fillPromptTemplate(template, {
    VISUAL_GUIDE: input.visualGuide,
    ASPECT_RATIO: input.aspectRatio,
    WIDTH: input.width,
    HEIGHT: input.height,
  });
}

export async function buildFullCreativePrompt(input: {
  visualGuide: string;
  headline: string;
  subText: string;
  ctaText: string;
  badgeText?: string;
  legalText?: string;
  aspectRatio: string;
  width: number;
  height: number;
  layoutJson: LayoutJson;
}): Promise<string> {
  const template = await loadPromptTemplate("full_creative");
  const layout = input.layoutJson;
  return fillPromptTemplate(template, {
    VISUAL_GUIDE: input.visualGuide,
    MAIN_HEADLINE: safeQuote(input.headline),
    SUB_TEXT: safeQuote(input.subText),
    CTA_TEXT: safeQuote(input.ctaText),
    BADGE_TEXT: safeQuote(input.badgeText ?? ""),
    LEGAL_TEXT: safeQuote(input.legalText ?? ""),
    ASPECT_RATIO: input.aspectRatio,
    WIDTH: input.width,
    HEIGHT: input.height,
    HEADLINE_BOX: JSON.stringify(layout.headline.box),
    SUBTEXT_BOX: JSON.stringify(layout.subtext.box),
    CTA_BOX: JSON.stringify(layout.cta.box),
    BADGE_BOX: layout.badge ? JSON.stringify(layout.badge.box) : "null",
    LEGAL_BOX: layout.legal ? JSON.stringify(layout.legal.box) : "null",
    HEADLINE_MAX_LINES: layout.headline.maxLines,
    SUB_MAX_LINES: layout.subtext.maxLines,
    BADGE_MAX_LINES: layout.badge?.maxLines ?? 1,
    LEGAL_MAX_LINES: layout.legal?.maxLines ?? 2,
  });
}
