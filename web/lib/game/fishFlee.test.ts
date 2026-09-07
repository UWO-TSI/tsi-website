import { expect, it } from "vitest";
import { computeFlee, makeFleeState } from "./fishFlee";

it("does not startle on a fresh world's empty splash record", () => {
  expect(computeFlee(makeFleeState(), { id: 0, x: 0, z: 0 }, 1, 1, 100)).toEqual({ ox: 0, oz: 0, dart: false });
});

it("checks range once and does not startle a later arrival", () => {
  const state = makeFleeState(), splash = { id: 1, x: 0, z: 0 };
  computeFlee(state, splash, 8, 0, 100);
  expect(computeFlee(state, splash, 1, 0, 400)).toEqual({ ox: 0, oz: 0, dart: false });
});

it("darts away from the landing and returns fully to patrol", () => {
  const state = makeFleeState(), splash = { id: 1, x: 4, z: 8 };
  computeFlee(state, splash, 7, 12, 100);
  const outward = computeFlee(state, splash, 7, 12, 700);
  expect(outward.ox).toBeGreaterThan(0);
  expect(outward.oz).toBeGreaterThan(outward.ox);
  expect(outward.dart).toBe(true);
  const returning = computeFlee(state, splash, 7, 12, 2000);
  expect(returning.ox).toBeLessThan(outward.ox);
  expect(returning.dart).toBe(false);
  expect(computeFlee(state, splash, 7, 12, 2900)).toEqual({ ox: 0, oz: 0, dart: false });
});

it("can flee from a direct hit instead of remaining at zero displacement", () => {
  const state = makeFleeState(), splash = { id: 1, x: 2, z: 3 };
  computeFlee(state, splash, 2, 3, 100);
  expect(computeFlee(state, splash, 2, 3, 600).ox).toBeGreaterThan(0);
});

it("treats a new landing as distinct even within the same clock tick", () => {
  const state = makeFleeState();
  computeFlee(state, { id: 1, x: 0, z: 0 }, 1, 0, 100);
  computeFlee(state, { id: 2, x: 2, z: 0 }, 1, 0, 100);
  expect(computeFlee(state, { id: 2, x: 2, z: 0 }, 1, 0, 600).ox).toBeLessThan(0);
});
