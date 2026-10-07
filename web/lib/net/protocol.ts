/**
 * The multiplayer wire contract (specs/multiplayer.md §1.1, §2–§4, §6): what the Colyseus server (realtime/, through
 * tsconfig paths `@net/*`), the client core and the renderer all build against. Pure TypeScript that imports nothing,
 * so esbuild bundles it into the server and Next into the page, and the server's Docker context needs only
 * web/lib/net. It changes only through the coordinator; any change to what crosses the wire bumps PROTOCOL.
 *
 * Units: decoded values are world units (1 tile), milliseconds and radians; wire values are the integers the
 * quantizers below make. Tables marked append-only are wire indexes: add at the end, never reorder, rename or remove
 * (protocol.test.ts locks them), and bump PROTOCOL when you add.
 *
 * Where the spec left a choice, this file makes it:
 * 1. Event kinds `play`, `upper`, `ghost` and `stop` are §4.2's clip one-shot, upper-body one-shot, afterimage and
 *    stop, named for the CharacterMotion fields they set. `recover` isn't relayed: its clip (LandHeavy) arrives as
 *    a `play` and it has no juice of its own.
 * 2. `ev` is the packet's 15th element, omitted when there are no events. `value` is a clip name for play and upper,
 *    otherwise a length (the drop for land, roll and splash, the rise for mantle, else 0) in cm on the wire. `dtMs`
 *    is how long before the packet's `t` the event happened; the server relays it at `t − dtMs`.
 * 3. The pose packet's flags carry only TELEPORT (bit 7); receivers see a teleport as a change of Player.tp. Presence
 *    bits travel in `s` and the server sets them.
 * 4. `studyEnds` is on the room timeline like `t` (ms since IslandState.epoch; 0: none): epoch milliseconds don't fit
 *    32 bits. That timeline wraps at TIME_MAX (49.7 days), so a shard should be drained before it gets that old.
 * 5. Area bounds: the spec gives the village (|x|, |z| ≤ 40, y −3..25) and interiors (≤ 20). The ruins (a 40×66 map)
 *    and the home island are outdoor scenes and take the village's; the house is an interior; all share its y range.
 * 6. `seat` (a bench slot or study seat key) is in `s` and on Player: §8's bench slots read "room seat claims
 *    (`s {seat}`)", which §4.1 had no field for.
 * 7. `held` takes `shovel:<key>` too: the spec's list predates the shovel on the tool wheel.
 * 8. The card's badge, family and frame are indexes into CARD_BADGES, CARD_FAMILIES and CARD_FRAMES; `frame` is the
 *    equipped mastery frame, the only frames the world nameplate draws.
 * 9. World chat (M2, §6) is two messages: `chat {text}` up, and `line` down to the whole shard, the sender included
 *    (their copy is the acceptance). A line carries the server's id (the world_chat_messages row a report names) and
 *    the sender's world name. A refused line gets `sys {kind: "refused", reason, text}` instead. Reports and blocks
 *    are HTTP routes (/api/world/report, /api/world/blocks), not messages. Added before anything was deployed, so
 *    PROTOCOL stayed 1; the server deploys before any client that sends `chat` (an unknown type closes with 4002).
 */

// ── Version and connecting ────────────────────────────────────────

/** The join's `v`; a mismatch closes with CLOSE.version. */
export const PROTOCOL = 1;
/**
 * The one room (§3). To connect: `const client = new Client(NEXT_PUBLIC_REALTIME_URL)`, then at once
 * `client.http.options.credentials = "omit"`: @colyseus/sdk sends the matchmake fetch with credentials included by
 * default and the server never allows credentials (§1.4), so without it the browser refuses the response. Then
 * `client.auth.token = <Supabase access token>` and `client.joinOrCreate(ROOM_NAME, joinOptions)`.
 */
export const ROOM_NAME = "island";
/**
 * Message types (§4.2). Client to server: p, s, ping, refresh, chat. Server to client: e, pong, sys, line (and state
 * patches).
 */
export const MSG = { pose: "p", slow: "s", ping: "ping", refresh: "refresh", chat: "chat", event: "e", pong: "pong", sys: "sys", line: "line" } as const;
/** Dev tokens (`DEV_AUTH=1`, refused in production): `dev:<name>`, as `?mp=dev&as=Alice` and the bots send. */
export const DEV_TOKEN_PREFIX = "dev:";
/** The most a client message may weigh (the WebSocket transport's maxPayload). */
export const MAX_PAYLOAD_BYTES = 4096;

export interface JoinOptions {
  /** PROTOCOL. A different `v`, or options that don't parse, close with CLOSE.version: the page is out of date ("Reload"). */
  v: number;
  /** AREAS index of the scene you're in. */
  area: number;
  /** A phone (row 299): a resting avatar, and the longer reconnection grace. */
  mobile: boolean;
  showClass: boolean;
}
/** The join's options, or null (CLOSE.version); `mobile` defaults to false and `showClass` to true. Any `v` parses: compare it. */
export function parseJoinOptions(x: unknown): JoinOptions | null {
  if (!isRecord(x)) return null;
  const { v, area, mobile = false, showClass = true } = x;
  if (!isUint(v, 0xffff) || !isIndex(area, AREAS.length) || typeof mobile !== "boolean" || typeof showClass !== "boolean") return null;
  return { v, area, mobile, showClass };
}

// ── Close codes and join refusals ─────────────────────────────────

