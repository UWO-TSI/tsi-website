"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleTerrainHeightFast } from "./terrain";

/**
 * Ambient life — sprint A6. Procedural-only (no textures, no asset loads).
 * Butterflies (day), fireflies (night), leaves/pollen drift (always),
 * background birds (day). Phase prop comes from the parent.
 */

// Seeded PRNG so per-mount values are deterministic.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Butterflies (day only, 3-5) ────────────────────────────────
const BUTTERFLY_COLORS = ["#FFD9F0", "#D9F0FF", "#FFF0D9", "#F0FFD9"];

function Butterfly({ seed }: { seed: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftWingRef = useRef<THREE.Mesh>(null);
  const rightWingRef = useRef<THREE.Mesh>(null);

  const { home, color, phase, radius } = useMemo(() => {
    const rng = seededRandom(seed * 977 + 31);
    return {
      home: new THREE.Vector3((rng() - 0.5) * 50, 0, (rng() - 0.5) * 50),
      color: BUTTERFLY_COLORS[Math.floor(rng() * BUTTERFLY_COLORS.length)],
      phase: rng() * Math.PI * 2,
      radius: 2 + rng() * 1.5,
    };
  }, [seed]);

  const prev = useMemo(() => new THREE.Vector3(home.x, 1.4, home.z), [home]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Sine-wave path around home.
    const ox = Math.sin(t * 0.45 + phase) * radius + Math.cos(t * 0.31 + phase * 1.3) * (radius * 0.4);
    const oz = Math.cos(t * 0.38 + phase * 0.7) * radius + Math.sin(t * 0.27 + phase * 1.7) * (radius * 0.4);

    let x = home.x + ox;
    let z = home.z + oz;
    // Clamp to playable map.
    x = THREE.MathUtils.clamp(x, -30, 30);
    z = THREE.MathUtils.clamp(z, -30, 30);
    const y = sampleTerrainHeightFast(x, z) + 1.0 + Math.sin(t * 1.5 + phase) * 0.35;

    // Face direction of travel.
    const dx = x - prev.x;
    const dz = z - prev.z;
    if (dx * dx + dz * dz > 1e-6) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
    groupRef.current.position.set(x, y, z);
    prev.set(x, y, z);

    // Wing flap — opposing phase, 12Hz.
    const flap = Math.sin(t * 12 + phase) * (Math.PI / 6);
    if (leftWingRef.current) leftWingRef.current.rotation.z = flap;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap;
  });

  return (
    <group ref={groupRef} position={[home.x, 1.4, home.z]}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.05, 0.05, 0.15]} />
        <meshStandardMaterial color="#2A1F18" roughness={0.7} metalness={0} />
      </mesh>
      {/* Left wing — hinged at body's right edge, rotates around its inner edge */}
      <group position={[0.025, 0, 0]}>
        <mesh ref={leftWingRef} position={[0.09, 0, 0]}>
          <planeGeometry args={[0.18, 0.12]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} side={THREE.DoubleSide} transparent opacity={0.92} />
        </mesh>
      </group>
      {/* Right wing */}
      <group position={[-0.025, 0, 0]}>
        <mesh ref={rightWingRef} position={[-0.09, 0, 0]}>
          <planeGeometry args={[0.18, 0.12]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} side={THREE.DoubleSide} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  );
}

function Butterflies({ count = 4 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Butterfly key={i} seed={i + 1} />
      ))}
    </group>
  );
}

// ─── Fireflies (night only, 8-12) ───────────────────────────────
function Firefly({ seed }: { seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const { home, phase, drift } = useMemo(() => {
    const rng = seededRandom(seed * 1013 + 17);
    return {
      home: new THREE.Vector3((rng() - 0.5) * 50, 0, (rng() - 0.5) * 50),
      phase: rng() * Math.PI * 2,
      drift: 1.8 + rng() * 1.6,
    };
  }, [seed]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const x = THREE.MathUtils.clamp(home.x + Math.sin(t * 0.3 + phase) * drift + Math.cos(t * 0.17 + phase * 1.4) * (drift * 0.5), -30, 30);
    const z = THREE.MathUtils.clamp(home.z + Math.cos(t * 0.27 + phase * 0.9) * drift + Math.sin(t * 0.19 + phase * 1.7) * (drift * 0.5), -30, 30);
    const yBase = sampleTerrainHeightFast(x, z);
    const y = yBase + 0.6 + (Math.sin(t * 0.6 + phase) * 0.5 + 0.5) * 1.6;
    ref.current.position.set(x, y, z);
    // Pulse glow.
    if (matRef.current) {
      matRef.current.emissiveIntensity = 1.4 + Math.sin(t * 2.4 + phase) * 0.7;
    }
  });

  return (
    <group ref={ref} position={[home.x, 1.0, home.z]}>
      <mesh>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial ref={matRef} color="#FFEE88" emissive="#FFEE88" emissiveIntensity={2.0} roughness={0.4} metalness={0} />
      </mesh>
    </group>
  );
}

