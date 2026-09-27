"use client";

import { useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { ApplicantAppearanceContext } from "@/lib/game/applicantAppearance";

export type ApplicantMotion = { speed: number; yaw: number; lift: number };
const PLAYER_MODEL = "/assets/characters/applicant/player.gltf";
const GUIDE_MODEL = "/assets/characters/applicant/jayden.gltf";

export function createApplicantAnimation(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  if (!actions.Walk) {
    const walk = clips.find(clip => clip.name === "Run")!.clone();
    walk.name = "Walk";
    actions.Walk = mixer.clipAction(walk);
  }
  actions.Idle.reset().play();
  return { mixer, actions, walkTempo: clips.some(clip => clip.name === "Walk") ? 1 : 0.65, dispose: () => { mixer.stopAllAction(); mixer.uncacheRoot(model); } };
}

type CharacterProps = { motion: RefObject<ApplicantMotion>; frozen?: boolean; walkSpeed?: number; guide?: boolean };

/** Visual only: the world/room controllers own movement and collision. */
export default function ApplicantCharacter({ motion, frozen = false, walkSpeed = 7.4, guide = false }: CharacterProps) {
  const appearance = useContext(ApplicantAppearanceContext);
  const { scene, animations } = useGLTF(guide ? GUIDE_MODEL : appearance.body === "girl" ? "/assets/characters/applicant/player-female.gltf" : PLAYER_MODEL);
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const instance = clone(scene);
    instance.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false; // Ground decal stays correct with cached world shadows.
        object.receiveShadow = true;
        object.frustumCulled = false;
        if (!guide) {
          const palette: Record<string, string> = { Skin: appearance.skin, Hair: appearance.hair, Shirt: appearance.shirt, Face: "#302c29", Pants: "#39495b" };
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          const colored = materials.map(material => {
            const copy = material.clone();
            if (copy instanceof THREE.MeshStandardMaterial && palette[copy.name]) copy.color.set(palette[copy.name]);
            return copy;
          });
          object.material = Array.isArray(object.material) ? colored : colored[0];
        }
      }
    });
    return instance;
  }, [scene, guide, appearance.skin, appearance.hair, appearance.shirt]);
  useEffect(() => () => { if (!guide) model.traverse(object => { if (object instanceof THREE.Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose()); }); }, [model, guide]);
  const playback = useRef<ReturnType<typeof createApplicantAnimation> | null>(null);
  const active = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    // Strict Mode replays setup after cleanup. Uncached actions cannot be reused.
    const session = createApplicantAnimation(model, animations);
    playback.current = session;
    active.current = session.actions.Idle;
    return () => { playback.current = null; active.current = null; session.dispose(); };
  }, [animations, model]);

  useFrame((_, elapsed) => {
    if (!group.current || frozen || !playback.current) return;
    const { mixer, actions, walkTempo } = playback.current;
    const { speed, yaw, lift } = motion.current;
    const next = speed < 0.08 ? actions.Idle : speed > walkSpeed * 1.25 ? actions.Run : actions.Walk;
    if (active.current !== next) {
      next.reset().setEffectiveWeight(1).play();
      active.current?.crossFadeTo(next, 0.16, false);
      active.current = next;
    }
    next.setEffectiveTimeScale(next === actions.Idle ? 1 : (next === actions.Walk ? walkTempo : 1) * THREE.MathUtils.clamp(speed / (next === actions.Run ? walkSpeed * 1.85 : walkSpeed), 0.35, 1.6));
    group.current.rotation.y = yaw;
    group.current.position.y = lift;
    mixer.update(Math.min(elapsed, 0.1));
  });

  return <group ref={group}><primitive object={model} scale={0.5} dispose={null} /></group>;
}
