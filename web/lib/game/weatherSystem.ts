/**
 * weatherSystem — continuous, blended weather on top of the daily forecast.
 *
 * Architecture studied from Distant Lands' COZY: Stylized Weather 3 (David owns
 * a licence). The C# is Unity-only, so this is a reimplementation of the DESIGN
 * for three.js, not a port. Four ideas are worth having and we had none:
 *
 * ── 1. WEATHER IS A WEIGHTED BLEND, NOT AN ENUM ─────────────────────────
 * `weather.ts` gives one of three words for the whole day, so the sky is only
 * ever in one of three states and every change is a cut. COZY holds a LIST of
 * (profile, weight) pairs, which makes "70% partly cloudy, 30% rain" an
 * ordinary state and makes every transition a crossfade for free.
 *
 * That daily word is NOT replaced — it stays the source of truth for what kind
 * of day it is, and 9 call sites depend on it. It now selects a POOL, and this
 * engine drifts around inside it. A rain day gets cloudy stretches and downpours
 * instead of eight hours of identical rain.
 *
 * ── 2. RESET, ACCUMULATE, PUBLISH ───────────────────────────────────────
 * Every frame, in this exact order:
 *
 *     reset       every output goes back to its default
 *     accumulate  each active profile ADDS its contribution x its weight
 *     publish     the total is read by the renderers
 *
 * The ordering is the trick. Nothing persists between frames, so a profile
 * fading out simply contributes less and nobody has to work out what to
 * subtract. Two profiles at half weight give exactly the average.
 *
 * One subtlety copied on purpose: COVERAGE values ADD and clamp, SHAPE values
 * LERP. Two overlapping cloudy profiles should mean MORE cloud, but a doubled
 * border height is not a meaningful number. Getting that backwards makes blends
 * fail in a way that is very hard to trace back.
 *
 * ── 3. CLOUDS ARE INDEPENDENT LAYERS ────────────────────────────────────
 * COZY has no sky panoramas at all. Its sky is a zenith-to-horizon gradient
 * plus five independently weighted cloud layers, each one tiling texture with
 * its own coverage. A "weather" is just a set of numbers for those layers.
 *
 * That dissolves the problem we were stuck on. We were trying to commission
 * eight painted equirectangular panoramas, which image generators cannot
 * produce and which cannot crossfade without the clouds morphing through each
 * other. Five tiling cloud textures and a gradient give every weather state,
 * blend continuously by construction, and are far easier art to make.
 *
 * ── 4. PERSISTENT ACCUMULATORS ──────────────────────────────────────────
 * `wetness` and `snowCover` integrate over time and decay slowly, so the ground
 * stays wet for a while after the rain stops. One float each, and it is the
 * difference between "it is raining" and "it rained".
 *
 * DETERMINISM IS A HARD REQUIREMENT. Every player must see the same sky at the
 * same moment with no backend (approved swing #21). So the engine is seeded
 * from the calendar date and stepped from the WALL CLOCK, never from frame
 * deltas: two players who joined at different times still agree, and a tab that
 * was backgrounded catches up instead of lagging behind.
 */

import type { Weather } from "./weather";

// ── Outputs ──────────────────────────────────────────────────────

/** Cloud layer coverage. 0 absent, 1 the profile's full amount, 2 the cap. */
export interface CloudLayers {
  /** Big fair-weather puffs. The default sky. */
  cumulus: number;
  /** Rippled mid-level sheet. */
  altocumulus: number;
  /** High wispy streaks. */
  cirrus: number;
  /** High flat haze that whitens the whole sky. */
  cirrostratus: number;
  /** Rain cloud: dark, heavy, low. */
  nimbus: number;
}

/** Cloud SHAPE. Lerped, not added: the sum of two shapes means nothing. */
export interface CloudShape {
  /** How far down the nimbus layer reaches. */
  nimbusHeight: number;
  /** Break-up of the nimbus edge. */
  nimbusVariation: number;
  /** Where the cloud bank starts, as a height fraction. */
  borderHeight: number;
  /** Below 0 clips clouds away, above 0 adds them. */
  borderEffect: number;
  /** Break-up of the bank's edge. */
  borderVariation: number;
}

