import { describe, expect, it } from "vitest";
import { apiError, must, saveProfile, settle, summarizeAnalytics } from "./load";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("portal pages never hang and never fail quietly (#24)", () => {
  it("settles a page's load: signed out, failed or ready, never stuck loading", async () => {
    expect(await settle(async () => null)).toBe("signed-out");
    expect(await settle(async () => { throw new Error("supabaseUrl is required."); })).toBe("error");
    expect(await settle(async () => must({ data: null, error: { message: "column x does not exist" } }))).toBe("error");
    expect(await settle(async () => ({ rows: [] }))).toBe("ready");
  });
  it("reads a failed route's own message, a field's error first", async () => {
    expect(await apiError(json(400, { error: "Validation failed", details: { fieldErrors: { display_name: ["Too small: expected string to have >=1 characters"] } } }), "nope")).toBe("Display name: Too small: expected string to have >=1 characters");
    expect(await apiError(json(500, { error: "permission denied for table profiles" }), "nope")).toBe("permission denied for table profiles");
    expect(await apiError(new Response("<html>", { status: 502 }), "That didn’t save.")).toBe("That didn’t save.");
  });
  it("saves the profile or says why not (profile page and settings)", async () => {
    const saved = (async () => json(200, { profile: { id: "me", display_name: "Maya" } })) as unknown as typeof fetch;
    expect(await saveProfile({ display_name: "Maya" }, saved)).toEqual({ ok: true, profile: { id: "me", display_name: "Maya" } });
    const refused = (async () => json(400, { error: "Validation failed", details: { fieldErrors: { display_name: ["Too small"] } } })) as unknown as typeof fetch;
    expect(await saveProfile({ display_name: "" }, refused)).toEqual({ ok: false, error: "Display name: Too small" });
    const offline = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await saveProfile({ bio: "hi" }, offline)).toMatchObject({ ok: false });
  });
  it("shows an analytics error instead of zeros when a query fails", () => {
    const ok = { data: [{ tier: 1, is_active: true, is_alumni: false, onboarding_completed: true, xp: 10, tethos_coins: 5 }], error: null };
    const empty = { data: [], error: null };
    expect(summarizeAnalytics(ok, empty, empty, empty).totalMembers).toBe(1);
    expect(() => summarizeAnalytics(ok, { data: null, error: { message: "permission denied for table bounties" } }, empty, empty)).toThrow(/bounties/);
  });
});
