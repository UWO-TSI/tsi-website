import { DAMPING, EDGE_BOUNCE, FILL_RATE, GRAVITY, HOLD_ACCEL, RARITY_META, START_PROGRESS, bossOf, type FishDef } from "./fishing";

const STEP = 1 / 60;

/**
 * The boss reel (specs/launch/v1-gameplay.md, "Fish tiers and fights"): a legendary or divine fish fights back. It has
 * stamina, worn down only while you keep it inside the bar, and the progress bar becomes the line: it drains faster
 * outside the bar, and an empty line loses the fish. Every few seconds the fish telegraphs a move, then makes it:
 *   run    it tears off to the far end of the track at speed;
 *   jump   it leaps out of the water: ease off (release) or the line takes the strain;
 *   dive   it sounds: the bar grows heavy and answers slowly either way;
 *   slack  it swims at you and the line goes slack: keep reeling (hold) to take it up.
 * Three phases by stamina, each with shorter warnings and quicker moves. A divine fish's stamina is the room's
 * (`shared`): the reel reports the damage it deals (`dealt`) and the server sets `stamina`. Behind the flag (fishing.ts
 * fishBosses): off, every fish reels the ordinary way.
 */
export type BossMove = "run" | "jump" | "dive" | "slack";
export const BOSS_MOVES: readonly BossMove[] = ["run", "jump", "dive", "slack"];
export const BOSS = {
  /** Stamina worn per second while the fish is inside the bar (and a divine fish's damage per player). */
  wear: 0.06,
  /** Stamina won back per second while it's outside. */
  recover: 0.01,
  /** The line's start, refill (per second, inside) and drain multiplier (outside, over the common reel's). */
  line: 0.6, refill: 0.24, drainMul: 1.1,
  /** Line lost per second holding through a jump, or not reeling through slack. */
  jumpStrain: 0.9, slackDrain: 0.6,
  /** A dive's heavy bar: it answers this much as fast, reeling or not. */
  diveHeavy: 0.55,
  /** A run's speed and pull multiplier. */
  runMul: 2.4,
  /** By phase (1..3): seconds between moves (plus up to `gapJitter`), the telegraph's warning, the bar's width. */
  gap: [4.6, 3.6, 2.6], gapJitter: 1.4, warn: [1.0, 0.85, 0.65], barMul: [0.95, 0.9, 0.85],
  /** How long each move lasts (s). */
  length: { run: 1.8, jump: 1.1, dive: 1.7, slack: 1.3 } as Record<BossMove, number>,
};

/** The boss reel's own state (null for an ordinary fish). */
export interface BossReel {
  stamina: number;
  phase: 1 | 2 | 3;
  /** The move warned of or under way, and its stage: warning until `until`, then live until `ends`. */
  move: BossMove | null;
  stage: "warn" | "live" | null;
  until: number;
  ends: number;
  /** When the next move is warned of (reel seconds). */
  nextAt: number;
  /** Stamina worn by this reel since it was last read (a divine fish's damage report). */
  dealt: number;
  /** The room keeps the stamina (divine): don't wear it here. */
  shared: boolean;
}

export const bossPhase = (stamina: number): 1 | 2 | 3 => (stamina > 2 / 3 ? 1 : stamina > 1 / 3 ? 2 : 3);

/**
 * A help on the next reels, whatever overlay draws them: `floor`, progress never drains below it, so the fish can't get
 * away. The tutorial sets it for the first catch (t-catch: components/game/arrival/FirstCatchTeach.tsx) and clears it.
 */
export const reelAssist = { floor: 0 };

/** `floor`: progress never drains below it (by default the reel assist's). */
export function createFishingReel(fish: FishDef, boss = bossOf(fish.rarity), floor = reelAssist.floor) {
  return {
    fish,
    floor,
    barWidth: RARITY_META[fish.rarity].barW * (boss ? BOSS.barMul[0] : 1),
    position: 0,
    velocity: 0,
    fishPosition: 0.15,
    fishVelocity: 0,
    fishTarget: 0.4,
    speedMultiplier: 1,
    retargetAt: 0.6,
    elapsed: 0,
    remainder: 0,
    progress: boss ? BOSS.line : START_PROGRESS,
    tension: 0,
    inside: true,
    result: null as boolean | null,
    boss: boss ? { stamina: 1, phase: 1, move: null, stage: null, until: 0, ends: 0, nextAt: 2.2, dealt: 0, shared: boss === "shared" } as BossReel : null,
  };
}

export type FishingReel = ReturnType<typeof createFishingReel>;

