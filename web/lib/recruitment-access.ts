export const APPLICANT_PORTAL = "/student/apply/portal";
export const RECRUITMENT_ADMIN = "/admin/recruit";
export const OPENING_SOON = "/student/opening-soon";

/**
 * The member world's launch switch: NEXT_PUBLIC_MEMBER_WORLD=open|closed.
 * Unset, it is open in local development and closed everywhere else.
 * NEXT_PUBLIC_ values are inlined at build time, so flipping it needs a redeploy.
 */
export function memberWorldIsAvailable(flag = process.env.NEXT_PUBLIC_MEMBER_WORLD, environment = process.env.NODE_ENV) {
  return flag ? flag === "open" : environment === "development";
}

/** Run before session refresh: its fail-open timeout must never expose a closed world. */
export function recruitmentRouteRedirect(pathname: string, open = memberWorldIsAvailable()): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/student/dashboard/admin/recruitment") return RECRUITMENT_ADMIN;
  if (!open && /^\/student\/(dashboard|onboarding|companion)(\/|$)/.test(path)) return OPENING_SOON;
  return null;
}

const ORIGIN = "https://tethos.invalid";

/** An untrusted return path (`?next=`) normalised to a same-origin path, or null. */
export function sameOriginPath(input: string | null | undefined): string | null {
  if (!input || !input.startsWith("/") || input.startsWith("//") || /[\\\u0000-\u001f]/.test(input)) return null;
  let url: URL;
  try { url = new URL(input, ORIGIN); } catch { return null; }
  return url.origin === ORIGIN ? `${url.pathname}${url.search}${url.hash}` : null;
}

/** Only recruitment destinations, the account landing and password recovery can override ordinary account entry. */
export function recruitmentReturnPath(input: string | null | undefined) {
  const safe = sameOriginPath(input);
  if (!safe) return APPLICANT_PORTAL;
  const path = new URL(safe, ORIGIN).pathname.replace(/\/+$/, "");
  if (path === "/student/dashboard/admin/recruitment") return RECRUITMENT_ADMIN;
  if (path === RECRUITMENT_ADMIN || path === "/student/go" || path.startsWith("/admin/preview/") || path === "/student/reset-password" || path.startsWith("/student/apply/")) {
    return safe;
  }
  return APPLICANT_PORTAL;
}