/** The colour grade weather applies on top of time of day. */
export interface WeatherFilter {
  /** 1 leaves saturation alone, 0 is greyscale. */
  saturation: number;
  /** Overall brightness multiplier. */
  value: number;
  /** Multiplied into the scene. */
  color: number;
  /** Multiplied into the key light. */
  sunColor: number;
}

export interface WeatherState {
  clouds: CloudLayers;
  shape: CloudShape;
  filter: WeatherFilter;
  /** Multiplier over the time-of-day fog. 1 is normal. */
  fogDensity: number;
  /** Rain particle intensity, 0..1. */
  rain: number;
  /** Snow particle intensity, 0..1. */
  snow: number;
  /** Drives grass sway and cloud drift, 0..1. */
  wind: number;
  /** Chance per second of a thunder flash. 0 outside a storm. */
  thunder: number;
  /** How wet the WORLD is, 0..1. Outlives the rain that caused it. */
  wetness: number;
  /** How much snow has SETTLED, 0..1. Melts above freezing. */
  snowCover: number;
}

/** What a profile contributes. Everything optional; absent adds nothing. */
export interface WeatherProfile {
  id: string;
  label: string;
  /** Which daily forecast words this profile can appear under. */
  kinds: Weather[];
  clouds?: Partial<CloudLayers>;
  shape?: Partial<CloudShape>;
  filter?: Partial<WeatherFilter>;
  fogDensity?: number;
  rain?: number;
  snow?: number;
  wind?: number;
  thunder?: number;
  /** Relative likelihood within its pool. */
  chance: number;
  /** Seconds this weather runs before the next is picked. */
  duration: [number, number];
}

// ── Defaults ─────────────────────────────────────────────────────

/** The sky with no weather applied. `reset` returns here every frame. */
export const DEFAULT_STATE: Omit<WeatherState, "wetness" | "snowCover"> = {
  clouds: { cumulus: 0, altocumulus: 0, cirrus: 0, cirrostratus: 0, nimbus: 0 },
  shape: {
    nimbusHeight: 1,
    nimbusVariation: 0.9,
    borderHeight: 0.5,
    borderEffect: 1,
    borderVariation: 0.9,
  },
  filter: { saturation: 1, value: 1, color: 0xffffff, sunColor: 0xffffff },
  fogDensity: 1,
  rain: 0,
  snow: 0,
  wind: 0.15,
  thunder: 0,
};

/**
 * The states the island can drift through.
 *
 * Deliberately more than the three daily words. The point of a blended system
 * is that adjacent states differ only slightly, so the sky is always moving
 * rather than snapping between presets. `kinds` keeps the engine honest with
 * the forecast: a sunny day never reaches for nimbus, so the dock's "It's a
 * sunny day" is never contradicted by what is overhead.
 *
 * Numbers are a starting point. They want a bench pass once the cloud textures
 * land.
 */
