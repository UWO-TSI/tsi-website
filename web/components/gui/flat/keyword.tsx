"use client";

/**
 * A keyword in a line of talk (David's v3 review: "use simple 2d icon for fish bug word and make it color and shake a
 * lil"): the word in its colour with a little flat icon before it that wiggles gently. A line marks its keywords with
 * stars, "Bring her a *fish* or a *bug*"; `keywordParts` splits it, and a starred word the kit has no icon for stays
 * plain. Colours: the theme's --ui-word-* tokens. Shown on /lab/gui.
 */
import type { ReactNode } from "react";
import { Bug, Fish } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import k from "./keyword.module.css";

export type KeywordKind = "fish" | "bug" | "coin";
const ICON: Record<KeywordKind, ReactNode> = { fish: <Fish aria-hidden />, bug: <Bug aria-hidden />, coin: <CurrencyIcon size={18} /> };
/** The word (lower case, plurals too) to its kind. */
const kindOf = (word: string): KeywordKind | null => {
  const w = word.toLowerCase();
  return w === "fish" ? "fish" : w === "bug" || w === "bugs" ? "bug" : w === "coin" || w === "coins" ? "coin" : null;
};

/** A line's parts: plain text, and keywords (a starred word the kit knows). `at`: where the part starts in the line as written. */
export type LinePart = { text: string; at: number; kind?: KeywordKind };
export function keywordParts(line: string): LinePart[] {
  const parts: LinePart[] = [], re = /\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), at: last });
    const kind = kindOf(m[1]);
    parts.push(kind ? { text: m[1], at: m.index + 1, kind } : { text: m[1], at: m.index + 1 });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), at: last });
  return parts;
}
/** The line as read aloud (no stars). */
export const plainLine = (line: string) => line.replace(/\*([^*]+)\*/g, "$1");

/** The keyword itself. `off`: not yet reached (a line typing out): its room is kept, its icon not shown. */
export function Keyword({ kind, off, children }: { kind: KeywordKind; off?: boolean; children: ReactNode }) {
  return <span className={k.word} data-kind={kind} data-off={off || undefined}><i className={k.icon}>{ICON[kind]}</i>{children}</span>;
}
/** A whole line with its keywords. */
export function KeywordLine({ line }: { line: string }) {
  return <>{keywordParts(line).map((p, i) => (p.kind ? <Keyword key={i} kind={p.kind}>{p.text}</Keyword> : <span key={i}>{p.text}</span>))}</>;
}
