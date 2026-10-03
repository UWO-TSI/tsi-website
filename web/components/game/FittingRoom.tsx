"use client";

/**
 * The fitting room beside the shop (specs/polish/interiors.md deliverable 4): its curtain moves. It stirs in the shared
 * wind, swishes as you brush past it walking up, and sweeps across when you step in to try outfits on (E, which opens
 * the wardrobe: `tsi:fitting`). The sway is a vertex wave on the curtain alone, pinned at the rail and freest at the
 * hem; nothing is allocated per frame.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { modelContact, useContactShadow } from "./ContactShadows";
import { liveWind } from "./movement/moveFx";
import { worldTime } from "@/lib/game/worldClock";

const URL = "/assets/acnh/furniture/fitting-room.glb";
/** The curtain in the model's own units: its rail and hem (y) and how far its hem may swing (×0.1 in the world). */
const RAIL = 17.13, HEM = 2.27, SWING = 2.4;
/** Within this of the booth's front you brush the curtain. */
const BRUSH = 1.3;

type Sway = { value: number };
/** Curtain material: the model's own, with the sway added (rail pinned, the hem free). */
function swayCurtain(material: THREE.MeshStandardMaterial, amp: Sway, time: Sway) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uSway = amp;
    shader.uniforms.uSwayTime = time;
    shader.vertexShader = "uniform float uSway;\nuniform float uSwayTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  {
    float free = pow(clamp((${RAIL.toFixed(2)} - transformed.y) / ${(RAIL - HEM).toFixed(2)}, 0.0, 1.0), 1.3);
    float ripple = sin(transformed.x * 0.9 + uSwayTime * 3.1) * 0.6 + sin(transformed.x * 1.7 - uSwayTime * 4.3) * 0.4;
    transformed.z += uSway * ${SWING.toFixed(2)} * free * ripple;
    transformed.x += uSway * ${(SWING * 0.45).toFixed(2)} * free * sin(uSwayTime * 2.2);
  }`);
  };
  const key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}|curtain-sway`;
  material.needsUpdate = true;
}

/** Module scope (the react compiler forbids writing through hook values): ease the swish down and keep the breeze. */
const state = { swish: 0, near: false };
function step(amp: Sway, time: Sway, at: THREE.Vector3, player: THREE.Vector3, dt: number) {
  const near = Math.hypot(player.x - at.x, player.z - at.z) < BRUSH;
  if (near && !state.near) state.swish = Math.max(state.swish, 0.55);
  state.near = near;
  state.swish *= Math.exp(-dt * 1.6);
  const breeze = 0.05 + 0.04 * Math.min(1, liveWind().speed / 4);
  amp.value = breeze + state.swish;
  time.value = worldTime();
}

export default function FittingRoom({ at, ground, player }: { at: [number, number]; ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const { scene } = useGLTF(URL);
  const uniforms = useMemo(() => ({ amp: { value: 0.05 }, time: { value: 0 } }), []);
  const cls = shadowClassFor(URL);
  const model = useMemo(() => {
    const m = prepareModel(scene, URL, undefined, cls);
    m.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.Material).name === "mReFabric") swayCurtain(mesh.material as THREE.MeshStandardMaterial, uniforms.amp, uniforms.time);
    });
    return m;
  }, [scene, uniforms, cls]);
  useContactShadow(model, useMemo(() => modelContact(model, URL, cls), [model, cls]));
  useEffect(() => {
    applyModelTextures(model, URL);
    return () => disposeModelMaterials(model);
  }, [model]);
  // Stepping in (E: the wardrobe opens) sweeps the curtain across.
  useEffect(() => {
    const on = () => { state.swish = 1; };
    window.addEventListener("tsi:fitting", on);
    return () => window.removeEventListener("tsi:fitting", on);
  }, []);
  const front = useMemo(() => new THREE.Vector3(at[0], 0, at[1]), [at]);
  useFrame((_, raw) => step(uniforms.amp, uniforms.time, front, player.current, Math.min(raw, 0.1)));
  return <primitive object={model} scale={0.1} position={[at[0], ground(at[0], at[1]), at[1] + 0.45]} rotation={[0, Math.PI, 0]} />;
}
