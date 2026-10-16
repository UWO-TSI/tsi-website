import { describe, expect, it } from "vitest";
import { CHARACTER_LOD as L, ZOOMED_OUT, characterLod, createLodState, detailSituation, drawnHeight, mixerStep } from "./lod";

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
    expect(characterLod(createLodState(), 45, L.quarter.px - 1)).toMatchObject({ lod: true, hz: 15, shadow: true });
    expect(characterLod(createLodState(), 60, L.shadowPx - 1)).toMatchObject({ lod: true, hz: 15, shadow: false });
    expect(characterLod(createLodState(), 25, L.quarter.px - 1)).toMatchObject({ lod: true, hz: Infinity, shadow: true });
    expect(characterLod(createLodState(), 45, 0, false)).toMatchObject({ lod: true, hz: L.offHz, shadow: false });
    expect(characterLod(createLodState(), Infinity, 0, false)).toMatchObject({ lod: true, hz: L.offHz, shadow: false });
  });
  it("draws the far hair (LOD 2) only past the far line and under its height, never nearer than LOD 1 (head-roblox)", () => {
    expect(characterLod(createLodState(), 30, L.far.px - 1)).toMatchObject({ lod: true, lod2: false });
    expect(characterLod(createLodState(), 45, L.far.px + 1)).toMatchObject({ lod: true, lod2: false });
    expect(characterLod(createLodState(), 45, L.far.px - 1)).toMatchObject({ lod: true, lod2: true });
    expect(characterLod(createLodState(), 60, 300)).toMatchObject({ lod: false, lod2: false });
    const s = createLodState();
    characterLod(s, 45, L.far.px - 1);
    expect(characterLod(s, 45, L.far.px + 1).lod2).toBe(true);                       // hysteresis
    expect(characterLod(s, 45, L.far.px * L.hysteresis + 1).lod2).toBe(false);
  });
  it("never flickers on a line: it crosses back only past the hysteresis", () => {
    const s = createLodState();
    characterLod(s, L.near + 1, 40);
    expect(characterLod(s, L.near - 1, 40).lod).toBe(true);
    expect(characterLod(s, L.near / L.hysteresis - 0.1, 40).lod).toBe(false);
    characterLod(s, 50, L.quarter.px - 1);
    expect(characterLod(s, 50, L.quarter.px + 1)).toMatchObject({ hz: 15 });
    expect(characterLod(s, 50, L.quarter.px * L.hysteresis + 1)).toMatchObject({ hz: 30 });
    characterLod(s, 60, L.shadowPx - 1);
    expect(characterLod(s, 60, L.shadowPx + 0.5).shadow).toBe(false);
    expect(characterLod(s, 60, L.shadowPx * L.hysteresis + 0.5).shadow).toBe(true);
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

describe("character detail by situation (head-v10, row 311)", () => {
  const PLAY = { close: false, zoom: 1 }, OUT = { close: false, zoom: ZOOMED_OUT + 0.1 }, CLOSE = { close: true, zoom: 1 };
  it("draws LOD 1 in normal play however near, you and combat included", () => {
    expect(characterLod(createLodState(), 6, 400, true, PLAY)).toMatchObject({ lod: true, lod2: false, hz: Infinity, shadow: true });
    expect(characterLod(createLodState(), 13, 60, true, PLAY)).toMatchObject({ lod: true, lod2: false });
    expect(characterLod(createLodState(), 30, 90, true, PLAY)).toMatchObject({ lod: true, lod2: false });
  });
  it("draws LOD 2 when the follow camera is zoomed out, or past the far line", () => {
    expect(characterLod(createLodState(), 6, 400, true, OUT)).toMatchObject({ lod: true, lod2: true });
    expect(characterLod(createLodState(), 45, L.far.px - 1, true, PLAY)).toMatchObject({ lod: true, lod2: true });
    expect(characterLod(createLodState(), 45, L.far.px + 1, true, PLAY)).toMatchObject({ lod: true, lod2: false });
    expect(characterLod(createLodState(), 10, 0, false, OUT)).toMatchObject({ lod: true, lod2: true });      // out of view too
  });
  it("crosses the zoomed-out line back only past its hysteresis", () => {
    const s = createLodState();
    characterLod(s, 10, 200, true, { close: false, zoom: ZOOMED_OUT + 0.01 });
    expect(characterLod(s, 10, 200, true, { close: false, zoom: ZOOMED_OUT - 0.01 }).lod2).toBe(true);
    expect(characterLod(s, 10, 200, true, { close: false, zoom: ZOOMED_OUT / L.hysteresis - 0.01 }).lod2).toBe(false);
  });
  it("draws Full up close in photo mode and for a player whose card is open, the size rule further out", () => {
    expect(characterLod(createLodState(), 6, 400, true, CLOSE)).toMatchObject({ lod: false, lod2: false });
    expect(characterLod(createLodState(), 6, 400, true, { close: true, zoom: ZOOMED_OUT + 0.2 })).toMatchObject({ lod: false, lod2: false });
    expect(characterLod(createLodState(), 45, L.far.px - 1, true, CLOSE)).toMatchObject({ lod: true, lod2: true });
  });
  it("reads the situation from photo mode, the open card and the follow camera's zoom", () => {
    expect(detailSituation({ photo: true, focused: false, zoom: 1.5 })).toEqual({ close: true, zoom: 1.5 });
    expect(detailSituation({ photo: false, focused: true, zoom: 1 })).toEqual({ close: true, zoom: 1 });
    expect(detailSituation({ photo: false, focused: false, zoom: 1.5 })).toEqual({ close: false, zoom: 1.5 });
  });
  it("animates and shadows by size in every situation", () => {
    expect(characterLod(createLodState(), 45, L.quarter.px - 1, true, PLAY)).toMatchObject({ hz: 15 });
    expect(characterLod(createLodState(), 60, L.shadowPx - 1, true, PLAY)).toMatchObject({ shadow: false });
    expect(characterLod(createLodState(), 45, 0, false, PLAY)).toMatchObject({ lod: true, hz: L.offHz, shadow: false });
  });
});
