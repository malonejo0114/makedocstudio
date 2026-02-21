"use client";

import { useEffect, useMemo, useState } from "react";

type RuntimeModel = {
  id: string;
  provider: string;
  name: string;
  textSuccess: string;
  speed: string;
};

type TierRow = {
  tierId: "basic" | "advanced";
  displayName: string;
  imageModelId: string;
  model?: RuntimeModel | null;
  price?: {
    costKrw: number | null;
    sellKrw: number | null;
    creditsRequired: number;
  } | null;
};

type ModelTierPayload = {
  tiers: TierRow[];
  availableModels: RuntimeModel[];
  error?: string;
};

const TIER_LABEL: Record<TierRow["tierId"], string> = {
  basic: "기본",
  advanced: "상위버전",
};

export default function AdminModelTierManager() {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [availableModels, setAvailableModels] = useState<RuntimeModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const orderedTiers = useMemo(() => {
    const order: Array<TierRow["tierId"]> = ["basic", "advanced"];
    return [...tiers].sort((a, b) => order.indexOf(a.tierId) - order.indexOf(b.tierId));
  }, [tiers]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/model-tiers", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ModelTierPayload | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "모델 티어 설정을 불러오지 못했습니다.");
      }
      setTiers(payload.tiers ?? []);
      setAvailableModels(payload.availableModels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "모델 티어 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateTier<K extends keyof TierRow>(tierId: TierRow["tierId"], key: K, value: TierRow[K]) {
    setTiers((prev) =>
      prev.map((item) => (item.tierId === tierId ? { ...item, [key]: value } : item)),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/model-tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: orderedTiers.map((tier) => ({
            tierId: tier.tierId,
            displayName: tier.displayName,
            imageModelId: tier.imageModelId,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ModelTierPayload | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "모델 티어 설정 저장에 실패했습니다.");
      }
      setTiers(payload.tiers ?? []);
      setAvailableModels(payload.availableModels ?? []);
      setMessage("모델 티어 설정이 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "모델 티어 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[28px] border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Model Tiers</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">유저 노출 모델 2단계 매핑</h2>
        <p className="mt-1 text-sm text-black/60">
          유저 화면에는 기본/상위버전만 보이고, 실제 생성 AI는 여기서 매핑합니다.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/60">
          불러오는 중...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          {orderedTiers.map((tier) => (
            <article key={tier.tierId} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-black/45">{TIER_LABEL[tier.tierId]}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-black/55">
                  유저 표시명
                  <input
                    value={tier.displayName}
                    onChange={(event) => updateTier(tier.tierId, "displayName", event.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black"
                    placeholder={TIER_LABEL[tier.tierId]}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-black/55">
                  실제 생성 모델
                  <select
                    value={tier.imageModelId}
                    onChange={(event) => updateTier(tier.tierId, "imageModelId", event.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black"
                  >
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {tier.model ? (
                <p className="mt-2 text-xs text-black/60">
                  현재 매핑: {tier.model.name} / 한글 {tier.model.textSuccess} / 속도 {tier.model.speed}
                </p>
              ) : null}
            </article>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
            >
              {saving ? "저장 중..." : "모델 티어 저장"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
