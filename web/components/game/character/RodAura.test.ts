import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeHeld } from "@/lib/game/character/heldMesh";
import { rodTip } from "@/lib/game/rodTip";
import { rodFxUrl } from "./RodAura";

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
    expect(named.get("rod-titanium.glb")).toBe("/assets/game/props/rodfx-titanium.glb");
    expect(named.get("rod-titanium-a1.glb")).toBe("/assets/game/props/rodfx-titanium-a1.glb");
    expect(named.get("rod-reserved-slate.glb")).toBe("/assets/game/props/rodfx-reserved-slate.glb");
    expect([...named.values()].filter(Boolean)).toHaveLength(7);
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

  it("builds the Tidewarden from the library: the Water type and its veins as Glow, no discs, no aura", async () => {
    const parts = await load("/assets/game/props/rodfx-tidewarden.glb"), mats: string[] = [], names: string[] = [];
    parts.traverse(o => { names.push(o.name); const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) mats.push(m.name); });
    expect(names.some(n => n.startsWith("Halo"))).toBe(false);
    expect(mats.some(m => /Aura/.test(m))).toBe(false);
    for (const kind of ["Water", "Foam", "Spray", "Glow"]) expect(mats.some(m => m.endsWith(kind))).toBe(true);
    // the water's own data came through the export: uv across and along, and the grown water gated past the drawn wrap
    const tide = parts.getObjectByName("Tide") as THREE.Mesh, gate = tide.geometry.getAttribute("color");
    expect(tide.geometry.getAttribute("uv")).toBeDefined();
    let lo = 1, hi = 0;
    for (let i = 0; i < gate.count; i++) { lo = Math.min(lo, gate.getY(i)); hi = Math.max(hi, gate.getY(i)); }
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.9);
  });

  it("keeps the Titanium quiet (metal, not magic) and builds its awakening's energy from the library (rod-titanium round 1)", async () => {
    const names = async (url: string) => { const n: string[] = []; (await load(url)).traverse(o => n.push(o.name)); return n; };
    const base = await names("/assets/game/props/rodfx-titanium.glb"), woke = await names("/assets/game/props/rodfx-titanium-a1.glb");
    expect([...base, ...woke].some(n => n.startsWith("Halo"))).toBe(false);
    expect(base.some(n => n.startsWith("Aura"))).toBe(false);
    expect(woke).toEqual(expect.arrayContaining(["Energy", "Core", "Blades"]));
    // Solid on the shop's white: no aura or additive light washing the plates (rod-titanium round 1b).
    expect(woke.some(n => n.startsWith("Aura"))).toBe(false);
    // Each rod is one preset material, so it draws once in a hand: the machined rod polished metal, the armour paint.
    for (const [url, finish] of [["/assets/game/tools/rod-titanium.glb", "P_Polished"], ["/assets/game/tools/rod-titanium-a1.glb", "P_Paint"]]) {
      const held = mergeHeld(await load(url), url), meshes: THREE.Mesh[] = [];
      held.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      expect(meshes.map(m => (m.material as THREE.Material).name)).toEqual([finish]);
    }
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
