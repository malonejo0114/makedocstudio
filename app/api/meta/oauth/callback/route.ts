import { NextRequest, NextResponse } from "next/server";

import {
  exchangeCodeForMetaAccessToken,
  getMetaAdAccounts,
  getMetaMe,
  getMetaPages,
  parseMetaOAuthState,
} from "@/lib/meta/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

function redirectToAccount(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/account", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const authError = request.nextUrl.searchParams.get("error_description");

  if (authError) {
    return redirectToAccount(request, {
      meta: "oauth_error",
      message: authError.slice(0, 200),
    });
  }

  if (!code || !state) {
    return redirectToAccount(request, {
      meta: "oauth_error",
      message: "OAuth 응답에 code/state가 없습니다.",
    });
  }

  try {
    const { uid } = parseMetaOAuthState(state);
    const { accessToken, expiresIn } = await exchangeCodeForMetaAccessToken(code);
    const [me, accounts, pages] = await Promise.all([
      getMetaMe(accessToken),
      getMetaAdAccounts(accessToken),
      getMetaPages(accessToken),
    ]);

    const supabase = getSupabaseServiceClient();
    const existing = await supabase
      .from("user_meta_connections")
      .select("ad_account_id, page_id, instagram_actor_id, default_link_url")
      .eq("user_id", uid)
      .maybeSingle();

    const resolvedAdAccountId =
      existing.data?.ad_account_id || accounts[0]?.id || null;
    const resolvedPageId = existing.data?.page_id || pages[0]?.id || null;

    const tokenExpiresAt =
      expiresIn && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

    const upsert = await supabase.from("user_meta_connections").upsert(
      {
        user_id: uid,
        meta_user_id: me.id,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        ad_account_id: resolvedAdAccountId,
        page_id: resolvedPageId,
        instagram_actor_id: existing.data?.instagram_actor_id || null,
        default_link_url: existing.data?.default_link_url || null,
      },
      { onConflict: "user_id" },
    );

    if (upsert.error) {
      throw new Error(`연동 저장 실패: ${upsert.error.message}`);
    }

    return redirectToAccount(request, {
      meta: "connected",
      accounts: String(accounts.length),
      pages: String(pages.length),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meta OAuth 콜백 처리에 실패했습니다.";
    return redirectToAccount(request, {
      meta: "oauth_error",
      message: message.slice(0, 200),
    });
  }
}
