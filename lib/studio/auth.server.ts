import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase";

export type StudioAuthedUser = {
  id: string;
  email: string | null;
};

export async function requireStudioUserFromAuthHeader(
  request: Request,
): Promise<StudioAuthedUser> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";

  if (!token) {
    throw new Error("인증 토큰이 없습니다. 다시 로그인해 주세요.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.id) {
    throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
