import { describe, expect, it } from "vitest";
import { HINT_AFTER_S, HINT_AGAIN_S, TALK_R, awaitsTalk, lineSeconds, newTutorial, stepTutorial, tutorialQuest, type TutorialCue, type TutorialEvent, type TutorialState } from "./tutorial";
import { END_LINE, STOP_LINES, TASK_DONE_LINES, TRACKER, TRACKER_TITLE, fillKeys, hintLine, type HintKeys } from "./lines";
import { resolvePlace, resolveRoute, type PlaceWorld, type ResolvedStop, type TutorialRoute, type XZ } from "./route";
import { VILLAGE_ROUTE } from "./routes/village";
import { ROUTES, routeFor } from "./routes";

const KEYS: HintKeys = { move: "W A S D", jump: "Space", wheel: "Tab", bag: "B", touch: false };
/** A small world: the dock at the origin facing +z, four fronts and a beach. */
const WORLD: PlaceWorld = {
  dock: { x: 0, z: 0, yaw: 0 },
  landmark: (id, point) => {
    const at: Record<string, XZ> = { museum: { x: 20, z: 20 }, shop: { x: 20, z: 0 }, hq: { x: 0, z: 30 }, cafe: { x: -20, z: 0 }, beach: { x: -6, z: -2 } };
    const p = at[id];
    return p ? (point ? { x: p.x, z: p.z - 3 } : p) : null;
  },
};
const STOPS = resolveRoute(VILLAGE_ROUTE, WORLD, { x: 0, z: 0 });
const stopAt = (id: string) => STOPS.find(s => s.id === id)!;

/** A walk-along with Bram where the stop wants him; `frame` runs one step with the player at `at`. */
function walk() {
  const s = newTutorial(0);
  let now = 0;
  const frame = (at: XZ, events: TutorialEvent[] = [], dt = 0.1): TutorialCue[] => {
    now += dt;
    const stop = STOPS[Math.min(s.stop, STOPS.length - 1)];
    return stepTutorial(s, { now, player: at, bram: stop.stand, stops: STOPS, events });
  };
  /** Talk to Bram at the stop he's at and sit through every line (E each). */
  const talk = () => {
    const stop = STOPS[s.stop], said: TutorialCue[] = [];
    said.push(...frame(stop.stand, ["talked"]));
    for (let i = 0; i < 8 && s.stage === "talk"; i++) said.push(...frame(stop.stand, ["talked"]));
    return said;
  };
  return { s, frame, talk, now: () => now, wait: (secs: number) => { now += secs; } };
}
const said = (cues: TutorialCue[]) => cues.filter(c => c.kind === "say").map(c => (c as { line: string }).line);
const at = (s: TutorialState) => `${STOPS[s.stop]?.id ?? "end"}:${s.stage}`;

