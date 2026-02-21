"use client";

import { useLanguage } from "@/components/studio-ui/LanguageProvider";

export default function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-black/10 bg-white p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLocale("ko")}
        className={[
          "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 transition",
          locale === "ko" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55 hover:bg-black/[0.05]",
        ].join(" ")}
      >
        한국어
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={[
          "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 transition",
          locale === "en" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55 hover:bg-black/[0.05]",
        ].join(" ")}
      >
        EN
      </button>
    </div>
  );
}
