"use client";

/**
 * The sender (specs/multiplayer.md §5.2, §4.3, §4.5): your avatar to the room. NetWorld calls `tick(player, dtMs)` from a
 * default-priority useFrame, after PlayerAvatar's (−4) has moved `player`; nothing here touches React.
 *
 * - **Motion:** `player` (the scene's shared position) with velocity by an exponentially smoothed finite difference
 *   (so InteriorPlayer, which has no sim, works the same), and the local avatar's CharacterMotion (yaw, lift, move,
 *   air, leaf) found through the tap (localAvatar.ts). Each send quantizes into one reused packet (encodePose).
 * - **When (SEND):** 10 Hz moving on the ground, 15 Hz while `move` is set, at once on an event (≥ 30 ms after the last
 *   send), at once on starting to move, one packet on stopping (velocity 0), then silence. A client-side mirror of the
 *   room's limits (`p` 20/s burst 30, events 8/s, emotes 1/s and 20 a minute) holds back what the room would drop:
 *   movement and clip events first, afterimages and the like after; an event left waiting over EVENT_MAX_AGE_MS goes.
 * - **Events:** the tap's journal (one-shots and every sim step's movement events), each with how long before the
 *   packet it happened (dtMs).
 * - **Teleports (§4.5):** the flag goes on the sample after a jump of over 2.5 u in one frame, and after a respawn
 *   (the sim's event), a seat snap (`tsi:sit`), a new tap registration or a swapped sim, when the position then jumps
 *   within SNAP_WINDOW_MS. Flags keep the room's budget (one per 2 s, 15 a minute); a sample the room would strike
 *   without one waits for it. The first sample after a join or a door starts the room's fresh baseline: no flag.
 * - **Slow state `s`, on change only (at most every SLOW_GAP_MS):** `held` from the tap; `weapon` (`armed`) from
 *   combat.rt.player, the weapon on your back while armed and not in hand; `pose` from the motion; `study` and
 *   `studyEnds` from getWorldStudy(); `afk` after AFK_MS without input; `seat`, the key `tsi:sit` brought (or the study
 *   seat's), claimed while the pose is a seat clip and given up when it isn't (PlayerAvatar's leaveSeat and
 *   InteriorPlayer clear `motion.pose` on standing up). `area` is the store's and `showClass` travels with the join and
 *   the store (netStore.ts). A rejoin (a fresh session on the server) sends everything again.
 */
import { combat } from "@/lib/game/combat/runtime";
import { getWorldStudy } from "@/lib/study/worldStore";
import { seatKey } from "@/lib/study/patrons";
import { armJournal, drainJournal, keepArmed, localAvatar, type LocalAvatar } from "./localAvatar";
import {
  AFK_MS, EV, EV_DT_MAX_MS, EV_MAX, PACKET_FLAG, RATE_LIMITS, SANITY, SEND, encodePose, heldOf, isClipName, isEmoteClip, isItemKey, isSeatKey,
  moveIndex, roomTime, studyIndex, type PosePacket, type SlowState,
} from "./protocol";
import type { NetSource } from "./types";

/** A position jump this big in one frame is a teleport, whatever caused it. */
export const TELEPORT_FRAME = 2.5;
/** After a respawn, a seat snap, a remount or a sim swap, a jump within this long is that teleport (ms). */
export const SNAP_WINDOW_MS = 250;
/** Over this small a jump in that window, nothing moved (a re-pose on the same seat). */
const SNAP_MIN = 0.05;
/** Velocity smoothing (s): short, so a jump's arc keeps its shape. */
export const VEL_TAU_S = 0.03;
/** An event not sent within this long is dropped: the remote would fire it too late anyway (ms). */
export const EVENT_MAX_AGE_MS = 500;
/** Slow-state messages at most this often (ms): the room takes 5 a second. */
export const SLOW_GAP_MS = 250;
/** A hidden tab's slow-state poll (ms): AFK and a study phase still go out while frames don't run. */
const HIDDEN_POLL_MS = 5000;
/** Slack under the room's teleport budget (ms): its clock is the receive time. */
const FLAG_SLACK_MS = 250;
/** A teleport this far waits for the flag's budget (a remote snaps it); a shorter one may go as a plain step (u). */
const FAR_TELEPORT = 3;
/** The longest a teleport waits for the budget before going plain anyway (ms). */
const FLAG_WAIT_MS = 3000;
const SEAT_CLIPS = new Set<string>(["Sit", "Study", "Stretch", "Sleep"]);
/** Juice the room may drop first when the events budget is short. */
const LOW_PRIORITY = new Set<number>([EV.ghost, EV.skid, EV.stand, EV.furl, EV.bonk]);
const PENDING = 32;

