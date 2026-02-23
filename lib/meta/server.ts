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
    error_data?: unknown;
    error_user_title?: string;
    error_user_msg?: string;
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
  const businessLoginConfigId = (process.env.META_BUSINESS_LOGIN_CONFIG_ID || "").trim();
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
    businessLoginConfigId,
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

  const type = payload?.error?.type ? ` type=${payload.error.type}` : "";
  const code =
    typeof payload?.error?.code === "number" ? ` code=${String(payload.error.code)}` : "";
  const subcode =
    typeof payload?.error?.error_subcode === "number"
      ? ` subcode=${String(payload.error.error_subcode)}`
      : "";
  const trace = payload?.error?.fbtrace_id ? ` trace=${payload.error.fbtrace_id}` : "";

  let userMessage = "";
  if (payload?.error?.error_user_title || payload?.error?.error_user_msg) {
    userMessage = ` user=${[payload.error.error_user_title, payload.error.error_user_msg]
      .filter(Boolean)
      .join(" - ")}`;
  }

  let blame = "";
  if (payload?.error?.error_data) {
    try {
      const data =
        typeof payload.error.error_data === "string"
          ? payload.error.error_data
          : JSON.stringify(payload.error.error_data);
      if (data) {
        blame = ` data=${data.slice(0, 260)}`;
      }
    } catch {
      // ignore parsing errors for additional error_data
    }
  }

  return `Meta API 오류: ${message}${type}${code}${subcode}${trace}${userMessage}${blame}`;
}

