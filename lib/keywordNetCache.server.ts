import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  buildKeywordNet,
  computeKeywordNetInputs,
  type KeywordNetDevice,
  type KeywordNetResult,
} from "@/lib/keywordNet";
import type { SearchAdCreds } from "@/lib/naver/searchad";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function tryLoadKeywordNetCache(cacheKey: string): Promise<KeywordNetResult | null> {
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
    if (ageMs > TTL_MS) return null;

    const result = data.result_json as any;
    if (!result || typeof result !== "object") return null;
    return result as KeywordNetResult;
  } catch {
    return null;
  }
}

export async function trySaveKeywordNetCache(cacheKey: string, payload: unknown): Promise<void> {
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

export async function buildKeywordNetCached(args: {
  creds: SearchAdCreds;
  storeName: string;
  area: string;
  bizType: string;
  placeUrl?: string;
  device?: KeywordNetDevice;
  selectedPlaceLink?: string;
  extraHintSeeds?: string[];
}): Promise<{ result: KeywordNetResult; fromCache: boolean }> {
  const inputs = computeKeywordNetInputs({
    storeName: args.storeName,
    area: args.area,
    bizType: args.bizType,
    placeUrl: args.placeUrl,
    selectedPlaceLink: args.selectedPlaceLink,
    device: args.device,
    extraHintSeeds: args.extraHintSeeds,
  });

  const cached = await tryLoadKeywordNetCache(inputs.cacheKey);
  if (cached) {
    return { result: cached, fromCache: true };
  }

  const computed = await buildKeywordNet({
    creds: args.creds,
    storeName: args.storeName,
    area: args.area,
    bizType: args.bizType,
    placeUrl: args.placeUrl,
    device: args.device,
    selectedPlaceLink: args.selectedPlaceLink,
    extraHintSeeds: args.extraHintSeeds,
  });

  void trySaveKeywordNetCache(inputs.cacheKey, computed);
  return { result: computed, fromCache: false };
}
