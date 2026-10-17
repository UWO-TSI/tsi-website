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
import { BRIDGE_DECK_HALF, BRIDGE_RAIL_OUT, PROP_FOOTPRINT, PROP_TOP } from "./defaultIsland";

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
  const urls = [Props.CAMPFIRE_URL, Props.MAILBOX_URL, Props.STREETLAMP_URL, Props.BUOY_URL,
    Props.STUDY_TABLE_LONG_URL, Props.STUDY_TABLE_URL, Props.STUDY_BOOK_URL, Props.STUDY_TABLE_CLASSIC_LONG_URL, Props.STUDY_TABLE_CLASSIC_URL];
  it("ships every model it names", () => {
    expect(urls.length).toBeGreaterThan(6);
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
  it("draws the map's bench from our log bench and leaves other dump props to the dump", () => {
    expect(Props.propUrl("bench-wood")).toBe(Props.LOG_BENCH_URL);
    expect(Props.propUrl("fence-country-a")).toBe("/assets/acnh/props/fence-country-a.glb");
    for (const url of [Props.MONUMENT_SIGN_URL, Props.NOTICE_BOARD_URL, Props.CATCH_BOARD_URL, Props.LOG_BENCH_URL, Props.BRIDGE_URL,
      Props.BEACH_PARASOL_URL, Props.HQ_NOTICE_BOARD_URL, Props.SHOP_CART_URL]) expect(existsSync(fileOf(url)), url).toBe(true);
  });
  it("keeps the log bench's seat at the old bench's top, inside its solid footprint", () => {
    const b = bounds(Props.LOG_BENCH_URL);
    expect(b.max[1]).toBeCloseTo(PROP_TOP["bench-wood"], 2);
    const [hw, hd] = PROP_FOOTPRINT["bench-wood"];
    expect(Math.max(-b.min[0], b.max[0])).toBeLessThanOrEqual(hw + 0.005);
    expect(Math.max(-b.min[2], b.max[2])).toBeLessThanOrEqual(hd + 0.005);
    expect(b.min[1]).toBeGreaterThanOrEqual(-0.001);
  });
  it("builds the plaza boards in the dump board's frame: 1.68 long from the origin, the backing's back where the posters hang", () => {
    for (const url of [Props.NOTICE_BOARD_URL, Props.CATCH_BOARD_URL]) {
      const b = bounds(url);
      expect(b.min[1], url).toBeGreaterThanOrEqual(-0.001);
      // The roof overhangs the posts a little each way; the posts stand at the old board's ends.
      expect(b.min[0], url).toBeGreaterThan(-0.2);
      expect(b.max[0], url).toBeLessThan(1.68 + 0.2);
      expect(b.min[2], url).toBeLessThan(Props.PLAZA_BOARD.back);
      expect(b.max[1], url).toBeLessThan(2.2);
    }
    const [x0, x1, y0, y1] = Props.PLAZA_BOARD.cork;
    expect(x0).toBeGreaterThan(0.12);
    expect(x1).toBeLessThan(1.56);
    expect(y1 - y0).toBeGreaterThan(0.7);
  });
  it("keeps the bridge's span and its rails on the rail line, inside the walk's rail strips", () => {
    const b = bounds(Props.BRIDGE_URL);
    expect(b.max[0] - b.min[0]).toBeCloseTo(3.8, 1);
    expect(Math.max(-b.min[2], b.max[2])).toBeGreaterThan(BRIDGE_DECK_HALF[1] + 0.3);
    expect(Math.max(-b.min[2], b.max[2])).toBeLessThan(1.45 + 0.01);
    expect(Math.max(-b.min[2], b.max[2])).toBeLessThan(BRIDGE_RAIL_OUT);
    expect(b.min[1]).toBeCloseTo(-1.5, 1);
    expect(b.max[1]).toBeLessThan(1);
    expect(Props.BRIDGE_DECK_TOP).toBeCloseTo(0.075, 3);
  });
  it("keeps the parasol set inside the old one's square, the canopy as high", () => {
    const b = bounds(Props.BEACH_PARASOL_URL);
    for (const i of [0, 2]) expect(Math.max(-b.min[i], b.max[i])).toBeLessThan(1.06);
    expect(b.max[1]).toBeGreaterThan(2.2);
    expect(b.max[1]).toBeLessThan(2.45);
  });
  it("authors the HQ board and the trolley at the dump pieces' size at 0.1, and keeps the applicant's board the dump's", () => {
    const board = bounds(Props.HQ_NOTICE_BOARD_URL);
    expect(board.max[0] - board.min[0]).toBeCloseTo(1.554, 1);
    expect(board.max[1]).toBeCloseTo(0.92, 1);
    expect(board.min[2]).toBeCloseTo(-0.033, 2);
    const cart = bounds(Props.SHOP_CART_URL);
    expect(cart.max[0] - cart.min[0]).toBeLessThan(0.98);
    expect(cart.max[1]).toBeLessThan(1.05);
    expect(cart.max[2] - cart.min[2]).toBeLessThan(0.62);
    expect(Props.remodelledPiece("shopping-cart", 0.09)?.scale).toBeCloseTo(0.9);
    expect(Props.remodelledPiece("hq-notice-board", 0.2)?.url).toBe(Props.HQ_NOTICE_BOARD_URL);
    expect(Props.remodelledPiece("bulletinboard", 0.2)).toBeNull();
  });
  it("stands the monument's board about the old sign's size", () => {
    const b = bounds(Props.MONUMENT_SIGN_URL);
    expect(b.max[1]).toBeGreaterThan(1.0);
    expect(b.max[1]).toBeLessThan(1.3);
    expect(b.max[0] - b.min[0]).toBeLessThan(0.7);
    expect(b.max[2] - b.min[2]).toBeLessThan(0.55);
  });
  it("sizes the study tables, both looks, to their solid footprints with the top at the book's height", () => {
    for (const [url, kind] of [[Props.STUDY_TABLE_LONG_URL, "picnic"], [Props.STUDY_TABLE_URL, "pier"], [Props.STUDY_TABLE_CLASSIC_LONG_URL, "picnic-classic"],
      [Props.STUDY_TABLE_CLASSIC_URL, "pier-classic"]] as const) {
      const b = bounds(url), [, , hw, hd] = FURNITURE[kind].solid[0];
      expect(b.max[0] - b.min[0], url).toBeLessThanOrEqual(2 * hw + 0.02);
      expect(b.max[2] - b.min[2], url).toBeLessThanOrEqual(2 * hd + 0.06);
      expect(b.max[1], url).toBeGreaterThan(0.83);
      expect(b.max[1], url).toBeLessThan(0.87);
    }
  });
});
