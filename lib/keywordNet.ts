import "server-only";

import crypto from "node:crypto";

import type { NaverLocalItem } from "@/lib/naver/local";
import { searchNaverLocal } from "@/lib/naver/local";
import type {
  AveragePositionBidRes,
  KeywordToolItem,
  SearchAdCreds,
} from "@/lib/naver/searchad";
import {
  getAveragePositionBids,
  getKeywordTool,
} from "@/lib/naver/searchad";

export type KeywordNetDevice = "PC" | "MOBILE";

export type KeywordNetBucket = "core" | "context" | "delivery" | "brand";

export type KeywordNetRow = {
  keyword: string;
  bucket: KeywordNetBucket;
  volume_pc_lo: number;
  volume_mobile_lo: number;
  volume_total_lo: number;
  volume_pc_hi: number;
  volume_mobile_hi: number;
  volume_total_hi: number;
  ctr_pc: number | null;
  ctr_mobile: number | null;
  ctr_avg: number | null;
  bid_pos1: number | null;
  bid_pos2: number | null;
  bid_pos3: number | null;
  bid_pos4: number | null;
  bid_pos5: number | null;
  compIdx: string | null;
  plAvgDepth: number | null;
  score: number;
};

export type KeywordNetSummary = {
  device: KeywordNetDevice;
  demand_top10: number;
  avg_ctr_top10: number | null;
  median_bid_pos3_top10: number | null;
  fetchedAt: number;
};

export type KeywordNetResult = {
  placeQuery: string;
  placeId: string | null;
  placeCandidates: NaverLocalItem[];
  selectedPlace: NaverLocalItem | null;
  keywordNet: KeywordNetRow[];
  summary: KeywordNetSummary;
  cacheKey: string;
};

export function extractPlaceIdFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const input = raw.trim();
  if (!input) return null;

  // Typical: https://place.naver.com/restaurant/1234567890/home
  // Also: https://m.place.naver.com/restaurant/1234567890/home
  const match = input.match(/(?:m\.)?place\.naver\.com\/[^/]+\/(\d{5,})/i);
  if (match?.[1]) return match[1];

  // Fallback: find a long numeric segment.
  const any = input.match(/\b(\d{7,})\b/);
  return any?.[1] ?? null;
}

function pickAreaSeed(raw: string): string {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return "";
  const first = cleaned.split(/[\\/|,]/)[0]?.trim() ?? "";
  if (!first) return cleaned;
  return first.length > 18 ? first.slice(0, 18) : first;
}

function compact(input: string): string {
  return String(input ?? "").replace(/\s+/g, "").trim();
}

function uniqKeepOrder(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const v = x.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function extractCategorySeeds(category: string): string[] {
  // Examples:
  // - "음식점>멕시코,남미음식"
  // - "음식점>브런치"
  const raw = String(category ?? "").trim();
  if (!raw) return [];
  const tokens = raw
    .replaceAll(">", ",")
    .split(/[,\s/]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t !== "음식점" && t !== "기관");
  return uniqKeepOrder(tokens).slice(0, 3);
}

function extractAreaTokensFromPlace(place: NaverLocalItem | null): string[] {
  if (!place) return [];
  const text = `${place.roadAddress ?? ""} ${place.address ?? ""}`.trim();
  if (!text) return [];
  const tokens: string[] = [];
  const addAll = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const v = String(m?.[1] ?? "").trim();
      if (v) tokens.push(v);
    }
  };
  addAll(/([가-힣]{2,}구)/g);
  addAll(/([가-힣]{2,}동)/g);
  addAll(/([가-힣]{2,}역)/g);
  return uniqKeepOrder(tokens).slice(0, 6);
}

function bizTypeSeeds(bizType: string): string[] {
  switch (bizType) {
    case "cafe":
      return ["카페", "디저트", "커피", "브런치"];
    case "bar":
      return ["술집", "이자카야", "맛집"];
    case "delivery":
      return ["배달", "포장", "배달맛집"];
    case "franchise":
      return ["맛집", "식당"];
    case "restaurant":
    default:
      return ["맛집", "식당"];
  }
}

