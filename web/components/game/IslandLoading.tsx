"use client";

import styles from "./IslandLoading.module.css";

/**
 * The member island's one loading screen (hud-first-login §5), in the cream
 * kit: the page shows it while the world's code downloads, the world keeps it
 * up through asset loading and shader warm-up (WarmupProbe), then it fades.
 * `stage` names what it is waiting on; the track drifts rather than counting
 * (the loader counts batch by batch, so a percentage would run backwards).
 */
export default function IslandLoading({ stage = "start", leaving = false }: { stage?: "start" | "loading" | "warming"; leaving?: boolean }) {
  return <div className={styles.screen} data-leaving={leaving || undefined} role="status" aria-live="polite">
    <span className={styles.eyebrow}>Tech for Social Impact · Tethos Island</span>
    <span className={styles.leaf} aria-hidden="true">❧</span>
    <h1>Preparing the island</h1>
    <p>{stage === "start" ? "Rowing out…" : stage === "loading" ? "Unpacking the village…" : "Lighting the lamps…"}</p>
    <div className={styles.track} aria-hidden="true"><span /></div>
  </div>;
}