export const WEATHER_PROFILES: WeatherProfile[] = [
  {
    id: "clear",
    label: "Clear",
    kinds: ["sunny"],
    clouds: { cumulus: 0.15, cirrus: 0.2 },
    chance: 1,
    duration: [240, 600],
  },
  {
    id: "fair",
    label: "Fair",
    kinds: ["sunny", "cloudy"],
    clouds: { cumulus: 0.6, cirrus: 0.35 },
    wind: 0.2,
    chance: 1.6,
    duration: [240, 600],
  },
  {
    id: "partly-cloudy",
    label: "Partly cloudy",
    kinds: ["sunny", "cloudy"],
    clouds: { cumulus: 1, altocumulus: 0.4, cirrus: 0.2 },
    shape: { borderHeight: 0.45 },
    fogDensity: 1.1,
    wind: 0.3,
    chance: 1.2,
    duration: [180, 480],
  },
  {
    id: "mostly-cloudy",
    label: "Mostly cloudy",
    kinds: ["cloudy", "rain"],
    clouds: { cumulus: 1.3, altocumulus: 0.9, cirrostratus: 0.5 },
    shape: { borderHeight: 0.3, borderEffect: 0.6 },
    filter: { saturation: 0.9, value: 0.92 },
    fogDensity: 1.35,
    wind: 0.4,
    chance: 0.9,
    duration: [180, 420],
  },
  {
    id: "overcast",
    label: "Overcast",
    kinds: ["cloudy", "rain"],
    clouds: { cumulus: 0.6, altocumulus: 1.2, cirrostratus: 1.4, nimbus: 0.3 },
    shape: { borderHeight: 0.1, borderEffect: 0.2, nimbusHeight: 0.8 },
    filter: { saturation: 0.78, value: 0.85, color: 0xdfe6ec },
    fogDensity: 1.7,
    wind: 0.45,
    chance: 0.7,
    duration: [180, 420],
  },
  {
    id: "light-rain",
    label: "Light rain",
    kinds: ["rain"],
    clouds: { altocumulus: 1, cirrostratus: 1.2, nimbus: 0.9 },
    shape: { borderHeight: 0.1, borderEffect: 0.1, nimbusVariation: 0.7 },
    filter: { saturation: 0.72, value: 0.8, color: 0xd6dee6, sunColor: 0xc8d4de },
    fogDensity: 2.1,
    rain: 0.45,
    wind: 0.5,
    chance: 1.1,
    duration: [150, 360],
  },
  {
    id: "rain",
    label: "Rain",
    kinds: ["rain"],
    clouds: { altocumulus: 0.8, cirrostratus: 1.4, nimbus: 1.5 },
    shape: { borderHeight: 0, borderEffect: -0.2, nimbusHeight: 1, nimbusVariation: 0.5 },
    filter: { saturation: 0.62, value: 0.72, color: 0xc6d2dc, sunColor: 0xb4c4d2 },
    fogDensity: 2.8,
    rain: 1,
    wind: 0.65,
    chance: 1,
    duration: [120, 300],
  },
  {
    id: "storm",
    label: "Storm",
    kinds: ["rain"],
    clouds: { altocumulus: 0.6, cirrostratus: 1.6, nimbus: 2 },
    shape: { borderHeight: 0, borderEffect: -0.4, nimbusHeight: 1, nimbusVariation: 0.35 },
    filter: { saturation: 0.5, value: 0.6, color: 0xaebccb, sunColor: 0x9fb2c4 },
    fogDensity: 3.4,
    rain: 1,
    wind: 1,
    thunder: 0.06,
    chance: 0.25,
    duration: [90, 210],
  },
];

// ── Blending helpers ─────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Per-channel lerp on 0xRRGGBB, so colours blend in the space they are stored. */
export function lerpHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  return (
    (Math.round(lerp(ar, (b >> 16) & 255, t)) << 16) |
    (Math.round(lerp(ag, (b >> 8) & 255, t)) << 8) |
    Math.round(lerp(ab, b & 255, t))
  );
}

