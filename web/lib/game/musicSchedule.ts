/**
 * Hourly music block schedule (audio pass; ledger rows 84, 106, 112-114).
 *
 * Twelve two-hour blocks keyed to the real Toronto clock (the same
 * `torontoHour` the island's day/night phase already uses, so the block
 * follows real time including the DST jump for free). Each block loads
 * `/assets/audio/music/{block}.mp3` when present, tries a seasonal variant
 * first when one is authored, and otherwise falls back to the two existing
 * applicant-island tracks (Ocean Railway / Willow Tree) until David's Suno
 * tracks land (see `web/public/audio/music/README.md`).
 */
import { torontoHour } from "./islandTime";
import type { Season } from "./season";

export const MUSIC_BLOCKS = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"] as const;
export type MusicBlock = (typeof MUSIC_BLOCKS)[number];

/** Interior beds override the outdoor hourly block; cafe gets its own slot. */
export type MusicOverride = "cafe" | "interior" | null;

const MUSIC_DIR = "/assets/audio/music";

/** Which 2-hour block a Toronto-local fractional hour (0-24) falls in. */
export function blockForHour(hour: number): MusicBlock {
  const wrapped = ((hour % 24) + 24) % 24;
  const startHour = Math.min(22, Math.floor(wrapped / 2) * 2);
  return String(startHour).padStart(2, "0") as MusicBlock;
}

/** The current block for a real instant (defaults to now). */
export function musicBlockAt(date: Date = new Date()): MusicBlock {
  return blockForHour(torontoHour(date));
}

// Roughly sunrise-to-sunset blocks get the brighter Ocean Railway loop; the
// rest get Willow Tree. Both are the applicant-island tracks named in
// `web/public/audio/CREDITS.md` — non-CC0, licence unverified for this reuse
// (see `specs/audio-pass-questions.md`).
const DAY_BLOCKS = new Set<MusicBlock>(["06", "08", "10", "12", "14", "16", "18"]);

export function fallbackTrackFor(block: MusicBlock): string {
  return DAY_BLOCKS.has(block) ? "/audio/ambient/applicant-ocean-railway.ogg" : "/audio/ambient/applicant-willow-tree.ogg";
}

/**
 * Ordered source candidates for the music channel: cafe/interior override
 * first, else a seasonal variant, then the plain block file, then the
 * guaranteed-to-exist fallback track. `AudioManager` tries each in turn and
 * stays on the first one that actually decodes.
 */
export function buildMusicSrcList(block: MusicBlock, opts: { season?: Season | null; override?: MusicOverride } = {}): string[] {
  const { season, override } = opts;
  if (override === "cafe") return [`${MUSIC_DIR}/cafe.mp3`, fallbackTrackFor(block)];
  if (override === "interior") return [`${MUSIC_DIR}/interior.mp3`, fallbackTrackFor(block)];
  const list: string[] = [];
  if (season) list.push(`${MUSIC_DIR}/${block}-${season}.mp3`);
  list.push(`${MUSIC_DIR}/${block}.mp3`);
  list.push(fallbackTrackFor(block));
  return list;
}
