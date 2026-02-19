import { NextResponse } from "next/server";
import { z } from "zod";

import { getMetaAdAccounts, getMetaGraphVersion, getMetaPages } from "@/lib/meta/server";
import { requireStudioUserFromAuthHeader } from "@/lib/studio/auth.server";
import { getSupabaseServiceClient } from "@/lib/supabase";

const ConnectionPatchSchema = z.object({
  adAccountId: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
  instagramActorId: z.string().optional(),
  defaultLinkUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const supabase = getSupabaseServiceClient();

    const connection = await supabase
      .from("user_meta_connections")
      .select(
        "meta_user_id, ad_account_id, page_id, instagram_actor_id, token_expires_at, default_link_url, created_at, updated_at, access_token",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (connection.error) {
      return NextResponse.json(
        { error: `Meta 연동 정보를 불러오지 못했습니다. (${connection.error.message})` },
        { status: 500 },
      );
    }

    if (!connection.data) {
      return NextResponse.json(
        {
          connected: false,
          graphVersion: getMetaGraphVersion(),
          accounts: [],
          pages: [],
        },
        { status: 200 },
      );
    }

    let accounts: Array<Record<string, unknown>> = [];
    let pages: Array<Record<string, unknown>> = [];
    let tokenValid = true;
    let remoteError: string | null = null;

    try {
      const [remoteAccounts, remotePages] = await Promise.all([
        getMetaAdAccounts(connection.data.access_token),
        getMetaPages(connection.data.access_token),
      ]);
      accounts = remoteAccounts;
      pages = remotePages;
    } catch (error) {
      tokenValid = false;
      remoteError = error instanceof Error ? error.message : "Meta API 조회 실패";
    }

    return NextResponse.json(
      {
        connected: true,
        tokenValid,
        remoteError,
        graphVersion: getMetaGraphVersion(),
        metaUserId: connection.data.meta_user_id,
        adAccountId: connection.data.ad_account_id,
        pageId: connection.data.page_id,
        instagramActorId: connection.data.instagram_actor_id,
        defaultLinkUrl: connection.data.default_link_url,
        tokenExpiresAt: connection.data.token_expires_at,
        createdAt: connection.data.created_at,
        updatedAt: connection.data.updated_at,
        accounts,
        pages,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta 연동 조회 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const payload = await request.json().catch(() => null);
    const parsed = ConnectionPatchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Meta 연결 설정 형식이 올바르지 않습니다.", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();
    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.adAccountId) updatePayload.ad_account_id = parsed.data.adAccountId.trim();
    if (parsed.data.pageId) updatePayload.page_id = parsed.data.pageId.trim();
    if (parsed.data.instagramActorId !== undefined)
      updatePayload.instagram_actor_id = parsed.data.instagramActorId?.trim() || null;
    if (parsed.data.defaultLinkUrl !== undefined)
      updatePayload.default_link_url = parsed.data.defaultLinkUrl?.trim() || null;

    const updated = await supabase
      .from("user_meta_connections")
      .update(updatePayload)
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (updated.error || !updated.data) {
      return NextResponse.json(
        { error: "Meta 연결이 없습니다. 먼저 계정을 연동해 주세요." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta 연결 설정 저장 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireStudioUserFromAuthHeader(request);
    const supabase = getSupabaseServiceClient();
    const deleted = await supabase
      .from("user_meta_connections")
      .delete()
      .eq("user_id", user.id);

    if (deleted.error) {
      return NextResponse.json(
        { error: `Meta 연결 해제에 실패했습니다. (${deleted.error.message})` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta 연결 해제 실패";
    const status = message.includes("세션") || message.includes("로그인") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
