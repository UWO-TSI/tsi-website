/**
 * How far the island is from playable, for its loading screen (components/game/IslandLoading.tsx): four real parts,
 * each 0..1 as it happens, weighted by how long each takes on a first visit (specs/evidence/loading/baseline.md), shown
 * never moving backwards. `code`: the island's code is in and running; `world`: the world's map is loaded and derived;
 * `files`: the models and textures the loading manager has finished, of all it has started; `warm`: the frames
 * rendered behind the screen while every shader compiles (lib/game/sceneGate.ts), of the frames it waits for.
 */
import { useSyncExternalStore } from "react";

export type LoadPart = "code" | "world" | "files" | "warm";
const WEIGHT: Record<LoadPart, number> = { code: 0.1, world: 0.15, files: 0.55, warm: 0.2 };
const parts: Record<LoadPart, number> = { code: 0, world: 0, files: 0, warm: 0 };
let shown = 0;
const listeners = new Set<() => void>();

/** The weighted sum of the parts (0..1). */
export const loadTotal = (p: Readonly<Record<LoadPart, number>>) =>
  (Object.keys(WEIGHT) as LoadPart[]).reduce((n, k) => n + WEIGHT[k] * Math.min(1, Math.max(0, p[k])), 0);

export function setLoadPart(part: LoadPart, value: number) {
  if (parts[part] === value) return;
  parts[part] = value;
  const next = Math.max(shown, loadTotal(parts));
  if (next - shown < 0.005 && next < 1) return; // half a percent at a time: no re-render per file
  shown = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** The progress shown (0..1), never backwards. */
export const useLoadProgress = () => useSyncExternalStore(subscribe, () => shown, () => 0);
