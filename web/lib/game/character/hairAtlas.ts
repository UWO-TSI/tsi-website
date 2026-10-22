/**
 * The mapped hairstyles' shared atlas (Character.tsx's uHairAtlas): one uniform every character's body material reads.
 * A white texel until a mapped style is worn; then the world's half-size copy, or the full one while a creator-sized
 * face (faceSize >= 1024: the arrival's reflection, the creator stage, its thumbnail baker) wears one. The full copy
 * (3072x2560, about 40 MiB on the GPU) is dropped a few seconds after the last creator-sized face goes, and the village
 * goes back to the world copy (about 10 MiB); before, the full one stayed for the whole session. The wait lets the
 * thumbnail baker remount its face job after job without reloading the full copy each time.
 */
import * as THREE from "three";
import { HAIR_MAPS_URLS } from "./look";

export type HairCopy = keyof typeof HAIR_MAPS_URLS;
type Load = (url: string, done: (tex: THREE.Texture) => void) => void;

const loadTexture: Load = (url, done) => { new THREE.TextureLoader().load(url, done); };
/** How long the full copy outlives the last creator-sized face. */
export const CREATOR_HAIR_GRACE_MS = 3000;

export function createHairAtlas(load: Load = loadTexture, later: (fn: () => void, ms: number) => void = (fn, ms) => { setTimeout(fn, ms); }) {
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const uniform: { value: THREE.Texture } = { value: white };
  const copies: Partial<Record<HairCopy, THREE.Texture>> = {};
  const loading = new Set<HairCopy>();
  /** Mounted characters wearing a mapped style; those of them creator-sized; creator-sized ones mounted at all. */
  const users = { mapped: 0, creatorMapped: 0, creatorUp: 0 };

  /** Show the copy wanted now, loading it the first time. */
  function show() {
    const want: HairCopy | null = users.creatorMapped > 0 ? "creator" : users.mapped > 0 ? "world" : null;
    if (!want) return;
    const have = copies[want];
    if (have) { uniform.value = have; return; }
    if (loading.has(want)) return;
    loading.add(want);
    load(HAIR_MAPS_URLS[want], tex => {
      tex.flipY = false;                       // glTF UVs (top-left origin), as the face atlas
      tex.colorSpace = THREE.SRGBColorSpace;   // colour: decoded to linear on sampling; the alpha is the channel, as stored
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      copies[want] = tex;
      loading.delete(want);
      show();
      settle();
    });
  }
  /** With no creator-sized face up, drop the full copy (once the world copy shows, if anyone still wears a mapped style). */
  function settle() {
    const full = copies.creator;
    if (!full || users.creatorUp > 0) return;
    if (uniform.value === full) {
      if (users.mapped > 0 && !copies.world) return;   // show() is loading it; its arrival settles again
      uniform.value = copies.world ?? white;
    }
    full.dispose();
    delete copies.creator;
  }

  return {
    uniform,
    /** A creator-sized face is up (mapped or not: its copy stays while it is, through hair changes). Returns the release. */
    creatorUp(): () => void {
      users.creatorUp++;
      return () => { users.creatorUp--; later(settle, CREATOR_HAIR_GRACE_MS); };
    },
    /** A character wears a mapped style. Returns the release. */
    wear(creator: boolean): () => void {
      users.mapped++;
      if (creator) users.creatorMapped++;
      show();
      return () => { users.mapped--; if (creator) users.creatorMapped--; show(); };
    },
  };
}
