import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { buildKeywordNet, computeKeywordNetInputs } from "@/lib/keywordNet";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getSearchAdCredsFromEnv } from "@/lib/naver/searchad";

const RequestSchema = z.object({
  placeUrl: z.string().trim().optional(),
  storeName: z.string().trim().min(1),
  area: z.string().trim().min(1),
  bizType: z.string().trim().min(1),
  device: z.enum(["PC", "MOBILE"]).optional(),
  selectedPlaceLink: z.string().trim().optional(),
});

function hasAllNaverEnv(): boolean {
  return Boolean(
    process.env.NAVER_SEARCHAD_ACCESS_LICENSE &&
      process.env.NAVER_SEARCHAD_SECRET_KEY &&
      process.env.NAVER_SEARCHAD_CUSTOMER_ID,
  );
}

async function tryLoadCache(cacheKey: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("keyword_net_cache")
      .select("result_json, created_at")
      .eq("cache_key", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const createdAt = Date.parse(String(data.created_at));
    const ageMs = Date.now() - (Number.isFinite(createdAt) ? createdAt : 0);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) return null;

    return {
      cachedAt: createdAt,
      ageMs,
      result: data.result_json as unknown,
    };
  } catch {
    return null;
  }
}

async function trySaveCache(cacheKey: string, payload: unknown) {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase.from("keyword_net_cache").insert({
      cache_key: cacheKey,
      result_json: payload,
    });
  } catch {
    // ignore cache failures
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (!hasAllNaverEnv()) {
      return NextResponse.json(
        {
          error:
            "네이버 SearchAd API 키가 설정되지 않았습니다. .env.local에 NAVER_SEARCHAD_ACCESS_LICENSE/NAVER_SEARCHAD_SECRET_KEY/NAVER_SEARCHAD_CUSTOMER_ID 값을 추가하세요.",
        },
        { status: 501 },
      );
    }

    const cacheInputs = computeKeywordNetInputs({
      storeName: parsed.data.storeName,
      area: parsed.data.area,
      bizType: parsed.data.bizType,
      placeUrl: parsed.data.placeUrl,
      selectedPlaceLink: parsed.data.selectedPlaceLink,
      device: parsed.data.device,
    });

    const cacheHit = await tryLoadCache(cacheInputs.cacheKey);
    if (cacheHit?.result && typeof cacheHit.result === "object") {
      return NextResponse.json(
        {
          ok: true,
          fromCache: true,
          cacheKey: cacheInputs.cacheKey,
          cachedAt: cacheHit.cachedAt,
          ageMinutes: Math.round(cacheHit.ageMs / 60000),
          ...(cacheHit.result as any),
        },
        { status: 200 },
      );
    }

    const creds = getSearchAdCredsFromEnv();
    const computed = await buildKeywordNet({
      creds,
      storeName: parsed.data.storeName,
      area: parsed.data.area,
      bizType: parsed.data.bizType,
      placeUrl: parsed.data.placeUrl,
      device: parsed.data.device,
      selectedPlaceLink: parsed.data.selectedPlaceLink,
    });

    const resultPayload = {
      placeQuery: computed.placeQuery,
      placeId: computed.placeId,
      placeCandidates: computed.placeCandidates,
      selectedPlace: computed.selectedPlace,
      keywordNet: computed.keywordNet,
      summary: computed.summary,
    };

    void trySaveCache(cacheInputs.cacheKey, resultPayload);

    return NextResponse.json(
      {
        ok: true,
        fromCache: false,
        cacheKey: cacheInputs.cacheKey,
        ...resultPayload,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/diagnosis/keyword-net] failed:", error);
    const msg = error instanceof Error ? error.message : "키워드 분석 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