/** Preserve the authored 60 Hz fight on every display; bound suspended-frame catch-up. */
/** `tensionMul` (rod tier, rods.ts) scales how fast progress drains while the fish is outside the bar. */
export function advanceFishingReel(state: FishingReel, delta: number, holding: boolean, dartChanceMultiplier: number, random = Math.random, tensionMul = 1) {
  const events = { bounced: false, darted: false, warned: null as BossMove | null, moved: null as BossMove | null, phased: false };
  if (state.result !== null) return events;
  state.remainder += Math.max(0, Math.min(delta, 0.1));
  const move = state.fish.move;
  const drainRate = (0.17 + 0.09 * (1 - state.barWidth / 0.3)) * tensionMul;
  const boss = state.boss;
  while (state.remainder + 1e-9 >= STEP && state.result === null) {
    state.remainder = Math.max(0, state.remainder - STEP);
    state.elapsed += STEP;
    const live = boss?.stage === "live" ? boss.move : null;
    if (boss) bossTurn(state, boss, random, events);
    state.velocity += (holding ? HOLD_ACCEL : -GRAVITY) * (live === "dive" ? BOSS.diveHeavy : 1) * STEP;
    state.velocity *= Math.exp(-DAMPING * STEP);
    state.position += state.velocity * STEP;
    if (state.position < 0) {
      state.position = 0;
      if (Math.abs(state.velocity) < 0.12) state.velocity = 0;
      else {
        state.velocity = -state.velocity * EDGE_BOUNCE;
        events.bounced = true;
      }
    } else if (state.position > 1 - state.barWidth) {
      state.position = 1 - state.barWidth;
      state.velocity = 0;
    }

    if (live === "run" || live === "jump") {
      // A run holds its far end; a jump is out of the water (the fish's own course resumes as it lands).
    } else if (state.elapsed >= state.retargetAt) {
      const dart = random() < move.dartChance * dartChanceMultiplier;
      state.fishTarget = random();
      state.speedMultiplier = dart ? move.dartMul : 1;
      state.retargetAt = state.elapsed + move.retargetMs / 1000 * (0.6 + 0.8 * random());
      events.darted ||= dart;
    }
    const distance = state.fishTarget - state.fishPosition;
    const maxSpeed = move.speed * state.speedMultiplier;
    state.fishVelocity += Math.sign(distance) * move.accel * state.speedMultiplier * STEP;
    if (Math.abs(distance) < 0.04) state.fishVelocity *= Math.exp(-6 * STEP);
    state.fishVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, state.fishVelocity));
    state.fishPosition += state.fishVelocity * STEP + Math.sin(state.elapsed * 1000 / 90) * move.jitter;
    if (state.fishPosition < 0) { state.fishPosition = 0; state.fishVelocity = 0; }
    else if (state.fishPosition > 1) { state.fishPosition = 1; state.fishVelocity = 0; }

    state.inside = live !== "jump" && state.fishPosition >= state.position - 0.015 && state.fishPosition <= state.position + state.barWidth + 0.015;
    state.tension = state.inside ? Math.min(1, state.tension + STEP / 1.2) : Math.max(0, state.tension - STEP / 0.5);
    if (boss) {
      // The line: topped up inside, drained outside; a jump strains it if you hold, slack drains it if you don't.
      let line = state.inside ? BOSS.refill : live === "jump" ? 0 : -drainRate * BOSS.drainMul;
      if (live === "jump" && holding) line -= BOSS.jumpStrain;
      if (live === "slack") line = holding ? Math.max(line, 0) : -BOSS.slackDrain;
      state.progress = Math.max(0, Math.min(1, state.progress + line * STEP));
      const wear = state.inside ? BOSS.wear * STEP : 0;
      boss.dealt += wear;
      if (!boss.shared) boss.stamina = Math.max(0, Math.min(1, boss.stamina - wear + (state.inside || live === "jump" ? 0 : BOSS.recover * STEP)));
      if (boss.stamina === 0) state.result = true;
      else if (state.progress === 0) state.result = false;
      continue;
    }
    state.progress = Math.max(state.floor, Math.min(1, state.progress + (state.inside ? FILL_RATE : -drainRate) * STEP));
    if (state.progress === 1) state.result = true;
    else if (state.progress === 0) state.result = false;
  }
  return events;
}

/** The boss's moves: warn, make the move, rest; quicker by phase. One reel step (module scope, no allocation). */
function bossTurn(state: FishingReel, boss: BossReel, random: () => number, events: { warned: BossMove | null; moved: BossMove | null; phased: boolean }) {
  const phase = bossPhase(boss.stamina);
  if (phase !== boss.phase) {
    boss.phase = phase;
    state.barWidth = RARITY_META[state.fish.rarity].barW * BOSS.barMul[phase - 1];
    state.position = Math.min(state.position, 1 - state.barWidth);
    events.phased = true;
  }
  const t = state.elapsed;
  if (boss.stage === null && t >= boss.nextAt) {
    boss.move = BOSS_MOVES[Math.floor(random() * BOSS_MOVES.length) % BOSS_MOVES.length];
    boss.stage = "warn";
    boss.until = t + BOSS.warn[phase - 1];
    events.warned = boss.move;
  } else if (boss.stage === "warn" && t >= boss.until) {
    const move = boss.move!;
    boss.stage = "live";
    boss.ends = t + BOSS.length[move];
    events.moved = move;
    if (move === "run") {
      state.fishTarget = state.fishPosition < 0.5 ? 0.97 : 0.03;
      state.speedMultiplier = BOSS.runMul;
    } else if (move === "slack") {
      state.fishTarget = Math.max(0.03, state.position - 0.1); // toward you: the line goes slack
      state.speedMultiplier = 1.6;
    }
  } else if (boss.stage === "live" && t >= boss.ends) {
    if (boss.move === "jump") { state.fishPosition = 0.1 + 0.8 * random(); state.fishVelocity = 0; } // it lands somewhere else
    boss.stage = null;
    boss.move = null;
    state.speedMultiplier = 1;
    state.retargetAt = t;
    boss.nextAt = t + BOSS.gap[phase - 1] + BOSS.gapJitter * random();
  }
}