describe("the walk-along v2's route (data per world)", () => {
  it("is the stops David wrote, in order: the dock and its crate, four fronts, the beach (the rod, a catch), what you've collected", () => {
    expect(VILLAGE_ROUTE.stops.map(s => s.id)).toEqual(["dock", "museum", "shop", "hq", "cafe", "beach", "collection"]);
    expect(VILLAGE_ROUTE.stops.map(s => s.task?.kind ?? null)).toEqual(["reach", null, null, null, null, "catch", "bag"]);
    expect(VILLAGE_ROUTE.stops.find(s => s.gives)?.id).toBe("beach");
    // The dock's movement bit stays: a crate on the pier, and the dock's task is getting past it after Bram's hop.
    expect(VILLAGE_ROUTE.crates.length).toBeGreaterThan(0);
    const dock = VILLAGE_ROUTE.stops[0].task!;
    expect(dock.kind === "reach" && dock.wait?.some(w => w.hop)).toBe(true);
    expect(ROUTES.village).toBe(VILLAGE_ROUTE);
    expect(routeFor("nowhere")).toBe(VILLAGE_ROUTE);
  });

  it("has every stop's lines and tracker labels, so a new map's route needs no code", () => {
    for (const r of Object.values(ROUTES)) for (const stop of r.stops) {
      expect(STOP_LINES[stop.id]?.length, stop.id).toBeGreaterThan(0);
      expect(TRACKER[stop.id], stop.id).toBeTruthy();
      if (stop.task) expect(TRACKER[stop.task.id], stop.task.id).toBeTruthy();
    }
  });

  it("resolves places in the dock's frame, at landmarks with offsets, and in the world", () => {
    const w: PlaceWorld = { ...WORLD, dock: { x: 8, z: -19.5, yaw: Math.PI / 2 } };
    const d = resolvePlace({ dock: [1, 0] }, w)!;
    expect([d.x, d.z].map(v => +v.toFixed(6))).toEqual([8, -20.5]);   // the dock's +x turned a quarter
    expect(resolvePlace({ landmark: "museum", point: "exit", offset: [1, 2] }, w)).toEqual({ x: 21, z: 19 });
    expect(resolvePlace({ landmark: "museum" }, w)).toEqual({ x: 20, z: 20 });
    expect(resolvePlace({ world: [3, 4] }, w)).toEqual({ x: 3, z: 4 });
    expect(resolvePlace({ landmark: "oracle" }, w)).toBeNull();
  });

  it("moves to another world as data only: the same stops at new places resolve and walk", () => {
    const moved: TutorialRoute = { ...VILLAGE_ROUTE, world: "v2", crates: [{ at: { world: [40, 40] } }, { at: { world: [42, 41] }, yaw: 0.4 }],
      stops: VILLAGE_ROUTE.stops.map((s, i) => ({ ...s, stand: { world: [i * 10, 5] }, via: undefined })) };
    const stops = resolveRoute(moved, { dock: null, landmark: () => null }, { x: 0, z: 0 });
    expect(stops.map(s => s.stand)).toEqual(VILLAGE_ROUTE.stops.map((_, i) => ({ x: i * 10, z: 5 })));
    // A dock-frame place in a world without a wharf falls back to the place before it, never undefined.
    expect(stops[0].task?.kind === "reach" && stops[0].task.at).toEqual({ x: 0, z: 5 });
  });
});

