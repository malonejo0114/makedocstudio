import "server-only";

const NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";

export type NaverLocalItem = {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
};

export type NaverLocalResponse = {
  total: number;
  start: number;
  display: number;
  items: NaverLocalItem[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

export async function searchNaverLocal(
  query: string,
  opts?: { display?: number; start?: number; sort?: "random" | "comment" },
): Promise<NaverLocalResponse> {
  const normalized = query.trim();
  if (!normalized) {
    throw new Error("Query is required.");
  }

  const clientId = requireEnv("NAVER_CLIENT_ID");
  const clientSecret = requireEnv("NAVER_CLIENT_SECRET");

  const url = new URL(NAVER_LOCAL_URL);
  url.searchParams.set("query", normalized);
  url.searchParams.set("display", String(opts?.display ?? 5));
  url.searchParams.set("start", String(opts?.start ?? 1));
  url.searchParams.set("sort", opts?.sort ?? "comment");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[Naver Local API ${res.status}] ${text || "Request failed"}`);
  }

  const json = (await res.json()) as NaverLocalResponse;
  const items = Array.isArray(json?.items) ? json.items : [];
  return {
    total: Number(json?.total ?? 0) || 0,
    start: Number(json?.start ?? 1) || 1,
    display: Number(json?.display ?? items.length) || items.length,
    items: items.map((item) => ({
      ...item,
      title: stripHtml(String(item.title ?? "")),
      description: stripHtml(String(item.description ?? "")),
      category: String(item.category ?? ""),
      link: String(item.link ?? ""),
      telephone: String(item.telephone ?? ""),
      address: String(item.address ?? ""),
      roadAddress: String(item.roadAddress ?? ""),
      mapx: String(item.mapx ?? ""),
      mapy: String(item.mapy ?? ""),
    })),
  };
}

