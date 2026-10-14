"use client";

/**
 * Photo mode's free camera (specs/v1-drop.md §3), inside the island's Canvas, mounted only while photo mode is open:
 * so its frame runs after the follow camera's (both at the default priority, this one registered last) and takes the
 * camera over. It orbits round you: drag to orbit and tilt, scroll or pinch to zoom, the arrow keys too; the selfie
 * camera stands at arm's length in front of you, looking back at your face, and a drag swings it a little round you.
 * The orbit stops short of a building in the way (the scene's occluders, a spring arm) and stays above your feet.
 * It writes the point the depth of field focuses on (photoRig.focus), and takes the snap straight after a frame is
 * drawn (photoRig.ask). It starts where the follow camera was, so opening doesn't jump.
 */
import { useEffect, type RefObject } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clampOrbit, firstHit, orbitPose, selfiePose } from "@/lib/game/photo";
import { worldLabels } from "@/lib/game/labelLayout";
import { photoRig, readPhoto } from "@/lib/game/photoMode";
import { localAvatar } from "@/lib/net/localAvatar";

/** Over your middle (orbit) and at your eyes (selfie). */
const CHEST = 1.0, HEAD = 1.35;
const DRAG = 0.0055, WHEEL = 0.0012, KEY_RATE = 1.4, EASE = 12;

const at = new THREE.Vector3(), pos = new THREE.Vector3(), look = new THREE.Vector3(), head = new THREE.Vector3();
/** The camera keys held now (one photo camera at a time). */
const keys = new Set<string>();

/** Start where the follow camera is: its angles and distance round the point we'll orbit. */
function seed(camera: THREE.Camera, you: THREE.Vector3) {
  at.set(you.x, you.y + CHEST, you.z);
  const d = camera.position.clone().sub(at), dist = d.length();
  const o = clampOrbit({ yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y / Math.max(dist, 1e-6), -1, 1)), dist });
  Object.assign(photoRig, o, { swing: 0 });
  Object.assign(photoRig.target, o, { swing: 0 });
  photoRig.seeded = true;
}

/** One frame: ease toward the wanted angles, then place the camera (module scope: no closure per frame). */
function frame(camera: THREE.Camera, you: THREE.Vector3, dt: number) {
  const t = photoRig.target, selfie = readPhoto().camera === "selfie";
  // The arrow keys orbit and tilt, + and − zoom.
  if (keys.size) {
    const k = KEY_RATE * dt;
    if (keys.has("arrowleft")) { t.yaw -= k; t.swing -= k; }
    if (keys.has("arrowright")) { t.yaw += k; t.swing += k; }
    if (keys.has("arrowup")) t.pitch += k * 0.6;
    if (keys.has("arrowdown")) t.pitch -= k * 0.6;
    if (keys.has("=") || keys.has("+")) t.dist -= k * 4;
    if (keys.has("-")) t.dist += k * 4;
  }
  Object.assign(t, clampOrbit(t));
  t.swing = THREE.MathUtils.clamp(t.swing, -0.9, 0.9);
  const e = 1 - Math.exp(-EASE * dt);
  // The shortest way round for the yaw.
  photoRig.yaw += Math.atan2(Math.sin(t.yaw - photoRig.yaw), Math.cos(t.yaw - photoRig.yaw)) * e;
  photoRig.pitch += (t.pitch - photoRig.pitch) * e;
  photoRig.dist += (t.dist - photoRig.dist) * e;
  photoRig.swing += (t.swing - photoRig.swing) * e;
  if (selfie) {
    head.set(you.x, you.y + HEAD, you.z);
    selfiePose(head, localAvatar()?.motion.current?.yaw ?? 0, photoRig.swing, pos, look);
    photoRig.focus.copy(head);
  } else {
    at.set(you.x, you.y + CHEST, you.z);
    orbitPose(at, photoRig.yaw, photoRig.pitch, photoRig.dist, pos);
    // A spring arm: stop short of a building between you and the camera, and keep above your feet.
    const hit = firstHit(at, pos, worldLabels.occluderList);
    if (hit < 1) pos.lerpVectors(at, pos, Math.max(0.12, hit - 0.35 / Math.max(photoRig.dist, 1e-3)));
    pos.y = Math.max(pos.y, you.y + 0.25);
    look.copy(at);
    photoRig.focus.copy(at);
  }
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.updateMatrixWorld();
}

export default function PhotoCamera({ player }: { player: RefObject<THREE.Vector3> }) {
  const camera = useThree(s => s.camera), gl = useThree(s => s.gl), get = useThree(s => s.get);
  // Pointer, wheel and keys while open; the snap after a drawn frame.
  useEffect(() => {
    photoRig.seeded = false;
    const el = gl.domElement, touches = new Map<number, { x: number; y: number }>();
    keys.clear();
    let pinch = 0;
    const t = photoRig.target;
    const down = (e: PointerEvent) => {
      // Ours alone: no tool used, no walk, no tap on the world while you frame a photo.
      e.stopImmediatePropagation();
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const move = (e: PointerEvent) => {
      const was = touches.get(e.pointerId);
      if (!was) return;
      e.stopImmediatePropagation();
      if (touches.size === 2) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) t.dist *= pinch / Math.max(1, d);
        pinch = d;
        return;
      }
      const dx = e.clientX - was.x, dy = e.clientY - was.y;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      t.yaw -= dx * DRAG; t.swing -= dx * DRAG;
      t.pitch += dy * DRAG;
    };
    const up = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopImmediatePropagation(); t.dist *= Math.exp(e.deltaY * WHEEL); };
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "=", "+", "-"].includes(k)) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (e.type === "keydown") { keys.add(k); e.preventDefault(); } else keys.delete(k);
    };
    const blur = () => keys.clear();
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerup", up, true);
    el.addEventListener("pointercancel", up, true);
    el.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    // Straight after a frame is drawn: what the canvas shows now goes to the snap.
    const off = addAfterEffect(() => {
      const ask = photoRig.ask;
      if (!ask) return;
      photoRig.ask = null;
      ask(get().gl.domElement);
    });
    return () => {
      keys.clear();
      off();
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerup", up, true);
      el.removeEventListener("pointercancel", up, true);
      el.removeEventListener("wheel", wheel, { capture: true } as EventListenerOptions);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
      photoRig.ask = null;
    };
  }, [gl, get]);
  useFrame((_, delta) => {
    const you = player.current;
    if (!photoRig.seeded) seed(camera, you);
    frame(camera, you, Math.min(delta, 0.1));
  });
  return null;
}
