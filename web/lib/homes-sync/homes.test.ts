import { describe, expect, it } from "vitest";
import { defaultLayout, withRooms, type HomeLayoutDoc } from "@/lib/homes/layout";
import { memoryHomesStore } from "./memoryStore";
import { createRemoteHomeStore } from "./remoteStore";
import { ROOM_CAP, ROOM_PRICE_COINS, validateLayout } from "./rules";
import { buyRoom, loadHome, saveHome } from "./service";

const M = "00000000-0000-4000-8000-0000000000aa";

/** fetch() that routes /api/homes* to the service over a memory store. */
function fakeServer(mem = memoryHomesStore(), member = M) {
  let down = false;
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (down) throw new TypeError("network down");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const r = url === "/api/homes" ? await loadHome(mem.store, member)
      : url === "/api/homes/layout" ? await saveHome(mem.store, member, body)
      : await buyRoom(mem.store, member, body);
    const key = url === "/api/homes" ? "home" : url === "/api/homes/layout" ? "saved" : "purchase";
    const json = r.ok ? { ok: true, [key]: r.data } : { ok: false, error: r.error, code: r.code, home: r.home };
    return new Response(JSON.stringify(json), { status: r.ok ? 200 : r.status });
  }) as unknown as typeof fetch;
  return { mem, fetchImpl, calls, setDown: (d: boolean) => (down = d) };
}
const memCache = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const withItem = (doc: HomeLayoutDoc, uid: string, cell: [number, number]): HomeLayoutDoc => ({
  ...doc,
  rooms: doc.rooms.map((r, i) => (i === 0 ? { ...r, items: [...r.items, { uid, piece: "floor-lamp", cell, rot: 0 as const }] } : r)),
});
let n = 0;
const keys = () => `key-${++n}-abcdefgh`;

describe("home save/load", () => {
  it("round-trips a layout through save and load", async () => {
    const { store } = memoryHomesStore();
    const doc = withItem({ ...defaultLayout(), outdoor: [{ uid: "o1", piece: "bench-wood", cell: [3, -4], rot: 1 }] }, "lamp-2", [5, 2]);
    expect(await saveHome(store, M, { layout: doc, base_revision: 0, save_key: "save-0001" })).toMatchObject({ ok: true, data: { revision: 1 } });
    const loaded = await loadHome(store, M);
    expect(loaded.ok && loaded.data.layout).toEqual(doc);
    expect(loaded.ok && loaded.data).toMatchObject({ revision: 1, room_price: ROOM_PRICE_COINS, room_cap: 4 });
  });
  it("replays the same save key without a new revision, and rejects stale revisions with the current doc", async () => {
    const { store } = memoryHomesStore();
    const doc = withItem(defaultLayout(), "a", [5, 2]);
    await saveHome(store, M, { layout: doc, base_revision: 0, save_key: "save-0002" });
    expect(await saveHome(store, M, { layout: doc, base_revision: 0, save_key: "save-0002" })).toMatchObject({ ok: true, data: { revision: 1, replayed: true } });
    const stale = await saveHome(store, M, { layout: defaultLayout(), base_revision: 0, save_key: "save-0003" });
    expect(stale).toMatchObject({ ok: false, status: 409, code: "revision_conflict", home: { revision: 1 } });
  });
  it("refuses overlapping, unknown or misplaced pieces and extra rooms", async () => {
    const { store } = memoryHomesStore();
    const overlap = withItem(defaultLayout(), "x", [0, 4]); // on the bed
    expect(await saveHome(store, M, { layout: overlap, base_revision: 0, save_key: "save-0004" })).toMatchObject({ ok: false, status: 422 });
    const unknown = { ...defaultLayout(), rooms: [{ ...defaultLayout().rooms[0], items: [{ uid: "u", piece: "golden-throne", cell: [1, 1], rot: 0 }] }] };
    expect(validateLayout(unknown, 1)).toMatchObject({ ok: false });
    const outside = { ...defaultLayout(), outdoor: [{ uid: "l", piece: "floor-lamp", cell: [0, 0], rot: 0 }] };
    expect(validateLayout(outside, 1)).toMatchObject({ ok: false, error: "Indoor pieces can't go outside." });
    expect(validateLayout(withRooms(defaultLayout(), 2), 1)).toMatchObject({ ok: false });
  });
});

