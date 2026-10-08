/**
 * Time tags on resident lines (specs/polish/audit-2026-10-world.md item 20): a line may open with `@morning` (or
 * `@evening,night`, any of TIME_TAGS) and is then said only at that time of day; untagged lines are said any time.
 * Dependency-free, so the NPC chat route can read them too (lib/content/talk.ts re-exports them).
 */
import type { IslandPhase } from "@/lib/game/islandTime";

/** When a tagged line is said: an island phase, or the morning (dawn, or the day before noon) or the afternoon (the day from noon). */
export const TIME_TAGS = ["morning", "afternoon", "dawn", "day", "evening", "night"] as const;
export type TimeTag = (typeof TIME_TAGS)[number];
export const TIME = /^\s*@([a-z]+(?:,[a-z]+)*)\s*/i;
export const isTimeTag = (w: string): w is TimeTag => (TIME_TAGS as readonly string[]).includes(w);

/** "@morning Morning!" → the rest of the line and its times (null: untagged, said any time). Unknown tags are left in the words. */
export function lineTime(raw: string): { text: string; times: TimeTag[] | null } {
  const m = raw.match(TIME), tags = m?.[1].toLowerCase().split(",");
  return m && tags && tags.every(isTimeTag) ? { text: raw.slice(m[0].length).trim(), times: tags } : { text: raw.trim(), times: null };
}
/** Whether a line tagged `times` is said in this phase at this Toronto hour (0-24). */
export function saidAt(times: readonly TimeTag[] | null, phase: IslandPhase, hour: number): boolean {
  if (!times) return true;
  return times.some(t => t === phase || (t === "morning" && (phase === "dawn" || (phase === "day" && hour < 12))) || (t === "afternoon" && phase === "day" && hour >= 12));
}
/** The lines (raw, tags and all) said now: the untagged ones and those tagged for now. */
export function linesNow(lines: readonly string[], phase: IslandPhase, hour: number): string[] {
  return lines.filter(l => saidAt(lineTime(l).times, phase, hour));
}

/** The lines said at any time of day, their tags left off (somewhere without a clock); all of them when every one is tagged. */
export function untimed(lines: readonly string[]): string[] {
  const any = lines.filter(l => !lineTime(l).times);
  return (any.length ? any : lines).map(l => lineTime(l).text);
}
