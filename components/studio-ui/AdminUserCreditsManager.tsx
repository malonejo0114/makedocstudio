"use client";

import { useMemo, useState } from "react";

type AdminUserItem = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  balance: number;
};

type UsersResponse = {
  users: AdminUserItem[];
};

type CreditAdjustResponse = {
  ok: boolean;
  userId: string;
  delta: number;
  balance: number;
  ledgerId: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function AdminUserCreditsManager() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [customDelta, setCustomDelta] = useState("10");

  const parsedCustomDelta = useMemo(() => {
    const parsed = Number.parseInt(customDelta.trim(), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [customDelta]);

  async function searchUsers() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const url = new URL("/api/admin/users", window.location.origin);
      if (query.trim()) {
        url.searchParams.set("query", query.trim());
      }
      url.searchParams.set("limit", "30");
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | UsersResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "유저 조회 실패");
      }
      setUsers((payload as UsersResponse).users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "유저 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  async function adjustCredits(userId: string, delta: number) {
    if (!delta) {
      setError("증감 크레딧은 0이 될 수 없습니다.");
      return;
    }
    setAdjustingUserId(userId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          delta,
          note: note.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | CreditAdjustResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "크레딧 조정 실패");
      }

      const result = payload as CreditAdjustResponse;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                balance: result.balance,
              }
            : item,
        ),
      );
      setMessage(
        `크레딧 조정 완료: ${delta > 0 ? `+${delta}` : delta} / 현재 잔액 ${result.balance}cr`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "크레딧 조정 실패");
    } finally {
      setAdjustingUserId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-[28px] border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Admin Credits</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">가입 유저 검색 / 크레딧 증감</h2>
        <p className="mt-1 text-sm text-black/60">
          이메일/전화/UUID로 유저를 검색하고 통합 크레딧(KRW_100_CREDIT)을 운영자가 직접 조정합니다.
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr,auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchUsers();
            }
          }}
          placeholder="이메일 / 전화 / user_id 검색"
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void searchUsers()}
          disabled={loading}
          className="rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
        >
          {loading ? "검색 중..." : "유저 검색"}
        </button>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr,160px]">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="운영 메모(선택) - 예: CS 보상"
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
        <input
          value={customDelta}
          onChange={(event) => setCustomDelta(event.target.value)}
          placeholder="커스텀 증감"
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-3 py-3 text-sm text-black/55">
            검색 결과가 없습니다.
          </div>
        ) : (
          users.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-sm"
            >
              <p className="font-semibold text-[#0B0B0C]">{user.email || "(이메일 없음)"}</p>
              <p className="mt-1 text-xs text-black/60">user_id: {user.id}</p>
              <p className="mt-1 text-xs text-black/60">
                최근 로그인: {formatDateTime(user.lastSignInAt)} / 가입: {formatDateTime(user.createdAt)}
              </p>
              <p className="mt-1 text-sm font-semibold text-black/75">현재 잔액: {user.balance}cr</p>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void adjustCredits(user.id, 10)}
                  disabled={adjustingUserId === user.id}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => void adjustCredits(user.id, 50)}
                  disabled={adjustingUserId === user.id}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => void adjustCredits(user.id, -10)}
                  disabled={adjustingUserId === user.id}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => void adjustCredits(user.id, -50)}
                  disabled={adjustingUserId === user.id}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  -50
                </button>
                <button
                  type="button"
                  onClick={() => void adjustCredits(user.id, parsedCustomDelta)}
                  disabled={adjustingUserId === user.id || parsedCustomDelta === 0}
                  className="rounded-full border border-black/10 bg-[#D6FF4F] px-3 py-1.5 text-xs font-semibold text-[#0B0B0C]"
                >
                  커스텀 적용
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

