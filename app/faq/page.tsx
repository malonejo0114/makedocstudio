"use client";

import SiteHeader from "@/components/studio-ui/SiteHeader";
import LegalFooter from "@/components/studio-ui/LegalFooter";
import { useLocaleText } from "@/components/studio-ui/LanguageProvider";

export default function FaqPage() {
  const t = useLocaleText({
    ko: {
      title: "자주 묻는 질문",
      faqs: [
        {
          q: "이미지 1장 생성 시 크레딧은 어떻게 차감되나요?",
          a: "통합 크레딧에서 차감됩니다. 1크레딧=100원이며, 모델별 판매가를 100원 단위로 반올림한 뒤 그 금액만큼 크레딧이 차감됩니다.",
        },
        {
          q: "생성 실패 시에도 기록이 남나요?",
          a: "네. 시도 기록은 ledger에 남고, 실패 시 자동 환불 로직이 적용됩니다.",
        },
        {
          q: "한글 텍스트 포함 생성이 가능한가요?",
          a: "가능합니다. 다만 성공률을 위해 헤드라인 18자, CTA 12자 이내를 권장합니다.",
        },
        {
          q: "결제(PG) 연동이 있나요?",
          a: "현재 범위는 크레딧 시뮬레이션(개발 모드 충전)까지이며, PG는 추후 확장 예정입니다.",
        },
      ],
    },
    en: {
      title: "Frequently Asked Questions",
      faqs: [
        {
          q: "How are credits deducted per generated image?",
          a: "Credits are deducted from unified balance. 1 credit = KRW 100. Model sell prices are rounded to KRW 100 units and converted to required credits.",
        },
        {
          q: "Do failed generations leave records?",
          a: "Yes. Every attempt is logged in the ledger, and failed attempts trigger refund logic.",
        },
        {
          q: "Can I generate images with Korean text?",
          a: "Yes. For better success rate, keep headline within 18 chars and CTA within 12 chars.",
        },
        {
          q: "Is payment gateway integration available now?",
          a: "Current scope includes credit simulation (dev top-up). PG integration will be added next.",
        },
      ],
    },
  });

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-20 pt-8">
        <section className="rounded-[32px] border border-black/10 bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">FAQ</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">{t.title}</h1>
        </section>

        {t.faqs.map((item) => (
          <section key={item.q} className="rounded-3xl border border-black/10 bg-white p-5">
            <h2 className="text-lg font-semibold text-[#0B0B0C]">{item.q}</h2>
            <p className="mt-2 text-sm text-black/70">{item.a}</p>
          </section>
        ))}
      </main>
      <LegalFooter />
    </div>
  );
}
