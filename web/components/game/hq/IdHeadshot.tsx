"use client";

/**
 * Your island ID's photo (David's v3 review: "should show character head shot"): your real avatar, your saved look,
 * head and shoulders in the creator's studio portrait (character/CreatorStage Portrait, the white studio), facing the
 * camera. Its own small canvas, up only while the card is.
 */
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { FRAMES, Portrait } from "@/components/game/character/CreatorStage";
import { useMyLook } from "@/lib/game/character/lookStore";

/** Nearly square on, as an ID photo is. */
const FACING = -0.1;

export default function IdHeadshot() {
  const { look } = useMyLook();
  const yaw = useRef({ now: FACING, target: FACING });
  return <Canvas style={{ width: "100%", height: "100%" }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]} camera={{ fov: FRAMES.head.fov, near: 0.05, far: 30 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }} data-testid="hq-id-headshot">
    <Portrait look={look} framing="head" yaw={yaw} studio="white" />
  </Canvas>;
}
