import { createApplicantVillage } from "./applicantVillage";
import { describe, expect, it } from "vitest";
import { advanceVelocity, advanceMotion, easeFacing, relativeFacingAngle } from "./locomotion";

function travel(fps: number) {
  let velocity = 0, position = 0;
  for (const target of [7.4, 13.69, -7.4, 0]) {
    for (let frame = 0; frame < fps; frame++) {
      const [next, distance] = advanceVelocity(velocity, target, target === 0 ? 7.5 : 12, 1 / fps);
      velocity = next;
      position += distance;
    }
  }
  return { velocity, position };
}

describe("movement feel", () => {
  it("travels the same distance when walking, sprinting, reversing and stopping at different frame rates", () => {
    const reference = travel(120);
    for (const fps of [10, 15, 30, 60]) {
      expect(travel(fps).position).toBeCloseTo(reference.position, 10);
      expect(travel(fps).velocity).toBeCloseTo(reference.velocity, 10);
    }
  });
  it("has no displacement on a zero-length frame and decelerates without reversing", () => {
    expect(advanceVelocity(7.4, 0, 7.5, 0)).toEqual([7.4, 0]);
    const [velocity, distance] = advanceVelocity(7.4, 0, 7.5, 0.1);
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThan(7.4);
    expect(distance).toBeGreaterThan(velocity * 0.1);
    expect(distance).toBeLessThan(0.74);
  });
  it("turns across the angle seam without spinning through the opposite direction", () => {
    const next = easeFacing(Math.PI - 0.05, -Math.PI + 0.05, 10, 0.1);
    expect(next).toBeGreaterThan(Math.PI - 0.05);
    expect(next).toBeLessThan(Math.PI + 0.05);
    expect(easeFacing(0, 1, 10, 0)).toBe(0);
  });
});


describe("tap movement", () => {
  it.each([10, 15, 30, 60, 120])("stops at the target without gliding past it at %i FPS", (fps) => {
    let state = { x: 0, z: -5, vx: 0, vz: 0 };
    const goal = { x: 0, z: -1 };
    let arrived = false;
    for (let frame = 0; frame < fps * 4; frame++) {
      const distance = Math.hypot(goal.x - state.x, goal.z - state.z);
      const result = advanceMotion(state, { x: 0, z: distance > 0 ? 1 : 0, speed: 7.4, response: 12, goal }, 1 / fps, (_x, _z, x, z) => [x, z]);
      expect(result.z).toBeLessThanOrEqual(goal.z);
      state = result;
      if (result.arrived) { arrived = true; break; }
    }
    expect(arrived).toBe(true);
    expect(Math.abs(state.z - goal.z)).toBeLessThanOrEqual(0.1);
    expect(state.vz).toBe(0);
    const stopped = advanceMotion(state, { x: 0, z: 0, speed: 7.4, response: 7.5 }, 0.1, (_x, _z, x, z) => [x, z]);
    expect(stopped.z).toBe(state.z);
  });
  it("cannot walk into the ocean or keep walking feedback active against the shore", () => {
    const island = createApplicantVillage();
    let state = { x: 6, z: -3, vx: 0, vz: 0 };
    let moving = true;
    for (let frame = 0; frame < 90; frame++) {
      const result = advanceMotion(state, { x: 0, z: 1, speed: 13.69, response: 12 }, 1 / 15, island.move);
      state = result;
      moving = result.moving;
    }
    expect(state.z).toBeGreaterThan(5);
    expect(state.z).toBeLessThan(16);
    expect(island.standable(state.x, state.z)).toBe(true);
    expect(moving).toBe(false);
    expect(state.vz).toBe(0);
  });
});


it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])("keeps sprite facing relative to a camera heading of %f", (heading) => {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  expect(relativeFacingAngle(heading, fx, fz)).toBeCloseTo(0);
  expect(Math.abs(relativeFacingAngle(heading + Math.PI, fx, fz))).toBeCloseTo(Math.PI);
  expect(relativeFacingAngle(heading + Math.PI / 2, fx, fz)).toBeCloseTo(Math.PI / 2);
  expect(relativeFacingAngle(heading - Math.PI / 2, fx, fz)).toBeCloseTo(-Math.PI / 2);
});
