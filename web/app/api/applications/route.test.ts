import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", email: "applicant@example.invalid" } as { id: string; email: string } | null,
  admin: false, open: true, countError: false, insertError: null as { code: string } | null,
  receiptError: false, positionError: null as { code: string } | null, receiptLookups: [] as string[][],
  existing: null as { id: string; position_id: string; submitted_at: string } | null,
  recovered: null as { id: string; position_id: string; submitted_at: string } | null,
  pdf: "%PDF-1.7\nresume", downloadError: false, sync: vi.fn(),
  size: 1024, contentType: "application/pdf", inserted: [] as Record<string, unknown>[],
  after: [] as (() => Promise<unknown>)[], sends: vi.fn(), ranges: [] as number[][],
}));

vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => Promise<unknown>) => state.after.push(fn) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: (table: string) => {
    let receipt = false;
    const filters: string[][] = [];
    const q = {
      select: () => q, eq: (key: string, value: string) => { filters.push([key, value]); return q; }, gte: () => q, single: () => q, delete: () => q,
      maybeSingle: () => { receipt = true; state.receiptLookups.push(...filters); return q; },
      then: (resolve: (value: unknown) => unknown) => resolve(table === "positions"
        ? { data: state.positionError ? null : { id: "22222222-2222-4222-8222-222222222222", slug: "developer", is_active: state.open, essay_questions: [{ id: "why", question: "Why?", max_words: 200 }] }, error: state.positionError }
        : receipt ? { data: state.inserted.length ? state.recovered : state.existing, error: state.receiptError ? { code: "offline" } : null }
        : { count: 0, error: state.countError ? { code: "offline" } : null }),
    }; return q;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({
  isAdminEmail: () => state.admin,
  createAdminClient: () => ({
    storage: { from: () => ({
      info: async () => ({ data: { size: state.size, contentType: state.contentType } }),
      download: async () => ({ data: new Blob([state.pdf]), error: state.downloadError ? { code: "offline" } : null }),
      createSignedUrl: async () => ({ data: { signedUrl: "https://example.invalid/resume" } }),
    }) },
    from: () => {
      const q = {
        insert: (values: Record<string, unknown>) => { state.inserted.push(values); return q; },
        select: () => q, single: () => q, order: () => q, eq: () => q, contains: () => q,
        range: (from: number, to: number) => { state.ranges.push([from,to]); return q; },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: { id: "saved", position_id: "22222222-2222-4222-8222-222222222222", submitted_at: "2026-09-16T12:00:00Z" }, error: state.insertError }),
      }; return q;
    },
  }),
}));
vi.mock("@/lib/google-sheets", () => ({ trySheetSync: state.sync }));
vi.mock("@/lib/resend", () => ({ getResend: () => ({ emails: { send: state.sends } }), EMAIL_FROM: "test@example.invalid" }));
vi.mock("@/emails/ApplicationConfirmation", () => ({ default: () => null }));

import { POST, GET } from "./route";
const body = {
  position_id: "22222222-2222-4222-8222-222222222222", full_name: "Test Applicant", email: "test@example.invalid",
  phone: "", program_major: "Engineering", year_of_study: 2, heard_about_us: "Website",
  resume_storage_path: "11111111-1111-4111-8111-111111111111/resume.pdf", resume_filename: "resume.pdf",
  essay_answers: [{ question_id: "why", answer: "To build useful things" }],
};
const request = (data: unknown = body) => new Request("https://example.invalid/api/applications", { method: "POST", body: JSON.stringify(data) });