describe("the walk-along v2 with Bram", () => {
  it("does not move on when you reach him: he waits with the \"!\" until you talk", () => {
    const w = walk();
    expect(at(w.s)).toBe("dock:await");
    expect(awaitsTalk(w.s)).toBe(true);
    for (let i = 0; i < 30; i++) w.frame(stopAt("dock").stand);
    expect(at(w.s)).toBe("dock:await");
    const cues = w.frame(stopAt("dock").stand, ["talked"]);
    expect(said(cues)).toEqual([STOP_LINES.dock[0]]);
    expect(at(w.s)).toBe("dock:talk");
    expect(awaitsTalk(w.s)).toBe(false);
  });

  it("says a stop's lines one at a time, each for its time or until E, then walks on", () => {
    const w = walk();
    w.frame(stopAt("dock").stand, ["talked"]);
    expect(w.frame(stopAt("dock").stand)).toEqual([]);                       // the first line still up
    w.wait(lineSeconds(STOP_LINES.dock[0]));
    expect(said(w.frame(stopAt("dock").stand))).toEqual([STOP_LINES.dock[1]]); // its time ran out
    w.frame(stopAt("dock").stand, ["talked"]);                                // E: past the last line
    expect(at(w.s)).toBe("dock:task");
  });

  it("keeps the dock's movement bit: you hop the crate after him to get on", () => {
    const w = walk();
    w.talk();
    expect(at(w.s)).toBe("dock:task");
    const task = stopAt("dock").task!;
    if (task.kind !== "reach") throw new Error("the dock's task is a reach");
    // Before the crate, a stall hints the hop.
    w.frame({ x: 0, z: -1.6 });
    w.wait(HINT_AFTER_S + 0.1);
    const stall = w.frame({ x: 0, z: -1.6 }).find(c => c.kind === "hint");
    expect(hintLine(stall as Extract<TutorialCue, { kind: "hint" }>, KEYS)).toBe("Space to hop over.");
    const over = w.frame(task.at);
    expect(said(over)).toEqual([TASK_DONE_LINES.crate]);
    expect(at(w.s)).toBe("museum:await");
  });

  it("walks the four fronts in order, a talk at each; walking past one isn't talking to it", () => {
    const w = walk();
    w.talk(); w.frame((stopAt("dock").task as { at: XZ }).at);
    expect(at(w.s)).toBe("museum:await");
    w.frame(stopAt("shop").stand);
    w.frame(stopAt("museum").stand);
    expect(at(w.s)).toBe("museum:await");
    const lines: string[] = [];
    for (const id of ["museum", "shop", "hq", "cafe"]) { expect(at(w.s)).toBe(`${id}:await`); lines.push(...said(w.talk())); }
    expect(lines).toEqual([...STOP_LINES.museum, ...STOP_LINES.shop, ...STOP_LINES.hq, ...STOP_LINES.cafe]);
    expect(at(w.s)).toBe("beach:await");
  });

  it("hands over the rod at the beach (and only there) with the Tab glyph, then waits for a catch", () => {
    const w = walk();
    w.talk(); w.frame((stopAt("dock").task as { at: XZ }).at);
    for (let i = 0; i < 4; i++) w.talk();
    expect(w.s.given.rod).toBe(false);
    const beach = w.talk();
    expect(said(beach)).toEqual([...STOP_LINES.beach]);
    expect(beach.filter(c => c.kind === "give" || c.kind === "glyph")).toEqual([{ kind: "give", item: "rod" }, { kind: "glyph", glyph: "wheel" }]);
    expect(w.s.given.rod).toBe(true);
    expect(at(w.s)).toBe("beach:task");
    // Hints by what you hold: the rod first, then the cast.
    w.wait(HINT_AFTER_S + 0.1);
    const noRod = w.frame(stopAt("beach").stand).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>;
    expect(hintLine(noRod, KEYS)).toContain("Tab");
    w.frame(stopAt("beach").stand, ["rodHeld"]);
    w.wait(HINT_AFTER_S + 0.1);
    const rod = w.frame(stopAt("beach").stand).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>;
    expect(rod.hint).toBe("cast");
    const caught = w.frame(stopAt("beach").stand, ["caught"]);
    expect(said(caught)).toEqual([TASK_DONE_LINES.catch]);
    expect(at(w.s)).toBe("collection:await");
  });

  it("then points you at B, the fish market, the museum and the shop; opening your collection ends it with the reward", () => {
    const w = walk();
    w.talk(); w.frame((stopAt("dock").task as { at: XZ }).at);
    for (let i = 0; i < 5; i++) w.talk();
    w.frame(stopAt("beach").stand, ["caught"]);
    const talk = w.talk();
    const lines = said(talk).map(l => fillKeys(l, KEYS)).join(" ");
    expect(lines).toContain("Press B to see what you've collected");
    expect(lines).toMatch(/fish market, the shack on the wharf/);
    expect(lines).toMatch(/museum/);
    expect(lines).toMatch(/the shop/);
    expect(talk.filter(c => c.kind === "glyph")).toEqual([{ kind: "glyph", glyph: "bag" }]);
    expect(at(w.s)).toBe("collection:task");
    w.wait(HINT_AFTER_S + 0.1);
    expect(hintLine(w.frame(stopAt("collection").stand).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>, KEYS)).toBe("Press B to see what you've collected.");
    const end = w.frame(stopAt("collection").stand, ["bagOpened"]);
    expect(end.map(c => c.kind)).toEqual(["say", "reward", "done"]);
    expect(said(end)).toEqual([END_LINE]);
    expect(w.s.done).toBe(true);
    expect(awaitsTalk(w.s)).toBe(false);
    expect(w.frame(stopAt("collection").stand, ["talked", "caught"])).toEqual([]);
  });

  it("hints when you stall: come over, then talk once you're by him; again after twenty seconds, not while you come closer", () => {
    const w = walk();
    const far = { x: 30, z: -30 };
    w.frame(far);
    w.wait(HINT_AFTER_S - 0.5);
    expect(w.frame(far).some(c => c.kind === "hint")).toBe(false);
    w.wait(0.6);
    expect(w.frame(far).find(c => c.kind === "hint")).toEqual({ kind: "hint", hint: "follow" });
    w.wait(5);
    expect(w.frame(far).some(c => c.kind === "hint")).toBe(false);
    w.wait(HINT_AGAIN_S - 5);
    expect(w.frame(far).some(c => c.kind === "hint")).toBe(true);
    // Coming closer is progress; by him and not talking, the hint is to talk.
    const by = { x: stopAt("dock").stand.x + TALK_R * 0.5, z: stopAt("dock").stand.z };
    w.frame(by);
    w.wait(HINT_AFTER_S - 1);
    expect(w.frame(by).some(c => c.kind === "hint")).toBe(false);
    w.wait(1.2);
    const talk = w.frame(by).find(c => c.kind === "hint") as Extract<TutorialCue, { kind: "hint" }>;
    expect(talk.hint).toBe("talk");
    expect(hintLine(talk, KEYS)).toBe("Press E when you're ready.");
  });

  it("words the hints for touch screens without keys", () => {
    const touch: HintKeys = { ...KEYS, touch: true };
    for (const hint of ["follow", "talk", "jump", "rod", "cast", "bag"] as const) {
      const line = hintLine({ kind: "hint", hint }, touch);
      expect(line, hint).not.toMatch(/W A S D|Space|Tab|Press B|Click/);
    }
    expect(fillKeys(STOP_LINES.collection[1], touch)).not.toContain("{bag}");
    expect(fillKeys(TRACKER.bag, touch)).not.toContain("{bag}");
  });
});

