"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useLocaleText } from "@/components/studio-ui/LanguageProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type AuthGateProps = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const t = useLocaleText({
    ko: {
      checking: "계정 세션을 확인하는 중입니다...",
      loginRequired: "로그인 필요",
      title: "스튜디오 이용을 위해 로그인해 주세요.",
      desc: "로그인 후 통합 크레딧 차감과 프로젝트 저장이 활성화됩니다.",
      goLogin: "로그인으로 이동",
    },
    en: {
      checking: "Checking your session...",
      loginRequired: "Sign in required",
      title: "Please sign in to use the Studio.",
      desc: "Unified credit deduction and project history are enabled after sign in.",
      goLogin: "Go to sign in",
    },
  });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setEmail(data.session?.user?.email ?? null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="rounded-[28px] border border-black/10 bg-white p-10 text-center text-sm text-black/60">
          {t.checking}
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="rounded-[28px] border border-black/10 bg-white p-10 text-center shadow-[0_30px_55px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">{t.loginRequired}</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0B0B0C]">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-black/60">
            {t.desc}
          </p>
          <Link
            href="/login?next=/studio"
            className="mt-6 inline-flex rounded-full bg-[#0B0B0C] px-6 py-3 text-sm font-semibold text-[#D6FF4F]"
          >
            {t.goLogin}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
