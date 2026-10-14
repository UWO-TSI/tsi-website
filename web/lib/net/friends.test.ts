import { describe, expect, it } from "vitest";
import { FriendsStore } from "./friends";
import type { FriendsView } from "@/lib/world/friends";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", C = "33333333-3333-4333-8333-333333333333";
const view = (over: Partial<FriendsView> = {}): FriendsView => ({
  code: "ABCD2345", friends: [{ member_id: A, world_name: "Ann", since: "x" }, { member_id: B, world_name: "Bo", since: "x" }], incoming: [], outgoing: [], ...over,
});

describe("your friends on the client (v1)", () => {
  it("knows who your friends are from the list, and how many are asking", () => {
    const f = new FriendsStore();
    expect(f.isFriend(A)).toBe(false);
    f.setView(view({ incoming: [{ member_id: C, world_name: "Cy", at: "x" }] }));
    expect(f.isFriend(A) && f.isFriend(B)).toBe(true);
    expect(f.isFriend(C)).toBe(false);
    expect(f.snapshot().asking).toBe(1);
    expect(f.nameOf(B)).toBe("Bo");
  });

  it("follows who is on the island, and says who just came, never the whole list at a join", () => {
    const f = new FriendsStore();
    f.setView(view());
    f.connected();
    expect(f.setOnline([{ uid: A, shard: 1, area: 0 }])).toEqual([]); // the first list after joining: no toasts
    expect(f.presence(A)).toEqual({ uid: A, shard: 1, area: 0 });
    expect(f.setOnline([{ uid: A, shard: 1, area: 1 }, { uid: B, shard: 2, area: 0 }])).toEqual([B]);
    expect(f.presence(A)?.area).toBe(1);
    expect(f.setOnline([{ uid: B, shard: 2, area: 0 }])).toEqual([]);
    expect(f.presence(A)).toBeUndefined();
    expect(f.snapshot().online.map(o => o.uid)).toEqual([B]);
    // A new connection (a rejoin, a move to a friend's shard): its first list is quiet again.
    f.connected();
    expect(f.setOnline([{ uid: A, shard: 2, area: 0 }, { uid: B, shard: 2, area: 0 }])).toEqual([]);
  });

  it("hands React a new snapshot only on a change", () => {
    const f = new FriendsStore();
    let n = 0;
    f.subscribe(() => n++);
    const s0 = f.snapshot();
    f.connected();
    f.setOnline([]);
    expect(f.snapshot()).toBe(s0);
    f.setView(view());
    expect(f.snapshot()).not.toBe(s0);
    expect(n).toBe(1);
  });
});
