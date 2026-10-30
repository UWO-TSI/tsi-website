/**
 * The match (specs/minigames/beach-volleyball.md §4 to §6): 2v2 on the court's frame (court.ts), stepped at the
 * movement sim's 1/120 s. Every player walks, jumps and dashes with the movement sim (`stepMove`, the court's tuning);
 * the human's inputs come from the scene, the bots' from bot.ts. The ball, the serve, the contacts, the faults and the
 * score live here. Pure (no three.js, no clock, a seeded random), so phase 2's server can run it as it is.
 */
import { MOVE_TUNING, NO_INPUT, STEP, createMoveState, stepMove, type MoveInput, type MoveState, type MoveWorld } from "@/lib/game/movement/sim";
import { FLAT, GRAVITY, arcTo, ballAt, driveTo, heightAtNet, predictLanding, realVy, stepBall, timeToHeight, type Ball, type Ground } from "./ball";
import { BALL_R, COURT, sideOf, type Side } from "./court";
import { VB_FEEL, paceFor } from "./feel";
import { VB_CLIPS } from "./clips";
import { awardRally, landingLoser, openingScore, sideOfTeam, type Score, type Team } from "./rules";
import { judgeServe, meterPower, serveError, touchQuality, type ServeJudge } from "./timing";
import { botInput, openSpot, pickReceivers } from "./bot";
import { actionFor, stanceOf, type Control } from "./actions";

/**
 * On the sand (feel.ts): a little slower than the island's walk with a gentler build-up, a higher and floatier jump that
 * a released key never cuts short, no glider, no bunny-hop, no long jump.
 */
const F = VB_FEEL;
export const COURT_TUNING = {
  ...MOVE_TUNING, walkSpeed: F.move.walk, sprintSpeed: F.move.sprint, groundResponse: F.move.response, stopResponse: F.move.stop,
  jumpHeight: F.jump.height, jumpApexTime: F.jump.apexTime, fallGravity: F.jump.fallGravity, jumpCutGravity: 1, longJumpAt: 99, glider: 0, hopChainMax: 0,
};
/** Hand heights above the feet for each contact: the vb_* clips' contact points (clips.ts; the rig's arms reach about 0.85 u). */
const cp = (c: { contactPoint: readonly [number, number, number] }) => c.contactPoint[1];
export const HAND = { bump: cp(VB_CLIPS.vb_bump), set: cp(VB_CLIPS.vb_set), spike: cp(VB_CLIPS.vb_spike_hit), serve: cp(VB_CLIPS.vb_serve_stand), dig: cp(VB_CLIPS.vb_dive) } as const;
export type Touch = "bump" | "set" | "spike" | "dig";
/** Reach from the body (horizontal) and the height band round the hand (either side). */
export const REACH: Record<Touch, { reach: number; band: number }> = {
  bump: { reach: 0.95, band: 0.5 }, set: { reach: 0.8, band: 0.45 }, spike: { reach: 0.85, band: 0.5 }, dig: { reach: 1.0, band: 0.45 },
};
/** The lunge (its time on the move) and the time on the sand after, so you're up as vb_dive and vb_slide_dive stand (`up`, 1.4 s). */
export const DIVE = {
  normal: { speed: 7, time: 0.45, down: 0.95, reach: 1.0 },
  slide: { speed: 10.5, time: 0.5, down: 0.9, reach: 1.3 },
} as const;
/** A dash this recent (s), or still running, turns Ctrl's dive into the slide dive. */
export const SLIDE_WINDOW = 0.3;
/** After a touch, presses wait this long (no accidental double contact). */
export const TOUCH_COOLDOWN = 0.3;
export const WHIFF_COOLDOWN = 0.35, BLOCK_TIME = VB_FEEL.block.time, CALL_TIME = 1.5, SERVE_TIME = 10, POINT_TIME = 1.8;
/** The toss's height above the hand, by the power bar. */
export const TOSS = { low: 1.1, high: 3.2 } as const;

export type Phase = "serve" | "toss" | "rally" | "point" | "over";
export type Timing = "perfect" | "good" | "early" | "late";
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
  /** A press waiting for the ball to reach the hands (feel.ts timing.buffer): what, when pressed, where it looked. */
  pend: { how: Touch | "jumpset"; at: number; aim: { x: number; z: number } | null } | null;
}

