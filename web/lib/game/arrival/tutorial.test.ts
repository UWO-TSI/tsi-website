import { describe, expect, it } from "vitest";
import { BRAM_PACE, HINT_AFTER_S, HINT_AGAIN_S, TALK_R, WAIT_GAP, awaitsTalk, bramPace, lineSeconds, newTutorial, stepTutorial, tutorialQuest, type TutorialCue, type TutorialEvent, type TutorialState } from "./tutorial";
import { END_LINE, STOP_LINES, TASK_DONE_LINES, TRACKER, TRACKER_TITLE, fillKeys, hintLine, type HintKeys } from "./lines";
import { resolvePlace, resolveRoute, type PlaceWorld, type ResolvedStop, type TutorialRoute, type XZ } from "./route";
import { NEW_ROUTE } from "./routes/new";

const KEYS: HintKeys = { move: "W A S D", jump: "Space", dash: "Q", wheel: "Tab", bag: "B", touch: false };
/** A small world: the dock at the origin facing +z, four fronts and a beach. */
const WORLD: PlaceWorld = {
  dock: { x: 0, z: 0, yaw: 0 },
  landmark: (id, point) => {
    const at: Record<string, XZ> = { museum: { x: 20, z: 20 }, shop: { x: 20, z: 0 }, hq: { x: 0, z: 30 }, cafe: { x: -20, z: 0 }, beach: { x: -6, z: -2 } };
    const p = at[id];
    return p ? (point ? { x: p.x, z: p.z - 3 } : p) : null;
  },
};
/** The walk-along's mechanics on a plain fixture route (the village's old one): the dock and its crate, four fronts, the beach. */
const CRATE_Z = -0.95;
const WALK: TutorialRoute = {
  crossFrom: { x: 14, z: -46, yaw: -0.24 },
  crates: [{ at: { dock: [0, CRATE_Z] }, yaw: 0.03 }],
  stops: [
    { id: "dock", stand: { dock: [-0.5, -1.95] },
      task: { kind: "reach", id: "crate", at: { dock: [0.05, CRATE_Z + 0.62] }, radius: 0.45, hint: "jump",
        wait: [{ dock: [0.05, CRATE_Z - 0.6] }, { dock: [0.05, CRATE_Z + 0.55], hop: true }, { dock: [0.45, CRATE_Z + 1.3] }] } },
    { id: "museum", stand: { landmark: "museum", point: "exit", offset: [1.2, -0.6] } },
    { id: "shop", stand: { landmark: "shop", point: "exit", offset: [1.2, -0.6] } },
    { id: "hq", stand: { landmark: "hq", point: "exit", offset: [1.2, -0.6] } },
    { id: "cafe", stand: { landmark: "cafe", point: "exit", offset: [1.2, -0.6] } },
    { id: "beach", stand: { landmark: "beach", offset: [-1.6, 0.3] }, gives: "rod", task: { kind: "catch", id: "catch" } },
    { id: "collection", stand: { landmark: "beach", offset: [-1.6, 0.3] }, task: { kind: "bag", id: "bag" } },
  ],
};
const STOPS = resolveRoute(WALK, WORLD, { x: 0, z: 0 });
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
    expect(WALK.stops.map(s => s.id)).toEqual(["dock", "museum", "shop", "hq", "cafe", "beach", "collection"]);
    expect(WALK.stops.map(s => s.task?.kind ?? null)).toEqual(["reach", null, null, null, null, "catch", "bag"]);
    expect(WALK.stops.find(s => s.gives)?.id).toBe("beach");
    // The dock's movement bit stays: a crate on the pier, and the dock's task is getting past it after Bram's hop.
    expect(WALK.crates.length).toBeGreaterThan(0);
    const dock = WALK.stops[0].task!;
    expect(dock.kind === "reach" && dock.wait?.some(w => w.hop)).toBe(true);
  });

  it("has every stop's lines and tracker labels, so a new map's route needs no code", () => {
    for (const stop of NEW_ROUTE.stops) {
      // An `auto` stop (straight on, no E) needs no tracker step, and lines only if it talks.
      if (!stop.auto) expect(STOP_LINES[stop.id]?.length, stop.id).toBeGreaterThan(0);
      if (!stop.auto) expect(TRACKER[stop.id], stop.id).toBeTruthy();
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
    const moved: TutorialRoute = { ...WALK, crates: [{ at: { world: [40, 40] } }, { at: { world: [42, 41] }, yaw: 0.4 }],
      stops: WALK.stops.map((s, i) => ({ ...s, stand: { world: [i * 10, 5] }, via: undefined })) };
    const stops = resolveRoute(moved, { dock: null, landmark: () => null }, { x: 0, z: 0 });
    expect(stops.map(s => s.stand)).toEqual(WALK.stops.map((_, i) => ({ x: i * 10, z: 5 })));
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
it("resolves the fixture route in a world that has its places", () => {
  expect(STOPS.every((s: ResolvedStop) => Number.isFinite(s.stand.x) && Number.isFinite(s.stand.z))).toBe(true);
});

describe("Bram's pace (t-short)", () => {
  it("walks brisker with you on his heels, ambles with you a way back, waits once you've lost him", () => {
    expect(bramPace(2, false)).toBe(BRAM_PACE.brisk);
    expect(bramPace(6, false)).toBe(BRAM_PACE.walk);
    expect(bramPace(WAIT_GAP + 1, false)).toBe(0);
    expect(bramPace(5, true)).toBe(BRAM_PACE.jog);
    expect(BRAM_PACE.brisk).toBeGreaterThan(BRAM_PACE.walk);
  });
});

describe("the new world's walk (t-short, t-sell): HQ first, the camera conversation, the barrel", () => {
  const at = { x: 0, z: 0 };
  const stops: ResolvedStop[] = [
    { id: "hqFirst", stand: at, via: [], task: { kind: "hq", id: "alice" }, box: true },
    { id: "sights", stand: at, via: [], box: true, shots: [null, { x: 5, z: 5 }] },
    { id: "barrel", stand: at, via: [], task: { kind: "sell", id: "sell" }, box: true },
  ];
  const step = (s: TutorialState, now: number, events: TutorialEvent[] = []) => stepTutorial(s, { now, player: at, bram: at, stops, events, end: "bye" });
  it("one E opens the conversation with all his lines; the box closing moves it on; HQ waits for Alice's visit", () => {
    const s = newTutorial(0);
    const open = step(s, 1, ["talked"]);
    expect(open).toEqual([{ kind: "converse", lines: STOP_LINES.hqFirst, stop: "hqFirst" }]);
    // E again changes nothing while the box is up; no hints mid-talk.
    expect(step(s, 40, ["talked"])).toEqual([]);
    expect(step(s, 41, ["talkEnded"])).toEqual([{ kind: "visit" }]);
    expect(s.stage).toBe("task");
    expect(step(s, 42, ["caught", "sold"]).some(c => c.kind === "converse")).toBe(false);
    step(s, 43, ["hqDone"]);
    expect([s.stop, s.stage]).toEqual([1, "await"]);
    expect(step(s, 44, ["talked"])[0]).toMatchObject({ kind: "converse", stop: "sights" });
    step(s, 45, ["talkEnded"]);
    expect([s.stop, s.stage]).toEqual([2, "await"]);
    step(s, 46, ["talked"]); step(s, 47, ["talkEnded"]);
    // Opening the barrel isn't selling: the sale moves it on.
    expect(step(s, 48, ["talked"])).toEqual([]);
    const end = step(s, 49, ["sold"]);
    expect(end).toEqual([{ kind: "say", line: "bye", stop: "barrel" }, { kind: "reward" }, { kind: "done" }]);
  });
  it("teaches the dash straight after the box (no E; the dash is everyone's): a dash moves it on", () => {
    const far = { x: 9, z: 0 };
    const dock: ResolvedStop[] = [{ id: "dash", stand: at, via: [], auto: true, task: { kind: "dash", id: "dash" }, box: true }, stops[0]];
    const s = newTutorial(0), go = (now: number, bram: XZ, events: TutorialEvent[] = []) => stepTutorial(s, { now, player: at, bram, stops: dock, events });
    expect(go(1, far)).toEqual([]);                                    // not there yet
    expect(go(2, at)).toEqual([]);                                     // there: no lines, straight to the task
    expect(s.stage).toBe("task");
    expect(go(2 + HINT_AFTER_S, at)).toEqual([{ kind: "hint", hint: "dash" }]);
    expect(hintLine({ kind: "hint", hint: "dash" }, KEYS)).toMatch(/^Q to dash/);
    go(30, at, ["dashed"]);
    expect([s.stop, s.stage]).toEqual([1, "await"]);
  });
  it("counts a hop over the box wherever on the dock you land past it (David's playtest: a real hop didn't register)", () => {
    const stops = resolveRoute(NEW_ROUTE, { ...WORLD, prop: () => ({ x: 30, z: 30 }) }, { x: 0, z: 0 });
    const box = stops[0].task;
    if (box?.kind !== "reach" || !box.from) throw new Error("the new dock's box is a reach past it");
    // The dock faces +z here: the box at z -0.95, its far side from z -0.33 on.
    const s = newTutorial(0), go = (p: XZ) => stepTutorial(s, { now: 1, player: p, bram: stops[0].stand, stops, events: [] });
    s.stage = "task";
    go({ x: 0.05, z: -1.5 });                    // before the box
    expect(s.stop).toBe(0);
    go({ x: 0.7, z: 0.4 });                      // landed beside Bram, well off the old spot's half-metre circle
    expect([s.stop, s.stage]).toEqual([1, "await"]);
  });
  it("passes over the dock's lessons once the dock is cleared (you've been into HQ), and not before", () => {
    const dock: ResolvedStop[] = [
      { id: "dockNew", stand: at, via: [], dock: true, box: true },
      { id: "dash", stand: at, via: [], auto: true, dock: true, task: { kind: "dash", id: "dash" }, box: true }, stops[0],
    ];
    const go = (s: TutorialState, dockCleared: boolean) => stepTutorial(s, { now: 1, player: at, bram: at, stops: dock, events: [], dockCleared });
    const fresh = newTutorial(0);
    go(fresh, false);
    expect(fresh.stop).toBe(0);
    const replay = newTutorial(0);
    go(replay, true);
    expect([dock[replay.stop].id, replay.stage]).toEqual(["hqFirst", "await"]);
    // The real route marks the box and the dash, and nothing after them.
    expect(NEW_ROUTE.stops.filter(x => x.dock).map(x => x.id)).toEqual(["dockNew", "dash"]);
  });
  it("the hand-over starts itself after the sale, and with no last word the walk ends as its box closes", () => {
    const keep: ResolvedStop[] = [{ id: "keep", stand: at, via: [], auto: true, holds: "rod", box: true, shots: [null, null, "bram"] }];
    const s = newTutorial(0), go = (now: number, events: TutorialEvent[] = []) => stepTutorial(s, { now, player: at, bram: at, stops: keep, events, end: "" });
    expect(go(1)).toEqual([{ kind: "converse", lines: STOP_LINES.keep, stop: "keep" }]);
    expect(go(2, ["talkEnded"])).toEqual([{ kind: "reward" }, { kind: "done" }]);
  });
  it("fills the jump and dash keys in his lines and the tracker (touch: no keys)", () => {
    expect(fillKeys(STOP_LINES.dockNew[1], KEYS)).toMatch(/Space to jump\.$/);
    expect(fillKeys(TASK_DONE_LINES.box, KEYS)).toMatch(/Q to dash\.$/);
    expect(fillKeys(TRACKER.dash, { ...KEYS, touch: true })).toBe("Dash");
    expect(fillKeys(STOP_LINES.dockNew[1], { ...KEYS, touch: true })).not.toMatch(/\{/);
  });
  it("hints the way into HQ, and at the barrel, on a stall", () => {
    const s = newTutorial(0);
    step(s, 1, ["talked"]); step(s, 2, ["talkEnded"]);
    expect(step(s, 2 + HINT_AFTER_S)).toEqual([{ kind: "hint", hint: "hq" }]);
    expect(hintLine({ kind: "hint", hint: "hq" }, KEYS)).toMatch(/Alice/);
    expect(hintLine({ kind: "hint", hint: "sell" }, KEYS)).toMatch(/barrel/);
  });
});