function Fireflies({ count = 10 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Firefly key={i} seed={i + 1} />
      ))}
    </group>
  );
}

// ─── Leaf / pollen drift (always, 30-50) ────────────────────────
function LeafDrift({ count = 40 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-instance mutable state lives in refs so React Compiler's immutability
  // rule doesn't flag the per-frame writes. Initial values are seeded once.
  const posRef = useRef<Float32Array | null>(null);
  const offsetsRef = useRef<Float32Array | null>(null);

  const { colors, initialPos, initialOffsets } = useMemo(() => {
    const rng = seededRandom(7919);
    const cs = new Float32Array(count * 3);
    const pollen = new THREE.Color("#E0D090");
    const leaf = new THREE.Color("#A8D080");
    const px = new Float32Array(count * 3);
    const off = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      px[i * 3] = (rng() - 0.5) * 56;
      px[i * 3 + 1] = rng() * 8;
      px[i * 3 + 2] = (rng() - 0.5) * 56;
      off[i] = rng() * Math.PI * 2;
      const isLeaf = rng() < 0.5;
      const col = isLeaf ? leaf : pollen;
      cs[i * 3] = col.r;
      cs[i * 3 + 1] = col.g;
      cs[i * 3 + 2] = col.b;
    }
    return { colors: cs, initialPos: px, initialOffsets: off };
  }, [count]);

  useEffect(() => {
    posRef.current = initialPos;
    offsetsRef.current = initialOffsets;
  }, [initialPos, initialOffsets]);

  const colorAttr = useMemo(() => new THREE.InstancedBufferAttribute(colors, 3), [colors]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !posRef.current || !offsetsRef.current) return;
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;
    const pos = posRef.current;
    const offs = offsetsRef.current;
    for (let i = 0; i < count; i++) {
      const base = i * 3;
      let x = pos[base];
      let y = pos[base + 1];
      let z = pos[base + 2];

      y -= delta * 0.5;
      x += Math.sin(t * 0.5 + offs[i]) * delta * 0.3;

      if (y < 0.3) {
        x = (Math.sin(t * 13.37 + i * 7.1) * 0.5 + Math.cos(i * 3.7) * 0.5) * 28;
        z = (Math.cos(t * 9.11 + i * 5.3) * 0.5 + Math.sin(i * 2.1) * 0.5) * 28;
        y = 8;
      }

      pos[base] = x;
      pos[base + 1] = y;
      pos[base + 2] = z;

      dummy.position.set(x, y, z);
      dummy.rotation.set(t * 0.4 + offs[i], t * 0.6 + offs[i] * 1.3, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.06, 0.06]}>
        <primitive object={colorAttr} attach="attributes-color" />
      </planeGeometry>
      <meshBasicMaterial vertexColors transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── Background birds (day only, 1-2) ───────────────────────────
function Bird({ seed }: { seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const { phase, speed, radius } = useMemo(() => {
    const rng = seededRandom(seed * 631 + 11);
    return {
      phase: rng() * Math.PI * 2,
      speed: 0.04 + rng() * 0.02,
      radius: 16 + rng() * 4,
    };
  }, [seed]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const a = t * speed + phase;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    ref.current.position.set(x, 12, z);
    // Face heading.
    ref.current.rotation.y = -a + Math.PI / 2;
    // Subtle V-flap.
    ref.current.rotation.z = Math.sin(t * 8 + phase) * 0.3;
  });

  return (
    <group ref={ref} position={[radius, 12, 0]}>
      <mesh rotation={[0, 0, Math.PI / 6]} position={[0.18, 0, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.04]} />
        <meshBasicMaterial color="#2A2A2A" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 6]} position={[-0.18, 0, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.04]} />
        <meshBasicMaterial color="#2A2A2A" />
      </mesh>
    </group>
  );
}

function Birds({ count = 2 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Bird key={i} seed={i + 1} />
      ))}
    </group>
  );
}

// ─── Seagulls (organic-coast loop, iteration 3) ─────────────────
// White gulls circling fixed anchors over the water — one per lobe of
// the new coastline. Lower and quicker than the lazy inland birds, with
// a slow bobbing altitude so they read as riding the sea breeze.
const GULL_ANCHORS: [number, number][] = [
  [68, -9.4],   // east lobe, off the lighthouse (S1 x1.173)
  [23.5, 68],   // over the cove swim border
  [-65.7, 16.4],  // west bay mouth
];

// Sea-catch swoop (loop wake 35): a sea-zone catch calls the nearest gull
// down for a low celebratory pass over the spot before it climbs back to
// its patrol. One shared record set by the Gulls parent; the owning gull
// blends its orbit toward a fast low circle around the catch point.
interface GullSwoop {
  idx: number;
  x: number;
  z: number;
  at: number; // performance.now ms
}
const SWOOP_MS = 4200;

