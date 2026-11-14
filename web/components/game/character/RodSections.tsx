/**
 * An awakened rod's floating sections (lib/game/fx/sections.ts; the Titanium's `Sections`, art/pipeline/build_rods.py
 * titanium_a1): one lit mesh, one draw a holder. Each vertex's UV is its section and its plate's middle angle about the
 * rod's axis; the vertex shader leans each plate out from its section's foot, stands it off the beam and turns the
 * section round the beam, and moves the section by this holder's offset: a spring that lags it behind the rod's motion
 * (the higher sections looser, so they follow in a stagger), a slow hover, and in the awakening the shake before it
 * cracks open. Its material is the rod's own (cloned: the stage's preset, a hand's look), so the plates are the rod's
 * metal. In the awakening each section cracks with a puff of grey smoke into the scene's movement particles and a
 * latch's click.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { FACE, type Recipe } from "@/lib/game/fx/particles";
import { SECTION_GAP, SECTION_PUSH, SECTION_TILT, sectionAt, spinOf, spinningAt, unlockOf } from "@/lib/game/fx/sections";
import { useMoveParticles, type MoveParticles } from "../movement/moveFx";

const MAX = 12;
const PARS = `#define ROD_SECTIONS ${MAX}
uniform vec4 uSec[ROD_SECTIONS];
uniform vec3 uSecOff[ROD_SECTIONS];
attribute vec2 aSection;
// x: open, y: turn round the beam, z: the section's foot height, w: the plates' pivot radius (glTF units, Y up)
void sectionMove(inout vec3 p, inout vec3 n) {
  int i = int(aSection.x + 0.5);
  vec4 s = uSec[i];
  vec2 d = vec2(cos(aSection.y), sin(aSection.y)), t = vec2(-d.y, d.x);
  float th = s.x * ${SECTION_TILT.toFixed(3)}, c = cos(th), sn = sin(th);
  float rho = dot(p.xz, d), tau = dot(p.xz, t), h = p.y - s.z, dr = rho - s.w;
  float rho2 = s.w + dr * c + h * sn + s.x * (${SECTION_PUSH.toFixed(3)} * s.w + ${SECTION_GAP.toFixed(4)});
  p = vec3(d.x * rho2 + t.x * tau, s.z + h * c - dr * sn, d.y * rho2 + t.y * tau);
  float nr = dot(n.xz, d), nt = dot(n.xz, t), nr2 = nr * c + n.y * sn;
  n = vec3(d.x * nr2 + t.x * nt, n.y * c - nr * sn, d.y * nr2 + t.y * nt);
  float ca = cos(s.y), sa = sin(s.y);
  p.xz = vec2(ca * p.x - sa * p.z, sa * p.x + ca * p.z);
  n.xz = vec2(ca * n.x - sa * n.z, sa * n.x + ca * n.z);
  p += uSecOff[i];
}
`;

interface State {
  n: number; foot: number[]; pivot: number[]; open: number[]; turn: number[]; cracked: boolean[];
  off: THREE.Vector3[]; vel: THREE.Vector3[]; at: THREE.Vector3[]; was: THREE.Vector3[]; primed: boolean;
  uSec: THREE.Vector4[]; uSecOff: THREE.Vector3[]; seed: number;
}

/** The rod's own material (not its effect's), cloned and moved by this holder's sections. */
function sectionsMaterial(rod: THREE.Object3D, st: State): THREE.Material {
  let own: THREE.MeshStandardMaterial | null = null;
  rod.traverse(o => { const m = o as THREE.Mesh; if (!own && m.isMesh && !m.userData.fx) own = m.material as THREE.MeshStandardMaterial; });
  const m = (own ?? new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.26 })).clone() as THREE.MeshStandardMaterial;
  m.vertexColors = true;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uSec: { value: st.uSec }, uSecOff: { value: st.uSecOff } });
    shader.vertexShader = PARS + shader.vertexShader
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n  vec3 secP = position;\n  sectionMove(secP, objectNormal);")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed = secP;");
  };
  m.customProgramCacheKey = () => "rod-sections-v1";
  return m;
}

/** Module scope (the react compiler forbids writing through hook values): the holder's material on its sections, and back. */
function wear(mesh: THREE.Mesh, rod: THREE.Object3D, st: State) {
  const before = mesh.material, mine = sectionsMaterial(rod, st);
  mesh.material = mine;
  mesh.frustumCulled = false;                    // it moves off its bounds
  return () => { mine.dispose(); mesh.material = before; };
}