function bizTypeIntentTokens(bizType: string): string[] {
  switch (bizType) {
    case "cafe":
      return ["카페", "커피", "디저트", "브런치", "베이커리"];
    case "bar":
      return ["술집", "이자카야", "호프", "포차", "와인", "맥주", "칵테일", "위스키", "안주"];
    case "delivery":
      return ["배달", "포장", "배민", "쿠팡", "요기요"];
    case "franchise":
    case "restaurant":
    default:
      return ["맛집", "식당", "밥", "점심", "저녁", "예약", "포장", "배달", "메뉴", "코스", "런치", "디너"];
  }
}

function buildSeedKeywords(input: {
  storeName: string;
  area: string;
  bizType: string;
  categorySeeds?: string[];
  extraHintSeeds?: string[];
}): { hintSeeds: string[]; contextSeeds: string[]; deliverySeeds: string[]; brandSeeds: string[] } {
  const storeName = compact(input.storeName);
  const areaSeed = compact(pickAreaSeed(input.area));
  const bizSeeds = bizTypeSeeds(input.bizType);
  const categorySeeds = (input.categorySeeds ?? []).map(compact).filter(Boolean);
  const extraHintSeeds = uniqKeepOrder((input.extraHintSeeds ?? []).map(compact).filter(Boolean)).slice(0, 8);

  const coreSeeds = [
    areaSeed ? `${areaSeed}맛집` : "",
    areaSeed && categorySeeds[0] ? `${areaSeed}${categorySeeds[0]}` : "",
    areaSeed && categorySeeds[1] ? `${areaSeed}${categorySeeds[1]}` : "",
    areaSeed && bizSeeds[0] ? `${areaSeed}${bizSeeds[0]}` : "",
  ].filter(Boolean);

  const contextSeeds = [
    areaSeed ? `${areaSeed}혼밥` : "",
    areaSeed ? `${areaSeed}데이트` : "",
    areaSeed ? `${areaSeed}회식` : "",
    areaSeed ? `${areaSeed}가족` : "",
    areaSeed ? `${areaSeed}단체` : "",
    areaSeed ? `${areaSeed}야식` : "",
  ].filter(Boolean);

  const deliverySeeds = [
    areaSeed ? `${areaSeed}배달` : "",
    areaSeed ? `${areaSeed}포장` : "",
    areaSeed && bizSeeds[0] ? `${areaSeed}${bizSeeds[0]}배달` : "",
  ].filter(Boolean);

  const brandSeeds = [
    storeName,
    areaSeed && storeName ? `${areaSeed}${storeName}` : "",
  ].filter(Boolean);

  // Keyword tool takes hintKeywords; keep it small and high-signal.
  const hintSeedsBase = [
    coreSeeds[0] ?? "",
    coreSeeds[1] ?? "",
    coreSeeds[2] ?? "",
    brandSeeds[1] ?? "",
    deliverySeeds[0] ?? "",
    brandSeeds[0] ?? "",
    contextSeeds[0] ?? "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, idx, arr) => arr.indexOf(s) === idx);

  // Prefer user-provided seeds (menu/area aliases/competitors) but keep at most 5 for keywordstool.
  const hintSeeds = uniqKeepOrder([...extraHintSeeds, ...hintSeedsBase]).slice(0, 5);

  return { hintSeeds, contextSeeds, deliverySeeds, brandSeeds };
}

function parseMaybeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\d.<>]/g, "");
  if (!normalized) return null;
  if (normalized.startsWith("<")) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseVolume(value: unknown, mode: "lo" | "hi"): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith("<")) return mode === "hi" ? 5 : 0;
  const n = Number(trimmed.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseCtr(value: unknown): number | null {
  const n = parseMaybeNumber(value);
  if (n == null) return null;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 1) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!xs.length) return null;
  const sum = xs.reduce((acc, v) => acc + v, 0);
  return sum / xs.length;
}

