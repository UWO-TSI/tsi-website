"use client";

import { useState, useSyncExternalStore } from "react";
import { useLoadProgress } from "@/lib/game/loadProgress";
import styles from "./IslandLoading.module.css";

const LINES = { start: "Rowing out…", loading: "Unpacking the village…", warming: "Lighting the lamps…" } as const;

/**
 * Round 2 (David, 2026-10-27: "simple maybe show our logo loading or the fishing boat thing... maybe like a idle shot
 * of the island"): three simple looks for him to pick one, `?loading=logo|boat|island` (logo by default). The site's
 * Tethos mark on the cream paper; Bram's boat at the wharf as a print on it; the island at golden hour, full bleed.
 * The stills are frames of the game's own title camera (public/assets/loading). Under each, the real progress as one
 * thin line (lib/game/loadProgress.ts: the code, the world, the files, the shader warm-up; never backwards) and the
 * stage it waits on. Once he picks, the other two go.
 */
const LOOKS = ["logo", "boat", "island"] as const;
type Look = (typeof LOOKS)[number];
const still = () => () => {};
const lookFromUrl = (): Look => LOOKS.find((l) => l === new URLSearchParams(window.location.search).get("loading")) ?? "logo";

export default function IslandLoading({ stage = "start", leaving = false }: { stage?: keyof typeof LINES; leaving?: boolean }) {
  const progress = useLoadProgress();
  const look = useSyncExternalStore(still, lookFromUrl, () => "logo" as Look);
  const [shown, setShown] = useState(false);
  return <div className={styles.screen} data-look={look} data-leaving={leaving || undefined} role="status" aria-live="polite">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {look !== "logo" && <img className={styles.still} src={`/assets/loading/${look}.webp`} alt="" decoding="async" data-shown={shown || undefined} onLoad={() => setShown(true)} />}
    <div className={styles.foot}>
      {look !== "boat" && <i className={styles.mark} aria-hidden="true" />}
      <h1>Tethos Island</h1>
      <div className={styles.line} role="progressbar" aria-label="Loading the island" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
        style={{ "--p": progress } as React.CSSProperties}><i /></div>
      <p>{LINES[stage]}</p>
    </div>
  </div>;
}