/** `rod` the holder; `mesh` its effect's `Sections` (this holder's clone). */
export default function RodSections({ rod, mesh }: { rod: THREE.Object3D; mesh: THREE.Mesh }) {
  const dust = useMoveParticles();
  const st = useMemo(() => {
    const flat = (mesh.userData.sections as number[]) ?? [], n = Math.min(MAX, flat.length / 2);
    const g = mesh.geometry;
    if (!g.getAttribute("aSection")) { g.setAttribute("aSection", g.getAttribute("uv")); g.deleteAttribute("uv"); }
    const v3 = () => Array.from({ length: n }, () => new THREE.Vector3());
    const s: State = { n, foot: [], pivot: [], open: Array(n).fill(1), turn: Array.from({ length: n }, (_, i) => i * 0.9), cracked: Array(n).fill(true),
      off: v3(), vel: v3(), at: v3(), was: v3(), primed: false,
      uSec: Array.from({ length: MAX }, () => new THREE.Vector4()), uSecOff: Array.from({ length: MAX }, () => new THREE.Vector3()), seed: rod.id * 7919 };
    for (let i = 0; i < n; i++) { s.foot.push(flat[i * 2]); s.pivot.push(flat[i * 2 + 1]); }
    return s;
  }, [mesh, rod]);
  useEffect(() => wear(mesh, rod, st), [mesh, rod, st]);
  useFrame(({ clock }, delta) => step(st, rod, dust, clock.elapsedTime, Math.min(delta, 0.1)));
  return null;
}

const v = new THREE.Vector3(), w = new THREE.Vector3(), q = new THREE.Quaternion(), acc = new THREE.Vector3(), dir = new THREE.Vector3();
/** Module scope (the react compiler forbids writing through hook values): one frame of a holder's sections. */
function step(st: State, rod: THREE.Object3D, dust: MoveParticles, t: number, dt: number) {
  if (!st.n) return;
  const unlock = unlockOf(rod as unknown as Parameters<typeof unlockOf>[0]);
  rod.updateWorldMatrix(true, false);
  const scale = rod.getWorldScale(w).x || 1;
  rod.getWorldQuaternion(q).invert();
  for (let i = 0; i < st.n; i++) {
    const at = sectionAt(i, st.n, unlock), top = i + 1 < st.n ? st.foot[i + 1] : st.foot[i] + (st.foot[i] - st.foot[Math.max(0, i - 1)]);
    // cracking is a snap; floating out is slow
    const rate = at.open > st.open[i] ? (unlock && !unlock.float ? 14 : 2.2) : 6;
    st.open[i] += (at.open - st.open[i]) * (1 - Math.exp(-dt * rate));
    const o = st.open[i];
    st.turn[i] += dt * spinOf(i) * spinningAt(o);
    // The lag: the section's middle hangs back against the rod's acceleration, on a spring; the higher, the looser.
    const mid = rod.localToWorld(v.set(0, (st.foot[i] + top) / 2, 0));
    if (!st.primed || dt <= 0) { st.was[i].copy(mid); st.at[i].set(0, 0, 0); }
    else {
      acc.copy(mid).sub(st.was[i]).divideScalar(dt);          // its velocity, then how much it changed
      const a = w.copy(acc).sub(st.at[i]).divideScalar(dt);
      st.at[i].copy(acc); st.was[i].copy(mid);
      a.applyQuaternion(q).divideScalar(scale).clampLength(0, 60);
      const k = 140 / (1 + 0.35 * i), damp = 2 * Math.sqrt(k) * 0.45;
      st.vel[i].addScaledVector(st.off[i], -k * dt).addScaledVector(st.vel[i], -damp * dt).addScaledVector(a, -0.12 * dt);
      st.off[i].addScaledVector(st.vel[i], dt).clampLength(0, 0.04);
    }
    const hover = 0.004 * Math.sin(t * 1.5 + i * 0.8), shake = at.shake ? 0.0035 : 0;
    st.uSecOff[i].copy(st.off[i]).multiplyScalar(o).add(v.set(shake * Math.sin(t * 83 + i), hover * o + shake * 0.6 * Math.sin(t * 71 + 2 * i), shake * Math.sin(t * 97 + 3 * i)));
    st.uSec[i].set(o, st.turn[i], st.foot[i], st.pivot[i]);
    if (!at.cracked) st.cracked[i] = false;
    else if (!st.cracked[i]) {
      st.cracked[i] = true;
      if (unlock) crack(st, rod, dust, i, (st.foot[i] + top) / 2, scale);
    }
  }
  st.primed = true;
}

/** A section cracking open: a puff of grey smoke out of each split, and a latch's click. */
function crack(st: State, rod: THREE.Object3D, dust: MoveParticles, i: number, y: number, scale: number) {
  const L = 0.86 * scale, smoke: Recipe = { sprite: "dust", count: [2, 3], life: [0.55, 0.9], size: [0.06 * L, 0.1 * L], grow: 2.4, speed: [0.25 * L, 0.5 * L],
    spread: 0.35, up: [0.02 * L, 0.08 * L], gravity: 0, drag: 3, wind: 0.1, lift: 0.06 * L, alpha: 0.75, face: FACE.billboard, jitter: 0.01 * L };
  for (let k = 0; k < 3; k++) {
    // each split between plates, the section's turn (30 degrees a section, art/pipeline/build_rods.py) plus a third of a turn
    const a = -(i * Math.PI / 6 + k * Math.PI * 2 / 3) + st.turn[i];
    const p = rod.localToWorld(v.set(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03));
    const d = dir.set(Math.cos(a), 0, Math.sin(a)).transformDirection(rod.matrixWorld);
    dust.pool.burst(smoke, p.x, p.y, p.z, p.y - 50, d.x, d.z, 1, 0xa4a9b1, ++st.seed);
  }
  AudioManager.playSFX("keyswitch", { rate: 0.55 + 0.05 * i, gain: 0.45 });
}
