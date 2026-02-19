import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import {
  getAveragePositionBids,
  getKeywordTool,
  getSearchAdCredsFromEnv,
} from "@/lib/naver/searchad";

const RequestSchema = z.object({
  query: z.string().trim().min(1),
  showDetail: z.boolean().optional().default(true),
  includeBids: z.boolean().optional().default(false),
  device: z.enum(["PC", "MOBILE"]).optional().default("PC"),
  maxResults: z.number().int().min(1).max(200).optional().default(80),
  maxBidKeywords: z.number().int().min(1).max(60).optional().default(30),
});

function hasSearchAdEnv(): boolean {
  return Boolean(
    process.env.NAVER_SEARCHAD_ACCESS_LICENSE &&
      process.env.NAVER_SEARCHAD_SECRET_KEY &&
      process.env.NAVER_SEARCHAD_CUSTOMER_ID,
  );
}

function parseMaybeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\d.<>-]/g, "");
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

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!xs.length) return null;
  return xs.reduce((acc, v) => acc + v, 0) / xs.length;
}

function pickErrorStatus(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  // requestSearchAd throws: "[SearchAd API 400] ..."
  const m = msg.match(/\[SearchAd API (\d{3})\]/);
  if (m?.[1]) return Number(m[1]) || 500;
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (!hasSearchAdEnv()) {
      return NextResponse.json(
        {
          error:
            "네이버 SearchAd API 키가 설정되지 않았습니다. .env.local에 NAVER_SEARCHAD_ACCESS_LICENSE/NAVER_SEARCHAD_SECRET_KEY/NAVER_SEARCHAD_CUSTOMER_ID를 추가하세요.",
        },
        { status: 501 },
      );
    }

    const creds = getSearchAdCredsFromEnv();
    const queryRaw = parsed.data.query.trim();
    const queryNoSpace = queryRaw.replace(/\s+/g, "");
    const queryTokens = queryRaw.split(/\s+/g).map((x) => x.trim()).filter(Boolean);
    const queryComma = queryTokens.length >= 2 ? queryTokens.slice(0, 5).join(",") : "";

    let hintKeywords = queryRaw;
    let fallbackUsed = false;

    let keywordTool;
    try {
      keywordTool = await getKeywordTool({
        creds,
        hintKeywords,
        showDetail: parsed.data.showDetail,
      });
    } catch (error) {
      // Some keywords with spaces can trigger "invalid parameters" from SearchAd.
      if (queryComma && queryComma !== queryRaw) {
        try {
          hintKeywords = queryComma;
          fallbackUsed = true;
          keywordTool = await getKeywordTool({
            creds,
            hintKeywords,
            showDetail: parsed.data.showDetail,
          });
        } catch (error2a) {
          if (queryNoSpace && queryNoSpace !== queryRaw) {
            try {
              hintKeywords = queryNoSpace;
              fallbackUsed = true;
              keywordTool = await getKeywordTool({
                creds,
                hintKeywords,
                showDetail: parsed.data.showDetail,
              });
            } catch (error2b) {
              const status = pickErrorStatus(error2b);
              const msg = error2b instanceof Error ? error2b.message : "키워드 조회 실패";
              return NextResponse.json({ error: msg }, { status });
            }
          } else {
            const status = pickErrorStatus(error2a);
            const msg = error2a instanceof Error ? error2a.message : "키워드 조회 실패";
            return NextResponse.json({ error: msg }, { status });
          }
        }
      } else if (queryNoSpace && queryNoSpace !== queryRaw) {
        try {
          hintKeywords = queryNoSpace;
          fallbackUsed = true;
          keywordTool = await getKeywordTool({
            creds,
            hintKeywords,
            showDetail: parsed.data.showDetail,
          });
        } catch (error2) {
          const status = pickErrorStatus(error2);
          const msg = error2 instanceof Error ? error2.message : "키워드 조회 실패";
          return NextResponse.json({ error: msg }, { status });
        }
      } else {
        const status = pickErrorStatus(error);
        const msg = error instanceof Error ? error.message : "키워드 조회 실패";
        return NextResponse.json({ error: msg }, { status });
      }
    }

    const items = Array.isArray(keywordTool?.keywordList) ? keywordTool.keywordList : [];
    const rows = items
      .map((item) => {
        const keyword = String(item.relKeyword ?? "").trim();
        const pcLo = parseVolume(item.monthlyPcQcCnt, "lo");
        const moLo = parseVolume(item.monthlyMobileQcCnt, "lo");
        const pcHi = parseVolume(item.monthlyPcQcCnt, "hi");
        const moHi = parseVolume(item.monthlyMobileQcCnt, "hi");
        const pcCtr = parseMaybeNumber(item.monthlyAvePcCtr);
        const moCtr = parseMaybeNumber(item.monthlyAveMobileCtr);
        const ctrAvg = avg([pcCtr, moCtr]);
        const plAvgDepth = parseMaybeNumber(item.plAvgDepth);
        return {
          keyword,
          volume_pc_lo: pcLo,
          volume_mobile_lo: moLo,
          volume_total_lo: pcLo + moLo,
          volume_pc_hi: pcHi,
          volume_mobile_hi: moHi,
          volume_total_hi: pcHi + moHi,
          ctr_pc: pcCtr,
          ctr_mobile: moCtr,
          ctr_avg: ctrAvg,
          compIdx: item.compIdx ? String(item.compIdx) : null,
          plAvgDepth: plAvgDepth == null ? null : plAvgDepth,
          bid_pos1: null as number | null,
          bid_pos2: null as number | null,
          bid_pos3: null as number | null,
          bid_pos4: null as number | null,
          bid_pos5: null as number | null,
        };
      })
      .filter((row) => row.keyword.length > 0)
      .slice(0, parsed.data.maxResults)
      .sort((a, b) => b.volume_total_hi - a.volume_total_hi);

    const bidMeta: { requestedKeywords: number; receivedItems: number; error?: string } | null =
      parsed.data.includeBids && rows.length > 0
        ? { requestedKeywords: 0, receivedItems: 0 }
        : null;

    if (parsed.data.includeBids && rows.length > 0) {
      const bidKeywords = rows
        .slice(0, parsed.data.maxBidKeywords)
        .map((r) => r.keyword)
        .filter(Boolean);
      if (bidMeta) bidMeta.requestedKeywords = bidKeywords.length;

      try {
        const bids = await getAveragePositionBids({
          creds,
          device: parsed.data.device,
          keywords: bidKeywords,
          positions: [1, 2, 3, 4, 5],
          chunkSize: 80,
        });

        if (bidMeta) bidMeta.receivedItems = Array.isArray(bids.items) ? bids.items.length : 0;

        const bidMap = new Map<string, Record<number, number>>();
        for (const b of bids.items ?? []) {
          const key = String(b.keyword ?? b.key ?? "").trim();
          if (!key) continue;
          const prev = bidMap.get(key) ?? {};
          prev[b.position] = Number(b.bid) || 0;
          bidMap.set(key, prev);
        }

        for (const row of rows) {
          const map = bidMap.get(row.keyword);
          if (!map) continue;
          row.bid_pos1 = map[1] ?? null;
          row.bid_pos2 = map[2] ?? null;
          row.bid_pos3 = map[3] ?? null;
          row.bid_pos4 = map[4] ?? null;
          row.bid_pos5 = map[5] ?? null;
        }
      } catch (error) {
        // Graceful fallback: bids are optional.
        if (bidMeta) {
          bidMeta.error = error instanceof Error ? error.message : "입찰가 조회 실패";
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        query: queryRaw,
        hintKeywords,
        fallbackUsed,
        fetchedAt: Date.now(),
        rows,
        ...(bidMeta ? { bidMeta } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/searchad/keywordstool] failed:", error);
    const msg = error instanceof Error ? error.message : "키워드 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
