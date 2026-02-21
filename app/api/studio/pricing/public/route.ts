import { NextResponse } from "next/server";

import { getStudioImageModel } from "@/config/modelCatalog";
import { getRuntimeModelTierSettings } from "@/lib/studio/modelTiers";
import {
  IMAGE_GENERATION_CREDITS_REQUIRED,
  getModelPriceById,
} from "@/lib/studio/pricing";

export async function GET() {
  try {
    const tierSettings = await getRuntimeModelTierSettings();

    return NextResponse.json(
      {
        models: tierSettings.map((tier) => {
          const model = getStudioImageModel(tier.imageModelId);
          const priced = getModelPriceById(tier.imageModelId, "1K");
          return {
            id: tier.tierId,
            provider: model?.provider ?? "Imagen 4",
            name: tier.displayName,
            textSuccess: model?.textSuccess ?? "중",
            speed: model?.speed ?? "보통",
            price: {
              creditsRequired: priced?.creditsRequired ?? IMAGE_GENERATION_CREDITS_REQUIRED,
            },
            highRes: null,
          };
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격표 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
