<!-- 2026-02-17: Added reference text replacement v2 template for keep-everything style lock editing. -->
# SYSTEM COMMAND: REFERENCE TEXT REPLACEMENT v2 (LOCK EVERYTHING ELSE)

TASK
Edit the provided reference poster image. Change ONLY text content to NEW TEXT.
Everything else must remain visually identical.

LOCK (CRITICAL)
- Keep same background, ornaments, frame, lighting, textures, and composition.
- Keep same typography styling:
  * metallic or gold foil material
  * bevel/emboss depth
  * stroke and glow
  * soft drop shadows
  * decorative swashes if present
- Replace only characters (words and numbers) with NEW TEXT.

TEXT RULES
- Exact Korean spelling, no garbled characters.
- Respect line breaks exactly.
- Do not add extra text not provided.
- If optional field is empty, do not render it.

TEXT STYLE CONTROLS (User-selected)
{{TEXT_STYLE_CONTROLS}}
You MUST obey TEXT_STYLE_LOCK per slot (headline/subhead/cta/badge).
Do not fallback to one generic gothic style when slot locks are different.

NEW TEXT
MAIN HEADLINE:
{{MAIN_HEADLINE}}

SUB TEXT (optional):
{{SUB_TEXT}}

CTA (optional):
{{CTA_TEXT}}

BADGES (optional):
{{BADGES}}

VISUAL GUIDE (context, do not redesign):
{{VISUAL_GUIDE}}

TYPOGRAPHY HINT:
{{TYPOGRAPHY_HINT}}

NEGATIVE:
{{NEGATIVE}}
