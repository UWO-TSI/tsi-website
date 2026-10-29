import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import doc from "@/data/world/world.json";
import { seedTerrain, terrainOf, type Terrain } from "../grid";
import { shoreFieldOf } from "../seabed";
import { village } from "../villageMap";
import { deriveWorld, derivedBuffers } from "./derive";
import { decodeWorld, type WorldDoc } from "./format";
import { terrainShoreField } from "./terrain";
import { villageOfWorld } from "./village";

const bytes = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const same = (a: Float32Array, b: Float32Array) => a.length === b.length && bytes(a).equals(bytes(b));
function sameTerrain(a: Terrain, b: Terrain) {
  expect(same(a.coast, b.coast)).toBe(true);
  expect(same(a.beach, b.beach)).toBe(true);
  expect(same(a.built, b.built)).toBe(true);
  expect([...a.overlays.keys()]).toEqual([...b.overlays.keys()]);
  for (const [k, f] of a.overlays) expect(same(f, b.overlays.get(k)!)).toBe(true);
}
const shipped = () => {
  const dir = join(__dirname, "../../../data/world");
  return decodeWorld(doc as unknown as WorldDoc, new Uint8Array(readFileSync(join(dir, "height.png"))), new Uint8Array(readFileSync(join(dir, "surface.png"))));
};

describe("the smooth world's derivation off the main thread (derive.ts)", () => {
  it("gives the same bytes as deriving on first use, from a copy of the terrain as a worker gets it", async () => {
    const w = await shipped();
    const v = villageOfWorld(w);
    const before = { terrain: terrainOf(v.map), shore: terrainShoreField(w.terrain) };
    const after = deriveWorld(structuredClone(w.terrain));
    sameTerrain(after.terrain, before.terrain);
    expect(same(after.shore.data, before.shore.data)).toBe(true);
    expect(same(after.shore.depth, before.shore.depth)).toBe(true);
    expect({ ...after.shore, data: 0, depth: 0 }).toEqual({ ...before.shore, data: 0, depth: 0 });
    // Every buffer is handed over once (a buffer listed twice fails the transfer).
    expect(new Set(derivedBuffers(after)).size).toBe(derivedBuffers(after).length);
  }, 30000);

  it("seeds the village built from the world: its cell shapes and its shore field are the worker's", async () => {
    const w = await shipped();
    const made = deriveWorld(w.terrain);
    const v = villageOfWorld(w, made.shore);
    seedTerrain(v.map, made.terrain);
    expect(terrainOf(v.map)).toBe(made.terrain);
    expect(shoreFieldOf(v.map)).toBe(made.shore);
  }, 30000);

  it("leaves a cell world's own derivation as it was (a copy of its map derives the same bytes)", () => {
    const map = village().map; // the new world's cell view
    sameTerrain(terrainOf(structuredClone(map)), terrainOf(map));
  });
});
