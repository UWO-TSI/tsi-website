"use client";

/**
 * Study glue between the 3D seats (inside the Canvas) and the study HUD (DOM).
 * The HUD owns the one useStudySession(); the seats read it from here and
 * report what the player is near and where this client seated the avatar.
 *
 * Character runtime: `studyPose()` says whether the player sits, studies or
 * stretches, and at which seat; StudySeats turns it into `tsi:sit` clips.
 */
import { useSyncExternalStore } from "react";
import type { ClipName } from "@/lib/game/character/clips";
import type { Phase } from "./rules";
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
/** Seats outrank the island's lowest-priority prompt (fish/forage) while near one or seated. */
export const studyHoldsPrompt = () => !!(state.near || state.seated);
/** Select a stable slice (the whole snapshot changes every HUD render). */
export function useWorldStudy<T>(pick: (s: WorldStudy) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(state));
}

export type StudyPoseName = "sit" | "study" | "stretch";
/** Focus studies, a break stretches at the seat (row 166), anything else just sits. Seat-mates use it too. */
export const poseOf = (phase: Phase | null | undefined): StudyPoseName => phase === "focus" ? "study" : phase === "break" ? "stretch" : "sit";
/** The rig clip for each pose (Stretch is derived from Sit + Cheer until a Blender clip exists). */
export const STUDY_CLIP: Record<StudyPoseName, ClipName> = { sit: "Sit", study: "Study", stretch: "Stretch" };
/** `tsi:sit` detail for a study seat: the measured seat top, the seat's facing and this phase's clip. */
export const sitDetail = (seat: WorldSeat, phase: Phase | null | undefined) =>
  ({ x: seat.x, z: seat.z, clip: STUDY_CLIP[poseOf(phase)], seatY: seat.y, yaw: seat.facing });

/** Snap the avatar into a seat (PlayerAvatar's `tsi:sit`) and remember it for walk-away. */
export function seatAvatar(seat: WorldSeat) {
  window.dispatchEvent(new CustomEvent("tsi:sit", { detail: sitDetail(seat, state.study?.session?.phase) }));
  setWorldStudy({ seated: seat });
}

export type StudyPose = { pose: StudyPoseName; seat: WorldSeat } | null;
export function studyPose(s: WorldStudy = state): StudyPose {
  const phase = s.study?.session?.phase;
  if (!s.seated || !phase || phase === "ended") return null;
  return { pose: poseOf(phase), seat: s.seated };
}
