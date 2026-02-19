"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPageClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitLabel = useMemo(() => {
    if (loading) return "처리 중...";
    return mode === "signup" ? "회원가입" : "로그인";
  }, [loading, mode]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.includes("@")) {
      setError("이메일 형식을 확인해 주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (process.env.NODE_ENV !== "production") {
          const devRes = await fetch("/api/auth/dev-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const devPayload = await devRes.json().catch(() => null);
          if (!devRes.ok) {
            throw new Error(devPayload?.error || "회원가입 실패");
          }

          const signInAfter = await supabase.auth.signInWithPassword({ email, password });
          if (signInAfter.error) throw signInAfter.error;

          router.push(nextPath);
          router.refresh();
          return;
        }

        const signUp = await supabase.auth.signUp({ email, password });
        if (signUp.error) throw signUp.error;
        setMessage("회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
        return;
      }

      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setError(null);
    setMessage(null);
    setOauthLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const safeNextPath = nextPath.startsWith("/") ? nextPath : "/studio";
      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}${safeNextPath}`;
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
      setError(err instanceof Error ? err.message : "Google 로그인에 실패했습니다.");
      setOauthLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-10">
      <section className="grid gap-0 overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_30px_55px_-40px_rgba(0,0,0,0.45)] md:grid-cols-[1fr,1.1fr]">
        <aside className="bg-[#0B0B0C] p-8 text-[#F5F5F0]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#D6FF4F]">MakeDoc Studio</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">로그인</h1>
          <p className="mt-3 text-sm text-white/70">
            스튜디오 작업, 통합 크레딧, 프로젝트 저장을 위해 계정 로그인이 필요합니다.
          </p>
        </aside>

        <div className="p-8">
          <h2 className="text-2xl font-semibold text-[#0B0B0C]">{mode === "signup" ? "회원가입" : "로그인"}</h2>
          <p className="mt-1 text-sm text-black/60">완료 후 자동으로 스튜디오로 이동합니다.</p>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="이메일"
              className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="비밀번호"
              className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full rounded-full bg-[#0B0B0C] px-4 py-2.5 text-sm font-semibold text-[#D6FF4F]"
            >
              {submitLabel}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-black/35">
            <span className="h-px flex-1 bg-black/10" />
            또는
            <span className="h-px flex-1 bg-black/10" />
          </div>

          <button
            type="button"
            onClick={() => void onGoogleSignIn()}
            disabled={loading || oauthLoading}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-black/80 transition hover:bg-black/[0.03] disabled:opacity-60"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/15 text-xs">
              G
            </span>
            {oauthLoading ? "Google로 이동 중..." : "Google로 계속하기"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === "signin" ? "signup" : "signin"));
              setMessage(null);
              setError(null);
            }}
            className="mt-3 text-xs font-semibold text-black/65 underline"
          >
            {mode === "signin" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
          </button>
        </div>
      </section>
    </main>
  );
}
