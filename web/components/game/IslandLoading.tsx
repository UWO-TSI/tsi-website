"use client";

import { useState, useSyncExternalStore } from "react";
import { ProgressCard } from "@/components/gui/flat/ProgressCard";
import { loadingStill, useLoadProgress } from "@/lib/game/loadProgress";
import styles from "./IslandLoading.module.css";

const LINES = { start: "Rowing out…", loading: "Sweeping the plaza…", warming: "Lighting the lamps…" } as const;
const still = () => () => {};

/**
 * The island's loading screen (David, 2026-10-28, of round 2's island look: "this one is good"): a still of the title's
 * staged shot on the new world, the HQ across the plaza, in the phase the island opens in (lib/game/loadProgress.ts
 * `loadingStill`), drifting in very slowly; over it one flat card (the kit's ProgressCard) with the Tethos mark, the stage
 * it waits on and the real progress (the code, the world, the files, the shader warm-up; never backwards).
 */
export default function IslandLoading({ stage = "start", leaving = false }: { stage?: keyof typeof LINES; leaving?: boolean }) {
  const progress = useLoadProgress();
  const src = useSyncExternalStore(still, loadingStill, () => null);
  const [shown, setShown] = useState(false);
  return <div className={styles.screen} data-leaving={leaving || undefined} role="status" aria-live="polite">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src && <img className={styles.still} src={src} alt="" decoding="async" data-shown={shown || undefined} onLoad={() => setShown(true)} />}
    <ProgressCard icon={<i className={styles.mark} />} title="Tethos Island" status={LINES[stage]} value={progress} label="Loading the island" />
  </div>;
}