/**
 * Our close codes (§3). They sit at 41xx to stay clear of Colyseus' own (COLYSEUS_CLOSE), except `restart`, which is
 * Colyseus' MAY_TRY_RECONNECT: the SDK tries to reconnect on it by itself, then the client rejoins after jitter.
 * A join refusal reaches the client in one of two forms:
 * - an HTTP status on the matchmake POST, thrown in the room's static onAuth: 401 auth, 403 origin (HTTP_REFUSAL);
 * - a WebSocket close thrown in onJoin: 4101 auth (or no profile), 4102 removed, 4106 version, 4107 busy (the card
 *   RPC timed out or the database is down).
 * Once joined, the server may close with 4102 (removed, M2), 4103 (kicked for movement), 4104 (replaced by a newer
 * tab) or 4010 (restart). `joinRefusal` turns any of these, and Colyseus' own, into what the client does.
 */
export const CLOSE = { auth: 4101, removed: 4102, kicked: 4103, replaced: 4104, version: 4106, busy: 4107, restart: 4010 } as const;
export const HTTP_REFUSAL = { auth: 401, origin: 403 } as const;
/**
 * Colyseus 0.18's own closes: CONSENTED (a leave), SERVER_SHUTDOWN, WITH_ERROR (a failed join, a message flood),
 * FAILED_TO_RECONNECT (a failed reconnect, a stale duplicate) and MAY_TRY_RECONNECT. Bare, the first four mean a
 * dropped connection; CONSENTED after our own leave() means stay off.
 */
export const COLYSEUS_CLOSE = { consented: 4000, serverShutdown: 4001, withError: 4002, failedToReconnect: 4003, mayTryReconnect: 4010 } as const;
/** `left`: the close that followed our own leave(). `unknown`: a dropped connection (abnormal, Colyseus' 4000–4003, a 5xx). */
export type RefusalKind = keyof typeof CLOSE | "origin" | "left" | "unknown";
/**
 * - `token-once`: refresh the token and retry once, then stay offline;
 * - `backoff`: rejoin after REJOIN_BACKOFF_S (inside the grace window the SDK reconnects first by itself);
 * - `jitter`: rejoin after a random 0..RESTART_JITTER_MS;
 * - `never`: stay offline and say why ("Play here" for replaced, "Reload" for version), or nothing after our own leave.
 */
export type RetryPolicy = "token-once" | "backoff" | "jitter" | "never";
export interface JoinRefusal { readonly kind: RefusalKind; readonly retry: RetryPolicy }
const refusal = (kind: RefusalKind, retry: RetryPolicy): JoinRefusal => Object.freeze({ kind, retry });
const REFUSALS = new Map<number, JoinRefusal>([
  [HTTP_REFUSAL.auth, refusal("auth", "token-once")], [CLOSE.auth, refusal("auth", "token-once")],
  [HTTP_REFUSAL.origin, refusal("origin", "never")],
  [CLOSE.removed, refusal("removed", "never")], [CLOSE.kicked, refusal("kicked", "never")], [CLOSE.replaced, refusal("replaced", "never")],
  [CLOSE.version, refusal("version", "never")], [CLOSE.busy, refusal("busy", "backoff")], [CLOSE.restart, refusal("restart", "jitter")],
]);
const LEFT = refusal("left", "never"), DROPPED = refusal("unknown", "backoff");
/**
 * What the client does about an HTTP status or a WebSocket close code. `ownLeave`: the close followed our own
 * room.leave() (Colyseus answers it with CONSENTED), so we stay off whatever the code says.
 */
export const joinRefusal = (code: number, ownLeave = false): JoinRefusal => (ownLeave ? LEFT : (REFUSALS.get(code) ?? DROPPED));
/** Rejoin delays in seconds; the last repeats. */
export const REJOIN_BACKOFF_S = [2, 4, 8, 16, 30] as const;
/** A restart (4010): everyone rejoins after a random 0..3 s, not all at once. */
export const RESTART_JITTER_MS = 3000;

// ── Areas ─────────────────────────────────────────────────────────

/** The scene you're in (§3). Append-only. */
export const AREAS = ["village", "cafe", "hq", "museum", "oracle", "ruins", "home", "house"] as const;
export type Area = (typeof AREAS)[number];
/**
 * Hidden: they see nobody and nobody sees them, but they stay in the roster ("In the ruins", "On their island").
 * Nothing done there is shown to anyone, so the sanity checks protect nothing there (and the solo ruins' combat
 * blinks and knockbacks outrun the caps by design).
 */
export const PRIVATE_AREAS: readonly Area[] = ["ruins", "home", "house"];
export const isPrivateArea = (area: Area) => PRIVATE_AREAS.includes(area);
/** Where a body can be: |x| and |z| ≤ half, yMin ≤ y ≤ yMax (§4.5). */
export interface AreaBounds { readonly half: number; readonly yMin: number; readonly yMax: number }
const OUTDOOR: AreaBounds = { half: 40, yMin: -3, yMax: 25 }, INDOOR: AreaBounds = { half: 20, yMin: -3, yMax: 25 };
export const AREA_BOUNDS: Readonly<Record<Area, AreaBounds>> = {
  village: OUTDOOR, cafe: INDOOR, hq: INDOOR, museum: INDOOR, oracle: INDOOR, ruins: OUTDOOR, home: OUTDOOR, house: INDOOR,
};
export function inAreaBounds(area: Area, x: number, y: number, z: number): boolean {
  const b = AREA_BOUNDS[area];
  return Math.abs(x) <= b.half && Math.abs(z) <= b.half && y >= b.yMin && y <= b.yMax;
}

// ── Enums ─────────────────────────────────────────────────────────

/** `move`: the movement state held over locomotion (PlayerAvatar's motion.move); 0 is none. Append-only. */
export const MOVE_CLIPS = [null, "Air", "Fall", "Glide", "Skid", "Slide", "CrouchWalk", "CrouchIdle"] as const;
export type MoveClip = Exclude<(typeof MOVE_CLIPS)[number], null>;
export function moveIndex(clip: string | null | undefined): number {
  const i = clip ? MOVE_CLIPS.indexOf(clip as MoveClip) : 0;
  return i < 0 ? 0 : i;
}

