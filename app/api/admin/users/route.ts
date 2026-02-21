import { NextResponse } from "next/server";

import { SIGNUP_INITIAL_CREDITS, UNIFIED_CREDIT_BUCKET_ID } from "@/lib/studio/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SEARCH_SCAN_PAGE_SIZE = 200;
const SEARCH_SCAN_MAX_PAGES = 10;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function normalizeQuery(raw: string | null): string {
  return (raw || "").trim().toLowerCase();
}

function isMatchedUser(
  user: { id?: string; email?: string | null; phone?: string | null },
  query: string,
) {
  if (!query) return true;
  const id = String(user.id || "").toLowerCase();
  const email = String(user.email || "").toLowerCase();
  const phone = String(user.phone || "").toLowerCase();
  return id.includes(query) || email.includes(query) || phone.includes(query);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get("query"));
    const limit = parseLimit(searchParams.get("limit"));
    const supabase = getSupabaseServiceClient();

    const matchedUsers: Array<{
      id: string;
      email: string | null;
      phone: string | null;
      createdAt: string | null;
      lastSignInAt: string | null;
    }> = [];

    if (!query) {
      const listRes = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: limit,
      });
      if (listRes.error) {
        return NextResponse.json(
          { error: `유저 목록 조회 실패 (${listRes.error.message})` },
          { status: 500 },
        );
      }

      for (const user of listRes.data.users ?? []) {
        matchedUsers.push({
          id: user.id,
          email: user.email ?? null,
          phone: user.phone ?? null,
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        });
      }
    } else {
      for (let page = 1; page <= SEARCH_SCAN_MAX_PAGES; page += 1) {
        const listRes = await supabase.auth.admin.listUsers({
          page,
          perPage: SEARCH_SCAN_PAGE_SIZE,
        });
        if (listRes.error) {
          return NextResponse.json(
            { error: `유저 검색 실패 (${listRes.error.message})` },
            { status: 500 },
          );
        }

        const users = listRes.data.users ?? [];
        for (const user of users) {
          if (!isMatchedUser(user, query)) continue;
          matchedUsers.push({
            id: user.id,
            email: user.email ?? null,
            phone: user.phone ?? null,
            createdAt: user.created_at ?? null,
            lastSignInAt: user.last_sign_in_at ?? null,
          });
          if (matchedUsers.length >= limit) break;
        }

        if (matchedUsers.length >= limit || users.length < SEARCH_SCAN_PAGE_SIZE) {
          break;
        }
      }
    }

    const limitedUsers = matchedUsers
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    const userIds = limitedUsers.map((item) => item.id);
    let balancesByUserId = new Map<string, number>();

    if (userIds.length > 0) {
      const ensureRows = await supabase.from("user_model_credits").upsert(
        userIds.map((userId) => ({
          user_id: userId,
          image_model_id: UNIFIED_CREDIT_BUCKET_ID,
          balance: SIGNUP_INITIAL_CREDITS,
        })),
        {
          onConflict: "user_id,image_model_id",
          ignoreDuplicates: true,
        },
      );

      if (ensureRows.error) {
        return NextResponse.json(
          { error: `유저 크레딧 행 초기화 실패 (${ensureRows.error.message})` },
          { status: 500 },
        );
      }

      const creditsRes = await supabase
        .from("user_model_credits")
        .select("user_id, balance")
        .in("user_id", userIds)
        .eq("image_model_id", UNIFIED_CREDIT_BUCKET_ID);

      if (creditsRes.error) {
        return NextResponse.json(
          { error: `크레딧 잔액 조회 실패 (${creditsRes.error.message})` },
          { status: 500 },
        );
      }

      balancesByUserId = new Map(
        (creditsRes.data ?? []).map((row) => [String(row.user_id), Number(row.balance) || 0]),
      );
    }

    return NextResponse.json(
      {
        users: limitedUsers.map((item) => ({
          ...item,
          balance: balancesByUserId.get(item.id) ?? 0,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 유저 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
