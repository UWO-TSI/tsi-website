import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn(async (...args: unknown[]) => { void args; return { data: [{ status: "won", paid: 15, balance: 115, replayed: false }], error: null as null | { message: string } }; }));
vi.mock("@/lib/server/memberContext", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => ({ userId: ME, tier: 4, db: { rpc }, now: new Date() }),
}));
const ME = "00000000-0000-4000-8000-0000000007b1", TICKET = "00000000-0000-4000-8000-0000000007c1";

import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/volleyball/finish", () => {
  it("names only the caller, the ticket and the score: the database decides the payout", async () => {
    const res = await post({ ticket: TICKET, points: [21, 15], paid: 9999 });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toEqual({ status: "won", paid: 15, balance: 115, replayed: false });
    expect(rpc).toHaveBeenLastCalledWith("volleyball_casual_finish", { p_member_id: ME, p_ticket: TICKET, p_home: 21, p_away: 15 });
  });
  it("refuses a malformed claim before the database", async () => {
    rpc.mockClear();
    for (const b of [{ ticket: "x", points: [21, 0] }, { ticket: TICKET, points: [21] }, { ticket: TICKET, points: [21.5, 0] }, { ticket: TICKET, points: [200, 0] }, null]) expect((await post(b)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("someone else's ticket is a 404", async () => {
    rpc.mockResolvedValueOnce({ data: null as never, error: { message: "not_found" } });
    expect((await post({ ticket: TICKET, points: [21, 0] })).status).toBe(404);
  });
});
