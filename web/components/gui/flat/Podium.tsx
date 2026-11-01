import type { CSSProperties, ReactNode } from "react";
import p from "./podium.module.css";

/**
 * A podium (the volleyball court's leaderboard, David 2026-10-30: "have a podium with character model and name, more
 * visual less names"): three white steps, the second left, the first in the middle and highest, the third right, each
 * with a thin gold, silver or bronze edge, its place, the name and a quiet line. `stage` sits over the whole podium (a
 * transparent canvas with the players standing on their steps); `podiumFeet` says where each step's top is, so a stage
 * can stand its figures there.
 */
export interface PodiumPlace { rank: 1 | 2 | 3; name: string; detail?: ReactNode; you?: boolean }

/** The steps' heights and the room above them for the figures (px). */
export const PODIUM = { step: { 1: 108, 2: 92, 3: 82 }, stage: 150 } as const;
/** Left to right (the list itself reads first, second, third). */
const ORDER = [2, 1, 3] as const;

/**
 * Where a place's figure stands: its column's middle as a fraction of the podium's width (the columns are equal and
 * gapless), and its step's top in px up from the podium's foot.
 */
export const podiumFeet = (rank: 1 | 2 | 3) => ({ x: (ORDER.indexOf(rank) + 0.5) / 3, y: PODIUM.step[rank] });

export function Podium({ places, stage, label = "Podium" }: { places: readonly PodiumPlace[]; stage?: ReactNode; label?: string }) {
  return <div className={p.podium} role="list" aria-label={label} style={{ "--stage": `${PODIUM.stage}px` } as CSSProperties}>
    {([1, 2, 3] as const).map(rank => {
      const at = places.find(x => x.rank === rank);
      return <div key={rank} className={p.col} role="listitem" style={{ gridColumn: ORDER.indexOf(rank) + 1, gridRow: 1 }}>
        {at ? <div className={p.step} data-rank={rank} data-you={at.you || undefined} style={{ height: PODIUM.step[rank] }}>
          <span className={p.place} aria-label={`Rank ${rank}`}>{rank}</span>
          <b className={p.name}>{at.name}</b>
          {at.detail !== undefined ? <span className={p.detail}>{at.detail}</span> : null}
        </div> : null}
      </div>;
    })}
    {stage ? <div className={p.stage} aria-hidden="true">{stage}</div> : null}
  </div>;
}
