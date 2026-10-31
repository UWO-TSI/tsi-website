"use client";

/**
 * Audio manager (sprint A7 infra; content landed 2026-07-03 cozy push;
 * hourly music + mute + weather/season ambience added in the audio pass,
 * ledger rows 84, 99, 106, 112-114, 125, 169).
 *
 * Original member-world files are CC0 (see
 * `web/public/audio/CREDITS.md`): ambient loops from Pixel-boy's Ninja
 * Adventure pack (Peaceful/Calm Village/Chill/Dream mapped to
 * dawn/day/dusk/night), SFX from Kenney RPG Audio + Interface Sounds,
 * dialogue voice blips from Ninja Adventure (animalese-lite for NPC chat).
 * Applicant music by Stream Cafe has separate source/use terms in CREDITS.md.
 * The missing-file fallback stays: a deleted file just runs silent.
 *
 * Exactly one music bed is audible at a time (David, 2026-10-30: "theres liek
 * 3 overlapping music"). Two crossfading channels share one cascading-candidate engine:
 *   - music: the bed. The room override, else the 12-block hourly file
 *     (`musicSchedule.ts`), else the CC0 time-of-day track, which is on disk.
 *     A musical loop layer (the campfire's drums, the soft beat) ducks it while
 *     it plays, so the drums replace the bed instead of stacking on it.
 *   - ambient: real ambience only (a listed weather or season variant; none is
 *     authored yet, so the member island's is silent). The applicant island's
 *     Stream Cafe track plays here, as it always has: that island's bed.
 *
 * Public API:
 *   AudioManager.enable()                        — user gesture unlock
 *   AudioManager.setVolumes({ master, ambient, music, sfx })
 *   AudioManager.setMuted(bool)                   — silences all channels, keeps sliders
 *   AudioManager.setAmbience({ phase, weather, season }) — crossfade ambient, richer key
 *   AudioManager.setMusic({ block, phase, season, override }) — crossfade the music bed
 *   AudioManager.playSFX(name, { rate, gain })   — one-shot, overlapping safe; `rate` re-pitches it (the combat cues)
 *   AudioManager.playBlip()                      — random dialogue voice blip
 *   AudioManager.setLoop(src, gain)              — a looping layer on the world clock's bar (the campfire's drums, the
 *                                                  soft beat near dancers): Web Audio, faded to `gain`, 0 lets it go
 *   AudioManager.subscribe(listener)             — for React UI sync
 *   AudioManager.getState()
 */

import { buildMusicSrcList, type MusicBlock, type MusicOverride } from "./musicSchedule";
import { worldNow } from "./worldClock";
import type { IslandWeather } from "./islandWeather";
import type { Season } from "./season";

/** The island's time of day as the bed hears it (the island's "evening" is "dusk"). */
export type DayPhase = "dawn" | "day" | "dusk" | "night";
export type AmbientPhase = DayPhase | "applicant-island" | "applicant-hq";
export type SFXName =
  | "footstep"
  | "jump"
  | "enter"
  | "exit"
  | "click"
  | "confirm"
  | "blip1"
  | "blip2"
  | "blip3"
  | "blip4"
  | "blip5"
  /** The TSI keycap keychain's click: the press and the return in one file (a stand-in until David's recording). */
  | "keyswitch"
  /** A fish bites, by hook tier (art/audio/synth_bite.py): louder and richer for legendary and divine. */
  | "bite"
  | "bite-legendary"
  | "bite-divine"
  | VbSfx;

/** The beach volleyball match's sounds, made in art/audio/synth_volleyball.py (lib/game/volleyball/sfx.ts plays them). */
export const VB_SFX = ["vb-bump", "vb-set", "vb-serve", "vb-dig", "vb-block", "vb-spike", "vb-perfect", "vb-good", "vb-early", "vb-late",
  "vb-sand", "vb-boom", "vb-net", "vb-tape", "vb-takeoff", "vb-touchdown", "vb-dive", "vb-slide", "vb-charge", "vb-max", "vb-toss", "vb-whiff",
  "vb-point", "vb-point-them", "vb-win", "vb-call", "vb-out", "vb-heat", "vb-fire"] as const;
