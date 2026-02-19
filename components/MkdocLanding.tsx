"use client";

import Link from "next/link";

import { motion } from "framer-motion";

import MkdocLogo from "@/components/MkdocLogo";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-cyan-50/90">
      {children}
    </span>
  );
}

function StatBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "amber";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const cls =
    tone === "emerald"
      ? "from-emerald-300 to-emerald-500"
      : tone === "amber"
        ? "from-amber-200 to-amber-500"
        : "from-cyan-200 to-cyan-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-50/80">
        <span>{label}</span>
        <span className="text-cyan-50/60">{Math.round(pct)}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${cls}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, ease: [0.2, 0.9, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

function PreviewScoreCard() {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_40px_140px_-90px_rgba(34,211,238,0.65)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
            Report Preview
          </p>
          <p className="mt-2 text-lg font-semibold text-white">3분 진단 미리보기</p>
          <p className="mt-1 text-xs text-cyan-50/70">
            결제 전: 점수 + 병목 1개만 공개
          </p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold text-cyan-50/60">총점</p>
          <motion.p
            className="mt-1 text-4xl font-black text-white"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.6 }}
          >
            74
          </motion.p>
          <p className="text-[11px] font-semibold text-cyan-50/60">/ 100</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <StatBar label="Demand(수요)" value={68} tone="cyan" />
        <StatBar label="Cost(광고비)" value={57} tone="amber" />
        <StatBar label="Place CVR(전환)" value={42} tone="emerald" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/12 bg-white/10 p-3 text-xs text-cyan-50/80">
        <p className="font-semibold text-white">병목 1개</p>
        <p className="mt-1">“썸네일/첫인상(Place CVR) 누수”</p>
      </div>

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
    </motion.div>
  );
}

function KeywordNetMini() {
  const pills = [
    "성수동 라멘",
    "성수 데이트",
    "성수 배달",
    "OO라멘",
    "성수 혼밥",
    "성수 맛집",
  ];

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
        Keyword Net
      </p>
      <p className="mt-2 text-lg font-semibold text-white">키워드 그물망</p>
      <p className="mt-1 text-xs text-cyan-50/70">
        SearchAd 데이터로 수요/CTR/입찰가를 정량화합니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((t, idx) => (
          <motion.span
            key={t}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.35, delay: idx * 0.04 }}
            className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-semibold text-cyan-50/85"
          >
            {t}
          </motion.span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "수요", value: "42k" },
          { label: "CTR", value: "1.9%" },
          { label: "3위 입찰", value: "2,800원" },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border border-white/12 bg-white/10 p-3">
            <p className="text-[11px] font-semibold text-cyan-50/65">{x.label}</p>
            <p className="mt-1 text-sm font-black text-white">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute -right-20 bottom-[-5rem] h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
    </motion.div>
  );
}

export default function MkdocLanding() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
      <header className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.2, 0.9, 0.2, 1] }}
          className="max-w-2xl"
        >
          <MkdocLogo tone="light" />

          <div className="mt-6 flex flex-wrap gap-2">
            <Pill>진단</Pill>
            <Pill>처방전</Pill>
            <Pill>실행 연결</Pill>
            <Pill>키워드 그물망</Pill>
          </div>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            요식업 마케팅,
            <br />
            감이 아니라 <span className="text-cyan-200">근거</span>로 고칩니다.
          </h1>
          <p className="mt-4 text-base text-cyan-50/85 sm:text-lg">
            3분 진단으로 병목을 딱 1개 찌르고, 결제 후에는 “30일 처방전”과 실행 상품을
            연결해드립니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/diagnosis"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22d3ee_0%,#10b981_100%)] px-5 py-3 text-sm font-black text-slate-950 shadow-[0_30px_90px_-60px_rgba(34,211,238,0.65)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              3분 진단 시작
            </Link>
            <Link
              href="/creative"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              광고소재 스튜디오
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/0 px-5 py-3 text-sm font-semibold text-cyan-50/90 transition hover:bg-white/5"
            >
              로그인
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.2, 0.9, 0.2, 1] }}
          className="w-full max-w-xl"
        >
          <div className="grid gap-4">
            <PreviewScoreCard />
            <KeywordNetMini />
          </div>
        </motion.div>
      </header>

      <section className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3">
        {[
          {
            title: "진단",
            desc: "BEP/전환/후킹/키워드를 수치로 측정합니다.",
          },
          {
            title: "처방전",
            desc: "72h/14d/30d 실행 플랜으로 바꿉니다.",
          },
          {
            title: "실행 연결",
            desc: "딱 1~2개 상품만 강하게 추천하고 나머지는 접습니다.",
          },
        ].map((x, idx) => (
          <motion.div
            key={x.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: idx * 0.06 }}
            className="rounded-3xl border border-white/12 bg-white/5 p-5 text-white backdrop-blur"
          >
            <p className="text-sm font-black">{x.title}</p>
            <p className="mt-2 text-sm text-cyan-50/75">{x.desc}</p>
          </motion.div>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/12 bg-white/5 p-6 text-white backdrop-blur md:mt-14">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
              Sample
            </p>
            <h2 className="mt-2 text-2xl font-black">샘플 리포트 구성</h2>
            <p className="mt-2 text-sm text-cyan-50/75">
              결제 후에는 키워드 그물망, 플레이스 처방전, 썸네일 템플릿까지 모두 열립니다.
            </p>
          </div>
          <Link
            href="/diagnosis"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
          >
            지금 바로 진단하기
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr,1.2fr]">
          {[
            {
              title: "1분 요약",
              items: ["총점/병목", "우선순위 3개", "이번 달 액션"],
            },
            {
              title: "매출 방정식",
              items: ["유입×전환×재방문×객단가", "BEP/최대 CPA", "예산 상한"],
            },
            {
              title: "처방전",
              items: ["플레이스 체크리스트", "사진/썸네일 템플릿", "추천 상품(접기)"],
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-white/12 bg-white/10 p-5"
            >
              <p className="text-sm font-black">{card.title}</p>
              <ul className="mt-4 space-y-2 text-sm text-cyan-50/80">
                {card.items.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300/90" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 text-xs text-cyan-50/60 md:mt-14 md:flex-row md:items-center">
        <p>
          © {new Date().getFullYear()} MKDoc. This MVP includes diagnostic logic, keyword net caching, and paid report unlock.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/diagnosis" className="hover:text-cyan-50">
            진단
          </Link>
          <Link href="/creative" className="hover:text-cyan-50">
            광고소재
          </Link>
          <Link href="/admin" className="hover:text-cyan-50">
            관리자
          </Link>
        </div>
      </footer>
    </div>
  );
}

