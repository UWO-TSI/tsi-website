import { describe, expect, it } from "vitest";
import { APPLICANT_PORTAL, memberWorldIsAvailable, OPENING_SOON, recruitmentReturnPath, recruitmentRouteRedirect, sameOriginPath } from "./recruitment-access";

describe("applicant and member-world routing", () => {
  it("opens the member world only on the launch flag, defaulting to local development", () => {
    expect(memberWorldIsAvailable("open", "production")).toBe(true);
    expect(memberWorldIsAvailable("closed", "development")).toBe(false);
    expect(memberWorldIsAvailable("yes", "production")).toBe(false);
    expect(memberWorldIsAvailable(undefined, "development")).toBe(true);
    expect(memberWorldIsAvailable(undefined, "production")).toBe(false);
    expect(memberWorldIsAvailable("", "test")).toBe(false);
  });
  it.each(["/student/dashboard", "/student/dashboard/", "/student/dashboard/shop", "/student/dashboard/admin", "/student/onboarding", "/student/companion", "/student/companion/study"])("sends %s to the opening-soon page while closed, without depending on auth", path => {
    expect(recruitmentRouteRedirect(path, false)).toBe(OPENING_SOON);
    expect(recruitmentRouteRedirect(path, true)).toBeNull();
  });
  it("keeps recruitment admin and the applicant flow independent of the member world", () => {
    for (const open of [false, true]) {
      expect(recruitmentRouteRedirect("/student/dashboard/admin/recruitment", open)).toBe("/admin/recruit");
      expect(recruitmentRouteRedirect("/admin/recruit", open)).toBeNull();
      expect(recruitmentRouteRedirect("/student/apply/dashboard", open)).toBeNull();
      expect(recruitmentRouteRedirect(APPLICANT_PORTAL, open)).toBeNull();
      expect(recruitmentRouteRedirect("/student/dashboardx", open)).toBeNull();
    }
  });
  it.each([null, "", "/student/dashboard", "/student/onboarding", "/student/apply", "https://other.example/", "//other.example/", "/\\other.example/", "/student/apply/../../dashboard", "/student/apply/../dashboard", "/student/apply/portal\n"])("uses applicant entry for unsafe or obsolete return path %s", path => {
    expect(recruitmentReturnPath(path)).toBe(APPLICANT_PORTAL);
  });
  it.each(["/student/apply/director-external", "/student/apply/developer?source=email", "/student/apply/dashboard", "/admin/recruit", "/admin/preview/application-id", "/student/reset-password", "/student/go"])("preserves explicit recruitment/recovery destination %s", path => {
    expect(recruitmentReturnPath(path)).toBe(path);
  });
});

describe("sameOriginPath", () => {
  it.each([null, "", "student", "//other.example/", "https://other.example/", "/\\other.example/", "/student\n"])("rejects %s", (input) => {
    expect(sameOriginPath(input)).toBeNull();
  });
  it.each([["/student/companion/study", "/student/companion/study"], ["/student/dashboard?x=1#y", "/student/dashboard?x=1#y"], ["/student/apply/../dashboard", "/student/dashboard"]])("keeps %s as %s", (input, out) => {
    expect(sameOriginPath(input)).toBe(out);
  });
});
