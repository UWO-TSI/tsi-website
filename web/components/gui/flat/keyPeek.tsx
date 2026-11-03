"use client";

/**
 * A peek at what a key brings up (David's v5 review on the keyboard tour: "when holding each key it should pop on the
 * right side what it will look like and fade away when let go, like the inventory bar or emote wheel with a mini
 * animation on it spinning or selecting"). A small white card with a drawn miniature of that part of the screen, playing
 * a short loop: the tool wheel spins in and its pointer picks a tool, the emote wheel picks a face, the HUD's pieces
 * slide in, the bag's bar fills, and so on. `out`: let go, it fades away. Shown on /lab/gui?only=key-peek.
 */
import type { ReactNode } from "react";
import { Backpack, Bug, Fish, Hand, Heart, Laugh, Mail, MessageCircle, PartyPopper, Shell, Shovel, Smile, Sparkles, ThumbsUp, Pickaxe, Apple, Flower2, Check } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import p from "./keyPeek.module.css";

export type PeekKind = "wheel" | "emote" | "hud" | "chat" | "bag" | "collection" | "quests" | "map" | "mail";

/** A fishing rod in the lucide style (the keyword library draws the same). */
const Rod = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <path d="M3 21 19 4" /><circle cx="7.5" cy="16" r="2" /><path d="M19 4c1.5 3 1.5 7 0 10" /><path d="M19 14v2.5a1.5 1.5 0 0 1-3 0" />
</svg>;

/** A ring of six with a pointer that steps round it and a pick that pops in the middle. */
function Wheel({ items, pick }: { items: ReactNode[]; pick: ReactNode }) {
  return <div className={p.wheel}>
    {items.map((it, i) => <span key={i} className={p.slot} style={{ "--i": i } as React.CSSProperties}>{it}</span>)}
    <span className={p.pointer} aria-hidden />
    <span className={p.hub}>{pick}</span>
  </div>;
}

const PEEKS: Record<PeekKind, () => ReactNode> = {
  wheel: () => <Wheel items={[<Rod key="r" />, <Bug key="n" />, <Shovel key="s" />, <Pickaxe key="p" />, <Hand key="h" />, <Apple key="a" />]} pick={<Rod />} />,
  emote: () => <Wheel items={[<Heart key="h" />, <Smile key="s" />, <Hand key="w" />, <PartyPopper key="p" />, <Laugh key="l" />, <ThumbsUp key="t" />]} pick={<Heart />} />,
  hud: () => <div className={p.hud}>
    <span className={p.pill} style={{ "--i": 0 } as React.CSSProperties}>2:20 PM</span>
    <span className={p.pill} style={{ "--i": 1 } as React.CSSProperties}><CurrencyIcon size={13} /> 1,240 <CurrencyIcon currency="gems" size={13} /> 35</span>
    <span className={p.bars} style={{ "--i": 2 } as React.CSSProperties}><i /><i /></span>
  </div>,
  chat: () => <div className={p.chat}>
    <span className={p.bubble}><i /><i /><i /></span>
    <span className={p.line}><MessageCircle aria-hidden /> <b /></span>
  </div>,
  bag: () => <div className={p.bag}>
    <Backpack className={p.bagIcon} aria-hidden />
    <span className={p.bar}>{[<Fish key="f" />, <Shell key="s" />, <Apple key="a" />, <Flower2 key="l" />, null].map((it, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{it}</span>)}</span>
  </div>,
  collection: () => <div className={p.grid}>{[<Fish key="a" />, <Bug key="b" />, <Shell key="c" />, <Fish key="d" />, <Sparkles key="e" />, <Bug key="f" />].map((it, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{it}</span>)}</div>,
  quests: () => <div className={p.quests}>{[0, 1, 2].map(i => <span key={i} style={{ "--i": i } as React.CSSProperties}><i><Check aria-hidden /></i><b /></span>)}</div>,
  map: () => <div className={p.map}>
    <svg viewBox="0 0 100 70" aria-hidden><path className={p.land} d="M18 40c-6-12 8-24 22-22 8-10 26-8 32 2 14 0 20 14 12 24 4 12-12 18-22 12-10 8-30 6-34-4-10 0-14-6-10-12z" /></svg>
    <span className={p.you} />
  </div>,
  mail: () => <div className={p.mail}><span className={p.letter}><b /><b /></span><Mail className={p.envelope} aria-hidden /></div>,
};

export function KeyPeek({ kind, out, testId }: { kind: PeekKind; out?: boolean; testId?: string }) {
  return <div className={p.peek} data-out={out || undefined} data-kind={kind} data-testid={testId} aria-hidden="true">{PEEKS[kind]()}</div>;
}
