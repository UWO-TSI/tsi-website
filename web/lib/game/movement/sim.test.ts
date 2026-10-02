import { describe, expect, it } from "vitest";
import { advanceMove, clearSpot, createMoveSim, createMoveState, interpolated, slopeAt, standWorld, stepMove, topSpeed, towards, walkTo, MOVE_TUNING as T, NO_INPUT, STEP, type MoveEvent, type MoveInput, type MoveState, type MoveTuning, type MoveWorld } from "./sim";
import { COURSE_GATES, COURSE_SPAWN, GLIDE_SPAWN, NEW_LAP, SLIDE_GAP, SLIDE_SPAWN, course, gateAt, lapStep, routePilot, type RouteStep } from "./course";
import { islandOf } from "../defaultIsland";
import { bugReaction, SNEAK_SPEED } from "../peaceful";
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
function drive(s: MoveState, w: MoveWorld, seconds: number, script: Script, each?: (s: MoveState, time: number) => void, t: MoveTuning = T) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    s = stepMove(s, { ...NO_INPUT, ...script(i * STEP, s) }, STEP, w, t);
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
    expect(peak(false)).toBeLessThan(T.jumpHeight * 0.5);
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
    expect(offEdge(T.coyoteTime * 0.6)[0]).toBe("jump");
    expect(offEdge(T.coyoteTime + 0.05)[0]).toBe("land"); // (then the press, buffered, jumps off the landing)
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
});