function normalizeSpecialAdCategories(categories?: string[]) {
  const normalized = Array.isArray(categories)
    ? categories
        .map((item) => String(item || "").trim().toUpperCase())
        .filter(Boolean)
    : [];

  const allowed = new Set([
    "NONE",
    "CREDIT",
    "EMPLOYMENT",
    "HOUSING",
    "ISSUES_ELECTIONS_POLITICS",
  ]);
  const filtered = normalized.filter((item) => allowed.has(item));

  if (filtered.length === 0) return ["NONE"];
  const unique = Array.from(new Set(filtered));

  // NONE cannot be combined with other special categories.
  if (unique.includes("NONE") && unique.length > 1) {
    return unique.filter((item) => item !== "NONE");
  }

  return unique;
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
    state,
  });

  if (config.businessLoginConfigId) {
    // Business Login for Facebook: permissions are managed in config_id settings.
    query.set("config_id", config.businessLoginConfigId);
  } else {
    // Classic Facebook Login: request scopes directly.
    query.set("scope", config.scope);
  }

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
  let payload = {} as T & MetaGraphError;
  if (raw) {
    try {
      payload = JSON.parse(raw) as T & MetaGraphError;
    } catch {
      payload = {
        error: {
          message: raw.slice(0, 400),
        },
      } as T & MetaGraphError;
    }
  }

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
  type CampaignObjective =
    | "OUTCOME_TRAFFIC"
    | "OUTCOME_LEADS"
    | "OUTCOME_SALES"
    | "LINK_CLICKS"
    | "TRAFFIC";
  const requestedObjective: CampaignObjective = input.objective || "OUTCOME_TRAFFIC";
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
  const specialAdCategories = normalizeSpecialAdCategories(input.specialAdCategories);

  let campaign: { id: string } | null = null;
  let resolvedObjective: CampaignObjective = requestedObjective;
  let resolvedBudgetSharingFlag: string | number | boolean = false;

  const objectiveCandidates = Array.from(
    new Set<CampaignObjective>([requestedObjective, "OUTCOME_TRAFFIC"]),
  );
  const budgetSharingCandidates: Array<string | number | boolean> = [false, 0, "false", "0", true, 1];
  const specialCategoryCandidates = Array.from(
    new Map(
      [specialAdCategories, specialAdCategories.length === 1 && specialAdCategories[0] === "NONE" ? [] : null]
        .filter((value): value is string[] => Array.isArray(value))
        .map((value) => [JSON.stringify(value), value]),
    ).values(),
  );

  const campaignErrors: string[] = [];
  let campaignCreated = false;

  for (const objectiveCandidate of objectiveCandidates) {
    for (const categoryCandidate of specialCategoryCandidates) {
      for (const sharingCandidate of budgetSharingCandidates) {
        try {
          campaign = await graphRequest<{ id: string }>({
            method: "POST",
            path: `/act_${normalizedAdAccountId}/campaigns`,
            accessToken: input.accessToken,
            params: {
              name: input.campaignName,
              objective: objectiveCandidate,
              status: "PAUSED",
              buying_type: "AUCTION",
              is_adset_budget_sharing_enabled: sharingCandidate,
              special_ad_categories: JSON.stringify(categoryCandidate),
            },
          });
          resolvedObjective = objectiveCandidate;
          resolvedBudgetSharingFlag = sharingCandidate;
          campaignCreated = true;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "알 수 없는 오류";
          campaignErrors.push(
            `objective=${objectiveCandidate}, special_ad_categories=${JSON.stringify(
              categoryCandidate,
            )}, is_adset_budget_sharing_enabled=${String(sharingCandidate)} => ${message}`,
          );
        }
      }
      if (campaignCreated) break;
    }
    if (campaignCreated) break;
  }

  if (!campaignCreated) {
    throw new Error(`캠페인 생성 실패: ${campaignErrors.join(" | ").slice(0, 1800)}`);
  }

  if (!campaign || !campaign.id) throw new Error("Meta 캠페인 생성에 실패했습니다.");

  let adset: { id: string };
  const optimizationGoalCandidates =
    resolvedObjective === "OUTCOME_TRAFFIC"
      ? ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH"]
      : ["REACH"];
  const adsetErrors: string[] = [];
  let adsetCreated = false;
  adset = { id: "" };
  const dailyBudget = Math.max(100, Math.floor(input.dailyBudget ?? config.defaultDailyBudget));
  const targeting = JSON.stringify({
    geo_locations: { countries: countryCodes.length > 0 ? countryCodes : ["KR"] },
    age_min: ageMin,
    age_max: ageMax,
  });
  const bidStrategyCandidates: Array<{
    bid_strategy?: string;
    bid_amount?: number;
  }> = [
    { bid_strategy: "LOWEST_COST_WITHOUT_CAP" },
    {},
    { bid_strategy: "LOWEST_COST_WITH_BID_CAP", bid_amount: 1000 },
    { bid_strategy: "COST_CAP", bid_amount: 1000 },
  ];
  const sharingFlagCandidates: Array<string | number | boolean | undefined> = [
    resolvedBudgetSharingFlag,
    undefined,
  ];

  for (const optimizationGoal of optimizationGoalCandidates) {
    const billingEventCandidates =
      optimizationGoal === "LINK_CLICKS"
        ? ["LINK_CLICKS", "IMPRESSIONS"]
        : optimizationGoal === "LANDING_PAGE_VIEWS"
          ? ["IMPRESSIONS", "LINK_CLICKS"]
          : ["IMPRESSIONS"];

    for (const billingEvent of billingEventCandidates) {
      for (const sharingFlag of sharingFlagCandidates) {
        for (const bidStrategy of bidStrategyCandidates) {
          try {
            const params: Record<string, string | number | boolean | undefined> = {
              name: input.adSetName,
              campaign_id: campaign.id,
              daily_budget: dailyBudget,
              billing_event: billingEvent,
              optimization_goal: optimizationGoal,
              destination_type: "WEBSITE",
              targeting,
              status: "PAUSED",
              bid_strategy: bidStrategy.bid_strategy,
              bid_amount: bidStrategy.bid_amount,
              is_adset_budget_sharing_enabled: sharingFlag,
            };

            adset = await graphRequest<{ id: string }>({
              method: "POST",
              path: `/act_${normalizedAdAccountId}/adsets`,
              accessToken: input.accessToken,
              params,
            });
            adsetCreated = true;
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : "알 수 없는 오류";
            adsetErrors.push(
              `optimization_goal=${optimizationGoal}, billing_event=${billingEvent}, bid_strategy=${bidStrategy.bid_strategy ?? "omit"}, bid_amount=${bidStrategy.bid_amount ?? "omit"}, is_adset_budget_sharing_enabled=${String(sharingFlag)} => ${message}`,
            );
          }
        }
        if (adsetCreated) break;
      }
      if (adsetCreated) break;
    }
    if (adsetCreated) break;
  }

  if (!adsetCreated) {
    throw new Error(`광고세트 생성 실패: ${adsetErrors.join(" | ").slice(0, 1800)}`);
  }

  if (!adset.id) throw new Error("Meta 광고세트 생성에 실패했습니다.");

  // Upload image to ad account and use returned image_hash for creative when possible.
  // Some app setups can create campaigns/adsets but are blocked on /adimages capability.
  // In that case, we fall back to direct `picture` URL on creative.
  let imageHash = "";
  let imageUploadError: string | null = null;
  try {
    const imageUpload = await graphRequest<{
      images?: Record<string, { hash?: string }>;
      hash?: string;
      image_hash?: string;
    }>({
      method: "POST",
      path: `/act_${normalizedAdAccountId}/adimages`,
      accessToken: input.accessToken,
      params: {
        url: input.imageUrl,
      },
    });

    imageHash = (imageUpload.image_hash || imageUpload.hash || "").trim();
    if (!imageHash && imageUpload.images && typeof imageUpload.images === "object") {
      for (const value of Object.values(imageUpload.images)) {
        const hash = (value?.hash || "").trim();
        if (hash) {
          imageHash = hash;
          break;
        }
      }
    }
  } catch (error) {
    imageUploadError = error instanceof Error ? error.message : "알 수 없는 오류";
  }

  const baseObjectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
  };
  const instagramActorId = (input.instagramActorId || "").trim();
  if (instagramActorId && /^\d{5,}$/.test(instagramActorId)) {
    baseObjectStorySpec.instagram_actor_id = instagramActorId;
  }

  const creativeSpecCandidates: Array<Record<string, unknown>> = [];
  if (imageHash) {
    creativeSpecCandidates.push(
      {
        ...baseObjectStorySpec,
        link_data: {
          link: input.linkUrl,
          message: input.primaryText,
          name: input.headline,
          image_hash: imageHash,
          call_to_action: {
            type: "LEARN_MORE",
            value: { link: input.linkUrl },
          },
        },
      },
      {
        ...baseObjectStorySpec,
        link_data: {
          link: input.linkUrl,
          message: input.primaryText,
          name: input.headline,
          image_hash: imageHash,
        },
      },
    );
  }
  creativeSpecCandidates.push(
    {
      ...baseObjectStorySpec,
      link_data: {
        link: input.linkUrl,
        message: input.primaryText,
        name: input.headline,
        picture: input.imageUrl,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: input.linkUrl },
        },
      },
    },
    {
      ...baseObjectStorySpec,
      link_data: {
        link: input.linkUrl,
        message: input.primaryText,
        name: input.headline,
        picture: input.imageUrl,
      },
    },
  );

  let creative: { id: string };
  const creativeErrors: string[] = [];
  let creativeCreated = false;
  creative = { id: "" };
  for (const [index, creativeSpec] of creativeSpecCandidates.entries()) {
    try {
      creative = await graphRequest<{ id: string }>({
        method: "POST",
        path: `/act_${normalizedAdAccountId}/adcreatives`,
        accessToken: input.accessToken,
        params: {
          name: `${input.adName} Creative`,
          object_story_spec: JSON.stringify(creativeSpec),
        },
      });
      creativeCreated = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      creativeErrors.push(`candidate=${index + 1} => ${message}`);
    }
  }

  if (!creativeCreated) {
    const uploadHint = imageUploadError
      ? ` | adimages_upload=${imageUploadError}`
      : "";
    throw new Error(
      `크리에이티브 생성 실패: ${creativeErrors.join(" | ").slice(0, 1800)}${uploadHint}`.slice(0, 2000),
    );
  }

  if (!creative.id) throw new Error("Meta 크리에이티브 생성에 실패했습니다.");

  let ad: { id: string };
  try {
    ad = await graphRequest<{ id: string }>({
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`광고 생성 실패: ${message}`);
  }

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
