import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { heldTemplate, mergeHeld } from "./heldMesh";
import { lookClassFor } from "../modelMaterials";

const ASSETS = join(__dirname, "../../../public/assets/game");
const load = (file: string) => new Promise<THREE.Object3D>((resolve, reject) => {
  const buf = readFileSync(join(ASSETS, file));
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});
const meshes = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse(c => { if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh); }); return out; };
const triangles = (o: THREE.Object3D) => meshes(o).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3, 0);
const bounds = (o: THREE.Object3D) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const classes = (o: THREE.Object3D, url: string) => new Set(meshes(o).map(m => lookClassFor(url, (m.material as THREE.Material).name)));

describe("held items as one mesh per look class", () => {
  const items = [...readdirSync(join(ASSETS, "tools")).map(f => `tools/${f}`), "props/leaf-glider.glb"];
  it.each(items)("%s is one mesh, the same shape and size", async file => {
    const scene = await load(file), url = `/assets/game/${file}`, merged = mergeHeld(scene, url);
    expect(meshes(scene).length).toBeGreaterThan(1);
    expect(meshes(merged)).toHaveLength(1);
    expect(triangles(merged)).toBe(triangles(scene));
    const a = bounds(scene), b = bounds(merged);
    expect(a.min.distanceTo(b.min)).toBeLessThan(1e-5);
    expect(a.max.distanceTo(b.max)).toBeLessThan(1e-5);
  });

  it("bakes each part's base colour into its vertex colour (COLOR_0 × base, as three multiplies them)", async () => {
    const scene = await load("tools/rod-2.glb"), merged = mergeHeld(scene, "/assets/game/tools/rod-2.glb");
    const parts = meshes(scene), [m] = meshes(merged), color = m.geometry.getAttribute("color");
    expect((m.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xffffff);
    expect((m.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    let at = 0;
    for (const p of parts) {
      const base = p.geometry.getAttribute("color"), tint = (p.material as THREE.MeshStandardMaterial).color;
      expect(color.getX(at)).toBeCloseTo(base.getX(0) * tint.r, 5);
      expect(color.getZ(at)).toBeCloseTo(base.getZ(0) * tint.b, 5);
      at += p.geometry.getAttribute("position").count;
    }
  });

  it("keeps a weapon's look classes apart and its off hand on its own node", async () => {
    const files = readdirSync(join(ASSETS, "weapons"));
    let before = 0, after = 0;
    for (const f of files) {
      const url = `/assets/game/weapons/${f}`, scene = await load(`weapons/${f}`), merged = mergeHeld(scene, url);
      before += meshes(scene).length; after += meshes(merged).length;
      expect(triangles(merged), f).toBe(triangles(scene));
      expect(classes(merged, url), f).toEqual(classes(scene, url));
      const off = scene.getObjectByName("OffHand"), offMerged = merged.getObjectByName("OffHand");
      expect(!!offMerged, f).toBe(!!off);
      if (off && offMerged) {
        expect(triangles(offMerged), f).toBe(triangles(off));
        // Its home on the model: the same place relative to the weapon's root.
        scene.updateMatrixWorld(true); merged.updateMatrixWorld(true);
        expect(new THREE.Vector3().setFromMatrixPosition(offMerged.matrixWorld).distanceTo(new THREE.Vector3().setFromMatrixPosition(off.matrixWorld)), f).toBeLessThan(1e-5);
      }
    }
    expect(after).toBeLessThan(before * 0.6);
  });

  it("keeps a glowing part on its own material, so the glow still breathes and the shader is the one it was", async () => {
    const url = "/assets/game/weapons/sunstone-staff-5.glb", scene = await load("weapons/sunstone-staff-5.glb"), merged = mergeHeld(scene, url);
    const glowing = (m: THREE.Material) => (m as THREE.MeshStandardMaterial).emissive.getHex() !== 0;
    const before = new Set(meshes(scene).map(m => m.material as THREE.Material).filter(glowing));
    const after = meshes(merged).map(m => m.material as THREE.Material);
    for (const g of before) expect(after).toContain(g);
    // The baked mesh: white, its colour in the vertices with COLOR_0's four components (three's vertex-alpha shader).
    const baked = meshes(merged).find(m => !before.has(m.material as THREE.Material))!;
    expect(baked.geometry.getAttribute("color").itemSize).toBe(meshes(scene)[0].geometry.getAttribute("color").itemSize);
    expect(glowing(baked.material as THREE.Material)).toBe(false);
  });

  it("shares one template per scene and url", async () => {
    const scene = await load("tools/net-1.glb");
    expect(heldTemplate(scene, "/a.glb")).toBe(heldTemplate(scene, "/a.glb"));
    const a = heldTemplate(scene, "/a.glb").clone(true), b = heldTemplate(scene, "/a.glb").clone(true);
    expect(meshes(a)[0].geometry).toBe(meshes(b)[0].geometry);
  });

  it("keeps a mirrored part's faces pointing out", () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2]);
    const root = new THREE.Group(), a = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: "M_A" })), b = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: "M_B" }));
    b.scale.set(-1, 1, 1);
    root.add(a, b);
    const [m] = meshes(mergeHeld(root, "/x.glb")), idx = m.geometry.index!, pos = m.geometry.getAttribute("position");
    const normal = (t: number) => {
      const [p, q, r] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(t * 3 + k)));
      return q.sub(p).cross(r.sub(p)).normalize();
    };
    expect(normal(0).z).toBeCloseTo(1);
    expect(normal(1).z).toBeCloseTo(1);
  });

  it("leaves anything skinned unmerged", () => {
    const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const root = new THREE.Group();
    root.add(new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial()), new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
    expect(meshes(mergeHeld(root, "/x.glb"))).toHaveLength(2);
  });
});