/** What netStore and the loopback add to a NetSource for the sender (any NetSource works without them). */
export interface SenderHints {
  /** Counts joins and rejoins: a fresh session on the server has none of your slow state. */
  readonly joinSeq?: number;
  /** Counts area changes: the room starts a new movement baseline. */
  readonly areaSeq?: number;
  /** IslandState.epoch (server ms): room time's zero, for `studyEnds`. */
  readonly epoch?: number;
}

/** Where the sender looks; tests replace them. */
export interface SenderDeps {
  /** performance.now() (ms). */
  clock(): number;
  avatar(): LocalAvatar | null;
  combat(): { armed: boolean; weapon: string };
  study(): { phase: string | null; endsAt: string | null; seated: { anchor: string; seat: number } | null };
  /** Listen on the window; returns the unlisten. */
  listen(type: string, fn: (e: Event) => void): () => void;
  /** A repeating timer; returns the stop. */
  every(ms: number, fn: () => void): () => void;
}
const DEFAULTS: SenderDeps = {
  clock: () => performance.now(),
  avatar: localAvatar,
  combat: () => combat.rt.player,
  study: () => {
    const s = getWorldStudy();
    return { phase: s.study?.session?.phase ?? null, endsAt: s.study?.session?.phase_ends_at ?? null, seated: s.seated };
  },
  listen: (type, fn) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(type, fn, { passive: true, capture: true });
    return () => window.removeEventListener(type, fn, { capture: true });
  },
  every: (ms, fn) => { const id = setInterval(fn, ms); return () => clearInterval(id); },
};

/** A token bucket like the room's limiters, with an optional per-minute cap. */
function bucket(perSecond: number, burst: number, perMinute = Infinity) {
  let tokens = burst, at = -Infinity;
  const minute: number[] = [];
  const refill = (now: number) => {
    tokens = at === -Infinity ? burst : Math.min(burst, tokens + ((now - at) * perSecond) / 1000);
    at = now;
    while (minute.length && now - minute[0] >= 60_000) minute.shift();
  };
  return {
    ready(now: number) { refill(now); return tokens >= 1 && minute.length < perMinute; },
    take(now: number) { refill(now); tokens -= 1; if (perMinute !== Infinity) minute.push(now); },
  };
}

export interface Sender {
  tick(player: { x: number; y: number; z: number }, dtMs: number): void;
  dispose(): void;
}

