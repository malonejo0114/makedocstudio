import "server-only";

import crypto from "node:crypto";

type MetaOAuthStatePayload = {
  uid: string;
  ts: number;
  nonce: string;
};

type MetaGraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type MetaAdAccount = {
  id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
};

export type MetaPage = {
  id: string;
  name: string;
};

function getMetaConfig() {
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  const redirectUri = (process.env.META_REDIRECT_URI || "").trim();
  const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
  const stateSecret =
    process.env.META_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  const scope =
    process.env.META_OAUTH_SCOPE ||
    "ads_management,ads_read,business_management,pages_show_list,pages_read_engagement,instagram_basic";
  const defaultWebsiteUrl = process.env.META_DEFAULT_WEBSITE_URL || "https://example.com";
  const defaultDailyBudget = Number(process.env.META_DEFAULT_DAILY_BUDGET || "10000");

  if (!appId) throw new Error("META_APP_ID가 설정되지 않았습니다.");
  if (!appSecret) throw new Error("META_APP_SECRET이 설정되지 않았습니다.");
  if (!redirectUri) throw new Error("META_REDIRECT_URI가 설정되지 않았습니다.");
  if (!stateSecret) throw new Error("META_STATE_SECRET이 설정되지 않았습니다.");

  return {
    appId,
    appSecret,
    redirectUri,
    graphVersion,
    stateSecret,
    scope,
    defaultWebsiteUrl,
    defaultDailyBudget: Number.isFinite(defaultDailyBudget) ? Math.max(100, defaultDailyBudget) : 10000,
  };
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signStatePayload(payload: MetaOAuthStatePayload, stateSecret: string): string {
  const json = JSON.stringify(payload);
  const body = toBase64Url(json);
  const signature = crypto.createHmac("sha256", stateSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyStatePayload(rawState: string, stateSecret: string): MetaOAuthStatePayload {
  const [body, signature] = rawState.split(".");
  if (!body || !signature) {
    throw new Error("Meta OAuth state 형식이 올바르지 않습니다.");
  }

  const expected = crypto.createHmac("sha256", stateSecret).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("Meta OAuth state 검증에 실패했습니다.");
  }

  const parsed = JSON.parse(fromBase64Url(body)) as MetaOAuthStatePayload;
  if (!parsed?.uid || typeof parsed.uid !== "string") {
    throw new Error("Meta OAuth state 사용자 정보가 없습니다.");
  }
  if (!Number.isFinite(parsed.ts)) {
    throw new Error("Meta OAuth state 시간이 올바르지 않습니다.");
  }

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - parsed.ts > maxAgeMs) {
    throw new Error("Meta OAuth state 유효시간이 만료되었습니다.");
  }

  return parsed;
}

function getGraphBase(graphVersion: string) {
  return `https://graph.facebook.com/${graphVersion}`;
}

function buildGraphErrorMessage(payload: MetaGraphError | null, fallback: string) {
  const message = payload?.error?.message;
  if (!message) return fallback;
  return `Meta API 오류: ${message}`;
}

export function buildMetaOauthUrl(userId: string) {
  const config = getMetaConfig();
  const state = signStatePayload(
    {
      uid: userId,
      ts: Date.now(),
      nonce: crypto.randomBytes(12).toString("hex"),
    },
    config.stateSecret,
  );

  const query = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope,
    state,
  });

  return {
    url: `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${query.toString()}`,
    state,
  };
}

export function parseMetaOAuthState(state: string): MetaOAuthStatePayload {
  return verifyStatePayload(state, getMetaConfig().stateSecret);
}

async function graphRequest<T>(input: {
  method?: "GET" | "POST";
  path: string;
  accessToken?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
}): Promise<T> {
  const config = getMetaConfig();
  const method = input.method || "GET";
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  if (input.accessToken) {
    params.set("access_token", input.accessToken);
  }

  const base = `${getGraphBase(config.graphVersion)}${input.path}`;
  const response =
    method === "GET"
      ? await fetch(`${base}?${params.toString()}`)
      : await fetch(base, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

  const raw = await response.text();
  const payload = raw ? (JSON.parse(raw) as T & MetaGraphError) : ({} as T & MetaGraphError);

  if (!response.ok) {
    throw new Error(buildGraphErrorMessage(payload, `Meta API 요청 실패 (${response.status})`));
  }

  return payload as T;
}

export async function exchangeCodeForMetaAccessToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number | null;
}> {
  const config = getMetaConfig();

  const shortLived = await graphRequest<{
    access_token: string;
    token_type?: string;
    expires_in?: number;
  }>({
    path: "/oauth/access_token",
    params: {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
    },
  });

  if (!shortLived.access_token) {
    throw new Error("Meta 액세스 토큰 발급에 실패했습니다.");
  }

  try {
    const longLived = await graphRequest<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
    }>({
      path: "/oauth/access_token",
      params: {
        grant_type: "fb_exchange_token",
        client_id: config.appId,
        client_secret: config.appSecret,
        fb_exchange_token: shortLived.access_token,
      },
    });

    if (longLived.access_token) {
      return {
        accessToken: longLived.access_token,
        expiresIn: Number.isFinite(longLived.expires_in ?? NaN) ? Number(longLived.expires_in) : null,
      };
    }
  } catch {
    // Use short-lived token fallback.
  }

  return {
    accessToken: shortLived.access_token,
    expiresIn: Number.isFinite(shortLived.expires_in ?? NaN) ? Number(shortLived.expires_in) : null,
  };
}

