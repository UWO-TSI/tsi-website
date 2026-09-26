import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  email: null as string | null, statusFails: false, syncFails: false,
  status: vi.fn(), sync: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mock.email ? { email: mock.email } : null } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ isAdminEmail: (email: string) => email === "reviewer@example.test" }));
vi.mock("@/lib/google-sheets", () => ({
  sheetSyncStatus: mock.status,
  syncRecruitmentSheet: mock.sync,
}));
import { GET, POST } from "./route";
const request = (token?: string) => new Request("http://localhost/api/sheets-sync", { headers: token ? { authorization: token } : {} });

describe("admin Sheets boundary", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-token");
    mock.email = null; mock.status.mockReset(); mock.sync.mockReset();
    mock.status.mockResolvedValue({ setup_ready: true, configured: true, connection: "connected", pending: 0 });
    mock.sync.mockResolvedValue({ synced: 2 });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("denies anonymous and ordinary applicants without contacting Sheets", async () => {
    for (const email of [null, "applicant@example.test"]) {
      mock.email = email;
      expect((await GET(request())).status).toBe(403);
      expect((await POST(request())).status).toBe(403);
    }
    expect(mock.status).not.toHaveBeenCalled(); expect(mock.sync).not.toHaveBeenCalled();
  });
  it("returns uncached read-only health to an administrator", async () => {
    mock.email = "reviewer@example.test";
    mock.status.mockResolvedValue({ setup_ready: false, configured: true, connection: "reconnect", pending: null });
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ setup_ready: false, connection: "reconnect", pending: null });
    expect(mock.sync).not.toHaveBeenCalled();
  });
  it("accepts only the exact configured scheduler token", async () => {
    for (const token of ["Bearer bad", "Bearer test-cron-tokeN", "test-cron-token"]) expect((await POST(request(token))).status).toBe(403);
    const response = await POST(request("Bearer test-cron-token"));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ synced: 2, pending: 0 });
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });
  it("does not treat an absent scheduler secret as authorization", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request("Bearer undefined"))).status).toBe(403);
  });
  it("returns safe failures without upstream credential or applicant data", async () => {
    mock.email = "reviewer@example.test";
    mock.status.mockRejectedValue(new Error("private database response"));
    const health = await GET(request());
    expect(health.status).toBe(503); expect(await health.text()).not.toContain("private");
    mock.sync.mockRejectedValue(new Error("private Google response"));
    const sync = await POST(request());
    expect(sync.status).toBe(503); expect(await sync.text()).not.toContain("private");
  });
});
