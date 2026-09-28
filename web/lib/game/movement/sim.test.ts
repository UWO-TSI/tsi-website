import { describe, expect, it } from "vitest";
import { advanceMove, createMoveSim, createMoveState, interpolated, stepMove, MOVE_TUNING as T, NO_INPUT, STEP, type MoveEvent, type MoveInput, type MoveState, type MoveWorld } from "./sim";
import { COURSE_GATES, COURSE_SPAWN, NEW_LAP, course, gateAt, lapStep } from "./course";
import { islandOf } from "../defaultIsland";
import { villageOf, type MapObject } from "../villageMap";
import { CLIFF_LEVELS, Surface, createCenteredMap, setCell } from "../grid";
import { terrainHealth, terrainProblems } from "../mapHealth";

const flat: MoveWorld = { top: () => 0, wet: () => false };

/** A grid world through the same adapter the village uses: `cell(x, z)` → [level, surface] at each cell centre. */
function grid(w: number, d: number, cell: (x: number, z: number) => [number, number], objects: MapObject[] = []) {
  const map = createCenteredMap(w, d);
  for (let cz = 0; cz < d; cz++) for (let cx = 0; cx < w; cx++) {
    const [level, surface] = cell(cx + map.originX, cz + map.originZ);
    setCell(map, cx, cz, level, surface);
  }
  return islandOf(villageOf(map, objects));
}
const G = Surface.Grass, W = Surface.River;

type Script = (time: number, s: MoveState) => Partial<MoveInput>;
/** Run fixed steps under a script; presses are whatever the script returns on that step. */
function drive(s: MoveState, w: MoveWorld, seconds: number, script: Script, each?: (s: MoveState, time: number) => void) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    s = stepMove(s, { ...NO_INPUT, ...script(i * STEP, s) }, STEP, w);
    each?.(s, (i + 1) * STEP);
  }
  return s;
}
const at = (time: number, when: number) => Math.abs(time - when) < STEP / 2;
const speedOf = (s: MoveState) => Math.hypot(s.vx, s.vz);
const kinds = (events: MoveEvent[]) => events.map(e => e.kind);

describe("the jump", () => {
  it("goes higher the longer Space is held, with a quick tap for a small hop", () => {
    const peak = (hold: boolean) => {
      let top = 0;
      drive(createMoveState(0, 0, flat), flat, 1, time => ({ jump: hold || time < STEP, jumpPressed: at(time, 0) }), s => { top = Math.max(top, s.y); });
      return top;
    };
    expect(peak(true)).toBeCloseTo(T.jumpHeight, 1);
    expect(peak(false)).toBeGreaterThan(0.3);
    expect(peak(false)).toBeLessThan(0.5);
  });

  // A 1.5u cliff: level 2 from z >= 2, the face at z = 1.5.
  const cliff = grid(12, 24, (_x, z) => [z >= 2 ? CLIFF_LEVELS : 0, G]);
  const offEdge = (pressAfterLeaving: number) => {
    let left = -1;
    const events: string[] = [];
    drive(createMoveState(0, 4, cliff, Math.PI), cliff, 1.2, (time, s) => {
      if (left < 0 && s.mode === "air") left = time;
      return { z: -1, jumpPressed: left >= 0 && at(time, left + pressAfterLeaving), jump: left >= 0 && time >= left + pressAfterLeaving };
    }, s => events.push(...kinds(s.events)));
    return events;
  };
  it("still jumps just after running off an edge (coyote time), not later", () => {
    expect(offEdge(T.coyoteTime * 0.6)).toContain("jump");
    expect(offEdge(T.coyoteTime + 0.05)).not.toContain("jump");
  });

  it("buffers a press just before landing into a jump on the landing step, not an early one", () => {
    const drop = (early: number) => {
      let landing = -1;
      drive(createMoveState(0, 4, cliff, Math.PI), cliff, 1.5, () => ({ z: -1 }), (s, time) => { if (landing < 0 && s.events.some(e => e.kind === "land")) landing = time; });
      const events: MoveEvent[][] = [];
      drive(createMoveState(0, 4, cliff, Math.PI), cliff, 1.5, time => ({ z: -1, jump: true, jumpPressed: at(time, landing - early) }), s => events.push(s.events));
      const landStep = events.findIndex(e => e.some(x => x.kind === "land"));
      return { landStep, jumped: events[landStep].some(e => e.kind === "jump" || e.kind === "hop" || e.kind === "long") };
    };
    expect(drop(T.jumpBuffer * 0.7).jumped).toBe(true);
    expect(drop(T.jumpBuffer + 0.06).jumped).toBe(false);
  });

  it("chains timed hops up to a low cap, and a late hop starts the chain over", () => {
    let s = drive(createMoveState(0, 0, flat), flat, 2.5, () => ({ z: 1, sprint: true }));
    const speeds: number[] = [], hops: number[] = [];
    // Press just before touching down each time: the buffered hop fires on the landing step.
    let armed = true;
    s = drive(s, flat, 3, (time, q) => {
      const press = time === 0 || (armed && q.mode === "air" && q.vy < 0 && q.y < 0.3);
      if (press) armed = false;
      return { z: 1, sprint: true, jump: true, jumpPressed: press };
    }, q => {
      const e = q.events.find(x => x.kind === "hop" || x.kind === "long" || x.kind === "jump");
      if (e) { armed = true; speeds.push(e.speed); hops.push(q.hops); }
    });
    const cap = T.sprintSpeed * T.longJumpBoost + T.hopChainMax * T.hopBoost;
    expect(Math.max(...hops)).toBe(T.hopChainMax);
    expect(Math.max(...speeds)).toBeCloseTo(cap, 1);
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    // Wait out the window on the ground: the next jump is a plain one.
    s = drive(s, flat, 1, () => ({ z: 1, sprint: true }));
    s = drive(s, flat, 0.05, time => ({ z: 1, sprint: true, jump: true, jumpPressed: at(time, 0) }));
    expect(s.hops).toBe(0);
  });
});

