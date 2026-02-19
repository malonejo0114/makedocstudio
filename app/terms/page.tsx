import type { Metadata } from "next";

import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export const metadata: Metadata = {
  title: "이용약관 | MakeDoc Studio",
  description: "마케닥 스튜디오 이용약관",
};

const UPDATED_AT = "2026-02-18";

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-20 pt-8">
        <section className="rounded-[30px] border border-black/10 bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">Terms of Service</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">이용약관</h1>
          <p className="mt-3 text-sm text-black/60">최종 업데이트: {UPDATED_AT}</p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">1. 서비스 내용</h2>
          <p className="mt-3">
            마케닥 스튜디오는 레퍼런스 분석, 프롬프트 작성, 이미지 생성, 프로젝트 저장 및 다운로드 기능을 제공합니다.
          </p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">2. 계정 및 보안</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>이용자는 계정 정보를 정확히 관리해야 하며, 계정 보안 책임은 이용자에게 있습니다.</li>
            <li>비정상 접근 또는 무단 사용이 확인되면 회사는 접속 제한 또는 이용 제한 조치를 할 수 있습니다.</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">3. 크레딧 및 과금 정책</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>기본 단위: 1크레딧 = 100원</li>
            <li>모델별 판매가를 100원 단위로 반올림해 생성 시 차감 크레딧이 계산됩니다.</li>
            <li>생성 실패 시 시스템 정책에 따라 환불 또는 재시도 처리될 수 있습니다.</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">4. 금지 행위</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>타인의 권리를 침해하는 콘텐츠 생성 및 배포</li>
            <li>서비스 역공학, 자동화 남용, 비정상 트래픽 유발</li>
            <li>불법 광고/사기/악성코드 유포 등 관련 법령 위반 행위</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">5. 책임 제한</h2>
          <p className="mt-3">
            회사는 천재지변, 외부 서비스 장애, 통신 장애 등 불가항력 사유로 발생한 손해에 대해 책임을 지지 않으며,
            이용자의 운영 환경 또는 입력 데이터로 인한 결과 차이에 대해서는 보증하지 않습니다.
          </p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">6. 문의</h2>
          <p className="mt-3">
            약관 관련 문의는
            <a href="mailto:support@makedoc.studio" className="ml-1 underline">
              support@makedoc.studio
            </a>
            로 접수해 주세요.
          </p>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
