"use client";

import styles from "./IslandLoading.module.css";

/**
 * The member island's one loading screen (hud-first-login §5), in the cream
 * kit: the page shows it while the world's code downloads, the world keeps it
 * up through asset loading and shader warm-up (WarmupProbe), then it fades.
 * `progress` (0–100) fills the track; null (nothing loading yet) and 100
 * (the lights warming up) drift instead.
 */
export default function IslandLoading({ progress = null, leaving = false }: { progress?: number | null; leaving?: boolean }) {
  const filling = progress !== null && progress < 100;
  return <div className={styles.screen} data-leaving={leaving || undefined} role="status" aria-live="polite">
    <span className={styles.eyebrow}>Tech for Social Impact · Tethos Island</span>
    <span className={styles.leaf} aria-hidden="true">❧</span>
    <h1>Preparing the island</h1>
    <p>{progress === null ? "Rowing out…" : filling ? `Unpacking the village · ${Math.round(progress)}%` : "Lighting the lamps…"}</p>
    <div className={styles.track} data-warming={!filling || undefined} aria-hidden="true"><span style={filling ? { width: `${Math.max(6, progress)}%` } : undefined} /></div>
  </div>;
}
