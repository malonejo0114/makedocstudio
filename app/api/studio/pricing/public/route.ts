import { NextResponse } from "next/server";

import { getStudioImageModel } from "@/config/modelCatalog";
import { getCreditsRequiredByTierId, getRuntimeModelTierSettings } from "@/lib/studio/modelTiers";

export async function GET() {
  try {
    const tierSettings = await getRuntimeModelTierSettings();

    return NextResponse.json(
      {
        models: tierSettings.map((tier) => {
          const model = getStudioImageModel(tier.imageModelId);
          return {
            id: tier.tierId,
            provider: model?.provider ?? "Imagen 4",
            name: tier.displayName,
            textSuccess: model?.textSuccess ?? "중",
            speed: model?.speed ?? "보통",
            price: {
              creditsRequired: getCreditsRequiredByTierId(tier.tierId),
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
