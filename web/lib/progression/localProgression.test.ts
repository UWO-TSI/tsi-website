import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { collect, localRecord, spendCollected } from "@/lib/game/collections";
import { localAdvance, localState, resetLocalProgression } from "./localProgression";
import { advance, fetchState } from "./client";

const first = (s: Awaited<ReturnType<typeof localState>>) => s.chapters.find(c => c.requirement === "first_find")!;

describe("the main quest with no server (dev and tests: Supabase blanked, signed out)", () => {
  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => kept.set(k, v), removeItem: (k: string) => kept.delete(k) });
    vi.stubGlobal("window", new EventTarget());
    resetLocalProgression(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NODE_ENV", "development");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("ticks the first catch from this browser's record, and Juno takes it (the chapter completes)", async () => {
    expect(first(await localState()).steps.find(s => s.key === "first_catch")?.done).toBe(false);
    await expect(localAdvance(first(await localState()).slug, "donate_catch")).rejects.toThrow(/Catch a fish first/);
    collect("fish_carp"); localRecord("fish_carp", 31);
    const ready = first(await localState());
    expect(ready.steps.find(s => s.key === "first_catch")?.done).toBe(true);
    expect(ready.status).toBe("ready");
    const after = await localAdvance(ready.slug, "donate_catch");
    expect(after.chapters.find(c => c.slug === ready.slug)?.status).toBe("completed");
    expect(after.source).not.toBe("defaults");
  });

  it("still knows the first catch once it's sold (the record keeps what you ever caught)", async () => {
    collect("fish_carp"); localRecord("fish_carp", 31); spendCollected("fish_carp", 1);
    expect(first(await localState()).status).toBe("ready");
  });

  it("is what the client falls back to when the routes turn it away, never in production", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Sign in first." }), { status: 401 }));
    collect("fish_carp");
    const s = await fetchState();
    expect(s.source).not.toBe("defaults");
    const slug = first(s).slug;
    expect((await advance(slug, "donate_catch")).chapters.find(c => c.slug === slug)?.status).toBe("completed");
    vi.stubEnv("NODE_ENV", "production");
    expect((await fetchState()).source).toBe("defaults");
    await expect(advance(slug, "donate_catch")).rejects.toBeInstanceOf(ApiError);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    expect((await fetchState()).source).toBe("defaults");
  });
});
