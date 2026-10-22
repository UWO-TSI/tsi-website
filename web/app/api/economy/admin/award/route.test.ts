import { describe, expect, it, vi } from "vitest";

const credit = vi.hoisted(() => vi.fn(async () => ({ balance: 5, replayed: false })));
vi.mock("@/lib/server/adminContext", () => ({
  withAdminStore: async () => ({
    userId: "admin",
    store: { credit },
    db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: MEMBER } }) }) }) }) },
  }),
}));
const MEMBER = "00000000-0000-4000-8000-0000000000a1";

import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/economy/admin/award", () => {
  it("keys the award on the caller's idempotency key, so a resend replays instead of paying twice", async () => {
    expect((await post({ user_id: MEMBER, amount: 5, idempotency_key: "award-1234" })).status).toBe(200);
    expect((await post({ user_id: MEMBER, amount: 5, idempotency_key: "award-1234" })).status).toBe(200);
    expect(credit.mock.calls.map((c) => (c as unknown[])[5])).toEqual(["award:award-1234", "award:award-1234"]);
  });
  it("refuses an award without a key", async () => {
    expect((await post({ user_id: MEMBER, amount: 5 })).status).toBe(400);
  });
});