describe("the walk-along in the quest tracker", () => {
  it("lists a step per stop and per task, ticking off as you go, the labels filled with your keys", () => {
    const w = walk();
    const q0 = tutorialQuest(STOPS, w.s, t => fillKeys(t, KEYS));
    expect(q0.title).toBe(TRACKER_TITLE);
    expect(q0.kind).toBe("tutorial");
    expect(q0.steps.map(s => s.id)).toEqual(["dock", "crate", "museum", "shop", "hq", "cafe", "beach", "catch", "collection", "bag"]);
    expect(q0.steps.every(s => !s.done)).toBe(true);
    expect(q0.steps.at(-1)!.label).toBe("Look at your collection (B)");
    w.talk();
    expect(tutorialQuest(STOPS, w.s).steps.filter(s => s.done).map(s => s.id)).toEqual(["dock"]);
    w.frame((stopAt("dock").task as { at: XZ }).at);
    expect(tutorialQuest(STOPS, w.s).steps.filter(s => s.done).map(s => s.id)).toEqual(["dock", "crate"]);
    for (let i = 0; i < 5; i++) w.talk();
    w.frame(stopAt("beach").stand, ["caught"]);
    w.talk();
    w.frame(stopAt("collection").stand, ["bagOpened"]);
    expect(tutorialQuest(STOPS, w.s).steps.every(s => s.done)).toBe(true);
  });
  it("shows nothing done before the walk begins", () => {
    expect(tutorialQuest(STOPS, null).steps.some(s => s.done)).toBe(false);
  });
});

/** The resolved route the tests walk, sanity: every stop placed. */
it("resolves the village route in a world that has its places", () => {
  expect(STOPS.every((s: ResolvedStop) => Number.isFinite(s.stand.x) && Number.isFinite(s.stand.z))).toBe(true);
});
