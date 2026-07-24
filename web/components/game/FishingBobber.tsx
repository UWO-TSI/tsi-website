"use client";

/**
 * FishingBobber (animation refinement round, 2026-07-23) — the in-world
 * half of the fishing beats. Driven by window events from FishingOverlay:
 *
 *   tsi:fish-cast {x, z, power} — bobber arcs from the player to the water
 *       (throw distance scales with cast power), lands with a splash ring
 *       and a plop.
 *   tsi:fish-nibble — the fake-out: bobber dips, small ripple, soft blip.
 *   tsi:fish-bite — bobber slams under, big ripple, red "!" pops above
 *       the player (ACNH beat).
 *   tsi:fish-end — everything unmounts.
 *
 * Motion runs on refs in useFrame (no per-frame React); rings and the "!"
 * are the only stateful bits, set from event handlers.
 */

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";

interface CastDetail {
  x: number;
  z: number;
  power: number;
}

export default function FishingBobber({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  const [active, setActive] = useState(false);
  const [bite, setBite] = useState(false);
  const [rings, setRings] = useState<{ id: number; x: number; z: number; big: boolean }[]>([]);
  const ringIdRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef<"arc" | "float" | "bite">("arc");
  const tRef = useRef(0);
  const nibbleAtRef = useRef(-1);
  const startRef = useRef(new THREE.Vector3());
  const landRef = useRef(new THREE.Vector3());
  const powerRef = useRef(0);

  const addRing = (big: boolean) => {
    const id = ringIdRef.current++;
    const { x, z } = { x: landRef.current.x, z: landRef.current.z };
    setRings((r) => [...r, { id, x, z, big }]);
    window.setTimeout(() => setRings((r) => r.filter((q) => q.id !== id)), big ? 900 : 650);
  };

  useEffect(() => {
    const onCast = (e: Event) => {
      const d = (e as CustomEvent<CastDetail>).detail;
      const p = playerPosRef.current;
      // Cast along the CAMERA's forward (bug fix 2026-07-24: spot−player
      // flipped sign when the player stood past the marker — the hook flew
      // backwards onto land). The player faces away from the camera, so
      // forward always throws into the scene.
      const fwd = getCameraForwardXZ(camera);
      const dir = new THREE.Vector3(fwd.fx, 0, fwd.fz);
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      else dir.normalize();
      // Power = visibly longer throw past the spot marker.
      const extend = 0.6 + d.power * 2.0;
      landRef.current.set(d.x + dir.x * extend, -0.12, d.z + dir.z * extend);
      startRef.current.set(p.x, 0.9, p.z);
      powerRef.current = d.power;
      tRef.current = 0;
      phaseRef.current = "arc";
      setBite(false);
      setActive(true);
    };
    const onNibble = () => {
      nibbleAtRef.current = performance.now();
      addRing(false);
      AudioManager.playSFX("blip1");
    };
    const onBite = () => {
      phaseRef.current = "bite";
      setBite(true);
      addRing(true);
    };
    const onEnd = () => {
      setActive(false);
      setBite(false);
      setRings([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g || !active) return;
    tRef.current += dt;
    const t = tRef.current;
    if (phaseRef.current === "arc") {
      const k = Math.min(1, t / 0.45);
      g.position.lerpVectors(startRef.current, landRef.current, k);
      g.position.y += Math.sin(k * Math.PI) * (1.1 + powerRef.current * 0.9);
      if (k >= 1) {
        phaseRef.current = "float";
        addRing(false);
        AudioManager.playSFX("blip2"); // plop
      }
    } else if (phaseRef.current === "float") {
      const dip = performance.now() - nibbleAtRef.current < 420 ? -0.16 : 0;
      g.position.set(
        landRef.current.x,
        -0.12 + Math.sin(t * 2.6) * 0.05 + dip,
        landRef.current.z
      );
    } else {
      // bite: slammed under, thrashing
      g.position.set(
        landRef.current.x + (Math.random() * 2 - 1) * 0.03,
        -0.4 + Math.sin(t * 18) * 0.04,
        landRef.current.z + (Math.random() * 2 - 1) * 0.03
      );
    }
  });

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

      {rings.map((r) => (
        <RippleRing key={r.id} x={r.x} z={r.z} big={r.big} />
      ))}

      {/* ACNH bite "!" above the player */}
      {bite && (
        <Billboard position={[playerPosRef.current.x, playerPosRef.current.y + 2.4, playerPosRef.current.z]}>
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

/** Expanding water ring; parent removes it from the list after its life. */
function RippleRing({ x, z, big }: { x: number; z: number; big: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);
  useFrame((_, dt) => {
    const m = meshRef.current;
    if (!m) return;
    tRef.current += dt;
    const life = big ? 0.85 : 0.6;
    const k = Math.min(1, tRef.current / life);
    const s = (big ? 2.6 : 1.4) * (0.3 + k);
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
  });
  return (
    <mesh ref={meshRef} position={[x, -0.05, z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.34, 0.42, 24]} />
      <meshBasicMaterial color="#EAF6FF" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
