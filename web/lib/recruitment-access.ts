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

/** Only recruitment destinations, the account landing and password recovery can override ordinary account entry. */
export function recruitmentReturnPath(input: string | null | undefined) {
  if (!input || !input.startsWith("/") || input.startsWith("//") || /[\\\u0000-\u001f]/.test(input)) return APPLICANT_PORTAL;
  let url: URL;
  try { url = new URL(input, "https://tethos.invalid"); } catch { return APPLICANT_PORTAL; }
  if (url.origin !== "https://tethos.invalid") return APPLICANT_PORTAL;
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/student/dashboard/admin/recruitment") return RECRUITMENT_ADMIN;
  if (path === RECRUITMENT_ADMIN || path === "/student/go" || path.startsWith("/admin/preview/") || path === "/student/reset-password" || path.startsWith("/student/apply/")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return APPLICANT_PORTAL;
}
