import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { adoptPrimitive, anchorMatrices, mergeLook, refCache, skinnedPrimitives } from "./rig";
import { PART_BY_ID } from "./look";

function skinned(boneNames: string[], joints: number[], color?: number[]) {
  const bones = boneNames.map(n => Object.assign(new THREE.Bone(), { name: n }));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2]);
  g.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(joints.flatMap(j => [j, 0, 0, 0]), 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(joints.flatMap(() => [1, 0, 0, 0]), 4));
  if (color) g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ name: "M_Main" }));
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

const load = (file: string) => new Promise<THREE.Object3D>((resolve, reject) => {
  const buf = readFileSync(join(__dirname, "../../../public/assets/characters/v6", file));
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});

describe("character rig assembly", () => {
  it("binds a part to the base skeleton by bone name, whatever its joint order", () => {
    const base = ["mixamorigHips", "mixamorigSpine", "mixamorigHead"].map(n => Object.assign(new THREE.Bone(), { name: n }));
    const part = skinned(["mixamorigHead", "mixamorigHips"], [0, 1, 0], [0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1]);
    const g = adoptPrimitive(part, new Map(base.map((b, i) => [b.name, i])), new THREE.Color(1, 0.5, 0));
    expect(Array.from(g.getAttribute("skinIndex").array).filter((_, i) => i % 4 === 0)).toEqual([2, 0, 2]);
    expect(Array.from(g.getAttribute("color").array.slice(0, 6))).toEqual([0.5, 0.25, 0, 1, 0.5, 0]); // COLOR_0 x tint
    expect(g.getAttribute("uv").count).toBe(3);
  });
  it("refuses a part that uses a bone the base rig lacks", () => {
    const part = skinned(["mixamorigTail"], [0, 0, 0]);
    expect(() => adoptPrimitive(part, new Map([["mixamorigHips", 0]]), null)).toThrow(/mixamorigTail/);
  });
  it("merges real hair GLBs into one geometry on one skeleton", async () => {
    const [bangs, back] = await Promise.all([load("hair/bangs/bangs_straight.glb"), load("hair/back/back_bob.glb")]);
    const bones = skinnedPrimitives(bangs)[0].skeleton.bones;
    expect(bones).toHaveLength(22);
    const merged = mergeLook([{ root: bangs, tints: { M_Hair: "#8C5E3C" } }, { root: back, tints: { M_Hair: "#8C5E3C" } }], bones);
    const tris = (merged.index!.count) / 3;
    expect(tris).toBe(PART_BY_ID.get("bangs_straight")!.tris + PART_BY_ID.get("back_bob")!.tris);
    const head = bones.findIndex(b => b.name === "mixamorigHead");
    const idx = merged.getAttribute("skinIndex"), w = merged.getAttribute("skinWeight");
    for (let i = 0; i < idx.count; i++) if (w.getX(i) > 0.99) expect(idx.getX(i)).toBe(head); // hair is skinned 100% to the head
    // lock hair carries its lock UVs to the strand texture (avatar v8): across 0..1, root (v 0) to tip (v 1)
    const lock = merged.getAttribute("hairUv");
    let on = 0, rootish = 0;
    for (let i = 0; i < lock.count; i++) if (lock.getX(i) === 1) { on++; if (lock.getZ(i) < 0.05) rootish++; expect(lock.getY(i)).toBeGreaterThanOrEqual(0); expect(lock.getY(i)).toBeLessThanOrEqual(1); }
    expect(on).toBeGreaterThan(lock.count * 0.5);
    expect(rootish).toBeGreaterThan(0);
  });
  it("gives no strands to parts without lock UVs (outfits, accessories)", () => {
    const part = skinned(["mixamorigHead"], [0, 0, 0]);
    const g = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), null, true);   // M_Hair, but no uv channel
    expect(Array.from(g.getAttribute("hairUv").array)).toEqual(new Array(9).fill(0));
  });
  it("places a hair accessory on its anchor without touching the shared GLB data (avatar v8)", () => {
    const part = skinned(["mixamorigHead"], [0, 0, 0]);
    const before = Array.from(part.geometry.getAttribute("position").array);
    // a quarter turn about y and a move; a wrapping piece scaled to the anchor's radius, any other lifted by it
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const at = [[0.1, 0.9, -0.1, q.x, q.y, q.z, q.w, 0.06, 0.06]];
    const [wrap] = anchorMatrices(at, 0.03), [sit] = anchorMatrices(at);
    const g = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), null, false, wrap);
    const p = new THREE.Vector3().fromBufferAttribute(g.getAttribute("position"), 1);   // (1, 0, 0) -> scaled 2, turned to -z
    expect([p.x, p.y, p.z].map(v => +v.toFixed(4))).toEqual([0.1, 0.9, -2.1]);
    const n = new THREE.Vector3().fromBufferAttribute(g.getAttribute("normal"), 0);     // (0, 0, 1) -> (1, 0, 0), unit
    expect([n.x, n.y, n.z].map(v => +v.toFixed(4))).toEqual([1, 0, 0]);
    const s = new THREE.Vector3().fromBufferAttribute(adoptPrimitive(part, new Map([["mixamorigHead", 0]]), null, false, sit).getAttribute("position"), 0);
    expect([s.x, s.y, s.z].map(v => +v.toFixed(4))).toEqual([0.1, 0.96, -0.1]);
    expect(Array.from(part.geometry.getAttribute("position").array)).toEqual(before);
  });
  it("shares identical looks and disposes after the last user", () => {
    const cache = refCache<{ dispose(): void; n: number }>();
    let disposed = 0, made = 0;
    const make = () => ({ n: ++made, dispose: () => { disposed++; } });
    expect(cache.acquire("a", make)).toBe(cache.acquire("a", make));
    cache.release("a"); expect(disposed).toBe(0);
    cache.release("a"); expect([disposed, cache.size()]).toEqual([1, 0]);
  });
});
