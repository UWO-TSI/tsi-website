import { DAMPING, EDGE_BOUNCE, FILL_RATE, GRAVITY, HOLD_ACCEL, RARITY_META, START_PROGRESS, type FishDef } from "./fishing";

const STEP = 1 / 60;

export function createFishingReel(fish: FishDef) {
  return {
    fish,
    barWidth: RARITY_META[fish.rarity].barW,
    position: 0,
    velocity: 0,
    fishPosition: 0.15,
    fishVelocity: 0,
    fishTarget: 0.4,
    speedMultiplier: 1,
    retargetAt: 0.6,
    elapsed: 0,
    remainder: 0,
    progress: START_PROGRESS,
    tension: 0,
    inside: true,
    result: null as boolean | null,
  };
}

export type FishingReel = ReturnType<typeof createFishingReel>;

/** Preserve the authored 60 Hz fight on every display; bound suspended-frame catch-up. */
export function advanceFishingReel(state: FishingReel, delta: number, holding: boolean, dartChanceMultiplier: number, random = Math.random) {
  const events = { bounced: false, darted: false };
  if (state.result !== null) return events;
  state.remainder += Math.max(0, Math.min(delta, 0.1));
  const move = state.fish.move;
  const drainRate = 0.17 + 0.09 * (1 - state.barWidth / 0.3);
  while (state.remainder + 1e-9 >= STEP && state.result === null) {
    state.remainder = Math.max(0, state.remainder - STEP);
    state.elapsed += STEP;
    state.velocity += (holding ? HOLD_ACCEL : -GRAVITY) * STEP;
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

    if (state.elapsed >= state.retargetAt) {
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

    state.inside = state.fishPosition >= state.position - 0.015 && state.fishPosition <= state.position + state.barWidth + 0.015;
    state.progress = Math.max(0, Math.min(1, state.progress + (state.inside ? FILL_RATE : -drainRate) * STEP));
    state.tension = state.inside ? Math.min(1, state.tension + STEP / 1.2) : Math.max(0, state.tension - STEP / 0.5);
    if (state.progress === 1) state.result = true;
    else if (state.progress === 0) state.result = false;
  }
  return events;
}
