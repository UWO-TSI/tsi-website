"use client";

/**
 * AmbienceFX (game-feel wave G2, 2026-07-07) — the approved ambience set:
 * drifting cloud shadows, periodic leaf gusts, seasonal particles and mist.
 *
 * Everything here is deliberately cheap: one scrolling texture plane, a few
 * small InstancedMeshes and quads. No postprocessing, no per-frame allocations.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useActivePalette } from "@/lib/content/loader";

type Phase = "day" | "night" | "dawn" | "dusk";

// ─── Cloud shadows (item 20) ────────────────────────────────────────────
// A big transparent plane with a few soft dark blobs, slowly scrolling its
// UVs — reads as clouds drifting over the fields for one texture sample.
let _cloudTex: THREE.CanvasTexture | null = null;
function getCloudTexture(): THREE.CanvasTexture {
  if (_cloudTex) return _cloudTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const blob = (x: number, y: number, rx: number, ry: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.7, `rgba(0,0,0,${a * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  blob(60, 70, 46, 30, 0.85);
  blob(95, 85, 34, 24, 0.7);
  blob(190, 180, 52, 34, 0.8);
  blob(225, 160, 30, 22, 0.6);
  blob(150, 40, 26, 18, 0.55);
  _cloudTex = new THREE.CanvasTexture(c);
  _cloudTex.wrapS = _cloudTex.wrapT = THREE.RepeatWrapping;
  _cloudTex.repeat.set(2, 2);
  return _cloudTex;
}

export function CloudShadows({ phase, size = [240, 240], bounded = false }: { phase: Phase; size?: [number, number]; bounded?: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, delta) => {
    // Module-cached texture — mutated through the getter so the compiler's
    // frozen-memo rule stays satisfied.
    const tex = getCloudTexture();
    tex.offset.x += delta * 0.006;
    tex.offset.y += delta * 0.0028;
    if (matRef.current) {
      const target = phase === "day" ? 0.12 : phase === "night" ? 0 : 0.07;
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, target, 1.5, delta);
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={matRef} map={getCloudTexture()} transparent opacity={0} depthWrite={false}
        onBeforeCompile={shader => {
          if (bounded) {
            shader.vertexShader = "varying vec2 vCloudUv;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloudUv = uv;");
            shader.fragmentShader = "varying vec2 vCloudUv;\n" + shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.65, 1.0, length(vCloudUv * 2.0 - 1.0));");
          }
        }} customProgramCacheKey={() => `cloud-shade-${bounded}`} />
    </mesh>
  );
}

// ─── Leaf gusts (item 27) — wind reads even with static trees ───────────
const GUST_LEAVES = 14;
const GUST_SEEDS = Array.from({ length: GUST_LEAVES }, (_, i) => ((i * 0.61 + 0.13) % 1));
const _gm = new THREE.Matrix4();
const _gq = new THREE.Quaternion();
const _ge = new THREE.Euler();
const _gp = new THREE.Vector3();
const _gs = new THREE.Vector3(0.2, 0.1, 1);
export function LeafGusts() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const state = useRef({ next: 16, t: -1, ox: 0, oz: 0 });

  useFrame((_, delta) => {
    const st = state.current;
    const mesh = meshRef.current;
    if (!mesh) return;
    if (st.t < 0) {
      mesh.visible = false;
      st.next -= delta;
      if (st.next <= 0) {
        st.t = 0;
        st.next = 20 + Math.random() * 14;
        st.ox = (Math.random() - 0.5) * 40;
        st.oz = (Math.random() - 0.5) * 40;
      }
      return;
    }
    st.t += delta;
    if (st.t > 2.4) { st.t = -1; return; }
    mesh.visible = true;
    const p = st.t / 2.4;
    const fade = Math.sin(p * Math.PI);
    for (let i = 0; i < GUST_LEAVES; i++) {
      const seed = GUST_SEEDS[i];
      const lag = seed * 0.8;
      const lp = Math.max(0, Math.min(1, (st.t - lag * 0.5) / 2.0));
      _gp.set(
        st.ox + (seed - 0.5) * 7 + lp * 17,
        0.5 + seed * 1.6 + Math.sin((lp * 6 + seed * 9)) * 0.5,
        st.oz + ((seed * 7) % 1 - 0.5) * 7 + lp * 11
      );
      _ge.set(0, seed * 6, lp * 12 + seed);
      _gq.setFromEuler(_ge);
      _gm.compose(_gp, _gq, _gs);
      mesh.setMatrixAt(i, _gm);
    }
    (mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, GUST_LEAVES]} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#7FBF52" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ─── Seasonal particles (wake 65) ───────────────────────────────────────
// Snowfall (winter), leaf-fall (autumn), petal-drift (spring sakura) —
// one InstancedMesh in a player-following box. Mode resolves from the
// ACTIVE PALETTE by slug when a real season row is live, with a value
// fallback (grass/accent hexes) so /lab/world palette previews — which
// swap colors but keep the resolved slug — trigger the same weather.
const FLAKE_COUNT = 130;
const FLAKE_SEEDS = Array.from({ length: FLAKE_COUNT }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453;
  return a - Math.floor(a);
});
const _fp = new THREE.Vector3();
const _fe = new THREE.Euler();
const _fq = new THREE.Quaternion();
const _fs = new THREE.Vector3(1, 1, 1);
const _fm = new THREE.Matrix4();

export type ParticleMode = "snow" | "leaves" | "petals" | null;

const PARTICLE_LOOKS: Record<Exclude<ParticleMode, null>, { color: string; size: number; fall: number; sway: number; spin: number; opacity: number }> = {
  snow: { color: "#F4F8FC", size: 0.09, fall: 1.15, sway: 0.55, spin: 2, opacity: 0.9 },
  leaves: { color: "#C7823A", size: 0.15, fall: 0.7, sway: 1.1, spin: 9, opacity: 0.92 },
  petals: { color: "#F5B8CC", size: 0.11, fall: 0.55, sway: 1.4, spin: 6, opacity: 0.9 },
};

function resolveParticleMode(slug: string, palette: { grass: string; accent: string }): ParticleMode {
  if (/winter|frost|snow|christmas/i.test(slug)) return "snow";
  if (/autumn|harvest|fall/i.test(slug)) return "leaves";
  if (/spring|sakura/i.test(slug)) return "petals";
  const g = palette.grass?.toLowerCase();
  if (g === "#e8eef2") return "snow";
  if (g === "#9fa23f") return "leaves";
  if (palette.accent?.toLowerCase() === "#f5a9c4") return "petals";
  return null;
}

/** `mode` overrides the active-palette lookup (member island passes its own season). */
export function SeasonalParticles({ playerPosRef, mode: forcedMode }: { playerPosRef: React.RefObject<THREE.Vector3>; mode?: ParticleMode }) {
  const { data: activePalette } = useActivePalette();
  const mode = forcedMode !== undefined ? forcedMode : resolveParticleMode(activePalette.slug, activePalette.palette);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || !mode) return;
    const look = PARTICLE_LOOKS[mode];
    const t = clock.elapsedTime;
    const p = playerPosRef.current;
    const H = 11; // fall column height
    const R = 26; // half-extent of the box around the player
    for (let i = 0; i < FLAKE_COUNT; i++) {
      const seed = FLAKE_SEEDS[i];
      const seed2 = FLAKE_SEEDS[(i + 61) % FLAKE_COUNT];
      const y = H - ((t * look.fall * (0.75 + seed * 0.5) + seed * H * 3) % H);
      _fp.set(
        p.x + (seed * 2 - 1) * R + Math.sin(t * 0.7 + seed * 20) * look.sway,
        y,
        p.z + (seed2 * 2 - 1) * R + Math.cos(t * 0.55 + seed * 14) * look.sway * 0.7
      );
      _fe.set(Math.sin(t + seed * 9) * 0.6, seed * 6 + t * look.spin * 0.1 * (seed > 0.5 ? 1 : -1), t * look.spin * 0.12 * (0.4 + seed));
      _fq.setFromEuler(_fe);
      _fs.setScalar(look.size * (0.7 + seed * 0.6));
      _fm.compose(_fp, _fq, _fs);
      mesh.setMatrixAt(i, _fm);
    }
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(look.color);
    mat.opacity = look.opacity;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!mode) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FLAKE_COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ─── Mist banks (2026-09-24) ────────────────────────────────────────────
// Fog-day haze that hugs the ground: a handful of large soft sprites (the
// existing sun-glow radial) tinted with the fog colour, drifting slowly
// around the player. Normal blending, no depth write; one draw each.
const MIST_COUNT = 9;
export function MistBanks({ playerPosRef, color, opacity = 0.32 }: { playerPosRef: React.RefObject<THREE.Vector3>; color: string; opacity?: number }) {
  const glow = useTexture("/assets/sky/sun.png");
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const p = playerPosRef.current, t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      const a = (i / MIST_COUNT) * Math.PI * 2 + t * 0.015;
      const r = 5 + (i % 3) * 4;
      child.position.set(p.x + Math.cos(a) * r, 0.9 + (i % 2) * 0.5, p.z + Math.sin(a) * r + 3);
    });
  });
  return <group ref={group}>{Array.from({ length: MIST_COUNT }, (_, i) => (
    <sprite key={i} scale={[9 + (i % 3) * 2, 3.2, 1]} renderOrder={4}>
      <spriteMaterial map={glow} color={color} transparent opacity={opacity} depthWrite={false} fog={false} />
    </sprite>
  ))}</group>;
}
