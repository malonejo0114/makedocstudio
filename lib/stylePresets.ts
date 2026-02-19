export type StylePresetId =
  | "CleanStudio"
  | "PremiumMinimal"
  | "TechNeon"
  | "PopGradient"
  | "NaturalLifestyle"
  | "EditorialPoster";

export type StylePreset = {
  id: StylePresetId;
  label: string;
  visualGuide: string;
  keywords: string[];
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "CleanStudio",
    label: "Clean Studio",
    keywords: ["깔끔", "클린", "스튜디오", "화이트", "심플"],
    visualGuide:
      "Clean studio background, soft shadow, product photography lighting, crisp edges, minimal props, premium whitespace.",
  },
  {
    id: "PremiumMinimal",
    label: "Premium Minimal",
    keywords: ["프리미엄", "미니멀", "고급", "무드", "무광", "톤다운"],
    visualGuide:
      "Premium minimal ad background, soft gradients, subtle texture, muted palette, calm mood, elegant highlights, high-end commercial style.",
  },
  {
    id: "TechNeon",
    label: "Tech Neon",
    keywords: ["테크", "네온", "사이버", "블루", "홀로", "미래"],
    visualGuide:
      "Futuristic tech ad background, neon rim lighting, cyan/teal highlights, glossy reflections, dark premium atmosphere, clean geometry.",
  },
  {
    id: "PopGradient",
    label: "Pop Gradient",
    keywords: ["팝", "그라데이션", "컬러풀", "밝게", "상큼", "젊은"],
    visualGuide:
      "Bright pop gradient background, vibrant yet controlled palette, playful shapes, high contrast, energetic modern social ad style.",
  },
  {
    id: "NaturalLifestyle",
    label: "Natural Lifestyle",
    keywords: ["자연", "라이프", "따뜻", "햇살", "감성", "내추럴"],
    visualGuide:
      "Natural lifestyle background, warm sunlight, soft bokeh, realistic textures, approachable mood, authentic everyday scene.",
  },
  {
    id: "EditorialPoster",
    label: "Editorial Poster",
    keywords: ["에디토리얼", "포스터", "잡지", "타이포", "레트로", "아트"],
    visualGuide:
      "Editorial poster background, art-directed composition, subtle grain, dramatic lighting, magazine-style premium design language.",
  },
];

export function pickStylePreset(params: {
  preferred?: StylePresetId | "auto";
  keywords?: string;
}): StylePreset {
  const preferred = params.preferred ?? "auto";
  if (preferred !== "auto") {
    return STYLE_PRESETS.find((p) => p.id === preferred) ?? STYLE_PRESETS[1];
  }

  const kw = (params.keywords ?? "").trim();
  if (!kw) return STYLE_PRESETS[1];
  const tokens = kw
    .split(/[,|/\\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  let best: { preset: StylePreset; score: number } | null = null;
  for (const preset of STYLE_PRESETS) {
    let score = 0;
    for (const t of tokens) {
      for (const k of preset.keywords) {
        if (t.includes(k) || k.includes(t)) score += 1;
      }
    }
    if (!best || score > best.score) best = { preset, score };
  }
  return best?.preset ?? STYLE_PRESETS[1];
}

export function buildNoReferenceStyleGuide(params: {
  preset: StylePreset;
  palette?: string[];
}): string {
  const palette = (params.palette ?? []).filter(Boolean);
  const paletteLine = palette.length
    ? `Use this brand palette as accents (no text): ${palette.join(", ")}.`
    : "";
  return [params.preset.visualGuide, paletteLine].filter(Boolean).join("\n");
}

