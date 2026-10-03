/**
 * The `?bots=N` loopback (specs/multiplayer.md §5.9): a NetSource with no server, so remote avatars, LOD and nameplates
 * can be built and measured without one. Bots (botBrain.ts) send what a client sends; a stand-in for the island room
 * does what the server does with it, and the renderer sees exactly what a real connection would deliver:
 * - pose packets are decoded with the contract's codec, their integers copied into the bot's schema player (the tp
 *   counter bumped on a teleport flag), and each copy reaches the remote's interpolation ring as the schema would;
 * - events go out as `e [sid, t − dtMs, kind, value]` through encodeEvent and back through decodeEvent;
 * - slow state is checked with parseSlowState and applied as the room's onSlow applies it;
 * - views: a bot is in yours while it shares your area and that area isn't private; the roster has everyone, you too.
 * `?netsim=lat:120,jit:60,loss:0.03` delays and loses what arrives (interp.ts).
 *
 * Bots step in lockstep, 1/120 s at a time, so a seed plays the same however the time is chunked. While started, a
 * timer steps them every TICK_MS; tests step by hand (`advance`).
 */
import { botArea, createBots, type Bot } from "./botBrain";
import { RemoteBuffer, Remotes, type Netsim } from "./interp";
import {
  AREAS, FLAG, PACKET_FLAG, decodeEvent, decodePose, encodeEvent, hasFlag, isPrivateArea, nextTp, parseSlowState, createPose,
  type Area, type NetPlayer, type PosePacket, type RosterEntry, type SlowState,
} from "./protocol";
import { toRemotePlayer, type NetSource, type NetStatus } from "./types";

/** How often a started loopback steps its bots (ms). */
export const TICK_MS = 33;
/** Behind by more than this (a hidden tab), bots skip the gap rather than replay it (ms). */
const CATCH_UP_MS = 1000;
/** At most this many bots. */
export const MAX_BOTS = 64;
const STEP_MS = 1000 / 120;

export interface LoopbackOptions {
  bots: number;
  seed?: number;
  netsim?: Netsim | null;
  /** Room time in ms; by default performance.now() from creation. */
  clock?: () => number;
  /** Step with a timer while started (default true); tests call `advance`. */
  timer?: boolean;
}

/** `?bots=N` (and `?seed=`): the loopback's options, or null without a valid count. */
export function loopbackFromSearch(search: string): { bots: number; seed: number } | null {
  const q = new URLSearchParams(search), raw = q.get("bots"), n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0 || n > MAX_BOTS) return null;
  const seed = Number(q.get("seed") ?? 1);
  return { bots: n, seed: Number.isInteger(seed) ? seed : 1 };
}

/** A bot as the room holds it. */
interface Peer {
  bot: Bot;
  sid: number;
  uid: string;
  player: NetPlayer;
  /** It has sent a pose: `player` holds real motion. */
  live: boolean;
  entry: RemoteBuffer | null;
}

/** The loopback NetSource, and what netStore drives it with. */
export interface Loopback extends NetSource {
  readonly remotes: Remotes;
  /** Join as `area` (netStore's acquire): bots start stepping, you join the roster. */
  start(area: Area): void;
  /** Leave (netStore's release). */
  stop(): void;
  /** Your scene changed: views follow. */
  setArea(area: Area): void;
  /** Step every bot to `toMs` (default: now). */
  advance(toMs?: number): void;
  readonly bots: readonly Bot[];
  /** What you sent (tests): pose packets and slow-state patches. */
  readonly sent: { poses: number; slow: SlowState[] };
}

