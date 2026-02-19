import type { Metadata } from "next";

import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export const metadata: Metadata = {
  title: "개인정보처리방침 | MakeDoc Studio",
  description: "마케닥 스튜디오 개인정보 처리방침",
};

const UPDATED_AT = "2026-02-18";

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-20 pt-8">
        <section className="rounded-[30px] border border-black/10 bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">Privacy Policy</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">개인정보처리방침</h1>
          <p className="mt-3 text-sm text-black/60">최종 업데이트: {UPDATED_AT}</p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">1. 수집하는 개인정보 항목</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>필수: 이메일, 인증 식별자, 접속 로그, 기기/브라우저 기본 정보</li>
            <li>서비스 이용 데이터: 입력 프롬프트, 업로드 이미지, 생성 결과, 프로젝트/크레딧 기록</li>
            <li>연동 데이터(선택): Meta 광고 계정 ID, 페이지 ID, 캠페인 업로드 로그</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">2. 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>회원 인증, 계정 보안, 고객 지원 처리</li>
            <li>이미지 생성/저장/다운로드 및 프로젝트 히스토리 제공</li>
            <li>크레딧 차감/정산 기록 관리 및 부정 사용 방지</li>
            <li>사용자 요청 시 Meta 광고 업로드 기능 제공</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">3. 보관 및 파기</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>원칙: 목적 달성 시 지체 없이 파기</li>
            <li>계정/프로젝트 데이터: 이용자 삭제 요청 또는 계정 종료 시 파기</li>
            <li>법령 보관 대상 데이터: 관련 법령이 정한 기간 동안 별도 보관 후 파기</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">4. 처리 위탁 및 국외 이전</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Supabase Inc. (미국): 인증, 데이터베이스, 스토리지</li>
            <li>Vercel Inc. (미국): 웹 애플리케이션 호스팅 및 배포</li>
            <li>Google LLC (미국): 이미지/텍스트 생성 모델 처리</li>
            <li>Meta Platforms, Inc. (미국): 사용자가 명시적으로 실행한 광고 업로드 처리</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">5. 이용자 권리</h2>
          <p className="mt-3">
            이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 요청은
            <a href="mailto:support@makedoc.studio" className="ml-1 underline">
              support@makedoc.studio
            </a>
            로 접수되며, 본인 확인 후 처리됩니다.
          </p>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
