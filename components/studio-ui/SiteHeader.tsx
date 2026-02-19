"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { useSiteLocale } from "@/lib/siteLocale";

const PUBLIC_LINKS = [
  { href: "/pricing", label: { ko: "요금", en: "Pricing" } },
  { href: "/examples", label: { ko: "예시", en: "Examples" } },
  { href: "/templates", label: { ko: "템플릿", en: "Templates" } },
  { href: "/guide", label: { ko: "가이드", en: "Guide" } },
  { href: "/faq", label: { ko: "FAQ", en: "FAQ" } },
];

type SiteHeaderProps = {
  appLinks?: Array<{ href: string; label: string }>;
  showStudioCta?: boolean;
};

export default function SiteHeader({
  appLinks,
  showStudioCta = true,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const { locale, setLocale } = useSiteLocale();
  const links = appLinks ?? PUBLIC_LINKS.map((item) => ({ href: item.href, label: item.label[locale] }));

  return (
    <header className="sticky top-5 z-50 mx-auto w-full max-w-7xl px-4">
      <div className="flex items-center justify-between gap-2 rounded-full border border-black/10 bg-[rgba(245,245,240,0.85)] px-3 py-3 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:gap-3 md:px-6">
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-[#0B0B0C] text-[#D6FF4F]"
                    : "text-[#0B0B0C] hover:bg-black/5",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/" className="rounded-full border border-black/10 bg-[#0B0B0C] px-3 py-2 text-xs font-semibold text-[#F5F5F0] md:px-5 md:text-sm">
          MakeDoc Studio
        </Link>

        <div className="rounded-full border border-black/10 bg-black/[0.03] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setLocale("ko")}
            className={[
              "rounded-full px-2.5 py-1 md:px-3",
              locale === "ko" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55",
            ].join(" ")}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={[
              "rounded-full px-2.5 py-1 md:px-3",
              locale === "en" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55",
            ].join(" ")}
          >
            EN
          </button>
        </div>

        {showStudioCta ? (
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/studio-entry"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#D6FF4F] px-3 py-2 text-xs font-semibold text-[#0B0B0C] md:gap-2 md:px-4 md:text-sm"
            >
              {locale === "ko" ? "스튜디오 열기" : "Open Studio"}
              <motion.span whileHover={{ rotate: 35 }}>↗</motion.span>
            </Link>
          </motion.div>
        ) : (
          <div className="w-[90px] md:w-[112px]" />
        )}
      </div>
    </header>
  );
}
