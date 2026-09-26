"use client";

/**
 * Dev-only `?progression=demo` for the island: runs the systems agent's real
 * progression service against its in-memory store (same approach as
 * /dev/progression?demo=1) and routes this page's /api/progression calls to
 * it, so the monument, objective line and chapter-1 prompts can be exercised
 * without a signed-in account. Never active in production builds.
 */
import { memoryStore } from "@/lib/progression/memoryStore";
import { advanceChapter, contribute, loadState } from "@/lib/progression/service";

const ME = "00000000-0000-4000-8000-000000000001";
let installed = false;

export function installIslandProgressionDemo(): void {
  if (installed || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("progression") !== "demo") return;
  installed = true;
  const m = memoryStore();
  // A new member who already has a catch in the bag (so "donate" can succeed).
  m.addMember(ME, { tier: 4, firstCatchKey: "fish_dace" }, 2400);
  const json = (r: { ok: boolean; status?: number; error?: string; data?: unknown }, key: string) =>
    new Response(JSON.stringify(r.ok ? { ok: true, [key]: r.data } : { ok: false, error: r.error }), { status: r.ok ? 200 : (r.status ?? 500) });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, window.location.origin).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path === "/api/progression/state") return json(await loadState(m.store, ME, new Date()), "state");
    if (path === "/api/progression/chapters/advance") return json(await advanceChapter(m.store, ME, body, new Date()), "state");
    if (path === "/api/progression/contribute") return json(await contribute(m.store, ME, { ...body, item_key: body.item_key ?? null, idempotency_key: `delivery:${body.idempotency_key}` }, new Date()), "contribution");
    return realFetch(input, init);
  };
}
