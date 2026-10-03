"use client";

/**
 * FishingBobber — the applicant island's bobber (components/recruit/ApplicantWorld.tsx mounts it; its player holds no
 * rod). The member island draws the bobber, its line and the catch on the angler's own rod instead (character/
 * FishingRig.tsx, from that avatar's cast); this keeps the old island casting with the same float and water.
 * Driven by window events from FishingOverlay:
 *
 *   tsi:fish-cast {x, z, power} — the bobber arcs from the player to the water (throw distance scales with cast
 *       power, never past the far bank: lib/game/fishingCast.ts), lands with drops and rings drawn as water, and
 *       announces it (tsi:fish-splash {x, y, z}, after the frame: the overlay starts the wait on it).
 *   tsi:fish-nibble — the fake-out: the bobber dips, a small ring.
 *   tsi:fish-bite — pulled under in a crown of water, thrashing (smooth seeded noise); the paper "!" pops over you.
 *   tsi:fish-end — it goes.
 *
 * Motion runs on refs in useFrame (no React state per frame, nothing allocated per frame); the "!" is the only
 * stateful bit, set from an event.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { castLanding, thrash } from "@/lib/game/fishingCast";
import { FLOAT } from "@/lib/game/fishingRig";
import { bobberLands, bobberNibbled, fishBites } from "@/lib/game/fx/fishingFx";
import { seedAt, type ParticlePool } from "@/lib/game/fx/particles";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { BANG_POP, BANG_STYLE, BANG_TIMING, BOBBER_URL } from "./character/FishingRig";
import { useMoveParticles } from "./movement/moveFx";

interface CastDetail {
  x: number;
  z: number;
  power: number;
}

const anywhere = () => true;

export default function FishingBobber({ playerPosRef, waterHeight, towardWater = false, isWater = anywhere }: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>; waterHeight: (x: number, z: number) => number; towardWater?: boolean;
  /** The drawn water (not the coast): a throw never carries over land. Without it the throw runs its full reach. */
  isWater?: (x: number, z: number) => boolean;
}) {
  const { camera } = useThree();
  const particles = useMoveParticles();
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const [bite, setBite] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const biteGroupRef = useRef<THREE.Group>(null);
  const fx = useRef<Fx>({
    phase: "arc", t: 0, biteT: 0, nibbleAt: -1, power: 0, waterY: 0, seed: 0, nibbles: 0,
    start: new THREE.Vector3(), land: new THREE.Vector3(), aim: { x: 0, z: 0 }, shake: { x: 0, y: 0, z: 0 },
  });

  useEffect(() => {
    const f = fx.current;
    const onCast = (e: Event) => {
      const d = (e as CustomEvent<CastDetail>).detail;
      const p = playerPosRef.current;
      f.nibbleAt = Number.NEGATIVE_INFINITY;
      activeRef.current = true;
      // Casting aims from you toward the validated water target (both islands); without `towardWater` the throw would
      // run along the camera's forward, which turns now. It carries past the spot by its power, stopping short of land.
      const fwd = getCameraForwardXZ(camera);
      const fromX = towardWater ? p.x : d.x - fwd.fx, fromZ = towardWater ? p.z : d.z - fwd.fz;
      castLanding(isWater, fromX, fromZ, d.x, d.z, d.power, f.aim);
      f.waterY = waterHeight(f.aim.x, f.aim.z);
      f.land.set(f.aim.x, f.waterY + FLOAT, f.aim.z);
      f.start.set(p.x, p.y + 0.9, p.z);
      f.power = d.power;
      f.seed = seedAt(f.aim.x, f.aim.z, 61);
      f.t = 0;
      f.phase = "arc";
      setBite(false);
      setActive(true);
    };
    const onNibble = () => {
      if (!activeRef.current) return;
      f.nibbleAt = performance.now();
      bobberNibbled(particles.pool, f.land.x, f.waterY, f.land.z, ++f.nibbles);
    };
    const onBite = () => {
      if (!activeRef.current) return;
      f.phase = "bite";
      f.biteT = 0;
      setBite(true);
      fishBites(particles.pool, f.land.x, f.waterY, f.land.z);
    };
    const onEnd = () => {
      activeRef.current = false;
      setActive(false);
      setBite(false);
    };
    window.addEventListener("tsi:fish-cast", onCast);
    window.addEventListener("tsi:fish-nibble", onNibble);
    window.addEventListener("tsi:fish-bite", onBite);
    window.addEventListener("tsi:fish-end", onEnd);
    return () => {
      window.removeEventListener("tsi:fish-cast", onCast);
      window.removeEventListener("tsi:fish-nibble", onNibble);
      window.removeEventListener("tsi:fish-bite", onBite);
      window.removeEventListener("tsi:fish-end", onEnd);
    };
  }, [camera, playerPosRef, waterHeight, towardWater, isWater, particles]);

  useFrame((_, dt) => step(fx.current, groupRef.current, biteGroupRef.current, activeRef.current, playerPosRef.current, particles.pool, dt));

  if (!active) return null;

  return (
    <>
      <group ref={groupRef}>
        <Suspense fallback={null}><Bobber /></Suspense>
      </group>
      {/* The bite's "!" over the player, in the paper kit. */}
      {bite && (
        <Billboard ref={biteGroupRef}>
          <Html center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div aria-hidden style={{ ...BANG_STYLE, display: "block" }} ref={el => { el?.animate(BANG_POP, BANG_TIMING); }}>!</div>
          </Html>
        </Billboard>
      )}
    </>
  );
}

