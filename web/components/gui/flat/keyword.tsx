"use client";

/**
 * A keyword in a line of talk (David's v3 review: "use simple 2d icon for fish bug word and make it color and shake a
 * lil"; v4: "always add colored icon in text that makes sense and wiggle it a bit, for the fishing market rod, ships
 * allat"): the word in its colour with a little flat icon before it that wiggles gently. The default for every talk
 * line: `keywordParts` finds the words of KEYWORDS in any line (whole words, any case, the longest phrase first, so
 * "fish market" is the market and "fishing rod" the rod), no marking needed. Colours: the theme's --ui-word-* tokens,
 * one per tone. Shown on /lab/gui.
 */
import type { ReactNode } from "react";
import { Anchor, Barrel, BookOpen, Bug, Building2, Coffee, Fish, IdCard, Landmark, Mail, Map as MapIcon, PartyPopper, Shirt, Ship, ShoppingBasket, Shovel, Store } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import k from "./keyword.module.css";

/** A fishing rod, drawn as lucide draws (24 box, round strokes): the rod, its reel, the line and the hook. */
function Rod() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21 19 4" /><circle cx="7.5" cy="16" r="2" /><path d="M19 4c1.5 3 1.5 7 0 10" /><path d="M19 14v2.5a1.5 1.5 0 0 1-3 0" />
  </svg>;
}

/** A keyword's colour (its --ui-word-* token). */
type Tone = "fish" | "bug" | "coin" | "gem" | "place" | "item";
/** The dictionary: each kind's icon, its tone and the words (and phrases) that name it. */
const KEYWORDS = {
  fish: { icon: <Fish />, tone: "fish", words: ["fish", "fishes", "fishing"] },
  bug: { icon: <Bug />, tone: "bug", words: ["bug", "bugs", "bug net"] },
  coin: { icon: <CurrencyIcon size={18} />, tone: "coin", words: ["coin", "coins"] },
  gem: { icon: <CurrencyIcon currency="gems" size={18} />, tone: "gem", words: ["gem", "gems"] },
  rod: { icon: <Rod />, tone: "item", words: ["rod", "rods", "fishing rod"] },
  shovel: { icon: <Shovel />, tone: "item", words: ["shovel"] },
  merch: { icon: <Shirt />, tone: "gem", words: ["merch"] },
  id: { icon: <IdCard />, tone: "item", words: ["ID"] },
  mail: { icon: <Mail />, tone: "item", words: ["mail", "mailbox"] },
  map: { icon: <MapIcon />, tone: "item", words: ["map"] },
  study: { icon: <BookOpen />, tone: "item", words: ["study"] },
  ship: { icon: <Ship />, tone: "place", words: ["ship", "ships", "boat", "boats", "shipwright"] },
  shop: { icon: <Store />, tone: "place", words: ["shop", "tackle shop"] },
  market: { icon: <ShoppingBasket />, tone: "place", words: ["market", "fish market"] },
  cafe: { icon: <Coffee />, tone: "place", words: ["café", "cafe"] },
  museum: { icon: <Landmark />, tone: "place", words: ["museum"] },
  hq: { icon: <Building2 />, tone: "place", words: ["HQ"] },
  wharf: { icon: <Anchor />, tone: "place", words: ["wharf"] },
  barrel: { icon: <Barrel />, tone: "place", words: ["barrel"] },
  gathering: { icon: <PartyPopper />, tone: "gem", words: ["gathering", "gatherings"] },
} satisfies Record<string, { icon: ReactNode; tone: Tone; words: string[] }>;
export type KeywordKind = keyof typeof KEYWORDS;

const KIND_OF = new Map(Object.entries(KEYWORDS).flatMap(([kind, e]) => e.words.map(w => [w.toLowerCase(), kind as KeywordKind] as const)));
/** Any dictionary word standing alone (not inside another word), the longest first; a phrase's space may be any space. */
const WORDS = new RegExp(`(?<![\\p{L}'])(${[...KIND_OF.keys()].sort((a, b) => b.length - a.length).map(w => w.replace(/ /g, "\\s+")).join("|")})(?!\\p{L})`, "giu");

/** A line's parts: plain text, and keywords. `at`: where the part starts in the line. */
export type LinePart = { text: string; at: number; kind?: KeywordKind };
export function keywordParts(line: string): LinePart[] {
  const parts: LinePart[] = [];
  let last = 0;
  for (const m of line.matchAll(WORDS)) {
    const at = m.index;
    if (at > last) parts.push({ text: line.slice(last, at), at: last });
    parts.push({ text: m[0], at, kind: KIND_OF.get(m[0].toLowerCase().replace(/\s+/g, " "))! });
    last = at + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), at: last });
  return parts;
}

/** The keyword itself. `off`: not yet reached (a line typing out): its room is kept, its icon not shown. */
export function Keyword({ kind, off, children }: { kind: KeywordKind; off?: boolean; children: ReactNode }) {
  const e = KEYWORDS[kind];
  return <span className={k.word} data-tone={e.tone} data-off={off || undefined}><i className={k.icon} aria-hidden="true">{e.icon}</i>{children}</span>;
}
/** A whole line with its keywords. */
export function KeywordLine({ line }: { line: string }) {
  return <>{keywordParts(line).map(p => (p.kind ? <Keyword key={p.at} kind={p.kind}>{p.text}</Keyword> : <span key={p.at}>{p.text}</span>))}</>;
}
/** Every keyword kind, for the showroom. */
export const KEYWORD_KINDS = Object.keys(KEYWORDS) as KeywordKind[];
