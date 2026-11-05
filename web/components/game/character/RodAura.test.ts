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
  it("names its effect on the epic and the rare rods, through the held merge", async () => {
    const named = new Map<string, string | null>();
    for (const url of rods) named.set(url.split("/").pop()!, rodFxUrl(mergeHeld(await load(url), url)));
    expect(named.get("rod-tempest.glb")).toBe("/assets/game/props/rodfx-tempest.glb");
    expect(named.get("rod-5.glb")).toBe("/assets/game/props/rodfx-tidewarden.glb");
    expect([...named.values()].filter(Boolean)).toHaveLength(4);
    expect(named.get("rod-1.glb")).toBeNull();
  });

  it("builds the Tempest from the effects library: no discs of light, a trail, a hugging aura", async () => {
    const parts = await load("/assets/game/props/rodfx-tempest.glb"), names: string[] = [];
    parts.traverse(o => names.push(o.name));
    expect(names.some(n => n.startsWith("Halo"))).toBe(false);
    expect(parts.getObjectByName("Gust")?.userData.trail).toBeGreaterThan(0);
    expect(names.some(n => n.startsWith("Aura"))).toBe(true);
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
