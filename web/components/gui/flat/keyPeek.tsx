"use client";

/**
 * A peek at what a key brings up (David's v5 review on the keyboard tour: "when holding each key it should pop on the
 * right side what it will look like and fade away when let go, like the inventory bar or emote wheel with a mini
 * animation on it spinning or selecting"; round 6: "make it look more similar to the actual ui"). A white card on the
 * keyboard card's right holding `children`: the game's real piece, small (the tool and emote wheels, the bag, the HUD,
 * the minimap: components/game/hq/TourPeek.tsx). The chat, quests and mail, whose real pieces are whole screens, are
 * drawn here in a short loop. `out`: let go, it fades away. Shown on /lab/gui?only=key-peek.
 */
import type { ReactNode } from "react";
import { Check, Mail, MessageCircle } from "lucide-react";
import p from "./keyPeek.module.css";

export type PeekKind = "wheel" | "emote" | "hud" | "chat" | "bag" | "collection" | "quests" | "map" | "mail";

const DRAWN: Partial<Record<PeekKind, () => ReactNode>> = {
  chat: () => <div className={p.chat}>
    <span className={p.bubble}><i /><i /><i /></span>
    <span className={p.line}><MessageCircle aria-hidden /> <b /></span>
  </div>,
  quests: () => <div className={p.quests}>{[0, 1, 2].map(i => <span key={i} style={{ "--i": i } as React.CSSProperties}><i><Check aria-hidden /></i><b /></span>)}</div>,
  mail: () => <div className={p.mail}><span className={p.letter}><b /><b /></span><Mail className={p.envelope} aria-hidden /></div>,
};

export function KeyPeek({ kind, out, testId, children }: { kind: PeekKind; out?: boolean; testId?: string; children?: ReactNode }) {
  return <div className={p.peek} data-out={out || undefined} data-kind={kind} data-real={children ? "" : undefined} data-testid={testId} aria-hidden="true">{children ?? DRAWN[kind]?.()}</div>;
}
