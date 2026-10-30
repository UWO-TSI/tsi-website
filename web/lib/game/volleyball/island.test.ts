import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadWorldFromDisk } from "../world/disk";
import { villageOfWorld } from "../world/village";
import { objectsOf } from "../villageMap";
import { COURT, toWorld } from "./court";
import { BOARD_ID, boardSpot, courtsOf, offCourt, onCourt } from "./island";
import { VB_SPECTATE, VB_SPECTATE_FALLBACK, heldClip, spectateStand } from "./cheapView";
import { createMatch } from "./match";
import { myWeekWins, noteCasualWin, weekKey, weeklyBoard } from "./leaderboard";

const v = villageOfWorld(loadWorldFromDisk(fileURLToPath(new URL("../../../data/world/", import.meta.url))));
const courts = courtsOf(v), c = courts[0];

describe("the court on the island", () => {
  it("the footprint is the court and its free zone; offCourt steps out over the nearer edge", () => {
    expect(onCourt(courts, c.x, c.z)).toBe(true);
    const [ex, ez] = toWorld(c, 0, COURT.halfLength + COURT.free + 1);
    expect(onCourt(courts, ex, ez)).toBe(false);
    const [ix, iz] = toWorld(c, COURT.halfWidth - 0.5, 1);
    const [ox, oz] = offCourt(courts, ix, iz);
    expect(onCourt(courts, ox, oz)).toBe(false);
    expect(Math.hypot(ox - ix, oz - iz)).toBeLessThan(COURT.free + 1.5);
    expect(offCourt(courts, ex, ez)).toEqual([ex, ez]);
  });
  it("only the net, its ball and nothing solid stand on the footprint; the bench and the board stand off it", () => {
    const on = v.objects.filter(o => onCourt(courts, o.x, o.z) && o.kind !== "anchor" && o.kind !== "landmark").map(o => o.id);
    // The tower's corner and the palms at the land side's edge were there before the court (David's layout).
    expect(on.filter(id => !/^(volleyball-net|lifeguard-tower|palm-\d+)$/.test(id!))).toEqual([]);
    const bench = objectsOf("bench", v).find(o => o.id === "volley-bench")!;
    expect(bench).toBeTruthy();
    expect(onCourt(courts, bench.x, bench.z)).toBe(false);
    expect(onCourt(courts, bench.x, bench.z, 3)).toBe(true);
    const spot = boardSpot(v)!;
    expect(objectsOf("prop", v).some(o => o.id === BOARD_ID)).toBe(true);
    expect(onCourt(courts, spot.x, spot.z)).toBe(false);
  });
});

describe("the cheap view", () => {
  it("a steady stand on your own side, facing the net", () => {
    const m = createMatch({ seed: 3 }), spot = { ...c, y: 1 };
    const s = spectateStand(m, spot)!;
    expect(onCourt(courts, s.x, s.z)).toBe(true);
    expect(spectateStand(m, spot)).toEqual(s);
    expect(spectateStand(createMatch({ seed: 3, human: false }), spot)).toBeNull();
  });
  it("vb_spectate plays where a rig has it, the marked fallback where it doesn't", () => {
    expect(heldClip(VB_SPECTATE, n => n === VB_SPECTATE || n === VB_SPECTATE_FALLBACK)).toBe(VB_SPECTATE);
    expect(heldClip(VB_SPECTATE, n => n === VB_SPECTATE_FALLBACK)).toBe(VB_SPECTATE_FALLBACK);
    expect(heldClip("Sit", n => n === "Sit")).toBe("Sit");
    expect(heldClip("Nope", () => false)).toBeNull();
    expect(heldClip("", () => true)).toBeNull();
  });
});

describe("the leaderboard (sample until phase 3)", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, val: string) => { m.set(k, val); } }; };
  it("weeks start on Monday", () => {
    expect(weekKey(new Date("2026-10-29T12:00:00Z"))).toBe("2026-10-26");
    expect(weekKey(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
  });
  it("sample rows, labelled; your wins this week join in rank order, last week's don't", () => {
    const store = mem(), now = new Date("2026-10-29T12:00:00Z");
    expect(weeklyBoard("Islander", now, store)).toMatchObject({ sample: true });
    expect(weeklyBoard("Islander", now, store).rows.some(r => r.you)).toBe(false);
    for (let i = 0; i < 8; i++) noteCasualWin(now, store);
    expect(myWeekWins(now, store)).toBe(8);
    const rows = weeklyBoard("Islander", now, store).rows;
    expect(rows.find(r => r.you)).toMatchObject({ name: "Islander", wins: 8, rank: 4 });
    expect(rows.map(r => r.rank)).toEqual(rows.map((_, i) => i + 1));
    expect(myWeekWins(new Date("2026-11-03T12:00:00Z"), store)).toBe(0);
  });
});
