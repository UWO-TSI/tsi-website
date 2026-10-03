import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { CHARACTER_HEIGHT } from "../character/Character";
import type { RemoteEntry } from "@/lib/net/types";
import { createRig, type RemoteRig } from "./drive";
import { assignPlates, plateY, plateZ } from "./Nameplates";
import { projectCurved, type ScreenPoint } from "./projection";

const rig = (sid: number, plate = true): RemoteRig => {
  const r = createRig({ sid, player: {}, sample: (_now, out) => out } as RemoteEntry);
  r.lod.plate = plate;
  return r;
};

describe("the curved projection without an array per call", () => {
  it("lands where drei's curved labels land, and refuses points behind the camera", () => {
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 120), size = { width: 1600, height: 900 };
    camera.position.set(3, 10.2, -21);
    camera.lookAt(0, 0.7, 2);
    camera.updateMatrixWorld();
    const out: ScreenPoint = { x: 0, y: 0, depth: 0 }, o = new THREE.Object3D();
    for (const [x, y, z] of [[0, 1.6, 0], [-14, 2, 18], [9, 0.4, -12], [22, 3, 30]]) {
      o.position.set(x, y, z);
      o.updateMatrixWorld();
      const [ex, ey] = calculateCurvedHtmlPosition(o, camera, size);
      expect(projectCurved(x, y, z, camera, size.width, size.height, out)).toBe(true);
      expect(out.x).toBeCloseTo(ex, 6);
      expect(out.y).toBeCloseTo(ey, 6);
      expect(out.depth).toBeGreaterThan(0);
    }
    expect(projectCurved(3, 10, -40, camera, size.width, size.height, out)).toBe(false);
  });
});

describe("the nameplate pool", () => {
  it("keeps each player in the slot they had and gives freed slots to newcomers, never more than the pool", () => {
    const [a, b, c, d] = [rig(1), rig(2), rig(3), rig(4)], slots: (RemoteRig | null)[] = [null, null, null];
    const here = (r: RemoteRig) => r !== d;
    assignPlates(slots, [a, b], here);
    expect(slots).toEqual([a, b, null]);
    b.lod.plate = false;
    assignPlates(slots, [c, a, b], here);
    expect(slots).toEqual([a, c, null]); // a kept its slot; c took b's
    assignPlates(slots, [a, c, d], () => true);
    expect(slots).toEqual([a, c, d]);
    assignPlates(slots, [a, c, d, rig(5)], here); // d left: its plate goes even though its last tier gave it one
    expect(slots[2]?.sid).toBe(5);
  });

  it("sits over the head as yours does, at the seat when seated, over an open leaf", () => {
    const r = rig(1);
    r.feet.current.set(0, 2, 0); r.groundY = 0.5;
    expect(plateY(r)).toBeCloseTo(2 + CHARACTER_HEIGHT + 0.28);
    r.motion.leaf = 1.2;
    expect(plateY(r)).toBeCloseTo(2.45 + CHARACTER_HEIGHT + 0.28);
    r.seated = true;
    expect(plateY(r)).toBeCloseTo(0.5 + CHARACTER_HEIGHT + 0.28);
  });

  it("stacks by distance on your nameplate's scale (drei's [40, 0] from near to far)", () => {
    expect(plateZ(0.1, 0.1, 120)).toBe(40);
    expect(plateZ(120, 0.1, 120)).toBe(0);
    expect(plateZ(8, 0.1, 120)).toBeGreaterThan(plateZ(20, 0.1, 120));
  });

  it("moves plates from the frame loop by hand, never through React state, and shows only world names", () => {
    const src = readFileSync(new URL("./Nameplates.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/useState|setState|from "@react-three\/drei"/);
    expect(src).not.toMatch(/display_name/);
  });
});
