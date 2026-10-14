"use client";

/**
 * Photo mode's state (specs/v1-drop.md §3, §9): open or not, the camera (orbit or selfie), the filter, the frame, the
 * depth-of-field strength and a frozen pose, shared by the HUD's camera button, the photo UI (components/game/photo),
 * the free camera in the Canvas and the island page (which hides its HUD and holds you still). The camera's live
 * angles aren't React state: `photoRig` is read and written every frame.
 */
import { useSyncExternalStore } from "react";
import * as THREE from "three";
import type { FrameId } from "./photo";

export interface PhotoState {
  open: boolean;
  camera: "orbit" | "selfie";
  filter: string;
  frame: FrameId;
  /** Depth of field, 0 (off) to 1: how soft what's far from you goes. */
  focus: number;
  /** Your pose held still (the animation clock stopped). */
  freeze: boolean;
}
const INITIAL: PhotoState = { open: false, camera: "orbit", filter: "none", frame: "plain", focus: 0.45, freeze: false };

let state: PhotoState = INITIAL;
const listeners = new Set<() => void>();
export function setPhoto(patch: Partial<PhotoState>) {
  const next = { ...state, ...patch };
  if ((Object.keys(next) as (keyof PhotoState)[]).every(k => next[k] === state[k])) return;
  state = next;
  for (const l of listeners) l();
}
export const readPhoto = () => state;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const usePhoto = () => useSyncExternalStore(subscribe, readPhoto, () => INITIAL);
export const usePhotoOpen = () => useSyncExternalStore(subscribe, () => state.open, () => false);

/**
 * The free camera's angles (photo.ts Orbit) and the selfie's swing, eased toward their targets every frame; the point
 * the camera looks at and the depth of field focuses on (you), written by the camera each frame. `ask` is a snap
 * waiting for the next drawn frame.
 */
export const photoRig = {
  yaw: 0, pitch: 0.5, dist: 8, swing: 0,
  target: { yaw: 0, pitch: 0.5, dist: 8, swing: 0 },
  focus: new THREE.Vector3(),
  /** Set by the camera when it takes over, so the first frame starts where the follow camera was. */
  seeded: false,
  ask: null as null | ((canvas: HTMLCanvasElement) => void),
};
