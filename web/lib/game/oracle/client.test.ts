import { afterEach, describe, expect, it, vi } from "vitest";
import { OracleError, answerBatch, finishReading, oracleStatus, startReading } from "./client";
import { keeperReaction } from "./family";

const route = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
afterEach(() => { vi.unstubAllGlobals(); });

describe("oracle client", () => {
  it("unwraps each route's payload key", async () => {
    vi.stubGlobal("fetch", route(200, { ok: true, reading: { attempt_id: "a", items: [], answered: {}, total: 64, fee_paid: 0, resumed: false } }));
    expect((await startReading()).total).toBe(64);
    vi.stubGlobal("fetch", route(200, { ok: true, progress: { answered: 10, total: 64, keeper_beat: 1 } }));
    expect(await answerBatch("a", [{ item_id: "ei01", value: 2 }])).toEqual({ answered: 10, total: 64, keeper_beat: 1 });
    vi.stubGlobal("fetch", route(200, { ok: true, result: { status: "done", family: "Warden", type: "ENFP" } }));
    expect(await finishReading("a")).toMatchObject({ status: "done", family: "Warden" });
  });
  it("turns sign-in and cooldown refusals into keeper-friendly errors", async () => {
    vi.stubGlobal("fetch", route(401, { ok: false, error: "Unauthorized" }));
    await expect(oracleStatus()).rejects.toThrow("Sign in to consult the Oracle.");
    vi.stubGlobal("fetch", route(409, { ok: false, error: "The crystal needs rest.", until: "2026-10-01T12:00:00Z" }));
    await expect(startReading()).rejects.toBeInstanceOf(OracleError);
    await expect(startReading()).rejects.toThrow(/crystal needs rest\. Come back/);
  });
  it("maps the route's keeper beat to a line", () => {
    expect(keeperReaction(null)).toBeNull();
    expect(keeperReaction(1)).toMatch(/no wrong answers/);
    expect(keeperReaction(40)).toMatch(/Last few/);
  });
});
