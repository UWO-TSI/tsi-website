import { expect, it } from "vitest";
import { createCameraFollow, updateCameraFollow } from "./cameraFollow";

it("frames a distant grounded spawn without inventing travel velocity", () => {
  const state = createCameraFollow();
  expect(updateCameraFollow(state, { x: 40, y: 3, z: -25 }, 1 / 60)).toBe(true);
  expect([state.x, state.y, state.z]).toEqual([40, 4.5, -25]);
  expect([state.leadX, state.leadZ]).toEqual([0, 0]);
  expect(updateCameraFollow(state, { x: 40, y: 3, z: -25 }, 1 / 60)).toBe(false);
});

it("returns to the resting player and stops requesting camera moves", () => {
  const state = createCameraFollow();
  updateCameraFollow(state, { x: 0, y: 0, z: 0 }, 1 / 60);
  for (let frame = 1; frame <= 120; frame++) {
    updateCameraFollow(state, { x: frame / 15, y: 0, z: 0 }, 1 / 60);
  }
  expect(state.leadX).toBeGreaterThan(1.19);
  for (let frame = 0; frame < 240; frame++) updateCameraFollow(state, { x: 8, y: 0, z: 0 }, 1 / 60);
  expect([state.x, state.z]).toEqual([8, 0]);
  expect(updateCameraFollow(state, { x: 8, y: 0, z: 0 }, 1 / 60)).toBe(false);
});

it("keeps the same look-ahead over matching walks at different frame rates", () => {
  const leads = [15, 30, 60, 120].map((fps) => {
    const state = createCameraFollow();
    updateCameraFollow(state, { x: 0, y: 0, z: 0 }, 1 / fps);
    for (let frame = 1; frame <= fps; frame++) {
      updateCameraFollow(state, { x: frame * 4 / fps, y: 0, z: -frame * 4 / fps }, 1 / fps);
    }
    return [state.leadX, state.leadZ];
  });
  for (const lead of leads) {
    expect(lead[0]).toBeCloseTo(leads[0][0], 10);
    expect(lead[1]).toBeCloseTo(leads[0][1], 10);
  }
});

it("tracks terrain height and bounds a long resume frame", () => {
  const state = createCameraFollow();
  updateCameraFollow(state, { x: 0, y: 0, z: 0 }, 1 / 60);
  updateCameraFollow(state, { x: 0.4, y: 2, z: 0 }, 10);
  expect(state.y).toBe(3.5);
  expect(state.leadX).toBeCloseTo(1.2 * (1 - Math.exp(-0.3)), 10);
});
