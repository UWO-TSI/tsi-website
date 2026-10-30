/**
 * Hourly music block schedule (audio pass; ledger rows 84, 106, 112-114).
 *
 * Twelve two-hour blocks keyed to the real Toronto clock (the same
 * `torontoHour` the island's day/night phase already uses, so the block
 * follows real time including the DST jump for free). Each block loads
 * `/assets/audio/music/{block}.mp3` when it is listed in `MUSIC_FILES`, tries
 * a listed seasonal variant first, and otherwise falls back to the CC0
 * time-of-day track (Ninja Adventure, `public/audio/CREDITS.md`) until
 * David's Suno tracks land (see `web/public/assets/audio/music/README.md`).
 * The music channel is the member island's one music bed (David, 2026-10-30:
 * "theres liek 3 overlapping music"); the Stream Cafe tracks stay applicant-only.
 */
import { torontoHour } from "./islandTime";
import type { Season } from "./season";

export const MUSIC_BLOCKS = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"] as const;
export type MusicBlock = (typeof MUSIC_BLOCKS)[number];

/**
 * Interior beds override the outdoor hourly block; cafe gets its own slot. The sushi bar's speakers (near the bar or on
 * its stools while it's open) play its own slots, dinner jazz in the evening ("bar-evening") and bar jazz at night
 * ("bar-night"; David's Suno tracks). A slot without its file plays the time-of-day track.
 */
export type MusicOverride = "cafe" | "interior" | "bar-evening" | "bar-night" | null;

const MUSIC_DIR = "/assets/audio/music";

/**
 * The files in `public/assets/audio/music/` (names only). Only these are ever requested, so a block without its
 * track goes straight to the fallback instead of a 404 on every load (audit 2026-10 world item 19). Add a name here
 * when its file lands; `audioFiles.test.ts` checks every listed file is on disk.
 */
export const MUSIC_FILES: ReadonlySet<string> = new Set<string>(["bar-evening.mp3", "bar-night.mp3"]);

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

/**
 * The block's own files for the music bed, in order: the room override (cafe, interior, the bar's slots) first, else a
 * seasonal variant, then the plain block file, each only when it is in `files`. `AudioManager.setMusic` ends the list
 * on the time-of-day track, which is always on disk, and stays on the first one that decodes.
 */
export function buildMusicSrcList(block: MusicBlock, opts: { season?: Season | null; override?: MusicOverride } = {}, files: ReadonlySet<string> = MUSIC_FILES): string[] {
  const { season, override } = opts;
  const names = override ? [`${override}.mp3`] : season ? [`${block}-${season}.mp3`, `${block}.mp3`] : [`${block}.mp3`];
  return names.filter(name => files.has(name)).map(name => `${MUSIC_DIR}/${name}`);
}
