"use client";

import { Suspense, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Cloud, Clouds } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";
import { getTerrainHeight, valueNoise } from "./terrain";
import { NatureTree, NatureBush, NatureFlowerCluster, NatureFence, NatureMushroom, NatureStump } from "./NatureModels";
import { useUser } from "@/components/portal/UserContext";

/**
 * Game World v2 — Animal Crossing: New Horizons visual style.
 * Implements specs/ux-game-world-v2.md EXACTLY.
 *
 * Palette, camera, lighting, terrain, river, bridge, trees, bushes,
 * flowers, props all sourced from the v2 spec hex values.
 */

// Seeded PRNG — deterministic to satisfy React Compiler purity rules
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Palette from v2 spec Section 3 ────────────────────────────
const P = {
  skyTop: "#87CEEB", skyBottom: "#B8E4F0",
  grassPrimary: "#7EC850", grassSecondary: "#6BB83E", grassHighlight: "#9ADE6B", grassShadow: "#5AA033",
  dirtPath: "#C4A265", dirtPathEdge: "#B39355", stonePath: "#B8B0A0",
  riverSurface: "#5BB8D4", riverDeep: "#3A8FB0", riverEdge: "#7CCCE5", riverbed: "#A08B65",
  pondSurface: "#6DC4D8",
  trunk: "#8B6B4A", barkDetail: "#6B5238",
  foliage: "#4DAF4A", foliageHighlight: "#6BC867", foliageShadow: "#3A8838",
  pine: "#3D7A3D", bush: "#5CB85C", bushFlower: "#FF6B8A",
  flowerRed: "#E85050", flowerPink: "#FF8CB0", flowerYellow: "#FFD166",
  flowerWhite: "#F5F5F5", flowerBlue: "#6BA3D6", flowerPurple: "#9B6BB0", flowerOrange: "#FF9944",
  fence: "#B8935A", stoneFence: "#A8A090", lampPost: "#3D3D3D", lampGlow: "#FFE4B0",
  benchWood: "#B8935A", bridgeWood: "#A07850", bridgeRope: "#C4B090",
  wellStone: "#9B9080", stumpBrown: "#8B6B4A",
  windowGlass: "#B8E4F0", windowFrame: "#FFFFFF", chimney: "#C4A265", doorFrame: "#6B4226",
  fog: "#C8E4D8",
};

