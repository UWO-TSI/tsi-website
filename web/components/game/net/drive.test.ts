import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { WATER_DROP } from "@/lib/game/grid";
import type { RemoteEntry, RemotePlayer, RemoteSample } from "@/lib/net/types";
import { castSunShadows, createRig, driveRig, gateMixer, knownClip, type GroundWorld } from "./drive";
import { FULL, HIDDEN, LOD, REDUCED } from "./lod";

/** A test double for one remote (the client core's interpolation is its own concern): `script` writes the sample. */
const player = (p: Partial<RemotePlayer> = {}): RemotePlayer => ({
  sid: 1, uid: "u1", name: "Alex", member: false, look: "", level: 3, family: null, kit: "", mastery: 0, aura: "", frame: null, area: "village",
  away: false, afk: false, mobile: false, showClass: true, typing: false, armed: false, held: "", weapon: "", pose: null, seat: "", study: "none", studyEnds: 0, ...p,
});
function entry(script: (now: number, out: RemoteSample) => void): RemoteEntry & { calls: number } {
  const e = { sid: 1, player: player(), calls: 0, sample(now: number, out: RemoteSample) { e.calls++; out.eventCount = 0; out.snapped = false; script(now, out); return out; } };
  return e;
}
const at = (o: Partial<RemoteSample>) => (_now: number, out: RemoteSample) => { Object.assign(out, { move: null, pose: null, air: 0, leaf: 0, lift: 0, vx: 0, vy: 0, vz: 0, ...o }); };
const flat = (y = 0): GroundWorld => ({ top: () => y, wet: () => false });
function events(out: RemoteSample, list: [RemoteSample["events"][number]["kind"], number | string][]) {
  list.forEach(([kind, value], i) => Object.assign(out.events[i], { kind, value, t: 0 }));
  out.eventCount = list.length;
}

describe("a remote's frame", () => {
  it("stands the anchor on the floor and lifts the body by its height over it", () => {
    const rig = createRig(entry(at({ x: 2, y: 1.6, z: -3 })));
    rig.anchor.current = new THREE.Group();
    driveRig(rig, 0, flat(0.75), null);
    expect(rig.anchor.current.position.toArray()).toEqual([2, 0.75, -3]);
    expect(rig.motion.lift).toBeCloseTo(0.85);
    expect(rig.feet.current.toArray()).toEqual([2, 1.6, -3]);
    // Below the floor (a bad top, a step down still easing): the anchor goes with them, no negative lift.
    const low = createRig(entry(at({ x: 0, y: 0.2, z: 0 })));
    driveRig(low, 0, flat(0.75), null);
    expect(low.groundY).toBeCloseTo(0.2);
    expect(low.motion.lift).toBe(0);
  });

  it("stands in the water below its line, and keeps the water's top for a splash", () => {
    const wet: GroundWorld = { top: () => 0.1, wet: () => true };
    const rig = createRig(entry(at({ x: 0, y: 0.5, z: 0 })));
    driveRig(rig, 0, wet, null);
    expect(rig.groundY).toBeCloseTo(0.1 - WATER_DROP);
    expect(rig.waterY).toBeCloseTo(0.1);
  });

  it("looks the floor up once while they stand still, again once they move", () => {
    let x = 0;
    const top = vi.fn(() => 0), world: GroundWorld = { top, wet: () => false };
    const rig = createRig(entry((now, out) => at({ x, y: 0, z: 0 })(now, out)));
    for (let i = 0; i < 5; i++) driveRig(rig, i, world, null);
    expect(top).toHaveBeenCalledTimes(1);
    x = 0.5;
    driveRig(rig, 6, world, null);
    expect(top).toHaveBeenCalledTimes(2);
  });

  it("walks at the sample's ground speed, holds a movement state at speed 0, and paces a crouch-walk by its speed", () => {
    const rig = createRig(entry(at({ vx: 3, vz: 4, yaw: 1.2 })));
    driveRig(rig, 0, flat(), null);
    expect(rig.motion.speed).toBeCloseTo(5);
    expect(rig.motion.yaw).toBeCloseTo(1.2);
    for (const move of ["Air", "Fall", "Glide", "Skid", "Slide"] as const) {
      const r = createRig(entry(at({ vx: 6, move, air: 0.4, leaf: move === "Glide" ? 1 : 0 })));
      driveRig(r, 0, flat(), null);
      expect(r.motion.speed, move).toBe(0);
      expect(r.motion.move, move).toBe(move);
      expect(r.motion.air).toBeCloseTo(0.4);
    }
    const crouch = createRig(entry(at({ vx: 2, move: "CrouchWalk" })));
    driveRig(crouch, 0, flat(), null);
    expect(crouch.motion.speed).toBeCloseTo(2);
    expect(crouch.motion.move).toBe("CrouchWalk");
  });

  it("sits at the seat's lift, still, and plays a one-shot on the upper body so it doesn't float off the seat", () => {
    const rig = createRig(entry((now, out) => { at({ x: 5, y: 0.75, z: 4.5, pose: "Sit", lift: 0.12, vx: 0.3 })(now, out); events(out, [["play", "Wave"]]); }));
    rig.lod.tier = REDUCED;
    driveRig(rig, 0, flat(0.75), null);
    expect(rig.seated).toBe(true);
    expect(rig.motion).toMatchObject({ pose: "Sit", speed: 0, lift: 0.12, move: null, upper: "Wave" });
    expect(rig.motion.play).toBeNull();
  });

  it("plays only clips the rig has", () => {
    expect(knownClip("Wave")).toBe(true);
    expect(knownClip("NotAClip")).toBe(false);
    expect(knownClip(3)).toBe(false);
    const rig = createRig(entry((now, out) => { at({})(now, out); events(out, [["play", "NotAClip"], ["upper", "AlsoNot"]]); }));
    driveRig(rig, 0, flat(), null);
    expect(rig.motion.play).toBeNull();
    expect(rig.motion.upper).toBeUndefined();
  });

  it("asserts a held clip every frame and lets it go only when the sender does, so a looped emote's pose plays on", () => {
    let pose: string | null = "FishHold";
    const rig = createRig(entry((now, out) => at({ pose })(now, out)));
    driveRig(rig, 0, flat(), null);
    rig.motion.pose = null; // Character drops a pose when the speed blips
    driveRig(rig, 1, flat(), null);
    expect(rig.motion.pose).toBe("FishHold");
    pose = null;
    driveRig(rig, 2, flat(), null);
    expect(rig.motion.pose).toBeNull();
    rig.motion.pose = "Dance"; // a Dance one-shot, held as a pose by Character
    driveRig(rig, 3, flat(), null);
    expect(rig.motion.pose).toBe("Dance");
  });

  it("plays one-shots on drawn tiers, the afterimage and the juice at Full only", () => {
    const script = (now: number, out: RemoteSample) => { at({})(now, out); events(out, [["play", "Jump"], ["ghost", 0], ["jump", 0], ["stop", 0]]); };
    const juice = vi.fn();
    const full = createRig(entry(script));
    full.lod.tier = FULL;
    driveRig(full, 0, flat(), juice);
    expect(full.motion).toMatchObject({ play: "Jump", ghost: true, stop: true });
    expect(juice).toHaveBeenCalledTimes(1);
    expect(juice.mock.calls[0][1]).toMatchObject({ kind: "jump" });
    expect(juice.mock.calls[0][2]).toBe(2);
    juice.mockClear();
    const reduced = createRig(entry(script));
    reduced.lod.tier = REDUCED;
    driveRig(reduced, 0, flat(), juice);
    expect(reduced.motion.play).toBe("Jump");
    expect(reduced.motion.ghost).toBeUndefined();
    expect(juice).not.toHaveBeenCalled();
    const hidden = createRig(entry(script));
    hidden.lod.tier = HIDDEN;
    driveRig(hidden, 0, flat(), juice);
    expect(hidden.motion.play).toBeNull();
    expect(hidden.motion.ghost).toBeUndefined();
    expect(juice).not.toHaveBeenCalled();
  });

  it("samples into the rig's own sample object every frame", () => {
    const e = entry(at({ x: 1 }));
    const rig = createRig(e), s = rig.sample;
    expect(driveRig(rig, 0, flat(), null)).toBe(s);
    expect(driveRig(rig, 1, flat(), null)).toBe(s);
    expect(e.calls).toBe(2);
  });
});