export function createSender(source: NetSource, deps: Partial<SenderDeps> = {}): Sender {
  const d: SenderDeps = { ...DEFAULTS, ...deps };
  const hints = source as NetSource & SenderHints;
  const disarm = armJournal(d.clock);
  const born = d.clock();

  // Sessions and registrations seen.
  let joinSeen = -1, areaSeen = -1, genSeen = -1, swapsSeen = -1;
  /** The next sample starts the room's baseline (a join, a door): at once, never flagged. */
  let fresh = true;
  // The last frame's position and the smoothed velocity.
  let px = NaN, py = NaN, pz = NaN, vx = 0, vy = 0, vz = 0, stillFrames = 0;
  // Teleports.
  let snapUntil = -Infinity, teleport = false, waitingSince = -Infinity;
  const flagTimes: number[] = [];
  // The last sample sent.
  let sentT = -Infinity, sentX = 0, sentY = 0, sentZ = 0, sentMoving = false, lastSend = -Infinity, seq = 0;
  const packet: PosePacket = [];
  const pose = { seq: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, flags: 0, ev: [] as (number | string)[] };
  const pBucket = bucket(RATE_LIMITS.p.perSecond, RATE_LIMITS.p.burst);
  const evBucket = bucket(RATE_LIMITS.events.perSecond, RATE_LIMITS.events.perSecond);
  const emoteBucket = bucket(RATE_LIMITS.emotes.perSecond, RATE_LIMITS.emotes.perSecond, RATE_LIMITS.emotes.perMinute);
  // Events waiting to go: a ring of kind, value, performance time.
  const pKind = new Int16Array(PENDING), pValue: (number | string)[] = new Array<number | string>(PENDING).fill(0), pAt = new Float64Array(PENDING);
  const pTaken = new Uint8Array(PENDING);
  let pStart = 0, pCount = 0;
  // Slow state: what was last sent (undefined: not since this session), what's current.
  const sent: { held?: string; weapon?: string; pose?: string; seat?: string; study?: number; studyEnds?: number; afk?: boolean } = {};
  let lastSlow = -Infinity, lastInput = born;
  let heldItem: LocalAvatar["held"] | undefined, heldStr = "";
  let endsAtSeen: string | null | undefined, endsAtMs = 0;
  /** The seat `tsi:sit` named last (null: none named; study seats come from getWorldStudy). */
  let sitKey: string | null = null;

  const pending = (kind: number, value: number | string, at: number) => {
    if (pCount === PENDING) { pStart = (pStart + 1) % PENDING; pCount--; }
    const i = (pStart + pCount++) % PENDING;
    pKind[i] = kind; pValue[i] = value; pAt[i] = at; pTaken[i] = 0;
  };
  const onJournal = (kind: number, value: number | string, at: number) => {
    if (kind === EV.respawn) snapUntil = Math.max(snapUntil, d.clock() + SNAP_WINDOW_MS);
    pending(kind, value, at);
  };

  const unlisten = [
    d.listen("tsi:sit", e => {
      const detail = (e as CustomEvent<{ key?: unknown }>).detail;
      sitKey = typeof detail?.key === "string" && isSeatKey(detail.key) ? detail.key : null;
      snapUntil = d.clock() + SNAP_WINDOW_MS;
    }),
    ...["keydown", "pointerdown", "pointermove", "wheel", "touchstart"].map(type => d.listen(type, () => { lastInput = d.clock(); })),
  ];
  const stopPoll = d.every(HIDDEN_POLL_MS, () => { if (source.status().kind === "joined") slow(d.clock(), true); });

  /** The flag's budget, as the room counts it. */
  function flagReady(now: number) {
    while (flagTimes.length && now - flagTimes[0] >= 60_000) flagTimes.shift();
    const last = flagTimes[flagTimes.length - 1];
    return (last === undefined || now - last >= SANITY.teleportGapMs + FLAG_SLACK_MS) && flagTimes.length < SANITY.teleportPerMinute;
  }
  /** Would the room strike this sample against the last one sent (its sanity checks, over sender time)? */
  function strikes(t: number, x: number, y: number, z: number) {
    const dt = t - sentT;
    if (dt > SANITY.dtMaxMs) return false; // a pause: the room starts over
    if (dt < SANITY.dtMinMs) return true;
    const sec = dt / 1000, h = Math.hypot(x - sentX, z - sentZ), dy = y - sentY, hs = h / sec, k = 0.98;
    return hs > SANITY.speed * k || dy / sec > Math.max(SANITY.rise, SANITY.climbRatio * hs) * k || -dy / sec > SANITY.fall * k
      || (dt <= SANITY.teleportWindowMs && Math.hypot(h, dy) > Math.max(SANITY.teleportDist, (SANITY.speedAvg * dt) / 1000) * k);
  }

  /** Pick up to EV_MAX waiting events the room's budgets allow: movement and clips first, then the rest. */
  function packEvents(now: number) {
    pose.ev.length = 0;
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < pCount && pose.ev.length < EV_MAX * 3; n++) {
      const i = (pStart + n) % PENDING;
      if (pTaken[i] || LOW_PRIORITY.has(pKind[i]) !== (pass === 1)) continue;
      if (!evBucket.ready(now)) return;
      const emote = (pKind[i] === EV.play || pKind[i] === EV.upper) && isEmoteClip(pValue[i]);
      if (emote && !emoteBucket.ready(now)) continue;
      evBucket.take(now);
      if (emote) emoteBucket.take(now);
      pTaken[i] = 1;
      pose.ev.push(pKind[i], pValue[i], Math.min(EV_DT_MAX_MS, Math.max(0, Math.round(now - pAt[i]))));
    }
  }
  /** Drop what was sent and what waited too long; keep the rest in order. */
  function compact(now: number) {
    let w = 0;
    for (let n = 0; n < pCount; n++) {
      const i = (pStart + n) % PENDING;
      if (pTaken[i] || now - pAt[i] > EVENT_MAX_AGE_MS) continue;
      const j = (pStart + w++) % PENDING;
      pKind[j] = pKind[i]; pValue[j] = pValue[i]; pAt[j] = pAt[i]; pTaken[j] = 0;
    }
    pCount = w;
  }

  function send(now: number, t: number, x: number, y: number, z: number, m: LocalAvatar["motion"]["current"], moving: boolean, flag: boolean) {
    pose.seq = seq = (seq + 1) & 0xffff;
    pose.t = t;
    pose.x = x; pose.y = y; pose.z = z;
    const still = !moving || flag;
    pose.vx = still ? 0 : vx; pose.vy = still ? 0 : vy; pose.vz = still ? 0 : vz;
    pose.yaw = m.yaw; pose.lift = m.lift;
    pose.move = moveIndex(m.move);
    pose.air = m.air ?? 0; pose.leaf = m.leaf ?? 0;
    pose.flags = flag ? PACKET_FLAG.teleport : 0;
    packEvents(now);
    source.sendPose(encodePose(pose, packet));
    pBucket.take(now);
    compact(now);
    if (flag) flagTimes.push(now);
    sentT = t; sentX = x; sentY = y; sentZ = z; sentMoving = moving; lastSend = now;
  }

  /** Slow state on change (`force`: the hidden tab's poll, which has no frame). */
  function slow(now: number, force = false) {
    if (!force && now - lastSlow < SLOW_GAP_MS) return;
    const reg = d.avatar(), m = reg?.motion.current ?? null;
    let patch: SlowState | null = null;
    // The item in hand, as a string only when it changed (no string a frame).
    if (reg?.held !== heldItem) { heldItem = reg?.held; heldStr = heldItem ? heldOf(heldItem.kind, heldItem.key) : ""; }
    if (heldStr !== sent.held) (patch ??= {}).held = heldStr;
    const c = d.combat(), weapon = c.armed && heldItem?.kind !== "weapon" && isItemKey(c.weapon) ? c.weapon : "";
    if (weapon !== sent.weapon) (patch ??= {}).weapon = weapon;
    const p = m?.pose && isClipName(m.pose) ? (m.pose as string) : "";
    if (p !== sent.pose) (patch ??= {}).pose = p;
    // The seat: claimed while the pose is a seat clip, the key tsi:sit named or the study seat's; given up on standing.
    const study = d.study();
    let seat = "";
    if (SEAT_CLIPS.has(p)) seat = sitKey ?? (study.seated ? seatKey(study.seated) : "");
    else sitKey = null;
    if (!isSeatKey(seat)) seat = "";
    if (seat !== sent.seat) (patch ??= {}).seat = seat;
    const phase = studyIndex(study.phase);
    if (study.endsAt !== endsAtSeen) { endsAtSeen = study.endsAt; endsAtMs = study.endsAt ? Date.parse(study.endsAt) : 0; }
    const epoch = hints.epoch;
    const ends = phase && endsAtMs && epoch !== undefined ? roomTime(endsAtMs, epoch) : 0;
    if (phase !== sent.study) (patch ??= {}).study = phase;
    if (ends !== sent.studyEnds) (patch ??= {}).studyEnds = ends;
    const afk = now - lastInput > AFK_MS;
    if (afk !== sent.afk) (patch ??= {}).afk = afk;
    if (!patch) return;
    source.sendSlow(patch);
    Object.assign(sent, patch);
    lastSlow = now;
  }

  function offline() {
    // Gone from the room: the next join starts fresh, events from now don't carry over.
    fresh = true;
    pCount = 0;
    drainJournal(() => {});
  }

  return {
    tick(player, dtMs) {
      const now = d.clock();
      if (source.status().kind !== "joined") { offline(); return; }
      const reg = d.avatar(), m = reg?.motion.current;
      if (!reg || !m) return;
      keepArmed();
      // A new session, a new area, a remount, a swapped sim.
      const join = hints.joinSeq ?? 0, area = hints.areaSeq ?? 0;
      if (join !== joinSeen) {
        joinSeen = join; fresh = true;
        for (const k of Object.keys(sent) as (keyof typeof sent)[]) delete sent[k];
      }
      if (area !== areaSeen) { areaSeen = area; fresh = true; }
      if (reg.generation !== genSeen) { if (genSeen >= 0) snapUntil = now + SNAP_WINDOW_MS; genSeen = reg.generation; swapsSeen = reg.simSwaps; }
      if (reg.simSwaps !== swapsSeen) { swapsSeen = reg.simSwaps; snapUntil = now + SNAP_WINDOW_MS; }
      drainJournal(onJournal);

      // Where you are, and how fast, by difference over the frame (smoothed).
      const x = player.x, y = player.y, z = player.z, dt = dtMs / 1000;
      if (fresh || px !== px) {
        px = x; py = y; pz = z; vx = vy = vz = 0; stillFrames = 0;
      } else {
        const dx = x - px, dy = y - py, dz = z - pz, jump = Math.hypot(dx, dy, dz);
        if (jump > TELEPORT_FRAME || (now < snapUntil && jump > SNAP_MIN)) {
          teleport = true; snapUntil = -Infinity; vx = vy = vz = 0; stillFrames = 0;
        } else if (dt > 0) {
          const k = 1 - Math.exp(-dt / VEL_TAU_S);
          vx += (dx / dt - vx) * k; vy += (dy / dt - vy) * k; vz += (dz / dt - vz) * k;
          stillFrames = jump < 0.001 ? stillFrames + 1 : 0;
        }
        px = x; py = y; pz = z;
      }
      const moving = !(stillFrames >= 2 && moveIndex(m.move) === 0);

      // A send this frame?
      const gap = now - lastSend;
      if (gap >= SEND.eventGapMs && pBucket.ready(now)) {
        const interval = 1000 / (moveIndex(m.move) ? SEND.moveHz : SEND.groundHz);
        // Events send at once while the room's events budget has room; otherwise they wait for the next timed send.
        const events = pCount > 0 && evBucket.ready(now);
        const want = fresh || teleport || events || (moving && (!sentMoving || gap >= interval)) || (!moving && sentMoving);
        if (want) {
          const t = Math.max(Math.round(source.now()), sentT + SANITY.dtMinMs);
          let flag = false, go = true;
          if (!fresh) {
            const strike = strikes(t, x, y, z);
            if (teleport || strike) {
              if (flagReady(now)) flag = true;
              else {
                // No flag to spend: a step the room would strike, or a far jump a remote should snap, waits for one
                // (FLAG_WAIT_MS at most for the far jump); a near one goes plain once the room would take it.
                if (waitingSince === -Infinity) waitingSince = now;
                go = !strike && !(teleport && Math.hypot(x - sentX, y - sentY, z - sentZ) > FAR_TELEPORT && now - waitingSince < FLAG_WAIT_MS);
              }
            }
          }
          if (go) {
            send(now, t, x, y, z, m, moving, flag);
            teleport = false;
            fresh = false;
            waitingSince = -Infinity;
          }
        }
      }
      if (pCount > 0) compact(now);
      slow(now);
    },
    dispose() {
      for (const u of unlisten) u();
      stopPoll();
      disarm();
    },
  };
}
