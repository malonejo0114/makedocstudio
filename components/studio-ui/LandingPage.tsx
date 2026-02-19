"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useSiteLocale } from "@/lib/siteLocale";
import { getPricedModelCatalog } from "@/lib/studio/pricing";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type AuthMode = "signin" | "signup";

const PROCESS_STEPS = {
  ko: ["레퍼런스 분석", "3관점 프롬프트 편집", "원클릭 이미지 생성", "PNG 다운로드"],
  en: ["Reference analysis", "3-angle prompt editing", "One-click image generation", "PNG download"],
};

const CORE_FEATURES = {
  ko: [
    {
      title: "레퍼런스 분석",
      description: "레이아웃/후킹/타이포를 분해해 바로 쓰는 인사이트로 변환합니다.",
    },
    {
      title: "3관점 프롬프트",
      description: "기획자/마케터/디자이너 프롬프트를 한 화면에서 동시에 다룹니다.",
    },
    {
      title: "통합 크레딧",
      description: "1크레딧=100원 정책으로 모델 가격과 차감량을 직관적으로 확인합니다.",
    },
  ],
  en: [
    {
      title: "Reference analysis",
      description: "Break down layout, hook, and typography into immediately usable insights.",
    },
    {
      title: "3-angle prompts",
      description: "Edit planner, marketer, and designer prompts together in one workspace.",
    },
    {
      title: "Unified credits",
      description: "With 1 credit = ₩100, you can instantly see model price and deduction amounts.",
    },
  ],
};

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { locale } = useSiteLocale();
  const pricedModels = getPricedModelCatalog();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lowestSellKrw = useMemo(() => {
    const values = pricedModels.map((model) => model.price.sellKrw);
    return Math.min(...values);
  }, [pricedModels]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.includes("@")) {
      setError(locale === "ko" ? "이메일 형식을 확인해 주세요." : "Please check your email format.");
      return;
    }
    if (password.length < 6) {
      setError(locale === "ko" ? "비밀번호는 6자 이상이어야 합니다." : "Password must be at least 6 characters.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setLoading(true);

    try {
      if (authMode === "signup") {
        if (process.env.NODE_ENV !== "production") {
          const devRes = await fetch("/api/auth/dev-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const devPayload = await devRes.json().catch(() => null);
          if (!devRes.ok) {
            throw new Error(devPayload?.error || (locale === "ko" ? "회원가입 실패" : "Sign-up failed"));
          }
        } else {
          const signUp = await supabase.auth.signUp({ email, password });
          if (signUp.error) throw signUp.error;
          setMessage(
            locale === "ko"
              ? "회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요."
              : "Sign-up complete. Please verify your email, then sign in.",
          );
          return;
        }
      }

      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;
      router.push("/studio-entry");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "ko" ? "인증에 실패했습니다." : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMessage(locale === "ko" ? "로그아웃되었습니다." : "You have been signed out.");
    setError(null);
    router.refresh();
  }

  async function onGoogleSignIn() {
    setError(null);
    setMessage(null);
    setOauthLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window === "undefined" ? undefined : `${window.location.origin}/studio-entry`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "ko" ? "Google 로그인에 실패했습니다." : "Google sign-in failed.");
      setOauthLoading(false);
    }
  }

  return (
    <main className="relative isolate mx-auto w-full max-w-7xl space-y-16 overflow-hidden px-4 pb-24 pt-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -left-24 top-4 h-72 w-72 rounded-full bg-[#D6FF4F]/16 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -18, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-16 top-16 h-96 w-96 rounded-full bg-black/12 blur-3xl"
          animate={{ x: [0, -24, 0], y: [0, 18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.04fr,0.96fr]">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border border-black/10 bg-[#0B0B0C] p-8 text-[#F5F5F0] shadow-[0_35px_80px_-50px_rgba(0,0,0,0.8)] md:p-10">
            <motion.div
              className="absolute -right-12 -top-10 h-56 w-56 rounded-full bg-[#D6FF4F]/18 blur-3xl"
              animate={{ y: [0, 12, 0], x: [0, -12, 0] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="text-xs uppercase tracking-[0.24em] text-[#D6FF4F]">MakeDoc Studio</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
              {locale === "ko" ? "레퍼런스 한 장으로" : "From one reference"}
              <br />
              {locale === "ko" ? "팔리는 광고소재를." : "to conversion-ready creatives."}
            </h1>
            <p className="mt-4 text-base text-[#F5F5F0]/75 md:text-lg">
              {locale === "ko"
                ? "분석부터 생성, 다운로드까지 한 화면에서 빠르게 완성합니다."
                : "Go from analysis to generation and download in one fast workflow."}
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                href="/studio-entry"
                className="inline-flex items-center gap-2 rounded-full bg-[#D6FF4F] px-5 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:-translate-y-0.5"
              >
                {locale === "ko" ? "스튜디오 시작하기" : "Start Studio"}
                <span>↗</span>
              </Link>
              <Link
                href="/examples"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-[#F5F5F0] transition hover:bg-white/10"
              >
                {locale === "ko" ? "생성 예시 보기" : "View examples"}
              </Link>
            </div>
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70">
              {locale === "ko"
                ? `시작 단가 ₩${lowestSellKrw.toLocaleString()} / 이미지 1장당 크레딧 자동 차감`
                : `Starting at ₩${lowestSellKrw.toLocaleString()} / Auto credit deduction per image`}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative overflow-hidden rounded-[36px] border border-black/10 bg-white p-6 shadow-[0_30px_65px_-45px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute inset-x-6 top-6 h-24 rounded-3xl border border-black/10 bg-[linear-gradient(130deg,#3f3f42_0%,#909094_35%,#1f1f22_72%,#a5a5a8_100%)] opacity-95">
              <motion.div
                className="absolute inset-y-0 w-1/2 bg-[linear-gradient(95deg,transparent_0%,rgba(255,255,255,0.45)_55%,transparent_100%)]"
                animate={{ x: ["-35%", "130%"] }}
                transition={{ duration: 5.8, repeat: Infinity, ease: "linear" }}
              />
            </div>

            <div className="relative mt-32">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">{locale === "ko" ? "빠른 로그인" : "Quick Login"}</p>
                <div className="rounded-full border border-black/10 bg-black/[0.03] p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className={[
                      "rounded-full px-3 py-1",
                      authMode === "signin" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55",
                    ].join(" ")}
                  >
                    {locale === "ko" ? "로그인" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={[
                      "rounded-full px-3 py-1",
                      authMode === "signup" ? "bg-[#0B0B0C] text-[#D6FF4F]" : "text-black/55",
                    ].join(" ")}
                  >
                    {locale === "ko" ? "회원가입" : "Sign up"}
                  </button>
                </div>
              </div>

              {message && (
                <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {message}
                </div>
              )}
              {error && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {sessionEmail ? (
                <div className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <p className="text-sm font-semibold text-black/75">{sessionEmail}</p>
                  <p className="text-xs text-black/55">
                    {locale === "ko"
                      ? "이미 로그인되어 있습니다. 바로 스튜디오로 이동하세요."
                      : "You are already signed in. Go straight to the studio."}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href="/studio-entry"
                      className="inline-flex items-center gap-1 rounded-full bg-[#0B0B0C] px-3 py-1.5 text-xs font-semibold text-[#D6FF4F]"
                    >
                      {locale === "ko" ? "스튜디오 열기 ↗" : "Open Studio ↗"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onSignOut()}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/70"
                    >
                      {locale === "ko" ? "로그아웃" : "Sign out"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-2.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={locale === "ko" ? "이메일" : "Email"}
                    className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={locale === "ko" ? "비밀번호 (6자 이상)" : "Password (min 6 chars)"}
                    className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading || oauthLoading}
                    className="w-full rounded-full bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F] transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {loading
                      ? locale === "ko"
                        ? "처리 중..."
                        : "Processing..."
                      : authMode === "signin"
                        ? locale === "ko"
                          ? "로그인"
                          : "Sign in"
                        : locale === "ko"
                          ? "회원가입 후 시작"
                          : "Continue with sign up"}
                  </button>

                  <div className="flex items-center gap-2 text-[11px] text-black/35">
                    <span className="h-px flex-1 bg-black/10" />
                    {locale === "ko" ? "또는" : "or"}
                    <span className="h-px flex-1 bg-black/10" />
                  </div>

                  <button
                    type="button"
                    onClick={() => void onGoogleSignIn()}
                    disabled={loading || oauthLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/80 transition hover:bg-black/[0.03] disabled:opacity-60"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/15 text-xs">
                      G
                    </span>
                    {oauthLoading
                      ? locale === "ko"
                        ? "Google로 이동 중..."
                        : "Redirecting to Google..."
                      : locale === "ko"
                        ? "Google로 계속하기"
                        : "Continue with Google"}
                  </button>
                </form>
              )}

              <Link href="/guide" className="mt-3 inline-block text-xs font-semibold text-black/60 underline">
                {locale === "ko" ? "이용 튜토리얼 보기" : "View tutorial"}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal>
        <section className="rounded-[30px] border border-black/10 bg-white/80 p-4 backdrop-blur-sm md:p-5">
          <div className="flex flex-wrap gap-2">
            {PROCESS_STEPS[locale].map((step) => (
              <span
                key={step}
                className="rounded-full border border-black/10 bg-[#F5F5F0] px-4 py-2 text-sm font-medium text-[#0B0B0C]"
              >
                {step}
              </span>
            ))}
          </div>
        </section>
      </Reveal>

      <section className="grid gap-4 md:grid-cols-3">
        {CORE_FEATURES[locale].map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.06}>
            <motion.article
              whileHover={{ y: -4 }}
              className="rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.55)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">Feature</p>
              <h3 className="mt-3 text-2xl font-semibold text-[#0B0B0C]">{feature.title}</h3>
              <p className="mt-2 text-sm text-black/65">{feature.description}</p>
            </motion.article>
          </Reveal>
        ))}
      </section>

      <Reveal>
        <section className="rounded-[34px] border border-black/15 bg-[#0B0B0C] px-8 py-10 text-[#F5F5F0]">
          <p className="text-xs uppercase tracking-[0.24em] text-[#D6FF4F]">Ready</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            {locale === "ko" ? "지저분한 툴 체인 없이," : "Without a messy tool chain,"}
            <br />
            {locale === "ko" ? "한 번에 광고소재를 만드세요." : "create ad creatives in one go."}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/studio-entry"
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF4F] px-5 py-2.5 text-sm font-semibold text-[#0B0B0C]"
            >
              {locale === "ko" ? "스튜디오 열기 ↗" : "Open Studio ↗"}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[#F5F5F0]"
            >
              {locale === "ko" ? "가격 확인" : "See pricing"}
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
