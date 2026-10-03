// Per-client message rate limits (specs/multiplayer.md §4.6). Token buckets refill
// continuously; an optional per-minute cap is a sliding window. Excess is dropped
// (area changes also strike); Colyseus' maxMessagesPerSecond disconnects floods.
// The numbers come from the shared contract; this file only meters them.

export type RateSpec = {
  /** Sustained rate. */
  perSecond: number;
  /** Bucket size: how many may arrive at once after a quiet spell (default: perSecond). */
  burst?: number;
  /** A cap over any 60 s window, on top of the bucket. */
  perMinute?: number;
};

export type Limiter = {
  /** Takes one if allowed at `now` (ms) and says whether it was. */
  take(now: number): boolean;
};

export function limiter(spec: RateSpec): Limiter {
  const capacity = spec.burst ?? spec.perSecond;
  const perMs = spec.perSecond / 1000;
  let tokens = capacity;
  let at = -Infinity;
  const window: number[] = [];
  return {
    take(now) {
      tokens = at === -Infinity ? capacity : Math.min(capacity, tokens + (now - at) * perMs);
      at = now;
      if (spec.perMinute !== undefined) {
        while (window.length > 0 && now - window[0] >= 60_000) window.shift();
        if (window.length >= spec.perMinute) return false;
      }
      if (tokens < 1) return false;
      tokens -= 1;
      if (spec.perMinute !== undefined) window.push(now);
      return true;
    },
  };
}

/** One limiter per message kind, created from a table of specs. */
export function limiters<K extends string>(specs: Record<K, RateSpec>): Record<K, Limiter> {
  const out = {} as Record<K, Limiter>;
  for (const k of Object.keys(specs) as K[]) out[k] = limiter(specs[k]);
  return out;
}
