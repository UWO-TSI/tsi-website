import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * One sign-in for www.tethos.ca and play.tethos.ca: on tethos.ca hosts the session cookie is shared
 * across subdomains under its own name. The old host-only `sb-<ref>-auth-token` cookies are ignored,
 * so a session from before the switch signs in once more. Other hosts (localhost, *.vercel.app
 * previews) keep the library's default host-only cookie.
 */
export const SHARED_AUTH_COOKIE = "sb-tethos-auth";

export function authCookieOptions(host: string | null | undefined): CookieOptionsWithName | undefined {
  const name = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return name === "tethos.ca" || name.endsWith(".tethos.ca") ? { name: SHARED_AUTH_COOKIE, domain: ".tethos.ca" } : undefined;
}
