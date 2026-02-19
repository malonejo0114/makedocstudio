"use client";

import { useState } from "react";
import MkdocLogo from "@/components/MkdocLogo";

type AdminLoginFormProps = {
  next: string;
  configError: boolean;
};

export default function AdminLoginForm({ next, configError }: AdminLoginFormProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "로그인 실패");
      }

      window.location.href = next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 실패";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl items-center justify-center py-5">
      <div className="grid w-full overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_30px_100px_-40px_rgba(15,23,42,0.8)] backdrop-blur-xl lg:grid-cols-[1.02fr,1fr]">
        <aside className="bg-[linear-gradient(165deg,#0f172a_0%,#164e63_100%)] p-5 text-white sm:p-7">
          <MkdocLogo tone="light" compact />
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            마케팅 닥터
            <br />
            관리자 스튜디오
          </h1>
          <p className="mt-4 text-sm text-cyan-50/90">
            레퍼런스 스타일을 저장하고, 생성 품질을 관리하는 운영 전용 공간입니다.
          </p>
          <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 text-xs text-cyan-100">
            보안 안내: 관리자 인증 후에만 템플릿 업로드/수정 API 접근이 가능합니다.
          </div>
        </aside>

        <section className="bg-white/95 p-5 sm:p-7 md:p-8">
          <div className="mb-4 lg:hidden">
            <MkdocLogo compact />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Admin Access
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">관리자 로그인</h2>
          <p className="mt-1 text-sm text-slate-600">
            마케닥(MKDoc) 관리자 비밀번호를 입력해 주세요.
          </p>

          {configError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
              서버에 `ADMIN_PASSWORD`가 설정되지 않았습니다.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="관리자 비밀번호 입력"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-3 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "로그인 중..." : "관리자 로그인"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