describe("the bunny-hop (row 249)", () => {
  const TAKEOFF = new Set(["jump", "hop", "long", "dashjump"]);
  /** Sprint up to speed, then press Space and hold it for `release` seconds. */
  const hopRun = (release: number, sprint = true, seconds = 3) => {
    const s0 = drive(createMoveState(0, 0, flat), flat, 2.5, () => ({ z: 1, sprint }));
    const takeoffs: MoveEvent[] = [], hops: number[] = [];
    const s = drive(s0, flat, seconds, time => ({ z: 1, sprint, jump: time < release, jumpPressed: at(time, 0) }), q => {
      for (const e of q.events) if (TAKEOFF.has(e.kind)) { takeoffs.push(e); hops.push(q.hops); }
    });
    return { s, takeoffs, hops };
  };

  it("holding Space while sprinting hops on every landing, adding speed up to a low cap", () => {
    const { takeoffs, hops } = hopRun(Infinity);
    expect(takeoffs.length).toBeGreaterThanOrEqual(6);
    expect(takeoffs.slice(1).every(e => e.kind === "hop")).toBe(true);
    expect(Math.max(...hops)).toBe(T.hopChainMax);
    const speeds = takeoffs.map(e => e.speed);
    for (let i = 1; i <= T.hopChainMax; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1] + T.hopBoost * 0.9);
    // Past the cap the speed holds: not too crazy.
    for (const v of speeds.slice(T.hopChainMax + 1)) expect(v).toBeCloseTo(topSpeed(T), 3);
    expect(topSpeed(T)).toBeLessThan(T.sprintSpeed * 1.3);
  });

  it("a tap is one jump; letting go ends the chain on the next landing", () => {
    const tap = hopRun(STEP * 2);
    expect(tap.takeoffs).toHaveLength(1);
    expect(tap.s.mode).toBe("ground");
    // Held for two hops, then released in the air: that landing stays down and the chain resets.
    const held = hopRun(0.8);
    const before = held.takeoffs.filter(e => e.kind === "hop").length;
    expect(before).toBeGreaterThanOrEqual(2);
    expect(held.s.mode).toBe("ground");
    expect(held.s.hops).toBe(0);
    expect(held.takeoffs.length).toBe(before + 1);
  });

  it("only while sprinting: holding Space at a walk lands and stays down", () => {
    const walk = hopRun(Infinity, false);
    expect(walk.takeoffs).toHaveLength(1);
    expect(walk.s.mode).toBe("ground");
  });

  it("builds the same chain at 30, 60 and 144 Hz", () => {
    const chain = (fps: number) => {
      const sim = createMoveSim(createMoveState(0, 0, flat));
      const kinds: string[] = [];
      for (let f = 0; f < fps * 5; f++) {
        const t = f / fps + 1e-9;
        kinds.push(...advanceMove(sim, { ...NO_INPUT, z: 1, sprint: true, jump: t >= 2 && t < 4, jumpPressed: f === 2 * fps }, 1 / fps, flat).map(e => e.kind));
      }
      return { hops: kinds.filter(k => k === "hop").length, z: sim.state.z, speed: speedOf(sim.state) };
    };
    const ref = chain(144);
    expect(ref.hops).toBeGreaterThanOrEqual(4);
    for (const fps of [30, 60]) {
      const c = chain(fps);
      expect(c.hops).toBe(ref.hops);
      expect(c.z).toBeCloseTo(ref.z, 6);
      expect(c.speed).toBeCloseTo(ref.speed, 6);
    }
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
        s = stepMove(s, { ...NO_INPUT, z: 1, sprint, jump: s.vy > 0 }, STEP, flat); // let go coming down: no bunny-hop
        top = Math.max(top, s.y);
      }
      return { distance: s.z - z0, top };
    };
    const walk = hop(false), long = hop(true);
    expect(long.distance).toBeGreaterThan(3.9);
    expect(long.distance).toBeLessThan(4.6);
    expect(long.distance).toBeGreaterThan(walk.distance + 0.4); // the walking jump flies further since the higher, lighter jump (row 276)
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
      return { z: 1, sprint, jump: press || (jumped && q.vy > 0), jumpPressed: press };
    }, q => events.push(...kinds(q.events)));
    return { s, splash: events.includes("splash"), events };
  };
  it("a splash says how far it fell: a short jump's drop, more off a height", () => {
    const short = leap(30, 35.5, false);
    expect(short.splash).toBe(true);
    const drops: number[] = [];
    drive(createMoveState(0, 30, rivers), rivers, 3, (_t, q) => ({ z: 1, jump: q.mode === "ground" && q.z >= 35.15, jumpPressed: q.mode === "ground" && q.z >= 35.15 }), q => { for (const e of q.events) if (e.kind === "splash") drops.push(e.drop); });
    expect(drops[0]).toBeGreaterThan(0.3);
    expect(drops[0]).toBeLessThan(1.2);
    // Off a 1.5u ledge into the sea: the cliff and the jump.
    const ledge = grid(12, 40, (_x, z) => [z <= 0 ? CLIFF_LEVELS : 0, z >= 1 ? W : G]), high: number[] = [];
    drive(createMoveState(0, -6, ledge), ledge, 3, (_t, q) => ({ z: 1, jump: q.mode === "ground" && q.z >= 0.2, jumpPressed: q.mode === "ground" && q.z >= 0.2 }), q => { for (const e of q.events) if (e.kind === "splash") high.push(e.drop); });
    expect(high[0]).toBeGreaterThan(1.8);
  });
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
  it("bursts about 2.5 tiles at once, eases out to its exit with no step at the end, and waits out its cooldown", () => {
    const speeds: number[] = [], events: string[] = [];
    let s = drive(createMoveState(0, 0, flat), flat, T.dashTime, time => ({ z: 1, dashPressed: at(time, 0) }), q => { speeds.push(speedOf(q)); events.push(...kinds(q.events)); });
    expect(speeds[0]).toBeGreaterThan(T.dashSpeed * 0.9);
    expect(s.z).toBeCloseTo(T.dashSpeed * T.dashTime * (T.dashExit + (1 - T.dashExit) / (T.dashEase + 1)), 1);
    expect(s.z).toBeGreaterThan(2.3);
    expect(speeds.at(-1)).toBeCloseTo(T.dashSpeed * T.dashExit, 5);
    // Walking on: from the second half of the burst into the run, no step bigger than a gentle ease.
    s = drive(s, flat, 0.3, time => ({ z: 1, dashPressed: at(time, 0.1) }), q => { speeds.push(speedOf(q)); events.push(...kinds(q.events)); });
    const half = Math.round(T.dashTime / STEP / 2);
    for (let i = half; i < speeds.length; i++) expect(Math.abs(speeds[i] - speeds[i - 1])).toBeLessThan(0.5);
    expect(events.filter(k => k === "dash")).toHaveLength(1); // the second press came inside the cooldown
  });
  it("goes the way of the stick, or the way you face with none", () => {
    const facingX = drive(createMoveState(0, 0, flat, Math.PI / 2), flat, T.dashTime, time => ({ dashPressed: at(time, 0) }));
    expect(facingX.x).toBeGreaterThan(2.3);
    expect(Math.abs(facingX.z)).toBeLessThan(1e-6);
    const stick = drive(createMoveState(0, 0, flat, Math.PI / 2), flat, T.dashTime, time => ({ z: -1, dashPressed: at(time, 0) }));
    expect(stick.z).toBeLessThan(-2.3);
    expect(stick.facing).toBeCloseTo(Math.PI, 1);
  });
  it("in the air: one dash per jump, floating up a little and easing to an apex before the fall", () => {
    const free = { ...T, dashCooldown: 0 };
    const air: string[] = [];
    drive(createMoveState(0, 0, flat), flat, 1, time => ({ z: 1, jump: true, jumpPressed: at(time, 0), dashPressed: at(time, 0.1) || at(time, 0.35) }), q => air.push(...kinds(q.events)), free);
    expect(air.filter(k => k === "dash")).toHaveLength(1);
    let s = drive(createMoveState(0, 0, flat), flat, 0.2, time => ({ z: 1, jump: true, jumpPressed: at(time, 0) }));
    const y = s.y;
    s = drive(s, flat, T.dashTime, time => ({ z: 1, dashPressed: at(time, 0) }));
    expect(s.y - y).toBeCloseTo((T.airDashLift * T.dashTime) / 2, 1);
    expect(s.vy).toBeCloseTo(0, 5);
    s = drive(s, flat, 0.1, () => ({ z: 1 }));
    expect(s.vy).toBeLessThan(0);
  });
  it("a dash then jump carries the dash speed (momentum, David 2026-10-01), under the momentum ceiling", () => {
    const takeoff = (after: number) => {
      let v = 0;
      drive(createMoveState(0, 0, flat), flat, 0.5, time => ({ z: 1, dashPressed: at(time, 0), jump: time >= after, jumpPressed: at(time, after) }),
        q => { if (q.events.some(e => e.kind === "dashjump")) v = speedOf(q); });
      return v;
    };
    expect(takeoff(0.05)).toBeGreaterThan(topSpeed(T));
    expect(takeoff(STEP)).toBeGreaterThan(takeoff(0.05));
    expect(takeoff(STEP)).toBeLessThanOrEqual(T.momentumCeiling + 1e-9);
    // Just after the dash (inside the window): the speed it keeps.
    expect(takeoff(T.dashTime + 0.05)).toBeCloseTo(T.dashSpeed * T.dashExit, 6);
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

describe("in the game (step 4)", () => {
  it("taps to walk: arrives at the target and stops there, at any frame rate", () => {
    for (const fps of [10, 30, 60, 144]) {
      const sim = createMoveSim(createMoveState(0, -5, flat));
      let arrived = -1;
      for (let f = 0; f < fps * 4 && arrived < 0; f++) {
        const go = towards(sim.state, 0, -1);
        if (!go) arrived = f;
        else advanceMove(sim, { ...NO_INPUT, ...go }, 1 / fps, flat);
        expect(sim.state.z, `${fps} Hz`).toBeLessThan(-0.95);
      }
      expect(arrived, `${fps} Hz`).toBeGreaterThan(0);
      expect(Math.abs(sim.state.z + 1)).toBeLessThan(0.12);
    }
  });
  it("taps to walk into water or a wall: stops on the bank and gives up", () => {
    // Water from z >= 3, a building (a wall of any height) at x >= 4.
    const w = standWorld(() => 0, (x, z) => z < 3 && x < 4, (_x, z) => z >= 3);
    expect(walkTo(w, 0, 0, 0, 10).z).toBeLessThan(3);
    expect(walkTo(w, 0, 0, 10, 0).x).toBeLessThan(4);
    expect(walkTo(w, 0, 0, 10, 0).x).toBeGreaterThan(3.5);
  });
  it("pushes (knockback, an ability's dash) through the same collision", () => {
    const w = standWorld(() => 0, x => x < 2, () => false);
    const s = drive(createMoveState(0, 0, w), w, 1, () => ({ push: { x: 20, z: 0 } }));
    expect(s.x).toBeGreaterThan(1.5);
    expect(s.x).toBeLessThan(2);
    expect(Math.atan2(Math.sin(s.facing), Math.cos(s.facing))).toBeCloseTo(0); // a push doesn't turn you
  });
  it("gets up from a seat in a solid into the open beside it, the front first, and walks off", () => {
    const bench = standWorld(() => 0, (x, z) => !(Math.abs(x) < 1 && Math.abs(z) < 0.27), () => false);
    const [x, z] = clearSpot(bench, 0, 0, 0, 0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeGreaterThan(0.45);
    expect(z).toBeLessThan(0.7);
    expect(clearSpot(bench, 0, 0, 0, Math.PI)[1]).toBeLessThan(-0.45);
    expect(drive(createMoveState(x, z, bench), bench, 0.5, () => ({ z: 1 })).z).toBeGreaterThan(z + 1);
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

describe("the leaf glider (row 245)", () => {
  const GT: MoveTuning = { ...T, glider: 1 };
  // A 1.5u cliff top for z <= 0 (its edge at z = 0.5), low ground beyond; and the same with the sea from z >= 6.
  const cliff = grid(12, 70, (_x, z) => [z <= 0 ? CLIFF_LEVELS : 0, G]);
  const sea = grid(12, 70, (_x, z) => [z <= 0 ? CLIFF_LEVELS : 0, z >= 6 ? W : G]);
  const tall = grid(12, 70, (_x, z) => [z <= 0 ? 4 * CLIFF_LEVELS : 0, G]); // 6u, steeper than the grid allows, to measure it
  /**
   * Walk (or sprint) to the cliff edge and jump, Space held while rising; let go at the top for a step, press it again
   * and hold it with the stick forward. `then` can change the input once gliding (a gust, a let-go). Returns every step.
   */
  const glide = (w: MoveWorld, t: MoveTuning, opts: { sprint?: boolean; from?: [number, number]; edge?: number; then?: (s: MoveState, i: Partial<MoveInput>) => Partial<MoveInput> } = {}) => {
    const steps: MoveState[] = [], [x0, z0] = opts.from ?? [0, -10], edge = opts.edge ?? 0.5;
    let phase = 0; // 0 run, 1 rising, 2 let go, 3 pressed again
    drive(createMoveState(x0, z0, w), w, 6, (_time, s) => {
      const i: Partial<MoveInput> = { z: 1, sprint: opts.sprint };
      if (phase === 0 && s.mode === "ground" && s.z >= edge - 0.2) { phase = 1; return { ...i, jump: true, jumpPressed: true }; }
      if (phase === 1) { if (s.vy > 0) return { ...i, jump: true }; phase = 2; return i; }
      if (phase === 2) { phase = 3; return { ...i, jump: true, jumpPressed: true }; }
      if (phase === 3) return s.mode === "glide" && opts.then ? opts.then(s, { ...i, jump: true }) : { ...i, jump: true };
      return i;
    }, s => steps.push(s), t);
    return steps;
  };
  const events = (steps: MoveState[]) => steps.flatMap(s => kinds(s.events));
  const landing = (steps: MoveState[]) => steps.find((s, i) => i > 0 && s.mode === "ground" && steps[i - 1].mode !== "ground" && s.z > 0.6)!;

  it("opens on a fresh press while falling, never from the held Space of a jump or a bunny-hop", () => {
    const opened = glide(cliff, GT);
    expect(events(opened)).toContain("glide");
    const open = opened.find(s => s.events.some(e => e.kind === "glide"))!;
    expect(open.mode).toBe("glide");
    // Holding the jump's Space through the whole fall never opens it.
    const held: string[] = [];
    let jumped = false;
    drive(createMoveState(0, -10, cliff), cliff, 4, (_t, s) => {
      const press = !jumped && s.mode === "ground" && s.z >= 0.3;
      jumped ||= press;
      return { z: 1, jump: jumped, jumpPressed: press };
    }, q => held.push(...kinds(q.events)), GT);
    expect(held).toContain("jump");
    expect(held).not.toContain("glide");
    // A press while still rising doesn't open it either.
    const rising: string[] = [];
    drive(createMoveState(0, 0, flat), flat, 1.5, time => ({ jump: time < 0.05 || time >= 0.1, jumpPressed: at(time, 0) || at(time, 0.1) }), q => rising.push(...kinds(q.events)), GT);
    expect(rising).not.toContain("glide");
    // The held bunny-hop chain is untouched: the same hops as without the glider.
    const chain = (t: MoveTuning) => {
      const out: string[] = [];
      drive(drive(createMoveState(0, 0, flat), flat, 2.5, () => ({ z: 1, sprint: true }), undefined, t), flat, 3, time => ({ z: 1, sprint: true, jump: true, jumpPressed: at(time, 0) }), q => out.push(...kinds(q.events)), t);
      return out;
    };
    expect(chain(GT)).toEqual(chain(T));
  });

  it("a press that would land within the jump buffer anyway is still a buffered jump", () => {
    // Walking off the 1.5u cliff, a press after coyote time comes too close to the ground to open: it jumps on landing.
    const out: string[] = [];
    let left = -1;
    drive(createMoveState(0, -2, cliff), cliff, 1.2, (time, s) => {
      if (left < 0 && s.mode === "air") left = time;
      const press = left >= 0 && at(time, left + T.coyoteTime + 0.03);
      return { z: 1, jump: press, jumpPressed: press };
    }, q => out.push(...kinds(q.events)), GT);
    expect(out).not.toContain("glide");
    expect(out.slice(0, 2)).toEqual(["land", "jump"]);
  });

  it("sinks slowly while held and never gains height, even through the gust", () => {
    for (const then of [undefined, (s: MoveState, i: Partial<MoveInput>) => ({ ...i, dashPressed: s.modeT > 0.2 && s.modeT < 0.2 + STEP })]) {
      const steps = glide(cliff, GT, { then });
      const gliding = steps.filter(s => s.mode === "glide");
      expect(gliding.length).toBeGreaterThan(100);
      for (let k = 1; k < steps.length; k++) if (steps[k].mode === "glide") expect(steps[k].y).toBeLessThanOrEqual(steps[k - 1].y + 1e-9);
      // Settled into the sink after the open.
      const late = gliding.filter(s => s.modeT > 0.6);
      expect(late.length).toBeGreaterThan(30);
      for (const s of late) expect(s.vy).toBeCloseTo(-GT.glideSink, 1);
    }
  });

  it("clears about 10 to 12 tiles off a 1.5u cliff (a sprinting long jump about as far), a river and a short sea gap, not the island", () => {
    const walk = landing(glide(cliff, GT)), sprint = landing(glide(cliff, GT, { sprint: true }));
    expect(walk.z - 0.5).toBeGreaterThan(10);
    expect(walk.z - 0.5).toBeLessThan(12.5);
    expect(sprint.z - 0.5).toBeGreaterThan(10); // the long jump opens lower than the higher jump, so it glides about as far (row 276)
    expect(sprint.z - 0.5).toBeLessThan(14.5);
  });

  it("steers: the heading swings round to the stick at a moderate rate, at glide speed", () => {
    const steps = glide(tall, GT, { then: (s, i) => ({ ...i, x: s.modeT > 0.3 ? 1 : 0, z: s.modeT > 0.3 ? 0 : 1 }) });
    const turn = steps.filter(s => s.mode === "glide" && s.modeT > 0.3);
    const heading = (s: MoveState) => Math.atan2(s.vx, s.vz);
    const after = (dt: number) => turn.find(s => s.modeT >= 0.3 + dt)!;
    expect(heading(after(0.1))).toBeLessThan(Math.PI / 4); // not a snap
    expect(heading(after(1.2))).toBeGreaterThan(Math.PI / 2 * 0.9); // round within about a second
    expect(speedOf(after(1.2))).toBeCloseTo(GT.glideSpeed, 0);
  });

  it("lands softly from any height: no roll, no recovery, no hop", () => {
    const out = events(glide(tall, GT, { sprint: true }));
    expect(out.slice(out.indexOf("glide"))).toEqual(["glide", "furl", "land"]);
    // The same drop without the glider rolls.
    expect(events(glide(tall, T, { sprint: true }))).toContain("roll");
  });

  it("drops when you let go, and that fall lands like any other (a roll at glide speed)", () => {
    const steps = glide(tall, GT, { then: (s, i) => ({ ...i, jump: s.modeT < 0.3 }) });
    const out = events(steps);
    expect(out.slice(out.indexOf("glide"), out.indexOf("glide") + 2)).toEqual(["glide", "furl"]);
    const after = steps.find(s => s.events.some(e => e.kind === "furl"))!;
    expect(after.mode).toBe("air");
    expect(out.at(-1)).toBe("roll"); // ~5u down from where you let go, moving
  });

  it("Q spends the air dash as a forward gust; the glide carries on while Space is held", () => {
    let gusted = false;
    const steps = glide(tall, { ...GT, dashCooldown: 0 }, { then: (s, i) => ({ ...i, dashPressed: s.modeT > 0.3 && (!gusted ? (gusted = true) : s.modeT > 0.8 && s.modeT < 0.8 + STEP) }) });
    const out = events(steps);
    expect(out.filter(k => k === "dash")).toHaveLength(1); // one per airtime
    const gust = steps.findIndex(s => s.events.some(e => e.kind === "dash"));
    expect(steps[gust].mode).toBe("glide");
    expect(speedOf(steps[gust])).toBeGreaterThan(T.dashSpeed * 0.9);
    expect(steps[gust + Math.round(T.dashTime / STEP) + 2].mode).toBe("glide");
    expect(landing(steps).z).toBeGreaterThan(landing(glide(tall, GT)).z + 0.8);
  });

  it("splashes over water with no land and puts you back on the bank", () => {
    const steps = glide(sea, GT);
    const out = events(steps);
    expect(out).toEqual(expect.arrayContaining(["glide", "furl", "splash", "respawn"]));
    expect(out.indexOf("furl")).toBe(out.indexOf("splash") - 1);
    const end = steps.at(-1)!;
    expect(sea.wet(end.x, end.z)).toBe(false);
  });

  it("catches a ledge in reach and mantles up", () => {
    // Off the 1.5u cliff toward a 3u bank three tiles out: the glide meets its face just under the top.
    const w = grid(12, 70, (_x, z) => [z <= 0 ? CLIFF_LEVELS : z >= 4 ? 2 * CLIFF_LEVELS : 0, G]);
    const out = events(glide(w, GT));
    expect(out).toEqual(expect.arrayContaining(["glide", "furl", "mantle"]));
    expect(out.indexOf("furl")).toBe(out.indexOf("mantle") - 1);
  });

  it("follows the same path at 30, 60 and 144 Hz", () => {
    // Inputs change on frame boundaries all three rates share (sixths of a second): run, jump at 9/6 s and hold it
    // to 10/6, press again at 11/6 and hold, gust at 13/6, turn at 15/6, off the 6u cliff.
    const path = (fps: number) => {
      const sim = createMoveSim(createMoveState(0, -10.8, tall));
      const kinds: string[] = [], frame = (sixths: number) => Math.round((sixths / 6) * fps);
      for (let f = 0; f < fps * 6; f++) {
        kinds.push(...advanceMove(sim, { ...NO_INPUT, z: 1, x: f >= frame(15) ? 1 : 0, jump: (f >= frame(9) && f < frame(10)) || f >= frame(11),
          jumpPressed: f === frame(9) || f === frame(11), dashPressed: f === frame(13) }, 1 / fps, tall, GT).map(e => e.kind));
      }
      return { kinds, end: interpolated(sim) };
    };
    const ref = path(144);
    expect(ref.kinds).toEqual(expect.arrayContaining(["glide", "dash", "furl", "land"]));
    for (const fps of [30, 60]) {
      const p = path(fps);
      expect(p.kinds).toEqual(ref.kinds);
      p.end.forEach((v, i) => expect(v).toBeCloseTo(ref.end[i], 6));
    }
  });

  it("in the lab's glide lane: off the tower over the river, the island and the sea gap to the beach; without the leaf, short", () => {
    const w = islandOf(course()), lane = { from: GLIDE_SPAWN, edge: 28.4 }; // water is a wall on foot: jump from the lip
    const leaf = glide(w, GT, lane), end = leaf.at(-1)!;
    expect(events(leaf)).not.toContain("splash");
    expect(end.mode).toBe("ground");
    expect(end.z).toBeGreaterThan(38.5); // the beach
    // A jump reaches the island at most (afterwards the curved coast can steer the walk onto the causeway beside it).
    expect(glide(w, T, lane).find(s => s.events.some(e => e.kind === "land"))!.z).toBeLessThan(34);
    // The dev route pilot (evidence) flies it too, and with the gust.
    for (const move of ["glide", "glide-gust"] as const) {
      const pilot = routePilot([{ to: [-18, 28.15], move, r: 0.2 }, { to: [-18, 42], r: 0.5 }]), out: string[] = [];
      let s = createMoveState(GLIDE_SPAWN[0], GLIDE_SPAWN[1], w);
      for (let input = pilot(s, STEP), n = 0; input && n < 1200; input = pilot(s, STEP), n++) { s = stepMove(s, { ...NO_INPUT, ...input }, STEP, w, GT); out.push(...kinds(s.events)); }
      expect(out, move).toEqual(expect.arrayContaining(["glide", "furl", "land", ...(move === "glide-gust" ? ["dash"] : [])]));
      expect(out).not.toContain("splash");
      expect(s.z, move).toBeGreaterThan(38.5);
    }
  });

  it("never grounds on water, ends inside something or gets stuck in the glide lane, fuzzed", () => {
    const w = islandOf(course());
    let seed = 13;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (const [sx, sz] of [GLIDE_SPAWN, [-16.5, 28], [-19.5, 27.5], [-14, 33], [-18, 40]] as [number, number][]) for (let run = 0; run < 4; run++) {
      let s = createMoveState(sx, sz, w), input: Partial<MoveInput> = {};
      s = drive(s, w, 4, time => {
        if (Math.round(time / STEP) % 20 === 0) {
          const a = rand() * Math.PI * 2;
          input = { x: Math.sin(a), z: Math.cos(a), sprint: rand() < 0.5, jump: rand() < 0.7, jumpPressed: rand() < 0.5, dashPressed: rand() < 0.2 };
        } else input = { ...input, jumpPressed: false, dashPressed: false };
        return input;
      }, q => {
        const where = `${sx},${sz} run ${run} at ${q.x.toFixed(2)},${q.z.toFixed(2)} y ${q.y.toFixed(2)} ${q.mode}`;
        if (q.mode === "ground" || q.mode === "skid" || q.mode === "roll" || q.mode === "recover") {
          expect(w.wet(q.x, q.z), `on water: ${where}`).toBe(false);
          expect(w.top(q.x, q.z), `inside: ${where}`).toBeLessThanOrEqual(q.y + T.stepUp);
        } else if (q.mode === "air" || q.mode === "glide") expect(w.top(q.x, q.z), `in the air inside: ${where}`).toBeLessThanOrEqual(q.y + 0.21);
      }, GT);
      s = drive(s, w, 2, () => ({}), undefined, GT);
      let free = 0;
      for (let a = 0; a < 8; a++) {
        const e = drive(s, w, 0.4, () => ({ x: Math.sin((a * Math.PI) / 4), z: Math.cos((a * Math.PI) / 4) }), undefined, GT);
        if (Math.hypot(e.x - s.x, e.z - s.z) > 0.25) free++;
      }
      expect(free, `stuck: ${sx},${sz} run ${run} at ${s.x.toFixed(2)},${s.z.toFixed(2)} (${s.mode})`).toBeGreaterThanOrEqual(2);
    }
  });

  it("with the glider off (not owned, or this area), the kit is exactly as before: no glide values reach it", () => {
    const off: MoveTuning = { ...T, glider: 0, glideSpeed: 30, glideEase: 0.1, glideSink: 0.1, glideOpen: 0.5, glideTurn: 20 };
    for (const opts of [{}, { sprint: true }, { then: (s: MoveState, i: Partial<MoveInput>) => ({ ...i, dashPressed: true }) }]) {
      const a = glide(tall, T, opts), b = glide(tall, off, opts);
      expect(a.map(s => s.mode)).not.toContain("glide");
      expect(b).toEqual(a);
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
  it("goes round in a scripted lap: long jumps over the rivers, two mantles, the 3u drop rolled, never a splash", () => {
    const w = islandOf(course()), pilot = routePilot(), events: MoveEvent[] = [];
    let s = createMoveState(COURSE_SPAWN[0], COURSE_SPAWN[1], w), lap = NEW_LAP, time = 0;
    for (let input = pilot(s, STEP); input && time < 60; input = pilot(s, STEP)) {
      s = stepMove(s, { ...NO_INPUT, ...input }, STEP, w);
      time += STEP;
      lap = lapStep(lap, gateAt(s.x, s.z), time);
      events.push(...s.events);
    }
    const k = kinds(events);
    expect(lap.last).not.toBeNull();
    expect(lap.last!).toBeLessThan(25);
    expect(k.filter(e => e === "long").length).toBeGreaterThanOrEqual(3);
    expect(k.filter(e => e === "mantle")).toHaveLength(2);
    expect(events.find(e => e.kind === "roll")?.drop).toBeCloseTo(3, 1);
    expect(k).not.toContain("splash");
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

describe("momentum (David, 2026-10-01): kept while you chain tech, lost only on plain ground", () => {
  /** Speeds and events of a run; `script` gives the input at each step. */
  const record = (w: MoveWorld, s0: MoveState, seconds: number, script: Script, t: MoveTuning = T) => {
    const steps: MoveState[] = [];
    drive(s0, w, seconds, script, q => steps.push(q), t);
    return { steps, events: steps.flatMap(q => q.events), speeds: steps.map(speedOf), end: steps.at(-1)! };
  };
  const firstAt = (steps: MoveState[], kind: string) => steps.findIndex(q => q.events.some(e => e.kind === kind));

  it("a dash keeps a high speed after its burst; with nothing after it on the ground, it holds for the grace and then bleeds quickly", () => {
    const { steps, speeds } = record(flat, createMoveState(0, 0, flat), 1.5, time => ({ z: 1, dashPressed: at(time, 0) }));
    const end = Math.round(T.dashTime / STEP) - 1, kept = T.dashSpeed * T.dashExit;
    expect(speeds[end]).toBeCloseTo(kept, 5);
    expect(kept).toBeGreaterThan(topSpeed(T));
    expect(kept).toBeLessThan(T.momentumCeiling);
    // Held through the grace...
    const graceEnd = end + Math.round(T.keepGrace / STEP);
    for (let i = end; i < graceEnd; i++) expect(speeds[i]).toBeCloseTo(kept, 5);
    expect(steps.slice(end, graceEnd).some(q => q.bleed)).toBe(false);
    // ...then bleeds back to a walk, quickly (well under a second) and visibly (the bleed flag for the lab's readout).
    expect(steps[graceEnd + 2].bleed).toBe(true);
    const walking = speeds.findIndex((v, i) => i > graceEnd && v <= T.walkSpeed + 1e-6);
    expect((walking - graceEnd) * STEP).toBeLessThan(0.6);
  });

  it("a dash then a slide or a jump inside the window keeps it; later, it has bled", () => {
    const after = (wait: number, move: "slide" | "jump") => {
      const press = T.dashTime + wait;
      const { steps } = record(flat, createMoveState(0, 0, flat), 1, time => ({ z: 1, dashPressed: at(time, 0), sneak: move === "slide" && time >= press, jump: move === "jump" && time >= press, jumpPressed: move === "jump" && at(time, press) }));
      const i = steps.findIndex(q => q.events.some(e => ["slide", "dashslide", "dashjump", "jump", "long"].includes(e.kind)));
      return { speed: i < 0 ? 0 : speedOf(steps[i]), kind: i < 0 ? "" : steps[i].events.at(-1)!.kind };
    };
    const kept = T.dashSpeed * T.dashExit;
    expect(after(0.05, "slide")).toEqual({ speed: expect.closeTo(kept - T.slideFriction * STEP, 5), kind: "dashslide" }); // (a step of slide friction)
    expect(after(0.05, "jump")).toEqual({ speed: expect.closeTo(kept, 5), kind: "dashjump" });
    expect(after(T.keepGrace - 0.02, "slide").speed).toBeCloseTo(kept - T.slideFriction * STEP, 5); // a slightly late slide still catches it
    expect(after(T.keepGrace + 0.25, "slide").speed).toBeLessThan(kept - 3);
    expect(after(T.keepGrace + 0.25, "jump").speed).toBeLessThan(kept - 3);
  });

  it("the air keeps horizontal speed, with the stick held or let go", () => {
    for (const stick of [1, 0]) {
      const { steps } = record(flat, createMoveState(0, 0, flat), 1.2, time => ({ z: time < T.dashTime + 0.05 ? 1 : stick, dashPressed: at(time, 0), jump: time >= T.dashTime + 0.05 && time < 0.4, jumpPressed: at(time, T.dashTime + 0.05) }));
      const air = steps.filter(q => q.mode === "air");
      expect(air.length).toBeGreaterThan(20);
      for (const q of air) expect(speedOf(q)).toBeCloseTo(T.dashSpeed * T.dashExit, 5);
    }
  });

  it("a landing with no tech bleeds after the grace; a landing into a slide or a hop keeps the speed", () => {
    // Off a dash-jump: land and let go of everything but the stick (and sprint), hold the crouch key, or keep Space held.
    const land = (then: Partial<MoveInput>) => record(flat, createMoveState(0, 0, flat), 1.6, time => ({ z: 1, sprint: true, dashPressed: at(time, 0),
      jump: at(time, T.dashTime + 0.02) || (time > T.dashTime + 0.1 && !!then.jump), jumpPressed: at(time, T.dashTime + 0.02), sneak: time > T.dashTime + 0.1 && !!then.sneak }));
    const plain = land({}), slide = land({ sneak: true }), hop = land({ jump: true });
    const landed = (r: ReturnType<typeof land>) => firstAt(r.steps, "land");
    const atLanding = speedOf(plain.steps[landed(plain)]);
    expect(atLanding).toBeGreaterThan(topSpeed(T));
    // Plain: held for the grace, then down to the sprint within a short beat.
    const i = landed(plain), grace = Math.round(T.keepGrace / STEP);
    expect(plain.speeds[i + grace - 1]).toBeCloseTo(atLanding, 5);
    expect(plain.speeds[i + grace + Math.round(0.3 / STEP)]).toBeCloseTo(T.sprintSpeed, 5);
    // Into a slide: the landing's speed (plus a little), no roll.
    const ls = slide.steps[landed(slide)];
    expect(kinds(ls.events)).toEqual(["land", "landslide"]);
    expect(speedOf(ls)).toBeCloseTo(atLanding + T.techBoost, 5);
    // Into a hop: off again on the landing step at the same speed.
    const h = hop.steps[landed(hop)];
    expect(kinds(h.events)).toEqual(["land", "hop"]);
    expect(speedOf(h)).toBeCloseTo(atLanding, 5);
  });
});

describe("the slide (row 274)", () => {
  const sprinted = () => drive(createMoveState(0, 0, flat), flat, 2, () => ({ z: 1, sprint: true }));
  const slideOn = (w: MoveWorld, s0: MoveState, seconds: number, script: Script = () => ({ z: 1, sneak: true }), t: MoveTuning = T) => {
    const steps: MoveState[] = [];
    drive(s0, w, seconds, script, q => steps.push(q), t);
    return steps;
  };
  const ev = (steps: MoveState[]) => steps.flatMap(q => kinds(q.events));

  it("crouches at a walk or slower (crouch-walking at sneak speed, slow enough that bugs stay), slides faster than that", () => {
    const crouch = slideOn(flat, createMoveState(0, 0, flat), 2, () => ({ z: 1, sneak: true }));
    expect(ev(crouch)).not.toContain("slide");
    expect(crouch.at(-1)!.crouch).toBe(true);
    expect(speedOf(crouch.at(-1)!)).toBeCloseTo(T.sneakSpeed, 3);
    expect(speedOf(crouch.at(-1)!)).toBeLessThan(SNEAK_SPEED);
    expect(bugReaction(2, speedOf(crouch.at(-1)!), "rare")).not.toBe("flee");
    // At a walk, pressing it crouches (no slide); from a sprint, it slides at the sprint's speed.
    const walk = slideOn(flat, drive(createMoveState(0, 0, flat), flat, 1, () => ({ z: 1 })), 0.5);
    expect(ev(walk)).not.toContain("slide");
    const run = slideOn(flat, sprinted(), 0.1);
    expect(run[0].mode).toBe("slide");
    expect(kinds(run[0].events)).toEqual(["slide"]);
    expect(speedOf(run[0])).toBeGreaterThan(T.sprintSpeed - 0.1);
  });

  it("decays slowly on flat ground: about 1 to 1.5 s from a sprint, then stands up into the crouch", () => {
    const steps = slideOn(flat, sprinted(), 3);
    const stand = steps.findIndex(q => q.events.some(e => e.kind === "stand"));
    expect(stand * STEP).toBeGreaterThan(1);
    expect(stand * STEP).toBeLessThan(1.5);
    expect(steps[stand].mode).toBe("ground");
    expect(steps.at(-1)!.crouch).toBe(true);
    // Every step in between is a slide, wearing down evenly.
    for (let i = 1; i < stand; i++) expect(speedOf(steps[i])).toBeLessThan(speedOf(steps[i - 1]));
  });

  it("ends the moment the key is let go, standing up into the run with the speed held for the grace", () => {
    const steps = slideOn(flat, sprinted(), 0.6, time => ({ z: 1, sprint: true, sneak: time < 0.3 }));
    const stand = steps.findIndex(q => q.events.some(e => e.kind === "stand"));
    expect(stand * STEP).toBeCloseTo(0.3, 1);
    expect(steps[stand].keep).toBeGreaterThan(0);
    expect(steps.at(-1)!.mode).toBe("ground");
  });

  it("steers gently", () => {
    const steps = slideOn(flat, sprinted(), 0.8, () => ({ x: 1, sneak: true }));
    const heading = (q: MoveState) => Math.atan2(q.vx, q.vz);
    expect(heading(steps[Math.round(0.1 / STEP)])).toBeLessThan(0.35); // no snap
    expect(heading(steps.at(-1)!)).toBeGreaterThan(0.8); // but it does come round
  });

  // A two-level plateau (1.5u) for z >= 4, reached by a four-cell ramp at z 0..3 (grade 0.375), and a steep two-cell one.
  const long = grid(12, 50, (_x, z) => (z >= 0 && z <= 3 ? [0, Surface.Ramp] : [z >= 4 ? CLIFF_LEVELS : 0, G]));
  const steep = grid(12, 50, (_x, z) => (z >= 0 && z <= 1 ? [0, Surface.Ramp] : [z >= 2 ? CLIFF_LEVELS : 0, G]));
  // Terrain: a staircase of one-level banks (blended slopes, no kit pieces) falling toward -z.
  const banks = grid(12, 50, (_x, z) => [Math.max(0, Math.min(4, Math.floor((z + 2) / 3))), G]);

  it("reads the ground's real slope: ramps, blended banks; cliffs and walls are edges, not slopes", () => {
    expect(slopeAt(long, 0, 1.5)[1]).toBeCloseTo(1.5 / 4, 2);
    expect(slopeAt(steep, 0, 0.5)[1]).toBeCloseTo(0.75, 2);
    expect(slopeAt(flat, 3, 3)).toEqual([0, 0]);
    expect(slopeAt(banks, 0, 2.5)[1]).toBeGreaterThan(0.1);
    const cliff = grid(12, 20, (_x, z) => [z >= 2 ? CLIFF_LEVELS : 0, G]);
    expect(slopeAt(cliff, 0, 1.5)[1]).toBe(0);
  });

  it("speeds up downhill and slows uphill, against the same slide on the flat", () => {
    // From a sprint on the high ground, a slide down toward -z: past the bottom it is faster than the same slide on flat ground.
    const down = (w: MoveWorld) => slideOn(w, drive(createMoveState(0, 22, w, Math.PI), w, 1.6, () => ({ z: -1, sprint: true })), 2.5, () => ({ z: -1, sneak: true })); // slides start about 5 tiles above the steep ramp's lip
    const speedAt = (steps: MoveState[], z: number) => speedOf(steps.find(q => q.z <= z)!);
    for (const w of [long, steep, banks]) expect(speedAt(down(w), -1.5)).toBeGreaterThan(speedAt(down(flat), -1.5) + 1);
    // On the way down it gains, more than its friction takes: the steep ramp most, the long ramp and the banks less.
    for (const [w, top, bottom, gain] of [[long, 3.4, -0.7, 1], [steep, 1.4, -0.7, 1.2], [banks, 10, -1, 0.6]] as const) expect(speedAt(down(w), bottom)).toBeGreaterThan(speedAt(down(w), top) + gain);
    // Uphill: the slide up the long ramp slows faster than on flat ground and stands up sooner.
    const up = slideOn(long, drive(createMoveState(0, -22, long), long, 1.5, () => ({ z: 1, sprint: true })), 3);
    const flatUp = slideOn(flat, drive(createMoveState(0, -22, flat), flat, 1.5, () => ({ z: 1, sprint: true })), 3);
    const standAt = (steps: MoveState[]) => steps.findIndex(q => q.events.some(e => e.kind === "stand"));
    expect(standAt(up)).toBeLessThan(standAt(flatUp));
  });

  it("goes past the ceiling only downhill, and bleeds back under it fast once off the slope", () => {
    // A slide started at the ceiling at the top of the steep ramp: faster on the way down, back to the ceiling within 0.25 s after.
    const top = { ...createMoveState(0, 3, steep, Math.PI) };
    const s0: MoveState = { ...top, vz: -T.momentumCeiling, mode: "slide", slid: true };
    const steps = slideOn(steep, s0, 1, () => ({ z: -1, sneak: true }));
    expect(Math.max(...steps.map(speedOf))).toBeGreaterThan(T.momentumCeiling + 0.5);
    const off = steps.findIndex(q => q.z < -1.2);
    expect(speedOf(steps[off + Math.round(0.25 / STEP)])).toBeLessThanOrEqual(T.momentumCeiling + 1e-6);
    // On flat ground nothing gets past it.
    const flatSteps = slideOn(flat, { ...createMoveState(0, 0, flat), vz: T.momentumCeiling + 4, mode: "slide", slid: true }, 0.3);
    expect(speedOf(flatSteps[Math.round(0.2 / STEP)])).toBeLessThanOrEqual(T.momentumCeiling);
  });

  it("dash into a slide: holding the key through the dash slides at the dash's kept speed once the burst plays out", () => {
    const steps = slideOn(flat, createMoveState(0, 0, flat), 0.6, time => ({ z: 1, sneak: true, dashPressed: at(time, 0) }));
    const i = steps.findIndex(q => q.events.some(e => e.kind === "dashslide"));
    expect(i * STEP).toBeCloseTo(T.dashTime, 1);
    expect(steps[i].events.find(e => e.kind === "dashslide")!.speed).toBeCloseTo(T.dashSpeed * T.dashExit, 5);
    expect(ev(steps)).not.toContain("slide");
  });

  it("slide-jump: keeps the slide's speed (plus a little) on a lower, longer arc than the long jump", () => {
    const fromSlide = (sneak: boolean) => {
      let s = drive(sprinted(), flat, 0.15, () => ({ z: 1, sneak, sprint: !sneak }));
      const v0 = speedOf(s), z0 = s.z;
      let peak = 0, kind = "";
      s = drive(s, flat, 0.02, time => ({ z: 1, sneak, jump: true, jumpPressed: at(time, 0) }), q => { kind ||= q.events.find(e => e.kind !== "land")?.kind ?? ""; });
      let guard = 0;
      while (s.mode === "air" && guard++ < 400) { s = stepMove(s, { ...NO_INPUT, z: 1, jump: s.vy > 0 }, STEP, flat); peak = Math.max(peak, s.y); }
      return { v0, kind, peak, distance: s.z - z0, landed: speedOf(s) };
    };
    const sj = fromSlide(true), long = fromSlide(false);
    expect(sj.kind).toBe("slidejump");
    expect(long.kind).toBe("long");
    expect(sj.landed).toBeCloseTo(sj.v0 + T.techBoost, 6);
    expect(sj.peak).toBeLessThan(T.jumpHeight);
    expect(sj.peak).toBeGreaterThan(long.peak);
    expect(sj.distance).toBeGreaterThan(long.distance + 0.4);
  });

  it("land into a slide off a drop: no roll and no recovery, at the landing's speed; without the key it rolls", () => {
    const terrace = grid(12, 44, (_x, z) => [z <= 0 ? 2 * CLIFF_LEVELS : 0, G]); // 3u, steeper than the grid allows, to measure it
    const off = (sneak: boolean) => slideOn(terrace, createMoveState(0, -16, terrace), 3, (_t, q) => ({ z: 1, sprint: true, sneak: sneak && q.z > -4 }));
    const withKey = ev(off(true)), without = ev(off(false));
    expect(withKey).toContain("slide"); // it slides along the plateau first, then off the edge
    expect(withKey).toContain("landslide");
    expect(withKey).not.toContain("roll");
    expect(withKey).not.toContain("recover");
    expect(without).toContain("roll");
  });

  it("hop, slide, hop: each link keeps the speed and adds at most a little; a whole chain stays under the ceiling", () => {
    // Dash, slide, jump, land into a slide, jump, ... for four seconds: the speed never passes the ceiling.
    const chain: MoveState[] = [];
    let phase = "dash", s = createMoveState(0, 0, flat);
    for (let i = 0; i < 4 / STEP; i++) {
      const input: Partial<MoveInput> = { z: 1, sprint: true };
      if (phase === "dash") { input.dashPressed = true; phase = "toSlide"; }
      else if (phase === "toSlide") { input.sneak = true; if (s.mode === "slide" && s.modeT > 0.08) { input.jump = input.jumpPressed = true; phase = "air"; } }
      else if (phase === "air") { input.sneak = true; if (s.mode === "slide") phase = "toSlide"; }
      s = stepMove(s, { ...NO_INPUT, ...input }, STEP, flat);
      chain.push(s);
    }
    const links = chain.filter(q => q.events.some(e => e.kind === "slidejump" || e.kind === "landslide"));
    expect(links.length).toBeGreaterThan(8);
    let last = speedOf(chain[0]);
    for (const q of chain) {
      const v = speedOf(q);
      expect(v).toBeLessThanOrEqual(T.momentumCeiling + 1e-9);
      expect(v - last).toBeLessThanOrEqual(T.techBoost + 1e-9);
      last = v;
    }
  });

  it("follows the same path at 30, 60 and 144 Hz through a full chain: dash, slide, jump, land into a slide, jump", () => {
    const path = (fps: number) => {
      const sim = createMoveSim(createMoveState(0, 0, flat));
      const out: string[] = [], frame = (sixths: number) => Math.round((sixths / 6) * fps);
      const speeds: number[] = [];
      for (let f = 0; f < fps * 4; f++) {
        const jumpAt = f === frame(4) || f === frame(9);
        out.push(...advanceMove(sim, { ...NO_INPUT, z: 1, sprint: true, dashPressed: f === frame(1), sneak: f >= frame(1), jump: jumpAt || (f > frame(4) && f < frame(5)), jumpPressed: jumpAt }, 1 / fps, flat).map(e => e.kind));
        if ((f + 1) % (fps / 6) === 0) speeds.push(speedOf(sim.state));
      }
      return { out, end: interpolated(sim), speeds };
    };
    const ref = path(144);
    expect(ref.out).toEqual(expect.arrayContaining(["dash", "dashslide", "slidejump", "land", "landslide"]));
    for (const fps of [30, 60]) {
      const p = path(fps);
      expect(p.out).toEqual(ref.out);
      p.end.forEach((v, i) => expect(v).toBeCloseTo(ref.end[i], 6));
      p.speeds.forEach((v, i) => expect(v).toBeCloseTo(ref.speeds[i], 6));
    }
  });

  it("slide off a cliff into the glider: the slide's speed carries into the glide and eases to glide speed, further than walking off", () => {
    const GT: MoveTuning = { ...T, glider: 1 }, cliff = grid(12, 70, (_x, z) => [z <= 0 ? 4 * CLIFF_LEVELS : 0, G]); // 6u, to measure it
    const off = (sneak: boolean, sprint = true) => {
      const steps: MoveState[] = [];
      let pressed = false;
      drive(createMoveState(0, -12, cliff), cliff, 4, (_t, q) => {
        const press = !pressed && q.mode === "air" && q.coyote <= 0 && q.y < 5.6; // past coyote time (a press there is a slide-jump)
        pressed ||= press;
        return { z: 1, sprint, sneak: sneak && q.z > -2, jump: pressed, jumpPressed: press };
      }, q => steps.push(q), GT);
      return steps;
    };
    const slid = off(true), walked = off(false, false);
    const open = (steps: MoveState[]) => steps.find(q => q.events.some(e => e.kind === "glide"))!;
    expect(slid.flatMap(q => kinds(q.events))).toEqual(expect.arrayContaining(["slide", "glide", "furl", "land"]));
    expect(speedOf(open(slid))).toBeGreaterThan(GT.glideSpeed + 2);
    expect(speedOf(slid.find(q => q.mode === "glide" && q.modeT > 1.5)!)).toBeCloseTo(GT.glideSpeed, 0);
    const landed = (steps: MoveState[]) => steps.find((q, i) => i > 0 && q.mode === "ground" && steps[i - 1].mode === "glide")!.z;
    expect(landed(slid)).toBeGreaterThan(landed(walked) + 0.5);
  });

  it("in the lab's slide lane: only a slide-jump clears the 7-tile gap, the launch carries a slide off the lip, the long ramp and the banks speed one up", () => {
    const w = islandOf(course());
    const fly = (route: RouteStep[], from: [number, number]) => {
      const pilot = routePilot(route), out: MoveEvent[] = [];
      let s = createMoveState(from[0], from[1], w), top = 0;
      for (let input = pilot(s, STEP), n = 0; input && n < 2400; input = pilot(s, STEP), n++) { s = stepMove(s, { ...NO_INPUT, ...input }, STEP, w); out.push(...s.events); top = Math.max(top, speedOf(s)); }
      return { s, out, k: kinds(out), top };
    };
    const up: RouteStep[] = [{ to: [17.5, 27.5], sprint: true }], far = SLIDE_GAP[3] + 0.5, lip = SLIDE_GAP[2] - 0.5;
    expect(lip).toBe(44.5);
    const across = fly([...up, { to: [17.5, 40], sprint: true, move: "dash", r: 0.4 }, { to: [17.5, 44.2], crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56] }], SLIDE_SPAWN);
    expect(across.k).toEqual(expect.arrayContaining(["dashslide", "slidejump"]));
    expect(across.k).not.toContain("splash");
    expect(across.k).not.toContain("mantle");
    expect(across.out.find(e => e.kind === "land")!.z).toBeGreaterThan(far - 0.35);
    for (const short of [
      [...up, { to: [17.5, 43.9], sprint: true, move: "jump", r: 0.35 }, { to: [17.5, 56] }], // a long jump
      [...up, { to: [17.5, 38], sprint: true }, { to: [17.5, 44.2], sprint: true, crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56] }], // a sprint's slide-jump
    ] as RouteStep[][]) expect(fly(short, SLIDE_SPAWN).k).toContain("splash");
    // A dash-jump at the lip falls short and at best catches the far ledge (a mantle), never lands across.
    const dj = fly([...up, { to: [17.5, 43.4], sprint: true, move: "dash-jump", r: 0.35 }, { to: [17.5, 56] }], SLIDE_SPAWN);
    expect(dj.k.some(k => k === "mantle" || k === "splash")).toBe(true);
    // The ramp launch: up the tower, dash, slide down its ramp and off the lip: a long way out at speed, into a land-slide.
    const launch = fly([{ to: [10, 33.5], sprint: true, move: "dash", r: 0.3 }, { to: [10, 40.4], crouch: true }, { to: [10, 56], crouch: true }], [10, 27.5]);
    const landed = launch.out.find(e => e.kind === "land")!;
    expect(landed.z).toBeGreaterThan(43);
    expect(landed.speed).toBeGreaterThan(15);
    expect(launch.k).toContain("landslide");
    // The long ramp and the banks: a slide down either goes on much further than the same slide on flat ground (about 10.6 u at slideFriction 4.2).
    for (const x of [3, -3.5]) {
      const r = fly([{ to: [x, 35.5], sprint: true }, { to: [x, 58], crouch: true }], [x, 27.5]);
      const start = r.out.find(e => e.kind === "slide")!, stand = r.out.find(e => e.kind === "stand")!;
      expect(stand.z - start.z, `x ${x}`).toBeGreaterThan(12.5);
    }
  });

  it("walk only (the café): crouching at a walk never slides", () => {
    const out: string[] = [];
    drive(createMoveState(0, 0, flat), flat, 4, time => ({ x: Math.sin(time), z: Math.cos(time), sneak: Math.floor(time * 3) % 2 === 0 }), q => out.push(...kinds(q.events)));
    expect(out.filter(k => k.includes("slide"))).toEqual([]);
  });

  it("never grounds on water, ends inside something or gets stuck sliding at walls, cliff edges, ramps and water, fuzzed", () => {
    const objects: MapObject[] = [{ id: "cafe", kind: "landmark", x: 3.5, z: -3.4 }, { id: "r1", kind: "rock", x: -2, z: 2, model: "rock-a" }];
    const edges = grid(20, 20, (x, z) => (x === -3 && (z === 4 || z === 5) ? [0, Surface.Ramp] : [x >= 1 && z >= 1 ? CLIFF_LEVELS : x <= -4 && z >= 4 ? CLIFF_LEVELS : 0, x <= -7 || z <= -8 ? W : G]), objects);
    for (const [w, starts] of [[edges, [[-1, -1], [0, 0], [-2, 4.5], [-5, -5]]], [islandOf(course()), [[-17, -10], [6.5, 21], [12, -20], [-18, 26], [15, 1], [17.5, 30], [17.5, 43], [10, 33], [3, 35], [-3.5, 36], [17.5, 53]]]] as const) {
      let seed = 23;
      const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (const [sx, sz] of starts) for (let run = 0; run < 4; run++) {
        let s = createMoveState(sx, sz, w), input: Partial<MoveInput> = {};
        s = drive(s, w, 4, time => {
          if (Math.round(time / STEP) % 20 === 0) {
            const a = rand() * Math.PI * 2;
            input = { x: Math.sin(a), z: Math.cos(a), sprint: rand() < 0.7, sneak: rand() < 0.6, jump: rand() < 0.4, jumpPressed: rand() < 0.3, dashPressed: rand() < 0.3 };
          } else input = { ...input, jumpPressed: false, dashPressed: false };
          return input;
        }, q => {
          const where = `${sx},${sz} run ${run} at ${q.x.toFixed(2)},${q.z.toFixed(2)} y ${q.y.toFixed(2)} ${q.mode}`;
          if (q.mode === "ground" || q.mode === "slide" || q.mode === "skid" || q.mode === "roll" || q.mode === "recover") {
            expect(w.wet(q.x, q.z), `on water: ${where}`).toBe(false);
            expect(w.top(q.x, q.z), `inside: ${where}`).toBeLessThanOrEqual(q.y + T.stepUp);
          }
          expect(speedOf(q), `too fast: ${where}`).toBeLessThan(T.momentumCeiling + T.downhillCeiling);
        });
        s = drive(s, w, 2, () => ({}));
        let free = 0;
        for (let a = 0; a < 8; a++) {
          const e = drive(s, w, 0.4, () => ({ x: Math.sin((a * Math.PI) / 4), z: Math.cos((a * Math.PI) / 4) }));
          if (Math.hypot(e.x - s.x, e.z - s.z) > 0.25) free++;
        }
        expect(free, `stuck: ${sx},${sz} run ${run} at ${s.x.toFixed(2)},${s.z.toFixed(2)} (${s.mode})`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("a slide into a wall bonks and stands: never stuck, and the crouch walks away", () => {
    const wall = standWorld(() => 0, (_x, z) => z < 3, () => false);
    const steps = slideOn(wall, drive(createMoveState(0, -20, wall), wall, 2, () => ({ z: 1, sprint: true })), 2, () => ({ z: 1, sneak: true }));
    expect(ev(steps)).toContain("bonk");
    expect(steps.at(-1)!.mode).toBe("ground");
    expect(drive(steps.at(-1)!, wall, 0.5, () => ({ z: -1, sneak: true })).z).toBeLessThan(steps.at(-1)!.z - 0.5);
  });
});
