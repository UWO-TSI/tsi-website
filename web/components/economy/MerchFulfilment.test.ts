import { describe, expect, it } from "vitest";
import type { Reservation } from "@/lib/wallet/store";
import { closedLabel } from "./MerchFulfilment";

const r = (extra: Partial<Reservation>): Reservation => ({
  id: "r1", member_id: "m1", member_name: "Maya Chen", item_id: "i1", item_name: "Tote", gems: 400, status: "fulfilled", pickup_code: "K7Q2", note: null,
  created_at: "2026-09-30T15:00:00Z", resolved_at: "2026-10-03T16:00:00Z", ...extra,
});

describe("merch fulfilment (#32)", () => {
  it("shows when a handed-over or cancelled reservation was closed", () => {
    expect(closedLabel(r({}))).toBe("Closed Oct 3, 2026");
    expect(closedLabel(r({ status: "cancelled", resolved_at: "2026-10-01T03:30:00Z" }))).toBe("Closed Sep 30, 2026"); // Toronto time
    expect(closedLabel(r({ status: "reserved", resolved_at: null }))).toBeNull();
  });
});
