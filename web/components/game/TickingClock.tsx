"use client";

/**
 * The HQ's grandfather clock ticks (specs/polish/interiors.md deliverable 4): its pendulum swings a beat a second and
 * its hands keep the island's time (Toronto's, the world clock). The pendulum and the two hands are parts of the dump
 * model (antique-clock.glb), lifted out at load into pivots of their own (lib/game/clockParts.ts); the rest of the
 * clock stays as it was. Near it you hear the tick (the click, low and soft, until a real tick is sourced).
 */
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { pieceUrl } from "./interiorShared";
import { AudioManager } from "@/lib/game/audio";
import { worldNow } from "@/lib/game/worldClock";
import { torontoParts } from "@/lib/time";
import { clockAngles, pendulumAngle, splitClock } from "@/lib/game/clockParts";

const SCALE = 0.1;
/** Within this of the clock (room units) its tick is heard, louder closer. */
const HEAR = 3.2;

interface Parts { root: THREE.Object3D; pendulum: THREE.Object3D; hour: THREE.Object3D; minute: THREE.Object3D }
/** Module scope (the react compiler forbids writing through hook values): the hands and pendulum for the time now. */
const time = { minute: -1, hour: 0, min: 0, second: -1 }, hands = { hour: 0, minute: 0 };
function tick(p: Parts, at: THREE.Vector3, player: THREE.Vector3) {
  const now = worldNow(), minute = Math.floor(now / 60000);
  if (minute !== time.minute) { const t = torontoParts(new Date(now)); time.minute = minute; time.hour = t.hour; time.min = t.minute; }
  const sec = (now / 1000) % 60;
  const a = clockAngles(time.hour, time.min, sec, hands);
  p.hour.rotation.z = a.hour;
  p.minute.rotation.z = a.minute;
  p.pendulum.rotation.z = pendulumAngle(now / 1000);
  // Tick (and tock) as the pendulum passes the middle, each whole second, when you're near.
  const s = Math.floor(now / 1000);
  if (s !== time.second) {
    const d = Math.hypot(player.x - at.x, player.z - at.z);
    if (time.second >= 0 && d < HEAR) AudioManager.playSFX("click", { rate: s % 2 ? 0.52 : 0.47, gain: 0.1 * (1 - d / HEAR) });
    time.second = s;
  }
}

export default function TickingClock({ position, rotY = 0, glassMaterial, player }: {
  position: [number, number, number]; rotY?: number; glassMaterial?: string; player: React.RefObject<THREE.Vector3>;
}) {
  const url = pieceUrl("antique-clock");
  const { scene } = useGLTF(url);
  const parts = useMemo(() => {
    const root = scene.clone(true);
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      if (glassMaterial) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const adjusted = mats.map(m => {
          if (m.name !== glassMaterial) return m;
          const glass = m.clone(); glass.transparent = true; glass.opacity = 0.12; glass.depthWrite = false;
          return glass;
        });
        mesh.material = Array.isArray(mesh.material) ? adjusted : adjusted[0];
      }
    });
    return { root, ...splitClock(root) };
  }, [scene, glassMaterial]);
  const at = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(() => tick(parts, at, player.current));
  return <group position={position} rotation={[0, rotY, 0]} scale={SCALE}>
    <primitive object={parts.root} />
  </group>;
}
