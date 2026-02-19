import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase";

export type AuthedUser = {
  id: string;
  email: string | null;
};

export async function requireUserFromAuthHeader(request: Request): Promise<AuthedUser> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";
  if (!token) {
    throw new Error("Missing Authorization token.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error("Unauthorized.");
  }

  return { id: data.user.id, email: data.user.email ?? null };
}

