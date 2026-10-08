"use client";

/**
 * A landmark's paper tag over the village ("Shop", "Museum · Closed", "HQ"), laid out with the world's labels
 * (lib/game/labelLayout.ts; world audit item 2): it shows only within TAG_RANGE of you, fading by distance, fades out
 * behind a building and where a player's plate or a bubble needs the room, and never moves.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import { LABEL_PRIORITY, worldLabels } from "@/lib/game/labelLayout";
import styles from "./DefaultIslandWorld.module.css";

/** How near you are before a landmark's tag shows (world units); it fades over the labels' FADE_RUN beyond. */
export const TAG_RANGE = 8;
const DISTANCE_FACTOR = 10;

export default function LandmarkTag({ position, closed, children }: { position: [number, number, number]; closed?: boolean; children: ReactNode }) {
  const tag = useRef<HTMLDivElement>(null);
  const [x, y, z] = position;
  useEffect(() => {
    const size = { w: 0, h: 0 };
    let alpha = -1;
    return worldLabels.add({
      priority: LABEL_PRIORITY.landmark, nudge: false, range: TAG_RANGE, distanceFactor: DISTANCE_FACTOR, size,
      anchor: out => { out.set(x, y, z); return true; },
      place: o => {
        const el = tag.current;
        if (!el) return;
        if (!size.w && el.offsetWidth) { size.w = el.offsetWidth; size.h = el.offsetHeight; }
        const a = o.shown ? Math.round(o.alpha * 50) / 50 : 0;
        if (a === alpha) return;
        alpha = a;
        el.style.opacity = String(a);
        el.style.visibility = a > 0 ? "" : "hidden";
      },
    });
  }, [x, y, z]);
  return <Html position={position} center distanceFactor={DISTANCE_FACTOR} zIndexRange={[3, 0]}>
    {/* Hidden until the layout first places it, so a far tag never flashes in. */}
    <div ref={tag} className={styles.cue} data-closed={closed} style={{ opacity: 0, visibility: "hidden" }}>{children}</div>
  </Html>;
}
