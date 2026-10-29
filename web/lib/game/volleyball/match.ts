/**
 * The match (specs/minigames/beach-volleyball.md §4 to §6): 2v2 on the court's frame (court.ts), stepped at the
 * movement sim's 1/120 s. Every player walks, jumps and dashes with the movement sim (`stepMove`, the court's tuning);
 * the human's inputs come from the scene, the bots' from bot.ts. The ball, the serve, the contacts, the faults and the
 * score live here. Pure (no three.js, no clock, a seeded random), so phase 2's server can run it as it is.
 */
import { MOVE_TUNING, NO_INPUT, STEP, createMoveState, stepMove, type MoveInput, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import { FLAT, GRAVITY, arcTo, driveTo, heightAtNet, predictLanding, stepBall, timeToHeight, type Ball, type Ground } from "./ball";
import { COURT, sideOf, type Side } from "./court";
import { awardRally, landingLoser, openingScore, sideOfTeam, type Score, type Team } from "./rules";
import { judgeServe, meterPower, serveError, touchQuality, type ServeJudge } from "./timing";
import { botInput, openSpot, pickReceivers } from "./bot";

/** On the sand: a little slower than the island's walk, no glider, no bunny-hop. */
export const COURT_TUNING = { ...MOVE_TUNING, walkSpeed: 6.2, sprintSpeed: 8.6, glider: 0, hopChainMax: 0 };
/** Hand heights above the feet for each contact (a 1.36 u character; arms up reach 1.75). */
export const HAND = { bump: 0.55, set: 1.5, spike: 1.75, serve: 1.55, dig: 0.3 } as const;
export type Touch = "bump" | "set" | "spike" | "dig";
/** Reach from the body (horizontal) and the height band round the hand (either side). */
export const REACH: Record<Touch, { reach: number; band: number }> = {
  bump: { reach: 0.95, band: 0.5 }, set: { reach: 0.8, band: 0.45 }, spike: { reach: 0.85, band: 0.5 }, dig: { reach: 1.0, band: 0.45 },
};
export const DIVE = {
  normal: { speed: 7, time: 0.35, down: 0.6, reach: 1.0 },
  slide: { speed: 10.5, time: 0.45, down: 0.45, reach: 1.3 },
} as const;
/** A dash this recent (s), or still running, turns Ctrl's dive into the slide dive. */
export const SLIDE_WINDOW = 0.3;
/** After a touch, presses wait this long (no accidental double contact). */
export const TOUCH_COOLDOWN = 0.3;
export const WHIFF_COOLDOWN = 0.35, BLOCK_TIME = 0.35, CALL_TIME = 1.5, SERVE_TIME = 10, POINT_TIME = 1.8;
/** The toss's height above the hand, by the power bar. */
export const TOSS = { low: 1.1, high: 3.2 } as const;

export type Phase = "serve" | "toss" | "rally" | "point" | "over";
export type ContactKind = Touch | "jumpset" | "block" | "serve";

export interface Player {
  team: Team;
  /** 0 or 1 within the team (the serve rotation). */
  slot: 0 | 1;
  bot: boolean;
  /** 0..1: how well a bot plays (its errors). */
  skill: number;
  s: MoveState;
  dive: { t: number; dx: number; dz: number; strong: boolean; dug: boolean } | null;
  /** Seconds left lying on the sand after a dive. */
  down: number;
  /** "Mine!": seconds left. */
  call: number;
  /** Seconds before another press counts (after a whiff). */
  cd: number;
  /** Arms up over the net: seconds left. */
  block: number;
  sinceDash: number;
  /** A bot's plan for the ball it's taking: the quality it waits for, or a miss. */
  want: number; miss: boolean; lastQ: number;
  /** Raised the arms on this jump already. */
  blocked: boolean;
}

export type MatchEvent =
  | { kind: "contact"; who: number; how: ContactKind; quality: number; x: number; y: number; z: number }
  | { kind: "whiff"; who: number }
  | { kind: "serve"; who: number; judge: ServeJudge }
  | { kind: "toss"; who: number; power: number }
  | { kind: "net" } | { kind: "tape" }
  | { kind: "land"; in: boolean; x: number; z: number }
  | { kind: "point"; team: Team; why: string }
  | { kind: "switch" } | { kind: "win"; team: Team }
  | { kind: "dive"; who: number; strong: boolean } | { kind: "call"; who: number };

/** The human's input for one step, in the court's frame. Presses are edges (true for the step they happen in). */
export interface CourtInput {
  x: number; z: number; sprint: boolean; jump: boolean; jumpPressed: boolean; dashPressed: boolean;
  /** Left button held (the serve's power bar), pressed, released; E, right button and Ctrl pressed. */
  left: boolean; leftPressed: boolean; leftReleased: boolean; ePressed: boolean; rightPressed: boolean; ctrlPressed: boolean;
  /** Where the camera looks on the far side (spikes, serves, balls sent over): null for straight ahead. */
  aim: { x: number; z: number } | null;
}
export const NO_COURT_INPUT: CourtInput = { x: 0, z: 0, sprint: false, jump: false, jumpPressed: false, dashPressed: false, left: false, leftPressed: false, leftReleased: false, ePressed: false, rightPressed: false, ctrlPressed: false, aim: null };

export interface Match {
  t: number; phase: Phase; phaseT: number; seed: number;
  players: Player[];
  /** The human's player index, or -1 (bots only). */
  human: number;
  ball: Ball;
  score: Score;
  /** Touches by `touchTeam` since the ball last crossed; the last toucher, its team, and whether that was a block. */
  touches: number; touchTeam: Team | null; lastTouch: number; lastTeam: Team | null; lastBlock: boolean;
  /** The serve is in the air and hasn't crossed yet (a net is a fault). */
  serving: boolean;
  /** The human's power bar: seconds held, or null. */
  meter: number | null;
  serveTimer: number;
  /** A bot server's plan: when it tosses and its click's error. */
  botServe: { tossAt: number; power: number; err: number; clickAt: number | null };
  /** The ball's flight changed this many times (a contact, the net): predictions are cached by it. */
  flight: number;
  landing: { x: number; z: number; t: number; in: boolean } | null; landingFlight: number;
  /** Per team, the player taking the ball now (-1 none), set when the flight changes. */
  receiver: [number, number];
  ground: Ground; world: MoveWorld;
  pointTo: Team | null;
  /** The sides switch with the next serve's places, so the point plays out where it was scored. */
  switchPending: boolean;
  events: MatchEvent[];
  acc: number;
  latch: CourtInput;
}

// ── Random (seeded, in the state) ───────────────────────────────────────────
export function rand(m: { seed: number }): number {
  let t = (m.seed = (m.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const gauss = (m: { seed: number }) => Math.sqrt(-2 * Math.log(1 - rand(m))) * Math.cos(2 * Math.PI * rand(m));

const flatWorld: MoveWorld = { top: () => 0, wet: () => false };

export interface MatchOptions { human?: boolean; seed?: number; ground?: Ground; world?: MoveWorld; skill?: { partner: number; opponents: number }; serving?: Team }

export function createMatch(o: MatchOptions = {}): Match {
  const ground = o.ground ?? FLAT, world = o.world ?? flatWorld, human = o.human ?? true;
  const skill = o.skill ?? { partner: 0.75, opponents: 0.6 };
  const seed = o.seed ?? 1;
  const m: Match = {
    t: 0, phase: "serve", phaseT: 0, seed,
    players: [0, 1, 2, 3].map(i => ({
      team: (i < 2 ? 0 : 1) as Team, slot: (i % 2) as 0 | 1, bot: !(human && i === 0), skill: i === 0 ? 1 : i === 1 ? skill.partner : skill.opponents,
      s: createMoveState(0, 0, world), dive: null, down: 0, call: 0, cd: 0, block: 0, sinceDash: 9, want: 0.8, miss: false, lastQ: 0, blocked: false,
    })),
    human: human ? 0 : -1,
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 },
    score: openingScore(o.serving ?? 0, -1),
    touches: 0, touchTeam: null, lastTouch: -1, lastTeam: null, lastBlock: false, serving: false,
    meter: null, serveTimer: SERVE_TIME, botServe: { tossAt: 1, power: 0.7, err: 0, clickAt: null },
    flight: 0, landing: null, landingFlight: -1, receiver: [-1, -1],
    ground, world, pointTo: null, switchPending: false, events: [], acc: 0, latch: { ...NO_COURT_INPUT },
  };
  // The coin toss.
  if (o.serving === undefined) m.score = openingScore(rand(m) < 0.5 ? 0 : 1, -1);
  readyServe(m);
  return m;
}

export const serverOf = (m: Match) => m.score.serving * 2 + m.score.server[m.score.serving];
export const sideOfPlayer = (m: Match, i: number): Side => sideOfTeam(m.score, m.players[i].team);
export const partnerOf = (i: number) => i ^ 1;
const facingFor = (side: Side) => (side < 0 ? 0 : Math.PI);

/** Everyone to their places for the next serve; the ball in the server's hand. */
function readyServe(m: Match) {
  if (m.switchPending) { m.score = { ...m.score, side0: -m.score.side0 as Side }; m.switchPending = false; }
  const sv = serverOf(m), st = m.players[sv].team;
  for (let i = 0; i < 4; i++) {
    const p = m.players[i], side = sideOfPlayer(m, i);
    let x: number, z: number;
    if (i === sv) { x = (m.score.points[st] % 2 ? -1 : 1) * 1.1; z = side * (COURT.halfLength + 0.6); }
    else if (p.team === st) { x = -0.9; z = side * 1.3; }
    else { x = p.slot ? 1.4 : -1.4; z = side * (COURT.halfLength - 1.8); }
    const s = createMoveState(x, z, m.world, facingFor(side));
    Object.assign(p, { s, dive: null, down: 0, call: 0, cd: 0, block: 0, miss: false, lastQ: 0 });
  }
  Object.assign(m, { phase: "serve" as Phase, phaseT: 0, touches: 0, touchTeam: null, lastTouch: -1, lastTeam: null, lastBlock: false, serving: false,
    meter: null, serveTimer: SERVE_TIME, pointTo: null, receiver: [-1, -1] as [number, number] });
  m.botServe = { tossAt: 1 + rand(m) * 0.8, power: 0.55 + rand(m) * 0.4, err: 0, clickAt: null };
  holdBall(m);
}

function holdBall(m: Match) {
  const p = m.players[serverOf(m)].s, side = sideOfPlayer(m, serverOf(m));
  Object.assign(m.ball, { x: p.x, y: p.y + HAND.serve - 0.45, z: p.z - side * 0.3, vx: 0, vy: 0, vz: 0 });
}

function fault(m: Match, loser: Team, why: string) {
  if (m.phase === "point" || m.phase === "over") return;
  const winner = (loser ^ 1) as Team;
  const { score, switched, over } = awardRally(m.score, winner);
  m.score = { ...score, side0: m.score.side0 };
  m.switchPending = switched;
  m.pointTo = winner;
  m.events.push({ kind: "point", team: winner, why });
  if (over !== null) { m.events.push({ kind: "win", team: over }); m.phase = "over"; m.phaseT = 0; return; }
  if (switched) m.events.push({ kind: "switch" });
  m.phase = "point"; m.phaseT = 0;
}

// ── The serve ───────────────────────────────────────────────────────────────

function toss(m: Match, power: number) {
  const sv = serverOf(m), p = m.players[sv].s, h = TOSS.low + (TOSS.high - TOSS.low) * power;
  holdBall(m);
  m.ball.y = p.y + HAND.serve;
  m.ball.vy = Math.sqrt(2 * GRAVITY * h);
  m.botServe.power = power;
  m.phase = "toss"; m.phaseT = 0;
  m.events.push({ kind: "toss", who: sv, power });
}

/** The serve's click: judged on the timing circle; aims at `aim` (the server's side's opposite court). */
export function serveHit(m: Match, aim: { x: number; z: number } | null) {
  const sv = serverOf(m), p = m.players[sv], side = sideOfPlayer(m, sv), opp = -side, b = m.ball;
  const err = serveError(b.y, b.vy, p.s.y + HAND.serve, GRAVITY), judge = judgeServe(err);
  const target = aim ? aimOn(aim, opp as Side) : { x: 0, z: opp * COURT.halfLength * 0.6 };
  const jumped = p.s.mode === "air";
  let speed = (11 + 7 * m.botServe.power) * (jumped ? 1.15 : 1) * (judge === "perfect" ? 1.08 : 1);
  const from = { x: b.x, y: b.y, z: b.z };
  let v;
  if (judge === "late") v = driveTo(from, { x: target.x * 0.3, y: COURT.netTop - 0.35, z: 0 }, speed * 0.8);
  else {
    const to = judge === "early" ? { x: target.x, y: 0, z: opp * (COURT.halfLength + 1 + rand(m) * 1.5) } : { x: target.x, y: 0, z: target.z };
    v = driveTo(from, to, speed);
    while ((heightAtNet(from, v) ?? 99) < COURT.netTop + 0.25 && speed > 4) { speed *= 0.93; v = driveTo(from, to, speed); }
  }
  Object.assign(b, v);
  Object.assign(m, { phase: "rally" as Phase, phaseT: 0, serving: true, touches: 0, touchTeam: null, lastTouch: sv, lastTeam: p.team, lastBlock: false });
  m.flight++;
  m.events.push({ kind: "serve", who: sv, judge }, { kind: "contact", who: sv, how: "serve", quality: judge === "perfect" ? 1 : judge === "good" ? 0.7 : 0.2, x: b.x, y: b.y, z: b.z });
}

/** Where a look sends the ball: on `side`, as far out as the free zone (a look past the lines lands out). */
export function aimOn(p: { x: number; z: number }, side: Side) {
  const x = Math.max(-(COURT.halfWidth + 1.5), Math.min(COURT.halfWidth + 1.5, p.x));
  return { x, z: side * Math.max(0.8, Math.min(COURT.halfLength + 2, side * p.z > 0 ? Math.abs(p.z) : COURT.halfLength * 0.6)) };
}

// ── Contacts ────────────────────────────────────────────────────────────────

/** Where a team's first touch goes (the set spot) and where a set goes for player `j` (the attack spot). */
export const setSpot = (side: Side, x: number) => ({ x: Math.max(-1.5, Math.min(1.5, x * 0.4)), z: side * 1.1 });
export const attackSpot = (side: Side, x: number) => ({ x: Math.max(-(COURT.halfWidth - 0.6), Math.min(COURT.halfWidth - 0.6, x)), z: side * 0.7 });

/** The hand's height for a touch: where its window is centred. */
const handFor = (how: Touch) => HAND[how];

/** Would a touch reach now, and how well? null: out of reach. */
export function reachOf(m: Match, i: number, how: Touch): number | null {
  const p = m.players[i], b = m.ball, r = REACH[how];
  if (sideOf(b.z) !== sideOfPlayer(m, i) && Math.abs(b.z) > 0.15) return null;
  const off = Math.hypot(b.x - p.s.x, b.z - p.s.z), dy = b.y - (p.s.y + handFor(how));
  if (off > r.reach || Math.abs(dy) > r.band) return null;
  return touchQuality(dy / Math.max(2, Math.abs(b.vy)), off, r.reach);
}

/** A press of `how` by player `i`: the touch if the ball's in reach, a whiff (and a short cooldown) if not. */
export function press(m: Match, i: number, how: Touch | "jumpset", aim: { x: number; z: number } | null = null): boolean {
  const p = m.players[i];
  if (m.phase !== "rally" || p.cd > 0 || p.down > 0) return false;
  const kind: Touch = how === "jumpset" ? "set" : how;
  const q = reachOf(m, i, kind);
  if (q === null) { p.cd = WHIFF_COOLDOWN; m.events.push({ kind: "whiff", who: i }); return false; }
  touch(m, i, how, q, aim);
  return true;
}

function touch(m: Match, i: number, how: ContactKind, q: number, aim: { x: number; z: number } | null) {
  const p = m.players[i], b = m.ball, side = sideOfPlayer(m, i), opp = -side as Side;
  if (m.touchTeam === p.team) m.touches++; else { m.touchTeam = p.team; m.touches = 1; }
  p.cd = TOUCH_COOLDOWN;
  m.events.push({ kind: "contact", who: i, how, quality: q, x: b.x, y: b.y, z: b.z });
  if (m.lastTouch === i && !m.lastBlock) return fault(m, p.team, "double");
  if (m.touches > 3) return fault(m, p.team, "four");
  Object.assign(m, { lastTouch: i, lastTeam: p.team, lastBlock: false, serving: false });
  m.flight++;
  const from = { x: b.x, y: b.y, z: b.z }, scatter = (k: number) => ({ x: (rand(m) - 0.5) * 2 * k * (1 - q), z: (rand(m) - 0.5) * 2 * k * (1 - q) });
  const over = aim ? aimOn(aim, opp) : openSpot(m, opp);
  let v;
  if (how === "spike") {
    const e = scatter(1.5), to = { x: over.x + e.x, y: 0, z: over.z + e.z };
    v = driveTo(from, to, q >= 0.5 ? 15 + 7 * q : 9);
  } else if (m.touches >= 3) {
    // Third touch without a spike: a lob over (a free ball).
    const e = scatter(1.2);
    v = arcTo(from, { x: over.x + e.x, y: 0, z: over.z + e.z }, Math.max(b.y, COURT.netTop) + 1.4);
  } else {
    const mate = m.players[partnerOf(i)];
    const spot = m.touches === 1 && how !== "set" && how !== "jumpset" ? setSpot(side, p.s.x) : m.touches === 1 ? setSpot(side, mate.s.x) : attackSpot(side, mate.s.x);
    const e = scatter(how === "dig" ? 2.6 : how === "bump" ? 2.0 : 1.4);
    const apex = COURT.netTop + (how === "jumpset" ? 0.9 : m.touches === 2 ? 1.5 : 2.0 + 0.5 * q) - (how === "dig" ? 0.4 * (1 - q) : 0);
    // A shank: a touch this poor flies off the side.
    const shank = q < 0.15 && how !== "set" ? { x: Math.sign(p.s.x || 1) * (COURT.halfWidth + 1.5), z: 0 } : { x: 0, z: 0 };
    v = arcTo(from, { x: spot.x + e.x + shank.x, y: m.touches === 2 ? 2.9 : 1.6, z: spot.z + e.z }, apex);
  }
  Object.assign(b, v);
}

/** Block boxes: a spike (or any ball from the other side) through raised arms. */
function blocks(m: Match) {
  const b = m.ball;
  for (let i = 0; i < 4; i++) {
    const p = m.players[i], side = sideOfPlayer(m, i);
    if (p.block <= 0 || m.lastTeam === p.team || m.lastTeam === null) continue;
    if (Math.sign(b.vz) !== side || Math.abs(b.z) > 0.45) continue;
    const dx = Math.abs(b.x - p.s.x), top = p.s.y + HAND.spike + 0.35;
    if (dx > 0.5 || b.y < COURT.netTop - 0.1 || b.y > top) continue;
    const q = Math.max(0, 1 - 0.5 * (dx / 0.5) - 0.6 * Math.abs(BLOCK_TIME * 0.7 - p.block) / BLOCK_TIME);
    m.events.push({ kind: "contact", who: i, how: "block", quality: q, x: b.x, y: b.y, z: b.z });
    p.block = 0;
    m.flight++;
    if (q >= 0.7) {
      // Stuffed: straight down on the attacker's side; their touches start again.
      Object.assign(b, { z: -side * 0.15, vx: b.vx * 0.3, vy: -3, vz: -side * 3 });
      Object.assign(m, { touchTeam: null, touches: 0, lastTouch: i, lastTeam: p.team, lastBlock: true });
    } else {
      // Soft: it pops up on the blocker's side, one touch used.
      Object.assign(b, { z: side * 0.2, vx: b.vx * 0.3, vy: 3.5, vz: side * 1.8 });
      Object.assign(m, { touchTeam: p.team, touches: 1, lastTouch: i, lastTeam: p.team, lastBlock: true });
    }
    return;
  }
}

// ── Players ─────────────────────────────────────────────────────────────────

function movePlayer(m: Match, i: number, input: MoveInput, dt: number) {
  const p = m.players[i], side = sideOfPlayer(m, i);
  p.sinceDash = p.s.dashT > 0 ? 0 : p.sinceDash + dt;
  if (p.dive) {
    const d = p.dive, k = d.strong ? DIVE.slide : DIVE.normal;
    d.t += dt;
    const x = p.s.x + d.dx * k.speed * dt, z = p.s.z + d.dz * k.speed * dt;
    p.s = { ...p.s, x, z, y: m.ground(x, z), vx: d.dx * k.speed, vy: 0, vz: d.dz * k.speed, mode: "ground", events: [] };
    if (!d.dug && m.phase === "rally" && (m.lastTouch !== i || m.lastBlock)) {
      const b = m.ball, off = Math.hypot(b.x - x, b.z - z), dy = b.y - (p.s.y + HAND.dig);
      if (off <= k.reach && Math.abs(dy) <= REACH.dig.band && (sideOf(b.z) === side)) {
        d.dug = true;
        touch(m, i, "dig", touchQuality(dy / Math.max(2, Math.abs(b.vy)), off, k.reach) * (d.strong ? 1 : 0.8), null);
      }
    }
    if (d.t >= k.time) { p.dive = null; p.down = k.down; }
  } else if (p.down > 0) {
    p.down -= dt;
    p.s = { ...p.s, vx: 0, vz: 0, events: [] };
  } else {
    p.s = stepMove(p.s, input, dt, m.world, COURT_TUNING);
  }
  // Your own side and the free zone; the server stays behind the baseline until the serve is hit.
  const lim = COURT.halfLength + COURT.free, serving = (m.phase === "serve" || m.phase === "toss") && i === serverOf(m);
  let z = side * Math.max(serving ? COURT.halfLength + 0.05 : 0.2, Math.min(lim, side * p.s.z));
  if (serving && m.phase === "serve") z = side * Math.max(COURT.halfLength + 0.3, Math.min(COURT.halfLength + 1.2, side * p.s.z));
  const x = Math.max(-(COURT.halfWidth + COURT.free), Math.min(COURT.halfWidth + COURT.free, p.s.x));
  if (x !== p.s.x || z !== p.s.z) p.s = { ...p.s, x, z };
}

export function startDive(m: Match, i: number, dirX: number, dirZ: number) {
  const p = m.players[i];
  if (p.dive || p.down > 0 || p.s.mode === "air" || m.phase === "serve" || m.phase === "toss") return;
  const strong = p.s.dashT > 0 || p.sinceDash < SLIDE_WINDOW;
  let dx = dirX, dz = dirZ, l = Math.hypot(dx, dz);
  if (l < 0.1) { dx = Math.sin(p.s.facing); dz = Math.cos(p.s.facing); l = 1; }
  p.dive = { t: 0, dx: dx / l, dz: dz / l, strong, dug: false };
  m.events.push({ kind: "dive", who: i, strong });
}

function humanStep(m: Match, i: number, inp: CourtInput): MoveInput {
  const p = m.players[i], air = p.s.mode === "air";
  const sv = serverOf(m) === i;
  if (m.phase === "serve" && sv) {
    if (inp.leftPressed) m.meter = 0;
    if (m.meter !== null && inp.left) m.meter += STEP;
    if (m.meter !== null && (inp.leftReleased || !inp.left)) { const pw = meterPower(m.meter); m.meter = null; toss(m, pw); }
  } else if (m.phase === "toss" && sv) {
    if (inp.leftPressed) serveHit(m, inp.aim);
  } else if (m.phase === "rally") {
    if (inp.leftPressed) press(m, i, air ? "spike" : "bump", inp.aim);
    if (inp.ePressed) press(m, i, air ? "jumpset" : "set", inp.aim);
    if (inp.rightPressed) {
      if (air) { if (Math.abs(p.s.z) < 1.2) p.block = BLOCK_TIME; }
      else { p.call = CALL_TIME; m.events.push({ kind: "call", who: i }); m.flight++; }
    }
    if (inp.ctrlPressed) startDive(m, i, inp.x, inp.z);
  }
  return { ...NO_INPUT, x: inp.x, z: inp.z, sprint: inp.sprint, jump: inp.jump, jumpPressed: inp.jumpPressed, dashPressed: inp.dashPressed };
}

// ── The step ────────────────────────────────────────────────────────────────

export function stepMatch(m: Match, inp: CourtInput = NO_COURT_INPUT, dt = STEP) {
  m.t += dt; m.phaseT += dt;
  for (const p of m.players) { p.cd = Math.max(0, p.cd - dt); p.call = Math.max(0, p.call - dt); p.block = Math.max(0, p.block - dt); }
  if (m.phase === "point" || m.phase === "over") {
    if (m.phase === "point" && m.phaseT >= POINT_TIME) readyServe(m);
    else if (m.phase === "point") stepBall(m.ball, dt, m.ground);
    for (let i = 0; i < 4; i++) movePlayer(m, i, NO_INPUT, dt);
    return;
  }
  if (m.landingFlight !== m.flight) {
    m.landing = m.phase === "rally" ? predictLanding(m.ball, m.ground) : null;
    m.landingFlight = m.flight;
    m.receiver = pickReceivers(m);
  }
  const sv = serverOf(m);
  // The serve: the timer; a bot server tosses and clicks.
  if (m.phase === "serve") {
    m.serveTimer -= dt;
    if (m.serveTimer <= 0) return fault(m, m.players[sv].team, "timer");
    if (m.players[sv].bot && m.phaseT >= m.botServe.tossAt) toss(m, m.botServe.power);
  }
  if (m.phase === "toss" && m.players[sv].bot) {
    const bs = m.botServe, p = m.players[sv];
    if (bs.clickAt === null) {
      const ideal = timeToHeight(m.ball, p.s.y + HAND.serve) ?? 0.5;
      bs.err = gauss(m) * (0.025 + (1 - p.skill) * 0.07);
      bs.clickAt = m.phaseT + ideal + bs.err;
    }
    if (m.phaseT >= bs.clickAt) {
      const opp = -sideOfPlayer(m, sv);
      serveHit(m, { x: (rand(m) - 0.5) * 2 * (COURT.halfWidth - 0.5), z: opp * COURT.halfLength * (0.45 + rand(m) * 0.45) });
    }
  }
  // Players.
  for (let i = 0; i < 4; i++) {
    const input = m.players[i].bot ? botInput(m, i) : humanStep(m, i, inp);
    if (m.phase === "serve" && i === sv) holdBall(m);
    movePlayer(m, i, input, dt);
  }
  if (m.phase === "serve") { holdBall(m); return; }
  // The ball.
  const z0 = m.ball.z, e = stepBall(m.ball, dt, m.ground);
  if (m.phase === "toss") {
    const p = m.players[sv].s;
    if (e?.kind === "land" || m.ball.y < p.y + 0.1) fault(m, m.players[sv].team, "dropped");
    return;
  }
  if (Math.sign(m.ball.z) !== Math.sign(z0) && Math.sign(m.ball.z) !== 0) {
    m.touchTeam = null; m.touches = 0; m.serving = false; m.flight++;
  }
  if (e) {
    if (e.kind === "net" || e.kind === "tape") { m.events.push({ kind: e.kind }); m.flight++; }
    if (e.kind === "net" && m.serving) return fault(m, m.lastTeam ?? 0, "net");
    if (e.kind === "antenna") return fault(m, m.lastTeam ?? 0, "antenna");
    if (e.kind === "land") {
      m.events.push(e);
      return fault(m, landingLoser(m.score, e.in, sideOf(e.z), m.lastTeam), e.in ? "in" : "out");
    }
  }
  blocks(m);
}

/** A frame: whole steps, presses latched to the next step (as the movement sim's advanceMove). Returns the events. */
export function advanceMatch(m: Match, inp: CourtInput, frameDt: number): MatchEvent[] {
  m.acc += Math.min(Math.max(0, frameDt), 0.1);
  const l = m.latch;
  l.jumpPressed ||= inp.jumpPressed; l.dashPressed ||= inp.dashPressed; l.leftPressed ||= inp.leftPressed; l.leftReleased ||= inp.leftReleased;
  l.ePressed ||= inp.ePressed; l.rightPressed ||= inp.rightPressed; l.ctrlPressed ||= inp.ctrlPressed;
  m.events = [];
  while (m.acc >= STEP - 1e-9) {
    m.acc -= STEP;
    stepMatch(m, { ...inp, jump: inp.jump || l.jumpPressed, jumpPressed: l.jumpPressed, dashPressed: l.dashPressed, leftPressed: l.leftPressed, leftReleased: l.leftReleased,
      ePressed: l.ePressed, rightPressed: l.rightPressed, ctrlPressed: l.ctrlPressed });
    l.jumpPressed = l.dashPressed = l.leftPressed = l.leftReleased = l.ePressed = l.rightPressed = l.ctrlPressed = false;
  }
  return m.events;
}
