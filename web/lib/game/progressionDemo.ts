"use client";

/**
 * Dev-only `?progression=demo` for the island: the real progression service on
 * its in-memory store, so the monument, objective line and chapter-1 prompts
 * can be exercised without a signed-in account. /dev/progression?demo=1 uses
 * the same routes.
 */
import { memoryStore } from "@/lib/progression/memoryStore";
import { DEFAULT_CHAPTERS } from "@/lib/progression/defaults";
import type { FactCount } from "@/lib/progression/chapters";
import { releasedChapters } from "./drops";
import { advanceChapter, contribute, loadState } from "@/lib/progression/service";
import { installDemoFetch, reply, type DemoHandler } from "./demoFetch";

export const DEMO_MEMBER = "00000000-0000-4000-8000-000000000001";

/** /api/progression/{state,chapters/advance,contribute} and the coin wallet they spend, on an in-memory store. */
export function progressionRoutes(m: ReturnType<typeof memoryStore>, me = DEMO_MEMBER): DemoHandler {
  return async (path, body) => {
    if (path === "/api/economy/wallet") return reply({ ok: true, data: { coins: m.coinsOf(me), gems: 0, daily_claimed: true, day: "", recent: [] } }, "wallet");
    if (path === "/api/progression/state") return reply(await loadState(m.store, me, new Date()), "state");
    if (path === "/api/progression/chapters/advance") return reply(await advanceChapter(m.store, me, body, new Date()), "state");
    if (path === "/api/progression/contribute") return reply(await contribute(m.store, me, { ...body, item_key: body.item_key ?? null, idempotency_key: `delivery:${body.idempotency_key}` }, new Date()), "contribution");
    return null;
  };
}

/**
 * `?progression=demo`, and for the main quest's evidence `&chapter=<slug>` (every chapter before it done) and
 * `&tally=bugs:2,net:1` (the member's counts, lib/progression/chapters.ts FactCount).
 */
export function installIslandProgressionDemo(): void {
  installDemoFetch("progression", "/api/", (query) => {
    const m = memoryStore({ chapters: releasedChapters(DEFAULT_CHAPTERS) });
    const tally = Object.fromEntries((query.get("tally") ?? "").split(",").filter(Boolean).map(kv => { const [k, v] = kv.split(":"); return [k as FactCount, Number(v) || 0]; }));
    // A new member who already has a catch in the bag (so "donate" can succeed).
    m.addMember(DEMO_MEMBER, { tier: 4, firstCatchKey: "fish_dace", counts: { fish: 1, ...tally } }, 2400);
    const from = m.chapters.find(c => c.slug === query.get("chapter"));
    for (const c of m.chapters) if (from && c.position < from.position) void m.store.saveMemberProgress(DEMO_MEMBER, c.id, { status: "completed", steps_done: {}, donated_item_key: null }, new Date().toISOString());
    return progressionRoutes(m);
  });
}