function classifyBucket(params: {
  keyword: string;
  storeName: string;
}): KeywordNetBucket {
  const k = params.keyword;
  const store = params.storeName.trim();
  const lowered = k.toLowerCase();
  const storeLower = store.toLowerCase();

  if (store && (lowered.includes(storeLower) || lowered.replace(/\s/g, "").includes(storeLower.replace(/\s/g, "")))) {
    return "brand";
  }
  if (k.includes("배달") || k.includes("포장") || k.includes("배민") || k.includes("쿠팡") || k.includes("요기요")) {
    return "delivery";
  }
  if (/(혼밥|데이트|회식|단체|가족|야식|모임|주차|포토존)/.test(k)) {
    return "context";
  }
  return "core";
}

function buildCacheKey(input: Record<string, unknown>): string {
  const raw = JSON.stringify(input);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildBidMap(bids: AveragePositionBidRes): Map<string, Record<number, number>> {
  const out = new Map<string, Record<number, number>>();
  for (const item of bids.items ?? []) {
    const key = String(item.keyword ?? item.key ?? "").trim();
    if (!key) continue;
    const prev = out.get(key) ?? {};
    prev[item.position] = Number(item.bid) || 0;
    out.set(key, prev);
  }
  return out;
}

export async function buildKeywordNet(args: {
  creds: SearchAdCreds;
  storeName: string;
  area: string;
  bizType: string;
  placeUrl?: string;
  device?: KeywordNetDevice;
  selectedPlaceLink?: string;
  extraHintSeeds?: string[];
  maxKeywords?: number;
}): Promise<KeywordNetResult> {
  const storeName = args.storeName.trim();
  const area = args.area.trim();
  const bizType = args.bizType.trim();
  if (!storeName) {
    throw new Error("storeName is required.");
  }
  if (!area) {
    throw new Error("area is required.");
  }

  const placeId =
    extractPlaceIdFromUrl(args.selectedPlaceLink) ??
    extractPlaceIdFromUrl(args.placeUrl);
  const placeQuery = `${area} ${storeName}`.trim();
  let candidates: NaverLocalItem[] = [];
  try {
    const local = await searchNaverLocal(placeQuery, { display: 5, sort: "comment" });
    candidates = local.items ?? [];
  } catch {
    // Naver Local Search is optional for keyword net; proceed without place candidates.
    candidates = [];
  }

  const selected = (() => {
    if (args.selectedPlaceLink) {
      const found = candidates.find((c) => c.link === args.selectedPlaceLink);
      if (found) return found;
    }
    if (placeId) {
      const found = candidates.find((c) => extractPlaceIdFromUrl(c.link) === placeId);
      if (found) return found;
    }
    return candidates[0] ?? null;
  })();

  const device: KeywordNetDevice = args.device ?? "PC";
  const categorySeeds = extractCategorySeeds(selected?.category ?? "");
  const seeds = buildSeedKeywords({ storeName, area, bizType, categorySeeds, extraHintSeeds: args.extraHintSeeds });

  const hintKeywords = seeds.hintSeeds.join(",");
  const keywordTool = await getKeywordTool({
    creds: args.creds,
    hintKeywords,
    showDetail: true,
  });
  const list = Array.isArray(keywordTool.keywordList) ? keywordTool.keywordList : [];
  const map = new Map<string, KeywordToolItem>();
  for (const item of list) {
    const kw = String(item.relKeyword ?? "").trim();
    if (!kw) continue;
    map.set(kw, item);
  }

  // Seed keywords should always be included.
  for (const kw of [...seeds.hintSeeds, ...seeds.brandSeeds].filter(Boolean)) {
    if (!map.has(kw)) {
      map.set(kw, { relKeyword: kw });
    }
  }

  // Keep the keyword net scoped to "this store / this area".
  // Keywordstool may return broad high-volume queries (e.g. "서울 가볼만한곳") especially when seeds include "맛집".
  const areaSeed = compact(pickAreaSeed(area));
  const areaTokens = uniqKeepOrder([areaSeed, ...extractAreaTokensFromPlace(selected)]).filter(Boolean);
  const relevanceTokens = uniqKeepOrder([
    compact(storeName),
    ...areaTokens,
    ...categorySeeds,
  ])
    .map(compact)
    .filter(Boolean)
    .filter((t) => t.length >= 2)
    .filter((t) => t !== "맛집" && t !== "식당");

  const relevanceHits = (kw: string): number => {
    const k = compact(kw);
    if (!k) return 0;
    let hits = 0;
    for (const t of relevanceTokens) {
      if (k.includes(t)) hits += 1;
    }
    return hits;
  };

  const alwaysKeep = new Set(
    uniqKeepOrder([...seeds.hintSeeds, ...seeds.brandSeeds].map(compact)).filter(Boolean),
  );

  const maxKeywords = Math.min(Math.max(args.maxKeywords ?? 40, 10), 80);
  const keywords = Array.from(map.keys())
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => ({
      k,
      vol:
        parseVolume(map.get(k)?.monthlyPcQcCnt, "lo") +
        parseVolume(map.get(k)?.monthlyMobileQcCnt, "lo"),
      hits: relevanceHits(k),
    }))
    .map((x) => {
      const kc = compact(x.k);
      const storeToken = compact(storeName);
      const hasStore = Boolean(storeToken && kc.includes(storeToken));
      const hasCategory = categorySeeds.some((t) => t && kc.includes(compact(t)));
      const hasArea = areaTokens.some((t) => t && kc.includes(compact(t)));
      const intentTokens = bizTypeIntentTokens(bizType).map(compact).filter(Boolean);
      const hasIntent = intentTokens.some((t) => t && kc.includes(t));
      const hasCategoryFood = hasCategory && hasIntent;

      // We only keep broad "area-only" keywords as a fallback; primary net should stay about food/service intent.
      const keep = hasStore || (hasArea && hasIntent) || hasCategoryFood;
      const rank =
        (hasArea && hasIntent ? 80 : 0) +
        (hasStore && hasArea ? 70 : hasStore ? 20 : 0) +
        (hasCategoryFood ? 30 : 0) +
        (hasArea ? 10 : 0) +
        x.hits;

      return { ...x, keep: keep || alwaysKeep.has(kc), rank };
    })
    .filter((x) => x.keep)
    .sort((a, b) => b.rank - a.rank || b.vol - a.vol)
    .slice(0, maxKeywords)
    .map((x) => x.k);

  const bids = await getAveragePositionBids({
    creds: args.creds,
    device,
    keywords,
    positions: [1, 2, 3, 4, 5],
    chunkSize: 100,
  });
  const bidMap = buildBidMap(bids);

  const rows: KeywordNetRow[] = keywords.map((kw) => {
    const base = map.get(kw);

    const pcLo = parseVolume(base?.monthlyPcQcCnt, "lo");
    const moLo = parseVolume(base?.monthlyMobileQcCnt, "lo");
    const pcHi = parseVolume(base?.monthlyPcQcCnt, "hi");
    const moHi = parseVolume(base?.monthlyMobileQcCnt, "hi");

    const ctrPc = parseCtr(base?.monthlyAvePcCtr);
    const ctrMo = parseCtr(base?.monthlyAveMobileCtr);
    const ctrAvg = avg([ctrPc, ctrMo]);

    const bidsPos = bidMap.get(kw) ?? {};
    const bid3 = typeof bidsPos[3] === "number" ? bidsPos[3] : null;

    const demand = pcLo + moLo;
    const demandScore = Math.log10(demand + 10) * 100;
    const efficiency = ctrAvg ?? 0.35;
    const penalty = (bid3 ?? 0) / 1000;
    const score = Math.round(demandScore * efficiency - penalty);

    return {
      keyword: kw,
      bucket: classifyBucket({ keyword: kw, storeName }),
      volume_pc_lo: pcLo,
      volume_mobile_lo: moLo,
      volume_total_lo: pcLo + moLo,
      volume_pc_hi: pcHi,
      volume_mobile_hi: moHi,
      volume_total_hi: pcHi + moHi,
      ctr_pc: ctrPc,
      ctr_mobile: ctrMo,
      ctr_avg: ctrAvg,
      bid_pos1: bidsPos[1] ?? null,
      bid_pos2: bidsPos[2] ?? null,
      bid_pos3: bidsPos[3] ?? null,
      bid_pos4: bidsPos[4] ?? null,
      bid_pos5: bidsPos[5] ?? null,
      compIdx: base?.compIdx ? String(base.compIdx) : null,
      plAvgDepth: parseMaybeNumber(base?.plAvgDepth),
      score,
    };
  });

  // Summary uses Top10 by demand.
  const top10 = [...rows].sort((a, b) => b.volume_total_lo - a.volume_total_lo).slice(0, 10);
  const demandTop10 = top10.reduce((acc, r) => acc + r.volume_total_lo, 0);
  const avgCtrTop10 = avg(top10.map((r) => r.ctr_avg));
  const medianBid3Top10 = median(top10.map((r) => (typeof r.bid_pos3 === "number" ? r.bid_pos3 : NaN)).filter(Number.isFinite));

  const cacheKey = computeKeywordNetCacheKey({
    storeName,
    area,
    bizType,
    placeId,
    device,
    hintKeywords,
  });

  return {
    placeQuery,
    placeId,
    placeCandidates: candidates,
    selectedPlace: selected,
    keywordNet: rows.sort((a, b) => b.score - a.score),
    summary: {
      device,
      demand_top10: demandTop10,
      avg_ctr_top10: avgCtrTop10,
      median_bid_pos3_top10: medianBid3Top10,
      fetchedAt: Date.now(),
    },
    cacheKey,
  };
}

