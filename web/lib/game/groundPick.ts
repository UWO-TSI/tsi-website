import * as THREE from "three";
import { sampleTerrainHeightFast } from "@/components/game/terrain";
import { WORLD_BEND } from "./curvedWorld";

/**
 * groundPick (game-feel fix, 2026-07-08) — where does a screen ray hit the
 * terrain THE PLAYER ACTUALLY SEES?
 *
 * Click-to-move used a flat y=0 plane, which desyncs two ways:
 *  1. the terrain is a 0-0.6u heightfield with a carved river valley, and
 *  2. the curved-world shader sinks geometry in view space (z² · BEND), so
 *     distant ground renders LOWER than its logical position — a naive ray
 *     hit lands short of the point under the cursor.
 *
 * We march the ray against the *visually curved* height: at each candidate
 * point, visualY = terrainY - BEND · viewZ². Coarse 2u steps find the sign
 * change, ten bisection rounds pin it. ~40 grid lookups worst case — cheap,
 * and only on click.
 */

const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();

export function pickCurvedGround(ray: THREE.Ray, camera: THREE.Camera): THREE.Vector3 | null {
  camera.getWorldDirection(_fwd);
  const co = camera.position;

  const heightAbove = (t: number): number => {
    _p.copy(ray.origin).addScaledVector(ray.direction, t);
    const vz =
      (_p.x - co.x) * _fwd.x + (_p.y - co.y) * _fwd.y + (_p.z - co.z) * _fwd.z;
    const visY = sampleTerrainHeightFast(_p.x, _p.z) - WORLD_BEND * vz * vz;
    return _p.y - visY;
  };

  let tPrev = 1;
  if (heightAbove(tPrev) <= 0) return null; // ray starts under the ground

  for (let t = 3; t <= 140; t += 2) {
    if (heightAbove(t) <= 0) {
      let lo = tPrev;
      let hi = t;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (heightAbove(mid) > 0) lo = mid;
        else hi = mid;
      }
      _p.copy(ray.origin).addScaledVector(ray.direction, (lo + hi) / 2);
      return _p.clone();
    }
    tPrev = t;
  }
  return null;
}
