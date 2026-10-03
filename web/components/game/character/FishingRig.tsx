"use client";

/**
 * The fishing rig on an avatar's held rod (specs/polish/fishing.md; look spec §7.1): the bobber, its rings on the
 * water and the bite's "!", drawn from that avatar's own cast (CharacterMotion.fishing, lib/game/fishingRig.ts),
 * never from "the" player, so a remote angler's cast draws the same way once its state arrives. The bobber leaves
 * the rod's tip on the swing's release key, flies and lands on the water; the landing is announced for the local
 * player (tsi:fish-splash, after the frame: the overlay starts the wait on it). When the cast ends it comes home to
 * the tip (the state's owner clears the cast after HOME_S). Character mounts this inside the rod's held item and
 * steps the puppet first (priority -1), so the tip read here is this frame's. It only reads the cast; refs only in
 * the frame loop, nothing allocated per frame.
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { HOME_S, bobberOnWater, flightAt, flightTime, releaseAfter, type BobberPose, type FishingState } from "@/lib/game/fishingRig";

/** Rings on the water at once (a landing, a nibble or two, the bite). */
const RINGS = 4;
const ringGeometry = new THREE.RingGeometry(0.34, 0.42, 24);
/** Where the "!" sits over the avatar's head (character space). */
const BANG_Y = 2.15;

interface Rig {
  bobber: THREE.Group; rings: THREE.Mesh[]; ringAge: Float32Array; ringBig: Uint8Array; nextRing: number;
  /** The cast drawn last frame, and what has been shown of it. */
  cast: FishingState | null; phase: string; nibble: number; released: boolean; landed: boolean;
  /** Where the bobber left the tip, where it is now, where it was when the cast ended. */
  from: THREE.Vector3; at: THREE.Vector3; homeFrom: THREE.Vector3;
  tip: THREE.Vector3; pose: BobberPose; bangShown: boolean;
}

/**
 * The rod's tip in the model's own space (the blank runs up +y from the grip, art/props-enemies/build_tools.py): its
 * highest point. From the meshes' own transforms up to the model, not the world's (it pops in from scale 0).
 */
function rodTip(model: THREE.Object3D): THREE.Vector3 {
  const tip = new THREE.Vector3(0, 0.7, 0), v = new THREE.Vector3(), rel = new THREE.Matrix4();
  let best = -Infinity;
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    rel.identity();
    for (let n: THREE.Object3D | null = m; n && n !== model; n = n.parent) { n.updateMatrix(); rel.premultiply(n.matrix); }
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(rel);
      if (v.y > best) { best = v.y; tip.copy(v); }
    }
  });
  return tip;
}

export default function FishingRig({ motion, rod }: { motion: RefObject<CharacterMotion>; rod: THREE.Object3D }) {
  const scene = useThree(s => s.scene);
  const tipLocal = useMemo(() => rodTip(rod), [rod]);
  const bangRef = useRef<HTMLDivElement>(null);
  const rig = useMemo<Rig>(() => {
    const bobber = new THREE.Group();
    bobber.name = "Bobber";
    const red = new THREE.MeshStandardMaterial({ color: "#E5484D", roughness: 0.4 }), white = new THREE.MeshStandardMaterial({ color: "#FFFDF5", roughness: 0.5 });
    bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), red));
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), white);
    belly.position.y = -0.045;
    bobber.add(belly);
    bobber.visible = false;
    const rings = Array.from({ length: RINGS }, () => {
      const m = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: "#EAF6FF", transparent: true, opacity: 0.55, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      return m;
    });
    return { bobber, rings, ringAge: new Float32Array(RINGS).fill(-1), ringBig: new Uint8Array(RINGS), nextRing: 0, cast: null, phase: "", nibble: -Infinity,
      released: false, landed: false, from: new THREE.Vector3(), at: new THREE.Vector3(), homeFrom: new THREE.Vector3(), tip: new THREE.Vector3(),
      pose: { x: 0, y: 0, z: 0, under: 0 }, bangShown: false };
  }, []);
  useEffect(() => {
    scene.add(rig.bobber, ...rig.rings);
    return () => {
      scene.remove(rig.bobber, ...rig.rings);
      rig.bobber.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      for (const r of rig.rings) (r.material as THREE.Material).dispose();
    };
  }, [scene, rig]);
  useFrame((_, dt) => step(rig, motion.current, rod, tipLocal, bangRef.current, Math.min(dt, 0.1), performance.now()));
  return <group position={[0, BANG_Y, 0]}>
    {/* The bite's "!" over this avatar: shown and popped from the frame loop (a style write, no React). */}
    <Html center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div ref={bangRef} style={{ display: "none", fontFamily: "var(--font-highlight, sans-serif)", fontSize: 34, fontWeight: 900, color: "#FFFDF5",
        background: "#E5484D", borderRadius: 10, padding: "2px 12px", boxShadow: "0 3px 10px rgba(0,0,0,0.4)" }}>!</div>
    </Html>
  </group>;
}

