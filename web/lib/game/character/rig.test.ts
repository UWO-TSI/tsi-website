import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { adoptPrimitive, CUTS, hasBit, mergeLook, refCache, skinnedPrimitives } from "./rig";
import { NO_SHIFT } from "./hairColour";
import { FIT, PART_BY_ID, PARTS, resolveParts, DEFAULT_LOOK, bodyKey } from "./look";

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
  // David's hairstyles ship meshopt-compressed (scripts/sync-character-assets.mjs), as the game's useGLTF decodes them
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});

describe("what a look never shows (wardrobe batch 2: art/characters/hidden_cut.py; David: \"find ways to not render part of hair\")", () => {
  it("reads a hide mark's bits: the sum of 2^i over the hats that hide a vertex", () => {
    expect([hasBit(0, 0), hasBit(1, 0), hasBit(6, 1), hasBit(6, 2), hasBit(6, 0), hasBit(16, 4), hasBit(6.9999, 0)]).toEqual([false, true, true, true, false, true, true]);
  });
  it("leaves out the hair a hat wins over (its bit on all three vertices), and nothing without one", async () => {
    const hair = await load("hair/full/hair_ribbon_bob.glb");
    const bones = skinnedPrimitives(hair)[0].skeleton.bones, index = new Map(bones.map((b, i) => [b.name, i]));
    const mesh = skinnedPrimitives(hair)[0], mark = mesh.geometry.getAttribute("_hatcut");
    expect(mark, "the shipped GLB carries _HATCUT").toBeDefined();
    const all = mesh.geometry.index!.count / 3;
    // round 2: the covering hats and the visor's band, bits 0, 1, 2, ... with none missing
    const hats = PARTS.filter(p => p.hatCut !== undefined);
    expect(hats.map(p => p.hatCut).sort((x, y) => x! - y!)).toEqual(hats.map((_, i) => i));
    expect(hats.filter(p => !p.coversHair).map(p => p.id)).toEqual(["acc_crew_visor"]);
    for (const hat of hats) {
      const g = adoptPrimitive(mesh, index, null, null, { name: "_HATCUT", bit: hat.hatCut! });
      const ix = mesh.geometry.index!;
      let hidden = 0;
      for (let i = 0; i < ix.count; i += 3) if ([0, 1, 2].every(k => hasBit(mark.getX(ix.getX(i + k)), hat.hatCut!))) hidden++;
      expect(g.index!.count / 3, hat.id).toBe(all - hidden);
    }
    expect(adoptPrimitive(mesh, index, null, null, null).index!.count / 3).toBe(all);
    // the bench's &cut=0 draws everything
    try {
      CUTS.on = false;
      expect(adoptPrimitive(mesh, index, null, null, { name: "_HATCUT", bit: 0 }).index!.count / 3).toBe(all);
    } finally {
      CUTS.on = true;
    }
    // hats always win (round 2): the cap takes the bob above its rim; a wide hat leaves the hair under its brim
    const cut = (id: string) => all - adoptPrimitive(mesh, index, null, null, { name: "_HATCUT", bit: PART_BY_ID.get(id)!.hatCut! }).index!.count / 3;
    expect(cut("acc_propeller_cap")).toBeGreaterThan(all / 3);
    for (const wide of ["acc_cowboy_hat", "acc_woven_hat", "acc_red_band_straw_hat"]) expect(cut(wide), wide).toBeLessThan(all * 0.9);
  });
  it("leaves out the head the hood hides, on the clip base and the LOD skin", async () => {
    // the clip base embeds the face image, which the loader can't decode under Node: its JSON carries the mark
    const buf = readFileSync(join(__dirname, "../../../public/assets/characters/v6/base/v8_clips.glb"));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as { meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[] };
    expect(gltf.meshes.find(m => m.name === "V8_Head")!.primitives.some(p => "_HOODCUT" in p.attributes)).toBe(true);
    for (const file of ["lod1/base/skin.glb"]) {
      const root = await load(file);
      const head = skinnedPrimitives(root).find(m => m.geometry.getAttribute("_hoodcut"))!;
      expect(head, file).toBeDefined();
      const index = new Map(head.skeleton.bones.map((b, i) => [b.name, i]));
      const all = head.geometry.index!.count / 3, kept = adoptPrimitive(head, index, null, null, { name: "_HOODCUT", bit: 0 }).index!.count / 3;
      expect(kept, file).toBeLessThan(all);
      expect(kept, file).toBeGreaterThan(all / 4);       // the face side stays
    }
    expect(PARTS.filter(p => p.coversHead).map(p => p.id)).toEqual(["acc_bear_hood"]);
  });
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
    // head-roblox: two of David's whole hairstyles (a look wears one; two prove the merge across GLBs)
    const [bangs, back] = await Promise.all([load("hair/full/hair_bob_pigtail.glb"), load("hair/full/hair_bowl_cut.glb")]);
    const bones = skinnedPrimitives(bangs)[0].skeleton.bones;
    expect(bones).toHaveLength(22);
    const merged = mergeLook([{ root: bangs, tints: { M_Hair: "#8C5E3C" } }, { root: back, tints: { M_Hair: "#8C5E3C" } }], bones);
    const tris = (merged.index!.count) / 3;
    const glbTris = (r: THREE.Object3D) => skinnedPrimitives(r).reduce((n, m) => n + m.geometry.index!.count / 3, 0);
    expect(tris).toBe(glbTris(bangs) + glbTris(back));
    const head = bones.findIndex(b => b.name === "mixamorigHead");
    const idx = merged.getAttribute("skinIndex"), w = merged.getAttribute("skinWeight");
    for (let i = 0; i < idx.count; i++) if (w.getX(i) > 0.99) expect(idx.getX(i)).toBe(head); // hair is skinned 100% to the head
    // merged without a map (mergeLook's map argument): every hairMap is zero
    expect(Array.from(merged.getAttribute("hairMap").array).every(x => x === 0)).toBe(true);
  });
  it("marks a mapped hair's vertices and carries each channel's shift and median lightness (round 2)", () => {
    const part = skinned(["mixamorigHead"], [0, 0, 0]);
    part.geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    const a = { m: [0.5, -0.2, 0.2, 0.5] as [number, number, number, number], o: [0.01, -0.02] as [number, number], l: 0.3 };
    const g = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), new THREE.Color(1, 1, 1), { a, b: NO_SHIFT });
    expect(Array.from(g.getAttribute("hairMap").array).map(x => Math.round(x * 100) / 100)).toEqual([1, 0.3, 0.5, 1, 0.3, 0.5, 1, 0.3, 0.5]);
    expect(Array.from(g.getAttribute("hairA").array.slice(0, 4)).map(x => Math.round(x * 100) / 100)).toEqual([0.5, 0.2, 0.01, -0.02]);   // p, q, o
    expect(Array.from(g.getAttribute("hairB").array.slice(0, 4))).toEqual([1, 0, 0, 0]);                                                  // identity
    const plain = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), null);
    expect(Array.from(plain.getAttribute("hairMap").array)).toEqual(new Array(9).fill(0));
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