export type VbSfx = (typeof VB_SFX)[number];

interface AudioManifest {
  ambient: Record<AmbientPhase, string>;
  sfx: Record<SFXName, string>;
}

const MANIFEST: AudioManifest = {
  ambient: {
    dawn: "/audio/ambient/dawn.ogg",
    day: "/audio/ambient/day.ogg",
    dusk: "/audio/ambient/dusk.ogg",
    night: "/audio/ambient/night.ogg",
    "applicant-island": "/audio/ambient/applicant-ocean-railway.ogg",
    "applicant-hq": "/audio/ambient/applicant-willow-tree.ogg",
  },
  sfx: {
    footstep: "/audio/sfx/footstep.ogg",
    jump: "/audio/sfx/blip2.ogg",
    enter: "/audio/sfx/enter.ogg",
    exit: "/audio/sfx/exit.ogg",
    click: "/audio/sfx/click.ogg",
    confirm: "/audio/sfx/confirm.ogg",
    blip1: "/audio/sfx/blip1.ogg",
    blip2: "/audio/sfx/blip2.ogg",
    blip3: "/audio/sfx/blip3.ogg",
    blip4: "/audio/sfx/blip4.ogg",
    blip5: "/audio/sfx/blip5.ogg",
    keyswitch: "/audio/sfx/keyswitch.ogg",
    bite: "/audio/sfx/bite.ogg",
    "bite-legendary": "/audio/sfx/bite-legendary.ogg",
    "bite-divine": "/audio/sfx/bite-divine.ogg",
    ...(Object.fromEntries(VB_SFX.map(n => [n, `/audio/sfx/${n}.ogg`])) as Record<VbSfx, string>),
  },
};

const BLIPS: SFXName[] = ["blip1", "blip2", "blip3", "blip4", "blip5"];

export interface AudioVolumes {
  master: number;  // 0-1
  ambient: number; // 0-1 (labelled "Ambience" in the settings UI)
  music: number;   // 0-1
  sfx: number;     // 0-1
}

export interface AudioState {
  enabled: boolean;
  muted: boolean;
  volumes: AudioVolumes;
  phase: AmbientPhase | null;
  music: { block: MusicBlock | null; override: MusicOverride };
}

const STORAGE_KEY = "tsi.audio.v1";
const CROSSFADE_MS = 800;

type Listener = (state: AudioState) => void;
type ChannelName = "ambient" | "music";

interface StoredPrefs {
  volumes: AudioVolumes;
  muted: boolean;
}

export const DEFAULT_VOLUMES: AudioVolumes = { master: 0.7, ambient: 0.6, music: 0.55, sfx: 0.8 };

/**
 * Where a loop of `lengthS` seconds is at the world-clock instant `worldMs` (s into it): every client starting a layer
 * there hears the same bar (the drum loops are whole bars at 120 BPM, as the dances are: lib/game/danceSync.ts).
 */
export function loopOffset(worldMs: number, lengthS: number): number {
  const len = lengthS * 1000, t = worldMs % len;
  return (t < 0 ? t + len : t) / 1000;
}
/** A loop layer: its buffer once decoded, its source while playing, its gain node and where its gain is heading. */
interface LoopLayer { buffer: AudioBuffer | null; loading: boolean; failed: boolean; source: AudioBufferSourceNode | null; gain: GainNode; target: number; idleAt: number }
/** How fast a layer fades in or out (s, the time constant). */
const LOOP_FADE_S = 0.35;
/** A layer silent this long stops its source (ms). */
const LOOP_IDLE_MS = 4000;
/** A playing loop layer this loud (or louder) silences the music bed; quieter, at the edge of its range, it dips it. */
const DUCK_FULL = 0.15;

function readStoredPrefs(): StoredPrefs {
  if (typeof window === "undefined") {
    return { volumes: { ...DEFAULT_VOLUMES }, muted: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volumes: {
          master: clamp01(parsed.master, DEFAULT_VOLUMES.master),
          ambient: clamp01(parsed.ambient, DEFAULT_VOLUMES.ambient),
          music: clamp01(parsed.music, DEFAULT_VOLUMES.music),
          sfx: clamp01(parsed.sfx, DEFAULT_VOLUMES.sfx),
        },
        muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
      };
    }
  } catch {
    /* ignore */
  }
  return { volumes: { ...DEFAULT_VOLUMES }, muted: false };
}