const BANG_POP: Keyframe[] = [{ transform: "scale(0.2)" }, { transform: "scale(1.3)", offset: 0.6 }, { transform: "scale(1)" }];
const BANG_TIMING: KeyframeAnimationOptions = { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" };

function addRing(r: Rig, big: boolean) {
  const i = r.nextRing;
  r.nextRing = (i + 1) % RINGS;
  r.ringAge[i] = 0;
  r.ringBig[i] = big ? 1 : 0;
}

/** One frame of the rig (module scope: the react compiler freezes values reached through hooks). */
function step(r: Rig, m: Readonly<CharacterMotion> | null, rod: THREE.Object3D, tipLocal: THREE.Vector3, bangEl: HTMLDivElement | null, dt: number, now: number) {
  const f = m?.fishing ?? null;
  stepRings(r, dt);
  const bang = f?.phase === "bite";
  if (bangEl && bang !== r.bangShown) { r.bangShown = bang; bangEl.style.display = bang ? "" : "none"; }
  if (!f) { r.bobber.visible = false; r.cast = null; return; }
  // This frame's tip: the puppet has stepped (Character's frame runs first); bring the rod's matrix up to date.
  rod.updateWorldMatrix(true, false);
  r.tip.copy(tipLocal).applyMatrix4(rod.matrixWorld);
  if (f !== r.cast) { r.cast = f; r.phase = ""; r.nibble = f.nibbleAt; r.released = false; r.landed = false; }
  if (f.phase !== r.phase) {
    if (f.phase === "bite") { addRing(r, true); bangEl?.animate(BANG_POP, BANG_TIMING); }
    if (f.phase === "reelin") r.homeFrom.copy(r.at);
    r.phase = f.phase;
  }
  if (f.nibbleAt !== r.nibble) { r.nibble = f.nibbleAt; addRing(r, false); }
  const t = (now - f.since) / 1000;
  let shown = false;
  if (f.phase === "charging") {
    shown = false;
  } else if (f.phase === "swing") {
    const rel = releaseAfter(f.rate);
    if (t >= rel) {
      if (!r.released) { r.released = true; r.from.copy(r.tip); }
      const k = (t - rel) / flightTime(Math.hypot(f.landX - r.from.x, f.landZ - r.from.z));
      if (k < 1) flightAt(f, r.from.x, r.from.y, r.from.z, k, r.pose);
      else {
        bobberOnWater(f, t, now, r.pose);
        if (!r.landed) land(r, f);
      }
      r.at.set(r.pose.x, r.pose.y, r.pose.z);
      shown = true;
    }
  } else if (f.phase === "reelin") {
    // Home to the tip (from wherever it was: on the water, or still in the air).
    const k = Math.min(1, t / HOME_S), e = k * k;
    r.at.lerpVectors(r.homeFrom, r.tip, e);
    r.at.y += Math.sin(k * Math.PI) * 0.25;
    shown = r.released && k < 1;
  } else {
    if (!r.landed) land(r, f); // joined mid-cast (or the swing was skipped): it is on the water
    bobberOnWater(f, t, now, r.pose);
    // Never a pop between beats: ease to the pose (the plunge is quick).
    const k = 1 - Math.exp(-(f.phase === "bite" ? 30 : 14) * dt);
    r.at.x += (r.pose.x - r.at.x) * k; r.at.y += (r.pose.y - r.at.y) * k; r.at.z += (r.pose.z - r.at.z) * k;
    shown = f.phase !== "landed";
  }
  r.bobber.visible = shown;
  r.bobber.position.copy(r.at);
  for (let i = 0; i < RINGS; i++) r.rings[i].position.set(f.landX, f.waterY + 0.015, f.landZ);
}

/** The bobber touches the water: a ring, and for this client's own cast the overlay's cue. */
function land(r: Rig, f: FishingState) {
  r.landed = true;
  addRing(r, false);
  if (!f.local) return;
  const x = f.landX, y = f.waterY, z = f.landZ;
  queueMicrotask(() => window.dispatchEvent(new CustomEvent("tsi:fish-splash", { detail: { x, y, z } })));
}

function stepRings(r: Rig, dt: number) {
  for (let i = 0; i < RINGS; i++) {
    const m = r.rings[i];
    if (r.ringAge[i] < 0) { m.visible = false; continue; }
    const life = r.ringBig[i] ? 0.85 : 0.6, k = (r.ringAge[i] += dt) / life;
    if (k >= 1) { r.ringAge[i] = -1; m.visible = false; continue; }
    const s = (r.ringBig[i] ? 2.6 : 1.4) * (0.3 + k);
    m.visible = true;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
  }
}
