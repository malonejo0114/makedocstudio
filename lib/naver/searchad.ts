import "server-only";

import crypto from "node:crypto";

const SEARCHAD_BASE_URL = "https://api.searchad.naver.com";

export type SearchAdCreds = {
  accessLicense: string;
  secretKey: string;
  customerId: string;
};

export type KeywordToolItem = {
  relKeyword: string;
  monthlyPcQcCnt?: string | number;
  monthlyMobileQcCnt?: string | number;
  monthlyAvePcCtr?: string | number;
  monthlyAveMobileCtr?: string | number;
  monthlyAvePcClkCnt?: string | number;
  monthlyAveMobileClkCnt?: string | number;
  compIdx?: string;
  plAvgDepth?: string | number;
};

export type KeywordToolResponse = {
  keywordList: KeywordToolItem[];
};

export type AveragePositionBidReq = {
  device: "PC" | "MOBILE";
  items: Array<{ key: string; position: number }>;
};

export type AveragePositionBidItem = {
  key: string;
  keyword?: string;
  position: number;
  bid: number;
};

export type AveragePositionBidRes = {
  device: "PC" | "MOBILE";
  items: AveragePositionBidItem[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

export function getSearchAdCredsFromEnv(): SearchAdCreds {
  return {
    accessLicense: requireEnv("NAVER_SEARCHAD_ACCESS_LICENSE"),
    secretKey: requireEnv("NAVER_SEARCHAD_SECRET_KEY"),
    customerId: requireEnv("NAVER_SEARCHAD_CUSTOMER_ID"),
  };
}

export function signSearchAd(args: {
  timestamp: string;
  method: "GET" | "POST";
  uri: string; // must start with /
  secretKey: string;
}): string {
  const message = `${args.timestamp}.${args.method}.${args.uri}`;
  return crypto.createHmac("sha256", args.secretKey).update(message).digest("base64");
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function requestSearchAd<T>(args: {
  creds: SearchAdCreds;
  method: "GET" | "POST";
  uri: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}): Promise<T> {
  const { creds, method, uri } = args;
  if (!uri.startsWith("/")) {
    throw new Error("SearchAd uri must start with '/'.");
  }

  const timestamp = Date.now().toString();
  const signature = signSearchAd({
    timestamp,
    method,
    uri,
    secretKey: creds.secretKey,
  });

  const url = new URL(`${SEARCHAD_BASE_URL}${uri}`);
  if (args.query) {
    for (const [k, v] of Object.entries(args.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.NAVER_SEARCHAD_TIMEOUT_MS ?? 12000) || 12000, 3000),
    60000,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Timestamp": timestamp,
        "X-API-KEY": creds.accessLicense,
        "X-Customer": creds.customerId,
        "X-Signature": signature,
      },
      body: args.body ? JSON.stringify(args.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`[SearchAd API TIMEOUT] ${uri} exceeded ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[SearchAd API ${res.status}] ${text || "Request failed"}`);
  }

  return (await res.json()) as T;
}

export async function getKeywordTool(args: {
  creds: SearchAdCreds;
  hintKeywords: string;
  showDetail?: boolean;
}): Promise<KeywordToolResponse> {
  return requestSearchAd<KeywordToolResponse>({
    creds: args.creds,
    method: "GET",
    uri: "/keywordstool",
    query: {
      hintKeywords: args.hintKeywords,
      showDetail: args.showDetail ? 1 : 0,
    },
  });
}

export async function getAveragePositionBids(args: {
  creds: SearchAdCreds;
  device: "PC" | "MOBILE";
  keywords: string[];
  positions?: number[];
  chunkSize?: number;
}): Promise<AveragePositionBidRes> {
  const positions = args.positions ?? [1, 2, 3, 4, 5];
  const uniqueKeywords = Array.from(new Set(args.keywords.map((k) => k.trim()).filter(Boolean)));

  const items = uniqueKeywords.flatMap((k) =>
    positions.map((position) => ({ key: k, position })),
  );

  const parts = chunk(items, args.chunkSize ?? 100);
  const merged: AveragePositionBidItem[] = [];

  const extractItems = (raw: any): AveragePositionBidItem[] => {
    const list: any[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.estimate)
        ? raw.estimate
        : Array.isArray(raw)
          ? raw
          : [];
    return list
      .map((item) => ({
        key: String(item?.key ?? item?.keyword ?? "").trim(),
        keyword: String(item?.keyword ?? item?.key ?? "").trim(),
        position: Number(item?.position) || 0,
        bid: Number(item?.bid) || 0,
      }))
      .filter((x) => x.position > 0 && x.bid >= 0 && (x.key || x.keyword));
  };

  for (const part of parts) {
    const body = { device: args.device, items: part } satisfies AveragePositionBidReq;

    // eslint-disable-next-line no-await-in-loop
    const res1 = await requestSearchAd<any>({
      creds: args.creds,
      method: "POST",
      uri: "/estimate/average-position-bid/keyword",
      body,
    });
    let items1 = extractItems(res1);

    // Some accounts / API versions return empty results on /estimate, but work on /npc-estimate.
    if (items1.length === 0) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res2 = await requestSearchAd<any>({
          creds: args.creds,
          method: "POST",
          uri: "/npc-estimate/average-position-bid/keyword",
          body,
        });
        items1 = extractItems(res2);
      } catch {
        // keep empty
      }
    }

    merged.push(...items1);
  }

  return { device: args.device, items: merged };
}
