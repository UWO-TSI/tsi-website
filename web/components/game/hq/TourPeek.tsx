"use client";

/**
 * What a key brings up, in the keyboard tour's peek (KeyPeek), built from the game's real pieces (David's round 6
 * review on the key previews: "make it look more similar to the actual ui"): the real tool wheel and emote wheel with
 * their choice stepping round, the bag's real slots filling, the collection's cards, the HUD's bars and wallet, and
 * the minimap turning with you on it. Small, the same pieces. The chat, quests and mail keep the kit's drawings (their
 * real pieces belong to other screens). Shown on /lab/gui?only=key-peek too.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";
import { ItemCard, KeyPeek, StatBar, WalletSlot, type PeekKind } from "@/components/gui/flat";
import { iconUrl } from "@/lib/icons/keys";
import { wheelContents } from "@/lib/game/toolWheel";
import { landmarkPoint } from "@/lib/game/defaultIsland";
import { ToolWheelView } from "../ToolWheel";
import { EmoteWheelView } from "../emotes/EmoteWheel";
import { Grid, nameOf } from "../Bag";
import { MapPlot } from "../MiniMap";
import { useDefaultIslandPlot } from "../DefaultIslandMap";
import mini from "../MiniMap.module.css";
import s from "./TourPeek.module.css";

/** A new arrival's wheel: the starter tools. */
const TOOLS = wheelContents({ site: "village", owned: [], weapons: [], armed: false, pins: [], stock: {} });
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

function WheelPeek() {
  const n = useBeat(520), picked = n % (TOOLS.length + 1);
  // Round the petals, then the rod again, in hand.
  return <Small k={0.5}><ToolWheelView standalone items={TOOLS} held={TOOLS[0]?.id ?? null} picked={picked < TOOLS.length ? picked : 0} /></Small>;
}
function EmotePeek() {
  const n = useBeat(480);
  return <Small k={0.46}><EmoteWheelView standalone ring="emotes" choice={n % 8} last={null} /></Small>;
}
function HudPeek() {
  const n = useBeat(700), on = Math.min(2, n);
  return <Small k={0.8}><div className={s.hud}>
    <div className={s.bars}><StatBar kind="health" value={0.86} label="Health" /><StatBar kind="xp" value={0.35 + (n % 6) * 0.06} badge="Lv 2" label="XP" /></div>
    {on >= 1 && <WalletSlot coins={1240 + (n > 2 ? 60 : 0)} gems={35} at="in" />}
  </div></Small>;
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
function MapPeek() {
  const plot = useDefaultIslandPlot();
  // You, at HQ's door (where the tour is).
  const [you] = useState(() => { const p = landmarkPoint("hq", "door"); return { current: new THREE.Vector3(p?.[0] ?? 0, 0, p?.[1] ?? 0) }; });
  return <Small k={1}><div className={mini.corner}><MapPlot playerPosRef={you} plot={plot} className={mini.plot} /></div></Small>;
}

const REAL: Partial<Record<PeekKind, () => ReactNode>> = { wheel: WheelPeek, emote: EmotePeek, hud: HudPeek, bag: BagPeek, collection: CollectionPeek, map: MapPeek };

export default function TourPeek({ kind, out, testId }: { kind: PeekKind; out?: boolean; testId?: string }) {
  const Real = REAL[kind];
  return <KeyPeek kind={kind} out={out} testId={testId}>{Real ? <Real /> : null}</KeyPeek>;
}
