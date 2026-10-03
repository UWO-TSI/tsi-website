/**
 * Client-side multiplayer shapes (specs/multiplayer.md §5): what the client core (netStore, interp, the `?bots=N`
 * loopback) hands the renderer (NetWorld, RemoteAvatar, Nameplates, PresenceList, NetHud). Types and tiny pure helpers
 * only; the wire itself is ./protocol.
 */
import { AREAS, CARD_FAMILIES, CARD_FRAMES, FLAG, STUDY_STATES, hasFlag } from "./protocol";
import type { Area, CardFamily, CardFrame, EvKind, MoveClip, NetPlayer, PosePacket, RefusalKind, RosterEntry, SlowState, StudyState } from "./protocol";

/** A remote player's card and slow state, dequantized. Rebuilt when they change, never per frame. */
export interface RemotePlayer {
  sid: number;
  uid: string;
  name: string;
  /** The blue dot (row 223). */
  member: boolean;
  /** The look JSON (parseLook(JSON.parse(look))), "" for the default look. */
  look: string;
  level: number;
  family: CardFamily | null;
  /** The subclass key (classKit), "" for none. */
  kit: string;
  mastery: number;
  /** The equipped aura cosmetic key, "" for none. */
  aura: string;
  frame: CardFrame | null;
  area: Area;
  /** Dropped and inside the reconnection grace: dim the nameplate. */
  away: boolean;
  afk: boolean;
  /** A phone: rests on a seat with a phone icon (row 299). */
  mobile: boolean;
  showClass: boolean;
  typing: boolean;
  armed: boolean;
  /** "" | "glider" | `<kind>:<key>` (parseHeld). */
  held: string;
  /** The weapon key on the back, "". */
  weapon: string;
  /** A held clip (a seat, a fish hold), null for none. */
  pose: string | null;
  /** The claimed seat key, "". */
  seat: string;
  study: StudyState;
  /** When the study phase ends as a world-clock instant (epoch ms, against worldNow()), 0 for none. */
  studyEnds: number;
}

/** A schema player as a RemotePlayer; `epoch` is IslandState.epoch. Unknown indexes read as none (or the village). */
export function toRemotePlayer(p: NetPlayer, epoch: number): RemotePlayer {
  return {
    sid: p.sid, uid: p.uid, name: p.name, member: p.badge === 1, look: p.look, level: p.level,
    family: CARD_FAMILIES[p.family] ?? null, kit: p.kit, mastery: p.mastery, aura: p.aura, frame: CARD_FRAMES[p.frame] ?? null,
    area: AREAS[p.area] ?? "village",
    away: hasFlag(p.flags, FLAG.away), afk: hasFlag(p.flags, FLAG.afk), mobile: hasFlag(p.flags, FLAG.mobile),
    showClass: hasFlag(p.flags, FLAG.showClass), typing: hasFlag(p.flags, FLAG.typing), armed: hasFlag(p.flags, FLAG.armed),
    held: p.held, weapon: p.weapon, pose: p.pose || null, seat: p.seat, study: STUDY_STATES[p.study] ?? "none",
    studyEnds: p.studyEnds ? epoch + p.studyEnds : 0,
  };
}

/** A one-shot due this frame: `value` is a clip name (play, upper) or a length in world units (the land's drop). */
export interface RemoteEvent { kind: EvKind; value: number | string; t: number }
/** Event slots in a sample; more due in one frame wait for the next. */
export const REMOTE_EVENTS = 8;
/**
 * A remote's motion at render time, written by `RemoteEntry.sample` into an object the renderer owns and reuses every
 * frame. Continuous fields are interpolated; discrete ones step at their sample's time.
 */
export interface RemoteSample {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Radians. */
  yaw: number;
  move: MoveClip | null;
  air: number;
  leaf: number;
  lift: number;
  pose: string | null;
  held: string;
  weapon: string;
  /** FLAG bits. */
  flags: number;
  /** The position jumped this frame (a teleport, or a correction past the snap distance): no smoothing, trail or dust across it. */
  snapped: boolean;
  /** The first `eventCount` slots hold this frame's one-shots, in order; the objects are reused. */
  events: RemoteEvent[];
  eventCount: number;
}
export function createRemoteSample(): RemoteSample {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: null, air: 0, leaf: 0, lift: 0, pose: null, held: "", weapon: "", flags: 0, snapped: false,
    events: Array.from({ length: REMOTE_EVENTS }, (): RemoteEvent => ({ kind: "stop", value: 0, t: 0 })), eventCount: 0,
  };
}

/** One remote player in view. */
export interface RemoteEntry {
  readonly sid: number;
  /** Replaced (not mutated) on each change, so a changed card or slow state compares unequal. */
  readonly player: RemotePlayer;
  /**
   * Interpolate into `out` at room time `now` (ms since IslandState.epoch, on the shared world clock) minus this remote's
   * own delay (INTERP_DELAY_MS), moving due one-shots into `out.events`. Allocates nothing; returns `out`.
   */
  sample(now: number, out: RemoteSample): RemoteSample;
}
export type RemoteChange = "add" | "remove" | "change";
/**
 * Remote players in your view, never you. The renderer loops `for (let i = 0; i < reg.size; i++) reg.at(i)` inside
 * useFrame, which allocates nothing; the order may change when one is removed.
 */
export interface RemoteRegistry {
  readonly size: number;
  at(index: number): RemoteEntry;
  get(sid: number): RemoteEntry | undefined;
  /** add: came into view; remove: left it; change: card or slow state changed (not motion). Returns the unsubscribe. */
  subscribe(listener: (change: RemoteChange, entry: RemoteEntry) => void): () => void;
}

/** Why the connection stays down (joinRefusal's never cases, and auth once the token retry failed). */
export type KickReason = Exclude<RefusalKind, "busy" | "restart" | "unknown">;
export type NetStatus =
  | { kind: "off" }
  | { kind: "connecting" }
  | { kind: "joined"; shard: number }
  | { kind: "reconnecting" }
  /** Down; the next attempt at `retryAt` (Date.now() ms). */
  | { kind: "offline"; retryAt: number }
  | { kind: "kicked"; reason: KickReason };

/** Players per area in the shard, from the roster (NPC scaling, §5.8). */
export type AreaHeadcount = Readonly<Record<Area, number>>;
export function areaHeadcount(roster: readonly Pick<RosterEntry, "area">[]): AreaHeadcount {
  const counts = Object.fromEntries(AREAS.map(a => [a, 0])) as Record<Area, number>;
  for (const r of roster) {
    const a = AREAS[r.area];
    if (a) counts[a]++;
  }
  return counts;
}

/**
 * What NetWorld renders from: the Colyseus connection or the `?bots=N` loopback, the same either way. `status()` and
 * `roster()` return the same object until it changes (useSyncExternalStore snapshots).
 */
export interface NetSource {
  readonly remotes: RemoteRegistry;
  status(): NetStatus;
  /** The whole shard, you included (raw roster entries: AREAS[area], FLAG bits). */
  roster(): readonly RosterEntry[];
  /** Status or roster changed. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Room time now: ms since the room epoch on the shared world clock, what `RemoteEntry.sample` takes. */
  now(): number;
  /** Your motion (an encodePose packet); dropped unless joined. */
  sendPose(packet: PosePacket): void;
  /** What changed of your slow state; `area` first on a scene change. Dropped unless joined. */
  sendSlow(patch: SlowState): void;
  /** Leave the room and stop. */
  leave(): void;
}
