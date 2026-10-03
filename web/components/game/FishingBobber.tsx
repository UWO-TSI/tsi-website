"use client";

/**
 * FishingBobber (animation refinement round, 2026-07-23) — the in-world
 * half of the fishing beats. Driven by window events from FishingOverlay:
 *
 *   tsi:fish-cast {x, z, power} — bobber arcs from the player to the water
 *       (throw distance scales with cast power, never past the far bank:
 *       lib/game/fishingCast.ts), lands with a splash ring and announces it
 *       (tsi:fish-splash {x, y, z}, after the frame: the overlay starts the
 *       wait on it).
 *   tsi:fish-nibble — the fake-out: bobber dips, small ripple.
 *   tsi:fish-bite — bobber pulled under, thrashing (smooth seeded noise),
 *       big ripple, red "!" pops above the player (ACNH beat).
 *   tsi:fish-end — everything unmounts.
 *
 * Motion and rings run on refs in useFrame (no React state per frame, nothing
 * allocated per frame); the "!" is the only stateful bit, set from an event.
 */

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { castLanding, thrash } from "@/lib/game/fishingCast";
import { seedAt } from "@/lib/game/fx/particles";

interface CastDetail {
  x: number;
  z: number;
  power: number;
}

/** Rings on the water at once (a landing, a nibble or two, the bite). */
const RINGS = 4;
const ringGeometry = new THREE.RingGeometry(0.34, 0.42, 24);
const anywhere = () => true;

