import { describe, expect, it } from "vitest";
import { HINT_AFTER_S, HINT_AGAIN_S, TUTORIAL_ORDER, newTutorial, stepTutorial, type TutorialCue, type TutorialEvent, type TutorialTargets } from "./tutorial";
import { BRAM_LINES, TUTORIAL_REWARD, hintLine, type HintKeys } from "./lines";

const START = { x: 0, z: 0 };
const T: Required<TutorialTargets> = {
  crate: { x: 0, z: 3 }, fish: { x: 0, z: 5 },
  museum: { x: 20, z: 20 }, shop: { x: 20, z: 0 }, hq: { x: 0, z: 30 }, cafe: { x: -20, z: 0 }, plaza: { x: -5, z: 15 },
};
const KEYS: HintKeys = { move: "W A S D", jump: "Space", wheel: "Tab", bag: "B", touch: false };

/** One frame of the walk: where the player is, what happened. */
function frame(s: ReturnType<typeof newTutorial>, now: number, at: { x: number; z: number }, events: TutorialEvent[] = []): TutorialCue[] {
  return stepTutorial(s, { now, player: at, targets: T, events });
}
const said = (cues: TutorialCue[]) => cues.filter(c => c.kind === "say").map(c => (c as { line: string }).line);

describe("the walk-along tutorial", () => {
  it("has exactly the approved six steps, the street's four buildings in order", () => {
    expect(TUTORIAL_ORDER).toEqual(["dock", "crate", "fish", "bag", "museum", "shop", "hq", "cafe", "plaza"]);
    expect(BRAM_LINES.dock).toBe("Easy now. Walk with me.");
    expect(BRAM_LINES.fish).toBe("Try the water.");
    expect(BRAM_LINES.bag).toBe("Keep what you find. The museum likes fish.");
    expect(BRAM_LINES.museum).toBe("Bring them what you find.");
    expect(BRAM_LINES.shop).toBe("Sell, buy, trade a story.");
    expect(BRAM_LINES.hq).toBe("Notices, mail, club news.");
    expect(BRAM_LINES.cafe).toBe("Opening soon. Rosa's still sweeping.");
    expect(BRAM_LINES.plaza).toBe("The island will show you the rest.");
  });

  it("says the dock line as it starts, and moves on once you walk", () => {
    const s = newTutorial(0, START);
    expect(said(frame(s, 0, START))).toEqual([BRAM_LINES.dock]);
    expect(frame(s, 1, START)).toEqual([]);
    frame(s, 2, { x: 0, z: 1.5 });
    expect(TUTORIAL_ORDER[s.step]).toBe("crate");
  });

  it("passes the crate only by reaching its far side", () => {
    const s = newTutorial(0, START);
    frame(s, 0, START);
    frame(s, 1, { x: 0, z: 1.5 });
    frame(s, 2, { x: 0, z: 2.4 });
    expect(TUTORIAL_ORDER[s.step]).toBe("crate");
    frame(s, 3, T.crate);
    expect(TUTORIAL_ORDER[s.step]).toBe("fish");
  });

  it("hints after about ten seconds of no progress, again after twenty, not while you move on", () => {
    const s = newTutorial(0, START);
    frame(s, 0, START);
    expect(frame(s, HINT_AFTER_S - 0.5, START).some(c => c.kind === "hint")).toBe(false);
    const first = frame(s, HINT_AFTER_S + 0.1, START).find(c => c.kind === "hint");
    expect(first).toMatchObject({ kind: "hint", step: "dock" });
    expect(hintLine(first as Extract<TutorialCue, { kind: "hint" }>, KEYS)).toBe("Use W A S D to walk.");
    expect(frame(s, HINT_AFTER_S + 5, START).some(c => c.kind === "hint")).toBe(false);
    expect(frame(s, HINT_AFTER_S + HINT_AGAIN_S + 0.2, START).some(c => c.kind === "hint")).toBe(true);
    // Walking toward the crate is progress: the clock starts again.
    const s2 = newTutorial(0, START);
    frame(s2, 0, START);
    frame(s2, 1, { x: 0, z: 1.5 });
    frame(s2, 8, { x: 0, z: 1.6 });
    frame(s2, 9, { x: 0, z: 2.5 });
    expect(frame(s2, 9 + HINT_AFTER_S - 0.5, { x: 0, z: 2.5 }).some(c => c.kind === "hint")).toBe(false);
    const crate = frame(s2, 9 + HINT_AFTER_S + 0.1, { x: 0, z: 2.5 }).find(c => c.kind === "hint");
    expect(hintLine(crate as Extract<TutorialCue, { kind: "hint" }>, KEYS)).toBe("Space to hop over.");
  });

  it("hands over the rod with the Tab glyph once, hints by what you hold, and moves on at the catch", () => {
    const s = newTutorial(0, START);
    frame(s, 0, START);
    frame(s, 1, { x: 0, z: 1.5 });
    const cues = frame(s, 2, T.crate);
    expect(said(cues)).toEqual([BRAM_LINES.fish]);
    expect(cues.filter(c => c.kind === "glyph")).toEqual([{ kind: "glyph", glyph: "wheel" }]);
    expect(frame(s, 3, T.fish).some(c => c.kind === "glyph")).toBe(false);
    const empty = frame(s, 3 + HINT_AFTER_S + 0.1, T.fish).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>;
    expect(hintLine(empty, KEYS)).toContain("Tab");
    frame(s, 20, T.fish, ["rodHeld"]);
    const rod = frame(s, 20 + HINT_AFTER_S + 0.1, T.fish).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>;
    expect(rod.rod).toBe(true);
    expect(hintLine(rod, KEYS)).not.toContain("Tab");
    const caught = frame(s, 40, T.fish, ["caught"]);
    expect(TUTORIAL_ORDER[s.step]).toBe("bag");
    expect(said(caught)).toEqual([BRAM_LINES.bag]);
    expect(caught.filter(c => c.kind === "glyph")).toEqual([{ kind: "glyph", glyph: "bag" }]);
  });

  it("walks the four buildings, a line at each front, then rewards at the plaza and ends", () => {
    const s = newTutorial(0, START);
    frame(s, 0, START);
    frame(s, 1, { x: 0, z: 1.5 });
    frame(s, 2, T.crate);
    frame(s, 3, T.fish, ["caught"]);
    expect(said(frame(s, 4, T.fish, ["bagOpened"]))).toEqual([]);
    expect(TUTORIAL_ORDER[s.step]).toBe("museum");
    // Walking past the shop first does not count: the street goes in order.
    expect(said(frame(s, 5, T.shop))).toEqual([]);
    const lines: string[] = [];
    for (const id of ["museum", "shop", "hq", "cafe"] as const) lines.push(...said(frame(s, 10, { x: T[id].x + 1, z: T[id].z })));
    expect(lines).toEqual([BRAM_LINES.museum, BRAM_LINES.shop, BRAM_LINES.hq, BRAM_LINES.cafe]);
    const end = frame(s, 20, T.plaza);
    expect(said(end)).toEqual([BRAM_LINES.plaza]);
    expect(end.map(c => c.kind)).toEqual(["say", "reward", "done"]);
    expect(s.done).toBe(true);
    expect(frame(s, 30, T.plaza)).toEqual([]);
    expect(TUTORIAL_REWARD.coins).toBeGreaterThan(0);
    expect(TUTORIAL_REWARD.coins).toBeLessThanOrEqual(50);
  });

  it("words the hints for touch screens without keys", () => {
    const touch: HintKeys = { ...KEYS, touch: true };
    expect(hintLine({ kind: "hint", step: "dock", rod: false }, touch)).not.toContain("W A S D");
    expect(hintLine({ kind: "hint", step: "crate", rod: false }, touch)).not.toContain("Space");
  });
});
