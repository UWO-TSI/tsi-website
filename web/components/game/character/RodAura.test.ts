import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeHeld } from "@/lib/game/character/heldMesh";
import { rodTip } from "@/lib/game/rodTip";
import { rodFxUrl } from "./RodAura";
import { fxAt } from "@/lib/game/fx/library";

const PUBLIC = join(__dirname, "../../../public");
const load = (url: string) => new Promise<THREE.Object3D>((resolve, reject) => {
  const buf = readFileSync(join(PUBLIC, url));
  // Rods ship meshopt-compressed (scripts/pack-glbs.mjs), as the game's useGLTF decodes them.
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});
const rods = readdirSync(join(PUBLIC, "assets/game/tools")).filter(f => f.startsWith("rod-")).map(f => `/assets/game/tools/${f}`);

describe("rods' effects (art/pipeline/build_rods.py, fx_library.py, RodAura)", () => {
  it("names its effect on the epic and the rare rods (and the Cedar, whose foliage sways), through the held merge", async () => {
    const named = new Map<string, string | null>();
    for (const url of rods) named.set(url.split("/").pop()!, rodFxUrl(mergeHeld(await load(url), url)));
    expect(named.get("rod-tempest.glb")).toBe("/assets/game/props/rodfx-tempest.glb");
    expect(named.get("rod-5.glb")).toBe("/assets/game/props/rodfx-tidewarden.glb");
    expect(named.get("rod-2.glb")).toBe("/assets/game/props/rodfx-cedar.glb");
    expect(named.get("rod-titanium.glb")).toBeNull();
    expect(named.get("rod-titanium-a1.glb")).toBe("/assets/game/props/rodfx-titanium-a1.glb");
    expect(named.get("rod-tidewarden-a1.glb")).toBe("/assets/game/props/rodfx-tidewarden-a1.glb");
    expect(named.get("rod-tempest-a1.glb")).toBe("/assets/game/props/rodfx-tempest-a1.glb");
    expect([...named.values()].filter(Boolean)).toHaveLength(6);
    expect(named.get("rod-1.glb")).toBeNull();
  });

  it("gives the Cedar's foliage to its effect as the library's Sway, the rod itself left plain (David 2026-11-06)", async () => {
    const fx = await load("/assets/game/props/rodfx-cedar.glb"), rod = await load("/assets/game/tools/rod-2.glb");
    const soft = fx.children.filter(n => n.userData.sway);
    expect(soft).toHaveLength(1);
    const mats = new Set<string>();
    fx.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) mats.add((m.material as THREE.Material).name); });
    expect([...mats].sort()).toEqual(["Leaves_Fresh", "Leaves_Leaf"]);
    rod.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) expect((m.material as THREE.Material).name).not.toMatch(/Leaf|Fresh/); });
  });

  it("builds the Tempest from the effects library: no discs of light, a trail, a hugging aura", async () => {
    const parts = await load("/assets/game/props/rodfx-tempest.glb"), names: string[] = [];
    parts.traverse(o => names.push(o.name));
    expect(names.some(n => n.startsWith("Halo"))).toBe(false);
    expect(parts.getObjectByName("Gust")?.userData.trail).toBeGreaterThan(0);
    expect(names.some(n => n.startsWith("Aura"))).toBe(true);
  });

  it("builds the Tidewarden from the library: its veins as Glow and no water as bought; awakened, the Water type wound on down the shaft (round 11)", async () => {
    const mats = async (url: string) => { const m: string[] = [], n: string[] = []; (await load(url)).traverse(o => { n.push(o.name); const x = (o as THREE.Mesh).material as THREE.Material | undefined; if (x) m.push(x.name); }); return { m, n }; };
    const base = await mats("/assets/game/props/rodfx-tidewarden.glb"), woke = await mats("/assets/game/props/rodfx-tidewarden-a1.glb");
    expect([...base.n, ...woke.n].some(n => n.startsWith("Halo"))).toBe(false);
    expect([...base.m, ...woke.m].some(m => /Aura/.test(m))).toBe(false);
    expect(base.m.every(m => m.endsWith("Glow"))).toBe(true);
    for (const kind of ["Water", "Foam", "Spray", "Glow"]) expect(woke.m.some(m => m.endsWith(kind))).toBe(true);
    // the wrap gated from the head (0) down the shaft, all of it shown at the strength the effect is drawn at as made
    const parts = await load("/assets/game/props/rodfx-tidewarden-a1.glb"), tide = parts.getObjectByName("Tide") as THREE.Mesh, gate = tide.geometry.getAttribute("color");
    expect(tide.geometry.getAttribute("uv")).toBeDefined();
    expect(Number(tide.userData.spin)).toBeGreaterThan(0);
    let lo = 1, hi = 0;
    for (let i = 0; i < gate.count; i++) { lo = Math.min(lo, gate.getY(i)); hi = Math.max(hi, gate.getY(i)); }
    expect(lo).toBe(0);
    const made = Number(parts.userData.fxStrength);
    expect(hi).toBeGreaterThan(0.2);
    expect(hi).toBeLessThanOrEqual(Math.min(1, fxAt("water", "wrap", made) - 1));
  });

  it("keeps the Titanium plain and opens it when it awakens (rod-titanium round 2)", async () => {
    // One polished material with a thin film (the rainbow glisten), so each draws once in a hand.
    const held = async (url: string) => { const m: THREE.Mesh[] = []; mergeHeld(await load(url), url).traverse(o => { if ((o as THREE.Mesh).isMesh) m.push(o as THREE.Mesh); }); return m; };
    const [shut] = await held("/assets/game/tools/rod-titanium.glb"), woke = await held("/assets/game/tools/rod-titanium-a1.glb");
    expect(woke).toHaveLength(1);
    for (const m of [shut, woke[0]]) {
      expect((m.material as THREE.Material).name).toBe("P_Polished");
      expect((m.material as THREE.MeshPhysicalMaterial).iridescence).toBeGreaterThan(0);
    }
    // The awakened rod is the same rod opened: its morph target is the closed rod, and it ships open.
    const g = woke[0].geometry, pos = g.getAttribute("position"), delta = g.morphAttributes.position![0];
    expect(woke[0].morphTargetInfluences).toEqual([0]);
    const closed = new THREE.Box3(), v = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) closed.expandByPoint(v.fromBufferAttribute(pos, i).add(g.morphTargetsRelative ? d.fromBufferAttribute(delta, i) : d.fromBufferAttribute(delta, i).sub(v)));
    shut.geometry.computeBoundingBox(); g.computeBoundingBox();
    expect(closed.min.distanceTo(shut.geometry.boundingBox!.min) + closed.max.distanceTo(shut.geometry.boundingBox!.max)).toBeLessThan(1e-4);
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeGreaterThan(closed.max.x - closed.min.x);
    // Its energy from the library: a core and hexagons of light, no halo or aura.
    const names: string[] = [];
    (await load("/assets/game/props/rodfx-titanium-a1.glb")).traverse(o => names.push(o.name));
    expect(names).toEqual(expect.arrayContaining(["Core", "Rings"]));
    expect(names.some(n => n.startsWith("Halo") || n.startsWith("Aura"))).toBe(false);
  });

  it.each(rods)("%s: its effect exists, costs at most five draws a holder, and never moves the tip", async url => {
    const rod = mergeHeld(await load(url), url), fx = rodFxUrl(rod);
    if (!fx) return;
    expect(existsSync(join(PUBLIC, fx))).toBe(true);
    const parts = await load(fx);
    let meshes = 0, halos = 0, trails = 0;
    parts.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++; if (o.name.startsWith("Halo")) halos++; if (o.userData.trail) trails++; });
    expect(meshes + halos + trails).toBeLessThanOrEqual(5);
    const tip = rodTip(rod);
    parts.traverse(o => { o.userData.fx = true; });
    rod.add(parts);
    expect(rodTip(rod).distanceTo(tip)).toBeLessThan(1e-6);
  });
});