export default function FishingBobber({ playerPosRef, waterHeight, towardWater = false, isWater = anywhere }: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>; waterHeight: (x: number, z: number) => number; towardWater?: boolean;
  /** The drawn water (not the coast): a throw never carries over land. Without it the throw runs its full reach. */
  isWater?: (x: number, z: number) => boolean;
}) {
  const { camera } = useThree();
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const [bite, setBite] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const biteGroupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fx = useRef<Fx>({
    phase: "arc", t: 0, biteT: 0, nibbleAt: -1, power: 0, waterY: 0, seed: 0,
    start: new THREE.Vector3(), land: new THREE.Vector3(), aim: { x: 0, z: 0 }, shake: { x: 0, y: 0, z: 0 },
    rings: Array.from({ length: RINGS }, () => ({ age: -1, life: 0.6, big: false })), nextRing: 0,
  });

  useEffect(() => {
    const f = fx.current;
    const onCast = (e: Event) => {
      const d = (e as CustomEvent<CastDetail>).detail;
      const p = playerPosRef.current;
      for (const r of f.rings) r.age = -1;
      f.nibbleAt = Number.NEGATIVE_INFINITY;
      activeRef.current = true;
      // Casting aims from you toward the validated water target (both islands); without `towardWater` the throw would
      // run along the camera's forward, which turns now. It carries past the spot by its power, stopping short of land.
      const fwd = getCameraForwardXZ(camera);
      const fromX = towardWater ? p.x : d.x - fwd.fx, fromZ = towardWater ? p.z : d.z - fwd.fz;
      castLanding(isWater, fromX, fromZ, d.x, d.z, d.power, f.aim);
      f.waterY = waterHeight(f.aim.x, f.aim.z);
      f.land.set(f.aim.x, f.waterY + 0.08, f.aim.z);
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
      addRing(f, false);
      AudioManager.playSFX("blip1");
    };
    const onBite = () => {
      if (!activeRef.current) return;
      f.phase = "bite";
      f.biteT = 0;
      setBite(true);
      addRing(f, true);
    };
    const onEnd = () => {
      activeRef.current = false;
      for (const r of f.rings) r.age = -1;
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
  }, [camera, playerPosRef, waterHeight, towardWater, isWater]);

  useFrame((_, dt) => step(fx.current, groupRef.current, biteGroupRef.current, ringRefs.current, activeRef.current, playerPosRef.current, dt));

  if (!active) return null;

  return (
    <>
      <group ref={groupRef}>
        {/* red bobber with a white belly band */}
        <mesh>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshStandardMaterial color="#E5484D" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.045, 0]}>
          <sphereGeometry args={[0.075, 12, 8]} />
          <meshStandardMaterial color="#FFFDF5" roughness={0.5} />
        </mesh>
      </group>

      {Array.from({ length: RINGS }, (_, i) => (
        <mesh key={i} ref={m => { ringRefs.current[i] = m; }} visible={false} rotation-x={-Math.PI / 2} geometry={ringGeometry}>
          <meshBasicMaterial color="#EAF6FF" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}

      {/* ACNH bite "!" above the player */}
      {bite && (
        <Billboard ref={biteGroupRef}>
          <Html center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                fontFamily: "var(--font-highlight, sans-serif)",
                fontSize: 34,
                fontWeight: 900,
                color: "#FFFDF5",
                background: "#E5484D",
                borderRadius: 10,
                padding: "2px 12px",
                boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
                animation: "tsi-bite-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              !
            </div>
            <style>{`
              @keyframes tsi-bite-pop {
                0% { transform: scale(0.2); }
                60% { transform: scale(1.3); }
                100% { transform: scale(1); }
              }
            `}</style>
          </Html>
        </Billboard>
      )}
    </>
  );
}

/** The cast's state, kept in a ref: where it flies from and lands, its phase, the thrash's seed and the rings. */
interface Fx { phase: "arc" | "float" | "bite"; t: number; biteT: number; nibbleAt: number; power: number; waterY: number; seed: number;
  start: THREE.Vector3; land: THREE.Vector3; aim: { x: number; z: number }; shake: { x: number; y: number; z: number };
  /** Each ring's age (s) and life; a negative age is a free slot, taken in turn. */
  rings: { age: number; life: number; big: boolean }[]; nextRing: number }

/** A ring on the water at the bobber: the next slot, no React. */
function addRing(f: Fx, big: boolean) {
  const r = f.rings[f.nextRing];
  f.nextRing = (f.nextRing + 1) % RINGS;
  r.age = 0; r.life = big ? 0.85 : 0.6; r.big = big;
}

/** One frame of the bobber and its rings (module scope: the react compiler freezes values reached through hooks). */
function step(f: Fx, g: THREE.Group | null, biteGroup: THREE.Group | null, rings: (THREE.Mesh | null)[], active: boolean, player: THREE.Vector3, dt: number) {
  if (!g || !active) return;
  biteGroup?.position.set(player.x, player.y + 2.4, player.z);
  f.t += dt;
  if (f.phase === "arc") {
    const k = Math.min(1, f.t / 0.45);
    g.position.lerpVectors(f.start, f.land, k);
    g.position.y += Math.sin(k * Math.PI) * (1.1 + f.power * 0.9);
    if (k >= 1) {
      f.phase = "float";
      addRing(f, false);
      AudioManager.playSFX("blip2"); // plop
      // After the frame: the overlay starts the wait on the landing (a React update, never inside useFrame).
      const { x, z } = f.aim, y = f.waterY;
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("tsi:fish-splash", { detail: { x, y, z } })));
    }
  } else if (f.phase === "float") {
    const dip = performance.now() - f.nibbleAt < 420 ? -0.16 : 0;
    g.position.set(f.land.x, f.waterY + 0.08 + Math.sin(f.t * 2.6) * 0.05 + dip, f.land.z);
  } else {
    // bite: pulled under, thrashing on the cast's own smooth noise
    f.biteT += dt;
    thrash(f.biteT, f.seed, f.shake);
    g.position.set(f.land.x + f.shake.x, f.waterY + f.shake.y, f.land.z + f.shake.z);
  }
  for (let i = 0; i < RINGS; i++) {
    const r = f.rings[i], m = rings[i];
    if (!m) continue;
    if (r.age < 0) { m.visible = false; continue; }
    r.age += dt;
    const k = Math.min(1, r.age / r.life);
    if (k >= 1) { r.age = -1; m.visible = false; continue; }
    const s = (r.big ? 2.6 : 1.4) * (0.3 + k);
    m.visible = true;
    m.position.set(f.land.x, f.waterY + 0.015, f.land.z);
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
  }
}
