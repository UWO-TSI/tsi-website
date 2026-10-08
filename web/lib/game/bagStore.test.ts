import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The bag's store on a server error (UI audit 2026-10 item 2): an error the sheet can say, not a forever "Opening…". */
const answer = (status: number, body: unknown = null) => vi.fn(async () => new Response(body === null ? "" : JSON.stringify(body), { status }));
const BAG = { items: [], capacity: 20, used: 0, chest: [], chest_capacity: 200, chest_used: 0, museum: {} };

describe("loadBag", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([500, 502, 429])("a %i leaves no bag and says so", async status => {
    vi.stubGlobal("fetch", answer(status, { ok: false }));
    const { loadBag, readBag } = await import("./bagStore");
    await loadBag();
    expect(readBag().view).toBeNull();
    expect(readBag().error).toBe(true);
  });

  it("trying again after an error clears it and shows the bag", async () => {
    vi.stubGlobal("fetch", answer(500));
    const { loadBag, readBag } = await import("./bagStore");
    await loadBag();
    expect(readBag().error).toBe(true);
    vi.stubGlobal("fetch", answer(200, { ok: true, bag: BAG }));
    const again = loadBag();
    expect(readBag().error).toBe(false); // back to "Opening…" while it asks
    await again;
    expect(readBag().view).toEqual(BAG);
  });

  it("signed out (401) is this browser's record, not an error", async () => {
    vi.stubGlobal("fetch", answer(401));
    const { loadBag, readBag } = await import("./bagStore");
    await loadBag();
    expect(readBag()).toMatchObject({ local: true, error: false });
  });

  it("an error after the bag has loaded keeps the bag on screen", async () => {
    vi.stubGlobal("fetch", answer(200, { ok: true, bag: BAG }));
    const { loadBag, readBag } = await import("./bagStore");
    await loadBag();
    vi.stubGlobal("fetch", answer(500));
    await loadBag();
    expect(readBag().view).toEqual(BAG);
  });
});
