"use client";

/**
 * Dev-lab override store (/lab benches, 2026-07-22).
 *
 * A module-scope store the game reads through tiny accessors:
 *   - getLabHour()    → TimeOfDayCycle + useTodPhase (scrub the sky live)
 *   - getLabPalette() → useActivePalette (preview palettes without drafts)
 *   - grade overrides → PostFX pastel-grade uniforms (the open AC verdict)
 *
 * Every accessor hard no-ops in production builds (NODE_ENV guard — the
 * bundler inlines it), so lab state can never leak into tethos.ca even if
 * something imports a setter. Reactive via useSyncExternalStore: snapshot
 * is cached and only replaced on emit (same pattern as the audio manager).
 */

import { useSyncExternalStore } from "react";
import type { SeasonalPalette } from "./contentTypes";
import type { Grade } from "./grading";

export type LabPaletteColors = SeasonalPalette["palette"];

/** Full color grade override — see lib/game/grading.ts. */
export type LabGrade = Grade;

export interface LabState {
  hour: number | null;               // 0-24 fractional; null = wall clock
  palette: LabPaletteColors | null;  // null = live/active palette
  grade: LabGrade | null;            // null = shipped grade constants
  fov: number | null;                // base FOV override (ship 48); null = game logic
}

const IS_DEV = process.env.NODE_ENV !== "production";
const EMPTY: LabState = { hour: null, palette: null, grade: null, fov: null };

const state: LabState = { hour: null, palette: null, grade: null, fov: null };
let snapshot: LabState = { ...state };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...state };
  listeners.forEach((l) => l());
}

export function labSubscribe(cb: () => void): () => void {
  if (!IS_DEV) return () => {};
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const getLabSnapshot = (): LabState => (IS_DEV ? snapshot : EMPTY);
export const getLabServerSnapshot = (): LabState => EMPTY;

export function getLabHour(): number | null {
  return IS_DEV ? state.hour : null;
}
export function getLabPalette(): LabPaletteColors | null {
  return IS_DEV ? state.palette : null;
}
export function getLabFov(): number | null {
  return IS_DEV ? state.fov : null;
}
export function setLabFov(v: number | null): void {
  if (!IS_DEV) return;
  state.fov = v;
  emit();
}

export function setLabHour(h: number | null): void {
  if (!IS_DEV) return;
  state.hour = h;
  emit();
}
export function setLabPalette(p: LabPaletteColors | null): void {
  if (!IS_DEV) return;
  state.palette = p;
  emit();
}
export function setLabGrade(g: LabGrade | null): void {
  if (!IS_DEV) return;
  state.grade = g;
  emit();
}
export function resetLab(): void {
  if (!IS_DEV) return;
  state.hour = null;
  state.palette = null;
  state.grade = null;
  state.fov = null;
  emit();
}

/** Reactive lab state for panels + the PostFX grade hook. */
export function useLabState(): LabState {
  return useSyncExternalStore(labSubscribe, getLabSnapshot, getLabServerSnapshot);
}
