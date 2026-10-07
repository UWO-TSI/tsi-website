/**
 * Hourly music block schedule (audio pass; ledger rows 84, 106, 112-114).
 *
 * Twelve two-hour blocks keyed to the real Toronto clock (the same
 * `torontoHour` the island's day/night phase already uses, so the block
 * follows real time including the DST jump for free). Each block loads
 * `/assets/audio/music/{block}.mp3` when it is listed in `MUSIC_FILES`, tries
 * a listed seasonal variant first, and otherwise falls back to the two
 * existing applicant-island tracks (Ocean Railway / Willow Tree) until
 * David's Suno tracks land (see `web/public/assets/audio/music/README.md`).
 */
import { torontoHour } from "./islandTime";
import type { Season } from "./season";

export const MUSIC_BLOCKS = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"] as const;
export type MusicBlock = (typeof MUSIC_BLOCKS)[number];

/** Interior beds override the outdoor hourly block; cafe gets its own slot. */
export type MusicOverride = "cafe" | "interior" | null;

const MUSIC_DIR = "/assets/audio/music";

/**
 * The files in `public/assets/audio/music/` (names only). Only these are ever requested, so a block without its
 * track goes straight to the fallback instead of a 404 on every load (audit 2026-10 world item 19). Add a name here
 * when its file lands; `audioFiles.test.ts` checks every listed file is on disk.
 */
export const MUSIC_FILES: ReadonlySet<string> = new Set<string>([]);

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
 * guaranteed-to-exist fallback track, each only when it is in `files`.
 * `AudioManager` tries each in turn and stays on the first one that decodes.
 */
export function buildMusicSrcList(block: MusicBlock, opts: { season?: Season | null; override?: MusicOverride } = {}, files: ReadonlySet<string> = MUSIC_FILES): string[] {
  const { season, override } = opts;
  const names = override ? [`${override}.mp3`] : season ? [`${block}-${season}.mp3`, `${block}.mp3`] : [`${block}.mp3`];
  const list = names.filter(name => files.has(name)).map(name => `${MUSIC_DIR}/${name}`);
  list.push(fallbackTrackFor(block));
  return list;
}
