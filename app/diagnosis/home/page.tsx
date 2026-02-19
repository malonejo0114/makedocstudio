import Link from "next/link";

import MkdocLogo from "@/components/MkdocLogo";

export default function DiagnosisHomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#ecfeff_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur">
          <MkdocLogo />
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            요식업 마케팅 진단 & 처방전
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            진단 홈(레거시). 신규 플로우는 <strong>/diagnosis</strong>에서 진행됩니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/diagnosis"
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              신규 진단으로 이동
            </Link>
            <Link
              href="/creative"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              광고소재 스튜디오
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-sm font-semibold text-slate-900">무료 3분 진단 (기존)</p>
            <p className="mt-1 text-sm text-slate-600">
              점수/타입/오늘 할 3가지를 즉시 제공하고, 상세 처방전은 결제로 잠금 처리합니다.
            </p>
            <Link
              href="/diagnosis/start"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110"
            >
              기존 진단 시작
            </Link>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)]">
            <p className="text-sm font-semibold text-slate-900">키워드 서치 엔진</p>
            <p className="mt-1 text-sm text-slate-600">
              검색량/CTR/입찰가를 기반으로 “검색형 vs 충동형” 판단 근거를 만들고,
              진단 결과에 데이터를 합칩니다.
            </p>
            <Link
              href="/diagnosis/keyword-net"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              키워드 분석 열기
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}

