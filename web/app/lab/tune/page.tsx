"use client";

/**
 * /lab/tune — the tuning bench (David, 2026-07-28).
 *
 * "Take out individual assets and animations, put it on the bench for me to
 * tweak manually with a slider and i will give you screenshots of the correct
 * values."
 *
 * So the two rules this page follows:
 *
 *  1. EVERY VALUE IS ON SCREEN, next to its slider, at the precision it is
 *     stored. A screenshot of this page is a complete record of the settings —
 *     which is the whole point, because a screenshot is what comes back.
 *  2. One specimen at a time, isolated on a plain stage. The world is a bad
 *     place to judge a wing-flap rate.
 *
 * "Copy source" puts the current numbers on the clipboard already shaped as the
 * `TUNING_DEFAULTS` literal in `lib/game/tuning.ts`, so a session ends in a
 * paste rather than in retyping numbers off a picture.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  TUNING_DEFAULTS,
  setTuning,
  resetTuning,
  tune,
  tuningSource,
  useTuning,
  type Tuning,
} from "@/lib/game/tuning";
import { patchWind, tuftGeometry } from "@/components/game/grid/GrassTufts";
import { gullPose, type GullParams } from "@/lib/game/gullPath";
import {
  easedCellOutline,
  sdfFromMask,
  sampleShore,
  SHORE_SDF_SCALE,
  type LayerTest,
} from "@/lib/game/grid";
import { bedDepth } from "@/lib/game/waterShader";
import {
  terrainMaterial,
  applyGrassNormalStrength,
  advanceWater,
  setShoreField,
} from "@/components/game/grid/terrainMaterials";

type Specimen = "gull" | "water" | "grass";

// ── Specimens ────────────────────────────────────────────────────

const SEAGULL_URL = "/assets/fauna/seagull.glb";

/** One gull, flying the REAL path function, alone. */
function GullSpecimen() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(SEAGULL_URL);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const params = useRef<GullParams>({
    anchorX: 0,
    anchorZ: 0,
    speed: 0.09,
    radius: 6.5,
    altitude: 2,
    bob: 1.1,
    wobble: 0.26,
    drift: 3.5,
    phase: 0,
  });

  // No yaw correction — the model's forward is +Z, which is what gullPose
  // assumes. See the note in AmbientLife.
  const body = useMemo(() => cloneSkeleton(scene) as THREE.Group, [scene]);

  useEffect(() => {
    if (!animations.length) return;
    const mixer = new THREE.AnimationMixer(body);
    mixer.clipAction(animations[0]).play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(body);
      mixerRef.current = null;
    };
  }, [body, animations]);

  useFrame((state, delta) => {
    const g = tune().gull;
    body.scale.setScalar(g.scale);
    if (mixerRef.current) {
      mixerRef.current.timeScale = g.flap;
      mixerRef.current.update(delta);
    }
    if (!group.current) return;

    const p = params.current;
    p.speed = g.orbitSpeed;
    p.radius = g.orbitRadius;
    p.altitude = 2;
    p.bob = g.bob;
    p.wobble = g.wobble;
    p.drift = g.drift;

    const pose = gullPose(state.clock.elapsedTime, p, g.bankGain, g.bank);
    group.current.position.set(pose.x, pose.y, pose.z);
    group.current.rotation.y = pose.yaw;
    group.current.rotation.z = pose.roll;
  });

  return (
    <group ref={group} rotation={[0, 0, 0, "YXZ"]}>
      <primitive object={body} />
    </group>
  );
}

/**
 * A patch of ground with the real grass material and the real tuft shader, so
 * sway and normal strength are judged against each other rather than in
 * isolation. Deliberately NOT the island: a 12x12 patch fills the frame.
 */
