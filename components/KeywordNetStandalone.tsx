"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import MkdocLogo from "@/components/MkdocLogo";
import KeywordNetPanel from "@/components/KeywordNetPanel";

type BizType = "restaurant" | "cafe" | "bar" | "delivery" | "franchise" | "etc";

const BIZ_TYPE_OPTIONS: Array<{ value: BizType; label: string }> = [
  { value: "restaurant", label: "일반식당" },
  { value: "cafe", label: "카페/디저트" },
  { value: "bar", label: "주점/이자카야" },
  { value: "delivery", label: "배달/포장 위주" },
  { value: "franchise", label: "프랜차이즈" },
  { value: "etc", label: "기타" },
];

export default function KeywordNetStandalone() {
  const [storeName, setStoreName] = useState("");
  const [area, setArea] = useState("");
  const [bizType, setBizType] = useState<BizType>("restaurant");
  const [placeUrl, setPlaceUrl] = useState("");
  const [runSignal, setRunSignal] = useState(0);

  const values = useMemo(
    () => ({
      store_name: storeName,
      area,
      biz_type: bizType,
      place_url: placeUrl,
    }),
    [area, bizType, placeUrl, storeName],
  );

  const canRun = storeName.trim().length > 0 && area.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_90px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MkdocLogo compact />
          <div>
            <p className="text-xs font-semibold text-slate-700">도구</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">키워드 그물망(매장 기준)</h1>
            <p className="mt-1 text-sm text-slate-600">
              네이버 SearchAd 기반으로 검색량/CTR/입찰가를 뽑아 “검색형 vs 충동형” 판단 근거를 만듭니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/keyword-search"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            키워드 단일 검색
          </Link>
          <Link
            href="/diagnosis"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            진단 홈
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Input
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">매장 정보</p>
          <p className="mt-1 text-xs text-slate-600">
            최소 입력: <span className="font-mono">매장명 + 지역</span>
          </p>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                매장명
              </span>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="예: 성수 OO카페"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                지역(상권)
              </span>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="예: 성수동 / 홍대입구역 / OO대학"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                업태(시드)
              </span>
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value as BizType)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                {BIZ_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                플레이스 URL(선택)
              </span>
              <input
                value={placeUrl}
                onChange={(e) => setPlaceUrl(e.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="https://place.naver.com/restaurant/..."
              />
              <p className="text-[11px] text-slate-500">
                URL은 매장 후보 자동 매칭 정확도를 높이는 용도입니다.
              </p>
            </label>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setRunSignal(Date.now())}
              disabled={!canRun}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-60"
            >
              키워드 분석 실행
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              필수: <span className="font-mono">NAVER_SEARCHAD_ACCESS_LICENSE</span>,{" "}
              <span className="font-mono">NAVER_SEARCHAD_SECRET_KEY</span>,{" "}
              <span className="font-mono">NAVER_SEARCHAD_CUSTOMER_ID</span>. (선택: 매장 후보 자동 매칭은{" "}
              <span className="font-mono">NAVER_CLIENT_ID</span>, <span className="font-mono">NAVER_CLIENT_SECRET</span> 필요)
            </p>
          </div>
        </section>

        <KeywordNetPanel values={values} runSignal={runSignal} />
      </div>
    </div>
  );
}
