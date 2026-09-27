import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";
import { updateSession } from "@/lib/supabase/middleware";

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn(async (request: NextRequest) => NextResponse.next({ request })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("member world launch switch", () => {
  it("sends production member requests to the opening-soon page before contacting auth while the flag is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await middleware(new NextRequest("https://tethos.ca/student/dashboard?preview=1"));
    expect(response.headers.get("location")).toBe("https://tethos.ca/student/opening-soon");
    expect(updateSession).not.toHaveBeenCalled();
  });
  it("closes the phone companion with the island", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await middleware(new NextRequest("https://tethos.ca/student/companion"));
    expect(response.headers.get("location")).toBe("https://tethos.ca/student/opening-soon");
  });
  it("lets member requests through to session handling once NEXT_PUBLIC_MEMBER_WORLD=open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MEMBER_WORLD", "open");
    const response = await middleware(new NextRequest("https://tethos.ca/student/dashboard"));
    expect(response.headers.get("location")).toBeNull();
    await middleware(new NextRequest("https://tethos.ca/student/companion"));
    expect(updateSession).toHaveBeenCalledTimes(2);
  });
  it("preserves the legacy recruitment admin bookmark outside the member shell", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await middleware(new NextRequest("https://tethos.ca/student/dashboard/admin/recruitment"));
    expect(response.headers.get("location")).toBe("https://tethos.ca/admin/recruit");
    expect(updateSession).not.toHaveBeenCalled();
  });
  it("retains normal session handling for direct applications and local world testing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await middleware(new NextRequest("https://tethos.ca/student/apply/director-external"));
    vi.stubEnv("NODE_ENV", "development");
    await middleware(new NextRequest("http://localhost:3102/student/dashboard"));
    expect(updateSession).toHaveBeenCalledTimes(2);
  });
});
