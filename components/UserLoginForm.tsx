"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import MkdocLogo from "@/components/MkdocLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type AppMode = "creative" | "diagnosis";

const MODE_LABEL: Record<AppMode, { title: string; desc: string }> = {
  creative: {
    title: "광고소재 스튜디오",
    desc: "레퍼런스 분석 → 프롬프트 편집 → 이미지 생성",
  },
  diagnosis: {
    title: "요식업 진단 & 처방전",
    desc: "3분 설문 → 점수/타입 → 처방전 → 결제/온보딩",
  },
};

function IconSpark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
      <path d="M4 20l1-3" />
      <path d="M20 20l-1-3" />
    </svg>
  );
}

function IconStethoscope({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 3v6a6 6 0 0 0 12 0V3" />
      <path d="M8 3v6" />
      <path d="M16 3v6" />
      <path d="M12 15v4a3 3 0 0 0 6 0v-1" />
      <path d="M18 18a2 2 0 1 0 0 4" />
    </svg>
  );
}

function ModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: AppMode;
  selected: boolean;
  onSelect: () => void;
}) {
  const icon =
    mode === "creative" ? <IconSpark /> : <IconStethoscope className="h-5 w-5" />;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group w-full rounded-3xl border p-4 text-left transition",
        selected
          ? "border-emerald-400 bg-emerald-50/70 shadow-[0_20px_60px_-40px_rgba(16,185,129,0.45)]"
          : "border-white/30 bg-white/10 hover:bg-white/15",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-2xl border",
            selected
              ? "border-emerald-200 bg-white text-emerald-700"
              : "border-white/25 bg-white/10 text-white",
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={selected ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white"}>
            {MODE_LABEL[mode].title}
          </p>
          <p className={selected ? "mt-1 text-xs text-slate-600" : "mt-1 text-xs text-cyan-100/90"}>
            {MODE_LABEL[mode].desc}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function UserLoginForm({
  initialMode,
  nextOverride,
}: {
  initialMode: AppMode;
  nextOverride?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    if (nextOverride && nextOverride.startsWith("/")) {
      return nextOverride;
    }
    return mode === "creative" ? "/creative" : "/diagnosis";
  }, [mode, nextOverride]);

  useEffect(() => {
    try {
      window.localStorage.setItem("mkdoc:last_mode", mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    let isActive = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) return;
        setSessionEmail(data.session?.user?.email ?? null);
      })
      .catch(() => {
        if (!isActive) return;
        setSessionEmail(null);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail.includes("@")) {
      setError("이메일을 확인해 주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      if (intent === "signup") {
        // Supabase project settings may require email confirmation. In local dev, we
        // bypass that friction using a server-side admin createUser (email_confirm).
        // In production builds, it falls back to standard Supabase signUp.
        if (process.env.NODE_ENV !== "production") {
          const response = await fetch("/api/auth/dev-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, password }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error || "회원가입 실패");
          }

          // Immediately sign in after dev-signup
          const { error: signInAfterError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (signInAfterError) {
            // occasional eventual consistency: retry once
            await new Promise((r) => setTimeout(r, 500));
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });
            if (retryError) throw retryError;
          }

          router.push(nextPath);
          router.refresh();
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage(
          "회원가입 요청 완료. 현재 프로젝트 설정상 이메일 인증이 필요할 수 있습니다. 메일함(스팸 포함)을 확인해 주세요.",
        );
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        throw signInError;
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인 실패";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setError(
          "로그인 정보가 올바르지 않거나, 회원가입 후 이메일 인증이 아직 완료되지 않았을 수 있습니다. 메일함(스팸 포함)에서 인증 링크를 확인하거나, 로컬(dev)에서는 회원가입을 다시 시도해 주세요.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    setError(null);
    setMessage(null);
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) {
        throw logoutError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그아웃 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl py-6">
      <div className="grid gap-5 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_30px_110px_-55px_rgba(2,6,23,0.85)] backdrop-blur-xl lg:grid-cols-[1.02fr,1fr]">
        <aside className="space-y-6 bg-[linear-gradient(165deg,#0f172a_0%,#164e63_100%)] p-6 text-white sm:p-8">
          <MkdocLogo tone="light" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
              Choose App
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              마케닥
              <br />
              로그인
            </h1>
            <p className="mt-3 text-sm text-cyan-50/90">
              로그인 전, 어떤 서비스를 사용할지 선택하세요.
            </p>
          </div>

          <div className="grid gap-3">
            <ModeCard
              mode="creative"
              selected={mode === "creative"}
              onSelect={() => setMode("creative")}
            />
            <ModeCard
              mode="diagnosis"
              selected={mode === "diagnosis"}
              onSelect={() => setMode("diagnosis")}
            />
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-xs text-cyan-100">
            <p className="font-semibold text-white">안내</p>
            <p className="mt-1">
              선택한 앱은 로그인 후 자동으로 이동합니다. 나중에 로그인 화면에서 언제든 변경할 수 있습니다.
            </p>
          </div>
        </aside>

        <section className="bg-white/95 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Account
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {intent === "signup" ? "회원가입" : "로그인"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "creative"
              ? "광고소재 스튜디오로 이동합니다."
              : "요식업 진단 & 처방전으로 이동합니다."}
          </p>

          {sessionEmail && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">현재 로그인됨</p>
              <p className="mt-1 text-xs">{sessionEmail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(nextPath)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  선택한 서비스로 이동
                </button>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  disabled={loading}
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="비밀번호 (6자 이상)"
                autoComplete={intent === "signup" ? "new-password" : "current-password"}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-3 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "처리 중..." : intent === "signup" ? "회원가입" : "로그인"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setIntent((prev) => (prev === "signin" ? "signup" : "signin"));
                setMessage(null);
                setError(null);
              }}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              {intent === "signin"
                ? "처음이신가요? 회원가입"
                : "이미 계정이 있나요? 로그인"}
            </button>
            <a
              href="/admin/login"
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
            >
              관리자 로그인
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