describe("the long jump", () => {
  it("is flatter and longer at sprint speed: about 4 tiles", () => {
    const hop = (sprint: boolean) => {
      let s = drive(createMoveState(0, 0, flat), flat, 2.5, () => ({ z: 1, sprint }));
      const z0 = s.z;
      let top = 0;
      s = drive(s, flat, 0.02, time => ({ z: 1, sprint, jump: true, jumpPressed: at(time, 0) }));
      let guard = 0;
      while (s.mode === "air" && guard++ < 400) {
        s = stepMove(s, { ...NO_INPUT, z: 1, sprint, jump: true }, STEP, flat);
        top = Math.max(top, s.y);
      }
      return { distance: s.z - z0, top };
    };
    const walk = hop(false), long = hop(true);
    expect(long.distance).toBeGreaterThan(3.9);
    expect(long.distance).toBeLessThan(4.6);
    expect(long.distance).toBeGreaterThan(walk.distance + 0.5);
    expect(long.top).toBeLessThan(walk.top * 0.7);
  });

  // Rivers across +z: 2 tiles at z 6..7, 3 at z 20..22, 4 at z 36..39.
  const rivers = grid(10, 90, (_x, z) => [0, (z >= 6 && z <= 7) || (z >= 20 && z <= 22) || (z >= 36 && z <= 39) ? W : G]);
  /** Run at a river from `from` and jump `early` before its near bank (bank edge at `bank`). */
  const leap = (from: number, bank: number, sprint: boolean, early = 0.35) => {
    let jumped = false;
    const events: string[] = [];
    const s = drive(createMoveState(0, from, rivers), rivers, 3.5, (_t, q) => {
      const press = !jumped && q.mode === "ground" && q.z >= bank - early;
      if (press) jumped = true;
      return { z: 1, sprint, jump: jumped, jumpPressed: press };
    }, q => events.push(...kinds(q.events)));
    return { s, splash: events.includes("splash"), events };
  };
  it("clears 2 tiles walking and 3 with a long jump; falling short splashes and puts you back on the near bank", () => {
    expect(leap(0, 5.5, false).splash).toBe(false);
    expect(leap(8.5, 19.5, true).splash).toBe(false);
    expect(leap(8.5, 19.5, true).events).toContain("long");
    const short = leap(30, 35.5, false);
    expect(short.splash).toBe(true);
    expect(short.events).toContain("respawn");
    expect(short.s.z).toBeLessThan(35.5);
    expect(rivers.wet(short.s.x, short.s.z)).toBe(false);
  });
});

