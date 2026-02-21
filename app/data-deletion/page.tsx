import type { Metadata } from "next";
import Link from "next/link";

import LegalFooter from "@/components/studio-ui/LegalFooter";
import SiteHeader from "@/components/studio-ui/SiteHeader";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Data Deletion | MakeDoc Studio",
  description: "MakeDoc Studio data deletion instructions",
};

const UPDATED_AT = "2026-02-18";

export default function DataDeletionPage() {
  const locale = getRequestLocale();
  const isKo = locale === "ko";
  const t = {
    title: isKo ? "데이터 삭제 안내" : "Data Deletion Instructions",
    updated: isKo ? "최종 업데이트" : "Last updated",
    section1: isKo ? "1. 서비스 내 직접 삭제" : "1. In-app deletion",
    section2: isKo ? "2. 계정/연동 데이터 전체 삭제 요청" : "2. Full account/integration data deletion request",
    section3: isKo ? "3. 처리 기한" : "3. Processing timeline",
    section4: isKo ? "4. Meta 앱 심사용 안내" : "4. Meta app review notice",
    accountCta: isKo ? "계정 화면 열기 ↗" : "Open Account ↗",
    body1: isKo
      ? [
          "프로젝트/생성 결과는 프로젝트 화면에서 개별 삭제할 수 있습니다.",
          "Meta 연동 해제는 계정 화면에서 즉시 수행할 수 있습니다.",
        ]
      : [
          "Projects and generated results can be deleted individually in project screens.",
          "Meta integration can be disconnected immediately from the account page.",
        ],
    body2Lead: isKo
      ? "아래 정보를 포함해 support@makedoc.studio 로 요청해 주세요."
      : "Please send a request to support@makedoc.studio including the following:",
    body2List: isKo
      ? ["가입 이메일", "요청 유형: 계정 삭제 / Meta 연동 데이터 삭제 / 생성 이력 삭제", "본인 확인을 위한 추가 정보(필요 시)"]
      : ["Registered email", "Request type: account deletion / Meta integration data deletion / generation history deletion", "Additional identity details if required"],
    body3: isKo
      ? ["접수 확인: 영업일 기준 1일 이내", "삭제 완료: 영업일 기준 최대 7일 이내", "법령상 보관 의무 데이터는 법정 보관 기간 종료 후 파기"]
      : ["Acknowledgement: within 1 business day", "Deletion completion: within up to 7 business days", "Legally required retained data is deleted after statutory period"],
    body4: isKo
      ? "본 페이지는 Meta 개발자 콘솔의 Data Deletion Instructions URL에 등록 가능한 공식 안내 페이지입니다."
      : "This page can be registered as the official Data Deletion Instructions URL in Meta Developer Console.",
  };

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-20 pt-8">
        <section className="rounded-[30px] border border-black/10 bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">Data Deletion</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">{t.title}</h1>
          <p className="mt-3 text-sm text-black/60">
            {t.updated}: {UPDATED_AT}
          </p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">{t.section1}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {t.body1.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href="/account" className="mt-4 inline-flex items-center rounded-full bg-[#0B0B0C] px-4 py-2 text-xs font-semibold text-[#D6FF4F]">
            {t.accountCta}
          </Link>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">{t.section2}</h2>
          <p className="mt-3">{t.body2Lead}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {t.body2List.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">{t.section3}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {t.body3.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/75">
          <h2 className="text-lg font-semibold text-[#0B0B0C]">{t.section4}</h2>
          <p className="mt-3">{t.body4}</p>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
