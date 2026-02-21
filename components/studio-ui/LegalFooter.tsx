"use client";

import Link from "next/link";

import { useLocaleText } from "@/components/studio-ui/LanguageProvider";

export default function LegalFooter({ compact = false }: { compact?: boolean }) {
  const t = useLocaleText({
    ko: {
      links: [
        { href: "/terms", label: "이용약관" },
        { href: "/privacy", label: "개인정보처리방침" },
        { href: "/data-deletion", label: "데이터 삭제 안내" },
      ],
      rights: "All rights reserved.",
      contact: "문의",
    },
    en: {
      links: [
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/data-deletion", label: "Data Deletion" },
      ],
      rights: "All rights reserved.",
      contact: "Contact",
    },
  });

  return (
    <footer
      className={[
        "mx-auto w-full max-w-7xl px-4 text-sm text-black/55",
        compact ? "pb-6 pt-2" : "pb-10 pt-6",
      ].join(" ")}
      >
      <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 backdrop-blur-sm md:flex md:items-center md:justify-between">
        <p className="text-xs text-black/45">© {new Date().getFullYear()} MakeDoc Studio. {t.rights}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 md:mt-0">
          {t.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-black/65 underline-offset-2 hover:text-black hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:support@makedoc.studio"
            className="text-xs font-medium text-black/65 underline-offset-2 hover:text-black hover:underline"
          >
            {t.contact} support@makedoc.studio
          </a>
        </div>
      </div>
    </footer>
  );
}
