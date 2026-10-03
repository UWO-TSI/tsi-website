"use client";

/**
 * The fishing rig on an avatar's held rod (specs/polish/fishing.md; look spec §7.1): the bobber, its line, the
 * water's answer and the bite's "!", drawn from that avatar's own cast (CharacterMotion.fishing, lib/game/
 * fishingRig.ts), never from "the" player, so a remote angler's cast draws the same way once its state arrives.
 *
 * The bobber (our low-poly matte float, art/props-enemies/build_bobber.py) hangs from the rod's tip on a short line
 * while you wind up, swinging with the rod; it leaves on the swing's release key, tumbles through its arc and lands
 * with drops and rings drawn as water (lib/game/fx/fishingFx.ts, our painted pack). It bobs and leans to its line, a
 * nibble tugs it under with a small ring, the bite pulls it down in a crown of water, the fish drags it about leaving
 * rings in its wake, a catch comes out in a bigger crown, an escape swirls off. The line (lib/game/fishingLine.ts;
 * Settings can turn it off, fishingPrefs.ts) runs from the tip to the bobber's eye: hanging slack and swaying with the
 * world's wind as it floats, tight and humming while a fish pulls, twanging slack when one gets away; a thin ribbon
 * kept about a pixel wide at any distance. The landing is announced for the local player (tsi:fish-splash, after
 * the frame: the overlay starts the wait on it). A catch comes out of the water at the bobber in a crown and flies to
 * the angler: held up in both hands at the chin, side on to the camera (the cast's showOff, Hold up my catch), or
 * turning over its head; when its card closes it is tucked away into the bag. The species' model loads while the
 * fish is on the line. When the cast ends the bobber comes home to the tip (the state's owner clears the cast after
 * HOME_S).
 *
 * Character mounts this inside the rod's held item and steps the puppet first (priority -1), so the tip read here is
 * this frame's. It only reads the cast; refs only in the frame loop, nothing allocated per frame.
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { HOME_S, bobberOnWater, flightAt, flightTime, releaseAfter, type BobberPose, type FishingState } from "@/lib/game/fishingRig";
import { LINE_POINTS, lineCurve, lineTarget, type LineLook } from "@/lib/game/fishingLine";
import { readFishingLine } from "@/lib/game/fishingPrefs";
import { bobberBobs, bobberLands, bobberNibbled, fishBites, fishFlees, fishLeaps, reelWake } from "@/lib/game/fx/fishingFx";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { liveWind, useMoveParticles } from "../movement/moveFx";

export const BOBBER_URL = "/assets/game/tools/bobber.glb";
useGLTF.preload(BOBBER_URL);
/** Where the "!" sits over the avatar's head (character space). */
const BANG_Y = 2.1;
/** A faint ring as it floats, this often (s); rings in the reel's wake no closer than this (s) and this far (u) apart. */
const BOB_EVERY = 1.7, WAKE_EVERY = 0.14, WAKE_STEP = 0.05;
/** The bobber's eye, where the line is tied (build_bobber.py `line_eye`, in its own space). */
const EYE = new THREE.Vector3(0, 0.118, 0);
/** How far the bobber hangs below the tip while you wind up (u), and the line's width on screen (drawing-buffer pixels). */
const DANGLE = 0.34, LINE_PX = 1.2;
const UP = new THREE.Vector3(0, 1, 0);
/** A catch's flight from the water to the angler, and its tuck into the bag when its card closes (s). */
const CATCH_FLY_S = 0.45, TUCK_S = 0.32;
/**
 * Holding a catch up: the pipeline's fish hang along their own +y with the back toward -z (art: the dump's calibration),
 * so this lays the length across the hands (x), the back up, the flank to the camera.
 */
const HOLD = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
/** A catch's length in the world by its size: small fish read small, the giants big, all of them holdable. */
const catchLength = (cm: number | null) => Math.min(1.1, Math.max(0.5, 0.45 + 0.05 * Math.sqrt(cm ?? 30)));

