export type StudioPromptRole = "PLANNER" | "MARKETER" | "DESIGNER";

export type CopyToggles = {
  useSubcopy: boolean;
  useCTA: boolean;
  useBadge: boolean;
};

export type TriplePromptWhy = {
  observations: string[];
  interpretation: string[];
  decisions: string[];
  risks: string[];
};

export type TriplePromptValidation = {
  mustPass: string[];
  autoFixRules: string[];
};

export type TriplePromptSeniorPack = {
  personaId: "planner" | "designer" | "performance";
  evidence: string[];
  why: TriplePromptWhy;
  validation: TriplePromptValidation;
  strategy?: Record<string, unknown>;
  hypothesis?: Record<string, unknown>;
  finalPrompt?: string;
  mode?: string;
  missingInputs?: string[];
};

export type TextFontStyleTone =
  | "auto"
  | "gothic"
  | "myeongjo"
  | "rounded"
  | "calligraphy";

export type TextEffectTone =
  | "auto"
  | "clean"
  | "shadow"
  | "outline"
  | "emboss"
  | "bubble";

export type TextStyleSlotControl = {
  fontTone: TextFontStyleTone;
  effectTone: TextEffectTone;
};

export type PromptTextStyleControls = {
  headline?: TextStyleSlotControl;
  subhead?: TextStyleSlotControl;
  cta?: TextStyleSlotControl;
  badge?: TextStyleSlotControl;
};

export type ProductContext = {
  brandName?: string;
  productName?: string;
  category?: string;
  target?: string;
  offer?: string;
  platform?: string;
  tone?: string;
  ratio?: "1:1" | "4:5" | "9:16";
  benefits?: string[];
  bannedWords?: string[];
  productImageUrl?: string;
  logoImageUrl?: string;
  typographyReferenceImageUrl?: string;
  additionalContext?: string;
  supplementalInputs?: Array<{
    label: string;
    value: string;
  }>;
};

export type ReferenceAnalysis = {
  layoutBBoxes: {
    headline: [number, number, number, number];
    subhead: [number, number, number, number];
    product: [number, number, number, number];
    cta: [number, number, number, number];
  };
  palette: string[];
  moodKeywords: string[];
  hookPattern: string;
  typographyStyle: string;
  readabilityWarnings: string[];
  strongPoints: string[];
  referenceInsights?: {
    visualFacts?: Record<string, unknown>;
    persuasionFacts?: Record<string, unknown>;
    channelRisk?: Record<string, unknown>;
  };
  missingInputs?: string[];
};

export type PromptCopy = {
  headline: string;
  subhead: string;
  cta: string;
  badges: string[];
};

export type PromptVisual = {
  scene: string;
  composition: string;
  style: string;
  lighting: string;
  colorPaletteHint: string;
  negative: string;
};

export type PromptGenerationHints = {
  aspectRatioDefault: "1:1" | "4:5" | "9:16";
  textModeDefault: "in_image" | "minimal_text" | "no_text";
  copyToggles?: CopyToggles;
  seniorPack?: TriplePromptSeniorPack;
  textStyle?: PromptTextStyleControls;
};

export type StudioPromptDraft = {
  id: string;
  role: StudioPromptRole;
  title: string;
  copy: PromptCopy;
  visual: PromptVisual;
  generationHints: PromptGenerationHints;
};
