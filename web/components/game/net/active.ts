"use client";

/**
 * Who else is here, for the code outside NetWorld (specs/multiplayer.md §5.7, §5.8): the study seats, the café
 * patrons, the residents, the village benches and the people list read it from this one place (the status and the
 * roster themselves are lib/net/netStore's hooks). NetWorld sets the source while multiplayer is on; off it stays null,
 * every read returns a constant and nothing subscribes to anything.
 *
 * Snapshots for useSyncExternalStore are primitives or objects kept until they change. `liveRemotes` is the frame
 * loop's side: where each drawn remote stands this frame (the driver writes it at priority -3, before anything at the
 * default priority reads it), in preallocated arrays.
 */
import { useSyncExternalStore } from "react";
import { AREAS, type Area, type RosterEntry } from "@/lib/net/protocol";
import type { NetSource } from "@/lib/net/types";

interface Live { source: NetSource | null; area: Area | null }
const live: Live = { source: null, area: null };
const listeners = new Set<() => void>();
let unhook: (() => void) | null = null;
const NO_ROSTER: readonly RosterEntry[] = [];
const NO_UIDS: ReadonlySet<string> = new Set();
let uids: ReadonlySet<string> = NO_UIDS, uidsDirty = true;

function notify() { for (const l of listeners) l(); }
function onRemotes() { uidsDirty = true; notify(); }

/** NetWorld's: the source it renders from (null when off) and the area the player is in. */
export function setActiveNet(source: NetSource | null, area: Area | null) {
  if (live.source === source && live.area === area) return;
  if (live.source !== source) {
    unhook?.();
    unhook = null;
    live.source = source;
    uidsDirty = true;
    liveRemotes.n = 0;
    if (source) {
      const offStatus = source.subscribe(notify), offRemotes = source.remotes.subscribe(onRemotes);
      unhook = () => { offStatus(); offRemotes(); };
    }
  }
  live.area = area;
  notify();
}

export const activeNet = () => live.source;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Players in `area` on the shard's roster (you included when you're there). */
export function areaCount(roster: readonly RosterEntry[], area: Area): number {
  const at = AREAS.indexOf(area);
  let n = 0;
  for (let i = 0; i < roster.length; i++) if (roster[i].area === at) n++;
  return n;
}
/** Everyone in `area` but you: the roster includes you once joined, wherever `here` (your own area) is that area. */
export function othersIn(roster: readonly RosterEntry[], area: Area, joined: boolean, here: Area | null): number {
  return Math.max(0, areaCount(roster, area) - (joined && here === area ? 1 : 0));
}
/** How many players are in an area of the shard (spec §5.8: every client in a shard agrees, it's room state). */
export function useAreaHeadcount(area: Area): number {
  return useSyncExternalStore(subscribe, () => areaCount(live.source?.roster() ?? NO_ROSTER, area), () => 0);
}
/** The other players in an area: 0 when offline or alone (spec §5.8: then everyone shows). */
export function useOthersIn(area: Area): number {
  return useSyncExternalStore(subscribe, () => {
    const s = live.source;
    return s ? othersIn(s.roster(), area, s.status().kind === "joined", live.area) : 0;
  }, () => 0);
}

/** The user ids of the players in your view (your room): the same set until someone comes, goes or changes. */
export function remoteUids(): ReadonlySet<string> {
  if (!uidsDirty) return uids;
  uidsDirty = false;
  const reg = live.source?.remotes;
  if (!reg || !reg.size) return (uids = NO_UIDS);
  let same = uids.size === reg.size;
  for (let i = 0; i < reg.size && same; i++) same = uids.has(reg.at(i).player.uid);
  if (same) return uids;
  const next = new Set<string>();
  for (let i = 0; i < reg.size; i++) next.add(reg.at(i).player.uid);
  return (uids = next);
}
export function useRemoteUids(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, remoteUids, () => NO_UIDS);
}

/** A seat (bench slot or study seat key) another player in your view holds (their `s {seat}` claim). */
export function remoteSeatTaken(key: string): boolean {
  const reg = live.source?.remotes;
  if (!reg) return false;
  for (let i = 0; i < reg.size; i++) if (reg.at(i).player.seat === key) return true;
  return false;
}

/** Room for every player a shard holds (SHARD.max is 40). */
export const LIVE_MAX = 64;
/**
 * Where the remotes in view stand this frame (feet, world space), written by the driver at priority -3; `n` of them.
 * The café's patrons yield to these as they do to you.
 */
export const liveRemotes = { n: 0, x: new Float64Array(LIVE_MAX), z: new Float64Array(LIVE_MAX) };
/** Is any remote in view within `r` of (x, z)? */
export function remoteNear(x: number, z: number, r: number): boolean {
  for (let i = 0; i < liveRemotes.n; i++) if (Math.hypot(liveRemotes.x[i] - x, liveRemotes.z[i] - z) < r) return true;
  return false;
}