export function computeKeywordNetCacheKey(input: {
  storeName: string;
  area: string;
  bizType: string;
  placeId: string | null;
  device: KeywordNetDevice;
  hintKeywords: string;
}): string {
  return buildCacheKey({
    v: 3,
    storeName: input.storeName.trim(),
    area: input.area.trim(),
    bizType: input.bizType.trim(),
    placeId: input.placeId ?? null,
    device: input.device,
    hintKeywords: input.hintKeywords.trim(),
  });
}

export function computeKeywordNetInputs(input: {
  storeName: string;
  area: string;
  bizType: string;
  placeUrl?: string;
  selectedPlaceLink?: string;
  device?: KeywordNetDevice;
  extraHintSeeds?: string[];
}): { placeQuery: string; placeId: string | null; hintKeywords: string; device: KeywordNetDevice; cacheKey: string } {
  const storeName = input.storeName.trim();
  const area = input.area.trim();
  const bizType = input.bizType.trim();
  const device: KeywordNetDevice = input.device ?? "PC";
  const placeId =
    extractPlaceIdFromUrl(input.selectedPlaceLink) ??
    extractPlaceIdFromUrl(input.placeUrl);
  const placeQuery = `${area} ${storeName}`.trim();
  const seeds = buildSeedKeywords({ storeName, area, bizType, extraHintSeeds: input.extraHintSeeds });
  const hintKeywords = seeds.hintSeeds.join(",");
  const cacheKey = computeKeywordNetCacheKey({
    storeName,
    area,
    bizType,
    placeId,
    device,
    hintKeywords,
  });
  return { placeQuery, placeId, hintKeywords, device, cacheKey };
}
