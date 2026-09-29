import { afterEach, describe, expect, it, vi } from "vitest";
import { combatProgression } from "./progression";

afterEach(() => { vi.unstubAllGlobals(); });

describe("ruins gate", () => {
  it("reads the systems gate from /api/combat/progression", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, progression: { level: 12, stats: {}, family: "Warden", subclass: { key: "druid" }, loadout: ["druid.rootbind"], weapons: [] }, gate: { level: 12, family: "Warden", subclass: "druid", gateOpen: true, reason: null } }))));
    const g = await combatProgression();
    expect(g).toMatchObject({ gateOpen: true, subclass: "druid", view: { loadout: ["druid.rootbind"] } });
  });
  it("stays sealed when signed out or the route fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 })));
    expect(await combatProgression()).toMatchObject({ gateOpen: false, reason: "Sealed. Sign in to enter the ruins." });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await combatProgression()).gateOpen).toBe(false);
  });
});
