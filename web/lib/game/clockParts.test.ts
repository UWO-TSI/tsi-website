import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLOCK, clockAngles, liftParts, pendulumAngle, triangleParts } from "./clockParts";

/** Two separate quads: one inside the region, one outside. */
function twoQuads() {
  const p = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 5, 5, 0, 6, 5, 0, 6, 6, 0, 5, 6, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(16).fill(0.5), 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
}

describe("the HQ clock keeps time (interiors deliverable 4)", () => {
  it("points the hands clockwise from twelve", () => {
    expect(clockAngles(12, 0, 0)).toEqual({ hour: -0, minute: -0 });
    const three = clockAngles(15, 0, 0);
    expect(three.hour).toBeCloseTo(-Math.PI / 2, 9);
    const half = clockAngles(6, 30, 0);
    expect(half.minute).toBeCloseTo(-Math.PI, 9);
    expect(half.hour).toBeCloseTo(-(6.5 / 12) * Math.PI * 2, 9);
  });

  it("swings the pendulum a beat a second, through the middle on the second", () => {
    expect(pendulumAngle(100)).toBeCloseTo(0, 9);
    expect(pendulumAngle(101)).toBeCloseTo(0, 9);
    expect(pendulumAngle(100.5)).toBeCloseTo(CLOCK.swing, 9);
    expect(pendulumAngle(101.5)).toBeCloseTo(-CLOCK.swing, 9);
  });

  it("finds a model's separate parts and lifts out only those wholly inside the region, about its pivot", () => {
    const g = twoQuads();
    expect([...triangleParts(g)].length).toBe(4);
    expect(new Set(triangleParts(g)).size).toBe(2);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    const lifted = liftParts(mesh, new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(2, 2, 1)), new THREE.Vector3(0.5, 0.5, 0));
    expect(lifted).toHaveLength(1);
    expect(lifted[0].geometry.index!.count).toBe(6);
    lifted[0].geometry.computeBoundingBox();
    expect(lifted[0].geometry.boundingBox!.min.x).toBeCloseTo(-0.5, 9);
    expect(mesh.geometry.index!.count).toBe(6);       // the far quad stays behind
    expect(mesh.geometry).not.toBe(g);                // the cached geometry is untouched
    expect(g.index!.count).toBe(12);
  });
});
