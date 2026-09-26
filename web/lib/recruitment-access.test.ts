import { describe, expect, it } from "vitest";
import { APPLICANT_PORTAL, memberWorldIsAvailable, recruitmentReturnPath, recruitmentRouteRedirect } from "./recruitment-access";

describe("applicant and member-world routing", () => {
  it("makes the member world local-development only", () => {
    expect(memberWorldIsAvailable("development")).toBe(true);
    expect(memberWorldIsAvailable("production")).toBe(false);
    expect(memberWorldIsAvailable("test")).toBe(false);
  });
  it.each(["/student/dashboard", "/student/dashboard/", "/student/dashboard/shop", "/student/dashboard/admin", "/student/onboarding"])("blocks direct public access to %s without depending on auth", path => {
    expect(recruitmentRouteRedirect(path, "production")).toBe(APPLICANT_PORTAL);
    expect(recruitmentRouteRedirect(path, "development")).toBeNull();
  });
  it("keeps recruitment admin independent of the member world", () => {
    expect(recruitmentRouteRedirect("/student/dashboard/admin/recruitment", "production")).toBe("/admin/recruit");
    expect(recruitmentRouteRedirect("/admin/recruit", "production")).toBeNull();
    expect(recruitmentRouteRedirect("/student/apply/dashboard", "production")).toBeNull();
  });
  it.each([null, "", "/student/dashboard", "/student/onboarding", "/student/apply", "https://other.example/", "//other.example/", "/\\other.example/", "/student/apply/../../dashboard", "/student/apply/../dashboard", "/student/apply/portal\n"])("uses applicant entry for unsafe or obsolete return path %s", path => {
    expect(recruitmentReturnPath(path)).toBe(APPLICANT_PORTAL);
  });
  it.each(["/student/apply/director-external", "/student/apply/developer?source=email", "/student/apply/dashboard", "/admin/recruit", "/admin/preview/application-id", "/student/reset-password"])("preserves explicit recruitment/recovery destination %s", path => {
    expect(recruitmentReturnPath(path)).toBe(path);
  });
});
