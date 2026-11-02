import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeHeld } from "@/lib/game/character/heldMesh";
import { rodTip } from "@/lib/game/rodTip";
import { rodFxUrl } from "./RodAura";

const PUBLIC = join(__dirname, "../../../public");
const load = (url: string) => new Promise<THREE.Object3D>((resolve, reject) => {
  const buf = readFileSync(join(PUBLIC, url));
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});
const rods = readdirSync(join(PUBLIC, "assets/game/tools")).filter(f => f.startsWith("rod-")).map(f => `/assets/game/tools/${f}`);

describe("rods' effects (art/pipeline/build_rods.py, RodAura)", () => {
  it("names its effect on the epic and the rare rods, through the held merge", async () => {
    const named = new Map<string, string | null>();
    for (const url of rods) named.set(url.split("/").pop()!, rodFxUrl(mergeHeld(await load(url), url)));
    expect(named.get("rod-tempest.glb")).toBe("/assets/game/props/rodfx-tempest.glb");
    expect(named.get("rod-5.glb")).toBe("/assets/game/props/rodfx-tidewarden.glb");
    expect([...named.values()].filter(Boolean)).toHaveLength(4);
    expect(named.get("rod-1.glb")).toBeNull();
  });

  it.each(rods)("%s: its effect exists, costs at most five draws a holder, and never moves the tip", async url => {
    const rod = mergeHeld(await load(url), url), fx = rodFxUrl(rod);
    if (!fx) return;
    expect(existsSync(join(PUBLIC, fx))).toBe(true);
    const parts = await load(fx);
    let meshes = 0, halos = 0;
    parts.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++; if (o.name.startsWith("Halo")) halos++; });
    expect(meshes + halos).toBeLessThanOrEqual(5);
    const tip = rodTip(rod);
    parts.traverse(o => { o.userData.fx = true; });
    rod.add(parts);
    expect(rodTip(rod).distanceTo(tip)).toBeLessThan(1e-6);
  });
});