describe("the Q dash", () => {
  it("bursts about 2.5 tiles, waits out its cooldown, and gives one air dash per jump", () => {
    let s = createMoveState(0, 0, flat);
    const events: string[] = [];
    s = drive(s, flat, T.dashTime, time => ({ z: 1, dashPressed: at(time, 0) }), q => events.push(...kinds(q.events)));
    expect(s.z).toBeCloseTo(T.dashSpeed * T.dashTime, 0);
    s = drive(s, flat, 0.1, time => ({ z: 1, dashPressed: at(time, 0) }), q => events.push(...kinds(q.events)));
    expect(events.filter(k => k === "dash")).toHaveLength(1);
    // In the air: one dash, then none until landing.
    s = drive(s, flat, 1, () => ({}));
    const air: string[] = [];
    drive(s, flat, 1, time => ({ z: 1, jump: true, jumpPressed: at(time, 0), dashPressed: at(time, 0.1) || at(time, 0.3) }), q => air.push(...kinds(q.events)));
    expect(air.filter(k => k === "dash")).toHaveLength(1);
  });
  it("hovers in the air while dashing, and a dash then jump carries the dash speed", () => {
    let s = drive(createMoveState(0, 0, flat), flat, 0.2, time => ({ z: 1, jump: true, jumpPressed: at(time, 0) }));
    const y = s.y;
    s = drive(s, flat, T.dashTime * 0.8, time => ({ z: 1, dashPressed: at(time, 0) }));
    expect(s.y).toBeCloseTo(y, 5);
    let takeoff = 0;
    drive(createMoveState(0, 0, flat), flat, 0.3, time => ({ z: 1, dashPressed: at(time, 0), jump: time > 0.1, jumpPressed: at(time, 0.1) }),
      q => { if (q.events.some(e => e.kind === "dashjump")) takeoff = speedOf(q); });
    expect(takeoff).toBeGreaterThan(T.dashSpeed * 0.9);
  });
});

describe("skids, drops and rolls", () => {
  it("skids on a sharp turn at speed, then heads the new way", () => {
    let s = drive(createMoveState(0, 0, flat), flat, 2, () => ({ z: 1, sprint: true }));
    const events: string[] = [];
    s = drive(s, flat, 0.6, () => ({ z: -1, sprint: true }), q => events.push(...kinds(q.events)));
    expect(events).toContain("skid");
    expect(s.vz).toBeLessThan(0);
  });
  const terrace = grid(12, 44, (_x, z) => [z >= 6 && z <= 12 ? 2 * CLIFF_LEVELS : z >= 5 && z <= 13 ? CLIFF_LEVELS : 0, G]);
  it("rolls out of a running drop and keeps the speed; a slow big drop costs a short recovery, never more", () => {
    const events: MoveEvent[] = [];
    let before = 0;
    const s = drive(createMoveState(0, 8, terrace), terrace, 2, () => ({ z: 1, sprint: true }), q => {
      events.push(...q.events);
      if (q.mode === "air") before = speedOf(q);
    });
    const roll = events.find(e => e.kind === "roll");
    expect(roll?.drop).toBeGreaterThan(2.5); // over the one-tile ledge to the ground: 3.0u
    expect(roll!.speed).toBeGreaterThan(before * 0.9);
    expect(s.z).toBeGreaterThan(16);
    // A slow walk off a 3u drop (steeper than the grid allows, to measure it): a short recovery.
    const tall = grid(12, 20, (_x, z) => [z <= 0 ? 2 * CLIFF_LEVELS : 0, G]);
    const slow: MoveEvent[] = [];
    const after = drive(createMoveState(0, -1, tall), tall, 2, () => ({ z: 1, sneak: true }), q => slow.push(...q.events));
    expect(kinds(slow)).not.toContain("roll");
    expect(slow.find(e => e.kind === "recover")?.drop).toBeCloseTo(3, 1);
    expect(after.mode).toBe("ground");
    expect(after.z).toBeGreaterThan(1);
  });
});

