"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const PUBLIC_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/examples", label: "Examples" },
  { href: "/templates", label: "Templates" },
  { href: "/guide", label: "Guide" },
  { href: "/faq", label: "FAQ" },
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
  const links = appLinks ?? PUBLIC_LINKS;

  return (
    <header className="sticky top-5 z-50 mx-auto w-full max-w-7xl px-4">
      <div className="flex items-center justify-between rounded-full border border-black/10 bg-[rgba(245,245,240,0.85)] px-4 py-3 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:px-6">
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

        <Link href="/" className="rounded-full border border-black/10 bg-[#0B0B0C] px-5 py-2 text-sm font-semibold text-[#F5F5F0]">
          MakeDoc Studio
        </Link>

        {showStudioCta ? (
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/studio-entry"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#D6FF4F] px-4 py-2 text-sm font-semibold text-[#0B0B0C]"
            >
              스튜디오 열기
              <motion.span whileHover={{ rotate: 35 }}>↗</motion.span>
            </Link>
          </motion.div>
        ) : (
          <div className="w-[112px]" />
        )}
      </div>
    </header>
  );
}