export async function getMetaMe(accessToken: string): Promise<{ id: string; name?: string }> {
  const me = await graphRequest<{ id: string; name?: string }>({
    path: "/me",
    accessToken,
    params: {
      fields: "id,name",
    },
  });
  if (!me.id) throw new Error("Meta 사용자 정보 조회에 실패했습니다.");
  return me;
}

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const result = await graphRequest<{ data?: MetaAdAccount[] }>({
    path: "/me/adaccounts",
    accessToken,
    params: {
      fields: "id,name,account_status,currency,timezone_name",
      limit: 200,
    },
  });
  return Array.isArray(result.data) ? result.data : [];
}

export async function getMetaPages(accessToken: string): Promise<MetaPage[]> {
  const result = await graphRequest<{ data?: MetaPage[] }>({
    path: "/me/accounts",
    accessToken,
    params: {
      fields: "id,name",
      limit: 200,
    },
  });
  return Array.isArray(result.data) ? result.data : [];
}

function normalizeAdAccountId(adAccountId: string) {
  const trimmed = adAccountId.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed.slice(4) : trimmed;
}

export async function createMetaPausedDraft(input: {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  instagramActorId?: string | null;
  campaignName: string;
  adSetName: string;
  adName: string;
  linkUrl: string;
  imageUrl: string;
  primaryText: string;
  headline: string;
  objective?: "OUTCOME_TRAFFIC" | "OUTCOME_LEADS" | "OUTCOME_SALES";
  dailyBudget?: number;
  specialAdCategories?: string[];
  countryCodes?: string[];
  ageMin?: number;
  ageMax?: number;
}): Promise<{
  campaignId: string;
  adsetId: string;
  creativeId: string;
  adId: string;
}> {
  const config = getMetaConfig();
  const objective = input.objective || "OUTCOME_TRAFFIC";
  const normalizedAdAccountId = normalizeAdAccountId(input.adAccountId);
  if (!normalizedAdAccountId) throw new Error("Meta 광고계정 ID가 비어 있습니다.");
  const countryCodes =
    Array.isArray(input.countryCodes) && input.countryCodes.length > 0
      ? input.countryCodes
          .map((code) => String(code || "").trim().toUpperCase())
          .filter((code) => /^[A-Z]{2}$/.test(code))
      : ["KR"];
  const ageMin = Number.isFinite(input.ageMin ?? NaN)
    ? Math.max(13, Math.min(65, Math.floor(input.ageMin ?? 20)))
    : 20;
  const ageMaxCandidate = Number.isFinite(input.ageMax ?? NaN)
    ? Math.max(13, Math.min(65, Math.floor(input.ageMax ?? 55)))
    : 55;
  const ageMax = Math.max(ageMin, ageMaxCandidate);

  const campaign = await graphRequest<{ id: string }>({
    method: "POST",
    path: `/act_${normalizedAdAccountId}/campaigns`,
    accessToken: input.accessToken,
    params: {
      name: input.campaignName,
      objective,
      status: "PAUSED",
      special_ad_categories: JSON.stringify(input.specialAdCategories ?? []),
      // Required by recent Marketing API versions when campaign budget sharing is off.
      is_adset_budget_sharing_enabled: false,
    },
  });

  if (!campaign.id) throw new Error("Meta 캠페인 생성에 실패했습니다.");

  const adset = await graphRequest<{ id: string }>({
    method: "POST",
    path: `/act_${normalizedAdAccountId}/adsets`,
    accessToken: input.accessToken,
    params: {
      name: input.adSetName,
      campaign_id: campaign.id,
      daily_budget: Math.max(100, Math.floor(input.dailyBudget ?? config.defaultDailyBudget)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      destination_type: "WEBSITE",
      promoted_object: JSON.stringify({ page_id: input.pageId }),
      targeting: JSON.stringify({
        geo_locations: { countries: countryCodes.length > 0 ? countryCodes : ["KR"] },
        age_min: ageMin,
        age_max: ageMax,
      }),
      status: "PAUSED",
    },
  });

  if (!adset.id) throw new Error("Meta 광고세트 생성에 실패했습니다.");

  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      link: input.linkUrl,
      message: input.primaryText,
      name: input.headline,
      image_url: input.imageUrl,
      call_to_action: {
        type: "LEARN_MORE",
        value: { link: input.linkUrl },
      },
    },
  };

  if (input.instagramActorId) {
    objectStorySpec.instagram_actor_id = input.instagramActorId;
  }

  const creative = await graphRequest<{ id: string }>({
    method: "POST",
    path: `/act_${normalizedAdAccountId}/adcreatives`,
    accessToken: input.accessToken,
    params: {
      name: `${input.adName} Creative`,
      object_story_spec: JSON.stringify(objectStorySpec),
    },
  });

  if (!creative.id) throw new Error("Meta 크리에이티브 생성에 실패했습니다.");

  const ad = await graphRequest<{ id: string }>({
    method: "POST",
    path: `/act_${normalizedAdAccountId}/ads`,
    accessToken: input.accessToken,
    params: {
      name: input.adName,
      adset_id: adset.id,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: "PAUSED",
    },
  });

  if (!ad.id) throw new Error("Meta 광고 생성에 실패했습니다.");

  return {
    campaignId: campaign.id,
    adsetId: adset.id,
    creativeId: creative.id,
    adId: ad.id,
  };
}

export function getMetaDefaultWebsiteUrl() {
  return getMetaConfig().defaultWebsiteUrl;
}

export function getMetaGraphVersion() {
  return getMetaConfig().graphVersion;
}
