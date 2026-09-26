"use client";

/**
 * Audio manager (sprint A7 infra; content landed 2026-07-03 cozy push).
 *
 * Original member-world files are CC0 (see
 * `web/public/audio/CREDITS.md`): ambient loops from Pixel-boy's Ninja
 * Adventure pack (Peaceful/Calm Village/Chill/Dream mapped to
 * dawn/day/dusk/night), SFX from Kenney RPG Audio + Interface Sounds,
 * dialogue voice blips from Ninja Adventure (animalese-lite for NPC chat).
 * Applicant music by Stream Cafe has separate source/use terms in CREDITS.md.
 * The missing-file fallback stays: a deleted file just runs silent.
 *
 * Public API:
 *   AudioManager.enable()                        — user gesture unlock
 *   AudioManager.setVolumes({ master, ambient, sfx })
 *   AudioManager.setPhase(phase)                 — crossfade ambient track
 *   AudioManager.playSFX(name)                   — one-shot, overlapping safe
 *   AudioManager.playBlip()                      — random dialogue voice blip
 *   AudioManager.dispose()
 *   AudioManager.subscribe(listener)             — for React UI sync
 *   AudioManager.getState()
 */

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
  ambient: number; // 0-1
  sfx: number;     // 0-1
}

export interface AudioState {
  enabled: boolean;
  volumes: AudioVolumes;
  phase: AmbientPhase | null;
}

const STORAGE_KEY = "tsi.audio.v1";
const CROSSFADE_MS = 800;

type Listener = (state: AudioState) => void;

function readStoredVolumes(): AudioVolumes {
  if (typeof window === "undefined") {
    return { master: 0.7, ambient: 0.6, sfx: 0.8 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        master: clamp01(parsed.master, 0.7),
        ambient: clamp01(parsed.ambient, 0.6),
        sfx: clamp01(parsed.sfx, 0.8),
      };
    }
  } catch {
    /* ignore */
  }
  return { master: 0.7, ambient: 0.6, sfx: 0.8 };
}

