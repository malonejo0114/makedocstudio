"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import MkdocLogo from "@/components/MkdocLogo";

type KeywordToolRow = {
  keyword: string;
  volume_pc_lo: number;
  volume_mobile_lo: number;
  volume_total_lo: number;
  volume_pc_hi: number;
  volume_mobile_hi: number;
  volume_total_hi: number;
  ctr_pc: number | null;
  ctr_mobile: number | null;
  ctr_avg: number | null;
  compIdx: string | null;
  plAvgDepth: number | null;
  bid_pos1: number | null;
  bid_pos2: number | null;
  bid_pos3: number | null;
  bid_pos4: number | null;
  bid_pos5: number | null;
};

type ApiResponse =
  | {
      ok: true;
      query: string;
      hintKeywords: string;
      fallbackUsed: boolean;
      fetchedAt: number;
      rows: KeywordToolRow[];
    }
  | { error: string; detail?: any };

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("ko-KR");
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n.toFixed(2)}%`;
}

function formatCurrencyLike(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(text);
        } catch {
          // ignore
        }
      }}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

export default function KeywordSearchTool() {
  const [query, setQuery] = useState("");
  const [device, setDevice] = useState<"PC" | "MOBILE">("PC");
  const [includeBids, setIncludeBids] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Extract<ApiResponse, { ok: true }> | null>(null);

  const canRun = query.trim().length > 0 && !loading;

  const run = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) {
      setError("키워드를 입력해 주세요.");
      return;
    }
    setQuery(q);

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/searchad/keywordstool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          device,
          includeBids,
          showDetail: true,
          maxResults: 100,
          maxBidKeywords: 30,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "키워드 조회 실패");
      }

      setData(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "키워드 조회 실패";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const keywordListText = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.map((r) => r.keyword).filter(Boolean).join("\n");
  }, [data?.rows]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">도구</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">키워드 서치 엔진</h1>
            <p className="mt-1 text-sm text-slate-600">
              키워드를 입력하면 연관검색어(검색량/CTR/경쟁도)를 한 번에 펼쳐서 볼 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/diagnosis"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            진단
          </Link>
          <Link
            href="/creative"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            광고소재 스튜디오
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[0.85fr,1.15fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Input</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">키워드 검색</p>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                키워드(힌트)
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void run();
                }}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="예: 성수동 라멘 / 강남 회식 / 샤로수길 맛집"
              />
              <p className="text-[11px] text-slate-500">
                SearchAd 키가 없으면 실행이 실패합니다. (설정:{" "}
                <span className="font-mono">NAVER_SEARCHAD_*</span>)
              </p>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Device (입찰가용)
                </span>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value as any)}
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="PC">PC</option>
                  <option value="MOBILE">MOBILE</option>
                </select>
              </label>

              <label className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={includeBids}
                  onChange={(e) => setIncludeBids(e.target.checked)}
                />
                <span className="text-xs font-semibold text-slate-700">
                  입찰가(1~5위)도 조회
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={!canRun}
              className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "불러오는 중..." : "연관검색어 불러오기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setData(null);
                setError(null);
              }}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              초기화
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.6)] backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">연관검색어 결과</p>
              <p className="mt-0.5 text-xs text-slate-600">
                keywordstool 기반 · 볼륨은 &quot;&lt;10&quot; 구간이 있어 보수적으로 표시될 수 있습니다.
              </p>
            </div>
            {data?.rows?.length ? (
              <div className="flex items-center gap-2">
                <CopyButton text={keywordListText} label="키워드 복사" />
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : !data ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              키워드를 입력하고 실행하면 연관검색어가 여기에 표시됩니다.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  {data.rows.length}개
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  {new Date(data.fetchedAt).toLocaleString("ko-KR")}
                </span>
                {data.fallbackUsed ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                    공백 제거로 재시도됨
                  </span>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">키워드</th>
                        <th className="px-3 py-2">월검색(Hi)</th>
                        <th className="px-3 py-2">CTR(avg)</th>
                        <th className="px-3 py-2">경쟁</th>
                        {includeBids ? (
                          <>
                            <th className="px-3 py-2">P1</th>
                            <th className="px-3 py-2">P3</th>
                            <th className="px-3 py-2">P5</th>
                          </>
                        ) : null}
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.slice(0, 80).map((row) => (
                        <tr key={row.keyword} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-900">{row.keyword}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              PC {formatCompactNumber(row.volume_pc_hi)} · MO{" "}
                              {formatCompactNumber(row.volume_mobile_hi)}
                            </p>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {formatCompactNumber(row.volume_total_hi)}
                          </td>
                          <td className="px-3 py-2">{formatPct(row.ctr_avg)}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                              {row.compIdx ?? "-"}
                            </span>
                          </td>
                          {includeBids ? (
                            <>
                              <td className="px-3 py-2">{formatCurrencyLike(row.bid_pos1)}</td>
                              <td className="px-3 py-2">{formatCurrencyLike(row.bid_pos3)}</td>
                              <td className="px-3 py-2">{formatCurrencyLike(row.bid_pos5)}</td>
                            </>
                          ) : null}
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void run(row.keyword)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              이 키워드로 검색
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                팁: 목록에서 키워드를 눌러 계속 확장하면, &quot;키워드 그물망&quot;을 빠르게 만들 수 있습니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