interface Rig {
  bobber: THREE.Object3D; line: THREE.Mesh; linePos: THREE.BufferAttribute; lineNormal: THREE.BufferAttribute; curve: Float32Array;
  /** The cast drawn last frame, and what has been shown of it. */
  cast: FishingState | null; phase: string; nibble: number; nibbles: number; released: boolean; landed: boolean;
  /** Where the bobber left the tip, where it is now, where it was a frame ago and when the cast ended. */
  from: THREE.Vector3; at: THREE.Vector3; last: THREE.Vector3; homeFrom: THREE.Vector3;
  /** The bobber hanging from the tip while you wind up (its eye, swinging on the line), and a frame ago. */
  dangle: THREE.Vector3; danglePrev: THREE.Vector3;
  tip: THREE.Vector3; eye: THREE.Vector3; pose: BobberPose; bangShown: boolean;
  /** The float's next faint ring and the wake's last ring (s into the beat), and how many of each so far (their seeds). */
  bobAt: number; bobs: number; wakeAt: number; wakes: number; wakeFrom: THREE.Vector3;
  /** The line's look now, eased toward the beat's. */
  look: LineLook; want: LineLook;
  axis: THREE.Vector3; lean: THREE.Quaternion; wobble: THREE.Quaternion; euler: THREE.Euler;
  /** The catch: its holder in the world, the species model loaded for it (its length across), and where it flew from. */
  fish: THREE.Group; fishUrl: string | null; fishModel: THREE.Object3D | null; fishLength: number; fishFrom: THREE.Vector3; fishTo: THREE.Vector3; fishQ: THREE.Quaternion;
  /** The catch is out of the water (shown, until it is tucked away). */
  fishOut: boolean;
}

