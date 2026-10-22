import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { CREATOR_HAIR_GRACE_MS, createHairAtlas } from "./hairAtlas";
import { HAIR_MAPS_URLS } from "./look";

function rig() {
  const pending = new Map<string, (t: THREE.Texture) => void>();
  const loads: string[] = [];
  const timers: (() => void)[] = [];
  const atlas = createHairAtlas((url, done) => { loads.push(url); pending.set(url, done); }, (fn, ms) => { expect(ms).toBe(CREATOR_HAIR_GRACE_MS); timers.push(fn); });
  const arrive = (copy: keyof typeof HAIR_MAPS_URLS) => {
    const tex = new THREE.Texture();
    tex.dispose = vi.fn();
    pending.get(HAIR_MAPS_URLS[copy])!(tex);
    return tex;
  };
  const wait = () => timers.splice(0).forEach(fn => fn());
  return { atlas, loads, arrive, wait };
}

describe("the shared hair atlas", () => {
  it("gives the creator the full copy, then the village the world copy, and drops the full one", () => {
    const { atlas, loads, arrive, wait } = rig();
    const up = atlas.creatorUp(), reflection = atlas.wear(true);
    const full = arrive("creator");
    expect(atlas.uniform.value).toBe(full);
    const bram = atlas.wear(false);              // someone in the scene with a mapped style: still the full copy
    expect(atlas.uniform.value).toBe(full);
    up(); reflection();                          // the creator closes (React releases in declaration order)
    wait();
    expect(atlas.uniform.value).toBe(full);      // until the world copy arrives
    const world = arrive("world");
    expect(atlas.uniform.value).toBe(world);
    expect(full.dispose).toHaveBeenCalledOnce();
    expect(loads).toEqual([HAIR_MAPS_URLS.creator, HAIR_MAPS_URLS.world]);
    bram();
  });

  it("keeps the full copy through hair changes and the thumbnail baker's remounts, and goes back to white with no one mapped", () => {
    const { atlas, loads, arrive, wait } = rig();
    const white = atlas.uniform.value;
    let up = atlas.creatorUp(), wearing = atlas.wear(true);
    const full = arrive("creator");
    wearing();                                   // a plain style
    wearing = atlas.wear(true);                  // a mapped one again
    up(); wearing();                             // the baker's next job: the face remounts
    up = atlas.creatorUp(); wearing = atlas.wear(true);
    wait();
    expect(loads).toEqual([HAIR_MAPS_URLS.creator]);   // never reloaded
    expect(atlas.uniform.value).toBe(full);
    up(); wearing();
    expect(atlas.uniform.value).toBe(full);      // the grace
    wait();
    expect(atlas.uniform.value).toBe(white);
    expect(full.dispose).toHaveBeenCalledOnce();
  });
});
