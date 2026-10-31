"use client";

/**
 * The volleyball court's leaderboard (E at the board beside the court): the flat panel with the top casual wins this
 * week, a "Sample" tag until phase 3's real board (lib/game/volleyball/leaderboard). Built only while open, so it costs
 * passers-by nothing. World names only.
 */
import { FlatPanel, HairlineRow, HairlineRows, Pill, RankBadge } from "@/components/gui/flat";
import { weeklyBoard, type Board } from "@/lib/game/volleyball/leaderboard";

/** The board's list (also the showroom's sample). */
export function BoardRows({ board }: { board: Board }) {
  return <HairlineRows lead={<>Top casual wins this week{board.sample ? <> <Pill>Sample</Pill></> : null}</>}>
    {board.rows.map(r => <HairlineRow key={`${r.rank}-${r.name}`} art={<RankBadge rank={r.rank} />} title={r.name} detail={`${r.wins} ${r.wins === 1 ? "win" : "wins"}`}
      end={r.you ? <Pill>You</Pill> : undefined} />)}
  </HairlineRows>;
}

export default function BoardSheet({ open, onClose, me }: { open: boolean; onClose: () => void; me: string }) {
  return <FlatPanel open={open} onClose={onClose} title="Beach volleyball" testId="volley-board">
    {open ? <BoardRows board={weeklyBoard(me)} /> : null}
  </FlatPanel>;
}
