import { NextResponse } from "next/server";

import { STUDIO_IMAGE_MODELS } from "@/config/modelCatalog";
import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import {
  getPricedModelCatalog,
  UNIFIED_CREDIT_BUCKET_ID,
} from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const supabase = getSupabaseServiceClient();

    const [creditsRes, ledgerRes] = await Promise.all([
      supabase
        .from("user_model_credits")
        .select("image_model_id, balance, updated_at")
        .eq("user_id", user.id)
        .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID)
        .maybeSingle(),
      supabase
        .from("credit_ledger")
        .select("id, image_model_id, delta, reason, ref_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (creditsRes.error) {
      if (creditsRes.error.code === "PGRST205") {
        return NextResponse.json(
          {
            error:
              "스튜디오 DB 마이그레이션이 아직 적용되지 않았습니다. Supabase SQL Editor에서 `supabase/migrations/20260216_000009_makedoc_studio_core.sql`을 먼저 실행해 주세요.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: `크레딧 정보를 불러오지 못했습니다. (${creditsRes.error.message})` },
        { status: 500 },
      );
    }

    if (ledgerRes.error) {
      return NextResponse.json(
        { error: `크레딧 로그를 불러오지 못했습니다. (${ledgerRes.error.message})` },
        { status: 500 },
      );
    }

    const globalBalance = creditsRes.data?.balance ?? 0;

    const pricedModels = getPricedModelCatalog().map((model) => ({
      ...model,
      balance: globalBalance,
    }));

    return NextResponse.json(
      {
        models: pricedModels,
        globalBalance,
        supportedModelIds: STUDIO_IMAGE_MODELS.map((item) => item.id),
        ledger: ledgerRes.data ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "크레딧 조회 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