describe("climbing", () => {
  const wall = (levels: number) => grid(12, 24, (_x, z) => [z >= 2 ? levels : 0, G]);
  it("stops at a cliff on foot, and a jump into it grabs the ledge and mantles up", () => {
    const one = wall(CLIFF_LEVELS);
    let s = drive(createMoveState(0, -3, one), one, 1.5, () => ({ z: 1 }));
    expect(s.y).toBe(0);
    expect(s.z).toBeLessThan(1.5);
    const events: string[] = [];
    s = drive(s, one, 1.5, time => ({ z: 1, jump: true, jumpPressed: at(time, 0) }), q => events.push(...kinds(q.events)));
    expect(events).toContain("mantle");
    expect(s.mode).toBe("ground");
    expect(s.y).toBeCloseTo(1.5);
    expect(s.z).toBeGreaterThan(2);
  });
  it("cannot reach a ledge two cliffs up", () => {
    const two = wall(2 * CLIFF_LEVELS);
    const events: string[] = [];
    const s = drive(createMoveState(0, -1, two), two, 2, time => ({ z: 1, jump: true, jumpPressed: at(time, 0.2) || at(time, 1) }), q => events.push(...kinds(q.events)));
    expect(events).not.toContain("mantle");
    expect(s.y).toBe(0);
  });
  it("walks ramps end to end, both ways, across their width, and never pops sideways onto the plateau", () => {
    for (const carved of [false, true]) {
      // Plateau (1.5u) from z >= 2 (carved: from z >= 0, the ramp cut into it); a two-cell ramp at x = 0, z 0..1.
      const w = grid(9, 12, (x, z) => (x === 0 && (z === 0 || z === 1) ? [0, Surface.Ramp] : [z >= (carved ? 0 : 2) ? CLIFF_LEVELS : 0, G]));
      for (const x of [-0.25, 0, 0.25, 0.45]) {
        const up = drive(createMoveState(x, -4, w), w, 2, () => ({ z: 1 }));
        expect(up.z, `up at ${x}`).toBeGreaterThan(5);
        expect(up.y).toBeCloseTo(1.5);
        const down = drive(createMoveState(x, 5, w), w, 2, () => ({ z: -1 }));
        expect(down.z, `down at ${x}`).toBeLessThan(-4);
        expect(down.y).toBe(0);
        expect(down.mode).toBe("ground");
      }
      if (carved) {
        // Halfway up (0.75u), the plateau beside the ramp is a wall, not a step.
        const side = drive(createMoveState(0, 0, w), w, 1, () => ({ x: 1 }));
        expect(side.x).toBeLessThan(0.5);
        expect(side.y).toBeLessThan(1);
      }
    }
  });
});

describe("collision", () => {
  const fences: MapObject[] = [-2, -1, 0, 1, 2].map((x, i) => ({ id: `f${i}`, kind: "fence", x, z: 0, model: "fence-country-a" }));
  // A fence line at z = 0 and a one-tile ridge a full cliff high at z = 8.
  const w = grid(10, 30, (_x, z) => [z === 8 ? CLIFF_LEVELS : 0, G], fences);
  it("never passes through a fence or a thin ridge, however fast and at any frame rate", () => {
    for (const [from, dir] of [[-3, 1], [3, -1], [5, 1], [11, -1]] as const) {
      const sidePast = (z: number) => (dir > 0 ? z > (from < 5 ? 0 : 8) : z < (from < 5 ? 0 : 8));
      let s = drive(createMoveState(0.1, from, w), w, 1.5, time => ({ z: dir, sprint: true, dashPressed: at(time, 0.2) || at(time, 0.8) }));
      expect(sidePast(s.z), `fixed step from ${from}`).toBe(false);
      for (const fps of [30, 60, 144]) {
        const sim = createMoveSim(createMoveState(-0.1, from, w));
        for (let f = 0; f < fps * 1.5; f++) advanceMove(sim, { ...NO_INPUT, z: dir, sprint: true, dashPressed: f === 5 || f === fps }, 1 / fps, w);
        s = sim.state;
        expect(sidePast(s.z), `${fps} Hz from ${from}`).toBe(false);
      }
    }
  });
  it("clears a fence with a jump", () => {
    const s = drive(createMoveState(0.4, -3, w), w, 1.5, (_t, q) => ({ z: 1, jump: true, jumpPressed: q.z > -1.2 && q.z < -1.05 && q.mode === "ground" }));
    expect(s.z).toBeGreaterThan(1);
  });
});