describe("the tiers' costs", () => {
  const rigAt = (tier: 0 | 1 | 2, leaf = 0) => {
    const r = createRig(entry(at({})));
    r.lod.tier = tier;
    r.anchor.current = new THREE.Group();
    r.motion.leaf = leaf;
    return r;
  };
  it("steps a Full mixer every frame, shows the anchor, and draws nothing and steps nothing when Hidden", () => {
    const full = rigAt(FULL);
    gateMixer(full, 1 / 60);
    expect(full.live.current).toBe(full.motion);
    expect(full.motion.rate).toBe(1);
    expect(full.anchor.current!.visible).toBe(true);
    const hidden = rigAt(HIDDEN);
    gateMixer(hidden, 1 / 60);
    expect(hidden.live.current).toBeNull();
    expect(hidden.anchor.current!.visible).toBe(false);
  });

  it("throws step dust at Full only", () => {
    const full = rigAt(FULL), reduced = rigAt(REDUCED);
    gateMixer(full, 1 / 60);
    gateMixer(reduced, 1 / 60);
    expect(full.dust.current).toBe(full.motion);
    expect(reduced.dust.current).toBeNull();
  });

  it("steps a Reduced mixer at 15 Hz by the time saved up (Character's step is dt × rate)", () => {
    const r = rigAt(REDUCED), dt = 1 / 60;
    let steps = 0, stepped = 0;
    for (let f = 0; f < 60; f++) {
      gateMixer(r, dt);
      if (r.live.current) { steps++; stepped += dt * r.motion.rate!; }
    }
    expect(steps).toBeGreaterThanOrEqual(LOD.reducedHz - 1);
    expect(steps).toBeLessThanOrEqual(LOD.reducedHz);
    expect(stepped).toBeGreaterThan(0.9); // the clips keep real time
    expect(stepped).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("keeps a Reduced mixer stepping every frame while the leaf is open (HeldLeaf places it from the motion)", () => {
    const r = rigAt(REDUCED, 0.8);
    for (let f = 0; f < 4; f++) { gateMixer(r, 1 / 60); expect(r.live.current).toBe(r.motion); }
  });

  it("turns the sun shadow off below Full and back on for what cast before (SunShadows reads userData.sunCaster)", () => {
    const root = new THREE.Group(), body = new THREE.Mesh(), decal = new THREE.Mesh(), tool = new THREE.Mesh();
    body.castShadow = true; body.userData.sunCaster = "dynamic";
    tool.castShadow = true; tool.userData.sunCaster = "dynamic";
    root.add(body, decal);
    body.add(tool);
    castSunShadows(root, false);
    expect([body.userData.sunCaster, body.castShadow, tool.userData.sunCaster, tool.castShadow]).toEqual(["off", false, "off", false]);
    expect(decal.userData.sunCaster).toBeUndefined();
    castSunShadows(root, true);
    expect([body.userData.sunCaster, body.castShadow, tool.castShadow]).toEqual(["dynamic", true, true]);
    expect([decal.castShadow, decal.userData.sunCaster]).toEqual([false, undefined]);
  });
});