/**
 * Player.flags and RosterEntry.flags (§4.1), all set by the server: away (onDrop, cleared onReconnect), afk (`s.afk`),
 * mobile (the join), showClass (the join, then `s.showClass`), typing (M2 chat), armed (`s.weapon` isn't empty).
 */
export const FLAG = { away: 1, afk: 2, mobile: 4, showClass: 8, typing: 16, armed: 32 } as const;
/** The pose packet's flags: TELEPORT snaps rather than interpolates (when the sender sets it: POSE_FIELDS). */
export const PACKET_FLAG = { teleport: 128 } as const;
const PACKET_FLAGS_KNOWN = PACKET_FLAG.teleport;
export const hasFlag = (flags: number, bit: number) => (flags & bit) !== 0;
/** Player.tp after one more teleport (uint8, wraps). */
export const nextTp = (tp: number) => (tp + 1) & 0xff;
/** A teleport happened between two observations of a player's `tp`: any change counts, the wrap from 255 to 0 too. */
export const tpChanged = (seen: number, tp: number) => seen !== tp;

/** `study` (§3): the study table phase, for remote overhead timers. Append-only. */
export const STUDY_STATES = ["none", "seated", "focus", "break"] as const;
export type StudyState = (typeof STUDY_STATES)[number];
/** A study session phase (lib/study/rules Phase) as its index; ended or none is 0. */
export function studyIndex(phase: string | null | undefined): number {
  const i = phase ? STUDY_STATES.indexOf(phase as StudyState) : 0;
  return i < 0 ? 0 : i;
}

/** The card's enums (§2.2), each append-only; index 0 is none. Members get the blue dot (row 223). */
export const CARD_BADGES = [null, "member"] as const;
export const CARD_FAMILIES = [null, "Arcane", "Ranger", "Vanguard", "Warden"] as const;
export const CARD_FRAMES = [null, "bronze", "silver", "gold"] as const;
export type CardFamily = Exclude<(typeof CARD_FAMILIES)[number], null>;
export type CardFrame = Exclude<(typeof CARD_FRAMES)[number], null>;
const indexIn = (table: readonly (string | null)[], value: string | null | undefined) => (value ? Math.max(0, table.indexOf(value)) : 0);
export const cardBadge = (badge: string | null | undefined) => indexIn(CARD_BADGES, badge);
export const cardFamily = (family: string | null | undefined) => indexIn(CARD_FAMILIES, family);
/** The equipped frame cosmetic ("mastery:silver") as its CARD_FRAMES index; shop frames and none are 0. */
export const cardFrame = (equipped: string | null | undefined) => indexIn(CARD_FRAMES, equipped?.startsWith("mastery:") ? equipped.slice(8) : null);
/** The name for a member without a world name (never profiles.display_name, row 222). */
export const NAME_FALLBACK = "Islander";
/** The card's look JSON is capped at this many bytes. */
export const LOOK_MAX_BYTES = 2048;

// ── Events ────────────────────────────────────────────────────────

/**
 * Event kinds (§4.2): the motion one-shots, then the movement juice (lib/game/movement/sim's event kinds but
 * `recover`). Append-only.
 */
export const EV_KINDS = ["play", "upper", "ghost", "stop", "jump", "hop", "long", "dashjump", "land", "dash", "slide", "dashslide", "landslide",
  "slidejump", "stand", "glide", "furl", "mantle", "roll", "skid", "bonk", "splash", "respawn"] as const;
export type EvKind = (typeof EV_KINDS)[number];
/** Each kind's index: `EV.land`. */
export const EV = Object.fromEntries(EV_KINDS.map((k, i) => [k, i])) as { readonly [K in EvKind]: number };
/** Events in one pose packet. */
export const EV_MAX = 4;
/** The oldest an event may be against its packet's `t`. */
export const EV_DT_MAX_MS = 2000;
/** Kinds whose value is a clip name. */
export const isClipEv = (kind: number) => kind === EV.play || kind === EV.upper;
/** The emote menu's clips (character/clips EMOTE_CLIPS): a play or upper event with one counts against RATE_LIMITS.emotes. */
export const EMOTE_CLIP_NAMES = ["Wave", "Dance", "Laugh", "Cheer", "Sad"] as const;
export const isEmoteClip = (name: unknown) => typeof name === "string" && (EMOTE_CLIP_NAMES as readonly string[]).includes(name);

// ── Strings on the wire ───────────────────────────────────────────

