/**
 * The shared FxMaterial (design sheet §1.7 "Meshes with an emissive shader"): heat from the mesh's own profile (a hot
 * centre line across a ring or beam, a hot base up a pillar, dome or spike) broken by scrolling noise, plus a fresnel
 * rim; cut into three cel bands; mapped through the effect's ramp row (lib/game/fx/combat.ts RampTable); dissolving as
 * it ages; added (or laid over), never tone mapped. It bends with the curved world like the built-in materials.
 * Also the particles' and the ribbon trail's shaders, so everything combat draws reads one ramp table.
 */
import * as THREE from "three";
import { COMBAT_PACK_COLS, COMBAT_PACK_ROWS } from "./combatPack";
import { RAMP_ROWS, RAMP_STEPS, type RampTable } from "./combat";

let rampTexture: THREE.DataTexture | null = null;
/** The ramp table as a texture (rows uploaded as kits' ramps appear). */
export function rampMap(table: RampTable): THREE.DataTexture {
  if (!rampTexture) {
    rampTexture = new THREE.DataTexture(table.data, RAMP_STEPS, RAMP_ROWS, THREE.RGBAFormat);
    rampTexture.colorSpace = THREE.SRGBColorSpace;
    rampTexture.magFilter = rampTexture.minFilter = THREE.LinearFilter;
  }
  if (table.dirty) { rampTexture.needsUpdate = true; table.dirty = false; }
  return rampTexture;
}

const RAMP_GLSL = `uniform sampler2D uRamp;
vec3 rampAt(float heat, float row) {
  vec3 c = texture2D(uRamp, vec2(clamp(heat, 0.0, 1.0) * ${((RAMP_STEPS - 1) / RAMP_STEPS).toFixed(5)} + ${(0.5 / RAMP_STEPS).toFixed(5)}, (row + 0.5) / ${RAMP_ROWS.toFixed(1)})).rgb;
  return c;
}
vec3 sat(vec3 c, float k) { return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, k); }
`;
const NOISE_GLSL = `float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

export interface FxMaterialOpts { profile: "across" | "up"; rim?: number; additive?: boolean; saturation?: number }
/** One per pooled mesh (its own uniforms): set uRow, uLife (0..1), uOpacity, uTime, uSeed each frame. */
export function createFxMaterial(ramp: THREE.Texture, o: FxMaterialOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "FxMaterial",
    uniforms: { uRamp: { value: ramp }, uRow: { value: 0 }, uLife: { value: 0 }, uOpacity: { value: 1 }, uTime: { value: 0 }, uSeed: { value: 0 },
      uRim: { value: o.rim ?? 0.6 }, uUp: { value: o.profile === "up" ? 1 : 0 }, uSat: { value: o.saturation ?? 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv; vN = normalize(normalMatrix * normal);
  vec3 transformed = position;
  #include <project_vertex>
  vView = normalize(-mvPosition.xyz);
}`,
    fragmentShader: `${RAMP_GLSL}${NOISE_GLSL}
uniform float uRow, uLife, uOpacity, uTime, uSeed, uRim, uUp, uSat;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  float profile = uUp > 0.5 ? 1.0 - vUv.y : 1.0 - abs(vUv.y - 0.5) * 2.0;
  float n = fxNoise(vec2(vUv.x * 22.0 + uSeed, vUv.y * 4.0 - uTime * 3.0)) * 0.6 + fxNoise(vec2(vUv.x * 57.0 - uSeed, vUv.y * 9.0 + uTime * 5.0)) * 0.4;
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0) * uRim;
  float heat = clamp(profile * (0.5 + 0.7 * n) + rim, 0.0, 1.0);
  heat = heat > 0.78 ? 1.0 : heat > 0.5 ? 0.6 : heat > 0.22 ? 0.25 : 0.0;  // three cel bands
  float a = step(0.2, heat) * smoothstep(uLife - 0.08, uLife + 0.08, n * 0.95 + 0.05) * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(sat(rampAt(heat, uRow), uSat), a);
}`,
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
}

/**
 * The combat pack's particles (the instance layout of lib/game/fx/particles.ts): camera-facing, standing, flat on the
 * ground or streaked; the frame's heat mapped through the particle's ramp row (d.y), times its tint and alpha.
 * `saturation` 0.5 for ground decals (readability rule); additive for glows, laid over for smoke and ink.
 */
export function createCombatParticleMaterial(map: THREE.Texture, ramp: THREE.Texture, additive: boolean, saturation = 1): THREE.ShaderMaterial {
  const C = COMBAT_PACK_COLS.toFixed(1), R = COMBAT_PACK_ROWS.toFixed(1);
  return new THREE.ShaderMaterial({
    name: "CombatParticles",
    uniforms: { map: { value: map }, uRamp: { value: ramp }, uSat: { value: saturation } },
    vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD;
varying vec2 vUv; varying vec4 vTint; varying float vRamp; varying float vAbove;
void main() {
  vec3 pCentre = iA.xyz, toCam = normalize(cameraPosition - pCentre);
  vec3 axX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), axY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float face = iD.w; bool onGround = face > 0.5 && face < 1.5;
  if (onGround) { axX = vec3(1.0, 0.0, 0.0); axY = vec3(0.0, 0.0, -1.0); }
  else if (face > 1.5 && face < 2.5) { axX = normalize(vec3(iD.x, 0.0, iD.z)); axY = normalize(cross(toCam, axX)); }
  float pc = cos(iB.z), ps = sin(iB.z);
  vec2 lp = position.xy * iB.xy;
  if (face > 2.5) lp.y += 0.3 * iB.y;
  vec3 transformed = pCentre + axX * (lp.x * pc - lp.y * ps) + axY * (lp.x * ps + lp.y * pc);
  vAbove = onGround ? 10.0 : transformed.y - iA.w;
  float row = floor((iB.w + 0.5) / ${C}), col = iB.w - row * ${C};
  vUv = vec2((col + uv.x) / ${C}, 1.0 - (row + 1.0 - uv.y) / ${R});
  vTint = iC; vRamp = iD.y;
  #include <project_vertex>
}`,
    fragmentShader: `${RAMP_GLSL}
uniform sampler2D map; uniform float uSat;
varying vec2 vUv; varying vec4 vTint; varying float vRamp; varying float vAbove;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vTint.a * smoothstep(0.0, 0.12, vAbove);
  if (a < 0.004) discard;
  gl_FragColor = vec4(sat(rampAt(t.r, vRamp), uSat) * vTint.rgb, a);
}`,
    transparent: true, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** The ribbon trail: per-vertex age (0 new, 1 gone) and side (0 the grip, 1 the tip); the tip and the newest run hottest. */
export function createTrailMaterial(ramp: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "WeaponTrail",
    uniforms: { uRamp: { value: ramp }, uRow: { value: 0 } },
    vertexShader: `attribute vec2 aTrail; varying vec2 vT;
void main() { vT = aTrail; vec3 transformed = position;
  #include <project_vertex>
}`,
    fragmentShader: `${RAMP_GLSL}
uniform float uRow; varying vec2 vT;
void main() {
  float heat = (1.0 - vT.x) * (0.35 + 0.65 * vT.y);
  heat = heat > 0.7 ? 1.0 : heat > 0.4 ? 0.6 : 0.25;
  float a = (1.0 - vT.x) * smoothstep(0.0, 0.25, vT.y);
  if (a < 0.02) discard;
  gl_FragColor = vec4(rampAt(heat, uRow), a);
}`,
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}
