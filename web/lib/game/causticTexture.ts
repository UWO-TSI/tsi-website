import * as THREE from "three";

/**
 * ACNH water caustic mask (extracted from the dump's Terrain/water-model —
 * the actual texture the game scrolls for its water cells). Module singleton
 * so Ocean and River share one GPU texture. Data range is 0..0.69: bright
 * voronoi cells on dark ground; sample two drifting copies and threshold
 * min() for the soft light-patch look.
 */
let _tex: THREE.Texture | null = null;
export function getCausticTexture(): THREE.Texture {
  if (!_tex) {
    _tex = new THREE.TextureLoader().load("/assets/acnh/textures/water-caustic.png");
    _tex.wrapS = _tex.wrapT = THREE.RepeatWrapping;
  }
  return _tex;
}
