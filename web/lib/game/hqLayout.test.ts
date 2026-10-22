import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HQ, HQ_CAMERA, HQ_FLOOR_HEIGHT as F, HQ_ROOM, HQ_SLAB, HQ_SPAWN, HQ_WREN, createHqWalker, hidesYou, hqLayoutJson, onUpper, partBoxes, stairWell, walkable,
  type HqOption, type HqWalker,
} from "./hqLayout";
import { KEEPER_POSTS } from "./keepers";

/** Walk the walker from where it is towards `to`, a step at a time, the way the game's walker does; where it got to. */
function walkTo(w: HqWalker, from: [number, number], to: [number, number]): [number, number] {
  let [x, z] = from;
  for (let i = 0; i < 600; i++) {
    const d = Math.hypot(to[0] - x, to[1] - z);
    if (d < 1e-6) break;
    const k = Math.min(1, 0.12 / d);
    const [nx, nz] = w.constrain(x, z, x + (to[0] - x) * k, z + (to[1] - z) * k);
    if (Math.hypot(nx - x, nz - z) < 1e-9) break;
    x = nx; z = nz;
  }
  return [x, z];
}
const near = (a: [number, number], b: [number, number], tol = 0.05) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
/** Walk a route of points from the door; the walker at its end. */
function route(o: HqOption, points: [number, number][]): { w: HqWalker; at: [number, number]; ok: boolean } {
  const w = createHqWalker(o);
  let at: [number, number] = [...HQ_SPAWN];
  for (const p of points) {
    at = walkTo(w, at, p);
    if (!near(at, p)) return { w, at, ok: false };
  }
  return { w, at, ok: true };
}
const path = (o: HqOption, id: string) => o.paths.find(p => p.id === id)!.points;
const upstairsRoute = (o: HqOption): [number, number][] => [...path(o, "to-stair"), ...path(o, "flight"), path(o, "upper")[0]];
const [BRIDGE, LEFT, RIGHT] = [0, 1, 2];

