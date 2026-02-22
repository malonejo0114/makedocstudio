"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  SiteCopySettings,
  SiteFeatureCopy,
  SiteHeaderCopy,
  SiteLandingCopy,
} from "@/lib/siteCopySettings";

type SiteCopyPayload = {
  settings?: SiteCopySettings;
  error?: string;
};

type LocaleKey = "ko" | "en";

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(list: string[]): string {
  return list.join("\n");
}

export default function AdminSiteCopyManager() {
  const [settings, setSettings] = useState<SiteCopySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<LocaleKey>("ko");

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/site-copy", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SiteCopyPayload | null;
        if (!response.ok) {
          throw new Error(payload?.error || "사이트 문구 설정을 불러오지 못했습니다.");
        }
        if (!mounted) return;
        if (!payload?.settings) {
          throw new Error("사이트 문구 설정이 비어 있습니다.");
        }
        setSettings(payload.settings);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "사이트 문구 설정 조회 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const localeLabel = locale === "ko" ? "한국어" : "영어";

  const activeHeader = useMemo<SiteHeaderCopy | null>(() => {
    if (!settings) return null;
    return settings.header[locale];
  }, [settings, locale]);

  const activeLanding = useMemo<SiteLandingCopy | null>(() => {
    if (!settings) return null;
    return settings.landing[locale];
  }, [settings, locale]);

  function patchHeader(next: Partial<SiteHeaderCopy>) {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        header: {
          ...prev.header,
          [locale]: {
            ...prev.header[locale],
            ...next,
          },
        },
      };
    });
  }

  function patchLanding(next: Partial<SiteLandingCopy>) {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        landing: {
          ...prev.landing,
          [locale]: {
            ...prev.landing[locale],
            ...next,
          },
        },
      };
    });
  }

  function patchFeature(index: number, next: Partial<SiteFeatureCopy>) {
    setSettings((prev) => {
      if (!prev) return prev;
      const copied = [...prev.landing[locale].coreFeatures];
      copied[index] = {
        ...copied[index],
        ...next,
      };
      return {
        ...prev,
        landing: {
          ...prev.landing,
          [locale]: {
            ...prev.landing[locale],
            coreFeatures: copied,
          },
        },
      };
    });
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/site-copy", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json().catch(() => null)) as SiteCopyPayload | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error || "사이트 문구 저장에 실패했습니다.");
      }
      setSettings(payload.settings);
      setMessage("사이트 문구가 저장되었습니다. 운영 반영까지 최대 30초 정도 걸릴 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "사이트 문구 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-black/10 bg-white p-4 text-sm text-black/60">
        사이트 문구 설정을 불러오는 중...
      </section>
    );
  }

  if (!activeHeader || !activeLanding) {
    return (
      <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        사이트 문구 설정을 불러오지 못했습니다.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-[28px] border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Admin Site Copy</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">랜딩/헤더 문구 편집</h2>
        <p className="mt-1 text-sm text-black/60">
          개행/버튼/섹션 텍스트를 운영자가 즉시 수정합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ko", "en"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              locale === item
                ? "border-black bg-[#0B0B0C] text-[#D6FF4F]"
                : "border-black/10 bg-white text-black/70",
            ].join(" ")}
          >
            {item === "ko" ? "한국어" : "English"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">{localeLabel} 헤더</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input
            value={activeHeader.brand}
            onChange={(event) => patchHeader({ brand: event.target.value })}
            placeholder="브랜드명"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.openStudio}
            onChange={(event) => patchHeader({ openStudio: event.target.value })}
            placeholder="스튜디오 버튼"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.navPricing}
            onChange={(event) => patchHeader({ navPricing: event.target.value })}
            placeholder="요금 메뉴"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.navExamples}
            onChange={(event) => patchHeader({ navExamples: event.target.value })}
            placeholder="예시 메뉴"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.navTemplates}
            onChange={(event) => patchHeader({ navTemplates: event.target.value })}
            placeholder="템플릿 메뉴"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.navGuide}
            onChange={(event) => patchHeader({ navGuide: event.target.value })}
            placeholder="가이드 메뉴"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeHeader.navFaq}
            onChange={(event) => patchHeader({ navFaq: event.target.value })}
            placeholder="FAQ 메뉴"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">{localeLabel} 랜딩</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <textarea
            value={activeLanding.heroTitle}
            onChange={(event) => patchLanding({ heroTitle: event.target.value })}
            rows={3}
            placeholder="히어로 제목 (개행 가능)"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={activeLanding.heroSub}
            onChange={(event) => patchLanding({ heroSub: event.target.value })}
            rows={2}
            placeholder="히어로 설명"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={activeLanding.startStudio}
            onChange={(event) => patchLanding({ startStudio: event.target.value })}
            placeholder="메인 CTA"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.seeExamples}
            onChange={(event) => patchLanding({ seeExamples: event.target.value })}
            placeholder="예시 CTA"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.openStudio}
            onChange={(event) => patchLanding({ openStudio: event.target.value })}
            placeholder="로그인 카드 스튜디오 버튼"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.signOut}
            onChange={(event) => patchLanding({ signOut: event.target.value })}
            placeholder="로그아웃"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.signin}
            onChange={(event) => patchLanding({ signin: event.target.value })}
            placeholder="로그인 텍스트"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.signup}
            onChange={(event) => patchLanding({ signup: event.target.value })}
            placeholder="회원가입 텍스트"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.signupAndStart}
            onChange={(event) => patchLanding({ signupAndStart: event.target.value })}
            placeholder="회원가입 버튼 텍스트"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={activeLanding.emailPlaceholder}
            onChange={(event) => patchLanding({ emailPlaceholder: event.target.value })}
            placeholder="이메일 placeholder"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.passwordPlaceholder}
            onChange={(event) => patchLanding({ passwordPlaceholder: event.target.value })}
            placeholder="비밀번호 placeholder"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.quickLogin}
            onChange={(event) => patchLanding({ quickLogin: event.target.value })}
            placeholder="Quick Login"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.tutorial}
            onChange={(event) => patchLanding({ tutorial: event.target.value })}
            placeholder="튜토리얼 링크"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.pricingHintPrefix}
            onChange={(event) => patchLanding({ pricingHintPrefix: event.target.value })}
            placeholder="가격 힌트 앞문구"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.pricingHintSuffix}
            onChange={(event) => patchLanding({ pricingHintSuffix: event.target.value })}
            placeholder="가격 힌트 뒷문구"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.ready}
            onChange={(event) => patchLanding({ ready: event.target.value })}
            placeholder="Ready 라벨"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={activeLanding.checkPricing}
            onChange={(event) => patchLanding({ checkPricing: event.target.value })}
            placeholder="하단 가격확인 버튼"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <textarea
            value={activeLanding.finalTitle}
            onChange={(event) => patchLanding({ finalTitle: event.target.value })}
            rows={3}
            placeholder="하단 큰 제목 (개행 가능)"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={joinLines(activeLanding.processSteps)}
            onChange={(event) => patchLanding({ processSteps: splitLines(event.target.value) })}
            rows={4}
            placeholder="프로세스 스텝 (한 줄에 하나씩)"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">{localeLabel} 기능 카드</p>
        {activeLanding.coreFeatures.map((feature, index) => (
          <div key={`${locale}-feature-${index}`} className="grid gap-2 md:grid-cols-[240px,1fr]">
            <input
              value={feature.title}
              onChange={(event) => patchFeature(index, { title: event.target.value })}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder={`기능 ${index + 1} 제목`}
            />
            <input
              value={feature.description}
              onChange={(event) => patchFeature(index, { description: event.target.value })}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              placeholder={`기능 ${index + 1} 설명`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving}
        className="rounded-full border border-black bg-[#0B0B0C] px-5 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
      >
        {saving ? "저장 중..." : "사이트 문구 저장"}
      </button>

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
    </section>
  );
}
