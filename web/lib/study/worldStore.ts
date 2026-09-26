"use client";

/**
 * Study glue between the 3D seats (inside the Canvas) and the study HUD (DOM).
 * The HUD owns the one useStudySession(); the seats read it from here and
 * report what the player is near and where this client seated the avatar.
 *
 * Character runtime: `studyPose()` (or `useStudyPose()`) says whether the
 * player sits, studies or stretches, and at which seat (x, z, facing).
 */
import { useSyncExternalStore } from "react";
import type { WorldSeat } from "./seats";
import type { StudyHook } from "./useStudySession";

export interface WorldStudy {
  study: StudyHook | null;
  /** What the prompt offers: a seat, or the cafe wall board. */
  near: WorldSeat | "board" | null;
  /** The seat this client put the avatar in (walk-away is measured from it). */
  seated: WorldSeat | null;
}

let state: WorldStudy = { study: null, near: null, seated: null };
const subs = new Set<() => void>();
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const getWorldStudy = () => state;
export function setWorldStudy(patch: Partial<WorldStudy>) {
  state = { ...state, ...patch };
  subs.forEach(f => f());
}
/** Select a stable slice (the whole snapshot changes every HUD render). */
export function useWorldStudy<T>(pick: (s: WorldStudy) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(state));
}

/** Snap the avatar into a seat (PlayerAvatar's `tsi:sit`) and remember it for walk-away. */
export function seatAvatar(seat: WorldSeat) {
  window.dispatchEvent(new CustomEvent("tsi:sit", { detail: { x: seat.x, z: seat.z } }));
  setWorldStudy({ seated: seat });
}

export type StudyPose = { pose: "sit" | "study" | "stretch"; seat: WorldSeat } | null;
export function studyPose(s: WorldStudy = state): StudyPose {
  const phase = s.study?.session?.phase;
  if (!s.seated || !phase || phase === "ended") return null;
  return { pose: phase === "focus" ? "study" : phase === "break" ? "stretch" : "sit", seat: s.seated };
}
export const useStudyPose = () => useWorldStudy(s => studyPose(s)?.pose ?? null);