describe("buying rooms", () => {
  it("charges the server price once per key and caps at 4 rooms", async () => {
    const mem = memoryHomesStore();
    mem.setCoins(M, 2000);
    const first = await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0001" });
    expect(first).toMatchObject({ ok: true, data: { rooms_count: 2, coins: 1500, replayed: false } });
    expect(await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0001" })).toMatchObject({ ok: true, data: { rooms_count: 2, replayed: true } });
    expect(mem.coinsOf(M)).toBe(1500);
    await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0002" });
    await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0003" });
    expect(await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0004" })).toMatchObject({ ok: false, code: "room_cap" });
    expect(mem.coinsOf(M)).toBe(500);
    const home = await loadHome(mem.store, M);
    expect(home.ok && home.data.layout.rooms.map((r) => r.id)).toEqual(["room-1", "room-2", "room-3", "room-4"]);
    expect(ROOM_CAP).toBe(4);
  });
  it("rejects a client-named price and insufficient coins without charging", async () => {
    const mem = memoryHomesStore();
    mem.setCoins(M, 499);
    expect(await buyRoom(mem.store, M, { expected_price: 1, idempotency_key: "room-0005" })).toMatchObject({ ok: false, code: "price_changed" });
    expect(await buyRoom(mem.store, M, { expected_price: ROOM_PRICE_COINS, idempotency_key: "room-0006" })).toMatchObject({ ok: false, code: "insufficient" });
    expect(mem.coinsOf(M)).toBe(499);
  });
});

describe("remote store adapter", () => {
  it("saves edits and a fresh device loads them", async () => {
    const server = fakeServer();
    const a = createRemoteHomeStore({ cache: memCache, fetchImpl: server.fetchImpl, debounceMs: 0, newKey: keys });
    await a.hydrate();
    a.set(withItem(a.getSnapshot(), "lamp-9", [5, 2]));
    await a.flush();
    expect(a.getStatus()).toBe("saved");
    const b = createRemoteHomeStore({ cache: memCache, fetchImpl: server.fetchImpl, newKey: keys });
    await b.hydrate();
    expect(b.getSnapshot()).toEqual(a.getSnapshot());
    expect(b.getRevision()).toBe(1);
  });
  it("retries an offline save with the same key and saves once", async () => {
    const server = fakeServer();
    const a = createRemoteHomeStore({ cache: memCache, fetchImpl: server.fetchImpl, debounceMs: 0, newKey: keys });
    await a.hydrate();
    server.setDown(true);
    a.set(withItem(a.getSnapshot(), "lamp-3", [5, 2]));
    await a.flush();
    expect(a.getStatus()).toBe("offline");
    server.setDown(false);
    await a.flush();
    expect(a.getStatus()).toBe("saved");
    expect(a.getRevision()).toBe(1);
  });
  it("adopts the server copy on conflict and after buying a room", async () => {
    const server = fakeServer();
    server.mem.setCoins(M, 600);
    const a = createRemoteHomeStore({ cache: memCache, fetchImpl: server.fetchImpl, debounceMs: 0, newKey: keys });
    const b = createRemoteHomeStore({ cache: memCache, fetchImpl: server.fetchImpl, debounceMs: 0, newKey: keys });
    await a.hydrate();
    await b.hydrate();
    a.set(withItem(a.getSnapshot(), "from-a", [5, 2]));
    await a.flush();
    b.set(withItem(b.getSnapshot(), "from-b", [5, 3]));
    await b.flush();
    expect(b.getStatus()).toBe("conflict");
    expect(b.getSnapshot().rooms[0].items.some((i) => i.uid === "from-a")).toBe(true);
    expect(await b.buyRoom(ROOM_PRICE_COINS)).toEqual({ ok: true, coins: 100 });
    expect(b.getSnapshot().rooms).toHaveLength(2);
  });
});