describe("application submission boundary", () => {
  beforeEach(() => {
    state.user = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.invalid" };
    state.admin = false; state.open = true; state.countError = false; state.insertError = null;
    state.receiptError = false; state.positionError = null; state.receiptLookups = []; state.existing = null; state.recovered = null;
    state.pdf = "%PDF-1.7\nresume"; state.downloadError = false; state.sync.mockReset();
    state.size = 1024; state.contentType = "application/pdf"; state.inserted = []; state.after = []; state.ranges = []; state.sends.mockReset();
  });
  it("requires authentication and keeps review data admin-only", async () => {
    state.user = null;
    expect((await POST(request())).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
    state.user = { id: "test", email: "test@example.invalid" };
    expect((await GET(request())).status).toBe(403);
    expect(state.inserted).toHaveLength(0);
  });
  it("derives ownership and strips forged review fields, while deferring Google and email", async () => {
    const response = await POST(request({ ...body, user_id: "someone-else", status: "accepted", draft_status: "accepted", admin_notes: "forged", tags: ["forged"] }));
    expect(response.status).toBe(201);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].user_id).toBe(state.user?.id);
    for (const field of ["status", "draft_status", "admin_notes", "tags"]) expect(state.inserted[0]).not.toHaveProperty(field);
    expect(state.after).toHaveLength(3);
    expect(state.sends).not.toHaveBeenCalled();
  });
  it("rejects closed roles and invalid answers before inserting", async () => {
    state.open = false;
    expect((await POST(request())).status).toBe(409);
    state.open = true;
    expect((await POST(request({ ...body, essay_answers: [] }))).status).toBe(400);
    expect(state.inserted).toHaveLength(0);
  });
  it("rejects someone else's resume, oversized uploads and non-PDF uploads", async () => {
    expect((await POST(request({ ...body, resume_storage_path: "someone-else/file.pdf" }))).status).toBe(400);
    state.size = 2097153;
    expect((await POST(request())).status).toBe(400);
    state.size = 1024; state.contentType = "image/png";
    expect((await POST(request())).status).toBe(400);
    expect(state.inserted).toHaveLength(0);
  });
  it("fails closed when application-history verification is unavailable", async () => {
    state.countError = true;
    expect((await POST(request())).status).toBe(503);
    expect(state.inserted).toHaveLength(0);
  });
  it("never reports duplicate success without a verified saved record", async () => {
    state.insertError = { code: "23505" };
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SAVE_UNCONFIRMED");
    expect(state.after).toHaveLength(0);
  });
  it("returns a structured closed response for database deadline protection", async () => {
    state.insertError = { code: "23514" };
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("POSITION_CLOSED");
    expect(state.after).toHaveLength(0);
  });
  it("recovers a saved application on retry after the role closes, without repeating side effects", async () => {
    state.open = false;
    state.existing = { id: "saved", position_id: body.position_id, submitted_at: "2026-09-16T12:00:00Z" };
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...state.existing, already_submitted: true });
    expect(state.receiptLookups).toEqual([["user_id", state.user!.id], ["position_id", body.position_id]]);
    expect(state.inserted).toHaveLength(0);
    expect(state.after).toHaveLength(0);
  });
  it.each(["23505", "FETCH_ERROR"])("recovers a committed record after insert error %s", async code => {
    state.insertError = { code };
    state.recovered = { id: "saved", position_id: body.position_id, submitted_at: "2026-09-16T12:00:00Z" };
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...state.recovered, already_submitted: true });
    expect(state.inserted).toHaveLength(1);
    expect(state.after).toHaveLength(0);
  });
  it("does not insert when saved-record lookup fails or call a temporary position failure closed", async () => {
    state.receiptError = true;
    expect((await POST(request())).status).toBe(503);
    state.receiptError = false; state.positionError = { code: "offline" };
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).not.toBe("POSITION_CLOSED");
    expect(state.inserted).toHaveLength(0);
  });
  it("checks PDF bytes rather than trusting user-controlled MIME type", async () => {
    state.pdf = "not actually a PDF";
    expect((await POST(request())).status).toBe(400);
    state.pdf = "%PDF-" + "x".repeat(2097152);
    expect((await POST(request())).status).toBe(400);
    state.downloadError = true;
    expect((await POST(request())).status).toBe(503);
    expect(state.inserted).toHaveLength(0);
  });
  it("returns the database receipt before draft cleanup, Google or email run", async () => {
    state.sync.mockRejectedValue(new Error("Google unavailable"));
    state.sends.mockRejectedValue(new Error("Email unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "saved", position_id: body.position_id, submitted_at: "2026-09-16T12:00:00Z" });
    expect(state.sync).not.toHaveBeenCalled();
    expect(state.sends).not.toHaveBeenCalled();
    const effects = await Promise.allSettled(state.after.map(run => run()));
    expect(effects[1].status).toBe("rejected");
    expect(response.status).toBe(201);
  });
  it("bounds admin pagination and fetches the requested next page", async () => {
    state.admin = true;
    for (const query of ["offset=Infinity", "offset=-1", "limit=501", "limit=1.5"]) {
      expect((await GET(new Request(`https://example.invalid/api/applications?${query}`))).status).toBe(400);
    }
    expect((await GET(new Request("https://example.invalid/api/applications?offset=500&limit=100"))).status).toBe(200);
    expect(state.ranges).toEqual([[500,599]]);
  });
});
