import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
const { GET } = await import("./route");
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const land = async () => (await GET(new Request("https://tethos.ca/student/go"))).headers.get("location");

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
});