export type MatchEvent =
  /** A touch: its quality (0..1) and its timing grade (feel.ts timing: perfect, good, or off early or late). */
  | { kind: "contact"; who: number; how: ContactKind; quality: number; timing: Timing; x: number; y: number; z: number }
  | { kind: "whiff"; who: number; how: Touch | "jumpset" }
  | { kind: "serve"; who: number; judge: ServeJudge }
  | { kind: "toss"; who: number; power: number; max: boolean }
  /** A press that counted (it touches now or waits for the ball): the clip's wind-up and the action bar's flash. */
  | { kind: "press"; who: number; how: Touch | "jumpset" }
  | { kind: "block"; who: number }
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
  /** The serve: where in the timing ring the click landed (−1..1, x right, y up) and the contact point on the ball. */
  ring: { x: number; y: number } | null; spin: { x: number; y: number } | null;
}
export const NO_COURT_INPUT: CourtInput = { x: 0, z: 0, sprint: false, jump: false, jumpPressed: false, dashPressed: false, left: false, leftPressed: false, leftReleased: false, ePressed: false, rightPressed: false, ctrlPressed: false, aim: null, ring: null, spin: null };

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
  /** The human's power bar: seconds held, or null. The last toss was at max power. */
  meter: number | null; maxPower: boolean;
  /** Touches since the serve (the ball's pace quickens with them). */
  rallyTouches: number;
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
      s: createMoveState(0, 0, world), dive: null, down: 0, call: 0, cd: 0, block: 0, sinceDash: 9, want: 0.8, miss: false, lastQ: 0, blocked: false, pend: null,
    })),
    human: human ? 0 : -1,
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 },
    score: openingScore(o.serving ?? 0, -1),
    touches: 0, touchTeam: null, lastTouch: -1, lastTeam: null, lastBlock: false, serving: false,
    meter: null, maxPower: false, rallyTouches: 0, serveTimer: SERVE_TIME, botServe: { tossAt: 1, power: 0.7, err: 0, clickAt: null },
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
    Object.assign(p, { s, dive: null, down: 0, call: 0, cd: 0, block: 0, miss: false, lastQ: 0, pend: null });
  }
  Object.assign(m, { phase: "serve" as Phase, phaseT: 0, touches: 0, touchTeam: null, lastTouch: -1, lastTeam: null, lastBlock: false, serving: false,
    meter: null, maxPower: false, rallyTouches: 0, serveTimer: SERVE_TIME, pointTo: null, receiver: [-1, -1] as [number, number] });
  m.botServe = { tossAt: 1 + rand(m) * 0.8, power: 0.55 + rand(m) * 0.4, err: 0, clickAt: null };
  holdBall(m);
}

function holdBall(m: Match) {
  const p = m.players[serverOf(m)].s, side = sideOfPlayer(m, serverOf(m));
  // In the right hand, a little ahead (vb_serve_toss holds it there), clear of the head in the camera's view.
  Object.assign(m.ball, { x: p.x + side * 0.25, y: p.y + HAND.serve - 0.45, z: p.z - side * 0.3, vx: 0, vy: 0, vz: 0, k: paceFor(0, pointsPlayed(m)), cx: 0, cy: 0 });
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
  m.maxPower = power >= F.serve.maxPower;
  m.phase = "toss"; m.phaseT = 0;
  m.events.push({ kind: "toss", who: sv, power, max: m.maxPower });
}

const pointsPlayed = (m: Match) => m.score.points[0] + m.score.points[1];

/** The serve's timing error now (timing.ts serveError) on the ball's own clock. */
export function serveErrNow(b: Ball, handY: number): number {
  const k = b.k ?? 1;
  return serveError(b.y, realVy(b), handY, (GRAVITY + (b.cy ?? 0)) * k * k);
}

/**
 * The serve's click: judged on the timing circle; aims at `aim` (the server's side's opposite court), moved by where in
 * the ring the click landed (`ring`), curved by the contact point on the ball (`spin`), harder after a max-power toss.
 */
