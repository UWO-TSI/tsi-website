/**
 * Dev bots (specs/multiplayer.md §5.9): players with no one behind them, for the `?bots=N` loopback (loopback.ts) and
 * for load scripts. A bot is a headless PlayerAvatar plus the sender's cadence: the real movement kit (`stepMove` at
 * 1/120 s on `villageIsland(village())`, the leaf glider on), the clips and juice PlayerAvatar asks for on each of the
 * kit's events, and the pose packets and slow-state messages a client sends (SEND's rates, an immediate packet on an
 * event, one on stopping, the teleport flag on a respawn and a seat snap within its budget).
 *
 * Behaviour, from a per-bot seeded generator so a seed always plays the same: wander between the village's places
 * (residents' anchors, gathering spots, the spawn, the fitting room, the mission board, the lamp, the benches), walking
 * or running, with hops, dashes, slides and a glide off a cliff edge on the way; stand about; emote (EMOTE_CLIP_NAMES);
 * sit on a bench slot (`bench:<id>#0|1`). Phones rest on a bench and emote now and then (row 299). Some sit studying in
 * the café (`<anchor>#<seat>`, the study state and its end).
 *
 * Cards are invented and seeded: a "Word NN" world name (never a real one, row 222), a random look, a level, a family
 * and one of its kits, mastery and its frame; some are members, some public, some phones.
 *
 * Pure: no clock, no DOM, no network. `advance(toMs, outbox)` steps a bot to a room time and hands its messages over.
 */