function GrassSpecimen() {
  const t = useTuning();
  // Refs, matching the pattern Ocean.tsx already uses for its animated
  // uniforms: the react-compiler lint forbids mutating a useMemo result, and a
  // uniform object exists precisely to be mutated every frame.
  const uTime = useRef({ value: 0 });
  const uWind = useRef({ value: new THREE.Vector4(0.09, 1.1, 9, 0.34) });

  const useModel = t.grass.model >= 0.5;
  const { scene: packScene } = useGLTF("/assets/nature/grass-tufts.glb");
  const packGeo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    packScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!g && m.isMesh && m.geometry) g = m.geometry;
    });
    return g;
  }, [packScene]);
  // Same geometry the world uses on whichever path is selected.
  const cardGeo = useMemo(() => tuftGeometry(t.grass.tuftHeight), [t.grass.tuftHeight]);
  const geometry = useModel && packGeo ? packGeo : cardGeo;
  const bladeScale = useModel ? t.grass.tuftHeight : 1;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: useModel ? 0xffffff : 0x86b862,
        vertexColors: useModel,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [useModel]
  );

  // The SAME patch the world uses, not a copy of it — see GrassTufts.
  useEffect(() => {
    patchWind(material, uTime.current, uWind.current);
  }, [material]);

  const count = Math.max(1, Math.round(t.grass.tuftDensity * 24));

  /**
   * The bench floor uses the WORLD's shared grass material, with world-scale
   * UVs rewritten onto the plane the same way GridTerrain does. Without this the
   * "ground detail" slider moved a normal map that was not on screen, and the
   * whole point of the bench is that what you see is what ships.
   */
  const floor = useMemo(() => {
    const g = new THREE.PlaneGeometry(12, 12);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
    uv.needsUpdate = true;
    return g;
  }, []);
  const floorMat = useMemo(() => terrainMaterial("mGrass"), []);

  useEffect(() => {
    applyGrassNormalStrength(t.grass.normalStrength, t.grass.normalScale);
  }, [t.grass.normalStrength, t.grass.normalScale]);

  useFrame((state) => {
    uTime.current.value = state.clock.elapsedTime;
    uWind.current.value.set(t.grass.swayAmount, t.grass.swaySpeed, t.grass.gustLength, t.grass.tuftHeight);
  });

  return (
    <group>
      <mesh geometry={floor} material={floorMat ?? undefined} receiveShadow />
      <instancedMesh
        key={`${count}-${t.grass.tuftHeight}-${useModel}`}
        args={[geometry, material, count]}
        frustumCulled={false}
        ref={(inst) => {
          if (!inst) return;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion();
          const e = new THREE.Euler();
          const p = new THREE.Vector3();
          const s = new THREE.Vector3();
          for (let i = 0; i < count; i++) {
            // Deterministic scatter, so a density change does not reshuffle
            // the whole patch under the reviewer.
            const a = (i * 2.399963) % (Math.PI * 2);
            const r = Math.sqrt((i + 0.5) / count) * 5.6;
            e.set(0, a * 3, 0);
            q.setFromEuler(e);
            p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
            s.setScalar((0.75 + ((i * 37) % 10) / 20) * bladeScale);
            m.compose(p, q, s);
            inst.setMatrixAt(i, m);
          }
          inst.instanceMatrix.needsUpdate = true;
        }}
      />
    </group>
  );
}

/**
 * A pane of water with a real SHORE and real ROCKS in it.
 *
 * David asked to see the interaction, and the whole point of the foam is that
 * it is a distance field — so a bench with nothing to be near cannot show it.
 *
 * This is built the same way the world is, not mocked up to look similar:
 *   · the shoreline runs through `easedCellOutline`, the identical helper that
 *     rounds the island's coast, so the corner treatment here IS the shipped one
 *   · the distance field goes through `sdfFromMask`, the identical transform
 *     that bakes it over the real map
 *   · the rocks are the shipped ACNH assets, measured at 1.0 x 0.5 x 1.0 — one
 *     cell, which is why a rock gets a one-cell collar here and would in the
 *     world too
 *
 * ONE HONEST GAP. In the world today, props do NOT get a collar. The field is
 * rasterised from the MAP, and props still live in hardcoded arrays rather than
 * on it. So the rock collar below is what the world will do once props move onto
 * the map, not what it does right now.
 */
