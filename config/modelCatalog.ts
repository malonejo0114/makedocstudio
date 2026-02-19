export type ModelTextSuccessGrade = "상" | "중상" | "중";
export type ModelSpeedGrade = "빠름" | "보통" | "느림";

export type StudioImageModel = {
  id: string;
  provider: "Imagen 4" | "Gemini 네이티브";
  name: string;
  textSuccess: ModelTextSuccessGrade;
  speed: ModelSpeedGrade;
  costUsd: number;
  costUsd4k?: number;
};

export const STUDIO_IMAGE_MODELS: StudioImageModel[] = [
  {
    id: "imagen-4.0-fast-generate-001",
    provider: "Imagen 4",
    name: "Imagen 4 Fast",
    textSuccess: "중상",
    speed: "빠름",
    costUsd: 0.02,
  },
  {
    id: "imagen-4.0-generate-001",
    provider: "Imagen 4",
    name: "Imagen 4",
    textSuccess: "중상",
    speed: "보통",
    costUsd: 0.04,
  },
  {
    id: "imagen-4.0-ultra-generate-001",
    provider: "Imagen 4",
    name: "Imagen 4 Ultra",
    textSuccess: "상",
    speed: "느림",
    costUsd: 0.06,
  },
  {
    id: "gemini-2.5-flash-image",
    provider: "Gemini 네이티브",
    name: "Gemini 2.5 Flash Image",
    textSuccess: "중",
    speed: "빠름",
    costUsd: 0.039,
  },
  {
    id: "gemini-3-pro-image-preview",
    provider: "Gemini 네이티브",
    name: "Gemini 3 Pro Image",
    textSuccess: "상",
    speed: "보통",
    costUsd: 0.134,
    costUsd4k: 0.24,
  },
];

export function getStudioImageModel(modelId: string): StudioImageModel | null {
  return STUDIO_IMAGE_MODELS.find((item) => item.id === modelId) ?? null;
}
