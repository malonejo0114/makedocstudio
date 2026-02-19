import type { Metadata } from "next";
import Link from "next/link";

import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";

export const metadata: Metadata = {
  title: "데이터 삭제 안내 | MakeDoc Studio",
  description: "마케닥 스튜디오 데이터 삭제 요청 및 처리 안내",
};

const UPDATED_AT = "2026-02-18";

export default function DataDeletionPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-20 pt-8">
        <section className="rounded-[30px] border border-black/10 bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">Data Deletion</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">데이터 삭제 안내</h1>
          <p className="mt-3 text-sm text-black/60">최종 업데이트: {UPDATED_AT}</p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">1. 서비스 내 직접 삭제</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>프로젝트/생성 결과는 프로젝트 화면에서 개별 삭제할 수 있습니다.</li>
            <li>Meta 연동 해제는 계정 화면에서 즉시 수행할 수 있습니다.</li>
          </ul>
          <Link href="/account" className="mt-4 inline-flex items-center rounded-full bg-[#0B0B0C] px-4 py-2 text-xs font-semibold text-[#D6FF4F]">
            계정 화면 열기 ↗
          </Link>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">2. 계정/연동 데이터 전체 삭제 요청</h2>
          <p className="mt-3">
            아래 정보를 포함해
            <a href="mailto:support@makedoc.studio" className="ml-1 underline">
              support@makedoc.studio
            </a>
            로 요청해 주세요.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>가입 이메일</li>
            <li>요청 유형: 계정 삭제 / Meta 연동 데이터 삭제 / 생성 이력 삭제</li>
            <li>본인 확인을 위한 추가 정보(필요 시)</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">3. 처리 기한</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>접수 확인: 영업일 기준 1일 이내</li>
            <li>삭제 완료: 영업일 기준 최대 7일 이내</li>
            <li>법령상 보관 의무 데이터는 법정 보관 기간 종료 후 파기</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">4. Meta 앱 심사용 안내</h2>
          <p className="mt-3">
            본 페이지는 Meta 개발자 콘솔의 Data Deletion Instructions URL에 등록 가능한 공식 안내 페이지입니다.
          </p>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
