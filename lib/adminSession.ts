const ADMIN_COOKIE_NAME = "adg_admin_session";
const ADMIN_SESSION_TTL_SEC = 60 * 60 * 12;

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

function getAdminSecret(): string {
  return process.env.ADMIN_AUTH_SECRET?.trim() || "adg-admin-secret-v1";
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminPassword());
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminSessionTtlSec(): number {
  return ADMIN_SESSION_TTL_SEC;
}

export async function buildAdminSessionToken(): Promise<string> {
  const password = getAdminPassword();
  const secret = getAdminSecret();
  return sha256Hex(`${password}:${secret}:session-v1`);
}

export async function verifyAdminPassword(passwordInput: string): Promise<boolean> {
  const password = getAdminPassword();
  if (!password) {
    return false;
  }

  const normalized = passwordInput.trim();
  return normalized === password;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !isAdminAuthConfigured()) {
    return false;
  }

  const expected = await buildAdminSessionToken();
  return token === expected;
}

