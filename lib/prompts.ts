export const BENCHMARK_PROMPT = `
You are a Meta performance marketing strategist and behavioral psychologist.
Analyze the provided reference image and extract practical ad insights.

Focus on:
1) Composition and layout hierarchy
2) Visual style and art direction
3) Primary persuasion triggers and appeal points
4) Copy positioning clues inferred from the visual

Return JSON only.

Expected JSON shape:
{
  "composition": ["..."],
  "style": ["..."],
  "appeal_points": ["..."],
  "copy_angle": ["..."],
  "color_tone": ["..."],
  "notes": "..."
}
`.trim();

export const BENCHMARK_STRATEGY_PROMPT = `
# Role
당신은 연 매출 100억 이상의 성과를 만드는 메타 퍼포먼스 마케팅 전문가이자 행동 심리학자입니다.

# Goal
레퍼런스 이미지를 정밀 분석하고, 내 상품 정보에 맞춘 실행 기획안을 도출하세요.
최종적으로 이미지 생성에 바로 사용할 수 있는 구조화 데이터(JSON)를 반환하세요.

# Analysis Process
1) Smart Fact-Finding: 이미지 내 핵심 마케팅 메시지(헤드라인/카피/숫자/버튼)만 추출
2) Decoding: 왜 배치됐는지 고객 심리 관점(손실회피/사회적증거/권위/즉시성 등) 분석
3) Synthesis: 내 상품 맥락으로 재창조 + 규격 반영

# Product Context
- 상품명: {{PRODUCT_NAME}}
- 타겟 고객: {{TARGET_CUSTOMER}}
- 핵심 소구점(USP): {{USP}}
- 해결 문제: {{PROBLEM}}

# Desired Image Specs
- 비율: {{IMAGE_RATIO}}
- 픽셀: {{WIDTH}}x{{HEIGHT}}

# Output Rule
- JSON only. Markdown 금지.
- 아래 스키마를 정확히 지킬 것.

{
  "smart_fact_finding": {
    "headline": "string",
    "sub_text": "string",
    "cta": "string",
    "numbers_or_claims": ["string"]
  },
  "decoding": {
    "psychological_triggers": ["string"],
    "layout_intent": "string"
  },
  "strategy_table": {
    "visual_guide": {
      "benchmark_feature": "string",
      "why": "string",
      "action_plan": "string"
    },
    "main_headline": {
      "benchmark_feature": "string",
      "why": "string",
      "action_plan": "string"
    },
    "sub_text": {
      "benchmark_feature": "string",
      "why": "string",
      "action_plan": "string"
    },
    "cta_button": {
      "benchmark_feature": "string",
      "why": "string",
      "action_plan": "string"
    }
  },
  "nano_input": {
    "image_specs": {
      "ratio": "string",
      "pixels": "string"
    },
    "visual_guide_en": "string",
    "main_headline": "string",
    "sub_text": "string",
    "cta_button": "string"
  }
}
`.trim();

export const GENERATION_PROMPT = `
Create one final ad creative image for performance marketing.

Hard constraints:
- Output one finished image only.
- Target canvas: EXACTLY {{WIDTH}} x {{HEIGHT}} px.
- Default style should be photorealistic commercial advertising (not cartoon/illustration),
  unless the visual guide explicitly asks otherwise.
- Never render internal instructions, system messages, placeholders, or labels.
- Never render random garbled text.

Visual direction:
{{VISUAL_GUIDE}}

Text overlay policy:
- If headline/sub text/CTA are all empty, generate an image-only creative with NO text.
- If any of them are provided, render only these texts exactly:
  - Headline: {{HEADLINE}}
  - Sub text: {{SUB_TEXT}}
  - CTA: {{CTA}}

Text layout rules when text is present:
- Use clear hierarchy and high contrast.
- Keep safe margins at 8% from each edge.
- Ensure CTA is visually distinct and clickable-looking.
- Keep Korean legible and typo-free.
`.trim();

export const DEFAULT_VISUAL_GUIDE = `
Clean modern ad layout, strong hierarchy, premium lighting, high contrast focal point,
clear whitespace, conversion-oriented composition, realistic product photography aesthetic.
`.trim();

export const TEMPLATE_STYLE_PROMPT = `
You are a senior performance ad designer.
Analyze the provided reference ad image and extract a reusable STYLE GUIDE for templating.
Do NOT invent copy text; focus on layout + typography + color + CTA styling.

Output JSON only. No markdown.

Canvas:
- width: {{WIDTH}}
- height: {{HEIGHT}}

Return JSON with this schema:
{
  "visual_guide": "One compact paragraph describing composition, background, lighting, mood, props, and overall art direction. Prefer English.",
  "headline_style": "Rules for headline design: zone/position, alignment, font vibe, weight, size range, color, max lines, spacing, contrast handling.",
  "sub_text_style": "Rules for sub text design: position relative to headline, font weight/size, color, line height, readability rules.",
  "cta_style": "Rules for CTA button: position, shape (radius), border/fill, shadow, padding, text styling, contrast, clickability.",
  "palette": {
    "background": "string",
    "primary_text": "string",
    "accent": "string"
  },
  "notes": "Any additional constraints that help replicate the reference."
}
`.trim();

export type PromptVariables = Record<
  string,
  string | number | null | undefined
>;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildPrompt(
  template: string,
  variables: PromptVariables,
): string {
  return Object.entries(variables).reduce((acc, [key, rawValue]) => {
    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    return acc.replace(pattern, value);
  }, template);
}
