import { NextResponse } from "next/server";
import { z } from "zod";

import { getStudioImageModel } from "@/config/modelCatalog";
import {
  getAvailableRuntimeModels,
  getRuntimeModelTierSettings,
  isStudioModelTierId,
  normalizeModelTierSettings,
} from "@/lib/studio/modelTiers";
import { getModelPriceById } from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const UpdateModelTierSchema = z.object({
  tiers: z.array(
    z.object({
      tierId: z.string().min(1),
      displayName: z.string().trim().min(1).max(40),
      imageModelId: z.string().min(1),
    }),
  ),
});

export async function GET() {
  try {
    const tiers = await getRuntimeModelTierSettings();
    const availableModels = getAvailableRuntimeModels();

    return NextResponse.json(
      {
        tiers: tiers.map((tier) => {
          const model = getStudioImageModel(tier.imageModelId);
          const price = getModelPriceById(tier.imageModelId, "1K");
          return {
            ...tier,
            model: model
              ? {
                  id: model.id,
                  provider: model.provider,
                  name: model.name,
                  textSuccess: model.textSuccess,
                  speed: model.speed,
                }
              : null,
            price: price
              ? {
                  costKrw: price.costKrw,
                  sellKrw: price.sellKrw,
                  creditsRequired: price.creditsRequired,
                }
              : null,
          };
        }),
        availableModels,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "모델 티어 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = UpdateModelTierSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "모델 티어 저장 요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rawTiers = parsed.data.tiers;
    const map = new Map<string, { tierId: string; displayName: string; imageModelId: string }>();

    for (const row of rawTiers) {
      const normalizedTierId = row.tierId.trim();
      if (!isStudioModelTierId(normalizedTierId)) {
        return NextResponse.json(
          { error: `지원하지 않는 티어입니다. (${row.tierId})` },
          { status: 400 },
        );
      }
      if (!getStudioImageModel(row.imageModelId)) {
        return NextResponse.json(
          { error: `지원하지 않는 모델입니다. (${row.imageModelId})` },
          { status: 400 },
        );
      }
      map.set(normalizedTierId, {
        tierId: normalizedTierId,
        displayName: row.displayName.trim(),
        imageModelId: row.imageModelId,
      });
    }

    const normalized = normalizeModelTierSettings(
      Array.from(map.values()).map((item) => ({
        tier_id: item.tierId,
        display_name: item.displayName,
        image_model_id: item.imageModelId,
      })),
    );

    const upsertRows = normalized.map((item) => ({
      tier_id: item.tierId,
      display_name: item.displayName,
      image_model_id: item.imageModelId,
    }));

    const supabase = getSupabaseServiceClient();
    const upsert = await supabase.from("studio_model_tier_settings").upsert(upsertRows, {
      onConflict: "tier_id",
      ignoreDuplicates: false,
    });

    if (upsert.error) {
      return NextResponse.json(
        { error: `모델 티어 저장에 실패했습니다. (${upsert.error.message})` },
        { status: 500 },
      );
    }

    const tiers = await getRuntimeModelTierSettings();
    const availableModels = getAvailableRuntimeModels();

    return NextResponse.json(
      {
        ok: true,
        tiers,
        availableModels,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "모델 티어 저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