describe("HQ's room (the gallery, two tall storeys)", () => {
  const o = HQ;

  it("is a little bigger than phase 3's 20 x 16 (David, 2026-10-22: \"the building can be built a little bigger for more space\")", () => {
    expect(2 * HQ_ROOM.halfW).toBeGreaterThanOrEqual(24);
    expect(2 * HQ_ROOM.halfD).toBeGreaterThanOrEqual(18);
  });

  it("is two storeys well above the old 3.4 each, the aquarium the full height of the room, on the back wall straight ahead", () => {
    expect(F).toBeGreaterThanOrEqual(4.4);
    expect(F).toBeLessThanOrEqual(4.8);
    const a = o.aquarium;
    expect(a.facing).toBe("-z");
    expect(a.y1).toBeGreaterThan(2 * F - 0.3);
    expect(a.y0).toBeLessThan(0.3);
    expect(a.z1).toBe(HQ_ROOM.halfD);
    expect(a.x0 + a.x1).toBeCloseTo(0);              // centred on the door
    expect(a.x1 - a.x0).toBeGreaterThanOrEqual(10);  // a whole wall of it
  });

  it("wraps the hall in a U: a bridge over the entrance and an arm down each side, the hall open to the tank", () => {
    expect(o.upper).toHaveLength(3);
    const [bridge, left, right] = o.upper;
    expect(bridge.z0).toBe(-HQ_ROOM.halfD);
    expect(HQ_SPAWN[1]).toBeGreaterThan(bridge.z0);
    expect(HQ_SPAWN[1]).toBeLessThan(bridge.z1);                 // you come in under the bridge
    expect(left.x0).toBeGreaterThan(0);
    expect(right.x1).toBeLessThan(0);
    for (const arm of [left, right]) { expect(arm.z0).toBe(bridge.z1); expect(arm.z1).toBe(HQ_ROOM.halfD); }
    expect(left.x0).toBeGreaterThanOrEqual(o.aquarium.x1);       // the tank fills the hall's back between the arms
    expect(right.x1).toBeLessThanOrEqual(o.aquarium.x0);
  });

  it("walks every taped path on the ground floor from the door", () => {
    for (const p of o.paths.filter(p => p.level === 0)) {
      const r = route(o, [[0, -3.0], ...p.points]);
      expect(r.ok, `${p.id} stopped at ${r.at.map(v => v.toFixed(2))}`).toBe(true);
      expect(r.w.zone).toBe("ground");
    }
  });

  it("climbs the longer stair from the door to the upper floor, walks round the gallery, and comes back down", () => {
    const up = route(o, upstairsRoute(o));
    expect(up.ok, `stopped at ${up.at.map(v => v.toFixed(2))}`).toBe(true);
    expect(up.w.zone).toBe("upper");
    expect(up.w.height).toBeCloseTo(F);
    let at = up.at;
    for (const p of path(o, "upper").slice(1)) {
      at = walkTo(up.w, at, p);
      expect(near(at, p), `upstairs stopped at ${at.map(v => v.toFixed(2))} short of ${p}`).toBe(true);
    }
    expect(up.w.zone).toBe("upper");
    const back = [...path(o, "upper")].reverse().concat([...path(o, "flight")].reverse(), [...path(o, "to-stair")].reverse());
    for (const p of back) at = walkTo(up.w, at, p);
    expect(up.w.zone).toBe("ground");
    expect(up.w.height).toBe(0);
  });

  it("gives the stair an easy rise and run for the taller storey", () => {
    const s = o.stair, rise = F / s.steps, run = Math.abs(s.head - s.foot) / s.steps;
    expect(rise).toBeLessThanOrEqual(0.22);
    expect(run).toBeGreaterThanOrEqual(0.28);
    expect(Math.atan2(F, Math.abs(s.head - s.foot)) * 180 / Math.PI).toBeLessThan(37);
    // under the right arm, against the right wall
    expect(s.x0).toBe(-HQ_ROOM.halfW);
    expect(s.x1).toBeLessThanOrEqual(o.upper[RIGHT].x1);
  });

  it("puts every station where you can stand on its own floor", () => {
    for (const s of o.stations) expect(walkable(o, s.level, s.pos[0], s.pos[1]), s.id).toBe(true);
  });

  it("keeps every station HQ already has, and the new ones", () => {
    const ids = o.stations.map(s => s.id);
    for (const id of ["exit", "desk", "board", "founder", "display", "shelf", "clock"]) expect(ids).toContain(id);
    for (const id of ["coffee", "aquarium", "admin"]) expect(ids).toContain(id);
  });

  it("puts the library and co-working under the left arm, the notice board and the stair under the right", () => {
    const at = (id: string) => o.fixtures.find(f => f.id === id)!.blocks[0].at;
    for (const id of ["library", "coworking"]) { const [x, , z] = at(id); expect(x).toBeGreaterThan(o.upper[LEFT].x0); expect(z).toBeGreaterThan(o.upper[LEFT].z0 - 0.5); }
    const [bx, , bz] = at("notice-board");
    expect(bx).toBeLessThan(o.upper[RIGHT].x1);
    expect(bz).toBeGreaterThan(o.upper[RIGHT].z0 - 1);
    const s = o.stations.find(s => s.id === "board")!;
    expect(Math.hypot(s.pos[0] - (o.stair.x0 + o.stair.x1) / 2, s.pos[1] - o.stair.foot)).toBeLessThan(2.5);   // by the stair's foot
  });

  it("never lets you off the upper floor's edge or into the stair's well, and never under or beside the flight", () => {
    const up = route(o, upstairsRoute(o));
    // straight at the middle of the hall, from the landing
    let at = walkTo(up.w, up.at, [0, 0]);
    expect(up.w.zone).toBe("upper");
    expect(onUpper(o, at[0], at[1])).toBe(true);
    // into the well from the arm
    at = walkTo(up.w, at, [-7.4, 3.0]);
    at = walkTo(up.w, at, [-11.5, 3.0]);
    expect(up.w.zone).toBe("upper");
    expect(at[0]).toBeGreaterThan(o.stair.x1);
    // downstairs, alongside the flight past its foot
    const s = o.stair, mid = (s.foot + s.head) / 2;
    expect(walkable(o, 0, (s.x0 + s.x1) / 2, mid)).toBe(false);
  });

  it("puts the lounge before the tank, facing it", () => {
    const lounge = o.fixtures.find(f => f.id === "ground-lounge")!;
    const a = o.aquarium, rug = lounge.blocks[0];
    const gap = a.z0 - (rug.at[2] + rug.size[2] / 2);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(1.5);
    expect(lounge.facing).toBe("+z");
  });

  it("makes the hall a real lounge: a big sectional, beanbags by the glass, a bigger rug (David, 2026-10-22)", () => {
    const lounge = o.fixtures.find(f => f.id === "ground-lounge")!, [rug, ...rest] = lounge.blocks;
    expect(rug.size[0] * rug.size[2]).toBeGreaterThan(7.4 * 4.6 * 1.6);         // phase 3's rug was 7.4 x 4.6
    const seats = rest.filter(k => k.finish === "velvet");
    expect(seats.length).toBeGreaterThanOrEqual(3);                              // the back run and its two returns
    expect(seats.reduce((n, k) => n + Math.max(k.size[0], k.size[2]), 0)).toBeGreaterThan(10);
    const bags = o.fixtures.find(f => f.id === "lounge-beanbags")!.blocks;
    expect(bags.length).toBeGreaterThanOrEqual(4);
    for (const k of bags) { expect(k.at[2]).toBeGreaterThan(seats[0].at[2]); expect(k.at[2]).toBeLessThan(o.aquarium.z0); }
  });

  it("puts the study on the left arm upstairs: the long table, monitors and chairs, shelves and a whiteboard", () => {
    const table = o.fixtures.find(f => f.id === "study-table")!;
    expect(table.level).toBe(1);
    expect(table.part).toBe(LEFT);
    expect(Math.max(table.blocks[0].size[0], table.blocks[0].size[2])).toBeGreaterThanOrEqual(5);
    expect(table.blocks.filter(k => k.finish === "screen").length).toBeGreaterThanOrEqual(6);
    expect(table.blocks.filter(k => k.finish === "leather").length).toBeGreaterThanOrEqual(6);
    for (const id of ["study-shelves", "whiteboard"]) expect(o.fixtures.find(f => f.id === id)!.part).toBe(LEFT);
    expect(walkable(o, 1, ...path(o, "upper").at(-1)!)).toBe(true);
  });

  it("has big modern windows on both storeys: wide panes, floor to ceiling where the wall is free", () => {
    for (const w of o.windows) expect(w.z1 - w.z0).toBeGreaterThanOrEqual(2.3);
    for (const w of o.frontWindows) expect(w.x1 - w.x0).toBeGreaterThanOrEqual(3.8);
    const tall = [...o.windows, ...o.frontWindows].filter(w => w.y1 - w.y0 >= 3.8);
    expect(tall.length).toBeGreaterThanOrEqual(8);
    expect(tall.some(w => w.y0 < 0.3)).toBe(true);
    expect(tall.some(w => w.y0 > F && w.y0 < F + 0.3)).toBe(true);
  });

  it("puts the big lounge on the bridge under the oval ceiling, facing the tank head on", () => {
    const bridge = o.upper[BRIDGE], oc = o.ovalCeiling;
    expect(oc.z0).toBeGreaterThanOrEqual(bridge.z0);
    expect(oc.z1).toBeLessThanOrEqual(bridge.z1);
    const carpet = o.fixtures.find(f => f.id === "upper-carpet")!.blocks[0];
    expect(carpet.at[2]).toBeGreaterThan(bridge.z0);
    expect(carpet.at[2]).toBeLessThan(bridge.z1);
    // its sofas' backs to the front wall: they face +z, across the hall to the tank
    for (const s of o.fixtures.find(f => f.id === "upper-sofas")!.blocks.slice(0, 2)) expect(s.at[2]).toBeLessThan(carpet.at[2]);
  });

  it("hangs the yearly banners off the arms, one after another toward the tank, facing the door", () => {
    const banners = o.fixtures.filter(f => f.id.startsWith("banner-"));
    expect(banners.length).toBeGreaterThanOrEqual(6);
    for (const f of banners) {
      const cloth = f.blocks.find(b => b.finish === "banner")!;
      expect(f.level).toBe(1);
      expect(cloth.size[0]).toBeGreaterThan(cloth.size[2]);                   // its face across x: toward the door
      expect(Math.abs(cloth.at[0])).toBeLessThan(o.upper[LEFT].x0);           // over the hall's edge
      expect(Math.abs(cloth.at[0])).toBeGreaterThan(o.upper[LEFT].x0 - 2);
      expect(f.part).toBe(cloth.at[0] > 0 ? LEFT : RIGHT);                     // cut away with its arm
    }
    for (const side of [1, -1]) {
      const zs = banners.filter(f => Math.sign(f.blocks[1].at[0]) === side).map(f => f.blocks[1].at[2]);
      expect(zs.length).toBe(3);
      expect([...zs].sort((p, q) => p - q)).toEqual(zs);
    }
  });

  it("has one locked admin door, on the ground floor under the stair's high end (David, 2026-10-22: \"make it 1, and place it like under the stairs\")", () => {
    const admin = o.stations.filter(s => s.action === "admin");
    expect(admin.length).toBe(1);
    expect(admin[0].level).toBe(0);
    const door = o.fixtures.filter(f => f.blocks.some(k => k.finish === "door"));
    expect(door.length).toBe(1);
    const k = door[0].blocks[0], s = o.stair;
    expect(door[0].level).toBe(0);
    expect(k.at[0]).toBeCloseTo(s.x1);                                       // in the flight's open side
    expect(k.at[2]).toBeGreaterThan(s.foot);
    expect(k.at[2]).toBeLessThan(s.head);
    // headroom: the flight over the door's near edge is well above its top
    const near = k.at[2] - k.size[2] / 2;
    expect(F * (near - s.foot) / (s.head - s.foot) - 0.35).toBeGreaterThan(k.size[1]);
    // you stand before it, never behind it under the flight
    expect(walkable(o, 0, admin[0].pos[0], admin[0].pos[1])).toBe(true);
    expect(walkable(o, 0, (s.x0 + s.x1) / 2, Math.min(o.upper[RIGHT].z1, s.head + 1.0))).toBe(false);
    expect(Math.hypot(admin[0].pos[0] - k.at[0], admin[0].pos[1] - k.at[2])).toBeLessThan(admin[0].range);
  });

  it("cuts away the part of the upper floor you're under or that stands between the walking camera and you, and only that, without flicker", () => {
    // At the door you're under the bridge: it's cut away (the camera looks in under its edge at the hall), the arms show.
    const w = createHqWalker(o);
    expect(w.shown).toEqual([false, true, true]);
    // Into the hall the bridge stays away while the camera's over it, looking down past its rail at you.
    let at = walkTo(w, HQ_SPAWN, [0, -3.4]);
    at = walkTo(w, at, [0, 0.5]);
    expect(w.shown[BRIDGE]).toBe(false);
    // At the back of the hall, before the tank, the whole gallery shows.
    at = walkTo(w, at, [5.8, 0.5]);
    at = walkTo(w, at, [5.8, 6.95]);
    at = walkTo(w, at, [0, 6.95]);
    expect(w.shown).toEqual([true, true, true]);
    // Under the left arm's edge by the clock: it goes, the rest stay.
    at = walkTo(w, at, [5.8, 6.95]);
    at = walkTo(w, at, [7.0, 6.4]);
    expect(w.shown).toEqual([true, false, true]);
    // Stepping back out a little doesn't bring it back (hysteresis)...
    at = walkTo(w, at, [6.4, 6.6]);
    expect(w.shown[LEFT]).toBe(false);
    // ...stepping clear does.
    walkTo(w, at, [3.5, 6.6]);
    expect(w.shown).toEqual([true, true, true]);
  });

  it("cuts an arm away while you're under it, along the library", () => {
    const r = route(o, path(o, "library"));
    expect(r.ok).toBe(true);
    expect(r.w.shown).toEqual([true, false, true]);
  });

  it("cuts away an arm's banners when they hang between the camera and you in the hall", () => {
    const w = createHqWalker(o);
    let at = walkTo(w, HQ_SPAWN, [0, -3.4]);
    at = walkTo(w, at, [0, 0.5]);
    at = walkTo(w, at, [5.6, 0.5]);
    // Under the banner line at x 5.6, two metres past a banner: it would hang right in front of you.
    walkTo(w, at, [5.6, 3.8]);
    expect(w.shown[LEFT]).toBe(false);
    const boxes = partBoxes(o)[LEFT];
    expect(hidesYou(boxes, 5.6, 3.8, 0)).toBe(true);
    expect(hidesYou(boxes, 0, 3.8, 0)).toBe(false);
  });

  it("cuts the right arm away while you start up the stair under it and brings it back by the top, the well never in the way", () => {
    const w = createHqWalker(o);
    let at: [number, number] = [...HQ_SPAWN];
    for (const p of path(o, "to-stair")) at = walkTo(w, at, p);
    at = walkTo(w, at, [-10.9, 1.2]);
    expect(w.zone).toBe("stair");
    expect(w.shown[RIGHT]).toBe(false);
    at = walkTo(w, at, [-10.9, 6.6]);
    expect(w.zone).toBe("stair");
    expect(w.shown).toEqual([true, true, true]);
    // the well over the flight is open: nothing of the right arm there
    const well = stairWell(o), wellMid: [number, number] = [(well.x0 + well.x1) / 2, (well.z0 + well.z1) / 2];
    const slabs = partBoxes(o)[RIGHT].filter(k => k.y0 === F - HQ_SLAB);
    expect(slabs.some(k => wellMid[0] > k.x0 && wellMid[0] < k.x1 && wellMid[1] > k.z0 && wellMid[1] < k.z1)).toBe(false);
    void at;
  });

  it("shows the whole upper floor upstairs", () => {
    const up = route(o, upstairsRoute(o));
    let at = up.at;
    for (const p of path(o, "upper").slice(1)) {
      at = walkTo(up.w, at, p);
      expect(up.w.shown).toEqual([true, true, true]);
    }
  });

  it("keeps the walking camera under the ceiling on the ground floor and over it upstairs (the ceiling shows only from inside)", () => {
    expect(HQ_CAMERA.up).toBeLessThan(2 * F);
    expect(F + HQ_CAMERA.up).toBeGreaterThan(2 * F);
  });

  it("puts Wren behind her desk, out of the walker's way, facing the door, seen over its counter", () => {
    const counter = o.fixtures.find(f => f.id === "front-desk")!.blocks[0], ledgeZ = counter.at[2] + counter.size[2] / 2, ledge = counter.size[1];
    const desk = o.stations.find(s => s.id === "desk")!;
    // The walking camera: HQ_CAMERA.up over you and HQ_CAMERA.back behind you at the desk's station.
    const camZ = desk.pos[1] - HQ_CAMERA.back, camY = HQ_CAMERA.up, hips = 0.55;
    for (const p of HQ_WREN) {
      expect(p.at[1]).toBeGreaterThan(ledgeZ);                // behind the counter
      expect(walkable(o, 0, p.at[0], p.at[1])).toBe(false);  // inside the desk's footprint: visitors stay on the near side
      expect(Math.abs(p.at[0] - counter.at[0])).toBeLessThan(counter.size[0] / 2);
      expect(hips + (camY - hips) * (p.at[1] - ledgeZ) / (p.at[1] - camZ)).toBeGreaterThan(ledge);
    }
    for (const s of KEEPER_POSTS.memberHq.stations) expect(HQ_WREN.some(p => p.at === s.at)).toBe(true);
    // and the bridge over her desk is cut away while you stand at it
    const w = createHqWalker(o);
    walkTo(w, HQ_SPAWN, desk.pos);
    expect(w.shown[BRIDGE]).toBe(false);
  });

  it("the model build reads the layout the game walks (art/interiors/hq_layout.json is current: node scripts/hq-layout-json.mjs)", () => {
    expect(readFileSync(join(process.cwd(), "..", "art", "interiors", "hq_layout.json"), "utf8")).toBe(hqLayoutJson());
  });
});