import { MOVE_TUNING, NO_INPUT, STEP, createMoveState, stepMove, towards, type MoveEvent, type MoveInput, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import { BENCH_SEAT_TOP, BENCH_SLOTS, benchSlotKey, benchSlotPoint, villageIsland } from "@/lib/game/defaultIsland";
import { CHARACTER_SCALE } from "@/components/game/character/Character";
import { objectsOf, village, villageSpawnPoint } from "@/lib/game/villageMap";
import { airPhase, isLoop, seatLift, type ClipName } from "@/lib/game/character/clips";
import { randomLook, seeded } from "@/lib/game/character/look";
import { landKind } from "@/lib/game/movement/juice";
import { CLASS_KITS } from "@/lib/combat/classes";
import { masteryCosmetics } from "@/lib/combat/mastery";
import { seatsOf, studyLayout } from "@/lib/study/seats";
import { TOOLS } from "@/lib/game/tools";
import {
  AREAS, CARD_FAMILIES, EMOTE_CLIP_NAMES, EV, LOOK_MAX_BYTES, PACKET_FLAG, SANITY, SEND, cardFamily, cardFrame, encodePose, heldOf, moveIndex,
  studyIndex, type Area, type MoveClip, type PosePacket, type SlowState,
} from "./protocol";

/** The kit bots move with: the village's, the leaf glider owned. */
export const BOT_TUNING = { ...MOVE_TUNING, glider: 1 };
const STEP_MS = STEP * 1000;
/** Bench slots: two along each bench, this far either side of its middle (specs/multiplayer.md §8): the one seat model players and residents share (defaultIsland BENCH_SLOTS). */
export const BENCH_SLOT = BENCH_SLOTS[1];

/** The words bots are named from ("Pebble 03"). */
const NAME_WORDS = ["Pebble", "Juniper", "Bramble", "Saffron", "Tidepool", "Marlow", "Thistle", "Clover", "Puffin", "Driftwood", "Sorrel", "Kelp",
  "Lantern", "Minnow", "Bracken", "Quill", "Hazel", "Sparrow", "Cobble", "Fennel", "Otter", "Nettle", "Cinder", "Moss"] as const;

export type BotRole = "wander" | "rest" | "study";
/** A bot's card and join: what the server's player card and the join options would hold. */
export interface BotCard {
  name: string;
  /** CARD_BADGES index (1: member). */
  badge: number;
  /** The look as JSON (≤ LOOK_MAX_BYTES). */
  look: string;
  level: number;
  /** CARD_FAMILIES index. */
  family: number;
  kit: string;
  mastery: number;
  aura: string;
  /** CARD_FRAMES index. */
  frame: number;
  mobile: boolean;
  showClass: boolean;
  area: Area;
  role: BotRole;
}

/** A bot's card from the loopback's seed and its index: the same pair always gives the same card. */
export function botCard(seed: number, index: number): BotCard {
  const r = seeded(mix(seed, index, 0x51ed));
  const word = NAME_WORDS[Math.floor(r() * NAME_WORDS.length)];
  // Every few is a phone resting on a bench, every few studies in the café; the rest walk.
  const role: BotRole = index % 7 === 3 ? "rest" : index % 6 === 5 ? "study" : "wander";
  const look = JSON.stringify(randomLook(r));
  const kits = CLASS_KITS.filter(k => !k.dev);
  const kit = r() < 0.75 ? kits[Math.floor(r() * kits.length)] : null;
  const mastery = kit ? Math.floor(r() * 21) : 0;
  const frame = masteryCosmetics(mastery).frame;
  return {
    name: `${word} ${String(index + 1).padStart(2, "0")}`,
    badge: r() < 0.6 ? 1 : 0,
    look: look.length <= LOOK_MAX_BYTES ? look : "",
    level: 1 + Math.floor(r() * 30),
    family: kit ? cardFamily(kit.family) : r() < 0.5 ? 1 + Math.floor(r() * (CARD_FAMILIES.length - 1)) : 0,
    kit: kit?.key ?? "",
    mastery,
    aura: mastery >= 15 && r() < 0.7 ? "mastery:colour" : "",
    frame: frame && r() < 0.8 ? cardFrame(`mastery:${frame}`) : 0,
    mobile: role === "rest",
    showClass: r() < 0.85,
    area: role === "study" ? "cafe" : "village",
    role,
  };
}

/** Hash a few integers into a seed. */
function mix(a: number, b: number, c: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ c;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

// ── The village as bots walk it ───────────────────────────────────

export interface BenchSpot { id: string; x: number; z: number; yaw: number }
/** Somewhere to glide from: standable, open water `(dx, dz)` ahead. */
export interface ShoreSpot { x: number; z: number; dx: number; dz: number }
export interface StudySpot { key: string; x: number; z: number; facing: number; lift: number; clip: ClipName }
/** What bots share: the walker's world, the places they wander between, bench slots and café seats, and who holds which. */
export interface BotWorld {
  move: MoveWorld;
  /** The terrain under a point (a seat's floor). */
  ground(x: number, z: number): number;
  standable(x: number, z: number): boolean;
  /** Places to wander between: standable, spread over the village. */
  points: readonly (readonly [number, number])[];
  benches: readonly BenchSpot[];
  /** Launch spots for a glide out over the water (the village has no cliff tall enough), highest first. */
  shores: readonly ShoreSpot[];
  cafeSeats: readonly StudySpot[];
  /** Seat keys bots hold now. */
  taken: Set<string>;
}

let shared: Omit<BotWorld, "taken"> | null = null;
/** The member village for bots (built once), with a fresh set of seat claims for one group of bots. */
export function botWorld(): BotWorld {
  if (shared) return { ...shared, taken: new Set() };
  const v = village(), island = villageIsland(v);
  const raw: [number, number][] = [villageSpawnPoint(v)];
  for (const kind of ["anchor", "gather", "fitting", "missions", "lamp"] as const) for (const o of objectsOf(kind, v)) raw.push([o.x, o.z]);
  const benches = objectsOf("bench", v).map(b => ({ id: b.id, x: b.x, z: b.z, yaw: b.yaw ?? 0 }));
  for (const b of benches) raw.push(benchFront(b, 1));
  const points = raw.map(([x, z]) => clear(island.standable, x, z)).filter((p): p is [number, number] => p !== null);
  // The café's floor is 0, so a seat's y is its top: the Study clip is lifted onto it as PlayerAvatar does.
  const cafeSeats = studyLayout(v).filter(t => t.area === "cafe").flatMap(t => seatsOf(t.anchor, () => 0, v))
    .map((s): StudySpot => ({ key: `${s.anchor}#${s.seat}`, x: s.x, z: s.z, facing: s.facing, lift: seatLift("Study", s.y, CHARACTER_SCALE), clip: "Study" }));
  shared = { move: { top: island.top, wet: island.wet }, ground: island.ground, standable: island.standable, points, benches, cafeSeats,
    shores: shoreSpots(v.bounds, island) };
  return { ...shared, taken: new Set() };
}

/** Up to 16 spots at least 5 u apart, on the highest ground, with open water a step ahead. */
function shoreSpots(b: { minX: number; maxX: number; minZ: number; maxZ: number }, w: { standable(x: number, z: number): boolean; wet(x: number, z: number): boolean; ground(x: number, z: number): number }): ShoreSpot[] {
  const found: (ShoreSpot & { y: number })[] = [];
  for (let x = Math.ceil(b.minX); x <= b.maxX; x++) for (let z = Math.ceil(b.minZ); z <= b.maxZ; z++) {
    if (!clear(w.standable, x, z)) continue;
    for (let a = 0; a < 8; a++) {
      const dx = Math.sin((a * Math.PI) / 4), dz = Math.cos((a * Math.PI) / 4);
      if (!w.wet(x + dx * 0.5, z + dz * 0.5) && w.wet(x + dx * 1.6, z + dz * 1.6) && w.wet(x + dx * 5, z + dz * 5) && w.wet(x + dx * 8, z + dz * 8)) {
        found.push({ x, z, dx, dz, y: w.ground(x, z) });
        break;
      }
    }
  }
  found.sort((p, q) => q.y - p.y);
  const out: ShoreSpot[] = [];
  for (const f of found) if (out.length < 16 && out.every(o => Math.hypot(o.x - f.x, o.z - f.z) >= 5)) out.push({ x: f.x, z: f.z, dx: f.dx, dz: f.dz });
  return out;
}
/** In front of a bench (its facing side), `d` out. */
function benchFront(b: BenchSpot, d: number): [number, number] {
  return [b.x + Math.sin(b.yaw) * d, b.z + Math.cos(b.yaw) * d];
}
/** A bench slot's spot: along the bench, either side of its middle. */
export const benchSlot = (b: BenchSpot, slot: 0 | 1): [number, number] => benchSlotPoint(b, slot);
/** A bench slot's seat claim (`bench:<id>#0|1`). */
export const benchKey = (b: BenchSpot, slot: 0 | 1) => benchSlotKey(b.id, slot);
/** A bench sitter's lift at (x, z), as PlayerAvatar's tsi:sit computes it: seatLift(Sit, seatY − the ground there, CHARACTER_SCALE). */
export function benchLift(w: Pick<BotWorld, "ground">, b: BenchSpot, x: number, z: number): number {
  return seatLift("Sit", w.ground(b.x, b.z) + BENCH_SEAT_TOP - w.ground(x, z), CHARACTER_SCALE);
}
/** The nearest standable spot within 2 u, or null. */
function clear(standable: (x: number, z: number) => boolean, x: number, z: number): [number, number] | null {
  for (let r = 0; r <= 2; r += 0.25) for (let a = 0; a < 12; a++) {
    const px = x + Math.sin((a / 12) * Math.PI * 2) * r, pz = z + Math.cos((a / 12) * Math.PI * 2) * r;
    if (standable(px, pz) && standable(px + 0.2, pz) && standable(px - 0.2, pz) && standable(px, pz + 0.2) && standable(px, pz - 0.2)) return [px, pz];
    if (r === 0) break;
  }
  return null;
}

// ── A bot ─────────────────────────────────────────────────────────

/** Where a bot's messages go: what a client sends (`p` packets and `s` patches). */
export interface BotOutbox {
  pose(packet: PosePacket): void;
  slow(patch: SlowState): void;
}

/** One-shot clips PlayerAvatar plays for the kit's events (components/game/movement/moveFx EVENT_CLIP). */
const EVENT_CLIP: Partial<Record<MoveEvent["kind"], ClipName>> = {
  jump: "Jump", hop: "Jump", long: "Jump", dashjump: "Jump", roll: "Roll", mantle: "Mantle", dash: "Dash", recover: "LandHeavy",
  slide: "SlideIn", dashslide: "SlideInDash", landslide: "SlideInDash", slidejump: "SlideJump",
};
const TAKEOFF = new Set<MoveEvent["kind"]>(["jump", "hop", "long", "dashjump"]);
const EMOTES = EMOTE_CLIP_NAMES as readonly string[];
/** Pending events: kind, value, room time; a fixed ring so a long hop chain never grows it. */
const JOURNAL = 32;

type Plan =
  | { kind: "walk"; gx: number; gz: number; run: boolean; hop: boolean; until: number; bench?: { b: BenchSpot; slot: 0 | 1 } }
  /** Run to a shore, off it, open the leaf on the way down, out over the water and back (or into it: a splash and a respawn). */
  | { kind: "glide"; spot: ShoreSpot; phase: "approach" | "launch" | "air"; opened: boolean; airT: number; until: number }
  | { kind: "idle"; until: number }
  | { kind: "emote"; until: number; dance: boolean }
  | { kind: "seated"; until: number; key: string; stand: [number, number]; nextEmote: number };

export class Bot {
  readonly card: BotCard;
  private readonly r: () => number;
  private readonly w: BotWorld;
  /** Room time of the last step (ms). */
  private t: number;
  private s: MoveState;
  private prev: MoveState;
  private prev2: MoveState;
  private plan: Plan;
  /** Seated: the seat's spot, facing and lift (null standing). */
  private seat: { x: number; y: number; z: number; yaw: number; lift: number; clip: ClipName } | null = null;
  // PlayerAvatar's per-frame motion fields.
  private jumped = false;
  private vy0 = 6;
  private fallT = 0;
  private leaf = 0;
  private leafV = 0;
  private ghostT = 0;
  // Walk tech timers (ms of room time).
  private nextDash = 0;
  private nextSlide = 0;
  private slideUntil = 0;
  private jumpHold = 0;
  private stuckT = 0;
  private bestD = Infinity;
  private kicked = false;
  // The sender's state.
  private seq = 0;
  private lastSend = -Infinity;
  private lastSentMoving = false;
  private sentX = NaN; private sentY = NaN; private sentZ = NaN;
  private teleport = false;
  private readonly flagTimes: number[] = [];
  private readonly evKind = new Int16Array(JOURNAL);
  private readonly evValue: (number | string)[] = new Array<number | string>(JOURNAL).fill(0);
  private readonly evAt = new Float64Array(JOURNAL);
  private evStart = 0;
  private evCount = 0;
  private readonly packet: PosePacket = [];
  private sentHeld = "";
  private readonly pose = { seq: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, flags: 0, ev: [] as (number | string)[] };
  // Slow state as last sent.
  private sentPose = "";
  private sentSeat = "";
  private readonly held: string;
  private heldOut = false;
  private started = false;

  constructor(world: BotWorld, card: BotCard, seed: number, startMs: number) {
    this.w = world;
    this.card = card;
    this.r = seeded(mix(seed, 0x0b07, hashName(card.name)));
    this.t = startMs;
    const tool = TOOLS[Math.floor(this.r() * TOOLS.length)];
    this.held = this.r() < 0.35 ? heldOf(tool.kind, tool.key) : "";
    const [x, z] = world.points[Math.floor(this.r() * world.points.length)] ?? [0, 0];
    this.s = this.prev = this.prev2 = createMoveState(x, z, world.move, this.r() * Math.PI * 2);
    this.plan = { kind: "idle", until: startMs + 300 + this.r() * 1500 };
    if (card.role === "study") this.sitStudy();
    else if (card.role === "rest") this.sitBench(true);
  }

  /** Where the bot is now (world units). */
  get position(): [number, number, number] { return this.seat ? [this.seat.x, this.seat.y, this.seat.z] : [this.s.x, this.s.y, this.s.z]; }
  /** Room time the bot has been stepped to. */
  get time() { return this.t; }
  /** Jump the clock to `t` without stepping (a slept tab's gap): it stands where it was, and its next packet starts a new stretch. */
  skipTo(t: number): void { if (t > this.t) this.t = t; }

  /** Step to room time `toMs` in whole 1/120 s steps, handing over each message as a client would send it. */
  advance(toMs: number, out: BotOutbox): void {
    if (!this.started) {
      this.started = true;
      const join: SlowState = {};
      if (this.held && this.heldOut) join.held = this.held;
      if (this.seat) { join.pose = this.seat.clip; this.sentPose = this.seat.clip; }
      if (this.seatKey) { join.seat = this.seatKey; this.sentSeat = this.seatKey; }
      if (this.card.role === "study") { join.study = studyIndex("focus"); join.studyEnds = Math.round(this.t + 25 * 60_000); }
      if (Object.keys(join).length) out.slow(join);
      this.send(out, true);
    }
    while (this.t + STEP_MS <= toMs) {
      this.t += STEP_MS;
      this.step(out);
    }
  }

  private get seatKey(): string {
    return this.plan.kind === "seated" ? this.plan.key : "";
  }

  private step(out: BotOutbox) {
    const t = this.t, dt = STEP;
    if (this.seat) {
      this.seated(out);
    } else {
      const input = this.think();
      this.prev2 = this.prev;
      this.prev = this.s;
      this.s = stepMove(this.s, input, dt, this.w.move, BOT_TUNING);
      for (const e of this.s.events) this.onEvent(e, t);
    }
    const s = this.s, air = !this.seat && s.mode === "air";
    // PlayerAvatar's motion fields: the Air pose's phase, how long it has fallen, the leaf's spring.
    this.fallT = air && s.vy < 0 ? this.fallT + dt : 0;
    const gliding = !this.seat && s.mode === "glide";
    this.leafV += (((gliding ? 1 : 0) - this.leaf) * 220 - this.leafV * 15) * dt;
    this.leaf = Math.min(1.3, Math.max(0, this.leaf + this.leafV * dt));
    if (this.ghostT > 0 && (this.ghostT -= dt) <= 0 && s.dashT > 0) this.journal(EV.ghost, 0, t);
    this.maybeSend(out);
    this.maybeSlow(out);
  }

  // ── Brain ──

  private think(): MoveInput {
    const p = this.plan;
    if (this.t >= p.until && p.kind !== "seated") this.next();
    const plan = this.plan;
    return plan.kind === "walk" ? this.walk(plan) : plan.kind === "glide" ? this.glide(plan) : NO_INPUT;
  }

  /** Walking (or running) to a place, with the kit's tech on the way: hops, dashes where the way is clear, slides. */
  private walk(plan: Extract<Plan, { kind: "walk" }>): MoveInput {
    const t = this.t, s = this.s;
    const to = towards(s, plan.gx, plan.gz, BOT_TUNING), d = Math.hypot(plan.gx - s.x, plan.gz - s.z);
    if (!to || d < 0.6) {
      if (plan.bench) this.snapToBench(plan.bench.b, plan.bench.slot);
      else this.next();
      return NO_INPUT;
    }
    const stuck = this.stuck(d);
    if (stuck) return stuck === 2 ? NO_INPUT : { ...NO_INPUT, x: to.x, z: to.z, jump: true, jumpPressed: true };
    let jumpPressed = false, jump = false, dashPressed = false, sneak = false;
    const speed = Math.hypot(s.vx, s.vz);
    if (plan.run && !plan.bench) {
      if (t >= this.nextDash && s.mode !== "slide" && this.clearAhead(to.x, to.z)) { dashPressed = true; this.nextDash = t + 1500 + this.r() * 4000; }
      if (t >= this.nextSlide && s.mode === "ground" && speed > BOT_TUNING.walkSpeed * 1.15) { this.slideUntil = t + 400 + this.r() * 500; this.nextSlide = t + 2500 + this.r() * 4500; }
      sneak = t < this.slideUntil;
      if (plan.hop && !sneak) jump = true;
      if (plan.hop && s.mode === "ground" && !sneak && speed > BOT_TUNING.walkSpeed * 0.9 && this.r() < 0.05) jumpPressed = true;
    }
    if (this.jumpHold > 0) { this.jumpHold -= STEP; jump = true; }
    return { x: to.x, z: to.z, sprint: plan.run, sneak, jump: jump || jumpPressed, jumpPressed, dashPressed };
  }

  /** Off a shore with the leaf: run up, jump at the edge, open it falling, glide out and turn for land. */
  private glide(plan: Extract<Plan, { kind: "glide" }>): MoveInput {
    const s = this.s, spot = plan.spot;
    if (plan.phase === "approach") {
      const to = towards(s, spot.x, spot.z, BOT_TUNING), d = Math.hypot(spot.x - s.x, spot.z - s.z);
      if (to && d > 0.5) {
        const stuck = this.stuck(d);
        return stuck === 2 ? NO_INPUT : { ...NO_INPUT, x: to.x, z: to.z, sprint: true, jump: stuck === 1, jumpPressed: stuck === 1 };
      }
      plan.phase = "launch";
      plan.until = this.t + 2000;
    }
    if (plan.phase === "launch") {
      // Water a step ahead is a wall on foot: jump before it.
      const edge = this.w.move.wet(s.x + spot.dx * 0.8, s.z + spot.dz * 0.8);
      if (edge && s.mode === "ground") plan.phase = "air";
      return { ...NO_INPUT, x: spot.dx, z: spot.dz, sprint: true, jump: edge, jumpPressed: edge };
    }
    plan.airT += STEP;
    if (plan.airT > 0.15 && s.mode === "ground") { this.next(); return NO_INPUT; }
    const press = !plan.opened && s.mode === "air" && s.vy < 0;
    if (press) plan.opened = true;
    // Out along the launch, then round toward the shore it left.
    const back = plan.airT > 0.45, bx = spot.x - s.x, bz = spot.z - s.z, bl = Math.hypot(bx, bz) || 1;
    return { ...NO_INPUT, x: back ? bx / bl : spot.dx, z: back ? bz / bl : spot.dz, jump: true, jumpPressed: press };
  }

  /** Progress toward a goal `d` away: 0 fine, 1 stuck (jump: a mantle up a ledge), 2 given up (a new plan is chosen). */
  private stuck(d: number): 0 | 1 | 2 {
    if (d < this.bestD - 0.3) { this.bestD = d; this.stuckT = 0; return 0; }
    this.stuckT += STEP;
    if (this.stuckT > 2) { this.next(); return 2; }
    if (this.stuckT > 0.8 && !this.kicked && this.s.mode === "ground") { this.kicked = true; this.jumpHold = 0.3; return 1; }
    return 0;
  }

  /** Room for a dash: standing ground 1, 2 and 3 u along (x, z). */
  private clearAhead(x: number, z: number): boolean {
    const l = Math.hypot(x, z) || 1, s = this.s;
    for (let k = 1; k <= 3; k++) if (!this.w.standable(s.x + (x / l) * k, s.z + (z / l) * k)) return false;
    return true;
  }

  /** Pick what to do next (a slot it was heading for is let go). */
  private next() {
    this.release();
    const t = this.t, r = this.r, s = this.s;
    this.stuckT = 0; this.bestD = Infinity; this.kicked = false; this.jumpHold = 0; this.slideUntil = 0;
    const roll = r();
    if (roll < 0.12) { this.plan = { kind: "idle", until: t + 800 + r() * 3000 }; return; }
    if (roll < 0.2 && this.w.shores.length) {
      // The nearest few shores, one of them.
      const near = [...this.w.shores].sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z)).slice(0, 3);
      this.plan = { kind: "glide", spot: near[Math.floor(r() * near.length)], phase: "approach", opened: false, airT: 0, until: t + 20_000 };
      this.heldOut = false;
      return;
    }
    if (roll < 0.33) {
      const clip = EMOTES[Math.floor(r() * EMOTES.length)], dance = isLoop(clip as ClipName);
      this.journal(EV.play, clip, t);
      this.plan = { kind: "emote", until: t + (dance ? 3000 : 1800) + r() * 800, dance };
      return;
    }
    if (roll < 0.45 && this.sitBench(false)) return;
    // Somewhere 4–20 u off, the way you'd stroll.
    const near = this.w.points.filter(([x, z]) => { const d = Math.hypot(x - s.x, z - s.z); return d > 4 && d < 20; });
    const pool = near.length ? near : this.w.points;
    const [gx, gz] = pool[Math.floor(r() * pool.length)];
    const far = Math.hypot(gx - s.x, gz - s.z) > 8;
    const run = far ? r() < 0.7 : r() < 0.25;
    this.plan = { kind: "walk", gx, gz, run, hop: run && r() < 0.3, until: t + 15_000 };
    this.nextDash = t + 800 + r() * 3000;
    this.nextSlide = t + 1200 + r() * 3000;
    this.heldOut = !!this.held && !run && r() < 0.5;
  }

  /** Head for a free bench slot (`now`: a phone, sat straight down). False when every slot is taken. */
  private sitBench(now: boolean): boolean {
    const free: { b: BenchSpot; slot: 0 | 1 }[] = [];
    for (const b of this.w.benches) for (const slot of [0, 1] as const) if (!this.w.taken.has(benchKey(b, slot))) free.push({ b, slot });
    if (!free.length) {
      if (now) this.plan = { kind: "idle", until: Infinity }; // a phone with nowhere to rest stands
      return false;
    }
    const pick = free[Math.floor(this.r() * free.length)];
    this.w.taken.add(benchKey(pick.b, pick.slot));
    if (now) { this.snapToBench(pick.b, pick.slot); return true; }
    const [gx, gz] = benchFront(pick.b, 0.9);
    this.plan = { kind: "walk", gx, gz, run: false, hop: false, until: this.t + 20_000, bench: pick };
    this.heldOut = false;
    return true;
  }

  /** Onto the bench slot: a seat snap (the teleport flag), the Sit pose, the seat claimed. */
  private snapToBench(b: BenchSpot, slot: 0 | 1) {
    // PlayerAvatar's bench seat: on the ground under the slot, facing out, lifted onto the slats. IslandScene's tsi:sit
    // detail carries seatY = the bench's ground + BENCH_SEAT_TOP, and PlayerAvatar lifts the Sit clip onto it.
    const [x, z] = benchSlot(b, slot), front = benchFront(b, 0.9), ground = this.w.ground(x, z);
    this.seat = { x, y: ground, z, yaw: b.yaw, lift: benchLift(this.w, b, x, z), clip: "Sit" };
    this.teleport = true;
    const t = this.t;
    this.plan = { kind: "seated", key: benchKey(b, slot), stand: front, until: this.card.role === "rest" ? Infinity : t + 6000 + this.r() * 14_000, nextEmote: t + 4000 + this.r() * 8000 };
  }

  /** A café seat for good: studying (focus) with the Study pose. */
  private sitStudy() {
    const free = this.w.cafeSeats.filter(s => !this.w.taken.has(s.key));
    const spot = free[Math.floor(this.r() * free.length)] ?? this.w.cafeSeats[0];
    if (!spot) { this.plan = { kind: "idle", until: Infinity }; return; }
    this.w.taken.add(spot.key);
    this.seat = { x: spot.x, y: 0, z: spot.z, yaw: spot.facing, lift: spot.lift, clip: spot.clip };
    this.plan = { kind: "seated", key: spot.key, stand: [spot.x, spot.z], until: Infinity, nextEmote: Infinity };
  }

  private seated(out: BotOutbox) {
    const p = this.plan, t = this.t;
    if (p.kind !== "seated") return;
    if (t >= p.nextEmote) {
      // Phones and resters wave from the seat now and then (the renderer plays it over the upper body).
      const clip = EMOTES.filter(c => !isLoop(c as ClipName))[Math.floor(this.r() * 4)];
      this.journal(EV.play, clip, t);
      p.nextEmote = t + 6000 + this.r() * 9000;
    }
    if (t < p.until) return;
    // Up: beside the bench, the seat freed; nothing jumps (the gap since the snap makes a fresh start).
    this.release();
    const [x, z] = p.stand;
    this.seat = null;
    this.s = this.prev = this.prev2 = createMoveState(x, z, this.w.move, this.s.facing);
    this.next();
    void out;
  }

  private release() {
    if (this.plan.kind === "seated") this.w.taken.delete(this.plan.key);
    if (this.plan.kind === "walk" && this.plan.bench) this.w.taken.delete(benchKey(this.plan.bench.b, this.plan.bench.slot));
  }

  // ── PlayerAvatar's reactions to the kit's events ──

  private onEvent(e: MoveEvent, t: number) {
    const s = this.s, clip = EVENT_CLIP[e.kind];
    if (e.kind !== "recover") this.journal(EV[e.kind], e.kind === "land" || e.kind === "roll" || e.kind === "splash" || e.kind === "mantle" ? e.drop : 0, t);
    if (clip && !(e.kind === "dash" && s.mode === "glide")) this.journal(EV.play, clip, t);
    switch (e.kind) {
      case "jump": case "long": case "dashjump": case "hop": case "slidejump":
        this.jumped = true; this.vy0 = Math.max(2, s.vy); this.fallT = 0; break;
      case "glide": this.journal(EV.stop, 0, t); this.leafV += 9; break;
      case "land": {
        this.jumped = false;
        const next = s.events[s.events.indexOf(e) + 1];
        if (next && TAKEOFF.has(next.kind)) break;
        this.journal(EV.stop, 0, t);
        if (e.drop >= 0.15 && e.speed < 3) {
          if (landKind(e.drop) === "heavy") this.journal(EV.play, "LandHeavy", t);
          else if (e.drop > 0.6) this.journal(EV.play, "Land", t);
        }
        break;
      }
      case "stand": this.journal(EV.play, s.crouch ? "SlideStand" : "SlideUp", t); break;
      case "bonk": if (this.prev.mode === "slide") this.journal(EV.play, "SlideBonk", t); break;
      case "dash": this.journal(EV.ghost, 0, t); this.ghostT = 0.07; break;
      case "respawn": this.teleport = true; this.jumped = false; break;
    }
  }

  private journal(kind: number, value: number | string, t: number) {
    if (this.evCount === JOURNAL) { this.evStart = (this.evStart + 1) % JOURNAL; this.evCount--; }
    const i = (this.evStart + this.evCount++) % JOURNAL;
    this.evKind[i] = kind; this.evValue[i] = value; this.evAt[i] = t;
  }

  // ── The sender's cadence (SEND) ──

  private moving(): boolean {
    if (this.seat) return false;
    const s = this.s;
    return Math.hypot(s.vx, s.vz) > 0.05 || Math.abs(s.vy) > 0.05 || this.moveIndex() !== 0
      || Math.abs(s.x - this.sentX) + Math.abs(s.y - this.sentY) + Math.abs(s.z - this.sentZ) > 0.002;
  }

  private maybeSend(out: BotOutbox) {
    const gap = this.t - this.lastSend;
    if (gap < SEND.eventGapMs) return;
    if (this.teleport) {
      if (this.flagBudget()) this.send(out, false);
      return; // a teleport waits for its flag
    }
    const moving = this.moving();
    if (this.evCount > 0 || (moving && gap >= 1000 / (this.moveIndex() ? SEND.moveHz : SEND.groundHz)) || (!moving && this.lastSentMoving)) this.send(out, false);
  }

  /** The server honours one teleport flag per teleportGapMs and teleportPerMinute a minute. */
  private flagBudget(): boolean {
    const t = this.t;
    while (this.flagTimes.length && t - this.flagTimes[0] >= 60_000) this.flagTimes.shift();
    const last = this.flagTimes[this.flagTimes.length - 1];
    return (last === undefined || t - last >= SANITY.teleportGapMs + 50) && this.flagTimes.length < SANITY.teleportPerMinute;
  }

  private moveIndex(): number {
    if (this.seat) return 0;
    const s = this.s, speed = Math.hypot(s.vx, s.vz);
    const clip: MoveClip | null = s.mode === "glide" ? "Glide" : s.mode === "splash" || (s.mode === "air" && this.fallT > 0.6) ? "Fall" : s.mode === "air" ? "Air"
      : s.mode === "skid" ? "Skid" : s.mode === "slide" ? "Slide" : s.crouch ? (speed > 0.3 ? "CrouchWalk" : "CrouchIdle") : null;
    return moveIndex(clip);
  }

  private send(out: BotOutbox, first: boolean) {
    const p = this.pose, s = this.s, seat = this.seat;
    p.seq = this.seq = (this.seq + 1) & 0xffff;
    p.t = this.t;
    if (seat) {
      p.x = seat.x; p.y = seat.y; p.z = seat.z; p.vx = p.vy = p.vz = 0; p.yaw = seat.yaw; p.lift = seat.lift;
    } else {
      p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.facing; p.lift = 0;
      // Velocity as the sender measures it, by difference over the last two steps (the kit's own across a teleport).
      const fd = !this.teleport && this.prev2 !== this.s;
      p.vx = fd ? (s.x - this.prev2.x) / (2 * STEP) : s.vx;
      p.vy = fd ? (s.y - this.prev2.y) / (2 * STEP) : s.vy;
      p.vz = fd ? (s.z - this.prev2.z) / (2 * STEP) : s.vz;
    }
    const moving = this.moving();
    if (!moving && !first) p.vx = p.vy = p.vz = 0; // the stop packet says stopped
    p.move = this.moveIndex();
    p.air = !seat && s.mode === "air" ? airPhase(s.vy, this.vy0, this.jumped) : 0;
    p.leaf = this.leaf;
    p.flags = 0;
    if (this.teleport && !first) {
      p.flags = PACKET_FLAG.teleport;
      this.flagTimes.push(this.t);
      this.teleport = false;
    } else if (first) this.teleport = false;
    p.ev.length = 0;
    while (this.evCount > 0 && p.ev.length < 4 * 3) {
      const i = this.evStart;
      p.ev.push(this.evKind[i], this.evValue[i], Math.round(this.t - this.evAt[i]));
      this.evStart = (this.evStart + 1) % JOURNAL;
      this.evCount--;
    }
    out.pose(encodePose(p, this.packet));
    this.lastSend = this.t;
    this.lastSentMoving = moving;
    this.sentX = p.x; this.sentY = p.y; this.sentZ = p.z;
  }

  /** Slow state on change: the seat's pose (or a dance), the claim, the tool out. */
  private maybeSlow(out: BotOutbox) {
    const pose = this.seat ? this.seat.clip : this.plan.kind === "emote" && this.plan.dance ? "Dance" : "";
    const seat = this.seatKey;
    const held = this.heldOut && !this.seat ? this.held : "";
    let patch: SlowState | null = null;
    if (pose !== this.sentPose) { (patch ??= {}).pose = pose; this.sentPose = pose; }
    if (seat !== this.sentSeat) { (patch ??= {}).seat = seat; this.sentSeat = seat; }
    if (held !== this.sentHeld) { (patch ??= {}).held = held; this.sentHeld = held; }
    if (patch) out.slow(patch);
  }
}

function hashName(name: string) {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return h;
}

/** N bots from a seed, sharing one set of seat claims: cards by index, each with its own generator, all started at `startMs`. */
export function createBots(n: number, seed: number, startMs = 0, world: BotWorld = botWorld()): Bot[] {
  return Array.from({ length: n }, (_, i) => new Bot(world, botCard(seed, i), mix(seed, i, 0xb075), startMs));
}

/** AREAS index of a bot's area. */
export const botArea = (card: BotCard) => AREAS.indexOf(card.area);