export function serveHit(m: Match, aim: { x: number; z: number } | null, ring: { x: number; y: number } | null = null, spin: { x: number; y: number } | null = null) {
  const sv = serverOf(m), p = m.players[sv], side = sideOfPlayer(m, sv), opp = -side as Side, b = m.ball;
  const err = serveErrNow(b, p.s.y + HAND.serve), judge = judgeServe(err);
  let target = aim ? aimOn(aim, opp) : { x: 0, z: opp * COURT.halfLength * 0.6 };
  // The server faces the net, so the screen's right is +x on side +1 and −x on side −1.
  const right = side;
  if (ring) target = aimOn({ x: target.x + ring.x * right * F.serve.ringAcross, z: target.z + opp * ring.y * F.serve.ringDeep }, opp);
  const jumped = p.s.mode === "air";
  let speed = (11 + 7 * m.botServe.power) * (jumped ? 1.15 : 1) * (judge === "perfect" ? 1.08 : 1) * (m.maxPower ? F.serve.maxBonus : 1);
  // Hit the ball's right side and it curves left; hit its top and it dives (a float off its bottom).
  const cx = spin ? -spin.x * right * F.serve.curve : 0, cy = spin ? spin.y * F.serve.topspin : 0;
  const from = { x: b.x, y: b.y, z: b.z };
  let v;
  if (judge === "late") v = driveTo(from, { x: target.x * 0.3, y: COURT.netTop - 0.35, z: 0 }, speed * 0.8, cy);
  else {
    const to = judge === "early" ? { x: target.x, y: 0, z: opp * (COURT.halfLength + 1 + rand(m) * 1.5) } : { x: target.x, y: 0, z: target.z };
    // A quarter of the curve is aimed off, so the ball bends visibly and still lands near where it was sent.
    const tb = Math.hypot(to.x - from.x, to.z - from.z) / speed;
    to.x -= 0.25 * cx * tb * tb;
    v = driveTo(from, to, speed, cy);
    while ((heightAtNet(from, v) ?? 99) < COURT.netTop + 0.25 && speed > 4) { speed *= 0.93; v = driveTo(from, to, speed, cy); }
  }
  Object.assign(b, v, { cx, cy, k: paceFor(0, pointsPlayed(m)) });
  Object.assign(m, { phase: "rally" as Phase, phaseT: 0, serving: true, touches: 0, touchTeam: null, lastTouch: sv, lastTeam: p.team, lastBlock: false });
  m.flight++;
  m.events.push({ kind: "serve", who: sv, judge }, { kind: "contact", who: sv, how: "serve", quality: judge === "perfect" ? 1 : judge === "good" ? 0.7 : 0.2, timing: judge, x: b.x, y: b.y, z: b.z });
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

/** The ball against player `i`'s hands for a touch: how far above them (dy) and off the body; null: out of reach. */
function contactOf(m: Match, i: number, how: Touch): { dy: number; off: number } | null {
  const p = m.players[i], b = m.ball, r = REACH[how];
  if (sideOf(b.z) !== sideOfPlayer(m, i) && Math.abs(b.z) > 0.15 + BALL_R) return null;
  const off = Math.hypot(b.x - p.s.x, b.z - p.s.z), dy = b.y - (p.s.y + HAND[how]);
  return off > r.reach || Math.abs(dy) > r.band ? null : { dy, off };
}

/** Would a touch reach now, and how well (as if touched this moment)? null: out of reach. */
export function reachOf(m: Match, i: number, how: Touch): number | null {
  const c = contactOf(m, i, how);
  return c && touchQuality(c.dy / Math.max(1, Math.abs(realVy(m.ball))), c.off, REACH[how].reach);
}

/** Reached the hands: at or under them, or rising into them (a pop off a block). */
const atHands = (m: Match, c: { dy: number }) => c.dy <= 0 || m.ball.vy > 0;

/**
 * A press of `how` by player `i`. The ball at the hands: the touch now, graded by how late. Still coming down to them
 * within the buffer (feel.ts): the press waits and touches as it arrives, graded by how early it was. Nothing coming:
 * a whiff, and a short cooldown so spamming doesn't work.
 */
export function press(m: Match, i: number, how: Touch | "jumpset", aim: { x: number; z: number } | null = null): boolean {
  const p = m.players[i];
  if (m.phase !== "rally" || p.cd > 0 || p.down > 0 || p.pend) return false;
  const kind: Touch = how === "jumpset" ? "set" : how, r = REACH[kind];
  const c = contactOf(m, i, kind);
  if (c && atHands(m, c)) {
    m.events.push({ kind: "press", who: i, how });
    const late = -c.dy / Math.max(1, Math.abs(realVy(m.ball)));
    touch(m, i, how, touchQuality(late, c.off, r.reach), aim, timingOf(late));
    return true;
  }
  const t = timeToHeight(m.ball, p.s.y + HAND[kind]);
  if (t !== null && t <= F.timing.buffer && sideOf(m.ball.z) === sideOfPlayer(m, i)) {
    const at = ballAt(m.ball, t);
    // Near enough that a step or two (or the jump's rise) brings the hands to it.
    if (Math.hypot(at.x - p.s.x, at.z - p.s.z) <= r.reach + 0.9) {
      p.pend = { how, at: m.t, aim };
      m.events.push({ kind: "press", who: i, how });
      return true;
    }
  }
  p.cd = WHIFF_COOLDOWN;
  m.events.push({ kind: "whiff", who: i, how });
  return false;
}

/** Waiting presses: touch as the ball reaches the hands, or whiff once the buffer runs out. */
function resolvePresses(m: Match) {
  for (let i = 0; i < 4; i++) {
    const p = m.players[i], w = p.pend;
    if (!w || m.phase !== "rally") { p.pend = null; continue; }
    const kind: Touch = w.how === "jumpset" ? "set" : w.how, early = m.t - w.at, c = contactOf(m, i, kind);
    if (c && atHands(m, c)) { p.pend = null; touch(m, i, w.how, touchQuality(early, c.off, REACH[kind].reach), w.aim, timingOf(-early)); }
    else if (early > F.timing.buffer + 0.05 || p.down > 0 || p.dive) { p.pend = null; p.cd = WHIFF_COOLDOWN; m.events.push({ kind: "whiff", who: i, how: w.how }); }
  }
}

/** A touch's timing grade from how far off the ideal moment it was (s; negative early, positive late). */
export function timingOf(off: number): Timing {
  const a = Math.abs(off);
  return a <= F.timing.perfect ? "perfect" : a <= F.timing.good ? "good" : off < 0 ? "early" : "late";
}

function touch(m: Match, i: number, how: ContactKind, q: number, aim: { x: number; z: number } | null, timing: Timing) {
  const p = m.players[i], b = m.ball, side = sideOfPlayer(m, i), opp = -side as Side;
  if (m.touchTeam === p.team) m.touches++; else { m.touchTeam = p.team; m.touches = 1; }
  p.cd = TOUCH_COOLDOWN;
  // The ball quickens with every touch of the rally, and a touch takes any spin off it.
  m.rallyTouches++;
  Object.assign(b, { k: paceFor(m.rallyTouches, pointsPlayed(m)), cx: 0, cy: 0 });
  m.events.push({ kind: "contact", who: i, how, quality: q, timing, x: b.x, y: b.y, z: b.z });
  if (m.lastTouch === i && !m.lastBlock) return fault(m, p.team, "double");
  if (m.touches > 3) return fault(m, p.team, "four");
  Object.assign(m, { lastTouch: i, lastTeam: p.team, lastBlock: false, serving: false });
  m.flight++;
  const from = { x: b.x, y: b.y, z: b.z }, scatter = (k: number) => ({ x: (rand(m) - 0.5) * 2 * k * (1 - q), z: (rand(m) - 0.5) * 2 * k * (1 - q) });
  const over = aim ? aimOn(aim, opp) : openSpot(m, opp);
  let v;
  if (how === "spike") {
    const e = scatter(1.5), to = { x: over.x + e.x, y: 0, z: over.z + e.z };
    let speed = q >= 0.5 ? 15 + 7 * q : 9;
    v = driveTo(from, to, speed);
    // A good spike clears the tape (it slows into a steeper arc); a poor one may find the net.
    while (q >= 0.5 && (heightAtNet(from, v) ?? 99) < COURT.netTop + BALL_R + 0.05 && speed > 6) { speed *= 0.92; v = driveTo(from, to, speed); }
  } else if (m.touches >= 3) {
    // Third touch without a spike: a lob over (a free ball).
    const e = scatter(1.2);
    v = arcTo(from, { x: over.x + e.x, y: 0, z: over.z + e.z }, Math.max(b.y, COURT.netTop) + 1.4);
  } else {
    const mate = m.players[partnerOf(i)];
    const spot = m.touches === 1 && how !== "set" && how !== "jumpset" ? setSpot(side, p.s.x) : m.touches === 1 ? setSpot(side, mate.s.x) : attackSpot(side, mate.s.x);
    const e = scatter(how === "dig" ? 2.6 : how === "bump" ? 2.0 : 1.4);
    const apex = COURT.netTop + (how === "jumpset" ? 1.7 : m.touches === 2 ? 2.4 : 2.0 + 0.5 * q) - (how === "dig" ? 0.4 * (1 - q) : 0);
    // A shank: a touch this poor flies off the side.
    const shank = q < 0.15 && how !== "set" ? { x: Math.sign(p.s.x || 1) * (COURT.halfWidth + 1.5), z: 0 } : { x: 0, z: 0 };
    v = arcTo(from, { x: spot.x + e.x + shank.x, y: m.touches === 2 ? COURT_TUNING.jumpHeight * 0.85 + HAND.spike : 1.6, z: spot.z + e.z }, apex);
  }
  Object.assign(b, v);
}

/** Block boxes: a spike (or any ball from the other side) through raised arms. */
function blocks(m: Match) {
  const b = m.ball;
  for (let i = 0; i < 4; i++) {
    const p = m.players[i], side = sideOfPlayer(m, i);
    if (p.block <= 0 || m.lastTeam === p.team || m.lastTeam === null || Math.abs(p.s.z) > F.block.nearNet) continue;
    if (Math.sign(b.vz) !== side || Math.abs(b.z) > 0.3 + BALL_R) continue;
    const dx = Math.abs(b.x - p.s.x), top = p.s.y + HAND.spike + 0.35, hw = F.block.halfWidth;
    if (dx > hw || b.y < COURT.netTop - 0.1 || b.y > top) continue;
    // Best with the arms freshly up (their first 60%), centred on the ball.
    const q = Math.max(0, 1 - 0.5 * (dx / hw) - 0.6 * Math.max(0, (BLOCK_TIME - p.block) / BLOCK_TIME - 0.6));
    // Arms up too soon read as early; a block's timing is how fresh its arms were.
    m.events.push({ kind: "contact", who: i, how: "block", quality: q, timing: q >= 0.85 ? "perfect" : q >= 0.6 ? "good" : "early", x: b.x, y: b.y, z: b.z });
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
        const late = -dy / Math.max(1, Math.abs(realVy(b)));
        touch(m, i, "dig", touchQuality(late, off, k.reach) * (d.strong ? 1 : 0.8), null, timingOf(late));
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

/** The human's controls this step, through the one table of what each control does now (actions.ts). */
function humanStep(m: Match, i: number, inp: CourtInput): MoveInput {
  const p = m.players[i];
  // The serve's power bar: hold, and release to toss (a hold, not a press, so it stays out of the table's presses).
  if (stanceOf(m, i) === "serve") {
    if (inp.leftPressed) m.meter = 0;
    if (m.meter !== null && inp.left) m.meter += STEP;
    if (m.meter !== null && (inp.leftReleased || !inp.left)) { const pw = meterPower(m.meter); m.meter = null; toss(m, pw); }
  }
  const pressed: [Control, boolean][] = [["left", inp.leftPressed], ["e", inp.ePressed], ["right", inp.rightPressed], ["ctrl", inp.ctrlPressed]];
  for (const [c, on] of pressed) {
    if (!on) continue;
    const a = actionFor(m, i, c);
    if (a === "serve") serveHit(m, inp.aim, inp.ring, inp.spin);
    else if (a === "bump" || a === "set" || a === "spike" || a === "jumpset") press(m, i, a, inp.aim);
    else if (a === "call") { p.call = CALL_TIME; m.events.push({ kind: "call", who: i }); m.flight++; }
    // Arms up for the rest of the jump (once a jump); they only stop a ball at the net (blocks).
    else if (a === "block" && !p.blocked) { p.block = BLOCK_TIME; p.blocked = true; m.events.push({ kind: "block", who: i }); }
    else if (a === "dive" || a === "slide") startDive(m, i, inp.x, inp.z);
  }
  if (p.s.mode !== "air") p.blocked = false;
  // Holding the ball before the toss, you walk the baseline but don't jump.
  const still = stanceOf(m, i) === "serve";
  return { ...NO_INPUT, x: inp.x, z: inp.z, sprint: inp.sprint, jump: inp.jump && !still, jumpPressed: inp.jumpPressed && !still, dashPressed: inp.dashPressed };
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
  resolvePresses(m);
  if (m.phase === "rally") blocks(m);
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
