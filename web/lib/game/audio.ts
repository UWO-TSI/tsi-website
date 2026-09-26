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
 * Two independent crossfading beds share one cascading-candidate engine:
 *   - ambient: the existing time-of-day loop, now also able to try a
 *     weather- or season-specific variant before the guaranteed base file.
 *   - music: the new 12-block hourly player (`musicSchedule.ts` picks the
 *     block), with a seasonal-variant slot and interior/cafe overrides,
 *     always ending on a fallback that already exists on disk.
 * A candidate list of one item (the common case today — no weather/season
 * variant authored yet) behaves exactly like the old single-src load.
 *
 * Public API:
 *   AudioManager.enable()                        — user gesture unlock
 *   AudioManager.setVolumes({ master, ambient, music, sfx })
 *   AudioManager.setMuted(bool)                   — silences all channels, keeps sliders
 *   AudioManager.setPhase(phase)                  — crossfade ambient track (time only)
 *   AudioManager.setAmbience({ phase, weather, season }) — crossfade ambient, richer key
 *   AudioManager.setMusic({ block, season, override }) — crossfade the hourly music bed
 *   AudioManager.playSFX(name)                   — one-shot, overlapping safe
 *   AudioManager.playBlip()                      — random dialogue voice blip
 *   AudioManager.dispose()
 *   AudioManager.subscribe(listener)             — for React UI sync
 *   AudioManager.getState()
 */

import { buildMusicSrcList, type MusicBlock, type MusicOverride } from "./musicSchedule";
import type { IslandWeather } from "./islandWeather";
import type { Season } from "./season";

export type AmbientPhase = "dawn" | "day" | "dusk" | "night" | "applicant-island" | "applicant-hq";
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
  | "blip5";

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

const DEFAULT_VOLUMES: AudioVolumes = { master: 0.7, ambient: 0.6, music: 0.55, sfx: 0.8 };

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
  private oneShots = new Map<HTMLAudioElement, SFXName>();

  private missingFiles = new Set<string>();
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
      const target = this.targetVolume(name);
      if (ch.current) ch.current.volume = target * (ch.next ? 1 - ch.fadeProgress : 1);
      if (ch.next) ch.next.volume = target * ch.fadeProgress;
    }
    for (const [sound, name] of this.oneShots) sound.volume = this.sfxTargetVolume(name);
  }

  private playElement(el: HTMLAudioElement, src: string): void {
    void el.play().catch((error: unknown) => {
      if (!this.isTracked(el)) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.enabled = false;
        this.stop();
        this.notify();
      } else if (error instanceof DOMException && error.name === "NotSupportedError") {
        this.markMissing(src);
      }
      this.oneShots.delete(el);
    });
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

  private sfxTargetVolume(name: SFXName): number {
    const applicant = this.phase === "applicant-island" || this.phase === "applicant-hq";
    const sceneGain = applicant ? 0.25 : 1;
    const movementGain = applicant && (name === "footstep" || name === "jump") ? 0.35 : 1;
    return this.volumes.master * this.volumes.sfx * sceneGain * movementGain * this.mutedGain();
  }

  /** Time-of-day only — kept for existing callers (GameWorld, ApplicantIsland). */
  setPhase(phase: AmbientPhase): void {
    this.setAmbience({ phase });
  }

  /** Richer ambient key: time of day, plus an optional weather/season variant tried first. */
  setAmbience(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }): void {
    const candidates = ambientCandidates(input);
    const key = candidates.join("|");
    if (this.ambientKey === key) {
      if (this.enabled && !this.ambientCh.current && !this.ambientCh.next) this.startChannel("ambient", candidates);
      return;
    }
    const previousKey = this.ambientKey;
    this.ambientKey = key;
    this.ambientCandidates = candidates;
    this.phase = input.phase;
    if (this.enabled) {
      if (previousKey === null) this.startChannel("ambient", candidates);
      else this.crossfadeChannel("ambient", candidates);
    }
    this.notify();
  }

  /** The 12-block hourly music player (rows 106, 112-114), with interior/cafe overrides. */
  setMusic(input: { block: MusicBlock; season?: Season | null; override?: MusicOverride }): void {
    const candidates = buildMusicSrcList(input.block, { season: input.season, override: input.override ?? null });
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

  private newTrackElement(loop: boolean): HTMLAudioElement | null {
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
    if (typeof window === "undefined") return;
    const el = this.newTrackElement(true);
    if (!el) return;
    el.volume = this.targetVolume(name);
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

    const next = this.newTrackElement(true);
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

  playSFX(name: SFXName): void {
    if (!this.enabled || typeof window === "undefined") return;
    const src = MANIFEST.sfx[name];
    if (this.missingFiles.has(src)) return; // already known missing
    const el = this.createAudioElement(src, false);
    if (!el) return;
    el.volume = this.sfxTargetVolume(name);
    this.oneShots.set(el, name);
    el.onended = () => this.oneShots.delete(el);
    el.addEventListener("error", () => this.oneShots.delete(el), { once: true });
    this.playElement(el, src);
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
  }

  dispose(): void {
    this.stop();
    this.enabled = false;
    this.phase = null;
    this.ambientKey = null;
    this.ambientCandidates = [];
    this.musicKey = null;
    this.musicCandidates = [];
    this.musicBlock = null;
    this.musicOverride = null;
    this.notify();
    this.listeners.clear();
  }

  private createAudioElement(src: string, loop: boolean): HTMLAudioElement | null {
    if (this.missingFiles.has(src)) return null;
    try {
      const el = new Audio(src);
      el.loop = loop;
      el.preload = "auto";
      el.onerror = () => { if (el.error?.code === 4) this.markMissing(src); };
      return el;
    } catch {
      this.markMissing(src);
      return null;
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

/** Ambient candidate list: an optional weather variant, then season variant, then the base file (guaranteed to exist). */
function ambientCandidates(input: { phase: AmbientPhase; weather?: IslandWeather; season?: Season }): string[] {
  const { phase, weather, season } = input;
  const base = MANIFEST.ambient[phase];
  const list: string[] = [];
  if (weather && weather !== "clear") list.push(`/audio/ambient/${phase}-${weather}.ogg`);
  if (season) list.push(`/audio/ambient/${phase}-${season}.ogg`);
  list.push(base);
  return list;
}

// Singleton — module-scope so all consumers share one manager.
export const AudioManager = new AudioManagerImpl();