describe("no stuck states", () => {
  // A plateau corner, a river and a building corner meeting, with rocks and a tree.
  const objects: MapObject[] = [
    { id: "cafe", kind: "landmark", x: 3.5, z: -3.4 },
    { id: "r1", kind: "rock", x: -2, z: 2, model: "rock-a" },
    { id: "t1", kind: "tree", x: -4, z: -4, seed: 0 },
  ];
  const w = grid(20, 20, (x, z) => [x >= 1 && z >= 1 ? CLIFF_LEVELS : 0, x <= -6 || z <= -8 ? W : G], objects);
  it("fuzzed jumps, dashes and runs at cliff, water and building edges never end in water, inside something or stuck", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 60; run++) {
      let s = createMoveState(-1 + rand() * 1.5, -1 + rand() * 1.5, w);
      let input: Partial<MoveInput> = {};
      s = drive(s, w, 3, (time) => {
        if (Math.round(time / STEP) % 18 === 0) {
          const a = rand() * Math.PI * 2;
          input = { x: Math.sin(a), z: Math.cos(a), sprint: rand() < 0.5, jump: rand() < 0.5, jumpPressed: rand() < 0.35, dashPressed: rand() < 0.2 };
        } else input = { ...input, jumpPressed: false, dashPressed: false };
        return input;
      }, q => {
        if (q.mode === "ground" || q.mode === "skid" || q.mode === "roll") {
          expect(w.wet(q.x, q.z), `run ${run} on water at ${q.x.toFixed(2)},${q.z.toFixed(2)}`).toBe(false);
          expect(w.top(q.x, q.z), `run ${run} inside something`).toBeLessThanOrEqual(q.y + T.stepUp);
        }
      });
      // Then never stuck: from wherever it ended, it can walk away in several directions.
      s = drive(s, w, 2, () => ({}));
      let free = 0;
      for (let a = 0; a < 8; a++) {
        const e = drive(s, w, 0.4, () => ({ x: Math.sin((a * Math.PI) / 4), z: Math.cos((a * Math.PI) / 4) }));
        if (Math.hypot(e.x - s.x, e.z - s.z) > 0.25) free++;
      }
      expect(free, `run ${run} stuck at ${s.x.toFixed(2)},${s.z.toFixed(2)} (${s.mode})`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the whole lab course, fuzzed", () => {
  it("never grounds on water, never ends inside something, never gets stuck", () => {
    const w = islandOf(course());
    let seed = 11;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    // Start beside every feature: the sprint lane, each river, the building, the fences, the cliffs and ramps, the drops, the narrow bridge.
    const starts: [number, number][] = [[-17, -10], [-12, 21], [-3.5, 21], [6.5, 21], [16, 11.5], [17, 4], [15, -2], [15, 1], [14.5, -21], [12, -20], [8, -21], [3, -21], [-0.5, -21], [-6, -21], [-12, -21]];
    for (const [sx, sz] of starts) for (let run = 0; run < 3; run++) {
      let s = createMoveState(sx, sz, w);
      let input: Partial<MoveInput> = {};
      s = drive(s, w, 4, time => {
        if (Math.round(time / STEP) % 24 === 0) {
          const a = rand() * Math.PI * 2;
          input = { x: Math.sin(a), z: Math.cos(a), sprint: rand() < 0.6, jump: rand() < 0.6, jumpPressed: rand() < 0.4, dashPressed: rand() < 0.25 };
        } else input = { ...input, jumpPressed: false, dashPressed: false };
        return input;
      }, q => {
        const where = `${sx},${sz} run ${run} at ${q.x.toFixed(2)},${q.z.toFixed(2)} y ${q.y.toFixed(2)} ${q.mode}`;
        if (q.mode === "ground" || q.mode === "skid" || q.mode === "roll" || q.mode === "recover") {
          expect(w.wet(q.x, q.z), `on water: ${where}`).toBe(false);
          expect(w.top(q.x, q.z), `inside: ${where}`).toBeLessThanOrEqual(q.y + T.stepUp);
        } else if (q.mode === "air") expect(w.top(q.x, q.z), `in the air inside: ${where}`).toBeLessThanOrEqual(q.y + 0.21);
      });
      s = drive(s, w, 1.5, () => ({}));
      let free = 0;
      for (let a = 0; a < 8; a++) {
        const e = drive(s, w, 0.4, () => ({ x: Math.sin((a * Math.PI) / 4), z: Math.cos((a * Math.PI) / 4) }));
        if (Math.hypot(e.x - s.x, e.z - s.z) > 0.25) free++;
      }
      expect(free, `stuck: ${sx},${sz} run ${run} at ${s.x.toFixed(2)},${s.z.toFixed(2)} (${s.mode})`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("frame rate", () => {
  const w = grid(12, 40, (_x, z) => [z >= 10 && z <= 20 ? CLIFF_LEVELS : 0, z >= 26 && z <= 27 ? W : G]);
  /** Sprint, hop, dash, run off the plateau, jump a river, turn: a timeline of held keys. */
  const timeline = (t: number, cut: number): MoveInput => ({
    ...NO_INPUT, z: t < cut * 4 ? 1 : 0.3, x: t >= cut * 5 ? -1 : 0, sprint: t < cut * 5,
    jump: (t >= cut && t < cut * 1.5) || (t >= cut * 3 && t < cut * 3.5), dashPressed: false,
  });
  const path = (fps: number, cut: number) => {
    const sim = createMoveSim(createMoveState(0, 0, w));
    let held = false, dashed = false;
    const samples: [number, number, number][] = [];
    for (let f = 0; f < fps * 3; f++) {
      const t = f / fps + 1e-9, input = timeline(t, cut);
      const dash = !dashed && t >= cut * 2;
      if (dash) dashed = true;
      advanceMove(sim, { ...input, jumpPressed: input.jump && !held, dashPressed: dash }, 1 / fps, w);
      held = input.jump;
      if (Math.abs(((f + 1) / fps) % 0.5) < 1e-9 || Math.abs(((f + 1) / fps) % 0.5 - 0.5) < 1e-9) samples.push(interpolated(sim));
    }
    return { end: interpolated(sim), samples };
  };
  it("follows the same path at 30, 60 and 144 Hz", () => {
    // Inputs that change on shared frame boundaries give the same steps: the same path exactly.
    const ref = path(144, 1 / 3);
    for (const fps of [30, 60]) {
      const p = path(fps, 1 / 3);
      p.end.forEach((v, i) => expect(v).toBeCloseTo(ref.end[i], 6));
      p.samples.forEach((q, i) => q.forEach((v, j) => expect(v).toBeCloseTo(ref.samples[i][j], 6)));
    }
    // Arbitrary timings differ only by when a frame first sees the key: within a frame's travel.
    const odd = path(144, 0.37);
    for (const fps of [30, 60]) {
      const p = path(fps, 0.37);
      expect(Math.hypot(p.end[0] - odd.end[0], p.end[2] - odd.end[2])).toBeLessThan(15 / fps + 0.05);
    }
  });
});

describe("the lab course", () => {
  it("is healthy terrain, all of it reachable from the spawn", () => {
    const v = course();
    const health = terrainHealth(v.map, [COURSE_SPAWN[0] - v.map.originX, COURSE_SPAWN[1] - v.map.originZ]);
    expect(terrainProblems(health)).toEqual({});
    expect(health.stranded).toBe(0);
  });
  it("times a lap only through every checkpoint in order", () => {
    let lap = lapStep(NEW_LAP, 0, 0);
    lap = lapStep(lap, 2, 3); // out of order: ignored
    expect(lap.next).toBe(1);
    for (let g = 1; g < COURSE_GATES.length; g++) lap = lapStep(lap, g, g * 10);
    lap = lapStep(lap, 0, 55);
    expect(lap.last).toBe(55);
    expect(lap.best).toBe(55);
    expect(gateAt(-17, -16)).toBe(0);
  });
});
