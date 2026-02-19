import type { KeywordNetRow } from "@/lib/keywordNet";

export type KeywordClusteredRow = {
  keyword: string;
  clusterName: string;
  intent: "core" | "context" | "delivery" | "brand";
  pcVolume: number;
  mVolume: number;
  pcCtr: number | null;
  mCtr: number | null;
  compIdx: string | null;
  estBidP1: number | null;
  estBidP2: number | null;
  estBidP3: number | null;
  estBidP4: number | null;
  estBidP5: number | null;
  priorityScore: number;
};

function pickContextCluster(keyword: string): string {
  const k = keyword;
  const map: Array<{ re: RegExp; label: string }> = [
    { re: /혼밥/, label: "혼밥" },
    { re: /데이트/, label: "데이트" },
    { re: /(회식|모임)/, label: "회식/모임" },
    { re: /단체/, label: "단체" },
    { re: /가족/, label: "가족" },
    { re: /야식/, label: "야식" },
    { re: /주차/, label: "주차" },
    { re: /포토존/, label: "포토존" }
  ];
  for (const x of map) {
    if (x.re.test(k)) return x.label;
  }
  return "상황";
}

function pickCoreCluster(keyword: string): string {
  const tokens: Array<{ re: RegExp; label: string }> = [
    { re: /라멘/, label: "라멘" },
    { re: /(고기|고깃집|삼겹살)/, label: "고기" },
    { re: /(카페|디저트|커피)/, label: "카페/디저트" },
    { re: /(술집|이자카야|호프)/, label: "주점" },
    { re: /(한식|백반|국밥)/, label: "한식" },
    { re: /맛집/, label: "맛집" }
  ];
  for (const t of tokens) {
    if (t.re.test(keyword)) return t.label;
  }
  return "핵심";
}

export function clusterKeywordNetRows(rows: KeywordNetRow[], storeName?: string): KeywordClusteredRow[] {
  const normalizedStore = (storeName ?? "").trim();

  return rows.map((r) => {
    const intent = r.bucket;
    const clusterName =
      intent === "brand"
        ? normalizedStore ? `${normalizedStore} 브랜드` : "브랜드"
        : intent === "delivery"
          ? "배달/포장"
          : intent === "context"
            ? pickContextCluster(r.keyword)
            : pickCoreCluster(r.keyword);

    // Priority: score already mixes demand/ctr/cost; keep it but normalize
    const priorityScore = Number.isFinite(r.score) ? r.score : 0;

    return {
      keyword: r.keyword,
      clusterName,
      intent,
      pcVolume: r.volume_pc_lo,
      mVolume: r.volume_mobile_lo,
      pcCtr: r.ctr_pc,
      mCtr: r.ctr_mobile,
      compIdx: r.compIdx,
      estBidP1: r.bid_pos1,
      estBidP2: r.bid_pos2,
      estBidP3: r.bid_pos3,
      estBidP4: r.bid_pos4,
      estBidP5: r.bid_pos5,
      priorityScore,
    };
  });
}

