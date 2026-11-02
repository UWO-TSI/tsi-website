import type { CSSProperties, ReactNode } from "react";
import p from "./podium.module.css";

/**
 * A podium (the volleyball court's leaderboard; David 2026-10-30: "have a podium with character model and name, more
 * visual less names"; 2026-11-01: "make it more podium like"): three white blocks joined into one stepped stand, the
 * first in the middle and tallest, the second left, the third right and lowest, each with its big number in gold,
 * silver or bronze and a thin edge of it along its top. The names and a quiet line sit in a row under the stand. `stage`
 * lies over the whole podium (a transparent canvas with the players on their blocks); `podiumFeet` says where each
 * block's top is, so a stage can stand its figures there.
 */
export interface PodiumPlace { rank: 1 | 2 | 3; name: string; detail?: ReactNode; you?: boolean }

/** The blocks' heights, the name row under them and the room above them for the figures (px). */
export const PODIUM = { step: { 1: 96, 2: 68, 3: 48 }, names: 42, stage: 150 } as const;
/** Left to right (the list itself reads first, second, third). */
const ORDER = [2, 1, 3] as const;

/**
 * Where a place's figure stands: its column's middle as a fraction of the podium's width (the columns are equal and
 * gapless), and its block's top in px up from the podium's foot (under the name row).
 */
export const podiumFeet = (rank: 1 | 2 | 3) => ({ x: (ORDER.indexOf(rank) + 0.5) / 3, y: PODIUM.names + PODIUM.step[rank] });

export function Podium({ places, stage, label = "Podium" }: { places: readonly PodiumPlace[]; stage?: ReactNode; label?: string }) {
  return <div className={p.podium} role="list" aria-label={label} style={{ "--stage": `${PODIUM.stage}px`, "--names": `${PODIUM.names}px` } as CSSProperties}>
    {([1, 2, 3] as const).map(rank => {
      const at = places.find(x => x.rank === rank);
      return <div key={rank} className={p.col} role="listitem" data-rank={rank} data-you={at?.you || undefined} style={{ gridColumn: ORDER.indexOf(rank) + 1, gridRow: 1 }}>
        <div className={p.block} style={{ height: PODIUM.step[rank] }}><span className={p.num} aria-label={`Rank ${rank}`}>{rank}</span></div>
        <div className={p.plate}>
          {at ? <><b className={p.name}>{at.name}</b>{at.detail !== undefined ? <span className={p.detail}>{at.detail}</span> : null}</> : null}
        </div>
      </div>;
    })}
    {stage ? <div className={p.stage} aria-hidden="true">{stage}</div> : null}
  </div>;
}
