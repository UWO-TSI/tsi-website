/**
 * Things in the way (specs/camera-orbit.md): when a building, a tree or a cliff stands between the turning camera and
 * the player, it fades to see-through around the player instead of the camera snapping in. The line of sight is tested
 * against each scene's occluders (footprints and canopies from the map, below) and its ground (a hill or a canyon
 * wall), which eases the cut in and out; the cut itself is a dithered hole, drawn by every prepared model
 * (modelMaterials prepareModel) and the terrain (terrainMaterials), through whatever is nearer the camera than the
 * player, higher than their feet, within a circle round them on screen. Characters, the ground they stand on and the
 * water are never cut, and the shadow pass is untouched (a faded house still casts). Strength 0 (interiors, the
 * applicant island) draws exactly as before.
 */
import * as THREE from "three";
import type { WebGLProgramParametersWithUniforms } from "three";

/** A box from the ground up that can hide the player: a building's footprint, a tree's canopy. */
export interface Occluder { x: number; z: number; hx: number; hz: number; y0: number; y1: number }

/** Whether the segment a→b passes through the box (the slab test; touching counts). */
export function segmentHitsBox(a: THREE.Vector3Like, b: THREE.Vector3Like, o: Occluder): boolean {
  let t0 = 0, t1 = 1;
  const slabs: [number, number, number, number][] = [[a.x, b.x - a.x, o.x - o.hx, o.x + o.hx], [a.y, b.y - a.y, o.y0, o.y1], [a.z, b.z - a.z, o.z - o.hz, o.z + o.hz]];
  for (const [p, d, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let u = (lo - p) / d, v = (hi - p) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Whether the ground rises above the line of sight from the eye to the target (a hill, a cliff, a canyon wall), sampled
 * every half unit; the last unit before the target is theirs (the slope they stand on).
 */
export function groundBlocks(eye: THREE.Vector3Like, target: THREE.Vector3Like, ground: (x: number, z: number) => number): boolean {
  const run = Math.hypot(target.x - eye.x, target.z - eye.z), n = Math.ceil(run / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (run * (1 - t) < 1) break;
    const x = eye.x + (target.x - eye.x) * t, z = eye.z + (target.z - eye.z) * t;
    if (ground(x, z) > eye.y + (target.y - eye.y) * t) return true;
  }
  return false;
}

/** Whether any occluder stands on the line of sight from the eye to the target. */
export const lineBlocked = (eye: THREE.Vector3Like, target: THREE.Vector3Like, list: readonly Occluder[]) => list.some(o => segmentHitsBox(eye, target, o));

/** A canopy's box round a tree at (x, z) standing on y: generous, since a miss hides the player and a false hit cuts nothing that isn't in front. */
export const treeOccluder = (x: number, z: number, y: number): Occluder => ({ x, z, hx: 1.5, hz: 1.5, y0: y + 0.8, y1: y + 5.5 });
/** A footprint (half extents) standing `height` tall on y. */
export const boxOccluder = (x: number, z: number, hx: number, hz: number, y: number, height: number): Occluder => ({ x, z, hx, hz, y0: y, y1: y + height });

// ── The cut ────────────────────────────────────────────────────────────
/** The player on screen: x, y in NDC, the circle's radius (NDC y), the strength 0–1. */
export const CUTOUT = { value: new THREE.Vector4(0, 0, 0.2, 0) };
/** x: the aspect (NDC x to y), y: the player's view depth (only nearer fragments are cut), z: the lowest world height cut (just over their feet). */
export const CUTOUT_VIEW = { value: new THREE.Vector3(1, 0, 0) };
/** Ground within this of the player's feet stays, so the slope or step they stand on never opens. */
export const CUT_FLOOR = 0.35;
/** The circle's radius in world units at the player (about their height round the chest). */
export const CUT_RADIUS = 1.25;
/** Fragments within this of the player's own depth stay: their feet, a fence they lean on. */
const CUT_MARGIN = 0.6;

/** A material draws the cut (vertex: its clip position and world height; fragment: a dithered discard in the circle). */
export function addCutout(shader: WebGLProgramParametersWithUniforms) {
  shader.uniforms.uCut = CUTOUT;
  shader.uniforms.uCutView = CUTOUT_VIEW;
  shader.vertexShader = "varying vec4 vCutClip;\nvarying float vCutY;\n" + shader.vertexShader.replace("#include <fog_vertex>", `#include <fog_vertex>
  vCutClip = gl_Position;
  #ifdef USE_INSTANCING
    vCutY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
  #else
    vCutY = (modelMatrix * vec4(transformed, 1.0)).y;
  #endif`);
  shader.fragmentShader = `uniform vec4 uCut;
uniform vec3 uCutView;
varying vec4 vCutClip;
varying float vCutY;
float tsiBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0), lo = mod(q, 2.0), hi = floor(q / 2.0);
  return (4.0 * mod(2.0 * lo.x + 3.0 * lo.y, 4.0) + mod(2.0 * hi.x + 3.0 * hi.y, 4.0) + 0.5) / 16.0;
}
` + shader.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  if (uCut.w > 0.0 && vCutClip.w < uCutView.y - ${CUT_MARGIN.toFixed(2)} && vCutY > uCutView.z) {
    vec2 cutD = (vCutClip.xy / vCutClip.w - uCut.xy) * vec2(uCutView.x, 1.0);
    float cutKeep = mix(1.0, smoothstep(0.55, 1.0, length(cutD) / uCut.z), uCut.w);
    if (cutKeep < tsiBayer(gl_FragCoord.xy)) discard;
  }`);
}