function clamp01(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

interface TrackChannel {
  current: HTMLAudioElement | null;
  next: HTMLAudioElement | null;
  raf: number | null;
  fadeStart: number;
  fadeProgress: number;
}

function emptyChannel(): TrackChannel {
  return { current: null, next: null, raf: null, fadeStart: 0, fadeProgress: 0 };
}

export class AudioManagerImpl {
  private enabled = false;
  private muted = false;
  private volumes: AudioVolumes = { ...DEFAULT_VOLUMES };
  private phase: AmbientPhase | null = null;
  private musicBlock: MusicBlock | null = null;
  private musicOverride: MusicOverride = null;

  private ambientKey: string | null = null;
  private ambientCandidates: string[] = [];
  private musicKey: string | null = null;
  private musicCandidates: string[] = [];

  private ambientCh: TrackChannel = emptyChannel();
  private musicCh: TrackChannel = emptyChannel();
  private oneShots = new Map<HTMLAudioElement, { name: SFXName; gain: number }>();

  private missingFiles = new Set<string>();
  /** Looping layers (setLoop): one AudioContext, its bus at master × music (silent when muted). */
  private ctx: AudioContext | null = null;
  private loopBus: GainNode | null = null;
  private loops = new Map<string, LoopLayer>();
  private warnedMissing = false;
  private listeners = new Set<Listener>();
  private cachedSnapshot: AudioState;

  constructor() {
    if (typeof window !== "undefined") {
      const prefs = readStoredPrefs();
      this.volumes = prefs.volumes;
      this.muted = prefs.muted;
    }
    this.cachedSnapshot = this.computeSnapshot();
  }

  private computeSnapshot(): AudioState {
    return {
      enabled: this.enabled,
      muted: this.muted,
      volumes: { ...this.volumes },
      phase: this.phase,
      music: { block: this.musicBlock, override: this.musicOverride },
    };
  }

  getState(): AudioState {
    // Must return a stable reference between mutations — useSyncExternalStore
    // bails into an infinite loop if every call yields a fresh object.
    return this.cachedSnapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.cachedSnapshot = this.computeSnapshot();
    this.listeners.forEach((l) => l(this.cachedSnapshot));
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.volumes, muted: this.muted }));
    } catch {
      /* ignore quota errors */
    }
  }

  enable(): void {
    if (this.enabled || typeof window === "undefined") return;
    this.enabled = true;
    // Anything set before enable (phase / music block) starts now.
    if (this.ambientKey) this.startChannel("ambient", this.ambientCandidates);
    if (this.musicKey) this.startChannel("music", this.musicCandidates);
    this.notify();
  }

  setVolumes(partial: Partial<AudioVolumes>): void {
    this.volumes = {
      master: clamp01(partial.master, this.volumes.master),
      ambient: clamp01(partial.ambient, this.volumes.ambient),
      music: clamp01(partial.music, this.volumes.music),
      sfx: clamp01(partial.sfx, this.volumes.sfx),
    };
    this.persist();
    this.applyChannelVolumes();
    this.notify();
  }

  /** Mute silences every channel without losing the slider positions. */
  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.persist();
    this.applyChannelVolumes();
    this.notify();
  }

  private applyChannelVolumes(): void {
    for (const name of ["ambient", "music"] as const) {
      const ch = this.channel(name);
      const target = this.channelVolume(name);
      if (ch.current) ch.current.volume = target * (ch.next ? 1 - ch.fadeProgress : 1);
      if (ch.next) ch.next.volume = target * ch.fadeProgress;
    }
    for (const [sound, { name, gain }] of this.oneShots) sound.volume = Math.min(1, this.sfxTargetVolume(name) * gain);
    if (this.ctx && this.loopBus) this.loopBus.gain.setTargetAtTime(this.targetVolume("music"), this.ctx.currentTime, 0.05);
  }

  /**
   * A looping layer on the world clock's bar (the campfire's drum song, the soft beat near dancers), faded toward
   * `gain` (0 lets it go; a layer silent a few seconds stops). It loads once, on first asking, and starts at the bar's
   * phase every client shares (loopOffset). Mute and the sliders apply through the bus (master × music). Call it as
   * often as you like: nothing happens unless the gain moved.
   */
  setLoop(src: string, gain: number): void {
    if (!this.enabled || typeof window === "undefined" || this.missingFiles.has(src)) return;
    const ctx = this.loopContext();
    if (!ctx || !this.loopBus) return;
    let layer = this.loops.get(src);
    const target = Math.max(0, Math.min(1, gain));
    if (!layer) {
      if (target <= 0) return;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.loopBus);
      layer = { buffer: null, loading: false, failed: false, source: null, gain: g, target: 0, idleAt: 0 };
      this.loops.set(src, layer);
    }
    const now = performance.now();
    if (Math.abs(target - layer.target) > 0.005) {
      layer.target = target;
      layer.gain.gain.setTargetAtTime(target, ctx.currentTime, LOOP_FADE_S);
      if (layer.source) this.applyChannelVolumes();
    }
    if (target > 0) {
      layer.idleAt = 0;
      if (!layer.buffer) { this.loadLoop(src, layer); return; }
      if (!layer.source) this.startLoop(layer);
    } else if (layer.source) {
      if (!layer.idleAt) layer.idleAt = now;
      else if (now - layer.idleAt > LOOP_IDLE_MS) { try { layer.source.stop(); } catch { /* already stopped */ } layer.source = null; }
    }
  }

  /**
   * Open the loop layers' audio context ahead of their first use: opening the device took ~0.2 s of one frame, mid-walk,
   * the first time a campfire or a dance came in range. Call it behind a loading screen; it stays suspended until the
   * first gesture resumes it.
   */
  prepare(): void {
    if (typeof window !== "undefined") this.loopContext();
  }

  private loopContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.loopBus = this.ctx.createGain();
      this.loopBus.gain.value = this.targetVolume("music");
      this.loopBus.connect(this.ctx.destination);
    } catch { this.ctx = null; this.loopBus = null; }
    return this.ctx;
  }

  private loadLoop(src: string, layer: LoopLayer): void {
    if (layer.loading || layer.failed || !this.ctx) return;
    layer.loading = true;
    const ctx = this.ctx;
    fetch(src).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => {
        layer.buffer = buffer; layer.loading = false;
        if (layer.target > 0 && !layer.source) this.startLoop(layer);
      })
      .catch(() => { layer.loading = false; layer.failed = true; this.markMissing(src); });
  }

  private startLoop(layer: LoopLayer): void {
    const ctx = this.ctx;
    if (!ctx || !layer.buffer) return;
    const lead = 0.05, source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    source.connect(layer.gain);
    source.start(ctx.currentTime + lead, loopOffset(worldNow() + lead * 1000, layer.buffer.duration));
    layer.source = source;
    this.applyChannelVolumes();
  }

  private mutedGain(): number {
    return this.muted ? 0 : 1;
  }

  private ambientSceneGain(): number {
    return this.phase === "applicant-island" || this.phase === "applicant-hq" ? 0.18 : 1;
  }

  private targetVolume(channel: ChannelName): number {
    if (channel === "ambient") return this.volumes.master * this.volumes.ambient * this.ambientSceneGain() * this.mutedGain();
    return this.volumes.master * this.volumes.music * this.mutedGain();
  }

  /** A channel's volume: the music bed's share drops while a loop layer plays (the loudest one decides). */
  private channelVolume(channel: ChannelName): number {
    if (channel === "ambient") return this.targetVolume(channel);
    let loudest = 0;
    for (const layer of this.loops.values()) if (layer.source) loudest = Math.max(loudest, layer.target);
    return this.targetVolume(channel) * (1 - Math.min(1, loudest / DUCK_FULL));
  }

  private sfxTargetVolume(name: SFXName): number {
    const applicant = this.phase === "applicant-island" || this.phase === "applicant-hq";
    const sceneGain = applicant ? 0.25 : 1;
    const movementGain = applicant && (name === "footstep" || name === "jump") ? 0.35 : 1;
    return this.volumes.master * this.volumes.sfx * sceneGain * movementGain * this.mutedGain();
  }

  /** Richer ambient key: time of day, plus an optional weather/season variant tried first. */
  setAmbience(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }): void {
    const candidates = ambientCandidates(input);
    const key = candidates.join("|");
    const phaseMoved = this.phase !== input.phase;
    this.phase = input.phase; // the member island's phases share one (silent) key, so this can move on its own
    if (this.ambientKey === key) {
      if (this.enabled && !this.ambientCh.current && !this.ambientCh.next) this.startChannel("ambient", candidates);
      if (phaseMoved) this.notify();
      return;
    }
    const previousKey = this.ambientKey;
    this.ambientKey = key;
    this.ambientCandidates = candidates;
    if (this.enabled) {
      if (previousKey === null) this.startChannel("ambient", candidates);
      else this.crossfadeChannel("ambient", candidates);
    }
    this.notify();
  }

  /** The music bed: the room override, else the 12-block hourly file (rows 106, 112-114), else the time-of-day track. */
  setMusic(input: { block: MusicBlock; phase: DayPhase; season?: Season | null; override?: MusicOverride }): void {
    const candidates = [...buildMusicSrcList(input.block, { season: input.season, override: input.override ?? null }), MANIFEST.ambient[input.phase]];
    const key = candidates.join("|");
    if (this.musicKey === key) {
      if (this.enabled && !this.musicCh.current && !this.musicCh.next) this.startChannel("music", candidates);
      return;
    }
    const previousKey = this.musicKey;
    this.musicKey = key;
    this.musicCandidates = candidates;
    this.musicBlock = input.block;
    this.musicOverride = input.override ?? null;
    if (this.enabled) {
      if (previousKey === null) this.startChannel("music", candidates);
      else this.crossfadeChannel("music", candidates);
    }
    this.notify();
  }

  private channel(name: ChannelName): TrackChannel {
    return name === "ambient" ? this.ambientCh : this.musicCh;
  }

  private isTracked(el: HTMLAudioElement): boolean {
    return (
      el === this.ambientCh.current || el === this.ambientCh.next ||
      el === this.musicCh.current || el === this.musicCh.next ||
      this.oneShots.has(el)
    );
  }

  private newAudio(loop: boolean): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    try {
      const el = new Audio();
      el.loop = loop;
      el.preload = "auto";
      return el;
    } catch {
      return null;
    }
  }

  /** Plays the first candidate not already known-missing, retrying the next on decode failure. */
  private playCascading(el: HTMLAudioElement, candidates: string[], index: number): void {
    let i = index;
    while (i < candidates.length && this.missingFiles.has(candidates[i])) i++;
    if (i >= candidates.length) return; // nothing left to try — stays silent
    const src = candidates[i];
    el.src = src;
    void el.play().catch((error: unknown) => {
      if (!this.isTracked(el)) return;
      this.oneShots.delete(el); // a one-shot that failed is done
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.enabled = false;
        this.stop();
        this.notify();
        return;
      }
      if (error instanceof DOMException && error.name === "NotSupportedError") {
        this.markMissing(src);
        this.playCascading(el, candidates, i + 1);
      }
    });
  }

  private startChannel(name: ChannelName, candidates: string[]): void {
    if (typeof window === "undefined" || !candidates.length) return;
    const el = this.newAudio(true);
    if (!el) return;
    el.volume = this.channelVolume(name);
    this.channel(name).current = el;
    this.playCascading(el, candidates, 0);
  }

  private crossfadeChannel(name: ChannelName, candidates: string[]): void {
    if (typeof window === "undefined") return;
    const ch = this.channel(name);

    if (ch.raf !== null) {
      cancelAnimationFrame(ch.raf);
      ch.raf = null;
    }
    if (ch.next) {
      ch.next.pause();
      ch.next = null;
    }

    const next = candidates.length ? this.newAudio(true) : null;
    if (!next) {
      if (ch.current) {
        ch.current.pause();
        ch.current = null;
      }
      return;
    }
    next.volume = 0;
    ch.next = next;
    ch.fadeProgress = 0;
    this.playCascading(next, candidates, 0);

    ch.fadeStart = performance.now();
    const fromTrack = ch.current;

    const tick = () => {
      const elapsed = performance.now() - ch.fadeStart;
      const t = Math.min(1, elapsed / CROSSFADE_MS);
      ch.fadeProgress = t;
      this.applyChannelVolumes();
      if (t < 1) {
        ch.raf = requestAnimationFrame(tick);
      } else {
        ch.raf = null;
        if (fromTrack) fromTrack.pause();
        ch.current = ch.next;
        ch.next = null;
      }
    };
    ch.raf = requestAnimationFrame(tick);
  }

  /** A one-shot. `rate` plays it faster and higher (or slower and lower) so one CC0 file can serve distinct cues; `gain` scales it. */
  playSFX(name: SFXName, { rate = 1, gain = 1 }: { rate?: number; gain?: number } = {}): void {
    if (!this.enabled || typeof window === "undefined") return;
    const src = MANIFEST.sfx[name];
    if (this.missingFiles.has(src)) return; // already known missing
    const el = this.newAudio(false);
    if (!el) return;
    el.volume = Math.min(1, this.sfxTargetVolume(name) * gain);
    if (rate !== 1) { el.defaultPlaybackRate = el.playbackRate = rate; el.preservesPitch = false; } // loading resets playbackRate to the default
    this.oneShots.set(el, { name, gain });
    el.onended = () => this.oneShots.delete(el);
    el.addEventListener("error", () => { if (el.error?.code === 4) this.markMissing(src); this.oneShots.delete(el); }, { once: true });
    this.playCascading(el, [src], 0);
  }

  /** Random short voice blip for NPC dialogue reveal (animalese-lite). */
  playBlip(): void {
    this.playSFX(BLIPS[Math.floor(Math.random() * BLIPS.length)]);
  }

  /** Stop world audio on route exit; keep the user’s sound preference for re-entry. */
  stop(): void {
    for (const ch of [this.ambientCh, this.musicCh]) {
      if (ch.raf !== null) {
        cancelAnimationFrame(ch.raf);
        ch.raf = null;
      }
      if (ch.current) {
        ch.current.pause();
        ch.current = null;
      }
      if (ch.next) {
        ch.next.pause();
        ch.next = null;
      }
      ch.fadeProgress = 0;
    }
    for (const sound of this.oneShots.keys()) sound.pause();
    this.oneShots.clear();
    for (const layer of this.loops.values()) {
      try { layer.source?.stop(); } catch { /* already stopped */ }
      layer.source = null; layer.target = 0; layer.gain.gain.value = 0;
    }
  }

  private markMissing(src: string): void {
    this.missingFiles.add(src);
    if (!this.warnedMissing) {
      this.warnedMissing = true;
      console.warn(
        `[audio] Could not decode or load audio asset: ${src}`,
      );
    }
  }
}

