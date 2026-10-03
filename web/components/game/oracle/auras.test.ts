import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { fireflyOffset } from "@/lib/game/fireflyPath";
import { placeMotes } from "./FamilyAura";

describe("the family aura in one draw (multiplayer §5.6)", () => {
  it("puts the seven motes where the sprites were, with the sprites' fades, the same width at any lens", () => {
    const geometry = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(21), 3), col = new THREE.BufferAttribute(new Float32Array(28).fill(1), 4);
    geometry.setAttribute("position", pos); geometry.setAttribute("color", col);
    const material = new THREE.PointsMaterial(), points = new THREE.Points(geometry, material), player = new THREE.Vector3(3, 0.5, -2);
    const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 120);
    camera.updateProjectionMatrix();
    const t = 7.25;
    placeMotes(points, pos, col, material, player, t, camera);
    points.updateMatrixWorld();
    for (let i = 0; i < 7; i++) {
      // The sprites: at the player plus the firefly path scaled (FamilyAura before), each fading on its own beat.
      const o = fireflyOffset(i + 41, t * 1.4), was = new THREE.Vector3(player.x + o[0] * 0.75, player.y + 0.15 + o[1] * 1.1, player.z + o[2] * 0.75);
      const now = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(points.matrixWorld);
      expect(now.distanceTo(was)).toBeLessThan(1e-5);
      expect(col.getW(i)).toBeCloseTo(0.7 + Math.sin(t * 2 + i * 1.7) * 0.25, 5);
    }
    // A sprite 0.22 u wide is 0.22 × P[1][1] / depth across in NDC; a point of size s is s / depth (three's sizeAttenuation).
    expect(material.size).toBeCloseTo(0.22 / Math.tan(THREE.MathUtils.degToRad(24)), 5);
    camera.fov = 52; camera.updateProjectionMatrix();
    placeMotes(points, pos, col, material, player, t, camera);
    expect(material.size).toBeCloseTo(0.22 / Math.tan(THREE.MathUtils.degToRad(26)), 5);
  });

  it("is one Points draw, and the subclass aura allocates nothing per frame", () => {
    const family = readFileSync(new URL("./FamilyAura.tsx", import.meta.url), "utf8"), subclass = readFileSync(new URL("./SubclassAura.tsx", import.meta.url), "utf8");
    expect(family).not.toMatch(/<sprite/);
    expect(family).toMatch(/new THREE\.Points\(/);
    expect(subclass).not.toMatch(/Object\.values|fireflyOffset\(|\[A, B, C, D\] =/);
  });
});