function clamp01(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export class AudioManagerImpl {
  private enabled = false;
  private volumes: AudioVolumes = { master: 0.7, ambient: 0.6, sfx: 0.8 };
  private phase: AmbientPhase | null = null;

  private currentTrack: HTMLAudioElement | null = null;
  private nextTrack: HTMLAudioElement | null = null;
  private crossfadeRaf: number | null = null;
  private crossfadeStart = 0;
  private fadeProgress = 0;
  private oneShots = new Map<HTMLAudioElement, SFXName>();

  private missingFiles = new Set<string>();
  private warnedMissing = false;
  private listeners = new Set<Listener>();
  private cachedSnapshot: AudioState;

  constructor() {
    if (typeof window !== "undefined") {
      this.volumes = readStoredVolumes();
    }
    this.cachedSnapshot = this.computeSnapshot();
  }

  private computeSnapshot(): AudioState {
    return { enabled: this.enabled, volumes: { ...this.volumes }, phase: this.phase };
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

  enable(): void {
    if (this.enabled || typeof window === "undefined") return;
    this.enabled = true;
    // If a phase was set before enable, start the track now.
    if (this.phase) {
      this.startAmbient(this.phase);
    }
    this.notify();
  }

  setVolumes(partial: Partial<AudioVolumes>): void {
    this.volumes = {
      master: clamp01(partial.master, this.volumes.master),
      ambient: clamp01(partial.ambient, this.volumes.ambient),
      sfx: clamp01(partial.sfx, this.volumes.sfx),
    };
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
      } catch {
        /* ignore quota errors */
      }
    }
    this.applyVolumes();
    this.notify();
  }

  private applyVolumes(): void {
    const target = this.ambientTargetVolume();
    if (this.currentTrack) this.currentTrack.volume = target * (this.nextTrack ? 1 - this.fadeProgress : 1);
    if (this.nextTrack) this.nextTrack.volume = target * this.fadeProgress;
    for (const [sound, name] of this.oneShots) sound.volume = this.sfxTargetVolume(name);
  }

  private playElement(el: HTMLAudioElement, src: string): void {
    void el.play().catch((error: unknown) => {
      if (el !== this.currentTrack && el !== this.nextTrack && !this.oneShots.has(el)) return;
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

  private ambientTargetVolume(): number {
    const sceneGain = this.phase === "applicant-island" || this.phase === "applicant-hq" ? 0.18 : 1;
    return this.volumes.master * this.volumes.ambient * sceneGain;
  }

  private sfxTargetVolume(name: SFXName): number {
    const applicant = this.phase === "applicant-island" || this.phase === "applicant-hq";
    const sceneGain = applicant ? 0.25 : 1;
    const movementGain = applicant && (name === "footstep" || name === "jump") ? 0.35 : 1;
    return this.volumes.master * this.volumes.sfx * sceneGain * movementGain;
  }

  setPhase(phase: AmbientPhase): void {
    if (this.phase === phase) {
      if (this.enabled && !this.currentTrack && !this.nextTrack) this.startAmbient(phase);
      return;
    }
    const previousPhase = this.phase;
    this.phase = phase;
    if (this.enabled) {
      if (previousPhase === null) {
        this.startAmbient(phase);
      } else {
        this.crossfadeTo(phase);
      }
    }
    this.notify();
  }

  private startAmbient(phase: AmbientPhase): void {
    if (typeof window === "undefined") return;
    const src = MANIFEST.ambient[phase];
    const el = this.createAudioElement(src, true);
    if (!el) return;
    el.volume = this.ambientTargetVolume();
    this.currentTrack = el;
    this.playElement(el, src);
  }

  private crossfadeTo(phase: AmbientPhase): void {
    if (typeof window === "undefined") return;
    const src = MANIFEST.ambient[phase];

    // Cancel any in-flight crossfade.
    if (this.crossfadeRaf !== null) {
      cancelAnimationFrame(this.crossfadeRaf);
      this.crossfadeRaf = null;
    }
    // If nextTrack from an earlier fade is still around, dispose it.
    if (this.nextTrack) {
      this.nextTrack.pause();
      this.nextTrack = null;
    }

    const next = this.createAudioElement(src, true);
    if (!next) {
      // Failed to create — just stop current.
      if (this.currentTrack) {
        this.currentTrack.pause();
        this.currentTrack = null;
      }
      return;
    }
    next.volume = 0;
    this.nextTrack = next;
    this.fadeProgress = 0;
    this.playElement(next, src);

    this.crossfadeStart = performance.now();
    const fromTrack = this.currentTrack;

    const tick = () => {
      const elapsed = performance.now() - this.crossfadeStart;
      const t = Math.min(1, elapsed / CROSSFADE_MS);
      this.fadeProgress = t;
      this.applyVolumes();
      if (t < 1) {
        this.crossfadeRaf = requestAnimationFrame(tick);
      } else {
        this.crossfadeRaf = null;
        if (fromTrack) {
          fromTrack.pause();
        }
        this.currentTrack = this.nextTrack;
        this.nextTrack = null;
      }
    };
    this.crossfadeRaf = requestAnimationFrame(tick);
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
    if (this.crossfadeRaf !== null) {
      cancelAnimationFrame(this.crossfadeRaf);
      this.crossfadeRaf = null;
    }
    if (this.currentTrack) {
      this.currentTrack.pause();
      this.currentTrack = null;
    }
    if (this.nextTrack) {
      this.nextTrack.pause();
      this.nextTrack = null;
    }
    for (const sound of this.oneShots.keys()) sound.pause();
    this.oneShots.clear();
    this.fadeProgress = 0;
  }

  dispose(): void {
    this.stop();
    this.enabled = false;
    this.phase = null;
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

// Singleton — module-scope so all consumers share one manager.
export const AudioManager = new AudioManagerImpl();
