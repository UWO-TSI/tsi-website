/**
 * What residents say when you talk to them (specs/polish/reachability.md deliverable 1; rows 123, 218): authored text
 * boxes, no AI at runtime. A resident's `talk` (npc_personas.talk, migration 20261003161600_resident_talk) is a list of
 * conversations; a conversation is one to four boxes; a box may open with an expression in brackets, which their
 * painted face shows while they say it ("[happy] Oh! Hi."). `{name}` is the member's island name. Admins write them in
 * the Residents editor (principle 8), next to the bubble lines (`canned_dialogue`) they say in passing.
 */
import { hashSeed } from "@/lib/game/character/look";
import { EXPRESSIONS, type Expression } from "@/lib/game/character/face";
import { PROPOSED_RESIDENTS } from "./residentRoster";
import type { NPCPersona } from "./types";

export const TALK_LIMITS = { conversations: 12, lines: 4, chars: 200 } as const;
export interface TalkLine { text: string; face: Expression | null }
export type Conversation = TalkLine[];

const MARK = /^\s*\[([a-z]+)\]\s*/i;
const isExpression = (w: string): w is Expression => (EXPRESSIONS as readonly string[]).includes(w);

/** "[happy] Oh! Hi." → the words and the face; an unknown word in brackets is just words. */
export function parseTalkLine(raw: string): TalkLine {
  const m = raw.match(MARK), face = m?.[1].toLowerCase();
  return m && face && isExpression(face) ? { text: raw.slice(m[0].length).trim(), face } : { text: raw.trim(), face: null };
}

/** The server's check on a draft's `talk` (null when it can be said). */
export function validateTalk(v: unknown): string | null {
  if (!Array.isArray(v) || v.some(c => !Array.isArray(c))) return "talk: a list of conversations, each a list of lines";
  if (v.length > TALK_LIMITS.conversations) return `talk: up to ${TALK_LIMITS.conversations} conversations`;
  for (const c of v as unknown[][]) {
    if (c.length < 1 || c.length > TALK_LIMITS.lines) return `talk: each conversation has 1-${TALK_LIMITS.lines} lines`;
    for (const l of c) {
      if (typeof l !== "string") return "talk: lines are text";
      const m = l.match(MARK);
      if (m && !isExpression(m[1].toLowerCase())) return `talk: "[${m[1]}]" isn't an expression (${EXPRESSIONS.join(", ")})`;
      const words = m ? l.slice(m[0].length).trim() : l.trim();
      if (!words) return "talk: a line is empty";
      if (l.length > TALK_LIMITS.chars) return `talk: lines are up to ${TALK_LIMITS.chars} characters`;
    }
  }
  return null;
}

/** Said when a resident has nothing authored at all (an admin's new resident before their lines are in). */
const FILLER: Conversation[] = [
  [{ text: "Oh, hello! Lovely day for a walk.", face: "happy" }, { text: "I'm still finding my way around, to be honest.", face: null }],
  [{ text: "Have you been down to the water today?", face: null }, { text: "The light on it this time of day... worth a look.", face: "happy" }],
];

/**
 * A resident's conversations: their own (`talk`), else the proposed roster's for their slug (a live row saved before
 * the column existed), else their bubble lines one box each, else gentle fillers. Never empty.
 */
export function talkFor(p: Pick<NPCPersona, "slug" | "canned_dialogue"> & { talk?: string[][] | null }): Conversation[] {
  const own = p.talk?.filter(c => c.length);
  const source = own?.length ? own : PROPOSED_RESIDENTS.find(r => r.slug === p.slug)?.talk;
  if (source?.length) return source.map(c => c.map(parseTalkLine).filter(l => l.text));
  const bubble = (p.canned_dialogue ?? []).filter(l => l.trim());
  return bubble.length ? bubble.map(l => [parseTalkLine(l)]) : FILLER;
}

/** Which conversation: the day picks where to start, and each talk after moves on to the next (row 92: no counters kept). */
export function pickConversation(count: number, slug: string, day: string, talks: number): number {
  return count > 0 ? (hashSeed(`${slug}:${day}`) + talks) % count : 0;
}

/** `{name}` → the member's island name; without one, the name and the comma before it go. */
export function fillName(text: string, name: string | null): string {
  if (name) return text.replaceAll("{name}", name);
  return text.replace(/,\s*\{name\}/g, "").replace(/^\{name\}[!,.]?\s*/, "").replaceAll("{name}", "").replace(/\s{2,}/g, " ").trim();
}