const BENCH_CELLS = 16;
const LAND_Y = 0.34;
const ROCKS: { url: string; x: number; z: number; r: number; rot: number }[] = [
  { url: "/assets/acnh/props/rock-a.glb", x: -2.6, z: 1.4, r: 0.52, rot: 0.7 },
  { url: "/assets/acnh/props/rock-c.glb", x: 1.4, z: -3.4, r: 0.55, rot: 2.1 },
  { url: "/assets/acnh/props/rock-e.glb", x: -4.2, z: -2.2, r: 0.55, rot: 4.0 },
];

/** Bench-local cell index -> world coordinate. 1 cell = 1 world unit. */
const bx = (i: number) => i - BENCH_CELLS / 2 + 0.5;

/** The shoreline: a wandering curve so the eased corners have something to do. */
const shoreAt = (z: number) => 3.1 + 1.35 * Math.sin(z * 0.52) + 0.5 * Math.sin(z * 1.31);
const isLandAt = (x: number, z: number) => x > shoreAt(z);
const benchLand: LayerTest = (cx, cz) => isLandAt(bx(cx), bx(cz));

function WaterSpecimen() {
  const t = useTuning();
  // The stage's key light, so the glare lands where the shading says it should.
  // The water is unlit now, so it does NOT pick this up on its own — the sun has
  // to be handed to it the same way GridWorld hands it the scene's key.
  const sun = useMemo(() => new THREE.Vector3(6, 10, 4).normalize(), []);
  useFrame((state) => advanceWater(state.clock.elapsedTime, t.water, sun));

  const waterMat = useMemo(() => terrainMaterial("mRiver"), []);
  const landMat = useMemo(() => terrainMaterial("mGrass"), []);
  useEffect(() => {
    applyGrassNormalStrength(t.grass.normalStrength, t.grass.normalScale);
  }, [t.grass.normalStrength, t.grass.normalScale]);

  /**
   * The bench's own distance field, baked exactly the way the world's is:
   * rasterise what the water touches, then run the SAME transform. Sampling an
   * analytic distance function instead — which is what this did before — makes
   * the bench smooth by construction, so it could not reproduce the stepping
   * the real field had.
   *
   * The rocks are in the mask, which is the whole point of the specimen: in the
   * world they will earn their collar the same way, by being stamped in before
   * the transform rather than special-cased in the shader.
   */
  const field = useMemo(() => {
    const scale = SHORE_SDF_SCALE;
    const n = BENCH_CELLS * scale;
    const mask = new Uint8Array(n * n);
    const at = (i: number) => -BENCH_CELLS / 2 + (i + 0.5) / scale;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = at(i);
        const z = at(j);
        const solid = isLandAt(x, z) || ROCKS.some((r) => Math.hypot(x - r.x, z - r.z) < r.r);
        if (solid) mask[j * n + i] = 1;
      }
    }
    return sdfFromMask(mask, n, n, scale, {
      minX: -BENCH_CELLS / 2,
      minZ: -BENCH_CELLS / 2,
      sizeX: BENCH_CELLS,
      sizeZ: BENCH_CELLS,
    });
  }, []);

  useEffect(() => {
    setShoreField(field);
  }, [field]);

  // Still finely tessellated, but only for the SWELL now — the foam and the
  // colour ramp read the field per fragment and no longer care.
  const water = useMemo(() => {
    const N = 120;
    const S = BENCH_CELLS;
    const g = new THREE.PlaneGeometry(S, S, N, N);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
    uv.needsUpdate = true;
    return g;
  }, []);

  // The shore itself, through the world's own corner easing.
  const land = useMemo(() => {
    const pos: number[] = [];
    const nrm: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const push = (x: number, y: number, z: number, n: [number, number, number]) => {
      pos.push(x, y, z);
      nrm.push(...n);
      uvs.push(x / 2, z / 2);
    };
    for (let cz = 0; cz < BENCH_CELLS; cz++) {
      for (let cx = 0; cx < BENCH_CELLS; cx++) {
        if (!benchLand(cx, cz)) continue;
        const x = bx(cx);
        const z = bx(cz);
        const outline = easedCellOutline(benchLand, cx, cz) ?? [
          [-0.5, -0.5],
          [-0.5, 0.5],
          [0.5, 0.5],
          [0.5, -0.5],
        ];
        const base = pos.length / 3;
        push(x, LAND_Y, z, [0, 1, 0]);
        for (const [ox, oz] of outline) push(x + ox, LAND_Y, z + oz, [0, 1, 0]);
        for (let i = 0; i < outline.length; i++) {
          idx.push(base, base + 1 + i, base + 1 + ((i + 1) % outline.length));
        }
        // Bank face down into the water wherever this cell meets it.
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (benchLand(cx + dx, cz + dz)) continue;
          const ax = dz;
          const az = dx;
          const ex = x + dx * 0.5;
          const ez = z + dz * 0.5;
          const b = pos.length / 3;
          const n: [number, number, number] = [dx, 0.35, dz];
          push(ex - ax * 0.5, LAND_Y, ez - az * 0.5, n);
          push(ex + ax * 0.5, LAND_Y, ez + az * 0.5, n);
          push(ex + ax * 0.5, -0.5, ez + az * 0.5, n);
          push(ex - ax * 0.5, -0.5, ez - az * 0.5, n);
          if (dx !== 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
          else idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }, []);

  /**
   * The bed, SLOPING, through the same `bedDepth` the world's seabed uses.
   *
   * A flat bed would make the depth ramp a lie on the bench: the colour would
   * imply water getting deeper over ground that never drops. Since the ramp is
   * the thing being judged here, the bed has to be honest about it.
   *
   * Rebuilt when the two bathymetry sliders move, which the world does NOT do
   * (128x128 cells of geometry per frame would stall the tab). On the bench it
   * is one 64x64 plane, so it can afford to.
   */
  const bedGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(BENCH_CELLS, BENCH_CELLS, 64, 64);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const d = sampleShore(field, pos.getX(i), pos.getZ(i));
      pos.setY(i, -bedDepth(d, t.water));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [field, t.water]);

  return (
    <group>
      {/* Bed, so the alpha and the depth ramp have something to reveal. */}
      <mesh geometry={bedGeo} receiveShadow>
        <meshStandardMaterial color="#B79463" roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={land} material={landMat ?? undefined} receiveShadow castShadow />
      {ROCKS.map((r) => (
        <Suspense key={r.url} fallback={null}>
          <BenchRock url={r.url} x={r.x} z={r.z} rot={r.rot} />
        </Suspense>
      ))}
      <mesh geometry={water} material={waterMat ?? undefined} />
    </group>
  );
}

/** A shipped ACNH rock, sat on the bed so the water cuts across it. */
function BenchRock({ url, x, z, rot }: { url: string; x: number; z: number; rot: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} position={[x, -0.22, z]} rotation={[0, rot, 0]} />;
}

// ── Controls ─────────────────────────────────────────────────────

interface Row {
  group: keyof Tuning;
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** What the number means, shown under the label. */
  note: string;
  /** Colour rows render a swatch picker and store the value as a hex number. */
  kind?: "color";
}

const ROWS: Record<Specimen, Row[]> = {
  water: [
    { group: "water", key: "deepColor", label: "open water", min: 0, max: 0, step: 0, kind: "color", note: "sampled #3098B3 off reference 13" },
    { group: "water", key: "midColor", label: "mid water", min: 0, max: 0, step: 0, kind: "color", note: "sampled #5BC5CB — the turquoise band" },
    { group: "water", key: "shallowColor", label: "shallows", min: 0, max: 0, step: 0, kind: "color", note: "sampled #CADCBC — sand starting to read through" },
    { group: "water", key: "bedColor", label: "seabed", min: 0, max: 0, step: 0, kind: "color", note: "sampled #EAE1C3 — the ramp ENDS here, it is sand under a film" },
    { group: "water", key: "foamColor", label: "foam", min: 0, max: 0, step: 0, kind: "color", note: "sampled #FAFCEB — cream, not white" },
    { group: "water", key: "ringColor", label: "light ring", min: 0, max: 0, step: 0, kind: "color", note: "the two ADD layers from your tutorial image" },
    { group: "water", key: "bedDepth", label: "max depth", min: 0.2, max: 6, step: 0.1, note: "how deep the bed ever gets, world units" },
    { group: "water", key: "bedSlope", label: "bed slope", min: 0.5, max: 20, step: 0.5, note: "cells from shore to reach ~63% of max depth" },
    { group: "water", key: "depthFalloff", label: "depth falloff", min: 0.1, max: 6, step: 0.05, note: "world units of DEPTH the colour ramp spans" },
    { group: "water", key: "foamWidth", label: "foam radius", min: 0, max: 3, step: 0.05, note: "solid white out to this radius, in cells" },
    { group: "water", key: "foamStrength", label: "foam opacity", min: 0, max: 1, step: 0.02, note: "1 is flat white; lower lets the water through" },
    { group: "water", key: "foamSoft", label: "foam softness", min: 0, max: 0.6, step: 0.01, note: "0 is a hard edge with one pixel of AA" },
    { group: "water", key: "foamWave", label: "swash", min: 0, max: 2, step: 0.02, note: "how far the waterline runs up and back, in cells — 0 is a static edge" },
    { group: "water", key: "foamWaveSpeed", label: "swash speed", min: 0, max: 5, step: 0.05, note: "how fast the swash travels ALONG the shore" },
    { group: "water", key: "blobScale", label: "blob size", min: 0.5, max: 12, step: 0.1, note: "world units per patch in the MULTIPLY layer" },
    { group: "water", key: "blobDarken", label: "blob depth", min: 0.5, max: 1, step: 0.01, note: "1 is off; lower darkens the patches" },
    { group: "water", key: "blobSpeed", label: "blob drift", min: 0, max: 2, step: 0.02, note: "how fast the patches churn" },
    { group: "water", key: "ringWidth", label: "ring width", min: 0.01, max: 0.4, step: 0.005, note: "thickness of the light outline around each patch" },
    { group: "water", key: "ringStrength", label: "ring brightness", min: 0, max: 1.5, step: 0.02, note: "the two ADD layers" },
    { group: "water", key: "glare", label: "glare sheet", min: 0, max: 8, step: 0.1, note: "broad blown-out sheen — over 1 clips to white on purpose" },
    { group: "water", key: "glareWidth", label: "glare spread", min: 1, max: 60, step: 0.5, note: "LOWER is wider; it is a specular power" },
    { group: "water", key: "sunGlint", label: "flare brightness", min: 0, max: 20, step: 0.1, note: "the sharp points riding on the sheet" },
    { group: "water", key: "sunSharp", label: "flare tightness", min: 20, max: 600, step: 5, note: "higher is smaller and harder" },
    { group: "water", key: "sparkle", label: "flare intermittency", min: 0, max: 1, step: 0.02, note: "0 = steady sheen, 1 = flares come and go" },
    { group: "water", key: "sparkleSpeed", label: "flare churn", min: 0, max: 5, step: 0.05, note: "how fast the sparkle field moves" },
    { group: "water", key: "fresnel", label: "sky sheen", min: 0, max: 1.5, step: 0.02, note: "grazing-angle brightening" },
    { group: "water", key: "waveHeight", label: "wave height", min: 0, max: 0.3, step: 0.005, note: "vertical swell, world units — keep it small" },
    { group: "water", key: "waveScale", label: "wave length", min: 1, max: 30, step: 0.5, note: "world units per swell" },
    { group: "water", key: "waveSpeed", label: "wave speed", min: 0, max: 3, step: 0.05, note: "how fast the swell travels" },
    { group: "water", key: "shoreAlpha", label: "alpha at shore", min: 0, max: 1, step: 0.02, note: "how much bed shows through in the shallows" },
    { group: "water", key: "opacity", label: "alpha in deep", min: 0.3, max: 1, step: 0.02, note: "how much bed shows through out in open water" },
  ],
  gull: [
    { group: "gull", key: "flap", label: "wing flap", min: 0.2, max: 8, step: 0.05, note: "animation speed multiplier" },
    { group: "gull", key: "flapSpread", label: "flap spread", min: 0, max: 2, step: 0.05, note: "per-bird variation, keeps the flock out of lockstep" },
    { group: "gull", key: "orbitSpeed", label: "fly speed", min: 0.02, max: 1.5, step: 0.01, note: "radians/sec around its anchor" },
    { group: "gull", key: "orbitRadius", label: "orbit radius", min: 2, max: 20, step: 0.5, note: "world units" },
    { group: "gull", key: "altitude", label: "altitude", min: 1, max: 20, step: 0.5, note: "world units above the water" },
    { group: "gull", key: "bob", label: "altitude bob", min: 0, max: 4, step: 0.1, note: "slow rise and fall on the breeze" },
    { group: "gull", key: "scale", label: "scale", min: 0.02, max: 0.25, step: 0.005, note: "model is ~9.3u wingspan raw" },
    { group: "gull", key: "bank", label: "max bank", min: 0, max: 1.4, step: 0.02, note: "ceiling on the roll, radians — roll is about the FORWARD axis" },
    { group: "gull", key: "bankGain", label: "bank gain", min: 0, max: 4, step: 0.05, note: "turn rate to roll — how hard it leans into the same turn" },
    { group: "gull", key: "wobble", label: "path wobble", min: 0, max: 0.8, step: 0.02, note: "radius variation — 0 is a dead circle" },
    { group: "gull", key: "drift", label: "path drift", min: 0, max: 15, step: 0.5, note: "how far the loop centre wanders, world units" },
  ],
  grass: [
    { group: "grass", key: "model", label: "blade model", min: 0, max: 1, step: 1, note: "0 = procedural cards (4 tri), 1 = imported pack (42 tri)" },
    { group: "grass", key: "normalStrength", label: "ground detail", min: 0, max: 3, step: 0.05, note: "ACNH mGrass_Nrm strength — 0 is the flat green" },
    { group: "grass", key: "normalScale", label: "detail scale", min: 0.5, max: 12, step: 0.25, note: "world units per repeat" },
    { group: "grass", key: "tuftDensity", label: "tuft density", min: 0, max: 40, step: 1, note: "tufts per 100 grass cells — this is the perf knob" },
    { group: "grass", key: "tuftHeight", label: "tuft height", min: 0.08, max: 1.2, step: 0.02, note: "world units" },
    { group: "grass", key: "swayAmount", label: "sway amount", min: 0, max: 0.5, step: 0.01, note: "how far the tip leans" },
    { group: "grass", key: "swaySpeed", label: "sway speed", min: 0, max: 6, step: 0.05, note: "oscillations/sec" },
    { group: "grass", key: "gustLength", label: "gust length", min: 1, max: 40, step: 0.5, note: "wavelength of the wave crossing the field" },
  ],
};

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

function Slider({ row }: { row: Row }) {
  const t = useTuning();
  const value = (t[row.group] as unknown as Record<string, number>)[row.key];
  const shipped = (TUNING_DEFAULTS[row.group] as unknown as Record<string, number>)[row.key];
  const changed = Math.abs(value - shipped) > 1e-9;

  const asHex = (v: number) => "#" + Math.round(v).toString(16).padStart(6, "0");

  if (row.kind === "color") {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#e8e4dc" }}>{row.label}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: mono,
                fontSize: 13,
                color: changed ? "#ffd166" : "#8a939a",
                fontWeight: changed ? 700 : 400,
              }}
            >
              {asHex(value).toUpperCase()}
            </span>
            <input
              type="color"
              value={asHex(value)}
              onChange={(e) =>
                setTuning(row.group, row.key as never, parseInt(e.target.value.slice(1), 16))
              }
              style={{ width: 34, height: 22, padding: 0, border: "1px solid #3a4148", background: "none" }}
            />
          </span>
        </div>
        <div style={{ fontSize: 9, color: "#6f787f", lineHeight: 1.3 }}>{row.note}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 12, color: "#e8e4dc" }}>{row.label}</span>
        <span
          style={{
            fontFamily: mono,
            fontSize: 13,
            color: changed ? "#ffd166" : "#8a939a",
            fontWeight: changed ? 700 : 400,
          }}
        >
          {value.toFixed(3)}
          {changed && <span style={{ fontSize: 10, opacity: 0.6 }}> (was {shipped})</span>}
        </span>
      </div>
      <input
        type="range"
        min={row.min}
        max={row.max}
        step={row.step}
        value={value}
        onChange={(e) => setTuning(row.group, row.key as never, Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ fontSize: 9, color: "#6f787f", lineHeight: 1.3 }}>{row.note}</div>
    </div>
  );
}

