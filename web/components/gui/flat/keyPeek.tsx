"use client";

/**
 * A peek at what a key brings up (David's v5 review on the keyboard tour: "when holding each key it should pop on the
 * right side what it will look like and fade away when let go, like the inventory bar or emote wheel with a mini
 * animation on it spinning or selecting"; round 6: "make it look more similar to the actual ui"). A white card beside
 * the keyboard card holding `children`: the game's real piece, small (the emote wheel, the bag, the collection:
 * components/game/hq/TourPeek.tsx). The tool wheel, the chat, the quests and the mail are drawn here in a short loop
 * (round 8, David on the tool wheel: "keep the old one", round 6's drawn wheel). The HUD and the minimap have no peek
 * card: the real ones come in where they sit, ringed (PeekRing). `out`: let go, it fades away. Shown on
 * /lab/gui?only=key-peek.
 */
import type { ReactNode } from "react";
import { Apple, Bug, Check, Hand, Mail, MessageCircle, Pickaxe, Shovel } from "lucide-react";
import p from "./keyPeek.module.css";

export type PeekKind = "wheel" | "emote" | "hud" | "chat" | "bag" | "collection" | "quests" | "map" | "mail";

/** A fishing rod in the lucide style (the keyword library draws the same). */
const Rod = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <path d="M3 21 19 4" /><circle cx="7.5" cy="16" r="2" /><path d="M19 4c1.5 3 1.5 7 0 10" /><path d="M19 14v2.5a1.5 1.5 0 0 1-3 0" />
</svg>;

const DRAWN: Partial<Record<PeekKind, () => ReactNode>> = {
  // A ring of six with a pointer that steps round it and the pick popping in the middle.
  wheel: () => <div className={p.wheel}>
    {[<Rod key="r" />, <Bug key="n" />, <Shovel key="s" />, <Pickaxe key="p" />, <Hand key="h" />, <Apple key="a" />].map((it, i) =>
      <span key={i} className={p.slot} style={{ "--i": i } as React.CSSProperties}>{it}</span>)}
    <span className={p.pointer} aria-hidden />
    <span className={p.hub}><Rod /></span>
  </div>,
  chat: () => <div className={p.chat}>
    <span className={p.bubble}><i /><i /><i /></span>
    <span className={p.line}><MessageCircle aria-hidden /> <b /></span>
  </div>,
  quests: () => <div className={p.quests}>{[0, 1, 2].map(i => <span key={i} style={{ "--i": i } as React.CSSProperties}><i><Check aria-hidden /></i><b /></span>)}</div>,
  mail: () => <div className={p.mail}><span className={p.letter}><b /><b /></span><Mail className={p.envelope} aria-hidden /></div>,
};

/** `bare`: no card, the piece floats over the world as it does in the game (the emote wheel). */
export function KeyPeek({ kind, out, bare, testId, children }: { kind: PeekKind; out?: boolean; bare?: boolean; testId?: string; children?: ReactNode }) {
  return <div className={p.peek} data-out={out || undefined} data-kind={kind} data-real={children ? "" : undefined} data-bare={bare || undefined} data-testid={testId} aria-hidden="true">{children ?? DRAWN[kind]?.()}</div>;
}
