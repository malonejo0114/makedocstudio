import Link from "next/link";

import SiteHeader from "@/components/studio-ui/SiteHeader";
import LegalFooter from "@/components/studio-ui/LegalFooter";

const ANALYZE_WORKFLOW = [
  "스튜디오에서 `분석 기반 제작` 탭을 선택하고 레퍼런스 이미지를 올립니다.",
  "필요하면 제품 이미지/로고/제품 정보를 함께 입력합니다.",
  "`레퍼런스 분석하기`를 눌러 레이아웃, 후킹 패턴, 가독성 경고를 확인합니다.",
  "자동 생성된 3개 프롬프트(기획자/마케터/디자이너)를 각각 편집합니다.",
  "모델과 비율을 선택한 뒤 단일 생성 또는 모두 생성을 실행합니다.",
  "생성 결과를 비교하고 원하는 컷을 다운로드하거나 프로젝트에 보관합니다.",
];

const DIRECT_WORKFLOW = [
  "스튜디오에서 `직접 입력 제작` 탭으로 이동합니다.",
  "비주얼 설명, 헤드카피, CTA를 입력합니다. 레퍼런스/제품 이미지는 선택입니다.",
  "`텍스트 고정(권장)` 모드면 배경 생성 후 텍스트를 선명한 오버레이로 합성합니다.",
  "레이아웃 편집 모드에서 슬롯을 드래그해 위치 이동, 우하단 핸들로 크기를 조절합니다.",
  "생성 후 `텍스트 합성 PNG 다운로드`로 화면과 동일한 결과를 저장합니다.",
];

const TROUBLESHOOTING = [
  {
    problem: "크레딧 부족 메시지가 뜹니다.",
    solution: "`/account`에서 크레딧을 충전한 뒤 다시 생성하세요. 현재 정책은 1크레딧=100원입니다.",
  },
  {
    problem: "모델 에러/실패가 발생합니다.",
    solution: "다른 모델로 변경해 재시도하고, 동일 오류가 지속되면 프롬프트를 간결하게 줄여보세요.",
  },
  {
    problem: "텍스트가 과하게 크거나 답답합니다.",
    solution: "레이아웃 편집에서 슬롯 높이를 키우거나 문구 길이를 줄이세요. CTA는 12자 이내를 권장합니다.",
  },
  {
    problem: "업로드가 되지 않습니다.",
    solution: "이미지 형식(JPG/PNG/WEBP)과 파일 크기를 확인하고 네트워크 상태 후 재업로드하세요.",
  },
];

export default function GuidePage() {
  return (
    <div className="pb-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-10">
        <section className="rounded-[34px] border border-black/10 bg-[#0B0B0C] p-8 text-[#F5F5F0] md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#D6FF4F]">Guide</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            마케닥 스튜디오 이용 튜토리얼
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-white/75 md:text-base">
            처음 사용자도 10분 안에 결과를 만들 수 있도록, 실제 사용 흐름 기준으로 정리한 상세 가이드입니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/studio-entry"
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF4F] px-5 py-2.5 text-sm font-semibold text-[#0B0B0C]"
            >
              바로 시작하기 ↗
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[#F5F5F0]"
            >
              모델/가격 보기
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[28px] border border-black/10 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">Step 0</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0B0B0C]">준비</h2>
            <p className="mt-2 text-sm text-black/65">
              로그인 후 스튜디오에 진입합니다. Google 로그인 또는 이메일 로그인 둘 다 사용 가능합니다.
            </p>
          </article>
          <article className="rounded-[28px] border border-black/10 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">Step 1</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0B0B0C]">워크플로우 선택</h2>
            <p className="mt-2 text-sm text-black/65">
              레퍼런스 분석형 또는 직접 입력형 중 목적에 맞는 흐름을 먼저 고릅니다.
            </p>
          </article>
          <article className="rounded-[28px] border border-black/10 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">Step 2</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0B0B0C]">생성/저장</h2>
            <p className="mt-2 text-sm text-black/65">
              생성 후 프로젝트 단위로 저장되며, 상세 페이지에서 PNG 다운로드가 가능합니다.
            </p>
          </article>
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">A. 분석 기반 제작 상세</h2>
          <ol className="mt-4 space-y-2 text-sm text-black/70">
            {ANALYZE_WORKFLOW.map((step, index) => (
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
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">B. 직접 입력 제작 상세</h2>
          <ol className="mt-4 space-y-2 text-sm text-black/70">
            {DIRECT_WORKFLOW.map((step, index) => (
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
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">모델/크레딧 정책 빠른 이해</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-black/[0.015] p-4 text-sm text-black/70">
              <p className="font-semibold text-black/85">크레딧 단위</p>
              <p className="mt-1">1크레딧 = 100원 기준으로 차감됩니다.</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.015] p-4 text-sm text-black/70">
              <p className="font-semibold text-black/85">판매가 반영</p>
              <p className="mt-1">모델별 판매가를 100원 단위로 반올림해 필요한 크레딧이 계산됩니다.</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.015] p-4 text-sm text-black/70">
              <p className="font-semibold text-black/85">생성 기록</p>
              <p className="mt-1">성공/실패 시도 모두 원장(ledger) 기록으로 남습니다.</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.015] p-4 text-sm text-black/70">
              <p className="font-semibold text-black/85">잔액 확인</p>
              <p className="mt-1">`/account`에서 잔액과 최근 30건 차감 내역을 확인할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-black/10 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-semibold text-[#0B0B0C]">자주 막히는 문제 해결</h2>
          <div className="mt-4 space-y-3">
            {TROUBLESHOOTING.map((item) => (
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
