import { getSupabaseServiceClient } from "@/lib/supabase";

export type SeoMetaTag = {
  type: "name" | "property";
  key: string;
  content: string;
};

export type SeoSettings = {
  siteName: string;
  defaultTitle: string;
  description: string;
  robots: string;
  canonicalBaseUrl: string;
  ogImageUrl: string;
  googleSiteVerification: string;
  naverSiteVerification: string;
  additionalMetaTags: SeoMetaTag[];
  headScriptUrls: string[];
  headInlineScript: string;
  bodyStartScriptUrls: string[];
  bodyStartInlineScript: string;
  bodyEndScriptUrls: string[];
  bodyEndInlineScript: string;
};

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  siteName: "MakeDoc Studio",
  defaultTitle: "MakeDoc Studio",
  description: "AI ad creative studio for reference analysis, prompt editing, and image generation.",
  robots: "index,follow",
  canonicalBaseUrl: "",
  ogImageUrl: "",
  googleSiteVerification: "",
  naverSiteVerification: "",
  additionalMetaTags: [],
  headScriptUrls: [],
  headInlineScript: "",
  bodyStartScriptUrls: [],
  bodyStartInlineScript: "",
  bodyEndScriptUrls: [],
  bodyEndInlineScript: "",
};

function asNonEmptyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeScriptUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const url = asNonEmptyString(item);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    result.push(url);
  }
  return Array.from(new Set(result)).slice(0, 50);
}

function normalizeMetaTags(value: unknown): SeoMetaTag[] {
  if (!Array.isArray(value)) return [];
  const normalized: SeoMetaTag[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const tag = item as Record<string, unknown>;
    const type = tag.type === "property" ? "property" : "name";
    const key = asNonEmptyString(tag.key).slice(0, 120);
    const content = asNonEmptyString(tag.content).slice(0, 400);
    if (!key || !content) continue;
    normalized.push({ type, key, content });
    if (normalized.length >= 50) break;
  }
  return normalized;
}

function normalizeSettings(raw: Record<string, unknown> | null | undefined): SeoSettings {
  if (!raw) return DEFAULT_SEO_SETTINGS;
  return {
    siteName: asNonEmptyString(raw.site_name || raw.siteName) || DEFAULT_SEO_SETTINGS.siteName,
    defaultTitle:
      asNonEmptyString(raw.default_title || raw.defaultTitle) || DEFAULT_SEO_SETTINGS.defaultTitle,
    description:
      asNonEmptyString(raw.description) || DEFAULT_SEO_SETTINGS.description,
    robots: asNonEmptyString(raw.robots) || DEFAULT_SEO_SETTINGS.robots,
    canonicalBaseUrl: asNonEmptyString(raw.canonical_base_url || raw.canonicalBaseUrl),
    ogImageUrl: asNonEmptyString(raw.og_image_url || raw.ogImageUrl),
    googleSiteVerification: asNonEmptyString(
      raw.google_site_verification || raw.googleSiteVerification,
    ),
    naverSiteVerification: asNonEmptyString(
      raw.naver_site_verification || raw.naverSiteVerification,
    ),
    additionalMetaTags: normalizeMetaTags(raw.additional_meta_tags || raw.additionalMetaTags),
    headScriptUrls: normalizeScriptUrlList(raw.head_script_urls || raw.headScriptUrls),
    headInlineScript: asNonEmptyString(raw.head_inline_script || raw.headInlineScript),
    bodyStartScriptUrls: normalizeScriptUrlList(
      raw.body_start_script_urls || raw.bodyStartScriptUrls,
    ),
    bodyStartInlineScript: asNonEmptyString(
      raw.body_start_inline_script || raw.bodyStartInlineScript,
    ),
    bodyEndScriptUrls: normalizeScriptUrlList(raw.body_end_script_urls || raw.bodyEndScriptUrls),
    bodyEndInlineScript: asNonEmptyString(raw.body_end_inline_script || raw.bodyEndInlineScript),
  };
}

export async function getRuntimeSeoSettings(): Promise<SeoSettings> {
  try {
    const supabase = getSupabaseServiceClient();
    const res = await supabase
      .from("seo_settings")
      .select(
        "id, site_name, default_title, description, robots, canonical_base_url, og_image_url, google_site_verification, naver_site_verification, additional_meta_tags, head_script_urls, head_inline_script, body_start_script_urls, body_start_inline_script, body_end_script_urls, body_end_inline_script",
      )
      .eq("id", "global")
      .maybeSingle();

    if (res.error || !res.data) {
      return DEFAULT_SEO_SETTINGS;
    }
    return normalizeSettings(res.data as Record<string, unknown>);
  } catch {
    return DEFAULT_SEO_SETTINGS;
  }
}

export function toSeoSettingsRow(settings: SeoSettings) {
  return {
    id: "global",
    site_name: settings.siteName,
    default_title: settings.defaultTitle,
    description: settings.description,
    robots: settings.robots,
    canonical_base_url: settings.canonicalBaseUrl || null,
    og_image_url: settings.ogImageUrl || null,
    google_site_verification: settings.googleSiteVerification || null,
    naver_site_verification: settings.naverSiteVerification || null,
    additional_meta_tags: settings.additionalMetaTags,
    head_script_urls: settings.headScriptUrls,
    head_inline_script: settings.headInlineScript || null,
    body_start_script_urls: settings.bodyStartScriptUrls,
    body_start_inline_script: settings.bodyStartInlineScript || null,
    body_end_script_urls: settings.bodyEndScriptUrls,
    body_end_inline_script: settings.bodyEndInlineScript || null,
  };
}

export function parseSeoSettingsInput(input: unknown): SeoSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  return normalizeSettings(raw);
}

