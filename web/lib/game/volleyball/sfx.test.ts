import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VB_SFX } from "@/lib/game/audio";
import { BODY, FIRE_AT, GRADE, HEAT_AT, chargeCue, cuesFor, type SfxContext } from "./sfx";
import type { VbFx } from "./fxBus";
import type { ContactKind, Timing } from "./match";

const ctx = (o: Partial<SfxContext> = {}): SfxContext => ({ me: { x: 0, z: -4 }, heat: 1, rand: () => 0.5, ...o });
const contact = (how: ContactKind, timing: Timing, who = 0, x = 0, z = -4): VbFx => ({ kind: "contact", who, team: who < 2 ? 0 : 1, how, timing, quality: 0.8, x, y: 1, z, speed: 10 });
const KINDS: ContactKind[] = ["serve", "bump", "set", "jumpset", "spike", "block", "dig"];
const GRADES: Timing[] = ["perfect", "good", "early", "late"];

describe("the match's sounds", () => {
  it("every sound file is on disk", () => {
    for (const n of VB_SFX) expect(existsSync(join(__dirname, "../../../public/audio/sfx", `${n}.ogg`)), n).toBe(true);
  });
  it("every contact plays its kind's body and its grade's layer", () => {
    for (const how of KINDS) for (const t of GRADES) {
      const q = cuesFor(contact(how, t), ctx());
      expect(q[0].name, `${how} ${t}`).toBe(BODY[how].name);
      expect(q[1].name).toBe(GRADE[t].layer);
    }
  });
  it("the four grades sound different: perfect loudest with the chime, early higher and late lower, both softer", () => {
    const [p, g, e, l] = GRADES.map(t => cuesFor(contact("spike", t), ctx()));
    expect(new Set([p[1].name, g[1].name, e[1].name, l[1].name]).size).toBe(4);
    expect(p[0].gain).toBeGreaterThan(g[0].gain);
    expect(g[0].gain).toBeGreaterThan(e[0].gain);
    expect(e[0].rate).toBeGreaterThan(1);
    expect(l[0].rate).toBeLessThan(1);
  });
  it("the spike is the loudest hit", () => {
    for (const how of KINDS) expect(BODY.spike.gain).toBeGreaterThanOrEqual(BODY[how].gain);
  });
  it("a bot across the court is quieter than you", () => {
    const mine = cuesFor(contact("bump", "good"), ctx())[0].gain, far = cuesFor(contact("bump", "good", 3, 0, 6), ctx())[0].gain;
    expect(far).toBeLessThan(mine);
    expect(far).toBeGreaterThan(0);
  });
  it("pitch spreads a little either way", () => {
    const lo = cuesFor(contact("bump", "good"), ctx({ rand: () => 0 }))[0].rate, hi = cuesFor(contact("bump", "good"), ctx({ rand: () => 1 }))[0].rate;
    expect(hi - lo).toBeGreaterThan(0.05);
    expect(hi - lo).toBeLessThan(0.1);
  });
  it("the rally heats up: a shimmer from the 4th touch, the fire at the 6th, none on the serve", () => {
    expect(cuesFor(contact("bump", "good"), ctx({ heat: 3 })).map(q => q.name)).not.toContain("vb-heat");
    expect(cuesFor(contact("bump", "good"), ctx({ heat: HEAT_AT[0] })).map(q => q.name)).toContain("vb-heat");
    expect(cuesFor(contact("set", "good"), ctx({ heat: FIRE_AT })).map(q => q.name)).toContain("vb-fire");
    expect(cuesFor(contact("serve", "good"), ctx({ heat: FIRE_AT })).map(q => q.name)).not.toContain("vb-fire");
  });
  it("the ball down: in, the sand explodes louder the faster; out, the drop and the whistle", () => {
    const slow = cuesFor({ kind: "land", x: 0, z: 3, in: true, speed: 4, heat: 2 }, ctx())[0], fast = cuesFor({ kind: "land", x: 0, z: 3, in: true, speed: 20, heat: 2 }, ctx())[0];
    expect(slow.name).toBe("vb-boom");
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(cuesFor({ kind: "land", x: 0, z: 9, in: false, speed: 9, heat: 2 }, ctx()).map(q => q.name)).toEqual(["vb-sand", "vb-out"]);
  });
  it("every other effect has its sound", () => {
    const names = (e: VbFx) => cuesFor(e, ctx()).map(q => q.name);
    expect(names({ kind: "net", x: 0, y: 1.5 })).toEqual(["vb-net"]);
    expect(names({ kind: "tape", x: 0, y: 2.1 })).toEqual(["vb-tape"]);
    expect(names({ kind: "takeoff", who: 0, x: 0, y: 0, z: -4 })).toEqual(["vb-takeoff"]);
    expect(names({ kind: "touchdown", who: 0, x: 0, y: 0, z: -4 })).toEqual(["vb-touchdown"]);
    expect(names({ kind: "dive", who: 0, strong: false, x: 0, z: -4, dx: 0, dz: 1 })).toEqual(["vb-dive"]);
    expect(names({ kind: "dive", who: 0, strong: true, x: 0, z: -4, dx: 0, dz: 1 })).toEqual(["vb-slide"]);
    expect(names({ kind: "toss", who: 0, power: 0.5, max: false })).toEqual(["vb-toss"]);
    expect(names({ kind: "toss", who: 0, power: 0.97, max: true })).toEqual(["vb-toss", "vb-max"]);
    expect(names({ kind: "whiff", who: 0 })).toEqual(["vb-whiff"]);
    expect(names({ kind: "whiff", who: 2 })).toEqual([]);
    expect(names({ kind: "point", team: 0, why: "in", x: 0, z: 3, heat: 3 })).toEqual(["vb-point"]);
    expect(names({ kind: "point", team: 1, why: "in", x: 0, z: -3, heat: 3 })).toEqual(["vb-point-them"]);
    expect(names({ kind: "win", team: 0 })).toEqual(["vb-win"]);
    expect(names({ kind: "call", who: 1 })).toEqual(["vb-call"]);
  });
  it("the serve's charge climbs with the meter", () => {
    expect(chargeCue(0.9).rate).toBeGreaterThan(chargeCue(0.2).rate);
    expect(chargeCue(0.99).gain).toBeGreaterThan(chargeCue(0.5).gain);
    expect(chargeCue(1).gain).toBeLessThanOrEqual(1);
  });
});