const fishLoader = new GLTFLoader();
const fishScenes = new Map<string, Promise<THREE.Object3D>>();
/** A species' model, loaded once (the fish GLBs need no decoders). */
function loadFish(url: string): Promise<THREE.Object3D> {
  let p = fishScenes.get(url);
  if (!p) {
    p = fishLoader.loadAsync(url).then(g => g.scene);
    fishScenes.set(url, p);
    p.catch(() => fishScenes.delete(url));
  }
  return p;
}
/** A catch ready to hold: a clone of the species (a skinned clone for the dump's rigged fish), calibrated, centred. */
function prepareFish(scene: THREE.Object3D, url: string, raw: boolean): { root: THREE.Object3D; length: number } {
  const inner = tagLookClasses(cloneSkeleton(scene), url), calib = new THREE.Group(), root = new THREE.Group();
  calib.add(inner);
  if (raw) calib.rotation.x = Math.PI / 2; // the dump's raw exports: the game calibration (they come in 10x, z forward)
  calib.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(calib), size = box.getSize(new THREE.Vector3());
  calib.position.copy(box.getCenter(new THREE.Vector3())).negate();
  root.add(calib);
  inner.traverse(o => { o.castShadow = true; o.userData.sunCaster = "dynamic"; o.frustumCulled = false; });
  return { root, length: Math.max(size.x, size.y, size.z, 1e-3) };
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

/** The line: a ribbon of LINE_POINTS pairs, matte and pale like the rods' own line (build_tools.py). */
function makeLine() {
  const g = new THREE.BufferGeometry(), n = LINE_POINTS;
  const pos = new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const nor = new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setAttribute("position", pos);
  g.setAttribute("normal", nor);
  g.setIndex(index);
  const line = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: "FishingLine", color: "#f3efe2", roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  line.name = "FishingLine";
  line.frustumCulled = false; // placed every frame
  line.visible = false;
  return { line, pos, nor };
}

export default function FishingRig({ motion, rod, hands }: { motion: RefObject<CharacterMotion>; rod: THREE.Object3D; hands: { R: THREE.Object3D; L: THREE.Object3D } }) {
  const scene = useThree(s => s.scene);
  const { scene: model } = useGLTF(BOBBER_URL);
  const particles = useMoveParticles();
  const tipLocal = useMemo(() => rodTip(rod), [rod]);
  const bangRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<THREE.Group>(null);
  const rig = useMemo<Rig>(() => {
    const bobber = tagLookClasses(model.clone(true), BOBBER_URL);
    bobber.name = "Bobber";
    bobber.traverse(o => { o.castShadow = true; o.userData.sunCaster = "dynamic"; });
    bobber.visible = false;
    const { line, pos, nor } = makeLine();
    return { bobber, line, linePos: pos, lineNormal: nor, curve: new Float32Array(LINE_POINTS * 3),
      cast: null, phase: "", nibble: -Infinity, nibbles: 0, released: false, landed: false,
      from: new THREE.Vector3(), at: new THREE.Vector3(), last: new THREE.Vector3(), homeFrom: new THREE.Vector3(),
      dangle: new THREE.Vector3(), danglePrev: new THREE.Vector3(), tip: new THREE.Vector3(), eye: new THREE.Vector3(),
      pose: { x: 0, y: 0, z: 0, under: 0 }, bangShown: false, bobAt: 0, bobs: 0, wakeAt: 0, wakes: 0, wakeFrom: new THREE.Vector3(),
      look: { sag: 0.02, sway: 0, wave: 0, hum: 0 }, want: { sag: 0.02, sway: 0, wave: 0, hum: 0 },
      axis: new THREE.Vector3(), lean: new THREE.Quaternion(), wobble: new THREE.Quaternion(), euler: new THREE.Euler(),
      fish: Object.assign(new THREE.Group(), { name: "Catch", visible: false }), fishUrl: null, fishModel: null, fishLength: 1,
      fishFrom: new THREE.Vector3(), fishTo: new THREE.Vector3(), fishQ: new THREE.Quaternion(), fishOut: false };
  }, [model]);
  useEffect(() => {
    scene.add(rig.bobber, rig.line, rig.fish);
    return () => {
      scene.remove(rig.bobber, rig.line, rig.fish);
      rig.line.geometry.dispose();
      (rig.line.material as THREE.Material).dispose();
    };
  }, [scene, rig]);
  useFrame((state, dt) => {
    const now = performance.now();
    step(rig, motion.current, rod, tipLocal, bangRef.current, particles.pool, state.camera, state.gl.domElement.height, Math.min(dt, 0.1), now);
    showCatch(rig, motion.current, hands, headRef.current, now);
  });
  return <group ref={headRef} position={[0, BANG_Y, 0]}>
    {/* The bite's "!" over this avatar in the paper kit (components/gui): shown and popped from the frame loop, no React. */}
    <Html center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div ref={bangRef} aria-hidden style={BANG_STYLE}>!</div>
    </Html>
  </group>;
}

/** The bite's "!": a paper bubble with a coral mark (the GUI sheet's tokens, plain values outside its scope). */
export const BANG_STYLE: React.CSSProperties = {
  display: "none", width: 44, height: 44, lineHeight: "44px", textAlign: "center", borderRadius: "46% 50% 44% 48% / 54% 50% 46% 52%",
  fontFamily: "var(--gui-font, var(--font-highlight, sans-serif))", fontSize: 30, fontWeight: 900, color: "var(--gui-coral-ink, #b4513a)",
  background: "var(--gui-paper-hi, #fffff7)", boxShadow: "0 3px 0 rgb(114 92 78 / 0.18), 0 10px 22px rgb(79 63 49 / 0.18), inset 0 0 0 2.5px var(--gui-coral, #e2826a)",
};
export const BANG_POP: Keyframe[] = [{ transform: "translateY(10px) scale(0.2) rotate(-14deg)" }, { transform: "translateY(-6px) scale(1.25) rotate(6deg)", offset: 0.55 }, { transform: "translateY(0) scale(1) rotate(-3deg)" }];
export const BANG_TIMING: KeyframeAnimationOptions = { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" };

/** One frame of the rig (module scope: the react compiler freezes values reached through hooks). */
function step(r: Rig, m: Readonly<CharacterMotion> | null, rod: THREE.Object3D, tipLocal: THREE.Vector3, bangEl: HTMLDivElement | null, pool: ParticlePool,
  camera: THREE.Camera, bufferHeight: number, dt: number, now: number) {
  const f = m?.fishing ?? null;
  const bang = f?.phase === "bite";
  if (bangEl && bang !== r.bangShown) { r.bangShown = bang; bangEl.style.display = bang ? "" : "none"; if (bang) bangEl.animate(BANG_POP, BANG_TIMING); }
  if (!f) { r.bobber.visible = false; r.line.visible = false; r.cast = null; return; }
  const lineOn = readFishingLine();
  // This frame's tip: the puppet has stepped (Character's frame runs first); bring the rod's matrix up to date.
  rod.updateWorldMatrix(true, false);
  r.tip.copy(tipLocal).applyMatrix4(rod.matrixWorld);
  if (f !== r.cast) {
    r.cast = f; r.phase = ""; r.nibble = f.nibbleAt; r.nibbles = 0; r.released = false; r.landed = false;
    r.dangle.set(r.tip.x, r.tip.y - DANGLE, r.tip.z); r.danglePrev.copy(r.dangle); r.at.copy(r.dangle).sub(EYE);
  }
  r.last.copy(r.at);
  const t = (now - f.since) / 1000;
  if (f.phase !== r.phase) {
    const prev = r.phase;
    r.phase = f.phase;
    if (f.phase === "bite") fishBites(pool, r.at.x, f.waterY, r.at.z);
    if (f.phase === "reel") { r.wakeAt = 0; r.wakeFrom.copy(r.at); }
    if (f.phase === "landed" && r.landed) fishLeaps(pool, r.at.x, f.waterY, r.at.z);
    if (f.phase === "escaped" && r.landed) {
      if (f.snapped) fishFlees(pool, r.at.x, f.waterY, r.at.z, f.pull >= 0 ? -f.dirZ : f.dirZ, f.pull >= 0 ? f.dirX : -f.dirX);
      else bobberNibbled(pool, r.at.x, f.waterY, r.at.z, 99);
    }
    // Home from where it was; after a catch it came out with the fish (it is already at the hands).
    if (f.phase === "reelin") r.homeFrom.copy(prev === "landed" ? r.tip : r.at);
    r.bobAt = BOB_EVERY;
  }
  if (f.nibbleAt !== r.nibble) { r.nibble = f.nibbleAt; if (r.landed) bobberNibbled(pool, r.at.x, f.waterY, r.at.z, ++r.nibbles); }
  let shown = false, hanging = false, flying = false, lean = 0, wx = 0, wz = 0;
  const rel = releaseAfter(f.rate);
  if (f.phase === "charging" || (f.phase === "swing" && t < rel)) {
    // Hanging from the tip on a short line, swinging as the rod moves (a rope on a point; the line off: not drawn yet).
    hang(r, dt);
    hanging = shown = lineOn;
  } else if (f.phase === "swing") {
    if (!r.released) { r.released = true; r.from.copy(lineOn ? r.at : r.tip); }
    const k = (t - rel) / flightTime(Math.hypot(f.landX - r.from.x, f.landZ - r.from.z));
    if (k < 1) {
      flightAt(f, r.from.x, r.from.y, r.from.z, k, r.pose);
      wx = k * 5.5; wz = Math.sin(k * 3) * 0.5; // tumbling through the air
      flying = true;
    } else {
      if (!r.landed) land(r, f, pool);
      bobberOnWater(f, t, now, r.pose);
      floatTilt(f, t, now); lean = TILT.lean; wx = TILT.wx; wz = TILT.wz;
    }
    r.at.set(r.pose.x, r.pose.y, r.pose.z);
    shown = true;
  } else if (f.phase === "reelin") {
    // Home to the tip (from wherever it was: on the water, or still in the air), turning over as it comes.
    const k = Math.min(1, t / HOME_S), e = k * k;
    r.at.lerpVectors(r.homeFrom, r.tip, e);
    r.at.y += Math.sin(k * Math.PI) * 0.25;
    wx = -k * 4;
    shown = r.released && k < 1;
  } else {
    if (!r.landed) land(r, f, pool); // joined mid-cast (or the swing was skipped): it is on the water
    bobberOnWater(f, t, now, r.pose);
    // Never a pop between beats: ease to the pose (the plunge is quick).
    const k = 1 - Math.exp(-(f.phase === "bite" ? 30 : 14) * dt);
    r.at.x += (r.pose.x - r.at.x) * k; r.at.y += (r.pose.y - r.at.y) * k; r.at.z += (r.pose.z - r.at.z) * k;
    shown = f.phase !== "landed";
    if (f.phase === "bite" || f.phase === "reel") {
      // Pulled under and over toward the fish, shaking.
      lean = 0.55 + 0.12 * Math.sin(t * 17);
      wx = 0.18 * Math.sin(t * 23); wz = 0.18 * Math.sin(t * 19 + 1);
    } else { floatTilt(f, t, now); lean = TILT.lean; wx = TILT.wx; wz = TILT.wz; }
  }
  // The water's answer as it floats and as it's dragged.
  if (shown && r.landed && (f.phase === "float" || f.phase === "escaped" || (f.phase === "swing" && !flying))) {
    if (t >= r.bobAt) { r.bobAt = t + BOB_EVERY; bobberBobs(pool, r.at.x, f.waterY, r.at.z, ++r.bobs); }
  }
  if (f.phase === "reel") {
    const moved = Math.hypot(r.at.x - r.wakeFrom.x, r.at.z - r.wakeFrom.z);
    if (t - r.wakeAt >= WAKE_EVERY && moved >= WAKE_STEP) {
      const vx = (r.at.x - r.last.x) / Math.max(dt, 1e-3), vz = (r.at.z - r.last.z) / Math.max(dt, 1e-3);
      reelWake(pool, r.at.x, f.waterY, r.at.z, vx, vz, ++r.wakes, Math.hypot(vx, vz) > 1.1);
      r.wakeAt = t; r.wakeFrom.copy(r.at);
    }
  }
  r.bobber.visible = shown;
  r.bobber.position.copy(r.at);
  if (hanging) {
    // Hung by its eye: its top points up the line to the tip.
    r.bobber.quaternion.setFromUnitVectors(UP, r.axis.subVectors(r.tip, r.dangle).normalize());
  } else {
    // Upright on the water, leaning to its line (toward the angler) and across with the fish; wobbling as it rides.
    const across = f.phase === "reel" ? f.pull * 0.8 : 0;
    const lx = -f.dirX - f.dirZ * across, lz = -f.dirZ + f.dirX * across, ll = Math.hypot(lx, lz) || 1;
    r.lean.setFromAxisAngle(r.axis.set(lz / ll, 0, -lx / ll), lean);
    r.bobber.quaternion.copy(r.lean).multiply(r.wobble.setFromEuler(r.euler.set(wx, 0, wz)));
  }
  // The line, from the tip to the bobber's eye while the bobber is out.
  r.line.visible = lineOn && shown;
  if (r.line.visible) {
    r.eye.copy(EYE).applyQuaternion(r.bobber.quaternion).add(r.at);
    lineTarget(f.phase, f.tension, now - f.nibbleAt < 420, f.snapped, r.want);
    if (flying) r.want.sag = 0.07; // paying out behind the bobber as it flies
    const k = 1 - Math.exp(-8 * dt);
    r.look.sag += (r.want.sag - r.look.sag) * k; r.look.sway += (r.want.sway - r.look.sway) * k;
    r.look.hum += (r.want.hum - r.look.hum) * k;
    // A twang starts at once and dies away.
    r.look.wave = r.want.wave > r.look.wave ? r.want.wave : r.look.wave * Math.exp(-4 * dt);
    const wind = liveWind();
    lineCurve(r.tip.x, r.tip.y, r.tip.z, r.eye.x, r.eye.y, r.eye.z, r.look, wind.x, wind.z, t, f.waterY, r.curve);
    ribbon(r, camera, bufferHeight);
  }
}

const TILT = { lean: 0, wx: 0, wz: 0 };
/** Floating (into TILT): a gentle wobble, leaning to the line; a nibble tugs it over as it dips. */
function floatTilt(f: FishingState, t: number, now: number) {
  const since = (now - f.nibbleAt) / 1000, tug = since >= 0 && since < 0.42 ? Math.sin((since / 0.42) * Math.PI) : 0;
  TILT.lean = 0.1 + 0.5 * tug; TILT.wx = 0.06 * Math.sin(t * 2.1); TILT.wz = 0.06 * Math.sin(t * 1.7 + 1);
}

const handR = new THREE.Vector3(), handL = new THREE.Vector3(), facing = new THREE.Quaternion(), head = new THREE.Vector3();
/**
 * The catch (module scope, see step): its model loads while it's on the line; once landed it flies from the water to
 * the angler's hands (held up, side on) or over the head (turning), and when its card closes it is tucked away.
 */
function showCatch(r: Rig, m: Readonly<CharacterMotion> | null, hands: { R: THREE.Object3D; L: THREE.Object3D }, headGroup: THREE.Group | null, now: number) {
  const f = m?.fishing ?? null;
  const url = f?.catchModel ?? null;
  if (url !== r.fishUrl) {
    // A new catch on the line: drop the last one, load this one (off the frame: it joins the holder when ready).
    r.fishUrl = url;
    if (r.fishModel) { r.fish.remove(r.fishModel); r.fishModel = null; }
    if (url) {
      const raw = !!f?.catchRaw;
      void loadFish(url).then(sceneOf => {
        if (r.fishUrl !== url) return;
        const { root, length } = prepareFish(sceneOf, url, raw);
        r.fishModel = root; r.fishLength = length;
        r.fish.add(root);
      }).catch(() => { /* a model that fails to load: the card still says what it was */ });
    }
  }
  const landed = f?.phase === "landed", tucking = f?.phase === "reelin" && r.fishOut;
  if (!f || !r.fishModel || !headGroup || (!landed && !tucking)) {
    r.fish.visible = false;
    if (f?.phase !== "reelin") r.fishOut = false;
    return;
  }
  const t = (now - f.since) / 1000;
  if (landed && !r.fishOut) { r.fishOut = true; r.fishFrom.copy(r.at).setY(f.waterY); }
  headGroup.getWorldQuaternion(facing);
  headGroup.getWorldPosition(head);
  const len = catchLength(f.catchCm), scale = len / r.fishLength;
  if (f.showOff) {
    // Between the hands at the chin, a little out in front, laid across them with its flank to the camera.
    hands.R.getWorldPosition(handR); hands.L.getWorldPosition(handL);
    r.fishTo.addVectors(handR, handL).multiplyScalar(0.5);
    r.fishTo.x += Math.sin(m!.yaw) * 0.05; r.fishTo.z += Math.cos(m!.yaw) * 0.05;
    r.fishQ.copy(facing).multiply(HOLD);
  } else {
    // Over the head, turning slowly and bobbing (the hold-up off).
    r.fishTo.copy(head).y -= 0.2;
    r.fishTo.y += Math.sin(t * 3) * 0.04;
    r.fishQ.setFromAxisAngle(UP, t * 1.6);
  }
  if (landed) {
    // Out of the water and into the hands (or up over the head) on an arc, growing to its size.
    const k = Math.min(1, t / CATCH_FLY_S), e = 1 - (1 - k) * (1 - k);
    r.fish.position.lerpVectors(r.fishFrom, r.fishTo, e);
    r.fish.position.y += Math.sin(k * Math.PI) * 0.7;
    r.fish.quaternion.copy(r.fishQ);
    r.fish.scale.setScalar(scale * (0.55 + 0.45 * e));
  } else {
    // Tucked away into the bag as the card closes: in toward the chest, shrinking.
    const k = Math.min(1, t / TUCK_S);
    r.fish.position.lerp(head.set(head.x, head.y - 1.3, head.z), k * 0.35);
    r.fish.scale.setScalar(scale * (1 - k) * (1 - k));
    if (k >= 1) { r.fishOut = false; r.fish.visible = false; return; }
  }
  r.fish.visible = true;
}

const pull = new THREE.Vector3();
/** The bobber on its short line under the tip: it keeps its swing (damped), falls, and the line holds it at DANGLE. */
function hang(r: Rig, dt: number) {
  const d = r.dangle, p = r.danglePrev, damp = Math.exp(-2.2 * dt);
  const vx = (d.x - p.x) * damp, vy = (d.y - p.y) * damp, vz = (d.z - p.z) * damp;
  p.copy(d);
  d.x += vx; d.y += vy - 9.8 * dt * dt; d.z += vz;
  pull.subVectors(d, r.tip);
  const len = pull.length();
  if (len > DANGLE) d.copy(r.tip).addScaledVector(pull, DANGLE / len);
  // Its eye is the dangle point; the body hangs below it, along the line.
  r.at.copy(d).addScaledVector(pull, EYE.y / Math.max(len, 1e-6));
}

const p0 = new THREE.Vector3(), tan = new THREE.Vector3(), toCam = new THREE.Vector3(), side = new THREE.Vector3(), camAt = new THREE.Vector3();
/** The line's points as a ribbon facing the camera, about LINE_PX buffer pixels wide wherever it is. */
function ribbon(r: Rig, camera: THREE.Camera, bufferHeight: number) {
  const c = r.curve, pos = r.linePos.array as Float32Array, nor = r.lineNormal.array as Float32Array, n = LINE_POINTS;
  camera.getWorldPosition(camAt);
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera).fov : 48;
  const perPx = (2 * Math.tan((fov * Math.PI) / 360)) / Math.max(1, bufferHeight);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
    p0.set(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]);
    tan.set(c[b] - c[a], c[b + 1] - c[a + 1], c[b + 2] - c[a + 2]).normalize();
    toCam.subVectors(camAt, p0);
    const dist = toCam.length();
    toCam.divideScalar(dist || 1);
    side.crossVectors(tan, toCam).normalize().multiplyScalar(0.5 * LINE_PX * dist * perPx);
    const q = i * 6;
    pos[q] = p0.x - side.x; pos[q + 1] = p0.y - side.y; pos[q + 2] = p0.z - side.z;
    pos[q + 3] = p0.x + side.x; pos[q + 4] = p0.y + side.y; pos[q + 5] = p0.z + side.z;
    nor[q] = nor[q + 3] = toCam.x; nor[q + 1] = nor[q + 4] = toCam.y; nor[q + 2] = nor[q + 5] = toCam.z;
  }
  r.linePos.needsUpdate = true;
  r.lineNormal.needsUpdate = true;
}

/** The bobber touches the water: drops and rings, and for this client's own cast the overlay's cue. */
function land(r: Rig, f: FishingState, pool: ParticlePool) {
  r.landed = true;
  bobberLands(pool, f.landX, f.waterY, f.landZ, 0.8 + 0.4 * f.power);
  if (!f.local) return;
  const x = f.landX, y = f.waterY, z = f.landZ;
  queueMicrotask(() => window.dispatchEvent(new CustomEvent("tsi:fish-splash", { detail: { x, y, z } })));
}
