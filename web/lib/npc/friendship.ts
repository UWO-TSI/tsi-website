/**
 * Resident friendship (d-friends, specs/launch/v1-gameplay.md; 20261029062600_resident_friendship.sql), in half hearts
 * (David 2026-10-28: "make it half a heart and like giving them stuff ... gifts increase a heart, non like stuff no
 * increase, ok like half heart, and hate -1 heart"). A whole talk with a resident (to its last line), the day's first, adds half a heart; one gift a
 * day moves it by their taste (TASTE_HALVES). Each whole heart reached brings a reward once: odd hearts a letter from
 * them (here: the copy), even hearts a small coin gift (the database pays it, friend_gift_coins x heart / 2).
 */
import { RESIDENT_GIFTS, type GiftTastes } from "@/lib/content/residentRoster";

export const FRIEND_MAX = 5;
export const FRIEND_HALVES = FRIEND_MAX * 2;

export type Taste = "love" | "like" | "meh" | "hate";
/** What a gift does, in half hearts: loved +1 heart, liked +1/2, neither 0, hated -1. */
export const TASTE_HALVES: Record<Taste, number> = { love: 2, like: 1, meh: 0, hate: -2 };

/** How `slug` takes a gift of `key` (its collection `category`): an item named outright wins over its category. */
export function giftTaste(slug: string, key: string, category: string | null, tastes: Readonly<Record<string, GiftTastes>> = RESIDENT_GIFTS): Taste {
  const t = tastes[slug];
  if (!t) return "meh";
  for (const by of [key, category]) {
    if (!by) continue;
    if (t.hates.includes(by)) return "hate";
    if (t.loves.includes(by)) return "love";
    if (t.likes.includes(by)) return "like";
  }
  return "meh";
}

/** What they say to a gift (a talk line: "[face] words"). */
export function tasteLine(taste: Taste): string {
  switch (taste) {
    case "love": return "[happy] For me? Oh, I love this!";
    case "like": return "Oh, that's kind of you. Thank you!";
    case "meh": return "Hm. Thanks, I suppose.";
    case "hate": return "[sad] Oh. I really don't like these.";
  }
}

/** The whole hearts a move from `was` to `level` (half hearts) newly reaches. */
export const heartsReached = (was: number, level: number): number[] =>
  Array.from({ length: Math.max(0, Math.floor(level / 2) - Math.floor(was / 2)) }, (_, i) => Math.floor(was / 2) + i + 1);

/** The letter a whole heart brings (odd hearts), signed by the resident; null for a gift heart. */
export function friendLetter(heart: number, name: string): { subject: string; body: string } | null {
  switch (heart) {
    case 1: return { subject: `A note from ${name}`, body: `Hello again! I liked our chat today. The island feels a little friendlier with you on it. Come find me tomorrow?\n\n${name}` };
    case 3: return { subject: `${name} saved you a seat`, body: `You keep stopping by, and I've started looking out for you. If you ever want company while you fish or wander, you know where to find me.\n\n${name}` };
    case 5: return { subject: `Best friends, says ${name}`, body: `All these chats and little gifts! I think that makes us proper friends. Thank you for always saying hi. The island is better with you on it.\n\nYour friend, ${name}` };
    default: return null;
  }
}

/** What the island says when a move reached a whole heart (null when it reached none). */
export function friendNote(r: { was: number; level: number; coins: number }, name: string): string | null {
  const hearts = heartsReached(r.was, r.level);
  if (!hearts.length) return null;
  const top = hearts[hearts.length - 1];
  if (r.coins > 0) return `${name} gave you ${r.coins} coins. ${top} hearts!`;
  if (hearts.some(h => friendLetter(h, name))) return top >= FRIEND_MAX ? `You and ${name} are best friends! A letter came.` : `${name} sent you a letter. ${top} ${top === 1 ? "heart" : "hearts"}!`;
  return null;
}
