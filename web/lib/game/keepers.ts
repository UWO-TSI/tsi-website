/**
 * The service residents at their posts indoors (specs/polish/interiors.md deliverable 1): who staffs each room, where
 * they stand behind their counter and the little work loop they keep there (the café owner's routine, cafe.ts
 * `ownerAt`, on the shared world clock), and when they turn to you and say hello. Room space as each room's: +x on
 * screen left, the camera looking up +z from the cut-away near wall, so a keeper facing the room faces yaw π.
 *
 * The residents are the roster's (lib/content/residentRoster.ts): the persona holding the post wins (the Residents
 * editor); until one does, the proposed resident for it stands there (Wren, Toren, Odile, Sable, Bram).
 */
import type { OwnerStation } from "./cafe";
import type { ResidentPost } from "@/lib/content/residents";

export type KeeperRoom = "hq" | "shop" | "oracle" | "museum" | "wharf";
export interface KeeperPost {
  post: ResidentPost;
  /** The proposed roster's resident for the post (residentRoster.ts PROPOSED_RESIDENTS and RESIDENT_LOOKS). */
  slug: string;
  /** The nameplate's second line. */
  title: string;
  /** Behind the counter, in walking order (yaw π faces the room). */
  stations: OwnerStation[];
}

const ROOM = Math.PI;
export const KEEPER_POSTS: Record<KeeperRoom, KeeperPost> = {
  // HQ: behind the front desk (lib/game/clubhouse.ts HQ_LAYOUT.desk at -5.2, -2.4, HQ_FRONT_DESK), between it and its
  // chair, facing the room: its counter is low enough that the walking camera sees her from the hips up.
  hq: { post: "hq_lead", slug: "wren", title: "HQ lead", stations: [
    { at: [-5.05, -1.78], yaw: ROOM, stay: 7, clip: "Idle" },
    { at: [-4.7, -1.78], yaw: ROOM, stay: 6.5, clip: "Trace" },   // the post tray
    { at: [-5.55, -1.78], yaw: ROOM, stay: 1.3, clip: "Forage" }, // under the counter
  ] },
  // Shop: behind the counter and register (ShopInterior: counter at 0, 3.4, its back at z 3.9).
  shop: { post: "shopkeeper", slug: "shopkeeper", title: "Shopkeeper", stations: [
    { at: [0.1, 4.3], yaw: ROOM, stay: 7, clip: "Idle" },
    { at: [-0.3, 4.3], yaw: ROOM, stay: 6, clip: "Trace" },       // the register
    { at: [0.45, 4.3], yaw: ROOM, stay: 1.3, clip: "Forage" },    // under the counter's end
  ] },
  // Oracle: beside the altar (0, 2.6), tending the crystal and the candles.
  oracle: { post: "oracle_keeper", slug: "oracle-keeper", title: "Oracle keeper", stations: [
    { at: [1.75, 3.25], yaw: ROOM + 0.45, stay: 8, clip: "Idle" },
    { at: [1.05, 3.75], yaw: Math.atan2(-1.05, -1.15), stay: 6, clip: "Trace" }, // hands to the crystal
    { at: [1.6, 1.88], yaw: ROOM, stay: 1.3, clip: "Forage" },                    // the front candle at 1.6, 1.5
  ] },
  // Museum: behind the curator's desk (MuseumInterior: desk at -2.2, -1.3).
  museum: { post: "museum_curator", slug: "curator", title: "Museum curator", stations: [
    { at: [-2.2, -0.58], yaw: ROOM, stay: 7, clip: "Idle" },
    { at: [-2.8, -0.58], yaw: ROOM, stay: 6.5, clip: "Trace" },   // labelling
    { at: [-1.6, -0.6], yaw: ROOM, stay: 1.3, clip: "Forage" },   // a specimen drawer
  ] },
  // The wharf shack (lab bench): behind its counter (0, 2.6).
  wharf: { post: "wharf_keeper", slug: "wharf-keeper", title: "Wharf keeper", stations: [
    { at: [0, 3.4], yaw: ROOM, stay: 7, clip: "Idle" },
    { at: [-0.6, 3.4], yaw: ROOM, stay: 1.3, clip: "Forage" },
  ] },
};

/** How close before a keeper notices you: the nameplate and the "!" show, they turn to you, and (after a quiet spell) say hello. */
export const KEEPER_NOTICE = 4.2;
/** A hello at most this often. */
export const KEEPER_QUIET_S = 25;
/** A line's bubble stays up this long. */
export const KEEPER_BUBBLE_S = 4.6;
/** The hello as you come in waits this long after the room fades in. */
export const KEEPER_ENTRY_S = 0.7;
/** How far a keeper turns from where they work to face you (they stay behind their counter). */
export const KEEPER_TURN = 1.7;

/** Where a keeper faces: you while they notice you or talk (never more than KEEPER_TURN off their work), else their work. */
export function keeperYaw(rest: number, kx: number, kz: number, px: number, pz: number, attend: boolean): number {
  if (!attend) return rest;
  const toYou = Math.atan2(px - kx, pz - kz);
  const off = Math.atan2(Math.sin(toYou - rest), Math.cos(toYou - rest));
  return rest + Math.max(-KEEPER_TURN, Math.min(KEEPER_TURN, off));
}

/**
 * Whether a keeper says hello now: once as you come in (`entry`, after the fade), then each time you walk up from
 * further away, after the quiet spell; never over a line they are already saying.
 */
export function keeperGreets(entry: boolean, near: boolean, wasNear: boolean, now: number, quietUntil: number, talking: boolean): boolean {
  if (talking) return false;
  return entry || (near && !wasNear && now >= quietUntil);
}

/** Seconds of talking (the painted mouth) for a line: about a syllable a beat, a little lead-in. */
export const talkSeconds = (line: string) => Math.min(3.2, 0.8 + line.length * 0.045);
