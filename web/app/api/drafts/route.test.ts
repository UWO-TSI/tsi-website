import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: "11111111-1111-4111-8111-111111111111" as string | null,
  receipts: [] as (Record<string, string> | null)[], lookupError: false,
  draft: { form_data: { full_name: "Unsaved applicant" }, updated_at: "2026-09-16T12:00:00Z" },
  operations: [] as { table: string; operation: string; filters: Record<string, string>; values?: Record<string, unknown> }[],
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }) },
  from: (table: string) => {
    let operation = "select";
    let values: Record<string, unknown> | undefined;
    const filters: Record<string, string> = {};
    const q = {
      select: () => q, maybeSingle: () => q, single: () => q,
      eq: (key: string, value: string) => { filters[key] = value; return q; },
      upsert: (input: Record<string, unknown>) => { operation = "upsert"; values = input; return q; },
      delete: () => { operation = "delete"; return q; },
      then: (resolve: (value: unknown) => unknown) => {
        state.operations.push({ table, operation, filters, values });
        return resolve(table === "applications"
          ? { data: state.receipts.shift() ?? null, error: state.lookupError ? { code: "offline" } : null }
          : { data: state.draft, error: null });
      },
    };
    return q;
  },
}) }));

import { GET, PUT, DELETE } from "./route";

const positionId = "22222222-2222-4222-8222-222222222222";
const receipt = { id: "saved", position_id: positionId, submitted_at: "2026-09-16T12:00:00Z" };
const read = () => new Request(`https://example.invalid/api/drafts?position_id=${positionId}`);
const save = (body: unknown = { position_id: positionId, form_data: { full_name: "Applicant" } }) =>
  new Request("https://example.invalid/api/drafts", { method: "PUT", body: JSON.stringify(body) });

describe("draft recovery boundary", () => {
  beforeEach(() => {
    state.user = "11111111-1111-4111-8111-111111111111";
    state.receipts = []; state.lookupError = false; state.operations = [];
  });
  it("requires authentication for reading, saving and deleting", async () => {
    state.user = null;
    expect((await GET(read())).status).toBe(401);
    expect((await PUT(save())).status).toBe(401);
    expect((await DELETE(read())).status).toBe(401);
    expect(state.operations).toHaveLength(0);
  });
  it("rejects malformed JSON, non-object drafts and invalid position ids", async () => {
    for (const body of [null, {}, { position_id: "invalid", form_data: {} }, { position_id: positionId, form_data: [] }, { position_id: positionId, form_data: "text" }]) {
      expect((await PUT(save(body))).status).toBe(400);
    }
    expect((await PUT(new Request("https://example.invalid/api/drafts", { method: "PUT", body: "{" }))).status).toBe(400);
    const invalid = new Request("https://example.invalid/api/drafts?position_id=invalid");
    expect((await GET(invalid)).status).toBe(400);
    expect((await DELETE(invalid)).status).toBe(400);
    expect(state.operations).toHaveLength(0);
  });
  it("returns private, uncached draft reads with ownership filters", async () => {
    const response = await GET(read());
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(state.draft);
    expect(state.operations.every(op => op.filters.user_id === state.user && op.filters.position_id === positionId)).toBe(true);
  });
  it("suppresses a late leftover draft when a confirmed application exists", async () => {
    state.receipts = [receipt];
    const response = await GET(read());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ submitted_application: receipt });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("refuses to autosave after submission", async () => {
    state.receipts = [receipt];
    const response = await PUT(save());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ALREADY_SUBMITTED", submitted_application: receipt });
    expect(state.operations.some(op => op.operation === "upsert")).toBe(false);
  });
  it("cleans up when submission becomes visible after the draft write", async () => {
    state.receipts = [null, receipt];
    const response = await PUT(save());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ALREADY_SUBMITTED", submitted_application: receipt });
    expect(state.operations.map(op => op.operation)).toEqual(["select", "upsert", "select", "delete"]);
    expect(state.operations[3].filters).toEqual({ user_id: state.user, position_id: positionId });
  });
  it("derives saved ownership from authentication, ignoring forged fields", async () => {
    const response = await PUT(save({ position_id: positionId, user_id: "someone-else", form_data: {}, updated_at: "2099-01-01" }));
    expect(response.status).toBe(200);
    const write = state.operations.find(op => op.operation === "upsert")!;
    expect(write.values).toMatchObject({ user_id: state.user, position_id: positionId, form_data: {} });
    expect(write.values?.updated_at).not.toBe("2099-01-01");
  });
  it("fails closed if confirmation lookup is unavailable", async () => {
    state.lookupError = true;
    expect((await GET(read())).status).toBe(503);
    expect((await PUT(save())).status).toBe(503);
    expect(state.operations.some(op => op.operation === "upsert")).toBe(false);
  });
});
