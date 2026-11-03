import type { CSSProperties, ReactNode } from "react";
import c from "./callTag.module.css";

/**
 * A call at a moment of play (the volleyball match's touches: your grade, a save, a block, a miss, a max toss). Small and
 * quiet: a white chip with a coloured cap holding the call's little picture (David 2026-11-03: "A chip"). `live` plays it
 * once: in with a spring (a block slams down), a held beat, then up and out. Without it, it rests (the showroom). `team`
 * colours a save or a block (a CSS colour, the team token).
 */
export type CallKind = "perfect" | "good" | "soft" | "saved" | "block" | "whiff" | "max";

/** Each call's picture (16 × 16 in currentColor). */
const PICTURE: Record<CallKind, ReactNode> = {
  perfect: <path d="M8 1.5l1.7 4.8 4.8 1.7-4.8 1.7L8 14.5l-1.7-4.8L1.5 8l4.8-1.7z" fill="currentColor" stroke="none" />,
  good: <path d="M3.5 8.5l3 3 6-7" />,
  soft: <><circle cx={8} cy={8} r={5.5} /><path d="M8 5v3.2l2 1.3" /></>,
  saved: <path d="M8 13V4M4.5 7.5L8 4l3.5 3.5" />,
  // A wall of bricks, filled so it reads at 12 px.
  block: <path d="M2 2.5h5.5V6H2zM8.5 2.5H14V6H8.5zM2 7h2.5v3.5H2zM5.5 7h5v3.5h-5zM11.5 7H14v3.5h-2.5zM2 11.5h5.5V15H2zM8.5 11.5H14V15H8.5z" fill="currentColor" stroke="none" />,
  whiff: <circle cx={8} cy={8} r={5} strokeDasharray="2.4 2.2" />,
  max: <path d="M9.5 1.5L4 9h4l-1.5 5.5L12 7H8z" fill="currentColor" stroke="none" />,
};

export function CallTag({ kind, live, team, children }: { kind: CallKind; live?: boolean; team?: string; children: ReactNode }) {
  return <span className={c.tag} data-kind={kind} data-live={live || undefined} style={team ? { "--team": team } as CSSProperties : undefined}>
    <i className={c.cap}><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{PICTURE[kind]}</svg></i>
    <b className={c.word}>{children}</b>
  </span>;
}
