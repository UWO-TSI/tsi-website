"use client";

/**
 * What a key brings up, in the keyboard tour's peek (KeyPeek), built from the game's real pieces (David's round 6
 * review on the key previews: "make it look more similar to the actual ui"): the real emote wheel with its choice
 * stepping round, the bag's real slots filling and the collection's cards. Small, the same pieces. The tool wheel, the
 * chat, quests and mail keep the kit's drawings (round 8, David: "keep the old one" for the tool wheel); the HUD and the
 * minimap have no peek, the real ones fly in from above the card (KeyboardTour's FlyHome); nor does the phone, which slides in itself. Shown on /lab/gui?only=key-peek too.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ItemCard, KeyPeek, type PeekKind } from "@/components/gui/flat";
import { iconUrl } from "@/lib/icons/keys";
import { EmoteWheelView } from "../emotes/EmoteWheel";
import { Grid, nameOf } from "../Bag";
import s from "./TourPeek.module.css";

const BAG = ["fish_dace", "sea_abalone", "fruit_pear", "bug_ladybug", "rock_stone", null, null, null];
const FINDS = ["fish_dace", "bug_common_butterfly", "sea_dungeness_crab", "fish_carp", "bug_ladybug", "fruit_coconut"];
const noop = () => {};

/** A beat counter: each `ms`, the next. */
function useBeat(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setN(v => v + 1), ms); return () => window.clearInterval(t); }, [ms]);
  return n;
}

/** The real piece at its own size, scaled down to fit the peek. */
const Small = ({ k, children }: { k: number; children: ReactNode }) => <div className={s.small} style={{ "--k": k } as CSSProperties}>{children}</div>;

function EmotePeek() {
  const n = useBeat(480);
  return <Small k={0.54}><EmoteWheelView standalone ring="emotes" choice={n % 8} last={null} /></Small>;
}
function BagPeek() {
  const n = useBeat(380), filled = Math.min(BAG.length, 1 + n);
  const slots = BAG.map((k, i) => (i < filled ? k : null));
  return <Small k={0.42}><div className={s.bag}><Grid pane="bag" slots={slots} counts={slots.map(k => (k === "fish_dace" ? 2 : 1))} capacity={BAG.length} selected={null} label="Your bag" onPick={noop} /></div></Small>;
}
function CollectionPeek() {
  const n = useBeat(300);
  return <Small k={0.5}><div className={s.finds}>{FINDS.slice(0, Math.min(FINDS.length, 1 + n)).map(k =>
    <ItemCard key={k} size="sm" arrow={false} picture={iconUrl(k)} px={40} name={nameOf(k)} label={nameOf(k)} className={s.find} />)}</div></Small>;
}

const REAL: Partial<Record<PeekKind, () => ReactNode>> = { emote: EmotePeek, bag: BagPeek, collection: CollectionPeek };
/** What floats over the world in the game (no card round it there either). */
const BARE = new Set<PeekKind>(["emote"]);

export default function TourPeek({ kind, out, testId }: { kind: PeekKind; out?: boolean; testId?: string }) {
  const Real = REAL[kind];
  return <KeyPeek kind={kind} out={out} bare={BARE.has(kind)} testId={testId}>{Real ? <Real /> : null}</KeyPeek>;
}