/**
 * The weather and season variants in `public/audio/ambient/` (`{phase}-{weather|season}`, e.g. "day-rain"). Only
 * these are requested, so an unauthored variant is never a 404 (audit 2026-10 world item 19). Add a name here when its
 * file lands; `audioFiles.test.ts` checks every listed file is on disk.
 */
export const AMBIENT_VARIANTS: ReadonlySet<string> = new Set<string>([]);

/**
 * Ambient candidate list: a listed weather variant, then a listed season variant. The applicant island ends on its
 * scene track (on disk); the member island's time-of-day track is the music bed's, so with no variant it stays silent.
 */
export function ambientCandidates(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }, variants: ReadonlySet<string> = AMBIENT_VARIANTS): string[] {
  const { phase, weather, season } = input;
  const list: string[] = [];
  if (weather && weather !== "clear" && variants.has(`${phase}-${weather}`)) list.push(`/audio/ambient/${phase}-${weather}.ogg`);
  if (season && variants.has(`${phase}-${season}`)) list.push(`/audio/ambient/${phase}-${season}.ogg`);
  if (phase === "applicant-island" || phase === "applicant-hq") list.push(MANIFEST.ambient[phase]);
  return list;
}

// Singleton — module-scope so all consumers share one manager.
export const AudioManager = new AudioManagerImpl();
