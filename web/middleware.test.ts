import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";
import { updateSession } from "@/lib/supabase/middleware";

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn(async (request: NextRequest) => NextResponse.next({ request })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("unpublished world boundary", () => {
  it("redirects production member requests before contacting auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await middleware(new NextRequest("https://tethos.ca/student/dashboard?preview=1"));
    expect(response.headers.get("location")).toBe("https://tethos.ca/student/apply/portal");
    expect(updateSession).not.toHaveBeenCalled();
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
