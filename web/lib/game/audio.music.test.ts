import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManagerImpl } from "./audio";

// These tests drive the engine with every block file present; which files exist is musicSchedule's (audioFiles.test.ts).
vi.mock("./musicSchedule", async importOriginal => {
  const real = await importOriginal<typeof import("./musicSchedule")>();
  const all = new Set(["cafe.mp3", "interior.mp3", ...real.MUSIC_BLOCKS.flatMap(b => [`${b}.mp3`, `${b}-winter.mp3`])]);
  return { ...real, buildMusicSrcList: (block: Parameters<typeof real.buildMusicSrcList>[0], opts?: Parameters<typeof real.buildMusicSrcList>[1]) => real.buildMusicSrcList(block, opts, all) };
});

// Same fake used by audio.test.ts, duplicated locally so this file can add a
// `src` setter (the cascading-candidate engine reassigns `.src` on retry,
// which the original fixture never needed to support).
class FakeAudio extends EventTarget {
  static all: FakeAudio[] = [];
  static failure: DOMException | null = null;
  private _src = "";
  loop = false;
  preload = "";
  volume = 1;
  paused = true;
  error: { code: number } | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { super(); FakeAudio.all.push(this); }
  get src() { return this._src; }
  set src(value: string) { this._src = value; }
  play() { this.paused = false; return FakeAudio.failure ? Promise.reject(FakeAudio.failure) : Promise.resolve(); }
  pause() { this.paused = true; }
}
let now = 0;
let sequence = 0;
let frames: Map<number, FrameRequestCallback>;
let saved: Map<string, string>;
function frame(time: number) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }

beforeEach(() => {
  FakeAudio.all = []; FakeAudio.failure = null; now = 0; sequence = 0; frames = new Map(); saved = new Map();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { frames.set(++sequence, fn); return sequence; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("music channel", () => {
  it("starts the hourly block on enable and crossfades independently of the ambient bed", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "day" });
    manager.setMusic({ block: "12" });
    manager.enable();
    // Both channels start: one ambient element, one music element.
    expect(FakeAudio.all).toHaveLength(2);
    const [ambient, music] = FakeAudio.all;
    expect(ambient.src).toBe("/audio/ambient/day.ogg");
    expect(music.src).toBe("/assets/audio/music/12.mp3");

    manager.setMusic({ block: "14" });
    // A third element appears for the new block; the ambient bed is untouched.
    expect(FakeAudio.all).toHaveLength(3);
    frame(800);
    expect(FakeAudio.all.filter(a => !a.paused).map(a => a.src)).toEqual(
      expect.arrayContaining(["/audio/ambient/day.ogg", "/assets/audio/music/14.mp3"]),
    );
    expect(music.paused).toBe(true); // the old block track was faded out and stopped
    manager.stop();
  });

  it("does not restart the block when setMusic is called again with the same key", () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "10" });
    manager.enable();
    expect(FakeAudio.all).toHaveLength(1);
    manager.setMusic({ block: "10" });
    expect(FakeAudio.all).toHaveLength(1); // no-op, same candidate list
    manager.stop();
  });

  it("falls back to the plain block file when no seasonal variant is present, then to the existing track", async () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "12", season: "winter" });
    manager.enable();
    const el = FakeAudio.all[0];
    expect(el.src).toBe("/assets/audio/music/12-winter.mp3");
    // Simulate the seasonal file not existing: playback rejects as unsupported,
    // which the cascading engine only learns once the play() promise settles.
    FakeAudio.failure = new DOMException("missing", "NotSupportedError");
    manager.setMusic({ block: "16", season: "winter" });
    const started = FakeAudio.all.at(-1)!;
    expect(started.src).toBe("/assets/audio/music/16-winter.mp3");
    await Promise.resolve(); // let the rejection advance to the next candidate
    expect(started.src).toBe("/assets/audio/music/16.mp3");
    FakeAudio.failure = null;
    manager.stop();
  });

  it("uses the cafe override ahead of the hourly block, and interior for other rooms", () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "08", override: "cafe" });
    manager.enable();
    expect(FakeAudio.all[0].src).toBe("/assets/audio/music/cafe.mp3");
    manager.setMusic({ block: "08", override: "interior" });
    expect(FakeAudio.all.at(-1)?.src).toBe("/assets/audio/music/interior.mp3");
    manager.stop();
  });

  it("mute silences music and ambient without changing the saved slider values", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "day" });
    manager.setMusic({ block: "12" });
    manager.enable();
    expect(manager.getState().muted).toBe(false);
    manager.setMuted(true);
    expect(FakeAudio.all.every(a => a.volume === 0)).toBe(true);
    expect(manager.getState().volumes).toEqual({ master: 0.7, ambient: 0.6, music: 0.55, sfx: 0.8 });
    manager.setMuted(false);
    expect(FakeAudio.all.every(a => a.volume > 0)).toBe(true);
    manager.stop();
  });

  it("persists mute and the music volume alongside the existing sliders", () => {
    const manager = new AudioManagerImpl();
    manager.setVolumes({ music: 0.3 });
    manager.setMuted(true);
    const stored = JSON.parse(saved.get("tsi.audio.v1")!);
    expect(stored).toEqual({ master: 0.7, ambient: 0.6, music: 0.3, sfx: 0.8, muted: true });
    // A fresh manager reads the persisted prefs back, mute included.
    const reloaded = new AudioManagerImpl();
    expect(reloaded.getState().muted).toBe(true);
    expect(reloaded.getState().volumes.music).toBeCloseTo(0.3);
    manager.stop(); reloaded.stop();
  });

  it("reports the current block and override through getState", () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "20", override: "cafe" });
    expect(manager.getState().music).toEqual({ block: "20", override: "cafe" });
    manager.stop();
  });
});