const CLIP_RE = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const SEAT_RE = /^[A-Za-z0-9_.:#/-]{1,64}$/;
/** A clip name: what `pose`, play and upper carry. Receivers still apply only clips their rig has. */
export const isClipName = (s: unknown): s is string => typeof s === "string" && CLIP_RE.test(s);
/** A weapon, tool or item key. */
export const isItemKey = (s: unknown): s is string => typeof s === "string" && KEY_RE.test(s);
/** A seat claim: a bench slot or study seat key. */
export const isSeatKey = (s: unknown): s is string => typeof s === "string" && SEAT_RE.test(s);
/** `held` (§4.1): "" (empty hands), "glider", or `<kind>:<key>`. */
export const HELD_KINDS = ["rod", "net", "shovel", "pin", "weapon"] as const;
export type HeldKind = (typeof HELD_KINDS)[number];
/** A tool wheel item (WheelItem kind and key) as `held`; "" when it can't be one. */
export function heldOf(kind: string, key: string): string {
  if (kind === "glider") return "glider";
  return (HELD_KINDS as readonly string[]).includes(kind) && isItemKey(key) ? `${kind}:${key}` : "";
}
export function parseHeld(held: string): { kind: HeldKind | "glider"; key: string } | null {
  if (held === "glider") return { kind: "glider", key: "" };
  const i = held.indexOf(":"), kind = held.slice(0, i) as HeldKind, key = held.slice(i + 1);
  return i > 0 && HELD_KINDS.includes(kind) && isItemKey(key) ? { kind, key } : null;
}
export const isHeld = (s: unknown): s is string => typeof s === "string" && (s === "" || parseHeld(s) !== null);

// ── Quantization ──────────────────────────────────────────────────

/** Positions, lengths and velocities go as centimetres: int16 covers ±327.67 u. */
export const POS_SCALE = 100;
/** Velocities clamp to ±40 u/s (above every speed the kit reaches). */
export const VEL_MAX = 40;
/** Yaw: a uint16 turn, 2π/65536 a step. */
export const YAW_STEPS = 65536;
/** The leaf glider's size runs 0..1.3 (it pops a little past open). */
export const LEAF_MAX = 1.3;
/** `lift` (seat height) goes as int16 millimetres. */
export const LIFT_SCALE = 1000;
/** The time base: uint32 ms since the room epoch. */
export const TIME_MAX = 0xffffffff;
const I16_MIN = -32768, I16_MAX = 32767, VEL_Q = VEL_MAX * POS_SCALE, TAU = 2 * Math.PI;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Round, with NaN and −0 as 0 (±Infinity is left for the clamp). */
const round = (v: number) => Math.round(v) || 0;

export const quantPos = (u: number) => clamp(round(u * POS_SCALE), I16_MIN, I16_MAX);
export const dequantPos = (cm: number) => cm / POS_SCALE;
export const quantVel = (v: number) => clamp(round(v * POS_SCALE), -VEL_Q, VEL_Q);
export const dequantVel = (cms: number) => cms / POS_SCALE;
export function quantYaw(rad: number): number {
  const s = Math.round((rad / TAU) * YAW_STEPS) % YAW_STEPS;
  return Number.isFinite(s) ? (s + YAW_STEPS) % YAW_STEPS : 0;
}
/** Radians in [0, 2π). */
export const dequantYaw = (q: number) => (q * TAU) / YAW_STEPS;
/** The Air clip's phase 0..1 (airPhase) in a byte. */
export const quantAir = (a: number) => clamp(round(a * 255), 0, 255);
export const dequantAir = (b: number) => b / 255;
export const quantLeaf = (l: number) => clamp(round((l / LEAF_MAX) * 255), 0, 255);
export const dequantLeaf = (b: number) => (b * LEAF_MAX) / 255;
export const quantLift = (u: number) => clamp(round(u * LIFT_SCALE), I16_MIN, I16_MAX);
export const dequantLift = (mm: number) => mm / LIFT_SCALE;
export const quantTime = (ms: number) => clamp(round(ms), 0, TIME_MAX);
/** A world-clock instant on the room timeline (§4.7: `t = Date.now() + offset − state.epoch`). */
export const roomTime = (worldMs: number, epoch: number) => quantTime(worldMs - epoch);
/** Pose sequence numbers are uint16 and wrap: is `a` newer than `b`? */
export const seqAfter = (a: number, b: number) => a !== b && ((a - b) & 0xffff) < 0x8000;

// ── The pose packet `p` ───────────────────────────────────────────

/**
 * §4.2's array, in order: `[seq, t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, flags, ev?]`. The motion fields
 * share their names with Player's, so after a decode the server can copy the packet's own integers into the schema.
 *
 * PACKET_FLAG.teleport: the sender sets it on the sample that lands a respawn (the `respawn` event, a splash's
 * respawn included) and a seat snap (`tsi:sit`) themselves, as well as on a jump over 2.5 u in one frame and a new
 * tap registration (§5.2). A 1–2 u respawn 30–100 ms after the last sample otherwise reads as 15–60 u/s and is struck.
 */
export const POSE_FIELDS = ["seq", "t", "x", "y", "z", "vx", "vy", "vz", "yaw", "move", "air", "leaf", "lift", "flags"] as const;
export const POSE_LEN = 14;
/** Each field's wire range (flags must also be known bits). */
const POSE_RANGE: readonly (readonly [number, number])[] = [
  [0, 0xffff], [0, TIME_MAX], [I16_MIN, I16_MAX], [I16_MIN, I16_MAX], [I16_MIN, I16_MAX], [-VEL_Q, VEL_Q], [-VEL_Q, VEL_Q], [-VEL_Q, VEL_Q],
  [0, YAW_STEPS - 1], [0, MOVE_CLIPS.length - 1], [0, 255], [0, 255], [I16_MIN, I16_MAX], [0, 255],
];
/** Events: a flat list of up to EV_MAX triples `[kind, value, dtMs]`, value a clip name or a length in world units (decision 2). */
export type EvList = (number | string)[];
export type PosePacket = (number | EvList)[];
/** A motion sample, decoded (world units, radians; `move` a MOVE_CLIPS index, `flags` PACKET_FLAG bits). */
export interface Pose {
  seq: number; t: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number;
  move: number; air: number; leaf: number; lift: number; flags: number;
  ev: EvList;
}
export const createPose = (): Pose => ({ seq: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, flags: 0, ev: [] });
/** Add an event to a pose's list; false once it holds EV_MAX. */
export function pushEv(ev: EvList, kind: number, value: number | string, dtMs: number): boolean {
  if (ev.length >= EV_MAX * 3) return false;
  ev.push(kind, value, dtMs);
  return true;
}

const isKind = (k: unknown): k is number => typeof k === "number" && Number.isInteger(k) && k >= 0 && k < EV_KINDS.length;
/** An event value as it goes on the wire, or null when it can't. */
function evValueOut(kind: number, value: unknown): number | string | null {
  if (isClipEv(kind)) return isClipName(value) ? value : null;
  return typeof value === "number" ? quantPos(value) : null;
}
/** A wire event value decoded, or null when it's malformed. */
function evValueIn(kind: number, value: unknown): number | string | null {
  if (isClipEv(kind)) return isClipName(value) ? value : null;
  return isInt(value, I16_MIN, I16_MAX) ? dequantPos(value) : null;
}

/** The ev list each caller's packet reuses, so steady encoding allocates nothing. */
const evOut = new WeakMap<PosePacket, EvList>();

/**
 * Quantize a sample into `out` (reused; the transport serializes it at once). Events that can't go are dropped (a bad
 * kind or clip name), the rest are capped at EV_MAX with dtMs clamped to 0..EV_DT_MAX_MS. Never throws, never NaN.
 */
export function encodePose(p: Pose, out: PosePacket = []): PosePacket {
  out[0] = (Math.trunc(p.seq) || 0) & 0xffff;
  out[1] = quantTime(p.t);
  out[2] = quantPos(p.x); out[3] = quantPos(p.y); out[4] = quantPos(p.z);
  out[5] = quantVel(p.vx); out[6] = quantVel(p.vy); out[7] = quantVel(p.vz);
  out[8] = quantYaw(p.yaw);
  out[9] = Number.isInteger(p.move) && p.move >= 0 && p.move < MOVE_CLIPS.length ? p.move : 0;
  out[10] = quantAir(p.air); out[11] = quantLeaf(p.leaf); out[12] = quantLift(p.lift);
  out[13] = p.flags & PACKET_FLAGS_KNOWN;
  let ev = evOut.get(out);
  if (!ev) evOut.set(out, (ev = []));
  ev.length = 0;
  for (let i = 0; i + 2 < p.ev.length && ev.length < EV_MAX * 3; i += 3) {
    const kind = p.ev[i], value = isKind(kind) ? evValueOut(kind, p.ev[i + 1]) : null, dt = p.ev[i + 2];
    if (value === null || typeof dt !== "number") continue;
    ev.push(kind as number, value, clamp(round(dt), 0, EV_DT_MAX_MS));
  }
  if (ev.length) out[POSE_LEN] = ev;
  out.length = ev.length ? POSE_LEN + 1 : POSE_LEN;
  return out;
}

/**
 * Validate and dequantize a pose packet, or null: not an array, a wrong length, a value that isn't an integer in its
 * field's range (NaN, Infinity and wrong types included), an unknown packet flag, or a bad ev list (empty, not whole
 * triples, over EV_MAX, an unknown kind, a value of the wrong kind, a dtMs out of range). With `out`, writes into it
 * (and its ev list) only when the packet is good.
 */
export function decodePose(arr: unknown, out?: Pose): Pose | null {
  if (!Array.isArray(arr) || (arr.length !== POSE_LEN && arr.length !== POSE_LEN + 1)) return null;
  for (let i = 0; i < POSE_LEN; i++) if (!isInt(arr[i], POSE_RANGE[i][0], POSE_RANGE[i][1])) return null;
  if ((arr[13] & ~PACKET_FLAGS_KNOWN) !== 0) return null;
  const ev: unknown = arr[POSE_LEN];
  if (arr.length > POSE_LEN) {
    if (!Array.isArray(ev) || ev.length === 0 || ev.length % 3 !== 0 || ev.length > EV_MAX * 3) return null;
    for (let i = 0; i < ev.length; i += 3) if (!isKind(ev[i]) || evValueIn(ev[i], ev[i + 1]) === null || !isInt(ev[i + 2], 0, EV_DT_MAX_MS)) return null;
  }
  const p = out ?? createPose(), a = arr as number[];
  p.seq = a[0]; p.t = a[1];
  p.x = dequantPos(a[2]); p.y = dequantPos(a[3]); p.z = dequantPos(a[4]);
  p.vx = dequantVel(a[5]); p.vy = dequantVel(a[6]); p.vz = dequantVel(a[7]);
  p.yaw = dequantYaw(a[8]); p.move = a[9];
  p.air = dequantAir(a[10]); p.leaf = dequantLeaf(a[11]); p.lift = dequantLift(a[12]); p.flags = a[13];
  p.ev.length = 0;
  if (Array.isArray(ev)) for (let i = 0; i < ev.length; i += 3) p.ev.push(ev[i], evValueIn(ev[i], ev[i + 1])!, ev[i + 2]);
  return p;
}

// ── State schema (§4.1) ───────────────────────────────────────────

export type WireType = "string" | "uint8" | "int16" | "uint16" | "uint32";
/** Player's schema fields in order (the server's schema must equal this exactly; a change is a PROTOCOL bump). */
export const NET_PLAYER_FIELDS = [
  ["sid", "uint16"], ["uid", "string"],
  ["name", "string"], ["badge", "uint8"], ["look", "string"], ["level", "uint8"], ["family", "uint8"], ["kit", "string"], ["mastery", "uint8"],
  ["aura", "string"], ["frame", "uint8"],
  ["area", "uint8"], ["flags", "uint8"], ["held", "string"], ["weapon", "string"], ["pose", "string"], ["seat", "string"], ["study", "uint8"],
  ["studyEnds", "uint32"],
  ["t", "uint32"], ["x", "int16"], ["y", "int16"], ["z", "int16"], ["vx", "int16"], ["vy", "int16"], ["vz", "int16"], ["yaw", "uint16"],
  ["move", "uint8"], ["air", "uint8"], ["leaf", "uint8"], ["lift", "int16"],
  ["tp", "uint8"],
] as const satisfies readonly (readonly [string, WireType])[];
/** One player in `players` (keyed by sessionId; each client sees only its view): wire values, as reflection decodes them. */
export interface NetPlayer {
  /** Short per-room id that events name. */
  sid: number;
  uid: string;
  // The card (rare): keys and numbers only; clients derive icons, titles and aura ramps from their own tables.
  /** World name, or NAME_FALLBACK. */
  name: string;
  /** CARD_BADGES index. */
  badge: number;
  /** avatar_config.look as JSON (≤ LOOK_MAX_BYTES), "" for the default look. */
  look: string;
  level: number;
  /** CARD_FAMILIES index. */
  family: number;
  /** The subclass key (classKit), "" for none. */
  kit: string;
  /** Subclass mastery, 0 for none. */
  mastery: number;
  /** The equipped aura cosmetic key, "" for none. */
  aura: string;
  /** CARD_FRAMES index. */
  frame: number;
  // Presence (rare).
  /** AREAS index. */
  area: number;
  /** FLAG bits. */
  flags: number;
  /** See isHeld. */
  held: string;
  /** The weapon key on the back while armed, "". */
  weapon: string;
  /** A held clip (a seat, a fish hold) or "". */
  pose: string;
  /** The claimed seat key or "". */
  seat: string;
  /** STUDY_STATES index. */
  study: number;
  /** Room time the study phase ends, 0 for none. */
  studyEnds: number;
  // Motion (client-authoritative, server-checked, about 10 Hz): pose packet wire values.
  t: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number;
  move: number; air: number; leaf: number; lift: number;
  /**
   * Teleports applied, a wrapping counter (nextTp): the server bumps it with each PACKET_FLAG.teleport sample it
   * applies, in the same patch as the new position. A receiver snaps that sample whenever `tp` differs from the last
   * it saw (tpChanged), besides its own snap on a large error. A flag in `flags` couldn't do this: set and cleared
   * within one patch, it would never arrive.
   */
  tp: number;
}
/** The whole shard's presence list, keyed by sessionId. */
export const NET_ROSTER_FIELDS = [
  ["uid", "string"], ["name", "string"], ["badge", "uint8"], ["area", "uint8"], ["flags", "uint8"],
] as const satisfies readonly (readonly [string, WireType])[];
export interface RosterEntry { uid: string; name: string; badge: number; area: number; flags: number }
/** The read side of a schema map (MapSchema), without importing @colyseus/schema. */
export interface NetMap<T> { get(key: string): T | undefined; forEach(fn: (value: T, key: string) => void): void; readonly size: number }
export interface IslandState {
  /** The server's Date.now() when the room was created (float64): the room timeline's 0. */
  epoch: number;
  /** The shard's number, the smallest free one. */
  shard: number;
  /** Players in your view (same area, not private, within INTEREST). */
  players: NetMap<NetPlayer>;
  roster: NetMap<RosterEntry>;
}

// ── Other messages ────────────────────────────────────────────────

/** `s`: whatever changed (§4.2), at least one field. Send `area` before the first pose in a new area. */
export interface SlowState {
  /** AREAS index. */
  area?: number;
  held?: string;
  weapon?: string;
  pose?: string;
  seat?: string;
  /** STUDY_STATES index. */
  study?: number;
  /** Room time, 0 for none. */
  studyEnds?: number;
  showClass?: boolean;
  afk?: boolean;
}
const SLOW_CHECK: Readonly<Record<keyof SlowState, (v: unknown) => boolean>> = {
  area: v => isIndex(v, AREAS.length),
  held: isHeld,
  weapon: v => v === "" || isItemKey(v),
  pose: v => v === "" || isClipName(v),
  seat: v => v === "" || isSeatKey(v),
  study: v => isIndex(v, STUDY_STATES.length),
  studyEnds: v => isUint(v, TIME_MAX),
  showClass: v => typeof v === "boolean",
  afk: v => typeof v === "boolean",
};
const SLOW_KEYS = new Set(Object.keys(SLOW_CHECK));
/** A copy of a valid `s` with only its known fields, or null (an unknown key or a bad value refuses the whole message). */
export function parseSlowState(x: unknown): SlowState | null {
  if (!isRecord(x)) return null;
  const keys = Object.keys(x), out: Record<string, unknown> = {};
  if (!keys.length) return null;
  for (const k of keys) {
    if (!SLOW_KEYS.has(k) || !SLOW_CHECK[k as keyof SlowState](x[k])) return null;
    out[k] = x[k];
  }
  return out as SlowState;
}

/** `ping [clientMs]`: the client's wall clock when sent. */
export function parsePing(x: unknown): number | null {
  return Array.isArray(x) && x.length === 1 && isFiniteNumber(x[0]) && x[0] >= 0 ? x[0] : null;
}
/** `pong [clientMs, serverMs]`: the ping's clientMs echoed, and the server's Date.now(). */
export interface Pong { client: number; server: number }
export function parsePong(x: unknown): Pong | null {
  return Array.isArray(x) && x.length === 2 && isFiniteNumber(x[0]) && isFiniteNumber(x[1]) ? { client: x[0], server: x[1] } : null;
}

/**
 * `sys {kind, text}`: restart (before a 4010), a notice to show, or (M2) `refused`: your last chat line wasn't sent,
 * with its `reason` (CHAT_REFUSALS) beside the text. Append-only.
 */
export const SYS_KINDS = ["restart", "notice", "refused"] as const;
export type SysKind = (typeof SYS_KINDS)[number];
export type SysMessage = { kind: Exclude<SysKind, "refused">; text: string } | { kind: "refused"; reason: ChatRefusal; text: string };
export const SYS_TEXT_MAX = 500;
export function parseSys(x: unknown): SysMessage | null {
  if (!isRecord(x)) return null;
  const { kind, text } = x;
  if (typeof text !== "string" || text.length > SYS_TEXT_MAX) return null;
  if (kind === "refused") {
    const { reason } = x;
    return Object.keys(x).length === 3 && CHAT_REFUSALS.includes(reason as ChatRefusal) ? { kind, reason: reason as ChatRefusal, text } : null;
  }
  return Object.keys(x).length === 2 && SYS_KINDS.includes(kind as SysKind) ? { kind: kind as Exclude<SysKind, "refused">, text } : null;
}

// ── World chat (M2, §6) ───────────────────────────────────────────

/**
 * Why a chat line was refused (`sys {kind: "refused", reason}`). Append-only.
 * - muted: a T1/T2 mute is running (member_identity.muted_until);
 * - fast: over CHAT's gap, per-minute or per-hour limit; slow: over slow mode's per-minute limit;
 * - repeat: the same text as one of your own lines within CHAT.repeatMs;
 * - long: over CHAT.maxLength once cleaned; empty: nothing left once cleaned;
 * - filtered: the word filter (lib/moderation/profanity); url: a link from an account younger than CHAT.urlAccountMs.
 */
export const CHAT_REFUSALS = ["muted", "fast", "slow", "repeat", "long", "empty", "filtered", "url"] as const;
export type ChatRefusal = (typeof CHAT_REFUSALS)[number];

/** `chat {text}`: say a line to the shard. The server cleans it (lib/moderation/chatText cleanChatText), then checks it. */
export interface ChatSend { text: string }
export function parseChat(x: unknown): ChatSend | null {
  return isRecord(x) && Object.keys(x).length === 1 && typeof x.text === "string" ? { text: x.text } : null;
}

/**
 * `line {id, sid, uid, name, area, text, t}`: a chat line, to everyone in the shard but players in a block with the
 * sender (either way), the sender included. Clients draw a bubble over a player in their view and log the rest.
 */
export interface ChatLine {
  /** The server's id for the line: what POST /api/world/report names. */
  id: string;
  /** The sender's Player.sid (their bubble). */
  sid: number;
  uid: string;
  /** The sender's world name when they said it (never the real name, row 222). */
  name: string;
  /** AREAS index the sender was in. */
  area: number;
  /** Cleaned, 1..CHAT.maxLength. Plain text: never render it as markup or turn it into links. */
  text: string;
  /** Room time it was said (ms since IslandState.epoch). */
  t: number;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);
/** A card name's most characters (the server's card allows 32; world names are 3–16). */
const LINE_NAME_MAX = 32;
export function parseChatLine(x: unknown): ChatLine | null {
  if (!isRecord(x) || Object.keys(x).length !== 7) return null;
  const { id, sid, uid, name, area, text, t } = x;
  if (!isUuid(id) || !isUint(sid, 0xffff) || !isUuid(uid) || !isIndex(area, AREAS.length) || !isUint(t, TIME_MAX)) return null;
  if (typeof name !== "string" || name.length < 1 || name.length > LINE_NAME_MAX) return null;
  if (typeof text !== "string" || text.length < 1 || text.length > CHAT.maxLength) return null;
  return { id, sid, uid, name, area, text, t };
}

/**
 * `e [sid, t, kind, value]`: one event, sent only to clients whose view holds the player. Decoded: `t` is room time,
 * `value` a clip name or a length in world units.
 */
export interface NetEvent { sid: number; t: number; kind: number; value: number | string }
/** Into `out`, or null for an event that can't go (an unknown kind, a value of the wrong kind). */
export function encodeEvent(e: NetEvent, out: (number | string)[] = []): (number | string)[] | null {
  const value = isKind(e.kind) ? evValueOut(e.kind, e.value) : null;
  if (value === null) return null;
  out[0] = (Math.trunc(e.sid) || 0) & 0xffff;
  out[1] = quantTime(e.t);
  out[2] = e.kind;
  out[3] = value;
  out.length = 4;
  return out;
}
export function decodeEvent(x: unknown, out?: NetEvent): NetEvent | null {
  if (!Array.isArray(x) || x.length !== 4 || !isInt(x[0], 0, 0xffff) || !isInt(x[1], 0, TIME_MAX) || !isKind(x[2])) return null;
  const value = evValueIn(x[2], x[3]);
  if (value === null) return null;
  const e = out ?? { sid: 0, t: 0, kind: 0, value: 0 };
  e.sid = x[0]; e.t = x[1]; e.kind = x[2]; e.value = value;
  return e;
}

// ── Rates and limits ──────────────────────────────────────────────

/**
 * Pose packets (§4.3): 10 Hz on the ground while moving, 15 Hz while `move` is set, at once on an event (but at least
 * eventGapMs after the last send), one on stopping, then nothing while still. A timed send comes a full interval after
 * the last send of any kind.
 */
export const SEND = { groundHz: 10, moveHz: 15, eventGapMs: 30 } as const;
/** The room's patchRate: state goes out at 20 Hz. */
export const PATCH_RATE_MS = 50;

/**
 * The movement kit's numbers the sanity caps derive from: MOVE_TUNING (lib/game/movement/sim) and sim.ts's
 * MAX_GRADE, the steepest ground that still counts as a slope. Copied, since this file imports nothing;
 * protocol.test.ts pins them.
 */
export const NET_MOVE = { dashSpeed: 18, momentumCeiling: 18, downhillCeiling: 10, maxGrade: 1.6, maxFallSpeed: 18 } as const;
/** The kit's fastest: the momentum ceiling going down the steepest slope (26.5 u/s). */
const KIT_SPEED = Math.max(NET_MOVE.dashSpeed, NET_MOVE.momentumCeiling + NET_MOVE.downhillCeiling * (NET_MOVE.maxGrade / Math.hypot(1, NET_MOVE.maxGrade)));
/** Head-room over the kit for sampling and quantization. */
const SLACK = 1.2;
/**
 * A climb may rise this much per unit of horizontal speed: the gentle ramp (a full cliff over two tiles, 0.75 a unit)
 * with SLACK. A dash up one reads about 12 u/s, momentum into one 14.
 */
export const CLIMB_RATIO = 0.9;
/**
 * Server sanity checks (§4.5). Rates come from consecutive samples' positions, not the velocities they carry; a gap
 * outside dtMinMs..dtMaxMs resets the baseline. Horizontal: at most `speed`, and `speedAvg` over speedAvgWindowMs.
 * Rising: at most max(rise, climbRatio × the horizontal speed over the same samples), so 15 u/s straight up (a jump
 * takes off at 9.5, a full-height mantle's fastest 20 ms is 14.6) and more on a climb. Falling: at most `fall`.
 * `speed` and `fall` are the kit's limits with SLACK, rounded up to whole u/s; `speedAvg` has none, since a slope steep
 * enough for the full ceiling never lasts a second (the grid drops one 0.75 level a cell at most). A move of more than
 * teleportDist within teleportWindowMs needs PACKET_FLAG.teleport, which may come once per teleportGapMs and
 * teleportPerMinute times a minute. A violation isn't applied or relayed and earns a strike; strikes decay one per
 * strikeDecayMs, and strikeKick of them closes with CLOSE.kicked (in dev, log only).
 */
export const SANITY = {
  dtMinMs: 20, dtMaxMs: 2000,
  speed: Math.ceil(KIT_SPEED * SLACK), speedAvg: Math.floor(KIT_SPEED), speedAvgWindowMs: 1000,
  rise: 15, climbRatio: CLIMB_RATIO, fall: Math.ceil(NET_MOVE.maxFallSpeed * SLACK),
  teleportDist: 6, teleportWindowMs: 300, teleportGapMs: 2000, teleportPerMinute: 15,
  strikeDecayMs: 10_000, strikeKick: 10,
} as const;

/**
 * Per-client limits (§4.6). Excess is dropped; an area change over its limit also earns a strike; over
 * maxMessagesPerSecond (Colyseus's own) the client is disconnected. An event is a pose packet's ev entry; play and
 * upper events with an emote clip count against `emotes` too.
 */
export const RATE_LIMITS = {
  p: { perSecond: 20, burst: 30 },
  s: { perSecond: 5 },
  area: { perSecond: 3, perMinute: 30 },
  events: { perSecond: 8 },
  emotes: { perSecond: 1, perMinute: 20 },
  refresh: { everyMs: 10_000 },
  ping: { perSecond: 2 },
  maxMessagesPerSecond: 60,
} as const;

/** Views (§4.4): same area, not private, entering within radiusIn and leaving beyond radiusOut, rebuilt every rebuildMs. */
export const INTEREST = { radiusIn: 50, radiusOut: 60, rebuildMs: 500 } as const;
/** Remote rendering delay (§5.3): clamp(1.5 × observed interval + 2 × jitter, min, max), `initial` before any samples. */
export const INTERP_DELAY_MS = { min: 120, max: 300, initial: 200 } as const;
/** Shards (§3): lock matchmaking at `lock` players, unlock when fewer than `unlock`; maxClients `max` (joinById, phones). */
export const SHARD = { lock: 30, unlock: 26, max: 40 } as const;
/** allowReconnection seconds after a drop (§3): phones longer, since iOS suspends sockets. */
export const RECONNECT_GRACE_S = { desktop: 20, phone: 120 } as const;
/** No input this long flags afk (never a kick, §3). */
export const AFK_MS = 5 * 60_000;

/**
 * World chat (M2, §6): `maxLength` characters, `perMinute` and `perHour` lines, `gapMs` apart, no repeat of the same
 * text within `repeatMs`. Public accounts younger than `slowModeAccountMs` get `slowModePerMinute`; URLs are refused
 * from accounts younger than `urlAccountMs` (specs/multiplayer-questions.md default 4). Characters are String.length
 * (UTF-16 units, what an input's maxLength counts), measured after cleaning. Only accepted lines count.
 */
export const CHAT = {
  maxLength: 200, perMinute: 6, perHour: 60, gapMs: 1500, repeatMs: 30_000,
  slowModePerMinute: 2, slowModeAccountMs: 24 * 3_600_000, urlAccountMs: 7 * 24 * 3_600_000,
} as const;

// ── World clock (§4.7) ────────────────────────────────────────────

/**
 * Clock sync: `burst` pings `burstGapMs` apart at join, then one every `everyMs`; the offset is the median over the
 * `best` lowest-RTT samples of the last `window`, applied (setWorldClockOffset) when it moves more than applyOverMs.
 */
export const CLOCK = { burst: 5, burstGapMs: 200, everyMs: 15_000, window: 16, best: 5, applyOverMs: 100 } as const;
/** One ping round trip: the client's wall clock at send and at the pong, and the server's clock in it. */
export interface ClockSample { sent: number; received: number; server: number }
/** Server minus client, in ms: `server − (sent + rtt / 2)`, the median over CLOCK.best of the last CLOCK.window. Null with none. */
export function estimateClockOffset(samples: readonly ClockSample[]): number | null {
  const ok = samples.slice(-CLOCK.window).filter(s => isFiniteNumber(s.sent) && isFiniteNumber(s.received) && isFiniteNumber(s.server) && s.received >= s.sent);
  if (!ok.length) return null;
  ok.sort((a, b) => a.received - a.sent - (b.received - b.sent));
  const best = ok.slice(0, CLOCK.best).map(s => s.server - (s.sent + s.received) / 2).sort((a, b) => a - b), m = best.length >> 1;
  return best.length % 2 ? best[m] : (best[m - 1] + best[m]) / 2;
}

// ── Checks ────────────────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
/** An integer in [lo, hi] (which also rules out NaN, Infinity and other types). */
function isInt(x: unknown, lo: number, hi: number): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= lo && x <= hi;
}
const isUint = (x: unknown, max: number): x is number => isInt(x, 0, max);
const isIndex = (x: unknown, length: number): x is number => isInt(x, 0, length - 1);
