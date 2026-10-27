"use client";

import type { MiniMapPlot } from "./MiniMap";
import { useLoadProgress } from "@/lib/game/loadProgress";
import styles from "./IslandLoading.module.css";

const LINES = { start: "Rowing out…", loading: "Unpacking the village…", warming: "Lighting the lamps…" } as const;

/**
 * The member island's one loading screen (hud-first-login §5; remade 2026-10-27 after David: "a new improved prettier
 * loading screen for after signing in"). Our island on a sea chart, coming out of the mist once its map is in (`plot`,
 * the minimap's own drawing), and Bram's boat rowing along the sea line toward the dock as the island really loads
 * (lib/game/loadProgress.ts: the code, the world, the files, the shader warm-up; never backwards). The page shows it
 * while the world's code downloads, the world keeps it up through loading and warm-up, then it fades. The stage names
 * what it is waiting on.
 */
export default function IslandLoading({ stage = "start", leaving = false, plot }: { stage?: keyof typeof LINES; leaving?: boolean; plot?: MiniMapPlot }) {
  const progress = useLoadProgress(), pct = Math.round(progress * 100);
  return <div className={styles.screen} data-leaving={leaving || undefined} role="status" aria-live="polite">
    <span className={styles.eyebrow}>Tech for Social Impact · Tethos Island</span>
    <figure className={styles.chart} aria-hidden="true">
      <svg viewBox={plot?.viewBox ?? "0 0 100 70"} preserveAspectRatio="xMidYMid meet" className={styles.plot} data-shown={plot ? true : undefined}>
        {plot?.content}
      </svg>
      <i className={styles.mist} data-lifted={plot ? true : undefined} />
    </figure>
    <h1>Tethos Island</h1>
    <p>{LINES[stage]}</p>
    <div className={styles.voyage} aria-hidden="true" style={{ "--p": progress } as React.CSSProperties}>
      <span className={styles.sea}><span className={styles.wake} /></span>
      <span className={styles.boat}><svg viewBox="0 0 40 28">
        <path d="M3 15h34l-5 9H9z" fill="#946429" />
        <path d="M5 15h30l-1.2 2.2H6.3z" fill="#bb813f" />
        <circle cx="15" cy="9.5" r="3.6" fill="#f2c9a0" /><path d="M11.4 9.6a3.6 3.6 0 0 1 7.2 0c-2-1.3-5.2-1.3-7.2 0z" fill="#5a3b2a" />
        <circle cx="25" cy="10" r="3.2" fill="#e8b88f" /><path d="M21.8 10a3.2 3.2 0 0 1 6.4 0c-1.8-1.1-4.6-1.1-6.4 0z" fill="#8a5a3a" />
        <path d="M12 13.5h6v1.6h-6zM22 13.5h6v1.6h-6z" fill="#e2826a" />
        <path d="M29 12.5 37 6" stroke="#725c4e" strokeWidth="1.4" strokeLinecap="round" />
      </svg></span>
      <span className={styles.dock} />
    </div>
    <span className={styles.pct}>{pct}%</span>
  </div>;
}
