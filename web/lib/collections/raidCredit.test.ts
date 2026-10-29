import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { catchAction } from "./service";
import { memoryCollectionsStore } from "./memoryStore";
import { readRaidCredit } from "./raidCredit";
import { ROSTER, type Species } from "./roster";
import { FISH, type FishDef } from "@/lib/game/fishing";
import type { RaidCredit } from "@/lib/net/protocol";

const SECRET = "raid-test-secret-0123456789abcdefghij";
const OPENER = "00000000-0000-4000-8000-0000000000aa", HELPER = "00000000-0000-4000-8000-0000000000bb";
const NOW = new Date("2026-09-24T16:00:00Z");
/** The same signing as the realtime server's (realtime/src/rooms/raid.ts signCredit). */
const sign = (c: RaidCredit, secret = SECRET) => {
  const payload = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
};

// No divine species ships yet (David picks them): a stand-in for the test only.
const base = ROSTER.find((s) => s.category === "fish" && s.size)!;
const divine: Species = { ...base, key: "fish_test_divine", rarity: "divine" };
const divineFish = { ...FISH[0], key: divine.key, rarity: "divine", sizeCm: base.size! } as FishDef;
beforeAll(() => { ROSTER.push(divine); FISH.push(divineFish); vi.stubEnv("NEXT_PUBLIC_FISH_BOSSES", "1"); });
afterAll(() => { ROSTER.splice(ROSTER.indexOf(divine), 1); FISH.splice(FISH.indexOf(divineFish), 1); vi.unstubAllEnvs(); });

describe("a raid helper's credit", () => {
  it("reads only a well-signed, unexpired token", () => {
    const c: RaidCredit = { m: HELPER, f: divine.key, r: "r", o: OPENER, i: "raid1", e: NOW.getTime() + 1000 };
    expect(readRaidCredit(sign(c), SECRET, NOW.getTime())).toEqual(c);
    expect(readRaidCredit(sign(c, "another-secret-0123456789abcdefghijk"), SECRET, NOW.getTime())).toBeNull();
    expect(readRaidCredit(sign({ ...c, e: NOW.getTime() - 1 }), SECRET, NOW.getTime())).toBeNull();
    expect(readRaidCredit(sign(c), undefined, NOW.getTime())).toBeNull();
    expect(readRaidCredit("x.y", SECRET, NOW.getTime())).toBeNull();
  });

  it("records the opener's divine once per helper, never for someone else's token or a fish nobody rolled", async () => {
    const { store } = memoryCollectionsStore(() => NOW);
    const roll = await store.cast(OPENER, divine.key, 50, true);
    const credit = (m: string, over: Partial<RaidCredit> = {}) => sign({ m, f: divine.key, r: roll, o: OPENER, i: "raid1", e: NOW.getTime() + 60_000, ...over });
    const claim = (member: string, token: string) => catchAction(store, member, { action: "raid", credit: token }, NOW, async () => "clear", async () => [], Math.random, SECRET);

    const first = await claim(HELPER, credit(HELPER));
    expect(first.ok && first.data.item_key).toBe(divine.key);
    expect((await claim(HELPER, credit(HELPER))).ok).toBe(false); // once
    expect((await claim(OPENER, credit(HELPER))).ok).toBe(false); // not theirs
    expect((await claim(OPENER, credit(OPENER))).ok).toBe(true);
    const forged = await claim(HELPER, credit(HELPER, { r: "00000000-0000-4000-8000-000000000000" }));
    expect(forged.ok).toBe(false); // no such roll
    const notDivine = await claim(HELPER, credit(HELPER, { f: base.key }));
    expect(notDivine.ok).toBe(false);
  });

  it("is off without the boss fights' flag", async () => {
    vi.stubEnv("NEXT_PUBLIC_FISH_BOSSES", "");
    const { store } = memoryCollectionsStore(() => NOW);
    const roll = await store.cast(OPENER, divine.key, 50, true);
    const token = sign({ m: HELPER, f: divine.key, r: roll, o: OPENER, i: "raid1", e: NOW.getTime() + 60_000 });
    expect((await catchAction(store, HELPER, { action: "raid", credit: token }, NOW, async () => "clear", async () => [], Math.random, SECRET)).ok).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FISH_BOSSES", "1");
  });
});
