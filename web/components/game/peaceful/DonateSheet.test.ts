import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { donate, recordCatch } from "@/lib/collections/service";
import { postDonation } from "./DonateSheet";

/** Routes the sheet's POST through the real donation service, answering the way the route does. */
function routeTo(m: ReturnType<typeof memoryCollectionsStore>, member: string) {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const r = await donate(m.store, member, body.species_key, body.idempotency_key);
    return new Response(JSON.stringify(r.ok ? { ok: true, donation: r.data } : { ok: false, error: r.error, code: r.code }), { status: r.ok ? 200 : r.status });
  });
}

describe("donation sheet", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("thanks the first donor and refuses a duplicate with the curator's line", async () => {
    const m = memoryCollectionsStore();
    m.name("a", "Maya Chen");
    await recordCatch(m.store, "a", "fish_dace", 12);
    await recordCatch(m.store, "b", "fish_dace", 15);
    routeTo(m, "a");
    const first = await postDonation("fish_dace", "Dace");
    expect(first).toContain("Dace");
    expect(first).not.toMatch(/already/i);
    routeTo(m, "b");
    expect(await postDonation("fish_dace", "Dace")).toMatch(/already have one/i);
    expect(m.countOf("b", "fish_dace")).toBe(1);
  });
  it("treats the donor's retry as the same donation, not a duplicate", async () => {
    const m = memoryCollectionsStore();
    await recordCatch(m.store, "a", "fish_dace", 12);
    await recordCatch(m.store, "a", "fish_dace", 13);
    routeTo(m, "a");
    vi.useFakeTimers({ toFake: ["Date"] });
    await postDonation("fish_dace", "Dace");
    vi.setSystemTime(Date.now() + 30_000);  // the member retries after a timeout
    const retry = await postDonation("fish_dace", "Dace");
    expect(retry).toContain("Dace");
    expect(retry).not.toMatch(/already/i);
    expect(m.countOf("a", "fish_dace")).toBe(1);
  });
  it("falls back to a gentle line when the museum is unreachable", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    expect(await postDonation("fish_dace", "Dace")).toMatch(/couldn't take that/);
  });
});
