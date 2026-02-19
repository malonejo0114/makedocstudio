"use client";

import { useEffect, useMemo, useState } from "react";

type PlaceCandidate = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  link: string;
  mapx: string;
  mapy: string;
};

type KeywordNetRow = {
  keyword: string;
  bucket: "core" | "context" | "delivery" | "brand";
  volume_total_lo: number;
  volume_total_hi: number;
  ctr_avg: number | null;
  bid_pos3: number | null;
  compIdx: string | null;
  plAvgDepth: number | null;
  score: number;
};

type KeywordNetSummary = {
  device: "PC" | "MOBILE";
  demand_top10: number;
  avg_ctr_top10: number | null;
  median_bid_pos3_top10: number | null;
  fetchedAt: number;
};

type KeywordNetApiResponse =
  | {
      ok: true;
      fromCache: boolean;
      cacheKey: string;
      cachedAt?: number;
      ageMinutes?: number;
      placeQuery: string;
      placeId: string | null;
      placeCandidates: PlaceCandidate[];
      selectedPlace: PlaceCandidate | null;
      keywordNet: KeywordNetRow[];
      summary: KeywordNetSummary;
    }
  | { error: string; detail?: any };

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("ko-KR");
}

function formatCurrencyLike(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function bucketLabel(bucket: KeywordNetRow["bucket"]): { label: string; cls: string } {
  switch (bucket) {
    case "brand":
      return { label: "브랜드", cls: "bg-slate-900 text-white" };
    case "delivery":
      return { label: "배달", cls: "bg-emerald-50 text-emerald-800 border border-emerald-200" };
    case "context":
      return { label: "상황", cls: "bg-cyan-50 text-cyan-900 border border-cyan-200" };
    default:
      return { label: "핵심", cls: "bg-amber-50 text-amber-900 border border-amber-200" };
  }
}

function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.6)] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function KeywordNetPanel({
  values,
  runSignal,
}: {
  values: Record<string, unknown>;
  runSignal?: number;
}) {
  const storeName = String(values.store_name ?? "").trim();
  const area = String(values.area ?? "").trim();
  const bizType = String(values.biz_type ?? "").trim() || "restaurant";
  const placeUrl = String(values.place_url ?? "").trim();

  const [device, setDevice] = useState<"PC" | "MOBILE">("PC");
  const [bucketFilter, setBucketFilter] = useState<KeywordNetRow["bucket"] | "all">("all");
  const [selectedLink, setSelectedLink] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Extract<KeywordNetApiResponse, { ok: true }> | null>(null);

  const canRun = storeName.length > 0 && area.length > 0;

  const run = async (opts?: { selectedPlaceLink?: string }) => {
    if (!canRun) {
      setError("매장명/지역을 먼저 입력해 주세요.");
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/diagnosis/keyword-net", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeUrl,
          storeName,
          area,
          bizType,
          device,
          selectedPlaceLink: opts?.selectedPlaceLink || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as KeywordNetApiResponse;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "키워드 분석 실패");
      }

      setData(payload);
      const selected = payload.selectedPlace?.link ?? "";
      setSelectedLink(selected);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "키워드 분석 실패";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canRun) return;
    // If parent provides a runSignal, only run when the signal is > 0.
    if (typeof runSignal === "number" && runSignal <= 0) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, runSignal, canRun]);

  const filteredRows = useMemo(() => {
    const rows = data?.keywordNet ?? [];
    if (bucketFilter === "all") return rows;
    return rows.filter((r) => r.bucket === bucketFilter);
  }, [bucketFilter, data?.keywordNet]);

  const topRows = useMemo(() => filteredRows.slice(0, 30), [filteredRows]);

  return (
    <Card
      title="키워드 그물망 (수요/CTR/입찰가)"
      subtitle="네이버 SearchAd 데이터 기반으로 ‘검색형 vs 충동형’ 판단 근거를 추가합니다."
      actions={
        <div className="flex items-center gap-2">
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as any)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="PC">PC</option>
            <option value="MOBILE">MOBILE</option>
          </select>
          <button
            type="button"
            onClick={() => void run({ selectedPlaceLink: selectedLink || undefined })}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
      }
    >
      {!canRun ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          매장명/지역이 비어 있어서 키워드 분석을 실행할 수 없습니다. (진단 설문에서 입력 후 다시 시도)
        </div>
      ) : loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          <div className="sm:col-span-3 h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">설정 체크</p>
            <p className="mt-1">
              `.env.local`에 네이버 SearchAd 키가 필요합니다:
              <span className="ml-1 font-mono">
                NAVER_SEARCHAD_*
              </span>
            </p>
            <p className="mt-2 text-[11px] text-slate-600">
              참고: 플레이스 후보 자동 매칭(Local Search)을 쓰려면{" "}
              <span className="font-mono">NAVER_CLIENT_ID/NAVER_CLIENT_SECRET</span>도 필요합니다.
            </p>
          </div>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          키워드 분석 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {data.placeCandidates.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  Place Candidate
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  매장 후보 확인 (1클릭)
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  자동 매칭이 틀리면 후보를 바꾸고 다시 불러오세요.
                </p>

                <select
                  value={selectedLink}
                  onChange={(e) => setSelectedLink(e.target.value)}
                  className="mt-3 block w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900"
                >
                  {data.placeCandidates.map((c) => (
                    <option key={c.link} value={c.link}>
                      {c.title} · {c.roadAddress || c.address}
                    </option>
                  ))}
                </select>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void run({ selectedPlaceLink: selectedLink })}
                    disabled={loading}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    선택 매장으로 다시 계산
                  </button>
                  {data.fromCache ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      캐시 사용 ({data.ageMinutes ?? 0}분 전)
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      신규 계산
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-600">수요(Top10)</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatCompactNumber(data.summary.demand_top10)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">월 검색량 합(보수)</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-600">효율(Top10)</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {data.summary.avg_ctr_top10 == null
                      ? "-"
                      : `${data.summary.avg_ctr_top10.toFixed(2)}%`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">평균 CTR</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-600">난이도(Top10)</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatCurrencyLike(data.summary.median_bid_pos3_top10)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">3위 입찰가 중앙값</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs">
            <span className="font-semibold text-slate-700">필터:</span>
            {(["all", "core", "context", "delivery", "brand"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucketFilter(b)}
                className={[
                  "rounded-full border px-3 py-1 font-semibold transition",
                  bucketFilter === b
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                {b === "all"
                  ? "전체"
                  : bucketLabel(b as any).label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-slate-500">
              상위 {Math.min(topRows.length, 30)}개 표시 (score 기준)
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">키워드</th>
                    <th className="px-3 py-2 font-semibold">구분</th>
                    <th className="px-3 py-2 font-semibold">검색량(월)</th>
                    <th className="px-3 py-2 font-semibold">CTR</th>
                    <th className="px-3 py-2 font-semibold">3위 입찰가</th>
                    <th className="px-3 py-2 font-semibold">경쟁</th>
                    <th className="px-3 py-2 font-semibold">깊이</th>
                    <th className="px-3 py-2 font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.map((row) => {
                    const bucket = bucketLabel(row.bucket);
                    return (
                      <tr key={row.keyword} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {row.keyword}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${bucket.cls}`}>
                            {bucket.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.volume_total_lo.toLocaleString("ko-KR")}
                          {row.volume_total_hi !== row.volume_total_lo ? (
                            <span className="ml-1 text-[11px] text-slate-400">
                              (최대 {row.volume_total_hi})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.ctr_avg == null ? "-" : `${row.ctr_avg.toFixed(2)}%`}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatCurrencyLike(row.bid_pos3)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.compIdx ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.plAvgDepth == null ? "-" : row.plAvgDepth}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          {row.score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            주의: SearchAd 키워드 도구는 일부 필드가 “&lt;10”처럼 범위로 제공될 수 있어 보수적으로 점수화했습니다.
          </p>
        </div>
      )}
    </Card>
  );
}
