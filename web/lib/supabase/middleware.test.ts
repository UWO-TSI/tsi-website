import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// First-login routing (hud-first-login §6): who lands where on /student/dashboard.
const auth = vi.hoisted(() => ({ user: null as { id: string } | null, profile: null as { onboarding_completed: boolean } | null, profileReads: 0 }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: auth.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => { auth.profileReads++; return { data: auth.profile }; } }) }) }),
  }),
}));
const { middleware } = await import("@/middleware");

const go = async (path: string) => (await middleware(new NextRequest(`https://tethos.ca${path}`))).headers.get("location");
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "open");
  auth.user = null; auth.profile = null; auth.profileReads = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("first-login routing to the island", () => {
  it("sends signed-out visitors to sign in", async () => {
    expect(await go("/student/dashboard")).toBe("https://tethos.ca/student");
  });
  it("sends signed-in visitors past the /student login into the portal", async () => {
    expect(await go("/student")).toBeNull();
    auth.user = { id: "back" }; auth.profile = { onboarding_completed: true };
    expect(await go("/student")).toBe("https://tethos.ca/student/go");
  });
  it("lets a new member straight onto the island (the creator asks the name), past the portal wizard", async () => {
    auth.user = { id: "new" }; auth.profile = { onboarding_completed: false };
    expect(await go("/student/dashboard")).toBeNull();
    expect(await go("/student/dashboard/")).toBeNull();
    expect(auth.profileReads).toBe(0);
  });
  it("keeps the portal wizard in front of the portal's own pages", async () => {
    auth.user = { id: "new" }; auth.profile = { onboarding_completed: false };
    expect(await go("/student/dashboard/bounty")).toBe("https://tethos.ca/student/onboarding");
  });
  it("lets a returning member onto the island and the portal", async () => {
    auth.user = { id: "back" }; auth.profile = { onboarding_completed: true };
    expect(await go("/student/dashboard")).toBeNull();
    expect(await go("/student/dashboard/bounty")).toBeNull();
  });
  it("keeps the closed world closed for everyone, before asking auth", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "");
    auth.user = { id: "new" }; auth.profile = { onboarding_completed: false };
    expect(await go("/student/dashboard")).toBe("https://tethos.ca/student/opening-soon");
    auth.user = null;
    expect(await go("/student/dashboard")).toBe("https://tethos.ca/student/opening-soon");
  });
});