export default function TuneBench() {
  const [specimen, setSpecimen] = useState<Specimen>("gull");
  const [copied, setCopied] = useState(false);

  const tab = (id: Specimen, label: string) => (
    <button
      key={id}
      onClick={() => setSpecimen(id)}
      style={{
        padding: "5px 12px",
        fontSize: 12,
        fontFamily: mono,
        borderRadius: 4,
        border: "1px solid #3a4148",
        background: specimen === id ? "#ffd166" : "#1c2126",
        color: specimen === id ? "#1c2126" : "#c8cfd4",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", top: 40, left: 0, right: 0, bottom: 0, background: "#11151a", display: "flex" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          shadows
          camera={{ position: [16, 11, 20], fov: 40 }}
          // MATCH THE WORLD. GameWorld sets NeutralToneMapping; the Canvas
          // default is not the same curve, so without this the bench renders
          // brightness differently from the thing it exists to judge — and a
          // glare tuned here would be wrong there.
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
          }}
        >
          <color attach="background" args={["#202931"]} />
          <hemisphereLight args={["#cfe2ff", "#5a6b4a", 0.5]} />
          <directionalLight position={[6, 10, 4]} intensity={1.4} color="#FFF7E4" castShadow />
          <Suspense fallback={null}>
            {specimen === "gull" ? <GullSpecimen /> : specimen === "water" ? <WaterSpecimen /> : <GrassSpecimen />}
          </Suspense>
          {/* Hidden under water: the surface does not write depth, so the
              helper shows straight through it and reads as seams in the water. */}
          {specimen !== "water" && (
            <gridHelper args={[32, 32, "#2c353d", "#1d242a"]} position={[0, -0.01, 0]} />
          )}
          <OrbitControls makeDefault target={[0, 2, 0]} />
        </Canvas>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            fontFamily: mono,
            fontSize: 11,
            color: "#6f787f",
          }}
        >
          drag to orbit · scroll to zoom · values are live in the world too
        </div>
      </div>

      <div
        style={{
          width: 330,
          padding: 16,
          overflowY: "auto",
          background: "#171c21",
          borderLeft: "1px solid #2a3138",
          fontFamily: mono,
        }}
      >
        <div style={{ fontSize: 13, color: "#ffd166", letterSpacing: 1, marginBottom: 10 }}>
          TUNING BENCH
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {tab("gull", "seagull")}
          {tab("water", "water")}
          {tab("grass", "grass")}
        </div>

        {ROWS[specimen].map((r) => (
          <Slider key={`${r.group}.${r.key}`} row={r} />
        ))}

        <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(tuningSource());
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            style={{
              flex: 1,
              padding: "7px 10px",
              fontSize: 11,
              fontFamily: mono,
              borderRadius: 4,
              border: "1px solid #3a4148",
              background: copied ? "#5aa469" : "#1c2126",
              color: "#e8e4dc",
              cursor: "pointer",
            }}
          >
            {copied ? "copied" : "Copy source"}
          </button>
          <button
            onClick={() => resetTuning()}
            style={{
              padding: "7px 10px",
              fontSize: 11,
              fontFamily: mono,
              borderRadius: 4,
              border: "1px solid #3a4148",
              background: "#1c2126",
              color: "#c8cfd4",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#6f787f", marginTop: 10, lineHeight: 1.5 }}>
          A screenshot of this panel is a complete record — every value is printed
          next to its slider, and anything moved off the shipped default is
          highlighted. &ldquo;Copy source&rdquo; gives the paste-ready
          TUNING_DEFAULTS block for lib/game/tuning.ts.
        </div>
      </div>
    </div>
  );
}