export function createLoopback(o: LoopbackOptions): Loopback {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const clock = o.clock ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
  const n = Math.max(0, Math.min(MAX_BOTS, Math.floor(o.bots)));
  const remotes = new Remotes();
  const listeners = new Set<() => void>();
  const sent = { poses: 0, slow: [] as SlowState[] };
  const epoch = 0;
  let status: NetStatus = { kind: "off" };
  let area: Area = "village";
  let started = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let roster: readonly RosterEntry[] = [];
  /** The bots' common clock: the next lockstep time. */
  let stepT = 0;

  const bots = createBots(n, o.seed ?? 1, 0);
  const peers: Peer[] = bots.map((bot, i) => {
    const c = bot.card;
    const player: NetPlayer = {
      sid: i + 1, uid: `bot-${String(i + 1).padStart(2, "0")}`, name: c.name, badge: c.badge, look: c.look, level: c.level, family: c.family, kit: c.kit,
      mastery: c.mastery, aura: c.aura, frame: c.frame,
      area: botArea(c), flags: (c.mobile ? FLAG.mobile : 0) | (c.showClass ? FLAG.showClass : 0), held: "", weapon: "", pose: "", seat: "", study: 0, studyEnds: 0,
      t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, tp: 0,
    };
    return { bot, sid: i + 1, uid: player.uid, player, live: false, entry: null };
  });

  const emit = () => { for (const l of listeners) l(); };
  const rebuildRoster = () => {
    const list: RosterEntry[] = peers.map(p => ({ uid: p.uid, name: p.player.name, badge: p.player.badge, area: p.player.area, flags: p.player.flags }));
    if (started) list.push({ uid: "local", name: "You", badge: 0, area: AREAS.indexOf(area), flags: FLAG.showClass });
    roster = list;
  };
  rebuildRoster();

  const inView = (p: Peer) => started && !isPrivateArea(area) && AREAS[p.player.area] === area;
  /** Bring views in line with areas: the server's view rebuild. */
  const views = () => {
    const now = clock();
    for (const p of peers) {
      const want = inView(p);
      if (want && !p.entry) {
        p.entry = new RemoteBuffer(p.sid, toRemotePlayer(p.player, epoch), o.netsim ?? null);
        // What the schema hands over when someone comes into view: their state as it is.
        if (p.live) p.entry.pushWire(p.player, now);
        remotes.add(p.entry);
      } else if (!want && p.entry) {
        remotes.remove(p.sid);
        p.entry = null;
      }
    }
  };

  // ── The island room's message handlers, for one bot ──
  const scratch = createPose(), mine = createPose(), evOut: (number | string)[] = [], evIn = { sid: 0, t: 0, kind: 0, value: 0 as number | string };
  const onPose = (p: Peer, packet: PosePacket) => {
    const pose = decodePose(packet, scratch);
    if (!pose) return;
    const a = packet as number[], pl = p.player;
    pl.t = a[1]; pl.x = a[2]; pl.y = a[3]; pl.z = a[4]; pl.vx = a[5]; pl.vy = a[6]; pl.vz = a[7]; pl.yaw = a[8];
    pl.move = a[9]; pl.air = a[10]; pl.leaf = a[11]; pl.lift = a[12];
    if (hasFlag(pose.flags, PACKET_FLAG.teleport)) pl.tp = nextTp(pl.tp);
    p.live = true;
    if (!p.entry) return;
    const now = clock();
    p.entry.pushWire(pl, now);
    for (let i = 0; i + 2 < pose.ev.length; i += 3) {
      const e = encodeEvent({ sid: p.sid, t: pose.t - (pose.ev[i + 2] as number), kind: pose.ev[i] as number, value: pose.ev[i + 1] }, evOut);
      const d = e && decodeEvent(e, evIn);
      if (d) p.entry.pushEvent(d.t, d.kind, d.value, now);
    }
  };
  const onSlow = (p: Peer, patch: SlowState) => {
    const m = parseSlowState(patch);
    if (!m) return;
    const pl = p.player;
    let rosterChanged = false;
    if (m.area !== undefined && m.area !== pl.area) { pl.area = m.area; rosterChanged = true; }
    if (m.held !== undefined) pl.held = m.held;
    if (m.weapon !== undefined) { pl.weapon = m.weapon; pl.flags = m.weapon ? pl.flags | FLAG.armed : pl.flags & ~FLAG.armed; rosterChanged = true; }
    if (m.pose !== undefined) pl.pose = m.pose;
    if (m.seat !== undefined) pl.seat = m.seat;
    if (m.study !== undefined) pl.study = m.study;
    if (m.studyEnds !== undefined) pl.studyEnds = m.studyEnds;
    if (m.showClass !== undefined) { pl.flags = m.showClass ? pl.flags | FLAG.showClass : pl.flags & ~FLAG.showClass; rosterChanged = true; }
    if (m.afk !== undefined) { pl.flags = m.afk ? pl.flags | FLAG.afk : pl.flags & ~FLAG.afk; rosterChanged = true; }
    if (p.entry) {
      p.entry.setPlayer(toRemotePlayer(pl, epoch), clock());
      remotes.changed(p.entry);
    }
    if (m.area !== undefined) views();
    if (rosterChanged) { rebuildRoster(); emit(); }
  };
  const outboxes = peers.map(p => ({ pose: (packet: PosePacket) => onPose(p, packet), slow: (patch: SlowState) => onSlow(p, patch) }));

  const advance = (toMs = clock()) => {
    if (toMs - stepT > CATCH_UP_MS) stepT = toMs - STEP_MS; // a slept tab: skip ahead, don't replay
    // Lockstep: every bot takes each 1/120 s step before any takes the next.
    for (; stepT + STEP_MS <= toMs; stepT += STEP_MS) for (let i = 0; i < peers.length; i++) {
      const b = peers[i].bot;
      if (b.time + CATCH_UP_MS < stepT) b.skipTo(stepT);
      b.advance(stepT + STEP_MS, outboxes[i]);
    }
  };

  const source: Loopback = {
    remotes,
    bots,
    sent,
    status: () => status,
    roster: () => roster,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    now: () => clock(),
    sendPose(packet) { if (status.kind === "joined" && decodePose(packet, mine)) sent.poses++; },
    sendSlow(patch) {
      if (status.kind !== "joined") return;
      const m = parseSlowState(patch);
      if (!m) return;
      sent.slow.push(m);
      if (m.area !== undefined) source.setArea(AREAS[m.area]);
    },
    leave() { source.stop(); },
    start(next) {
      area = next;
      if (started) { source.setArea(next); return; }
      started = true;
      stepT = Math.max(stepT, clock() - STEP_MS);
      status = { kind: "joined", shard: 1 };
      advance();
      views();
      rebuildRoster();
      if (o.timer !== false && typeof setInterval !== "undefined") timer = setInterval(() => advance(), TICK_MS);
      emit();
    },
    stop() {
      if (!started) return;
      started = false;
      if (timer) clearInterval(timer);
      timer = null;
      status = { kind: "off" };
      views();
      rebuildRoster();
      emit();
    },
    setArea(next) {
      if (next === area) return;
      area = next;
      views();
      rebuildRoster();
      emit();
    },
    advance,
  };
  return source;
}
