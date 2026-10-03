/**
 * The backpack and the home storage chest (specs/game-ui.md milestone 2): locks, drops and the chest's moves, each
 * server-side and once per key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { ROSTER } from "@/lib/collections/roster";
import { donate } from "@/lib/collections/service";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));

import { GET, POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
let m: ReturnType<typeof memoryCollectionsStore>;
const as = (userId: string) => (mock.ctx = { userId, tier: 4, now: new Date(), db: null, store: m.store });
const post = async (body: unknown) => {
  const res = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const view = async () => (await (await GET()).json()).bag;
const FISH19 = ROSTER.filter((s) => s.category === "fish").slice(0, 19).map((s) => s.key);
const fill = () => { m.give(A, "wood_branch", 29); FISH19.forEach((k) => m.give(A, k, 1)); };
let n = 0;
const key = () => `key-${String(++n).padStart(6, "0")}`;

beforeEach(() => {
  m = memoryCollectionsStore();
  as(A);
});

describe("GET /api/collections/bag", () => {
  it("shows the stacks, the bag's size and how full it is, the chest, and what the museum has", async () => {
    m.give(A, "wood_branch", 45); m.give(A, "fish_dace", 2); m.stash(A, "rock_stone", 12);
    m.give(B, "fish_salmon", 1); m.give(A, "fish_pike", 1);
    await donate(m.store, B, "fish_salmon", "donation-1");
    await donate(m.store, A, "fish_pike", "donation-2");
    const bag = await view();
    expect(bag).toMatchObject({ capacity: 20, used: 4, chest_capacity: 200, chest_used: 1, chest: [{ item_key: "rock_stone", count: 12 }], museum: { fish_salmon: "club", fish_pike: "you" } });
    expect(bag.items).toEqual(expect.arrayContaining([{ item_key: "wood_branch", count: 45, locked: false, best_size_cm: null }, expect.objectContaining({ item_key: "fish_dace", count: 2 })]));
    m.own(A, ["bag:30"]);
    expect((await view()).capacity).toBe(30);
  });

  it("passes through signed-out", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/collections/bag: lock and drop", () => {
  it("refuses to drop a locked item until it's unlocked", async () => {
    m.give(A, "rock_gold_nugget", 2);
    const locked = await post({ action: "lock", item: "rock_gold_nugget", locked: true });
    expect(locked.body.bag.items).toEqual([expect.objectContaining({ item_key: "rock_gold_nugget", locked: true })]);
    expect(await post({ action: "drop", item: "rock_gold_nugget", qty: 1, idempotency_key: key() })).toMatchObject({ status: 409, body: { code: "locked" } });
    expect(m.countOf(A, "rock_gold_nugget")).toBe(2);
    await post({ action: "lock", item: "rock_gold_nugget", locked: false });
    expect((await post({ action: "drop", item: "rock_gold_nugget", qty: 1, idempotency_key: key() })).status).toBe(200);
    expect(m.countOf(A, "rock_gold_nugget")).toBe(1);
    expect(await post({ action: "lock", item: "apple", locked: true })).toMatchObject({ status: 409, body: { code: "not_owned" } });
  });

  it("drops once per key, never more than you have", async () => {
    m.give(A, "apple", 5);
    const k = key();
    expect((await post({ action: "drop", item: "apple", qty: 2, idempotency_key: k })).status).toBe(200);
    expect((await post({ action: "drop", item: "apple", qty: 2, idempotency_key: k })).status).toBe(200);
    expect(m.countOf(A, "apple")).toBe(3);
    expect(await post({ action: "drop", item: "fish_dace", qty: 2, idempotency_key: k })).toMatchObject({ status: 409, body: { code: "key_reused" } });
    expect(await post({ action: "drop", item: "apple", qty: 4, idempotency_key: key() })).toMatchObject({ status: 409, body: { code: "insufficient_items" } });
    expect((await post({ action: "drop", item: "apple", qty: 0, idempotency_key: key() })).status).toBe(400);
    expect((await post({ action: "drop", item: "apple", qty: 1 })).status).toBe(400);
    expect(m.countOf(A, "apple")).toBe(3);
  });
});

describe("POST /api/collections/bag: the home storage chest", () => {
  it("moves a stack each way, once per key, keeping the catch's record", async () => {
    m.record(A, "wood_branch", null); m.give(A, "wood_branch", 44);
    const k = key();
    expect((await post({ action: "store", item: "wood_branch", qty: 30, idempotency_key: k })).body.bag).toMatchObject({ used: 1, chest: [{ item_key: "wood_branch", count: 30 }], chest_used: 1 });
    expect((await post({ action: "store", item: "wood_branch", qty: 30, idempotency_key: k })).status).toBe(200);
    expect([m.countOf(A, "wood_branch"), m.chestOf(A, "wood_branch")]).toEqual([15, 30]);
    expect(await post({ action: "take", item: "wood_branch", qty: 30, idempotency_key: k })).toMatchObject({ status: 409, body: { code: "key_reused" } });
    expect(await post({ action: "take", item: "wood_branch", qty: 31, idempotency_key: key() })).toMatchObject({ status: 409, body: { code: "insufficient_items" } });
    expect((await post({ action: "take", item: "wood_branch", qty: 10, idempotency_key: key() })).status).toBe(200);
    expect([m.countOf(A, "wood_branch"), m.chestOf(A, "wood_branch")]).toEqual([25, 20]);
    // A move isn't a catch: the lifetime count stays what was caught.
    expect((await m.store.memberItems(A)).find((r) => r.item_key === "wood_branch")?.total_collected).toBe(45);
  });

  it("refuses to take what the bag has no room for, and to store past the chest's size", async () => {
    fill();
    m.stash(A, "apple", 3);
    expect(await post({ action: "take", item: "apple", qty: 3, idempotency_key: key() })).toMatchObject({ status: 409, body: { code: "bag_full", error: "Your backpack is full." } });
    expect(m.chestOf(A, "apple")).toBe(3);
    expect((await post({ action: "take", item: "wood_branch", qty: 1, idempotency_key: key() })).status).toBe(409); // none in the chest
    m.stash(A, "wood_branch", 1);
    expect((await post({ action: "take", item: "wood_branch", qty: 1, idempotency_key: key() })).status).toBe(200); // tops up the partial stack
    m.stash(A, "fish_dace", 200); // two hundred slots: the chest is full
    expect(await post({ action: "store", item: FISH19[1], qty: 1, idempotency_key: key() })).toMatchObject({ status: 409, body: { code: "storage_full" } });
    expect(m.countOf(A, FISH19[1])).toBe(1);
  });

  it("lets a member over capacity make room by storing, and then pick up again", async () => {
    fill(); m.give(A, "apple", 2); m.give(A, "bug_mantis", 1); // 22 slots in a 20-slot bag
    await expect(m.store.harvest(A, "n1", "h1", "flower_rose", null, false)).rejects.toMatchObject({ code: "bag_full" });
    expect((await post({ action: "store", item: "apple", qty: 2, idempotency_key: key() })).body.bag).toMatchObject({ used: 21 });
    expect((await post({ action: "store", item: "bug_mantis", qty: 1, idempotency_key: key() })).body.bag).toMatchObject({ used: 20 });
    await m.store.harvest(A, "n1", "h1", "wood_branch", null, false); // the branches' partial stack has room again
    expect(m.countOf(A, "wood_branch")).toBe(30);
  });

  it("stores all materials (never fish, fruit or a locked favourite) in one go, once per key", async () => {
    m.give(A, "wood_branch", 40); m.give(A, "rock_stone", 7); m.give(A, "rock_gold_nugget", 1); m.give(A, "apple", 3); m.give(A, "fish_dace", 1);
    await post({ action: "lock", item: "rock_gold_nugget", locked: true });
    const k = key();
    const first = await post({ action: "store_materials", idempotency_key: k });
    expect(first.body.bag).toMatchObject({ chest: expect.arrayContaining([{ item_key: "wood_branch", count: 40 }, { item_key: "rock_stone", count: 7 }]), chest_used: 3 });
    expect(Object.fromEntries(first.body.bag.items.map((r: { item_key: string; count: number }) => [r.item_key, r.count]))).toEqual({ rock_gold_nugget: 1, apple: 3, fish_dace: 1 });
    m.give(A, "rock_clay", 2);
    expect((await post({ action: "store_materials", idempotency_key: k })).status).toBe(200);
    expect(m.countOf(A, "rock_clay")).toBe(2); // the replay moved nothing new
    // The emptied rows stay: discovery and records are kept.
    expect((await m.store.memberItems(A)).find((r) => r.item_key === "wood_branch")).toMatchObject({ count: 0, total_collected: 40 });
  });
});
