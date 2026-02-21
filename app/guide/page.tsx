"use client";

import Link from "next/link";

import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export default function GuidePage() {
  const t = useLocaleText({
    ko: {
      title: "마케닥 스튜디오 이용 튜토리얼",
      subtitle:
        "처음 사용자도 10분 안에 결과를 만들 수 있도록, 실제 사용 흐름 기준으로 정리한 상세 가이드입니다.",
      startNow: "바로 시작하기 ↗",
      pricing: "모델/가격 보기",
      quickCards: [
        {
          step: "Step 0",
          title: "준비",
          desc: "로그인 후 스튜디오에 진입합니다. 카카오/Google/이메일 로그인 모두 사용할 수 있습니다.",
        },
        {
          step: "Step 1",
          title: "워크플로우 선택",
          desc: "레퍼런스 분석형 또는 직접 입력형 중 목적에 맞는 흐름을 먼저 고릅니다.",
        },
        {
          step: "Step 2",
          title: "생성/저장",
          desc: "생성 후 프로젝트 단위로 저장되며, 상세 페이지에서 PNG 다운로드가 가능합니다.",
        },
      ],
      analyzeTitle: "A. 분석 기반 제작 상세",
      analyzeFlow: [
        "스튜디오에서 `분석 기반 제작` 탭을 선택하고 레퍼런스 이미지를 올립니다.",
        "필요하면 제품 이미지/로고/제품 정보를 함께 입력합니다.",
        "`레퍼런스 분석하기`를 눌러 레이아웃, 후킹 패턴, 가독성 경고를 확인합니다.",
        "자동 생성된 3개 프롬프트(기획자/마케터/디자이너)를 각각 편집합니다.",
        "모델과 비율을 선택한 뒤 단일 생성 또는 모두 생성을 실행합니다.",
        "생성 결과를 비교하고 원하는 컷을 다운로드하거나 프로젝트에 보관합니다.",
      ],
      directTitle: "B. 직접 입력 제작 상세",
      directFlow: [
        "스튜디오에서 `직접 입력 제작` 탭으로 이동합니다.",
        "비주얼 설명, 헤드카피, CTA를 입력합니다. 레퍼런스/제품 이미지는 선택입니다.",
        "텍스트와 스타일을 조정한 뒤 즉시 생성합니다.",
        "생성 후 프로젝트 상세에서 PNG를 다운로드합니다.",
      ],
      creditTitle: "모델/크레딧 정책 빠른 이해",
      creditCards: [
        { title: "크레딧 단위", body: "1크레딧 = 100원 기준으로 차감됩니다." },
        { title: "분석 차감", body: "레퍼런스 분석 1회당 1크레딧이 차감됩니다." },
        { title: "생성 차감", body: "이미지 생성 시 기본 모델 2크레딧, 상위버전 모델 3크레딧이 차감됩니다." },
        { title: "생성 기록", body: "성공/실패 시도 모두 원장(ledger) 기록으로 남습니다." },
        { title: "초기 보너스", body: "회원가입 시 기본 10크레딧이 지급됩니다." },
      ],
      troubleTitle: "자주 막히는 문제 해결",
      troubles: [
        {
          problem: "크레딧 부족 메시지가 뜹니다.",
          solution: "`/account`에서 크레딧을 충전한 뒤 다시 시도하세요. 분석 1, 생성(기본 2 / 상위 3) 크레딧 정책입니다.",
        },
        {
          problem: "모델 에러/실패가 발생합니다.",
          solution: "다른 모델로 변경해 재시도하고, 동일 오류가 지속되면 프롬프트를 간결하게 줄여보세요.",
        },
        {
          problem: "텍스트가 과하게 크거나 답답합니다.",
          solution: "문구 길이를 줄이고 핵심 메시지를 상단에 배치하세요.",
        },
        {
          problem: "업로드가 되지 않습니다.",
          solution: "이미지 형식(JPG/PNG/WEBP)과 파일 용량(4MB 이하)을 확인하세요.",
        },
      ],
    },
    en: {
      title: "MakeDoc Studio Tutorial",
      subtitle:
        "A practical, step-by-step guide so first-time users can produce outputs within 10 minutes.",
      startNow: "Start now ↗",
      pricing: "View model pricing",
      quickCards: [
        {
          step: "Step 0",
          title: "Preparation",
          desc: "Sign in first. Both Google sign-in and email sign-in are supported.",
        },
        {
          step: "Step 1",
          title: "Choose workflow",
          desc: "Pick analyze-based flow or direct-input flow based on your goal.",
        },
        {
          step: "Step 2",
          title: "Generate / Save",
          desc: "Outputs are saved by project, and PNG can be downloaded from project detail.",
        },
      ],
      analyzeTitle: "A. Analyze-based workflow",
      analyzeFlow: [
        "Open `Analyze-based` tab and upload a reference image.",
        "Optionally add product image/logo/product context.",
        "Click `Analyze Reference` to inspect layout, hook pattern, and readability warnings.",
        "Edit the 3 generated prompts (Planner / Marketer / Designer).",
        "Choose model and ratio, then run single or batch generation.",
        "Compare generated results and download or keep selected cuts in projects.",
      ],
      directTitle: "B. Direct-input workflow",
      directFlow: [
        "Open the `Direct input` tab in Studio.",
        "Enter visual prompt, headline, and CTA. Reference/product images are optional.",
        "Adjust text/style controls and generate instantly.",
        "Download PNG from project detail after generation.",
      ],
      creditTitle: "Quick credit model overview",
      creditCards: [
        { title: "Credit unit", body: "1 credit = KRW 100." },
        { title: "Analysis cost", body: "Each reference analysis costs 1 credit." },
        { title: "Generation cost", body: "Generation uses 2 credits on Basic and 3 credits on Advanced." },
        { title: "Generation ledger", body: "Both successful and failed attempts are logged in ledger." },
        { title: "Signup bonus", body: "New users receive 10 credits on signup." },
      ],
      troubleTitle: "Troubleshooting",
      troubles: [
        {
          problem: "Insufficient credits",
          solution: "Top up credits on `/account` and retry. Policy: analysis 1 credit, generation (Basic 2 / Advanced 3).",
        },
        {
          problem: "Model generation errors",
          solution: "Switch to another model and retry. If persistent, simplify the prompt wording.",
        },
        {
          problem: "Text appears too large or crowded",
          solution: "Shorten copy and keep key message in the top hierarchy.",
        },
        {
          problem: "Upload failed",
          solution: "Check image format (JPG/PNG/WEBP) and file size (up to 4MB).",
        },
      ],
    },
  });

  return (
    <div className="pb-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-10">
        <section className="rounded-[34px] border border-black/10 bg-[#0B0B0C] p-8 text-[#F5F5F0] md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#D6FF4F]">Guide</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-3xl text-sm text-white/75 md:text-base">{t.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF4F] px-5 py-2.5 text-sm font-semibold text-[#0B0B0C]"
            >
              {t.startNow}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[#F5F5F0]"
            >
              {t.pricing}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {t.quickCards.map((card) => (
            <article key={card.step} className="rounded-[28px] border border-black/10 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">{card.step}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0B0B0C]">{card.title}</h2>
              <p className="mt-2 text-sm text-black/65">{card.desc}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">{t.analyzeTitle}</h2>
          <ol className="mt-4 space-y-2 text-sm text-black/70">
            {t.analyzeFlow.map((step, index) => (
              <li key={step} className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#D6FF4F] text-[11px] font-bold text-[#0B0B0C]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">{t.directTitle}</h2>
          <ol className="mt-4 space-y-2 text-sm text-black/70">
            {t.directFlow.map((step, index) => (
              <li key={step} className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#D6FF4F] text-[11px] font-bold text-[#0B0B0C]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">{t.creditTitle}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {t.creditCards.map((item) => (
              <div key={item.title} className="rounded-xl border border-black/10 bg-black/[0.015] p-4 text-sm text-black/70">
                <p className="font-semibold text-black/85">{item.title}</p>
                <p className="mt-1">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">{t.troubleTitle}</h2>
          <div className="mt-4 space-y-3">
            {t.troubles.map((item) => (
              <article key={item.problem} className="rounded-xl border border-black/10 bg-black/[0.015] p-4">
                <p className="text-sm font-semibold text-black/85">{item.problem}</p>
                <p className="mt-1 text-sm text-black/65">{item.solution}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