/** Our low-poly matte float (art/props-enemies/build_bobber.py). */
function Bobber() {
  const { scene } = useGLTF(BOBBER_URL);
  const model = useMemo(() => tagLookClasses(scene.clone(true), BOBBER_URL), [scene]);
  return <primitive object={model} />;
}

/** The cast's state, kept in a ref: where it flies from and lands, its phase and the thrash's seed. */
interface Fx { phase: "arc" | "float" | "bite"; t: number; biteT: number; nibbleAt: number; power: number; waterY: number; seed: number; nibbles: number;
  start: THREE.Vector3; land: THREE.Vector3; aim: { x: number; z: number }; shake: { x: number; y: number; z: number } }

/** One frame of the bobber (module scope: the react compiler freezes values reached through hooks). */
function step(f: Fx, g: THREE.Group | null, biteGroup: THREE.Group | null, active: boolean, player: THREE.Vector3, pool: ParticlePool, dt: number) {
  if (!g || !active) return;
  biteGroup?.position.set(player.x, player.y + 2.4, player.z);
  f.t += dt;
  if (f.phase === "arc") {
    const k = Math.min(1, f.t / 0.45);
    g.position.lerpVectors(f.start, f.land, k);
    g.position.y += Math.sin(k * Math.PI) * (1.1 + f.power * 0.9);
    g.rotation.set(k * 5.5, 0, Math.sin(k * 3) * 0.5);
    if (k >= 1) {
      f.phase = "float";
      bobberLands(pool, f.land.x, f.waterY, f.land.z, 0.8 + 0.4 * f.power);
      // After the frame: the overlay starts the wait on the landing (a React update, never inside useFrame).
      const { x, z } = f.aim, y = f.waterY;
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("tsi:fish-splash", { detail: { x, y, z } })));
    }
  } else if (f.phase === "float") {
    const since = (performance.now() - f.nibbleAt) / 1000, dip = since < 0.42 ? -0.07 * Math.sin((since / 0.42) * Math.PI) : 0;
    g.position.set(f.land.x, f.waterY + FLOAT + Math.sin(f.t * 2.6) * 0.012 + dip, f.land.z);
    g.rotation.set(0.06 * Math.sin(f.t * 2.1), 0, 0.06 * Math.sin(f.t * 1.7 + 1));
  } else {
    // bite: pulled under, thrashing on the cast's own smooth noise
    f.biteT += dt;
    thrash(f.biteT, f.seed, f.shake);
    g.position.set(f.land.x + f.shake.x, f.waterY + f.shake.y, f.land.z + f.shake.z);
    g.rotation.set(0.5 + 0.18 * Math.sin(f.biteT * 23), 0, 0.18 * Math.sin(f.biteT * 19 + 1));
  }
}
