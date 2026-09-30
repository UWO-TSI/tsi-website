"use client";

/**
 * Dev-lab override store (/lab benches, 2026-07-22): the /lab/fishing hour.
 * getLabHour() is read by the fishing context (fishing.ts).
 *
 * Every accessor hard no-ops in production builds (NODE_ENV guard — the
 * bundler inlines it), so lab state can never leak into tethos.ca even if
 * something imports a setter. Reactive via useSyncExternalStore: snapshot
 * is cached and only replaced on emit (same pattern as the audio manager).
 */

import { useSyncExternalStore } from "react";

export interface LabState {
  hour: number | null; // 0-24 fractional; null = wall clock
}

const IS_DEV = process.env.NODE_ENV !== "production";
const EMPTY: LabState = { hour: null };

const state: LabState = { hour: null };
let snapshot: LabState = { ...state };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...state };
  listeners.forEach((l) => l());
}

function labSubscribe(cb: () => void): () => void {
  if (!IS_DEV) return () => {};
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getLabSnapshot = (): LabState => (IS_DEV ? snapshot : EMPTY);
const getLabServerSnapshot = (): LabState => EMPTY;

export function getLabHour(): number | null {
  return IS_DEV ? state.hour : null;
}

export function setLabHour(h: number | null): void {
  if (!IS_DEV) return;
  state.hour = h;
  emit();
}

/** Reactive lab state for the /lab/fishing bench. */
export function useLabState(): LabState {
  return useSyncExternalStore(labSubscribe, getLabSnapshot, getLabServerSnapshot);
}