describe("David's fit (the fit editor: catalogue `fit`, a head piece's lift `y` in metres)", () => {
  const head = (bones: readonly THREE.Bone[]) => bones.find(b => b.name === "mixamorigHead")!;
  it("binds every head piece's head with its Y axis straight up, so a lift is along the head's up axis", async () => {
    for (const p of PARTS.filter(x => x.slot === "back" || x.group === "face" || x.group === "head")) {
      const m = skinnedPrimitives(await load(p.glb))[0], i = m.skeleton.bones.findIndex(b => b.name === "mixamorigHead");
      const up = new THREE.Vector3().setFromMatrixColumn(m.skeleton.boneInverses[i].clone().invert(), 1);
      expect(up.distanceTo(new THREE.Vector3(0, 1, 0)), p.id).toBeLessThan(1e-5);
      expect(m.bindMatrix.equals(new THREE.Matrix4()), p.id).toBe(true);
    }
  });
  it("moves the piece in the game's scene by exactly its lift along the head's up axis, at rest and with the head turned", async () => {
    for (const file of ["hair/full/hair_bowl_cut.glb", "accessories/roblox/acc_thin_glasses.glb"]) {
      const root = await load(file), src = skinnedPrimitives(root)[0], bones = src.skeleton.bones;
      const draw = (lift: number) => {
        const m = new THREE.SkinnedMesh(mergeLook([{ root, tints: {}, lift }], bones));
        m.bind(src.skeleton, src.bindMatrix);
        return m;
      };
      const [plain, lifted] = [draw(0), draw(0.025)];
      const check = () => {
        root.updateMatrixWorld(true);
        const up = new THREE.Vector3().setFromMatrixColumn(head(bones).matrixWorld, 1).normalize();
        const a = new THREE.Vector3(), b = new THREE.Vector3(), n = plain.geometry.getAttribute("position").count;
        for (let i = 0; i < n; i += 97) {
          plain.getVertexPosition(i, a); lifted.getVertexPosition(i, b);
          const d = b.sub(a);
          expect(d.length()).toBeCloseTo(0.025, 6);
          expect(d.normalize().dot(up)).toBeCloseTo(1, 6);
        }
      };
      check();
      head(bones).rotation.x += 0.5; head(bones).rotation.z -= 0.3;
      check();
    }
  });
  it("comes from the catalogue: a part's lift resolves, changes the body's cache key, and is 0 when unset", () => {
    const look = { ...DEFAULT_LOOK };
    expect(resolveParts(look).every(p => p.lift === 0)).toBe(true);
    const key = bodyKey(look);
    FIT[look.back] = { y: 0.01 };
    try {
      expect(resolveParts(look).find(p => p.id === look.back)!.lift).toBe(0.01);
      expect(bodyKey(look)).not.toBe(key);
    } finally { delete FIT[look.back]; }
  });
});
