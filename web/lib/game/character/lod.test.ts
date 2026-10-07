import { describe, expect, it } from "vitest";
import { CHARACTER_LOD as L, characterLod, createLodState, drawnHeight, mixerStep } from "./lod";

describe("character detail by distance and drawn size", () => {
  it("up close nothing changes, however small the canvas draws it", () => {
    expect(characterLod(createLodState(), 13, 20)).toMatchObject({ lod: false, hz: Infinity, shadow: true });
    expect(characterLod(createLodState(), L.near, 5)).toMatchObject({ lod: false, hz: Infinity, shadow: true });
    // Out of view but near: its shadow can fall in view.
    expect(characterLod(createLodState(), 10, 50, false)).toMatchObject({ lod: false, hz: Infinity, shadow: true });
  });
  it("far but big on screen (a large window, the smooth finish) keeps everything", () => {
    expect(characterLod(createLodState(), 50, 200)).toMatchObject({ lod: false, hz: Infinity, shadow: true });
  });
  it("steps down only when both far and small", () => {
    expect(characterLod(createLodState(), 25, L.mesh - 1)).toMatchObject({ lod: true, hz: Infinity, shadow: true });
    expect(characterLod(createLodState(), 30, L.half.px - 1)).toMatchObject({ lod: true, hz: 30, shadow: true });
    expect(characterLod(createLodState(), 45, L.quarter.px - 1)).toMatchObject({ lod: true, hz: 15, shadow: false });
    expect(characterLod(createLodState(), 25, L.quarter.px - 1)).toMatchObject({ lod: true, hz: Infinity, shadow: true });
    expect(characterLod(createLodState(), 45, 0, false)).toMatchObject({ lod: true, hz: L.offHz, shadow: false });
    expect(characterLod(createLodState(), Infinity, 0, false)).toMatchObject({ lod: true, hz: L.offHz, shadow: false });
  });
  it("never flickers on a line: it crosses back only past the hysteresis", () => {
    const s = createLodState();
    characterLod(s, L.near + 1, 40);
    expect(characterLod(s, L.near - 1, 40).lod).toBe(true);
    expect(characterLod(s, L.near / L.hysteresis - 0.1, 40).lod).toBe(false);
    characterLod(s, 50, L.quarter.px - 1);
    expect(characterLod(s, 50, L.quarter.px + 1)).toMatchObject({ hz: 15, shadow: false });
    expect(characterLod(s, 50, L.quarter.px * L.hysteresis + 1)).toMatchObject({ hz: 30, shadow: true });
  });
  it("saves animation time up and steps it at the tier's rate, all of it at once", () => {
    const s = characterLod(createLodState(), 50, 10); // 15 Hz
    let stepped = 0, steps = 0;
    for (let i = 0; i < 60; i++) { const d = mixerStep(s, 1 / 60); if (d > 0) { stepped += d; steps++; } }
    expect(steps).toBeGreaterThanOrEqual(14);
    expect(steps).toBeLessThanOrEqual(16);
    expect(stepped + s.saved).toBeCloseTo(1, 6);
    expect(mixerStep(characterLod(createLodState(), 5, 500), 1 / 144)).toBeCloseTo(1 / 144, 9);
    expect(mixerStep(characterLod(createLodState(), 50, 0, false), 1)).toBe(0.2); // never more than Character's frame cap at once
  });
  it("measures height on screen from distance and lens", () => {
    expect(drawnHeight(1, 1, 90, 800)).toBeCloseTo(400, 6);
    // You at the default follow distance on an 800 px window with the pixel finish (half resolution): ~47 px.
    expect(drawnHeight(1.36, 13.1, 48, 400)).toBeGreaterThan(45);
    expect(drawnHeight(1.36, 13.1, 48, 400)).toBeLessThan(50);
  });
});
