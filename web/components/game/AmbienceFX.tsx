"use client";

/**
 * AmbienceFX (game-feel wave G2, 2026-07-07) — the approved ambience set:
 * drifting cloud shadows, night stars + shooting stars, water sparkles,
 * periodic leaf gusts, night window glow, and the E-target ground glow.
 *
 * Everything here is deliberately cheap: one scrolling texture plane, three
 * Points clouds, one small InstancedMesh, and a handful of quads. No
 * postprocessing, no per-frame allocations.
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleRiverPoint } from "./River";

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
  return _cloudTex;
}

export function CloudShadows({ phase }: { phase: Phase }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => {
    const t = getCloudTexture();
    t.repeat.set(2, 2);
    return t;
  }, []);
  useFrame((_, delta) => {
    tex.offset.x += delta * 0.006;
    tex.offset.y += delta * 0.0028;
    if (matRef.current) {
      const target = phase === "day" ? 0.12 : phase === "night" ? 0 : 0.07;
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, target, 1.5, delta);
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={2}>
      <planeGeometry args={[240, 240]} />
      <meshBasicMaterial ref={matRef} map={tex} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ─── Night stars + occasional shooting star (item 22) ───────────────────
export function NightStars({ phase }: { phase: Phase }) {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const shootRef = useRef<THREE.Mesh>(null);
  const shootState = useRef({ next: 40 + Math.random() * 80, t: -1, from: new THREE.Vector3(), dir: new THREE.Vector3() });
  const clock = useRef(0);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Upper dome, radius ~92 (inside the r=100 sky sphere).
      const az = Math.random() * Math.PI * 2;
      const el = 0.25 + Math.random() * 1.2; // stay above the horizon band
      pos[i * 3] = Math.cos(el) * Math.sin(az) * 92;
      pos[i * 3 + 1] = Math.sin(el) * 92;
      pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * 92;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((_, delta) => {
    clock.current += delta;
    if (matRef.current) {
      const target = phase === "night" ? 0.9 : phase === "dusk" ? 0.25 : 0;
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, target, 1.2, delta);
    }
    // Shooting star: brief streak every ~1.5-3.5 minutes at night.
    const st = shootState.current;
    if (phase === "night") {
      if (st.t < 0) {
        st.next -= delta;
        if (st.next <= 0) {
          st.t = 0;
          st.next = 90 + Math.random() * 120;
          const az = Math.random() * Math.PI * 2;
          st.from.set(Math.sin(az) * 60, 55 + Math.random() * 15, Math.cos(az) * 60);
          st.dir.set(0.8 - Math.random() * 1.6, -0.35, 0.8 - Math.random() * 1.6).normalize();
        }
      } else {
        st.t += delta;
        if (st.t > 1.1) st.t = -1;
      }
    } else {
      st.t = -1;
    }
    if (shootRef.current) {
      const active = st.t >= 0;
      shootRef.current.visible = active;
      if (active) {
        const p = st.t / 1.1;
        shootRef.current.position.copy(st.from).addScaledVector(st.dir, p * 34);
        const m = shootRef.current.material as THREE.MeshBasicMaterial;
        m.opacity = Math.sin(p * Math.PI) * 0.9;
        shootRef.current.lookAt(shootRef.current.position.clone().add(st.dir));
      }
    }
  });

  return (
    <group>
      <points geometry={geometry} renderOrder={-1}>
        <pointsMaterial ref={matRef} color="#FFFDF0" size={1.6} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
      <mesh ref={shootRef} visible={false} renderOrder={-1}>
        <planeGeometry args={[3.2, 0.12]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0} depthWrite={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Water sparkles (item 24) — NL's little glints on the river ─────────
export function WaterSparkles() {
  const aRef = useRef<THREE.PointsMaterial>(null);
  const bRef = useRef<THREE.PointsMaterial>(null);
  const clock = useRef(Math.random() * 10);

  const [geoA, geoB] = useMemo(() => {
    const make = (offset: number) => {
      const g = new THREE.BufferGeometry();
      const N = 26;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t = (i + offset) / N;
        const { position, tangent } = sampleRiverPoint(Math.min(t, 0.999));
        const nx = -tangent.z, nz = tangent.x;
        const off = (Math.random() - 0.5) * 2.2;
        pos[i * 3] = position.x + nx * off;
        pos[i * 3 + 1] = 0.02;
        pos[i * 3 + 2] = position.z + nz * off;
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return g;
    };
    return [make(0), make(0.5)];
  }, []);

  useFrame((_, delta) => {
    clock.current += delta;
    if (aRef.current) aRef.current.opacity = 0.35 + Math.sin(clock.current * 2.1) * 0.35;
    if (bRef.current) bRef.current.opacity = 0.35 + Math.cos(clock.current * 1.7) * 0.35;
  });

  return (
    <group>
      <points geometry={geoA}>
        <pointsMaterial ref={aRef} color="#FFFFFF" size={0.14} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={geoB}>
        <pointsMaterial ref={bRef} color="#EAF9FF" size={0.11} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

// ─── Leaf gusts (item 27) — wind reads even with static trees ───────────
const GUST_LEAVES = 14;
export function LeafGusts() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const state = useRef({ next: 12 + Math.random() * 10, t: -1, ox: 0, oz: 0, seeds: [] as number[] });
  const _m = useMemo(() => new THREE.Matrix4(), []);
  const _q = useMemo(() => new THREE.Quaternion(), []);
  const _e = useMemo(() => new THREE.Euler(), []);
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _s = useMemo(() => new THREE.Vector3(0.2, 0.1, 1), []);

  useEffect(() => {
    state.current.seeds = Array.from({ length: GUST_LEAVES }, (_, i) => i * 0.61 + 0.13);
  }, []);

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
      const seed = st.seeds[i] ?? 0.5;
      const lag = seed * 0.8;
      const lp = Math.max(0, Math.min(1, (st.t - lag * 0.5) / 2.0));
      _p.set(
        st.ox + (seed - 0.5) * 7 + lp * 17,
        0.5 + seed * 1.6 + Math.sin((lp * 6 + seed * 9)) * 0.5,
        st.oz + ((seed * 7) % 1 - 0.5) * 7 + lp * 11
      );
      _e.set(0, seed * 6, lp * 12 + seed);
      _q.setFromEuler(_e);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
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

// ─── Night window glow (item 25) ────────────────────────────────────────
// Warm quads on the four main facades; opacity follows dusk/night. All
// share one material so the whole set is a single opacity write.
const WINDOWS: { x: number; y: number; z: number; w: number; h: number }[] = [
  // HQ (facade at z=-4, faces south/-z)
  { x: -2.1, y: 1.55, z: -4.04, w: 0.7, h: 0.85 },
  { x: 2.1, y: 1.55, z: -4.04, w: 0.7, h: 0.85 },
  // Shop (facade at z=12)
  { x: -26.35, y: 1.35, z: 11.96, w: 0.95, h: 0.8 },
  { x: -21.7, y: 1.35, z: 11.96, w: 0.95, h: 0.8 },
  // Oracle museum (facade at z=30)
  { x: -2.5, y: 1.85, z: 29.96, w: 0.6, h: 1.1 },
  { x: 2.5, y: 1.85, z: 29.96, w: 0.6, h: 1.1 },
  // House chalet (facade plane x=24 area faces -x… rotated house; front at x≈22.9)
  { x: 22.92, y: 1.5, z: 12.9, w: 0.7, h: 0.8 },
  { x: 22.92, y: 1.5, z: 15.1, w: 0.7, h: 0.8 },
];

export function NightWindows({ phase }: { phase: Phase }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#FFC97A", transparent: true, opacity: 0, depthWrite: false }),
    []
  );
  useFrame((_, delta) => {
    const target = phase === "night" ? 0.85 : phase === "dusk" ? 0.5 : 0;
    material.opacity = THREE.MathUtils.damp(material.opacity, target, 1.5, delta);
  });
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      {WINDOWS.map((w, i) => (
        <mesh
          key={i}
          position={[w.x, w.y, w.z]}
          rotation={w.x > 20 ? [0, -Math.PI / 2, 0] : [0, Math.PI, 0]}
          material={material}
        >
          <planeGeometry args={[w.w, w.h]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── E-target ground glow (item 19) ─────────────────────────────────────
// A soft pulsing ring under whatever the interact sweep currently targets.
export function TargetGlow({ targetRef }: { targetRef: React.MutableRefObject<[number, number, number] | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const clock = useRef(0);
  useFrame((_, delta) => {
    clock.current += delta;
    const g = groupRef.current;
    if (!g) return;
    const t = targetRef.current;
    if (!t) {
      if (matRef.current) matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, 0, 10, delta);
      return;
    }
    g.position.set(
      THREE.MathUtils.damp(g.position.x, t[0], 14, delta),
      t[1] + 0.05,
      THREE.MathUtils.damp(g.position.z, t[2], 14, delta)
    );
    const s = 1 + Math.sin(clock.current * 5) * 0.08;
    g.scale.set(s, 1, s);
    if (matRef.current) {
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, 0.4 + Math.sin(clock.current * 5) * 0.1, 10, delta);
    }
  });
  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.55, 0.78, 24]} />
        <meshBasicMaterial ref={matRef} color="#FFE9A8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
