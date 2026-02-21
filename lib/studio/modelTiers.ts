import { getStudioImageModel, STUDIO_IMAGE_MODELS } from "@/config/modelCatalog";
import { getSupabaseServiceClient } from "@/lib/supabase";

export type StudioModelTierId = "basic" | "advanced";

export type StudioModelTierSetting = {
  tierId: StudioModelTierId;
  displayName: string;
  imageModelId: string;
};

type StudioModelTierRow = {
  tier_id: string;
  display_name: string | null;
  image_model_id: string | null;
};

export const STUDIO_MODEL_TIER_IDS: StudioModelTierId[] = ["basic", "advanced"];

const TIER_CREDITS_REQUIRED: Record<StudioModelTierId, number> = {
  basic: 2,
  advanced: 3,
};

export const DEFAULT_STUDIO_MODEL_TIER_SETTINGS: StudioModelTierSetting[] = [
  {
    tierId: "basic",
    displayName: "기본",
    imageModelId: "imagen-4.0-fast-generate-001",
  },
  {
    tierId: "advanced",
    displayName: "상위버전",
    imageModelId: "imagen-4.0-generate-001",
  },
];

function defaultTierMap() {
  return new Map(DEFAULT_STUDIO_MODEL_TIER_SETTINGS.map((item) => [item.tierId, item]));
}

export function isStudioModelTierId(value: string): value is StudioModelTierId {
  return STUDIO_MODEL_TIER_IDS.includes(value as StudioModelTierId);
}

export function normalizeModelTierSettings(rows: StudioModelTierRow[] | null | undefined) {
  const defaults = defaultTierMap();

  for (const row of rows ?? []) {
    const tierId = String(row.tier_id || "").trim();
    if (!isStudioModelTierId(tierId)) continue;

    const fallback = defaults.get(tierId);
    if (!fallback) continue;

    const requestedModelId = String(row.image_model_id || "").trim();
    const validatedModelId = getStudioImageModel(requestedModelId)?.id || fallback.imageModelId;
    const displayName = String(row.display_name || "").trim() || fallback.displayName;

    defaults.set(tierId, {
      tierId,
      displayName,
      imageModelId: validatedModelId,
    });
  }

  return STUDIO_MODEL_TIER_IDS.map((tierId) => {
    const setting = defaults.get(tierId);
    if (!setting) {
      throw new Error(`Model tier default missing: ${tierId}`);
    }
    return setting;
  });
}

export async function getRuntimeModelTierSettings() {
  const supabase = getSupabaseServiceClient();
  const query = await supabase
    .from("studio_model_tier_settings")
    .select("tier_id, display_name, image_model_id");

  if (query.error) {
    if (
      query.error.code === "42P01" ||
      query.error.code === "PGRST205" ||
      query.error.message.toLowerCase().includes("studio_model_tier_settings")
    ) {
      return DEFAULT_STUDIO_MODEL_TIER_SETTINGS;
    }
    throw new Error(`모델 티어 설정 조회 실패 (${query.error.message})`);
  }

  return normalizeModelTierSettings((query.data ?? []) as StudioModelTierRow[]);
}

export function resolveModelSelectionByTier(
  selectedModelId: string,
  settings: StudioModelTierSetting[],
) {
  const normalized = selectedModelId.trim();
  if (!normalized) return null;

  if (isStudioModelTierId(normalized)) {
    const tier = settings.find((item) => item.tierId === normalized);
    if (!tier) return null;
    return {
      tierId: tier.tierId,
      tierName: tier.displayName,
      resolvedModelId: tier.imageModelId,
      requestModelId: selectedModelId,
    };
  }

  const directModel = getStudioImageModel(normalized);
  if (!directModel) return null;

  const mappedTier = settings.find((item) => item.imageModelId === directModel.id);
  return {
    tierId: mappedTier?.tierId ?? null,
    tierName: mappedTier?.displayName ?? null,
    resolvedModelId: directModel.id,
    requestModelId: selectedModelId,
  };
}

export function mapStoredModelIdToTier(
  modelId: string,
  settings: StudioModelTierSetting[],
): StudioModelTierId | null {
  const matched = settings.find((item) => item.imageModelId === modelId);
  return matched?.tierId ?? null;
}

export function getAvailableRuntimeModels() {
  return STUDIO_IMAGE_MODELS.map((model) => ({
    id: model.id,
    provider: model.provider,
    name: model.name,
    textSuccess: model.textSuccess,
    speed: model.speed,
  }));
}

export function getCreditsRequiredByTierId(tierId: StudioModelTierId | null | undefined) {
  if (!tierId) return TIER_CREDITS_REQUIRED.basic;
  return TIER_CREDITS_REQUIRED[tierId] ?? TIER_CREDITS_REQUIRED.basic;
}
