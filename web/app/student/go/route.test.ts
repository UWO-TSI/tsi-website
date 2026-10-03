import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
const { GET } = await import("./route");
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const land = async (query = "") => (await GET(new Request(`https://tethos.ca/student/go${query}`))).headers.get("location");

describe("/student/go account landing", () => {
  it("sends everyone to the applicant village while the member world is closed, without asking auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await land()).toBe("https://tethos.ca/student/apply/portal");
    expect(getUser).not.toHaveBeenCalled();
  });
  it("sends signed-in accounts to the island and signed-out people to the applicant sign-in once open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "open");
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    expect(await land()).toBe("https://tethos.ca/student/dashboard");
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await land()).toBe("https://tethos.ca/student/apply/dashboard");
    getUser.mockRejectedValueOnce(new Error("auth down"));
    expect(await land()).toBe("https://tethos.ca/student/apply/dashboard");
  });
  it("returns signed-in members to a safe ?next= page once open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "open");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await land("?next=%2Fstudent%2Fcompanion%2Fstudy")).toBe("https://tethos.ca/student/companion/study");
    expect(await land("?next=/student/dashboard/bounty%3Ftab%3Dopen")).toBe("https://tethos.ca/student/dashboard/bounty?tab=open");
    for (const bad of ["//evil.example/", "https://evil.example/", "/\\evil.example", "/student", "/student/", "/student/go", "/student/login", "/student/signup"]) {
      expect(await land(`?next=${encodeURIComponent(bad)}`)).toBe("https://tethos.ca/student/dashboard");
    }
  });
  it("keeps ?next= out of the closed world while it is closed, and ignores it for signed-out visitors once open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await land("?next=/student/companion")).toBe("https://tethos.ca/student/apply/portal");
    vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "open");
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await land("?next=/student/companion")).toBe("https://tethos.ca/student/apply/dashboard");
  });
  it("returns a closed-world sign-in to an open page (an event check-in), never into the closed world", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await land(`?next=${encodeURIComponent("/student/check-in?event=e1&code=ABC")}`)).toBe("https://tethos.ca/student/check-in?event=e1&code=ABC");
    expect(await land("?next=/student/apply/portal")).toBe("https://tethos.ca/student/apply/portal");
    for (const closed of ["/student/dashboard", "/student/companion/study", "/student/onboarding", "/student", "//evil.example/"]) {
      expect(await land(`?next=${encodeURIComponent(closed)}`)).toBe("https://tethos.ca/student/apply/portal");
    }
    expect(getUser).not.toHaveBeenCalled();
  });
});
