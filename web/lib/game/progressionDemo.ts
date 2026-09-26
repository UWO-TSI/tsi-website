"use client";

/**
 * Dev-only `?progression=demo` for the island: the real progression service on
 * its in-memory store, so the monument, objective line and chapter-1 prompts
 * can be exercised without a signed-in account. /dev/progression?demo=1 uses
 * the same routes.
 */
import { memoryStore } from "@/lib/progression/memoryStore";
import { advanceChapter, contribute, loadState } from "@/lib/progression/service";
import { installDemoFetch, reply, type DemoHandler } from "./demoFetch";

export const DEMO_MEMBER = "00000000-0000-4000-8000-000000000001";

/** /api/progression/{state,chapters/advance,contribute} on an in-memory store. */
export function progressionRoutes(m: ReturnType<typeof memoryStore>, me = DEMO_MEMBER): DemoHandler {
  return async (path, body) => {
    if (path === "/api/progression/state") return reply(await loadState(m.store, me, new Date()), "state");
    if (path === "/api/progression/chapters/advance") return reply(await advanceChapter(m.store, me, body, new Date()), "state");
    if (path === "/api/progression/contribute") return reply(await contribute(m.store, me, { ...body, item_key: body.item_key ?? null, idempotency_key: `delivery:${body.idempotency_key}` }, new Date()), "contribution");
    return null;
  };
}

export function installIslandProgressionDemo(): void {
  installDemoFetch("progression", "/api/progression", () => {
    const m = memoryStore();
    // A new member who already has a catch in the bag (so "donate" can succeed).
    m.addMember(DEMO_MEMBER, { tier: 4, firstCatchKey: "fish_dace" }, 2400);
    return progressionRoutes(m);
  });
}
