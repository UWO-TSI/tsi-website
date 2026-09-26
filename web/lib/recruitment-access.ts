export const APPLICANT_PORTAL = "/student/apply/portal";
export const RECRUITMENT_ADMIN = "/admin/recruit";

export function memberWorldIsAvailable(environment: string | undefined = process.env.NODE_ENV) {
  return environment === "development";
}

/** Run before session refresh: its fail-open timeout must never expose the parked world. */
export function recruitmentRouteRedirect(pathname: string, environment: string | undefined = process.env.NODE_ENV): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/student/dashboard/admin/recruitment") return RECRUITMENT_ADMIN;
  if (!memberWorldIsAvailable(environment) && (
    path === "/student/dashboard" || path.startsWith("/student/dashboard/") ||
    path === "/student/onboarding" || path.startsWith("/student/onboarding/")
  )) return APPLICANT_PORTAL;
  return null;
}

/** Only recruitment destinations and password recovery can override ordinary account entry. */
export function recruitmentReturnPath(input: string | null | undefined) {
  if (!input || !input.startsWith("/") || input.startsWith("//") || /[\\\u0000-\u001f]/.test(input)) return APPLICANT_PORTAL;
  let url: URL;
  try { url = new URL(input, "https://tethos.invalid"); } catch { return APPLICANT_PORTAL; }
  if (url.origin !== "https://tethos.invalid") return APPLICANT_PORTAL;
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/student/dashboard/admin/recruitment") return RECRUITMENT_ADMIN;
  if (path === RECRUITMENT_ADMIN || path.startsWith("/admin/preview/") || path === "/student/reset-password" || path.startsWith("/student/apply/")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return APPLICANT_PORTAL;
}
