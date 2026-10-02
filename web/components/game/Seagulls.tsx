"use client";

import { Suspense, useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { tune } from "@/lib/game/tuning";
import { PERCH_GLIDE, PERCH_SIT, gullPose, gullPosition, newPerchState, perchAt, type GullParams } from "@/lib/game/gullPath";
import { worldTime } from "@/lib/game/worldClock";

/**
 * Ambient life — sprint A6. Butterflies (day), fireflies (night),
 * leaves/pollen drift (always), background birds (day). Phase prop comes from
 * the parent.
 *
 * Mostly procedural, with one real asset: the seagulls now use a rigged model
 * (see SEAGULL_URL). Everything else in here is still built from primitives —
 * `specs/asset-needs.md` tracks what that costs and which ones are worth
 * replacing.
 */

// Seagull: a rigged, animated low-poly bird (David supplied, 2026-07-26).
// Sketchfab export, slimmed to 153KB (normal map dropped, colour capped at
// 512) with the skin and the flap animation deliberately KEPT — the flap is
// the whole point, unlike the static ACNH props where stripping skinning was
// the fix for exploding clones.
const SEAGULL_URL = "/assets/fauna/seagull.glb";
useGLTF.preload(SEAGULL_URL);

// Seeded PRNG so per-mount values are deterministic.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Seagulls (organic-coast loop, iteration 3) ─────────────────
// White gulls circling fixed anchors over the water — one per lobe of
// the new coastline. Lower and quicker than the lazy inland birds, with
// a slow bobbing altitude so they read as riding the sea breeze.
const GULL_ANCHORS: [number, number][] = [
  [68, -9.4],   // east lobe, off the lighthouse (S1 x1.173)
  [23.5, 68],   // over the cove swim border
  [-65.7, 16.4],  // west bay mouth
  [45, -2],       // S4 wharf — over the pier and the Shack (wake 62)
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
const NO_PERCHES: readonly (readonly [number, number, number])[] = [];

/** Turn from angle a toward b by k (0..1), the short way round. */
function turnToward(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** Shared per gull between its flight and its body: how folded its wings are, and how much it is gliding. */
interface Wings { fold: number; glide: number }

function Gull({ anchor, seed, idx, swoopRef, altitude, perches }: { anchor: [number, number]; seed: number; idx: number; swoopRef: React.MutableRefObject<GullSwoop | null>; altitude?: number; perches: readonly (readonly [number, number, number])[] }) {
  const ref = useRef<THREE.Group>(null);
  const wings = useRef<Wings>({ fold: 0, glide: 0 });
  const perch = useRef(newPerchState());
  const at = useRef({ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } });
  // Per-bird jitter only. Every BASE below is on the bench (`tuning.gull`) and
  // read per frame, so a slider move is immediate.
  const { phase, jSpeed, jRadius, jAlt } = useMemo(() => {
    const rng = seededRandom(seed * 409 + 7);
    return {
      phase: rng() * Math.PI * 2,
      jSpeed: rng() * 0.05,
      jRadius: rng() * 3.5,
      jAlt: rng() * 2,
    };
  }, [seed]);

  const params = useRef<GullParams>({
    anchorX: anchor[0],
    anchorZ: anchor[1],
    speed: 0.09,
    radius: 6.5,
    altitude: 6.5,
    bob: 1.1,
    wobble: 0.26,
    drift: 3.5,
    phase,
  });

  useFrame(() => {
    if (!ref.current) return;
    const t = worldTime();
    const g = tune().gull;

    const p = params.current;
    p.anchorX = anchor[0];
    p.anchorZ = anchor[1];
    p.speed = g.orbitSpeed + jSpeed;
    p.radius = g.orbitRadius + jRadius;
    p.altitude = (altitude ?? g.altitude) + jAlt;
    p.bob = g.bob;
    p.wobble = g.wobble;
    p.drift = g.drift;
    p.phase = phase;

    const pose = gullPose(t, p, g.bankGain, g.bank);
    const w = wings.current, visit = perchAt(t, seed, perches.length, perch.current);
    w.fold = 0; w.glide = 0;

    // Now and then down to a perch: from wherever it left its circle, a glide down, a sit with its wings folded
    // (on the water it bobs), a turn toward where its circle has got to and a rise back into it.
    if (visit.index >= 0 && !(swoopRef.current && swoopRef.current.idx === idx)) {
      const [px, py, pz] = perches[visit.index];
      // The model's feet are 0.74 of its own units over its origin; on the water it sits low, feet under.
      const k = visit.w, water = py < 0.05;
      const sitY = py - g.scale * (water ? 1.1 : 0.74) + (water ? Math.sin(t * 1.3 + seed) * 0.03 : 0);
      gullPosition(visit.t0, p, at.current.start);
      gullPosition(visit.t0 + PERCH_GLIDE + PERCH_SIT + 4, p, at.current.end);
      const down = Math.atan2(px - at.current.start.x, pz - at.current.start.z), up = Math.atan2(at.current.end.x - px, at.current.end.z - pz);
      const rising = visit.u > PERCH_GLIDE + PERCH_SIT;
      ref.current.position.set(pose.x + (px - pose.x) * k, pose.y + (sitY - pose.y) * k, pose.z + (pz - pose.z) * k);
      ref.current.rotation.y = rising
        ? turnToward(turnToward(down, up, smooth01((visit.u - PERCH_GLIDE - PERCH_SIT) / 1.2)), pose.yaw, 1 - k)
        : turnToward(pose.yaw, down, smooth01(visit.u / 1.2));
      ref.current.rotation.z = pose.roll * (1 - k);
      w.fold = visit.fold;
      w.glide = k;
      return;
    }

    const sw = swoopRef.current;
    if (sw && sw.idx === idx) {
      const prog = (performance.now() - sw.at) / SWOOP_MS;
      if (prog >= 1) {
        swoopRef.current = null;
      } else {
        // A fast low circle over the catch point, blended in and out of the
        // patrol so the bird does not teleport between the two paths.
        const sa = t * 1.6 + phase;
        const sx = sw.x + Math.cos(sa) * 1.9;
        const sy = 2.4 + Math.sin(t * 2.2) * 0.25;
        const sz = sw.z + Math.sin(sa) * 1.9;
        const w = prog < 0.25 ? prog / 0.25 : prog > 0.72 ? (1 - prog) / 0.28 : 1;
        ref.current.position.set(
          pose.x + (sx - pose.x) * w,
          pose.y + (sy - pose.y) * w,
          pose.z + (sz - pose.z) * w
        );
        // Tight turn, so it leans harder — but still about the FORWARD axis,
        // and DEEPENING the existing lean rather than fighting it, which a
        // fixed sign here would do half the time. Heading: along the circle,
        // whose velocity (−sin sa, cos sa) is yaw −sa, eased in from the patrol
        // heading (it used to snap to sa + π, flying sideways).
        ref.current.rotation.y = turnToward(pose.yaw, -sa, w);
        const deepen = Math.sign(pose.roll || 1) * w * g.bank * 0.5;
        ref.current.rotation.z = Math.max(-g.bank, Math.min(g.bank, pose.roll + deepen));
        return;
      }
    }

    ref.current.position.set(pose.x, pose.y, pose.z);
    ref.current.rotation.y = pose.yaw;
    ref.current.rotation.z = pose.roll;
  });

  return (
    // YXZ so `rotation.z` is applied INNERMOST, i.e. about the body's own
    // forward axis. With the default XYZ order it rolls about the parent's Z,
    // which after the yaw is the bird's side axis — that is what made it pitch
    // its nose up instead of banking.
    <group ref={ref} rotation={[0, 0, 0, "YXZ"]} position={[anchor[0], 7, anchor[1]]}>
      <Suspense fallback={null}>
        <SeagullModel seed={seed} wings={wings} />
      </Suspense>
    </group>
  );
}

/**
 * The gull body. Each instance needs its OWN skeleton and mixer:
 * `SkeletonUtils.clone` rather than `Object3D.clone`, because a plain clone
 * stays bound to the source skeleton and every copy then resolves against the
 * same bones. That is the identical trap the ACNH props hit in M1, where it
 * showed up as models exploding into screen-filling shards.
 *
 * Wing phase is offset per gull so the flock does not beat in lockstep.
 */
// NO yaw correction. Measured: the model's wingspan is 9.31 along X and its
// body 5.55 along Z, so its forward is already +Z, which is what `gullPose`
// assumes. The old `-Math.PI / 2` here was based on a comment claiming the model
// faced +X; it turned forward into -X in the parent frame, and roll about the
// parent's Z then pitched the nose up. David: "it banks upwards."

/**
 * Each wing's pivot turned so the wing lies back along the body (the model's forward is +Z): its rest direction
 * (pivot to tip) swung round to point back, a little out and down, in the body's frame. Measured on the clone, so it
 * holds whatever axes the bones were authored with.
 */
function foldedWings(body: THREE.Object3D) {
  body.updateMatrixWorld(true);
  const bodyQ = body.getWorldQuaternion(new THREE.Quaternion()).invert();
  const inBody = (o: THREE.Object3D) => bodyQ.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  const toBody = (o: THREE.Object3D) => body.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  return ([["Bird_LeftWing_Pivot_01", "Bird_LeftWing_Tip_02", 1], ["Bird_RightWing_Pivot_03", "Bird_RightWing_Tip_04", -1]] as const).flatMap(([p, tip, side]) => {
    const pivot = body.getObjectByName(p), end = body.getObjectByName(tip);
    if (!pivot || !end || !pivot.parent) return [];
    const along = toBody(end).sub(toBody(pivot)).normalize();
    const swing = new THREE.Quaternion().setFromUnitVectors(along, new THREE.Vector3(side * 0.22, -0.3, -1).normalize());
    const folded = inBody(pivot.parent).invert().multiply(swing).multiply(inBody(pivot));
    return [{ pivot, folded }];
  });
}

function SeagullModel({ seed, wings }: { seed: number; wings: React.RefObject<Wings> }) {
  const { scene, animations } = useGLTF(SEAGULL_URL);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const body = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.scale.setScalar(tune().gull.scale);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Gulls read as silhouettes against the sky; a shadow pass on four
      // birds circling offshore buys nothing.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // skinned bounds do not follow the animation
    });
    return c;
  }, [scene]);
  const folds = useMemo(() => foldedWings(body), [body]);

  useEffect(() => {
    if (!animations.length) return;
    const mixer = new THREE.AnimationMixer(body);
    const action = mixer.clipAction(animations[0]);
    action.play();
    // Stagger both the start point and the rate so the flock looks alive.
    action.time = (seed * 0.37) % (animations[0].duration || 1);
    // Flap rate. Re-read every frame below so the bench is live; this just
    // seeds the per-bird offset within the spread.
    mixer.timeScale = tune().gull.flap;
    mixerRef.current = mixer;
    return () => {
      action.stop();
      mixer.uncacheRoot(body);
      mixerRef.current = null;
    };
  }, [body, animations, seed]);

  useFrame((_, delta) => {
    const m = mixerRef.current;
    if (!m) return;
    const g = tune().gull;
    // Spread keeps the flock out of lockstep; the seed picks a fixed slot in it.
    const w = wings.current;
    // Gliding in to land it beats slower; sitting, its wings fold along its back.
    m.timeScale = (g.flap + ((seed * 13) % 7) * (g.flapSpread / 7)) * (1 - 0.6 * w.glide);
    m.update(delta);
    if (w.fold > 0) for (const { pivot, folded } of folds) pivot.quaternion.slerp(folded, w.fold);
  });

  return <primitive object={body} />;
}

/**
 * `altitude`: the flock's height over the water (the tuning bench's when unset); the member island's follow camera
 * sees gulls lower. `perches`: where they land now and then ([x, surface y, z]: the water, lamp tops, roofs).
 */
export default function Seagulls({ anchors = GULL_ANCHORS, altitude, perches = NO_PERCHES }: { anchors?: [number, number][]; altitude?: number; perches?: readonly (readonly [number, number, number])[] }) {
  const swoopRef = useRef<GullSwoop | null>(null);
  useEffect(() => {
    const onCatch = (e: Event) => {
      const d = (e as CustomEvent).detail as { zone?: string; x?: number; z?: number } | undefined;
      if (d?.zone !== "sea" || typeof d.x !== "number" || typeof d.z !== "number") return;
      if (swoopRef.current) return; // one guest of honor at a time
      let best = 0;
      let bestD = Infinity;
      anchors.forEach(([ax, az], i) => {
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
  }, [anchors]);
  return (
    <group>
      {anchors.map((a, i) => (
        <Gull key={i} anchor={a} seed={i + 3} idx={i} swoopRef={swoopRef} altitude={altitude} perches={perches} />
      ))}
    </group>
  );
}
