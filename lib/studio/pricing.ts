import {
  getStudioImageModel,
  STUDIO_IMAGE_MODELS,
  type StudioImageModel,
} from "@/config/modelCatalog";

const DEFAULT_RATE = 1442;
export const CREDIT_WON_UNIT = 100;
export const UNIFIED_CREDIT_BUCKET_ID = "KRW_100_CREDIT";

export function getUsdKrwRate(): number {
  const parsed = Number.parseFloat(process.env.USD_KRW_RATE || "");
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_RATE;
}

function roundTo100(value: number): number {
  return Math.max(100, Math.round(value / 100) * 100);
}

export function toModelPrice(model: StudioImageModel, imageSize?: "1K" | "2K" | "4K") {
  const rate = getUsdKrwRate();
  const costUsd = imageSize === "4K" && model.costUsd4k ? model.costUsd4k : model.costUsd;
  const costKrw = Math.ceil(costUsd * rate);
  const sellKrw = roundTo100(costKrw * 3);
  const creditsRequired = Math.max(1, Math.round(sellKrw / CREDIT_WON_UNIT));

  return {
    costUsd,
    costKrw,
    sellKrw,
    creditsRequired,
  };
}

export function getModelPriceById(modelId: string, imageSize?: "1K" | "2K" | "4K") {
  const model = getStudioImageModel(modelId);
  if (!model) {
    return null;
  }
  return {
    model,
    ...toModelPrice(model, imageSize),
  };
}

export function getPricedModelCatalog() {
  return STUDIO_IMAGE_MODELS.map((model) => {
    const price = toModelPrice(model, "1K");
    const highRes = model.costUsd4k
      ? toModelPrice(model, "4K")
      : null;

    return {
      ...model,
      price,
      highRes,
    };
  });
}