function Gull({ anchor, seed, idx, swoopRef }: { anchor: [number, number]; seed: number; idx: number; swoopRef: React.MutableRefObject<GullSwoop | null> }) {
  const ref = useRef<THREE.Group>(null);
  const { phase, speed, radius, alt } = useMemo(() => {
    const rng = seededRandom(seed * 409 + 7);
    return {
      phase: rng() * Math.PI * 2,
      speed: 0.09 + rng() * 0.05,
      radius: 6.5 + rng() * 3.5,
      alt: 6.5 + rng() * 2,
    };
  }, [seed]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const a = t * speed + phase;
    const ox = anchor[0] + Math.cos(a) * radius;
    const oy = alt + Math.sin(t * 0.35 + phase) * 1.1;
    const oz = anchor[1] + Math.sin(a) * radius;

    const sw = swoopRef.current;
    if (sw && sw.idx === idx) {
      const p = (performance.now() - sw.at) / SWOOP_MS;
      if (p >= 1) {
        swoopRef.current = null;
      } else {
        // fast low circle over the catch point; blend in and out of orbit
        const sa = t * 1.6 + phase;
        const sx = sw.x + Math.cos(sa) * 1.9;
        const sy = 2.4 + Math.sin(t * 2.2) * 0.25;
        const sz = sw.z + Math.sin(sa) * 1.9;
        const w = p < 0.25 ? p / 0.25 : p > 0.72 ? (1 - p) / 0.28 : 1;
        ref.current.position.set(ox + (sx - ox) * w, oy + (sy - oy) * w, oz + (sz - oz) * w);
        ref.current.rotation.y = w > 0.5 ? -sa + Math.PI / 2 : -a + Math.PI / 2;
        ref.current.rotation.z = Math.sin(t * (6.5 + w * 6)) * (0.35 + w * 0.2); // harder flap low
        return;
      }
    }
    ref.current.position.set(ox, oy, oz);
    ref.current.rotation.y = -a + Math.PI / 2;
    ref.current.rotation.z = Math.sin(t * 6.5 + phase) * 0.35;
  });

  return (
    <group ref={ref} position={[anchor[0] + radius, 7, anchor[1]]}>
      <mesh rotation={[0, 0, Math.PI / 7]} position={[0.2, 0, 0]}>
        <boxGeometry args={[0.46, 0.05, 0.06]} />
        <meshBasicMaterial color="#F2F3EF" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 7]} position={[-0.2, 0, 0]}>
        <boxGeometry args={[0.46, 0.05, 0.06]} />
        <meshBasicMaterial color="#F2F3EF" />
      </mesh>
    </group>
  );
}

function Gulls() {
  const swoopRef = useRef<GullSwoop | null>(null);
  useEffect(() => {
    const onCatch = (e: Event) => {
      const d = (e as CustomEvent).detail as { zone?: string; x?: number; z?: number } | undefined;
      if (d?.zone !== "sea" || typeof d.x !== "number" || typeof d.z !== "number") return;
      if (swoopRef.current) return; // one guest of honor at a time
      let best = 0;
      let bestD = Infinity;
      GULL_ANCHORS.forEach(([ax, az], i) => {
        const dist = Math.hypot(ax - d.x!, az - d.z!);
        if (dist < bestD) {
          bestD = dist;
          best = i;
        }
      });
      swoopRef.current = { idx: best, x: d.x, z: d.z, at: performance.now() };
    };
    window.addEventListener("tsi:fish-caught", onCatch);
    return () => window.removeEventListener("tsi:fish-caught", onCatch);
  }, []);
  return (
    <group>
      {GULL_ANCHORS.map((a, i) => (
        <Gull key={i} anchor={a} seed={i + 3} idx={i} swoopRef={swoopRef} />
      ))}
    </group>
  );
}

// ─── Entry point ────────────────────────────────────────────────
// P13: density scales counts. 1 = full (default), 0.5 = half on
// devices where the parent decides we should soften the particle load
// without dropping ambient life entirely (full lite mode unmounts this
// component instead).
export default function AmbientLife({
  phase,
  density = 1,
}: {
  phase: "day" | "night" | "dawn" | "dusk";
  density?: number;
}) {
  const isDay = phase === "day" || phase === "dawn";
  const isNight = phase === "night";
  // W4: fireflies come out at DUSK too (fewer than full night), so golden hour
  // eases into the evening glow instead of popping on at night.
  const isEvening = phase === "night" || phase === "dusk";
  const scale = (n: number) => Math.max(1, Math.round(n * density));
  return (
    <group>
      {/* Particle counts trimmed for 60+ FPS budget on 1440x900 headless. */}
      {isDay && <Butterflies count={scale(3)} />}
      {isEvening && <Fireflies count={scale(isNight ? 13 : 7)} />}
      <LeafDrift count={scale(25)} />
      {isDay && <Birds count={scale(2)} />}
      {isDay && <Gulls />}
    </group>
  );
}
