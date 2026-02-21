"use client";

import { useEffect, useMemo, useState } from "react";

import { useSearchParams } from "next/navigation";

import { authFetchJson, formatDateTime } from "@/lib/studio/client";

type CreditModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: string;
  speed: string;
  price: {
    creditsRequired: number;
  };
  balance: number;
};

type LedgerItem = {
  id: string;
  image_model_id: string;
  delta: number;
  reason: string;
  ref_id: string | null;
  created_at: string;
};

type CreditsPayload = {
  models: CreditModel[];
  globalBalance: number;
  ledger: LedgerItem[];
};

type MetaConnectionPayload = {
  connected: boolean;
  tokenValid?: boolean;
  remoteError?: string | null;
  graphVersion?: string;
  metaUserId?: string | null;
  adAccountId?: string | null;
  pageId?: string | null;
  instagramActorId?: string | null;
  defaultLinkUrl?: string | null;
  tokenExpiresAt?: string | null;
  accounts?: Array<{
    id: string;
    name: string;
    account_status?: number;
    currency?: string;
    timezone_name?: string;
  }>;
  pages?: Array<{
    id: string;
    name: string;
  }>;
};

export default function AccountPageClient() {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<CreditsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chargingAmount, setChargingAmount] = useState<number | null>(null);
  const [meta, setMeta] = useState<MetaConnectionPayload | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [metaSaving, setMetaSaving] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [instagramActorId, setInstagramActorId] = useState("");

  const isDevMode = process.env.NODE_ENV !== "production";

  async function load() {
    const result = await authFetchJson<CreditsPayload>("/api/studio/credits");
    setPayload(result);
  }

  async function loadMetaConnection() {
    const result = await authFetchJson<MetaConnectionPayload>("/api/meta/connection");
    setMeta(result);
    setSelectedAccountId(result.adAccountId || "");
    setSelectedPageId(result.pageId || "");
    setInstagramActorId(result.instagramActorId || "");
    setLinkUrlDraft(result.defaultLinkUrl || "");
  }

  useEffect(() => {
    let mounted = true;

    load()
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "계정 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    loadMetaConnection()
      .catch((err) => {
        if (!mounted) return;
        setMetaError(err instanceof Error ? err.message : "Meta 연결 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setMetaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const metaStatus = searchParams.get("meta");
    const message = searchParams.get("message");
    if (metaStatus === "connected") {
      setMetaMessage("Meta 계정 연동이 완료되었습니다.");
    } else if (metaStatus === "oauth_error") {
      setMetaError(message || "Meta 연동 중 오류가 발생했습니다.");
    }
  }, [searchParams]);

  const totalCredits = payload?.globalBalance ?? 0;
  const accountOptions = useMemo(() => meta?.accounts ?? [], [meta?.accounts]);
  const pageOptions = useMemo(() => meta?.pages ?? [], [meta?.pages]);

  async function topup(amount: number) {
    setChargingAmount(amount);
    setError(null);
    try {
      await authFetchJson("/api/studio/credits/dev-topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "충전에 실패했습니다.");
    } finally {
      setChargingAmount(null);
    }
  }

  async function startMetaOAuth() {
    setMetaError(null);
    setMetaMessage(null);
    setMetaSaving(true);
    try {
      const payload = await authFetchJson<{ authUrl: string }>("/api/meta/oauth/start");
      if (!payload.authUrl) throw new Error("Meta OAuth URL을 받지 못했습니다.");
      window.location.href = payload.authUrl;
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Meta 연동 시작 실패");
      setMetaSaving(false);
    }
  }

  async function saveMetaDefaults() {
    if (!selectedAccountId || !selectedPageId) {
      setMetaError("광고계정과 페이지를 선택해 주세요.");
      return;
    }

    setMetaError(null);
    setMetaMessage(null);
    setMetaSaving(true);
    try {
      await authFetchJson<{ ok: boolean }>("/api/meta/connection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: selectedAccountId,
          pageId: selectedPageId,
          instagramActorId: instagramActorId.trim() || undefined,
          defaultLinkUrl: linkUrlDraft.trim() || undefined,
        }),
      });
      await loadMetaConnection();
      setMetaMessage("Meta 기본 광고 설정을 저장했습니다.");
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Meta 설정 저장 실패");
    } finally {
      setMetaSaving(false);
    }
  }

  async function disconnectMeta() {
    setMetaError(null);
    setMetaMessage(null);
    setMetaSaving(true);
    try {
      await authFetchJson<{ ok: boolean }>("/api/meta/connection", {
        method: "DELETE",
      });
      setMeta({
        connected: false,
        accounts: [],
        pages: [],
      });
      setSelectedAccountId("");
      setSelectedPageId("");
      setInstagramActorId("");
      setLinkUrlDraft("");
      setMetaMessage("Meta 연결을 해제했습니다.");
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Meta 연결 해제 실패");
    } finally {
      setMetaSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <div className="rounded-[28px] border border-black/10 bg-white p-8 text-sm text-black/55">불러오는 중...</div>
      </main>
    );
  }

  if (error && !payload) {
    return (
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-8">
      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Account</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#0B0B0C]">크레딧 / 프로필</h1>
        <p className="mt-2 text-sm text-black/65">통합 크레딧 정책: 1크레딧 = 100원</p>
        <p className="mt-4 text-sm font-semibold text-black/80">총 보유 크레딧: {totalCredits} credits</p>
        {isDevMode && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void topup(10)}
              disabled={chargingAmount !== null}
              className="rounded-full border border-black/10 bg-black px-3 py-1.5 text-xs font-semibold text-[#D6FF4F]"
            >
              +10
            </button>
            <button
              type="button"
              onClick={() => void topup(50)}
              disabled={chargingAmount !== null}
              className="rounded-full border border-black/10 bg-black px-3 py-1.5 text-xs font-semibold text-[#D6FF4F]"
            >
              +50
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="rounded-[32px] border border-black/10 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Meta Ads</p>
        <h2 className="mt-2 text-3xl font-semibold text-[#0B0B0C]">자동 광고 업로드 연동</h2>
        <p className="mt-2 text-sm text-black/65">
          생성 결과를 Meta 광고 초안(PAUSED)으로 자동 업로드하려면 먼저 계정 연동이 필요합니다.
        </p>

        {metaMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {metaMessage}
          </div>
        )}
        {metaError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {metaError}
          </div>
        )}

        {metaLoading ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/55">
            Meta 연결 상태를 확인하는 중입니다...
          </div>
        ) : meta?.connected ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <div className="text-sm text-black/75">
              <p>연결 상태: {meta.tokenValid === false ? "연결됨(토큰 재연동 필요)" : "연결됨"}</p>
              <p className="mt-1">Graph 버전: {meta.graphVersion || "-"}</p>
              {meta.tokenExpiresAt && <p className="mt-1">토큰 만료 예정: {formatDateTime(meta.tokenExpiresAt)}</p>}
              {meta.remoteError && <p className="mt-1 text-rose-700">{meta.remoteError}</p>}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-black/65">
                광고계정
                <select
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {accountOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-black/65">
                페이지
                <select
                  value={selectedPageId}
                  onChange={(event) => setSelectedPageId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {pageOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-black/65">
                인스타그램 Actor ID (선택)
                <input
                  value={instagramActorId}
                  onChange={(event) => setInstagramActorId(event.target.value)}
                  placeholder="1784..."
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-black/65">
                기본 랜딩 URL
                <input
                  value={linkUrlDraft}
                  onChange={(event) => setLinkUrlDraft(event.target.value)}
                  placeholder="https://your-site.com"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveMetaDefaults()}
                disabled={metaSaving}
                className="rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
              >
                기본 설정 저장
              </button>
              <button
                type="button"
                onClick={() => void startMetaOAuth()}
                disabled={metaSaving}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 disabled:opacity-60"
              >
                재연동
              </button>
              <button
                type="button"
                onClick={() => void disconnectMeta()}
                disabled={metaSaving}
                className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                연결 해제
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <p className="text-sm text-black/70">
              아직 Meta 계정이 연결되지 않았습니다. 연동 후 프로젝트 상세에서 생성 이미지를 바로 광고 초안으로 업로드할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => void startMetaOAuth()}
              disabled={metaSaving}
              className="mt-3 rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
            >
              {metaSaving ? "연동 준비 중..." : "Meta 계정 연동 시작"}
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {payload?.models.map((model) => (
          <article
            key={model.id}
            className="rounded-3xl border border-black/10 bg-white p-4 shadow-[0_16px_35px_-30px_rgba(0,0,0,0.45)]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">{model.provider}</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0B0B0C]">{model.name}</h2>
            <p className="mt-2 text-sm text-black/70">현재 통합 잔액: {totalCredits} credits</p>
            <p className="mt-1 text-xs text-black/55">1장 생성 차감: {model.price.creditsRequired} credits</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-4">
        <h2 className="text-lg font-semibold text-[#0B0B0C]">크레딧 원장(최근 30건)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 text-black/50">
                <th className="px-2 py-2">시간</th>
                <th className="px-2 py-2">모델</th>
                <th className="px-2 py-2">증감</th>
                <th className="px-2 py-2">사유</th>
                <th className="px-2 py-2">참조</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.ledger ?? []).map((item) => (
                <tr key={item.id} className="border-b border-black/5 text-black/70">
                  <td className="px-2 py-2">{formatDateTime(item.created_at)}</td>
                  <td className="px-2 py-2">
                    {item.image_model_id === "KRW_100_CREDIT" ? "통합 크레딧" : item.image_model_id}
                  </td>
                  <td className="px-2 py-2">{item.delta > 0 ? `+${item.delta}` : item.delta}</td>
                  <td className="px-2 py-2">{item.reason}</td>
                  <td className="px-2 py-2">{item.ref_id || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
