import { NextResponse } from "next/server";
import { z } from "zod";

import { createMetaPausedDraft, getMetaDefaultWebsiteUrl } from "@/lib/meta/server";
import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const MetaPublishSchema = z.object({
  generationId: z.string().min(1),
  campaignName: z.string().max(120).optional(),
  adSetName: z.string().max(120).optional(),
  adName: z.string().max(120).optional(),
  headline: z.string().max(120).optional(),
  primaryText: z.string().max(500).optional(),
  linkUrl: z.string().url().optional(),
  objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES"]).optional(),
  dailyBudget: z.number().int().min(100).max(1_000_000_000).optional(),
  specialAdCategories: z.array(z.string().min(1).max(40)).max(10).optional(),
  countryCodes: z
    .array(z.string().trim().regex(/^[A-Za-z]{2}$/))
    .max(20)
    .optional(),
  ageMin: z.number().int().min(13).max(65).optional(),
  ageMax: z.number().int().min(13).max(65).optional(),
}).superRefine((value, ctx) => {
  if (
    Number.isFinite(value.ageMin ?? NaN) &&
    Number.isFinite(value.ageMax ?? NaN) &&
    (value.ageMin ?? 0) > (value.ageMax ?? 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ageMin은 ageMax보다 클 수 없습니다.",
      path: ["ageMin"],
    });
  }
});

function stringifyUnknown(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export async function POST(request: Request) {
  let userId = "";
  let generationId = "";
  let projectId: string | null = null;
  let requestSnapshot: Record<string, unknown> = {};

  try {
    const user = await requireStudioUserFromAuthHeader(request);
    userId = user.id;

    const payload = await request.json().catch(() => null);
    const parsed = MetaPublishSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Meta 업로드 요청 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.objective && parsed.data.objective !== "OUTCOME_TRAFFIC") {
      return NextResponse.json(
        {
          error:
            "현재 자동 초안 생성은 트래픽 목표만 지원합니다. 리드/판매 목표는 픽셀/전환 이벤트 등 추가 설정 UI가 준비된 뒤 지원됩니다.",
        },
        { status: 400 },
      );
    }

    requestSnapshot = parsed.data;
    generationId = parsed.data.generationId;

    const supabase = getSupabaseServiceClient();
    const connectionRes = await supabase
      .from("user_meta_connections")
      .select(
        "access_token, ad_account_id, page_id, instagram_actor_id, default_link_url",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionRes.error || !connectionRes.data) {
      return NextResponse.json(
        { error: "Meta 계정이 연결되어 있지 않습니다. 계정 페이지에서 먼저 연동해 주세요." },
        { status: 400 },
      );
    }

    const connection = connectionRes.data;
    if (!connection.ad_account_id || !connection.page_id) {
      return NextResponse.json(
        {
          error:
            "Meta 광고계정/페이지 설정이 비어 있습니다. 계정 페이지에서 광고계정과 페이지를 선택해 주세요.",
        },
        { status: 400 },
      );
    }

    const generationRes = await supabase
      .from("studio_generations")
      .select("id, project_id, prompt_id, image_url, created_at")
      .eq("id", parsed.data.generationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (generationRes.error || !generationRes.data) {
      return NextResponse.json({ error: "업로드할 생성 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    const generation = generationRes.data;
    projectId = generation.project_id;

    const [promptRes, projectRes] = await Promise.all([
      supabase
        .from("studio_prompts")
        .select("id, title, copy_json")
        .eq("id", generation.prompt_id)
        .maybeSingle(),
      supabase
        .from("studio_projects")
        .select("id, title")
        .eq("id", generation.project_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const promptCopy = stringifyUnknown(promptRes.data?.copy_json);
    const promptTitle = safeText(promptRes.data?.title, "MakeDoc Creative");
    const projectTitle = safeText(projectRes.data?.title, "MakeDoc Studio Project");
    const dateLabel = new Date().toISOString().slice(0, 10);

    const headline =
      safeText(parsed.data.headline) ||
      safeText(promptCopy.headline) ||
      promptTitle.slice(0, 40) ||
      "신규 광고 소재";
    const primaryText =
      safeText(parsed.data.primaryText) ||
      [safeText(promptCopy.subhead), safeText(promptCopy.cta)].filter(Boolean).join(" · ") ||
      headline;
    const linkUrl = parsed.data.linkUrl || connection.default_link_url || getMetaDefaultWebsiteUrl();

    const campaignName =
      parsed.data.campaignName || `${projectTitle} Campaign ${dateLabel}`;
    const adSetName = parsed.data.adSetName || `${projectTitle} AdSet ${dateLabel}`;
    const adName = parsed.data.adName || `${promptTitle} Ad ${dateLabel}`;

    const publishResult = await createMetaPausedDraft({
      accessToken: connection.access_token,
      adAccountId: connection.ad_account_id,
      pageId: connection.page_id,
      instagramActorId: connection.instagram_actor_id,
      campaignName,
      adSetName,
      adName,
      linkUrl,
      imageUrl: generation.image_url,
      primaryText,
      headline,
      objective: parsed.data.objective,
      dailyBudget: parsed.data.dailyBudget,
      specialAdCategories: parsed.data.specialAdCategories ?? [],
      countryCodes: parsed.data.countryCodes,
      ageMin: parsed.data.ageMin,
      ageMax: parsed.data.ageMax,
    });

    const insertLog = await supabase.from("studio_meta_publishes").insert({
      user_id: user.id,
      project_id: generation.project_id,
      generation_id: generation.id,
      campaign_id: publishResult.campaignId,
      adset_id: publishResult.adsetId,
      creative_id: publishResult.creativeId,
      ad_id: publishResult.adId,
      status: "SUCCESS",
      request_json: {
        ...requestSnapshot,
        resolved: {
          campaignName,
          adSetName,
          adName,
          headline,
          primaryText,
          linkUrl,
          countryCodes: parsed.data.countryCodes ?? ["KR"],
          ageMin: parsed.data.ageMin ?? 20,
          ageMax: parsed.data.ageMax ?? 55,
          adAccountId: connection.ad_account_id,
          pageId: connection.page_id,
        },
      },
      response_json: publishResult,
    });

    if (insertLog.error) {
      return NextResponse.json(
        {
          error: `Meta 업로드는 성공했지만 로그 저장에 실패했습니다. (${insertLog.error.message})`,
          publish: publishResult,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Meta 광고 초안(PAUSED) 업로드가 완료되었습니다.",
        publish: publishResult,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta 업로드에 실패했습니다.";
    if (userId && generationId) {
      const supabase = getSupabaseServiceClient();
      await supabase.from("studio_meta_publishes").insert({
        user_id: userId,
        project_id: projectId,
        generation_id: generationId,
        status: "FAILED",
        error_message: message,
        request_json: requestSnapshot,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
