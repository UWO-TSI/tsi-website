"use client";

/**
 * Oracle temple on the default island: the existing OracleInterior (dump
 * pieces: altar, ruins pillars, magic-circle rug, candles; the Oracle keeper
 * says the quiz's reactions) plus the reveal ceremony (row 206): the hall
 * washes in the family colour, a sigil rises over the altar and a beam of
 * light falls on it.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import OracleInterior from "../OracleInterior";
import type { InteriorStation } from "../interiorShared";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import { sigilTexture } from "./sigil";
import type { IslandLight } from "@/lib/game/islandLighting";

const ALTAR: [number, number, number] = [0, 0, 2.6];

function Ceremony({ family, startedAt }: { family: Family; startedAt: number }) {
  const sigil = useRef<THREE.Sprite>(null);
  const beam = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const tex = useMemo(() => sigilTexture(family), [family]);
  useEffect(() => () => tex.dispose(), [tex]);
  const color = FAMILIES[family].light;
  useFrame(() => {
    const age = (performance.now() - startedAt) / 1000;
    const rise = Math.min(1, age / 2.2), ease = rise * rise * (3 - 2 * rise);
    if (sigil.current) {
      sigil.current.position.y = 1.6 + ease * 1.9 + Math.sin(age * 1.4) * 0.06;
      sigil.current.material.opacity = ease;
      sigil.current.material.rotation = Math.sin(age * 0.6) * 0.08;
      const s = 1.4 + ease * 0.8; sigil.current.scale.set(s, s, 1);
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.12 * ease * (0.85 + Math.sin(age * 2.2) * 0.15);
    if (light.current) light.current.intensity = 30 * ease;
  });
  return <group position={ALTAR}>
    <pointLight ref={light} color={color} intensity={0} distance={14} position={[0, 3.4, 0]} />
    <mesh ref={beam} position={[0, 2.6, 0]}>
      <cylinderGeometry args={[0.55, 1.1, 5.2, 24, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
    <sprite ref={sigil} position={[0, 1.6, 0]} renderOrder={5}>
      <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} depthTest={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </sprite>
  </group>;
}

export default function OracleTemple({ frozen, talking = false, light, player, onNear, ceremony }: {
  frozen: boolean; player: React.RefObject<THREE.Vector3>; onNear: (near: "altar" | "exit" | null) => void;
  ceremony: { family: Family; startedAt: number } | null;
  /** The quiz sheet is open at the altar. */
  talking?: boolean;
  /** The island's light now: the windows follow the time of day. */
  light?: IslandLight;
}) {
  return <>
    <OracleInterior frozen={frozen} talking={talking} light={light} playerPosRef={player as React.MutableRefObject<THREE.Vector3>}
      tint={ceremony ? FAMILIES[ceremony.family].light : undefined}
      onNearestStation={(s: InteriorStation | null) => onNear(s ? (s.id === "altar" ? "altar" : "exit") : null)} />
    {ceremony && <Ceremony family={ceremony.family} startedAt={ceremony.startedAt} />}
  </>;
}
