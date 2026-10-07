import { describe, expect, it } from "vitest";
import { memoryIdentityStore } from "./memoryStore";
import { checkName, nameKey } from "./names";
import { actionForKey, DEFAULT_SETTINGS, mergeSettings } from "./settings";
import { badgeFor, checkWorldName, me, moderate, setWorldName, updateSettings } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const now = new Date("2026-09-24T16:00:00Z");

describe("name filter", () => {
  it.each([
    ["Maya Chen", true],
    ["  maya   chen ", true],
    ["Zoë", true],
    ["李小龙", true],
    ["O'Brien", true],
    ["Jo", false],
    ["ThisNameIsWayTooLong", false],
    ["-dash", false],
    ["two  spaces", true], // repeated spaces collapse
    ["a__b", false],
    ["<script>", false],
    ["emoji 🎣", false],
    ["Admin", false],
    ["TSI Official", false],
    ["Keeper", false],
    ["shit head", false],
    ["sh1thead", false],
    ["xXfuckXx", false],
    ["Fvck3r", false],
    ["Phuck Off", false],
    ["Dickens", true],
    ["Cassandra", true],
    ["Fukuda", true],
  ])("%s → %s", (raw, ok) => {
    expect(checkName(raw).ok).toBe(ok);
  });
  it("folds case, spacing, separators and look-alike digits into one key", () => {
    expect(new Set(["Maya Chen", "maya_chen", "MAYA-CH3N", "maya.chen", "Maya  Chen"].map(nameKey)).size).toBe(1);
    expect(nameKey("Leo")).not.toBe(nameKey("Lee"));
  });
});

describe("uniqueness and change limit", () => {
  it("rejects a taken name case- and look-alike-insensitively", async () => {
    const m = memoryIdentityStore(() => now);
    expect(await setWorldName(m.store, A, "Maya Chen", now)).toMatchObject({ ok: true, data: { world_name: "Maya Chen" } });
    expect(await checkWorldName(m.store, B, "maya_ch3n")).toMatchObject({ ok: true, data: { available: false } });
    expect(await checkWorldName(m.store, A, "MAYA CHEN")).toMatchObject({ ok: true, data: { available: true } });
    expect(await setWorldName(m.store, B, "MAYA-CHEN", now)).toMatchObject({ ok: false, code: "name_taken" });
  });
  it("lets the first name be set freely, then one change per 30 days; re-saving is a no-op", async () => {
    const m = memoryIdentityStore(() => now);
    await setWorldName(m.store, A, "Maya", now);
    expect(await setWorldName(m.store, A, "Maya", now)).toMatchObject({ ok: true });
    expect(await setWorldName(m.store, A, "Maya C", new Date(now.getTime() + 86_400_000))).toMatchObject({ ok: false, code: "too_soon" });
    const later = new Date(now.getTime() + 31 * 86_400_000);
    const m2 = memoryIdentityStore(() => later);
    await m2.store.setName(A, "Maya", "maya", A, 30);
    expect((await m.store.identity(A)).name_changes).toBe(0);
  });
  it("lets T1/T2 reset a name and mute; others can't", async () => {
    const m = memoryIdentityStore(() => now);
    m.setProfile(ADMIN, { tier: 1 });
    await setWorldName(m.store, A, "Rude Name", now);
    expect(await moderate(m.store, B, 4, A, "reset_name", now)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await moderate(m.store, ADMIN, 1, A, "reset_name", now)).toMatchObject({ ok: true });
    expect((await m.store.identity(A)).world_name).toMatch(/^Islander [0-9a-f]{6}$/);
    await moderate(m.store, ADMIN, 1, A, "mute", now);
    expect((await m.store.identity(A)).muted_until).toBe(new Date(now.getTime() + 7 * 86_400_000).toISOString());
  });
});

describe("member badge (row 223)", () => {
  it("shows for active members, not public accounts", async () => {
    expect(badgeFor({ membership: "member", is_active: true })).toBe("member");
    expect(badgeFor({ membership: "public", is_active: true })).toBeNull();
    expect(badgeFor({ membership: "member", is_active: false })).toBeNull();
    const m = memoryIdentityStore(() => now);
    m.setProfile(B, { membership: "public" });
    expect(await me(m.store, B)).toMatchObject({ ok: true, data: { badge: null } });
  });
});

describe("account settings (row 220)", () => {
  it("merges text size, contrast and menu keys; rejects reserved, unknown and duplicate keys", async () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { text_size: "xl", high_contrast: true })).toMatchObject({ ok: true, settings: { text_size: "xl", high_contrast: true } });
    expect(mergeSettings(DEFAULT_SETTINGS, { text_size: "huge" })).toMatchObject({ ok: false });
    expect(mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openJournal: "Escape" } })).toMatchObject({ ok: false, error: "escape is reserved." });
    expect(mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openJournal: "W" } })).toMatchObject({ ok: false });
    expect(mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openJournal: "i" } })).toMatchObject({ ok: false, error: "i is bound twice." });
    expect(mergeSettings(DEFAULT_SETTINGS, { key_bindings: { teleport: "t" } })).toMatchObject({ ok: false });
    const swapped = mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openJournal: "i", openBag: "n" } });
    expect(swapped.ok && actionForKey(swapped.settings, "I")).toBe("openJournal");
    // The fixed game keys (interact, zoom, quests, decorate, emotes, put away) are never menu keys.
    for (const key of ["e", "z", "j", "f", "g", "x"]) expect(mergeSettings(DEFAULT_SETTINGS, { key_bindings: { openMap: key } })).toMatchObject({ ok: false });
    const m = memoryIdentityStore(() => now);
    expect(await updateSettings(m.store, A, { text_size: "large" })).toMatchObject({ ok: true });
    expect(await updateSettings(m.store, A, { key_bindings: { openMap: "f5" } })).toMatchObject({ ok: true, data: { text_size: "large", key_bindings: { openMap: "f5" } } });
  });
});