// ─── Building config per v2 spec Section 6 ──────────────────────
const BUILDINGS = [
  { id: "hq", name: "HQ", position: [0, 0, -4] as [number, number, number], size: [6, 4, 5] as [number, number, number], color: "#FFF5E1", roofColor: "#E87B5A", href: undefined },
  { id: "shop", name: "Shop", position: [-14, 0, 8] as [number, number, number], size: [4, 3.5, 4] as [number, number, number], color: "#D4EAD4", roofColor: "#5BA086", href: "/student/dashboard/shop" },
  { id: "oracle", name: "Oracle Temple", position: [0, 3, 22] as [number, number, number], size: [5, 5, 5] as [number, number, number], color: "#E8DCF0", roofColor: "#7B5EA7", href: undefined },
  { id: "house", name: "House", position: [14, 0, 10] as [number, number, number], size: [3.5, 2.8, 3.5] as [number, number, number], color: "#C8E6C9", roofColor: "#7EB8C9", href: undefined },
  { id: "bounty", name: "Bounty Board", position: [10, 0, 8] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/bounty" },
  { id: "jobs", name: "Job Board", position: [-10, 0, -10] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/jobs" },
  { id: "leaderboard", name: "Leaderboard", position: [10, 0, -10] as [number, number, number], size: [1.2, 2.5, 1.2] as [number, number, number], color: P.wellStone, href: "/student/dashboard/leaderboard" },
];

const SPAWN_POSITION: [number, number, number] = [0, 0, -15];

// ─── Time-of-Day (v2 spec Section 8.1) ──────────────────────────
// [hour, skyTop, skyBottom, sunColor, sunIntensity, ambientColor, ambientIntensity]
const TOD_KEYS: [number, string, string, string, number, string, number][] = [
  [5,  "#FFB366", "#FFD4A8", "#FFD4A8", 0.6, "#C4B0FF", 0.4],
  [7,  "#87CEEB", "#B8E4F0", "#FFF5E1", 0.9, "#B0D4FF", 0.5],
  [10, "#87CEEB", "#B8E4F0", "#FFFFFF", 1.0, "#C4D8FF", 0.5],
  [15, "#87CEEB", "#FFD4A8", "#FFE4B0", 0.8, "#D4C8B0", 0.5],
  [17, "#FF9966", "#FFD4A8", "#FFB366", 0.7, "#FFD4A8", 0.4],
  [19, "#FF9966", "#2D2D6B", "#FF8844", 0.3, "#6B5A8B", 0.3],
  [21, "#1A1A40", "#2D2D6B", "#334466", 0.0, "#334466", 0.25],
];
const _tc = new THREE.Color();

function TimeOfDayCycle() {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(P.skyTop) }, bottomColor: { value: new THREE.Color(P.skyBottom) } },
    vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor,bottomColor; varying vec3 vWP; void main(){ float t=smoothstep(-0.05,0.5,normalize(vWP).y); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0); }`,
  }), []);

  useFrame(() => {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;

    // Find bounding keyframes
    let ai = TOD_KEYS.length - 1, bi = 0;
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      if (h >= TOD_KEYS[i][0] && h < TOD_KEYS[i + 1][0]) { ai = i; bi = i + 1; break; }
    }
    const a = TOD_KEYS[ai], b = TOD_KEYS[bi];

    let t: number;
    if (ai < bi) {
      t = (h - a[0]) / (b[0] - a[0]);
    } else {
      // Night→Dawn wrap (21→5)
      const span = (24 - a[0]) + b[0];
      t = (h >= a[0] ? h - a[0] : h + 24 - a[0]) / span;
    }
    t = THREE.MathUtils.clamp(t, 0, 1);

    // Sky
    skyMat.uniforms.topColor.value.set(a[1]).lerp(_tc.set(b[1]), t);
    skyMat.uniforms.bottomColor.value.set(a[2]).lerp(_tc.set(b[2]), t);

    // Sun
    if (sunRef.current) {
      sunRef.current.color.set(a[3]).lerp(_tc.set(b[3]), t);
      sunRef.current.intensity = a[4] + (b[4] - a[4]) * t;
    }
    // Ambient
    if (ambRef.current) {
      ambRef.current.color.set(a[5]).lerp(_tc.set(b[5]), t);
      ambRef.current.intensity = a[6] + (b[6] - a[6]) * t;
    }
    // Fog matches sky bottom
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(skyMat.uniforms.bottomColor.value);
  });

  return (
    <>
      <mesh scale={[100, 100, 100]} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={skyMat} attach="material" />
      </mesh>
      <hemisphereLight args={["#FFF5E1", P.grassPrimary, 0.55]} />
      <ambientLight ref={ambRef} intensity={0.5} color="#C4D8FF" />
      <directionalLight
        ref={sunRef}
        color="#FFFFFF" intensity={1.0} position={[15, 30, 15]}
        castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={60} shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
        shadow-bias={-0.001}
      />
      <directionalLight color="#C0D0FF" intensity={0.15} position={[-12, 18, -8]} />
    </>
  );
}

// ─── Terrain (v2 spec Section 4 — vertex-displaced rolling hills) ─
function Terrain() {
  const geometry = useMemo(() => {
    const size = 82;
    const segments = 128;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(P.grassPrimary);
    const c2 = new THREE.Color(P.grassSecondary);
    const cH = new THREE.Color(P.grassHighlight);
    const cS = new THREE.Color(P.grassShadow);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const h = getTerrainHeight(x, z);
      pos.setY(i, h);

      // Vertex color: blend greens by height + noise variation
      const cn = valueNoise(x * 0.15, z * 0.15);
      const hf = THREE.MathUtils.clamp(h / 3, 0, 1);

      if (dist > 38) {
        tmp.copy(cS);
      } else if (hf > 0.5) {
        tmp.lerpColors(c1, cH, (hf - 0.5) * 2);
      } else if (cn > 0.6) {
        tmp.copy(cH);
      } else if (cn < 0.3) {
        tmp.copy(c2);
      } else {
        tmp.copy(c1);
      }

      if (dist > 34) {
        tmp.lerp(cS, (dist - 34) / 6);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Path borders */}
      {[
        [0, -6, 4.5, 34], // N-S path (spawn to before Oracle)
        [0, 8, 32, 4.5],  // E-W at z=8
        [0, -10, 24, 4.5], // E-W at z=-10
      ].map(([x, z, w, h], i) => (
        <mesh key={`pb-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.06, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={P.dirtPathEdge} roughness={0.88} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
      {/* Dirt paths */}
      {[
        [0, -6, 3.5, 34],
        [0, 8, 32, 3.5],
        [0, -10, 24, 3.5],
      ].map(([x, z, w, h], i) => (
        <mesh key={`p-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.08, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={P.dirtPath} roughness={0.85} metalness={0} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
    </group>
  );
}

// ─── River + Bridge (v2 spec Section 5 — animated ripples + sparkles) ─
function River() {
  const waterRef = useRef<THREE.Mesh>(null);
  const sparkleRef = useRef<THREE.Points>(null);

  const waterGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 3, 160, 6);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const { sparkleGeo, sparklePhases } = useMemo(() => {
    const count = 50;
    const rng = seededRandom(42);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * 70;
      positions[i * 3 + 1] = 0.08;
      positions[i * 3 + 2] = 3 + (rng() - 0.5) * 2.5;
      phases[i] = rng() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { sparkleGeo: geo, sparklePhases: phases };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Sine vertex displacement for water ripples
    if (waterRef.current) {
      const pos = waterRef.current.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = Math.sin(x * 0.3 + t * 0.5) * 0.06
                + Math.sin(z * 0.8 + t * 0.7) * 0.04
                + Math.sin(x * 0.5 - t * 0.3) * 0.03;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Sparkle twinkle — hide/show by moving below water
    if (sparkleRef.current) {
      const sp = sparkleRef.current.geometry.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const visible = Math.sin(t * 1.5 + sparklePhases[i]) > 0.5;
        sp.setY(i, visible ? 0.08 : -1);
      }
      sp.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Riverbed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 3]}>
        <planeGeometry args={[80, 4]} />
        <meshStandardMaterial color={P.riverbed} roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* River banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 3]}>
        <planeGeometry args={[80, 5]} />
        <meshStandardMaterial color={P.riverEdge} roughness={0.7} metalness={0} transparent opacity={0.6} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      {/* Animated water surface */}
      <mesh ref={waterRef} geometry={waterGeo} position={[0, -0.02, 3]}>
        <meshStandardMaterial color={P.riverSurface} roughness={0.15} metalness={0.15} transparent opacity={0.72} />
      </mesh>
      {/* Water sparkles */}
      <points ref={sparkleRef} geometry={sparkleGeo}>
        <pointsMaterial color="#FFFFFF" size={0.12} transparent opacity={0.85} sizeAttenuation depthWrite={false} />
      </points>
      {/* Bridge (v2 spec Section 5.2) */}
      <group position={[0, 0.05, 3]}>
        {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((x, i) => (
          <mesh key={`plank-${i}`} position={[x, 0.02, 0]} castShadow>
            <boxGeometry args={[0.35, 0.06, 3.2]} />
            <meshStandardMaterial color={P.bridgeWood} roughness={0.85} metalness={0} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={`rail-${side}`}>
            {[-1.3, 0, 1.3].map((x, i) => (
              <mesh key={i} position={[x, 0.5, side * 1.5]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
                <meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} />
              </mesh>
            ))}
            <mesh position={[0, 0.8, side * 1.5]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 3, 8]} />
              <meshStandardMaterial color={P.bridgeRope} roughness={0.95} metalness={0} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// (Lighting merged into TimeOfDayCycle above)

// (Tree component replaced by NatureTree from NatureModels.tsx)
const TREE_XZ: [number, number][] = [
  [-7, 16], [7, 16], [-20, 5], [20, 5],
  [-18, -5], [18, -5], [-5, -20], [5, -20],
  [-24, 12], [24, 12], [-10, 24], [12, 24],
  [-22, -14], [22, -14], [-14, -16], [14, 16],
  [-28, 0], [28, 6], [-8, 26], [8, 26],
];

// ─── Bushes (v2 spec Section 7.2) ───────────────────────────────
const BUSH_XZ: [number, number][] = [
  [-5, -2], [5, -2], [-13, 6], [13, 6],
  [-3, -7], [3, -7], [-15, -3], [15, -3],
  [-7, 12], [7, 12], [0, -17], [-18, 10],
  [18, 10], [-6, -14], [6, -14], [-10, 14],
  [10, 14], [-22, 3], [22, 3], [0, 9],
];
function Bushes() {
  return (
    <group>
      {BUSH_XZ.map(([x, z], i) => (
        <NatureBush key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />
      ))}
    </group>
  );
}

// ─── Flowers (v2 spec Section 7.3) ──────────────────────────────
const FLOWER_XZ: [number, number][] = [
  [-4, -3], [4, 6], [-7, 11], [11, -4],
  [-2, 14], [6, -13], [-11, 5], [13, 4],
  [2, 17], [-6, -11], [8, 15], [-14, -6],
];
function Flowers() {
  return (
    <group>
      {FLOWER_XZ.map(([x, z], i) => (
        <NatureFlowerCluster key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />
      ))}
    </group>
  );
}

// ─── Butterflies (v2 spec Section 10 — gentle looping paths) ────
const BUTTERFLY_COUNT = 5;
function Butterflies() {
  const ref = useRef<THREE.Points>(null);
  const { geo, seeds } = useMemo(() => {
    const rng = seededRandom(99);
    const positions = new Float32Array(BUTTERFLY_COUNT * 3);
    const s = new Float32Array(BUTTERFLY_COUNT);
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      positions[i * 3] = (rng() - 0.5) * 30;
      positions[i * 3 + 1] = 2;
      positions[i * 3 + 2] = (rng() - 0.5) * 30;
      s[i] = rng() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geo: g, seeds: s };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      const sd = seeds[i];
      const x = Math.sin(t * 0.1 + sd) * 12 + Math.cos(t * 0.07 + sd * 2) * 5;
      const z = Math.cos(t * 0.08 + sd * 1.5) * 12 + Math.sin(t * 0.12 + sd * 3) * 5;
      const y = getTerrainHeight(x, z) + 1.5 + Math.sin(t * 0.4 + sd) * 0.5;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#FFD166" size={0.25} transparent opacity={0.9} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Chimney Smoke (v2 spec Section 10 — slow upward drift) ─────
const SMOKE_COUNT = 20;
function ChimneySmoke() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
    return g;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position;
    const baseY = getTerrainHeight(0, -4) + 5.2;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const age = (t * 0.3 + i / SMOKE_COUNT) % 1;
      pos.setXYZ(
        i,
        1.5 + Math.sin(t * 0.2 + i) * age * 0.5,
        baseY + age * 3,
        -5 + Math.cos(t * 0.15 + i * 0.7) * age * 0.3,
      );
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#D0C8C0" size={0.2} transparent opacity={0.3} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Props (v2 spec Section 9) — all placed at terrain height ───
function yAt(x: number, z: number): [number, number, number] {
  return [x, getTerrainHeight(x, z), z];
}
function Props() {
  return (
    <group>
      {/* Benches */}
      {[[-3, -5], [3, -5], [-3, 6], [3, 6]].map(([x, z], i) => (
        <group key={`bench-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          <mesh position={[0, 0.7, -0.2]} castShadow><boxGeometry args={[1.4, 0.5, 0.08]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          {[-0.55, 0.55].map((bx, j) => (
            <mesh key={j} position={[bx, 0.2, 0]} castShadow><boxGeometry args={[0.08, 0.4, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          ))}
        </group>
      ))}
      {/* Lampposts */}
      {[[1.8, -7], [-1.8, 6], [1.8, 13], [-1.8, -12], [1.8, -18]].map(([x, z], i) => (
        <group key={`lamp-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 3.2, 8]} /><meshStandardMaterial color={P.lampPost} roughness={0.7} metalness={0.15} /></mesh>
          <mesh position={[0, 3.4, 0]}><boxGeometry args={[0.4, 0.3, 0.4]} /><meshStandardMaterial color="#F5E6C8" roughness={0.6} metalness={0} emissive={P.lampGlow} emissiveIntensity={0.2} /></mesh>
          <pointLight color={P.lampGlow} intensity={0.35} distance={6} position={[0, 3.2, 0]} />
        </group>
      ))}
      {/* Wooden fences near HQ (Kenney Nature Kit) */}
      {[[-5, -2], [-5, 0], [-5, -4], [5, -2], [5, 0], [5, -4]].map(([x, z], i) => (
        <NatureFence key={`fence-${i}`} position={yAt(x, z)} variant={i} />
      ))}
      {/* Well near HQ */}
      <group position={yAt(4, -6)}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.7, 0.8, 12]} /><meshStandardMaterial color={P.wellStone} roughness={0.92} metalness={0} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 1.2, 6]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[1.4, 0.08, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
      </group>
      {/* Log stumps (Kenney Nature Kit) */}
      {[[-16, -10], [18, -16], [-20, 14]].map(([x, z], i) => (
        <NatureStump key={`stump-${i}`} position={yAt(x, z)} />
      ))}
      {/* Mushrooms under trees (Kenney Nature Kit) */}
      {[[-7.5, 15.5], [7.5, 15.5], [-20.5, 4.5], [20.5, 4.5], [-5.5, -19.5]].map(([x, z], i) => (
        <NatureMushroom key={`mush-${i}`} position={yAt(x, z)} seed={i} />
      ))}
      {/* Banners near HQ */}
      {[[3.5, -7], [-3.5, -7]].map(([x, z], i) => (
        <group key={`banner-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.04, 3.2, 8]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 2.8, 0]}><planeGeometry args={[0.7, 1]} /><meshStandardMaterial color="#4A6FA5" roughness={0.8} metalness={0} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Scene ──────────────────────────────────────────────────────
function Scene({ playerName, playerLevel }: { playerName: string; playerLevel: number }) {
  const cameraRef = useRef<CameraControls>(null);
  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));

  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    setPlayerPos(position);
    cameraRef.current?.moveTo(position.x, position.y + 1.5, position.z, true);
  }, []);

  return (
    <>
      {/* Camera: FOV 50°, polar 55-60° (~1.0 rad), distance 15, locked azimuth */}
      <CameraControls
        ref={cameraRef}
        minPolarAngle={Math.PI / 3.3}
        maxPolarAngle={Math.PI / 3}
        minDistance={15}
        maxDistance={15}
        dollySpeed={0}
        truckSpeed={0}
        makeDefault
      />

      <TimeOfDayCycle />
      <fog attach="fog" args={[P.fog, 50, 100]} />

      <Terrain />
      <River />

      {TREE_XZ.map(([x, z], i) => <NatureTree key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />)}
      <Bushes />
      <Flowers />
      <Butterflies />
      <ChimneySmoke />

      <Suspense fallback={null}>
        <Clouds material={THREE.MeshBasicMaterial}>
          <Cloud segments={40} bounds={[12, 2, 12]} volume={6} color="#FFFFFF" position={[-12, 25, -10]} opacity={0.6} speed={0.1} />
          <Cloud segments={30} bounds={[8, 2, 8]} volume={4} color="#FFF8F0" position={[14, 28, 12]} opacity={0.45} speed={0.15} />
          <Cloud segments={25} bounds={[6, 2, 6]} volume={3} color="#FFFFFF" position={[0, 30, 25]} opacity={0.5} speed={0.08} />
        </Clouds>
        <Props />
      </Suspense>

      {BUILDINGS.map((b) => {
        const y = getTerrainHeight(b.position[0], b.position[2]);
        return <Building key={b.id} id={b.id} name={b.name} position={[b.position[0], y, b.position[2]]} size={b.size} color={b.color} roofColor={b.roofColor} href={b.href} playerPosition={playerPos} />;
      })}

      <PlayerAvatar spawnPosition={SPAWN_POSITION} onMove={handlePlayerMove} playerName={playerName} playerLevel={playerLevel} />
    </>
  );
}

// ─── Canvas (v2 spec Section 2) ─────────────────────────────────
export default function GameWorld() {
  const { profile } = useUser();
  const playerName = profile?.display_name || "Player";
  const playerLevel = profile?.level ?? 1;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: P.skyBottom }}>
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 50, near: 0.1, far: 300, position: [0, 12, -20] }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Scene playerName={playerName} playerLevel={playerLevel} />
        </Suspense>
      </Canvas>
    </div>
  );
}
