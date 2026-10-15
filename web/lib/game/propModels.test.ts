/**
 * Our remodelled village props (lib/game/propModels.ts, art/props/): every model ships, the interior pieces map to ours
 * at the dump scale x 10, and each model keeps the points the engine ties to (read from its GLB's position bounds).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readGlb } from "./perf/glbStats";
import * as Props from "./propModels";
import { ROWBOAT, ROWBOAT_URL } from "./wharf";
import { FURNITURE } from "../study/seats";

const pub = join(__dirname, "../../public");
const fileOf = (url: string) => join(pub, url);
/** The model's bounds: the union of its POSITION accessors (our props carry no node transforms). */
function bounds(url: string) {
  const gltf = readGlb(new Uint8Array(readFileSync(fileOf(url)))).json as unknown as {
    accessors: { min?: number[]; max?: number[] }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[];
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    const a = gltf.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min![i]); max[i] = Math.max(max[i], a.max![i]); }
  }
  return { min, max };
}

describe("remodelled props (propModels.ts)", () => {
  const urls = [Props.CAMPFIRE_URL, Props.MAILBOX_URL, Props.STREETLAMP_URL, Props.MUSEUM_DOOR_FENCE_URL, Props.BUOY_URL,
    Props.STUDY_TABLE_LONG_URL, Props.STUDY_TABLE_URL, Props.STUDY_BOOK_URL];
  it("ships every model it names", () => {
    expect(urls.length).toBeGreaterThan(7);
    for (const url of [...urls, ...Object.values(Props.REMODELLED_PIECES)]) expect(existsSync(fileOf(url)), url).toBe(true);
  });
  it("draws a remodelled interior piece from our model at its dump scale x 10, and leaves the rest to the dump", () => {
    expect(Props.remodelledPiece("floor-lamp", 0.115)?.url).toBe("/assets/game/props/hq-floor-lamp.glb");
    expect(Props.remodelledPiece("floor-lamp", 0.115)?.scale).toBeCloseTo(1.15);
    expect(Props.remodelledPiece("yellow-message-mat", 0.14)?.scale).toBeCloseTo(1.4);
    expect(Props.remodelledPiece("bookshelf", 0.1)).toBeNull();
  });
  it("keeps the street lamp's height (the gulls' perch) and its lantern round the light at 2.4", () => {
    const b = bounds(Props.STREETLAMP_URL);
    expect(b.max[1]).toBeCloseTo(2.67, 2);
    expect(Math.max(-b.min[0], b.max[0])).toBeLessThan(0.27);
  });
  it("keeps the campfire's stone ring about its solid square (Campfire.tsx SOLID_HALF 0.72) and the mailbox inside its landmark's", () => {
    const fire = bounds(Props.CAMPFIRE_URL);
    for (const i of [0, 2]) expect(Math.max(-fire.min[i], fire.max[i])).toBeLessThan(0.82);
    const box = bounds(Props.MAILBOX_URL);
    for (const i of [0, 2]) expect(Math.max(-box.min[i], box.max[i])).toBeLessThanOrEqual(0.32);
    expect(box.max[1]).toBeGreaterThan(0.9);
  });
  it("floats the buoy at its waterline: the float widest just above it, the stem under", () => {
    const b = bounds(Props.BUOY_URL);
    expect(b.min[1]).toBeLessThan(Props.BUOY_WATERLINE - 0.4);
    expect(b.max[1]).toBeGreaterThan(Props.BUOY_WATERLINE + 0.3);
  });
  it("keeps the rowboat's hull where the wharf ties it (length, beam, keel at 0, the bow ring inside the bow)", () => {
    const b = bounds(ROWBOAT_URL);
    expect(b.max[2] - b.min[2]).toBeCloseTo(ROWBOAT.length, 1);
    expect(b.max[0] - b.min[0]).toBeLessThan(ROWBOAT.beam + 0.08);
    expect(b.min[1]).toBeGreaterThan(-0.04);
    expect(ROWBOAT.bowRing[2]).toBeLessThan(b.max[2]);
  });
  it("sizes the study tables to their solid footprints with the top at the book's height", () => {
    for (const [url, kind] of [[Props.STUDY_TABLE_LONG_URL, "picnic"], [Props.STUDY_TABLE_URL, "pier"]] as const) {
      const b = bounds(url), [, , hw, hd] = FURNITURE[kind].solid[0];
      expect(b.max[0] - b.min[0], url).toBeLessThanOrEqual(2 * hw + 0.02);
      expect(b.max[2] - b.min[2], url).toBeLessThanOrEqual(2 * hd + 0.06);
      expect(b.max[1], url).toBeGreaterThan(0.83);
      expect(b.max[1], url).toBeLessThan(0.87);
    }
  });
});
