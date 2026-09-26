import { describe, expect, it } from "vitest";
import { memoryStore } from "./memoryStore";
import { adminCredit, advanceChapter, contribute, loadState, sendNote, syncRealActivity } from "./service";

const now = new Date("2026-09-24T12:00:00Z");
const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const offer = (key: string, amount = 100, kind: "coins" | "material" = "coins", item_key: string | null = null) => ({ goal_slug: "reopen-cafe", kind, amount, item_key, idempotency_key: key });

function setup() {
  const m = memoryStore();
  m.addMember(A, {}, 10_000);
  m.addMember(B, {}, 10_000);
  m.addMember(ADMIN, { tier: 1 });
  return m;
}

describe("contribute idempotency", () => {
  it("credits and charges a retried delivery once", async () => {
    const m = setup();
    const first = await contribute(m.store, A, offer("delivery:k1"), now);
    const retry = await contribute(m.store, A, offer("delivery:k1"), now);
    expect(first).toMatchObject({ ok: true, data: { replayed: false, credited_points: 100 } });
    expect(retry).toMatchObject({ ok: true, data: { replayed: true, credited_points: 100 } });
    expect(m.contributions).toHaveLength(1);
    expect(m.coinsOf(A)).toBe(9_900);
  });
  it("collapses concurrent retries with the same key", async () => {
    const m = setup();
    const results = await Promise.all([1, 2, 3].map(() => contribute(m.store, A, offer("delivery:race"), now)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(m.contributions).toHaveLength(1);
    expect(m.coinsOf(A)).toBe(9_900);
  });
  it("scopes keys per member", async () => {
    const m = setup();
    await contribute(m.store, A, offer("delivery:same"), now);
    await contribute(m.store, B, offer("delivery:same"), now);
    expect(m.contributions).toHaveLength(2);
  });
  it("refuses to replay a key against a different goal", async () => {
    const m = setup();
    await contribute(m.store, A, offer("delivery:k2"), now);
    const r = await contribute(m.store, A, { ...offer("delivery:k2"), goal_slug: "fund-museum" }, now);
    expect(r).toMatchObject({ ok: false, status: 409, code: "key_reused" });
  });
});

describe("contribute caps and payment", () => {
  it("stops at the delivery cap and charges only what counted", async () => {
    const m = setup();
    await contribute(m.store, A, offer("delivery:c1", 1400), now);
    const capped = await contribute(m.store, A, offer("delivery:c2", 1000), now);
    expect(capped).toMatchObject({ ok: true, data: { credited_points: 100, capped: true } });
    expect(m.coinsOf(A)).toBe(10_000 - 1500);
    const over = await contribute(m.store, A, offer("delivery:c3", 10), now);
    expect(over).toMatchObject({ ok: false, status: 409, code: "cap_reached" });
    expect(m.coinsOf(A)).toBe(8_500);
  });
  it("still credits real activity after the delivery cap, up to the member cap", async () => {
    const m = setup();
    await contribute(m.store, A, offer("delivery:d1", 1500), now);
    for (let i = 0; i < 5; i++) m.activity.push({ source: "event", ref_id: `00000000-0000-4000-8000-00000000e00${i}`, member_id: A });
    const r = await syncRealActivity(m.store, m.goals[0], now);
    // 1500 delivered + 3 × 500 events = member cap 3000; the rest are skipped.
    expect(r).toEqual({ credited: 3, skipped: 2 });
    expect((await m.store.memberTotals(m.goals[0].id, 0, A)).credited_points).toBe(3000);
  });
  it("debits materials from the collection and rejects what the member doesn't have", async () => {
    const m = setup();
    m.giveItem(A, "wood", 3);
    expect(await contribute(m.store, A, offer("delivery:w1", 5, "material", "wood"), now)).toMatchObject({ ok: false, code: "insufficient" });
    expect(m.itemsOf(A, "wood")).toBe(3);
    expect(await contribute(m.store, A, offer("delivery:w2", 2, "material", "wood"), now)).toMatchObject({ ok: true, data: { credited_points: 40 } });
    expect(m.itemsOf(A, "wood")).toBe(1);
  });
  it("rejects kinds the goal doesn't take", async () => {
    const m = setup();
    const r = await contribute(m.store, A, { goal_slug: "reopen-cafe", kind: "specimen", amount: 1, item_key: "fish_dace", idempotency_key: "delivery:s1" }, now);
    expect(r).toMatchObject({ ok: false, status: 422 });
  });
});

describe("goal completion", () => {
  it("completes once, letters every member once, then closes to deliveries", async () => {
    const m = setup();
    m.goals[0].target_points = 150;
    await contribute(m.store, A, offer("delivery:g1", 100), now);
    const last = await contribute(m.store, B, offer("delivery:g2", 100), now);
    expect(last).toMatchObject({ ok: true, data: { completed_now: true, goal: { completed: true, percent: 100, stage: 4 } } });
    expect(m.letters.filter((l) => l.kind === "system")).toHaveLength(3);
    expect(await contribute(m.store, A, offer("delivery:g3", 10), now)).toMatchObject({ ok: false, code: "completed" });
    await adminCredit(m.store, ADMIN, { goal_slug: "reopen-cafe", member_id: A, points: 10, note: null, idempotency_key: "admin:x1" }, now);
    expect(m.letters.filter((l) => l.kind === "system")).toHaveLength(3);
  });
});

describe("story goal order", () => {
  it("keeps the museum closed until the cafe completes", async () => {
    const m = setup();
    m.giveItem(A, "fish_dace", 2);
    const museum = { goal_slug: "fund-museum", kind: "specimen" as const, amount: 1, item_key: "fish_dace", idempotency_key: "delivery:m1" };
    expect(await contribute(m.store, A, museum, now)).toMatchObject({ ok: false, code: "locked" });
    m.activity.push({ source: "event", ref_id: "00000000-0000-4000-8000-0000000e0009", member_id: A });
    expect(await syncRealActivity(m.store, m.goals[1], now)).toEqual({ credited: 0, skipped: 0 });
    m.goals[0].target_points = 50;
    await contribute(m.store, A, offer("delivery:m2", 50), now);
    expect(await contribute(m.store, A, { ...museum, idempotency_key: "delivery:m3" }, now)).toMatchObject({ ok: true, data: { credited_points: 100 } });
    expect(m.itemsOf(A, "fish_dace")).toBe(1);
  });
  it("rejects an item delivered as the wrong kind", async () => {
    const m = setup();
    m.giveItem(A, "fish_dace", 2);
    expect(await contribute(m.store, A, offer("delivery:k9", 1, "material", "fish_dace"), now)).toMatchObject({ ok: false, status: 400 });
    expect(m.itemsOf(A, "fish_dace")).toBe(2);
  });
});

describe("real activity sync", () => {
  it("credits check-ins and bounties once each with their weights", async () => {
    const m = setup();
    m.activity.push({ source: "event", ref_id: "00000000-0000-4000-8000-0000000e0001", member_id: A });
    m.activity.push({ source: "bounty", ref_id: "00000000-0000-4000-8000-0000000b0001", member_id: B });
    expect(await syncRealActivity(m.store, m.goals[0], now)).toEqual({ credited: 2, skipped: 0 });
    expect(await syncRealActivity(m.store, m.goals[0], now)).toEqual({ credited: 0, skipped: 0 });
    expect(await m.store.goalProgress(m.goals[0].id, 0)).toEqual({ points: 1250, contributors: 2 });
  });
});

describe("chapters through the service", () => {
  it("advances settle-in, letters on completion, and opens chapter 2", async () => {
    const m = setup();
    m.setFacts(A, { firstCatchKey: "fish_dace" });
    expect(await advanceChapter(m.store, A, { chapter_slug: "settle-in", action: "claim_plot" }, now)).toMatchObject({ ok: true });
    expect(await advanceChapter(m.store, A, { chapter_slug: "reopen-cafe", action: "complete" }, now)).toMatchObject({ ok: false, status: 409 });
    await advanceChapter(m.store, A, { chapter_slug: "settle-in", action: "donate_catch" }, now);
    const done = await advanceChapter(m.store, A, { chapter_slug: "settle-in", action: "report_hq" }, now);
    expect(done.ok && done.data.chapters.map((c) => c.status)).toEqual(["completed", "active", "locked", "locked"]);
    expect(done.ok && done.data.objective).toMatchObject({ chapter_slug: "reopen-cafe", anchor: "monument" });
    expect(done.ok && done.data.unread_letters).toBe(1);
  });
  it("loads state with the caller's private share", async () => {
    const m = setup();
    await contribute(m.store, A, offer("delivery:p1", 250), now);
    const s = await loadState(m.store, B, now);
    expect(s.ok && s.data.goals[0]).toMatchObject({ points: 250, my_points: 0, contributors: 1 });
  });
});

describe("chapter rewards (row 200, single wallet)", () => {
  it("pays the chapter reward once on completion and nothing for a skip", async () => {
    const m = setup();
    m.setFacts(A, { firstCatchKey: "fish_dace" });
    const before = m.coinsOf(A);
    for (const action of ["claim_plot", "donate_catch", "report_hq"] as const) await advanceChapter(m.store, A, { chapter_slug: "settle-in", action }, now);
    expect(m.coinsOf(A)).toBe(before + 100);
    expect(await m.store.creditCoins(A, 100, "chapter", "settle-in", "chapter:settle-in")).toMatchObject({ replayed: true });
    const skipBefore = m.coinsOf(B);
    await advanceChapter(m.store, B, { chapter_slug: "settle-in", action: "skip" }, now);
    expect(m.coinsOf(B)).toBe(skipBefore);
  });
});

describe("letters", () => {
  it("validates, rate-limits per day and per recipient", async () => {
    const m = setup();
    expect(await sendNote(m.store, A, { to: B, body: "   " }, now)).toMatchObject({ ok: false, status: 400 });
    expect(await sendNote(m.store, A, { to: B, body: "x".repeat(501) }, now)).toMatchObject({ ok: false, status: 400 });
    expect(await sendNote(m.store, A, { to: A, body: "hi me" }, now)).toMatchObject({ ok: false, status: 400 });
    for (let i = 0; i < 3; i++) expect(await sendNote(m.store, A, { to: B, body: `hi ${i}` }, now)).toMatchObject({ ok: true });
    expect(await sendNote(m.store, A, { to: B, body: "again" }, now)).toMatchObject({ ok: false, status: 429 });
    expect(await sendNote(m.store, A, { to: ADMIN, body: "hello" }, now)).toMatchObject({ ok: true });
  });
});
