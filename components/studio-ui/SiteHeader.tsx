"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import LanguageToggle from "@/components/studio-ui/LanguageToggle";
import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import type { Locale } from "@/lib/i18n/config";
import type { SiteCopySettings } from "@/lib/siteCopySettings";

const PUBLIC_LINKS: Record<Locale, Array<{ href: string; label: string }>> = {
  ko: [
    { href: "/pricing", label: "요금" },
    { href: "/examples", label: "예시" },
    { href: "/templates", label: "템플릿" },
    { href: "/guide", label: "가이드" },
    { href: "/faq", label: "FAQ" },
  ],
  en: [
    { href: "/pricing", label: "Pricing" },
    { href: "/examples", label: "Examples" },
    { href: "/templates", label: "Templates" },
    { href: "/guide", label: "Guide" },
    { href: "/faq", label: "FAQ" },
  ],
};

type SiteHeaderProps = {
  appLinks?: Array<{ href: string; label: string }>;
  showStudioCta?: boolean;
};

export default function SiteHeader({
  appLinks,
  showStudioCta = true,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [runtimeCopy, setRuntimeCopy] = useState<SiteCopySettings | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/site-copy/public", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { settings?: SiteCopySettings }
          | null;
        if (!response.ok || !payload?.settings) return;
        if (mounted) setRuntimeCopy(payload.settings);
      })
      .catch(() => {
        // ignore fetch failures and keep defaults
      });
    return () => {
      mounted = false;
    };
  }, []);

  const localizedRuntimeLinks = useMemo<Record<Locale, Array<{ href: string; label: string }>>>(
    () => ({
      ko: [
        { href: "/pricing", label: runtimeCopy?.header.ko.navPricing || "요금" },
        { href: "/examples", label: runtimeCopy?.header.ko.navExamples || "예시" },
        { href: "/templates", label: runtimeCopy?.header.ko.navTemplates || "템플릿" },
        { href: "/guide", label: runtimeCopy?.header.ko.navGuide || "가이드" },
        { href: "/faq", label: runtimeCopy?.header.ko.navFaq || "FAQ" },
      ],
      en: [
        { href: "/pricing", label: runtimeCopy?.header.en.navPricing || "Pricing" },
        { href: "/examples", label: runtimeCopy?.header.en.navExamples || "Examples" },
        { href: "/templates", label: runtimeCopy?.header.en.navTemplates || "Templates" },
        { href: "/guide", label: runtimeCopy?.header.en.navGuide || "Guide" },
        { href: "/faq", label: runtimeCopy?.header.en.navFaq || "FAQ" },
      ],
    }),
    [runtimeCopy],
  );

  const t = useLocaleText({
    ko: {
      brand: runtimeCopy?.header.ko.brand || "MakeDoc Studio",
      openStudio: runtimeCopy?.header.ko.openStudio || "스튜디오 열기",
    },
    en: {
      brand: runtimeCopy?.header.en.brand || "MakeDoc Studio",
      openStudio: runtimeCopy?.header.en.openStudio || "Open Studio",
    },
  });
  const localizedPublicLinks = useLocaleText(localizedRuntimeLinks);
  const links = appLinks ?? localizedPublicLinks;

  return (
    <header className="sticky top-5 z-50 mx-auto w-full max-w-7xl px-4">
      <div className="flex items-center justify-end gap-2 rounded-full border border-black/10 bg-[rgba(245,245,240,0.85)] px-4 py-3 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:justify-between md:px-6">
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

        <Link
          href="/"
          className="hidden rounded-full border border-black/10 bg-[#0B0B0C] px-5 py-2 text-sm font-semibold text-[#F5F5F0] md:inline-flex"
        >
          {t.brand}
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageToggle />
          {showStudioCta ? (
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-[#D6FF4F] px-4 py-2 text-sm font-semibold text-[#0B0B0C]"
              >
                {t.openStudio}
                <motion.span whileHover={{ rotate: 35 }}>↗</motion.span>
              </Link>
            </motion.div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
