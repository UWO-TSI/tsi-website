import { describe, expect, it } from "vitest";
import { FRIEND_LIMITS, addFriend, friendsView, removeFriend, respondFriend } from "./friends";
import { memoryFriendStore } from "./friendsMemory";

const A = "00000000-0000-4000-8000-0000000000aa", B = "00000000-0000-4000-8000-0000000000bb", C = "00000000-0000-4000-8000-0000000000cc";
function setup() {
  let t = Date.parse("2026-10-20T12:00:00Z");
  const m = memoryFriendStore(() => new Date(t));
  m.member(A, "Maple"); m.member(B, "Birch"); m.member(C, null);
  return { m, store: m.store, later: (ms: number) => { t += ms; } };
}
const ok = <T,>(r: { ok: boolean; data?: T; error?: string }) => { if (!r.ok) throw new Error(`not ok: ${r.error}`); return r.data as T; };

describe("your friends (v1, specs/v1-drop.md §3)", () => {
  it("everyone gets a code on first look, kept after; the view starts empty", async () => {
    const { store } = setup();
    const v = ok(await friendsView(store, A));
    expect(v.code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(v).toMatchObject({ friends: [], incoming: [], outgoing: [] });
    expect(ok(await friendsView(store, A)).code).toBe(v.code);
    expect(ok(await friendsView(store, B)).code).not.toBe(v.code);
  });

  it("a code that's taken is made again", async () => {
    const { m, store } = setup();
    m.takeCodes(["ABCD2345", "ABCD2346"]);
    const codes = ["ABCD2345", "ABCD2346", "ZZZZ9999"];
    const v = ok(await friendsView(store, A, () => codes.shift()!));
    expect(v.code).toBe("ZZZZ9999");
  });

  it("asks by player or by code; asking back is the accept; world names only, never real ones", async () => {
    const { store } = setup();
    const bobCode = ok(await friendsView(store, B)).code;
    const r = ok(await addFriend(store, A, { code: bobCode.toLowerCase().replace(/(....)/, "$1-") }));
    expect(r.status).toBe("requested");
    expect(r.member_id).toBe(B);
    expect(r.view.outgoing).toEqual([{ member_id: B, world_name: "Birch", at: expect.any(String) }]);
    expect(ok(await friendsView(store, B)).incoming).toEqual([{ member_id: A, world_name: "Maple", at: expect.any(String) }]);
    const back = ok(await addFriend(store, B, { member_id: A }));
    expect(back.status).toBe("friends");
    expect(back.view.friends).toEqual([{ member_id: A, world_name: "Maple", since: expect.any(String) }]);
    expect(back.view.incoming).toEqual([]);
    expect(ok(await friendsView(store, A)).friends).toEqual([{ member_id: B, world_name: "Birch", since: expect.any(String) }]);
    expect(ok(await addFriend(store, A, { member_id: B })).status).toBe("already_friends");
    // No world name yet: Islander.
    ok(await addFriend(store, C, { member_id: A }));
    expect(ok(await friendsView(store, A)).incoming).toEqual([{ member_id: C, world_name: "Islander", at: expect.any(String) }]);
  });

  it("accept, decline, cancel and unfriend", async () => {
    const { store } = setup();
    ok(await addFriend(store, A, { member_id: B }));
    expect(ok(await respondFriend(store, B, A, false)).view.incoming).toEqual([]);
    expect(ok(await friendsView(store, A)).outgoing).toEqual([]);
    ok(await addFriend(store, A, { member_id: B }));
    expect(ok(await removeFriend(store, A, B)).was).toBe(false); // a cancel
    ok(await addFriend(store, A, { member_id: B }));
    const yes = ok(await respondFriend(store, B, A, true));
    expect(yes.status).toBe("friends");
    expect(yes.view.friends.map(f => f.member_id)).toEqual([A]);
    const gone = ok(await removeFriend(store, A, B));
    expect(gone.was).toBe(true);
    expect(gone.view.friends).toEqual([]);
    const late = await respondFriend(store, B, A, true);
    expect(late).toMatchObject({ ok: false, status: 404 });
  });

  it("refuses kindly: yourself, a code no one has, someone unknown, across a block (without saying so), and over the limits", async () => {
    const { m, store, later } = setup();
    const mine = ok(await friendsView(store, A)).code;
    expect(await addFriend(store, A, { code: mine })).toMatchObject({ ok: false, status: 400, error: "That's your own code." });
    expect(await addFriend(store, A, { member_id: A })).toMatchObject({ ok: false, status: 400 });
    expect(await addFriend(store, A, { code: "QQQQ2222" })).toMatchObject({ ok: false, status: 404, error: "No one has that code. Check it and try again." });
    expect(await addFriend(store, A, { code: "not a code" })).toMatchObject({ ok: false, status: 400 });
    expect(await addFriend(store, A, { member_id: "00000000-0000-4000-8000-0000000000ee" })).toMatchObject({ ok: false, status: 404 });
    m.block(B, A);
    const blocked = await addFriend(store, A, { member_id: B });
    expect(blocked).toMatchObject({ ok: false, status: 403, error: "You can't send them a request right now." });
    expect(JSON.stringify(blocked)).not.toMatch(/block/i);
    for (let i = 0; i < FRIEND_LIMITS.hourly; i++) {
      const id = `00000000-0000-4000-8000-${String(900 + i).padStart(12, "0")}`;
      m.member(id, `P${i}`);
      ok(await addFriend(store, C, { member_id: id }));
    }
    m.member("00000000-0000-4000-8000-000000000999", "Late");
    expect(await addFriend(store, C, { member_id: "00000000-0000-4000-8000-000000000999" })).toMatchObject({ ok: false, status: 429 });
    later(3_600_001);
    expect(ok(await addFriend(store, C, { member_id: "00000000-0000-4000-8000-000000000999" })).status).toBe("requested");
  });
});
