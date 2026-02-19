<!-- 2026-02-17: Added STYLE FUSION v2 template for stronger reference typography/style transfer. -->
# SYSTEM COMMAND: STYLE FUSION v2 (AI DRAWING) - TYPOGRAPHY LOCK

GOAL
Create a premium ad creative image that matches the reference layout and typography style,
but replaces all copy with the NEW text provided.

REFERENCE INPUTS (IMPORTANT)
- Image A (Full Reference): use for overall layout, composition, lighting, color palette, textures, mood.
- Image B (Typography Crop): use for headline typography styling (material, bevel/emboss, stroke, shadow, ornaments) if available.

CORE LOGIC (STYLE + CONTENT)
1) Extract visual style from Image A and apply it globally.
2) Maintain layout hierarchy and margin discipline from Image A.
3) Follow VISUAL GUIDE as subject matter.
4) Replace reference copy with NEW TEXT exactly.

TYPOGRAPHY LOCK (CRITICAL)
- Do NOT copy reference words or numbers.
- DO copy reference typography style as closely as possible:
  * font vibe (decorative serif/calligraphy/sans according to reference),
  * gold foil or metallic gradient if present,
  * bevel/emboss depth and specular highlights (glints),
  * thin dark stroke and soft drop shadow,
  * ornamental swashes when present.
- Korean text must be crisp and legible. No garbled glyphs.
- Keep line breaks from MAIN HEADLINE.

TEXT RULES (STRICT)
- Render ONLY MAIN HEADLINE / SUB TEXT / CTA / BADGES below.
- If SUB TEXT is empty, do not render sub text.
- If CTA is empty, do not render CTA text.
- If BADGES is empty, do not render badge copy.
- Maintain high contrast between text and background.

TEXT STYLE CONTROLS (User-selected)
{{TEXT_STYLE_CONTROLS}}
You MUST obey TEXT_STYLE_LOCK per slot (headline/subhead/cta/badge).
If the lock conflicts with generic reference typography, TEXT_STYLE_LOCK wins.

CLEAN OUTPUT (NEGATIVE CONSTRAINTS)
- Remove phone UI overlays, app chrome, status bars.
- Remove watermark, signature, random logos, random brand names.
- Do NOT add emoji characters like "✨" or sticker overlays.
- Metallic glints as part of gold foil typography are allowed.
- Additional negative terms:
{{NEGATIVE}}

OUTPUT SPEC
- Aspect ratio: {{ASPECT_RATIO}} (configured by API imageConfig)
- Full bleed, edge to edge
- Professional ad design, sharp and clean
- Text accuracy mode: {{TEXT_ACCURACY_MODE}}

INPUT DATA
VISUAL GUIDE:
{{VISUAL_GUIDE}}

TYPOGRAPHY HINT:
{{TYPOGRAPHY_HINT}}

MAIN HEADLINE (keep line breaks):
{{MAIN_HEADLINE}}

SUB TEXT (optional):
{{SUB_TEXT}}

CTA BUTTON (optional):
{{CTA_TEXT}}

BADGES (optional):
{{BADGES}}

PRODUCT CONTEXT:
{{PRODUCT_CONTEXT}}