/** Smoothstep, used as the transition curve so fades ease in and out. */
export function ease(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * mulberry32. Same family as the hash `weather.ts` already uses, so the whole
 * weather stack is seeded the same way and reproduces exactly.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed for a calendar day, matching `weatherForDate`'s key. */
export function daySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ── The engine ───────────────────────────────────────────────────

interface ActiveWeather {
  profile: WeatherProfile;
  /** Current blend weight, 0..1. */
  weight: number;
  /** Where it is heading. 0 means fading out, then dropped. */
  target: number;
  /** Seconds left before it hands over. */
  remaining: number;
}

export interface WeatherEngineOptions {
  /** Seconds for a change to fully blend. */
  transitionSeconds?: number;
  /** Wetness lost per second while it is not raining. */
  dryingRate?: number;
  /** Settled snow lost per second above freezing. */
  meltRate?: number;
}

/**
 * Holds the blend and steps it. No THREE, no React: `GameWorld` owns one, ticks
 * it from the wall clock, and reads `state`.
 */
export class WeatherEngine {
  readonly state: WeatherState;
  readonly kind: Weather;
  private pool: WeatherProfile[];
  private active: ActiveWeather[] = [];
  private readonly transition: number;
  private readonly drying: number;
  private readonly melt: number;
  private readonly rand: () => number;

  constructor(kind: Weather, seed: number, opts: WeatherEngineOptions = {}) {
    this.kind = kind;
    this.transition = opts.transitionSeconds ?? 25;
    this.drying = opts.dryingRate ?? 0.012;
    this.melt = opts.meltRate ?? 0.008;
    this.rand = seededRandom(seed);
    this.pool = WEATHER_PROFILES.filter((p) => p.kinds.includes(kind));
    if (this.pool.length === 0) this.pool = [WEATHER_PROFILES[0]];
    this.state = {
      clouds: { ...DEFAULT_STATE.clouds },
      shape: { ...DEFAULT_STATE.shape },
      filter: { ...DEFAULT_STATE.filter },
      fogDensity: DEFAULT_STATE.fogDensity,
      rain: DEFAULT_STATE.rain,
      snow: DEFAULT_STATE.snow,
      wind: DEFAULT_STATE.wind,
      thunder: DEFAULT_STATE.thunder,
      wetness: kind === "rain" ? 0.5 : 0,
      snowCover: 0,
    };
    this.transitionTo(this.pick());
  }

  /** Currently blending profiles, strongest first. For the debug overlay. */
  get blend(): { id: string; label: string; weight: number }[] {
    return [...this.active]
      .sort((a, b) => b.weight - a.weight)
      .map((a) => ({ id: a.profile.id, label: a.profile.label, weight: a.weight }));
  }

  /** The dominant profile's id, for anything that still needs one word. */
  get dominant(): string {
    let best: ActiveWeather | null = null;
    for (const a of this.active) if (!best || a.weight > best.weight) best = a;
    return best?.profile.id ?? this.pool[0].id;
  }

  /** Force a specific profile. Blends toward it, never cuts. */
  set(id: string): void {
    const profile = WEATHER_PROFILES.find((p) => p.id === id);
    if (profile) this.transitionTo(profile);
  }

  private transitionTo(profile: WeatherProfile): void {
    if (this.active.some((a) => a.profile.id === profile.id && a.target > 0)) return;
    for (const a of this.active) a.target = 0;
    const [lo, hi] = profile.duration;
    this.active.push({ profile, weight: 0, target: 1, remaining: lo + this.rand() * (hi - lo) });
  }

  /**
   * Weighted random over the day's pool.
   *
   * Sampling proportionally to `chance` rather than taking the likeliest is
   * what stops the day being a fixed cycle: on a rain day a downpour is LIKELY,
   * not scheduled.
   */
  private pick(): WeatherProfile {
    let total = 0;
    for (const p of this.pool) total += p.chance;
    let roll = this.rand() * total;
    for (const p of this.pool) {
      roll -= p.chance;
      if (roll <= 0) return p;
    }
    return this.pool[this.pool.length - 1];
  }

  /**
   * Advance by `dt` seconds.
   *
   * Order matters and is COZY's: expire, move weights, RESET every output to
   * its default, accumulate the active profiles on top, then integrate the
   * values that persist. Accumulating before resetting would double every frame.
   *
   * `dt` is capped: a backgrounded tab can hand back a delta of minutes, and
   * one 300-second step would jump the sky rather than run it forward.
   */
  update(dt: number): void {
    if (dt <= 0) return;
    if (dt > 5) dt = 5;

    // 1. Expire the current weather and choose a successor.
    for (const a of this.active) {
      if (a.target <= 0) continue;
      a.remaining -= dt;
      if (a.remaining <= 0) this.transitionTo(this.pick());
    }
    if (this.active.length === 0) this.transitionTo(this.pick());

    // 2. Move weights toward their targets; drop anything fully faded.
    const step = dt / this.transition;
    for (const a of this.active) {
      a.weight =
        a.target > a.weight ? Math.min(a.target, a.weight + step) : Math.max(a.target, a.weight - step);
    }
    this.active = this.active.filter((a) => a.weight > 0.001 || a.target > 0);

    // 3. RESET.
    const s = this.state;
    const d = DEFAULT_STATE;
    s.clouds.cumulus = d.clouds.cumulus;
    s.clouds.altocumulus = d.clouds.altocumulus;
    s.clouds.cirrus = d.clouds.cirrus;
    s.clouds.cirrostratus = d.clouds.cirrostratus;
    s.clouds.nimbus = d.clouds.nimbus;
    s.shape.nimbusHeight = d.shape.nimbusHeight;
    s.shape.nimbusVariation = d.shape.nimbusVariation;
    s.shape.borderHeight = d.shape.borderHeight;
    s.shape.borderEffect = d.shape.borderEffect;
    s.shape.borderVariation = d.shape.borderVariation;
    s.filter.saturation = d.filter.saturation;
    s.filter.value = d.filter.value;
    s.filter.color = d.filter.color;
    s.filter.sunColor = d.filter.sunColor;
    s.fogDensity = d.fogDensity;
    s.rain = d.rain;
    s.snow = d.snow;
    s.wind = d.wind;
    s.thunder = d.thunder;

    // 4. ACCUMULATE. Coverage ADDS and clamps; shape and colour LERP.
    for (const a of this.active) {
      const w = ease(a.weight);
      if (w <= 0) continue;
      const p = a.profile;

      if (p.clouds) {
        for (const k of ["cumulus", "altocumulus", "cirrus", "cirrostratus", "nimbus"] as const) {
          const v = p.clouds[k];
          if (v !== undefined) s.clouds[k] = clamp(s.clouds[k] + v * w, 0, 2);
        }
      }
      if (p.shape) {
        for (const k of [
          "nimbusHeight",
          "nimbusVariation",
          "borderHeight",
          "borderEffect",
          "borderVariation",
        ] as const) {
          const v = p.shape[k];
          if (v !== undefined) s.shape[k] = lerp(s.shape[k], v, w);
        }
      }
      if (p.filter) {
        if (p.filter.saturation !== undefined) s.filter.saturation = lerp(s.filter.saturation, p.filter.saturation, w);
        if (p.filter.value !== undefined) s.filter.value = lerp(s.filter.value, p.filter.value, w);
        if (p.filter.color !== undefined) s.filter.color = lerpHex(s.filter.color, p.filter.color, w);
        if (p.filter.sunColor !== undefined) s.filter.sunColor = lerpHex(s.filter.sunColor, p.filter.sunColor, w);
      }
      if (p.fogDensity !== undefined) s.fogDensity = lerp(s.fogDensity, p.fogDensity, w);
      if (p.rain !== undefined) s.rain = clamp(s.rain + p.rain * w, 0, 1);
      if (p.snow !== undefined) s.snow = clamp(s.snow + p.snow * w, 0, 1);
      if (p.wind !== undefined) s.wind = lerp(s.wind, p.wind, w);
      if (p.thunder !== undefined) s.thunder = Math.max(s.thunder, p.thunder * w);
    }

    // 5. INTEGRATE what outlives the weather that caused it. Two floats, and it
    //    is the whole difference between "it is raining" and "it rained".
    s.wetness = clamp(s.wetness + (s.rain * 0.06 - this.drying) * dt, 0, 1);
    s.snowCover = clamp(s.snowCover + (s.snow * 0.03 - this.melt) * dt, 0, 1);
  }
}

/**
 * Build the engine for a given day, and fast-forward it to `secondsIntoDay`.
 *
 * The catch-up is what makes this multiplayer-safe with no backend. Two players
 * who load at different times must see the same sky, so the engine is not
 * "started" when a tab opens — it is replayed from midnight at a fixed step to
 * wherever the wall clock actually is.
 */
export function engineForDay(kind: Weather, date: Date, secondsIntoDay: number): WeatherEngine {
  const engine = new WeatherEngine(kind, daySeed(date));
  const STEP = 5;
  for (let t = 0; t < secondsIntoDay; t += STEP) engine.update(STEP);
  return engine;
}
