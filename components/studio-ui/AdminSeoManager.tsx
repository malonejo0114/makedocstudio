"use client";

import { useEffect, useMemo, useState } from "react";

import type { SeoMetaTag, SeoSettings } from "@/lib/seo/settings";

type SeoSettingsPayload = {
  settings: SeoSettings;
  error?: string;
};

type TabKey = "basic" | "verification" | "meta" | "scripts";

const TABS: Array<{ id: TabKey; label: string }> = [
  { id: "basic", label: "기본 SEO" },
  { id: "verification", label: "서치콘솔 인증" },
  { id: "meta", label: "추가 메타태그" },
  { id: "scripts", label: "헤드/바디 코드" },
];

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(list: string[]): string {
  return list.join("\n");
}

export default function AdminSeoManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [settings, setSettings] = useState<SeoSettings | null>(null);

  const headScriptUrlsText = useMemo(
    () => joinLines(settings?.headScriptUrls ?? []),
    [settings?.headScriptUrls],
  );
  const bodyStartScriptUrlsText = useMemo(
    () => joinLines(settings?.bodyStartScriptUrls ?? []),
    [settings?.bodyStartScriptUrls],
  );
  const bodyEndScriptUrlsText = useMemo(
    () => joinLines(settings?.bodyEndScriptUrls ?? []),
    [settings?.bodyEndScriptUrls],
  );

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/seo-settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SeoSettingsPayload | null;
        if (!response.ok && payload?.error) {
          throw new Error(payload.error);
        }
        if (!mounted) return;
        if (!payload?.settings) {
          throw new Error("SEO 설정을 불러오지 못했습니다.");
        }
        setSettings(payload.settings);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "SEO 설정 조회 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function patchSettings(next: Partial<SeoSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchMetaTag(index: number, next: Partial<SeoMetaTag>) {
    setSettings((prev) => {
      if (!prev) return prev;
      const copied = [...prev.additionalMetaTags];
      copied[index] = {
        ...copied[index],
        ...next,
      };
      return {
        ...prev,
        additionalMetaTags: copied,
      };
    });
  }

  function addMetaTag() {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        additionalMetaTags: [
          ...prev.additionalMetaTags,
          {
            type: "name",
            key: "",
            content: "",
          },
        ],
      };
    });
  }

  function removeMetaTag(index: number) {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        additionalMetaTags: prev.additionalMetaTags.filter((_, i) => i !== index),
      };
    });
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/seo-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json().catch(() => null)) as SeoSettingsPayload | { error?: string } | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "저장 실패");
      }
      setMessage("SEO 설정이 저장되었습니다. 운영/스테이징 반영까지 최대 30초 정도 걸릴 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SEO 설정 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border border-black/10 bg-white p-4 text-sm text-black/60">
        SEO 설정을 불러오는 중...
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        SEO 설정을 불러오지 못했습니다.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-[28px] border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Admin SEO</p>
        <h2 className="mt-1 text-xl font-semibold text-[#0B0B0C]">SEO 설정 탭</h2>
        <p className="mt-1 text-sm text-black/60">
          기본 메타/서치콘솔 인증/추가 메타태그/헤드·바디 스크립트를 운영자가 한 화면에서 관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              activeTab === tab.id
                ? "border-black bg-[#0B0B0C] text-[#D6FF4F]"
                : "border-black/10 bg-white text-black/70",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "basic" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">Site Name</span>
            <input
              value={settings.siteName}
              onChange={(event) => patchSettings({ siteName: event.target.value })}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">Default Title</span>
            <input
              value={settings.defaultTitle}
              onChange={(event) => patchSettings({ defaultTitle: event.target.value })}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">Description</span>
            <textarea
              value={settings.description}
              onChange={(event) => patchSettings({ description: event.target.value })}
              rows={2}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">Robots</span>
            <input
              value={settings.robots}
              onChange={(event) => patchSettings({ robots: event.target.value })}
              placeholder="index,follow"
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Canonical Base URL
            </span>
            <input
              value={settings.canonicalBaseUrl}
              onChange={(event) => patchSettings({ canonicalBaseUrl: event.target.value })}
              placeholder="https://makedocstudio.com"
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">OG Image URL</span>
            <input
              value={settings.ogImageUrl}
              onChange={(event) => patchSettings({ ogImageUrl: event.target.value })}
              placeholder="https://.../og-image.png"
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
        </div>
      ) : null}

      {activeTab === "verification" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Google Site Verification
            </span>
            <input
              value={settings.googleSiteVerification}
              onChange={(event) => patchSettings({ googleSiteVerification: event.target.value })}
              placeholder="google-site-verification token"
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Naver Site Verification
            </span>
            <input
              value={settings.naverSiteVerification}
              onChange={(event) => patchSettings({ naverSiteVerification: event.target.value })}
              placeholder="naver-site-verification token"
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-xs text-black/65 md:col-span-2">
            서치콘솔 토큰은 값만 넣으면{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[11px]">
              {"<meta name=\"...-site-verification\" content=\"...\">"}
            </code>{" "}
            형태로 자동 반영됩니다.
          </div>
        </div>
      ) : null}

      {activeTab === "meta" ? (
        <div className="space-y-3">
          {settings.additionalMetaTags.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/55">
              추가 메타태그가 없습니다.
            </div>
          ) : null}
          {settings.additionalMetaTags.map((tag, index) => (
            <div key={`meta-tag-${index}`} className="grid gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 md:grid-cols-[110px,1fr,1fr,auto]">
              <select
                value={tag.type}
                onChange={(event) =>
                  patchMetaTag(index, { type: event.target.value === "property" ? "property" : "name" })
                }
                className="rounded-xl border border-black/10 bg-white px-2 py-2 text-sm"
              >
                <option value="name">name</option>
                <option value="property">property</option>
              </select>
              <input
                value={tag.key}
                onChange={(event) => patchMetaTag(index, { key: event.target.value })}
                placeholder="예: keywords / og:type"
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
              <input
                value={tag.content}
                onChange={(event) => patchMetaTag(index, { content: event.target.value })}
                placeholder="content"
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeMetaTag(index)}
                className="rounded-full border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMetaTag}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/75"
          >
            + 메타태그 추가
          </button>
        </div>
      ) : null}

      {activeTab === "scripts" ? (
        <div className="grid gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Head Script URLs (줄바꿈)
            </span>
            <textarea
              value={headScriptUrlsText}
              onChange={(event) => patchSettings({ headScriptUrls: splitLines(event.target.value) })}
              rows={3}
              placeholder={"https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">Head Inline Script</span>
            <textarea
              value={settings.headInlineScript}
              onChange={(event) => patchSettings({ headInlineScript: event.target.value })}
              rows={5}
              placeholder={"window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());"}
              className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Body Start Script URLs (줄바꿈)
            </span>
            <textarea
              value={bodyStartScriptUrlsText}
              onChange={(event) =>
                patchSettings({ bodyStartScriptUrls: splitLines(event.target.value) })
              }
              rows={3}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Body Start Inline Script
            </span>
            <textarea
              value={settings.bodyStartInlineScript}
              onChange={(event) => patchSettings({ bodyStartInlineScript: event.target.value })}
              rows={4}
              className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Body End Script URLs (줄바꿈)
            </span>
            <textarea
              value={bodyEndScriptUrlsText}
              onChange={(event) => patchSettings({ bodyEndScriptUrls: splitLines(event.target.value) })}
              rows={3}
              className="w-full rounded-xl border border-black/10 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45">
              Body End Inline Script
            </span>
            <textarea
              value={settings.bodyEndInlineScript}
              onChange={(event) => patchSettings({ bodyEndInlineScript: event.target.value })}
              rows={4}
              className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-xs"
            />
          </label>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            보안 주의: 입력한 스크립트는 사이트 전체에 실행됩니다. 신뢰 가능한 코드만 추가하세요.
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="rounded-full border border-black/10 bg-[#0B0B0C] px-4 py-2 text-sm font-semibold text-[#D6FF4F] disabled:opacity-60"
        >
          {saving ? "저장 중..." : "SEO 설정 저장"}
        </button>
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
    </section>
  );
}
