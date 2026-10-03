import { describe, expect, it } from "vitest";
import { KEEPER_NOTICE, KEEPER_POSTS, KEEPER_QUIET_S, KEEPER_TURN, keeperGreets, keeperYaw } from "./keepers";
import { ownerAt } from "./cafe";
import { HQ_FRONT_DESK, HQ_LAYOUT } from "./clubhouse";
import { PROPOSED_RESIDENTS, RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { parseLook } from "@/lib/game/character/look";

const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("indoor keepers (interiors deliverable 1)", () => {
  it("staffs every post with a roster resident who has a look and lines", () => {
    for (const post of Object.values(KEEPER_POSTS)) {
      const r = PROPOSED_RESIDENTS.find(p => p.slug === post.slug);
      expect(r?.post).toBe(post.post);
      expect(r!.canned_dialogue.length).toBeGreaterThanOrEqual(2);
      expect(parseLook(RESIDENT_LOOKS[post.slug])).toBeTruthy();
    }
  });

  it("puts the HQ lead behind the front desk, between it and its chair, facing the room, seen over its counter", () => {
    const [dx, , dz] = HQ_LAYOUT.desk.position, desk = HQ_FRONT_DESK, chair = HQ_LAYOUT.deskChair;
    // The walking camera (interiorShared snapInteriorCamera): 8.4 up and 7.2 behind you at the desk's station (1.2 out).
    const camZ = dz - 1.2 - 7.2, camY = 8.4, ledgeZ = dz + desk.ledgeBack, hips = 0.55;
    for (const s of KEEPER_POSTS.hq.stations) {
      expect(s.at[1]).toBeGreaterThan(dz + desk.halfD);                        // past the desk's back
      expect(s.at[1]).toBeLessThan(chair.position[2] - chair.footprint![1]);   // in front of its chair
      expect(Math.abs(s.at[0] - dx)).toBeLessThan(desk.halfW - 0.2);           // along it, never at its end
      expect(Math.abs(ang(s.yaw - Math.PI))).toBeLessThan(0.01);               // facing the room (and the camera)
      // The line from the camera to their hips passes over the counter's ledge.
      const overLedge = hips + (camY - hips) * (s.at[1] - ledgeZ) / (s.at[1] - camZ);
      expect(overLedge).toBeGreaterThan(desk.ledge);
    }
  });

  it("walks their stations on the shared clock without allocating a pose", () => {
    const out = { x: 0, z: 0, yaw: 0, clip: "Idle" as const, moving: false, station: 0 };
    for (const post of Object.values(KEEPER_POSTS)) {
      const xs = post.stations.map(s => s.at[0]), zs = post.stations.map(s => s.at[1]);
      for (let t = 0; t < 90; t += 0.37) {
        const p = ownerAt(t, post.stations, out);
        expect(p).toBe(out);
        expect(p.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
        expect(p.x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(Math.min(...zs) - 1e-9);
        expect(p.z).toBeLessThanOrEqual(Math.max(...zs) + 1e-9);
      }
      expect(ownerAt(5000.25, post.stations)).toEqual(ownerAt(5000.25, post.stations));
    }
  });

  it("turns to you while attending, no further than their counter allows, and back to work after", () => {
    // Keeper at the origin working toward the room (π); you in front of them, a little to the side.
    expect(keeperYaw(Math.PI, 0, 0, 1, -3, true)).toBeCloseTo(Math.atan2(1, -3), 6);
    expect(keeperYaw(Math.PI, 0, 0, 1, -3, false)).toBe(Math.PI);
    // You behind their shoulder: they turn only as far as KEEPER_TURN.
    const behind = keeperYaw(Math.PI, 0, 0, 0.2, 3, true);
    expect(Math.abs(ang(behind - Math.PI))).toBeCloseTo(KEEPER_TURN, 6);
  });

  it("says hello as you come in, then only when you walk up after a quiet spell, never over a line", () => {
    const greets = (s: Partial<{ entry: boolean; near: boolean; wasNear: boolean; now: number; quietUntil: number; talking: boolean }>) => {
      const o = { entry: false, near: false, wasNear: false, now: 100, quietUntil: 0, talking: false, ...s };
      return keeperGreets(o.entry, o.near, o.wasNear, o.now, o.quietUntil, o.talking);
    };
    expect(greets({ entry: true })).toBe(true);
    expect(greets({ entry: true, talking: true })).toBe(false);
    expect(greets({ near: true })).toBe(true);
    expect(greets({ near: true, wasNear: true })).toBe(false);          // still near: no repeat
    expect(greets({ near: true, quietUntil: 100 + KEEPER_QUIET_S })).toBe(false);
    expect(greets({ near: false })).toBe(false);
    expect(KEEPER_NOTICE).toBeGreaterThan(2.5);
  });
});
