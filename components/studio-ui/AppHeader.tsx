"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import LanguageToggle from "@/components/studio-ui/LanguageToggle";
import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const t = useLocaleText({
    ko: {
      brand: "MakeDoc Studio",
      links: [
        { href: "/studio", label: "스튜디오" },
        { href: "/projects", label: "프로젝트" },
        { href: "/account", label: "계정" },
        { href: "/guide", label: "가이드" },
      ],
      needLogin: "로그인 필요",
      logout: "로그아웃",
    },
    en: {
      brand: "MakeDoc Studio",
      links: [
        { href: "/studio", label: "Studio" },
        { href: "/projects", label: "Projects" },
        { href: "/account", label: "Account" },
        { href: "/guide", label: "Guide" },
      ],
      needLogin: "Sign in required",
      logout: "Sign out",
    },
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function onSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 mx-auto w-full max-w-7xl px-4 pb-3 pt-4 [background:linear-gradient(to_bottom,rgba(245,245,240,0.98),rgba(245,245,240,0.94)_72%,rgba(245,245,240,0))]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-black/10 bg-[rgba(245,245,240,0.88)] px-4 py-3 shadow-[0_20px_45px_-35px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <Link href="/" className="rounded-full bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F]">
          {t.brand}
        </Link>

        <nav className="flex items-center gap-1">
          {t.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-full px-3 py-1.5 text-sm font-medium",
                pathname === item.href
                  ? "bg-[#0B0B0C] text-[#D6FF4F]"
                  : "text-[#0B0B0C] hover:bg-black/5",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <span className="hidden text-xs text-black/50 md:inline">{email || t.needLogin}</span>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/70 hover:bg-black/5"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
