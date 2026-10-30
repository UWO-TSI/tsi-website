import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManagerImpl, ambientCandidates } from "./audio";

// These tests drive the engine with every block file present but 02's; which files exist is musicSchedule's (audioFiles.test.ts).
vi.mock("./musicSchedule", async importOriginal => {
  const real = await importOriginal<typeof import("./musicSchedule")>();
  const all = new Set(["cafe.mp3", "interior.mp3", "bar-night.mp3", ...real.MUSIC_BLOCKS.filter(b => b !== "02").flatMap(b => [`${b}.mp3`, `${b}-winter.mp3`])]);
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
const playing = () => FakeAudio.all.filter(a => !a.paused).map(a => a.src);
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
  it("starts the hourly block on enable as the island's one music source, and crossfades to the next", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "day" });
    manager.setMusic({ block: "12", phase: "day" });
    manager.enable();
    // The member island's ambient has no real ambience to play, so only the bed starts.
    expect(playing()).toEqual(["/assets/audio/music/12.mp3"]);
    const music = FakeAudio.all[0];

    manager.setMusic({ block: "14", phase: "day" });
    frame(400); // mid-crossfade: two tracks, for the fade only
    expect(playing()).toEqual(["/assets/audio/music/12.mp3", "/assets/audio/music/14.mp3"]);
    frame(800);
    expect(playing()).toEqual(["/assets/audio/music/14.mp3"]);
    expect(music.paused).toBe(true); // the old block track was faded out and stopped
    manager.stop();
  });

  it("does not restart the block when setMusic is called again with the same key", () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "10", phase: "day" });
    manager.enable();
    expect(FakeAudio.all).toHaveLength(1);
    manager.setMusic({ block: "10", phase: "day" });
    expect(FakeAudio.all).toHaveLength(1); // no-op, same candidate list
    manager.stop();
  });

  it("falls back to the plain block file when no seasonal variant is present, then to the existing track", async () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "12", phase: "day", season: "winter" });
    manager.enable();
    const el = FakeAudio.all[0];
    expect(el.src).toBe("/assets/audio/music/12-winter.mp3");
    // Simulate the seasonal file not existing: playback rejects as unsupported,
    // which the cascading engine only learns once the play() promise settles.
    FakeAudio.failure = new DOMException("missing", "NotSupportedError");
    manager.setMusic({ block: "16", phase: "day", season: "winter" });
    const started = FakeAudio.all.at(-1)!;
    expect(started.src).toBe("/assets/audio/music/16-winter.mp3");
    await Promise.resolve(); // let the rejection advance to the next candidate
    expect(started.src).toBe("/assets/audio/music/16.mp3");
    FakeAudio.failure = null;
    manager.stop();
  });

  it("uses the cafe override ahead of the hourly block, and interior for other rooms", () => {
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "08", phase: "day", override: "cafe" });
    manager.enable();
    expect(FakeAudio.all[0].src).toBe("/assets/audio/music/cafe.mp3");
    manager.setMusic({ block: "08", phase: "day", override: "interior" });
    expect(FakeAudio.all.at(-1)?.src).toBe("/assets/audio/music/interior.mp3");
    manager.stop();
  });

  it("mute silences music and ambient without changing the saved slider values", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "day" });
    manager.setMusic({ block: "12", phase: "day" });
    manager.enable();
    expect(manager.getState().muted).toBe(false);
    manager.setMuted(true);
    expect(FakeAudio.all.length).toBeGreaterThan(0);
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
    manager.setMusic({ block: "20", phase: "dusk", override: "cafe" });
    expect(manager.getState().music).toEqual({ block: "20", override: "cafe" });
    manager.stop();
  });
});

describe("one music bed", () => {
  it("plays the room override, else the block's file, else the CC0 time-of-day track, following the phase", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "night" });
    manager.setMusic({ block: "02", phase: "night", override: "bar-night" });
    manager.enable();
    expect(playing()).toEqual(["/assets/audio/music/bar-night.mp3"]);
    manager.setMusic({ block: "00", phase: "night" }); frame(800);
    expect(playing()).toEqual(["/assets/audio/music/00.mp3"]);
    manager.setMusic({ block: "02", phase: "night" }); frame(1600); // the mock has no 02.mp3
    expect(playing()).toEqual(["/audio/ambient/night.ogg"]);
    manager.setMusic({ block: "02", phase: "dawn" }); frame(2400);
    expect(playing()).toEqual(["/audio/ambient/dawn.ogg"]);
    manager.stop();
  });

  it("falls back to the time-of-day track when the block's file fails to decode", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "night" });
    manager.setMusic({ block: "22", phase: "night", override: "bar-night" }); // with every file on disk (the mock)
    manager.enable();
    expect(playing()).toEqual(["/assets/audio/music/bar-night.mp3"]);
    FakeAudio.failure = new DOMException("missing", "NotSupportedError");
    manager.setMusic({ block: "06", phase: "dawn" });
    return Promise.resolve().then(() => {
      FakeAudio.failure = null;
      // 06.mp3 failed to decode, so the bed lands on the dawn track: one source once the fade is done.
      expect(FakeAudio.all.at(-1)!.src).toBe("/audio/ambient/dawn.ogg");
      manager.stop();
    });
  });

  it("leaves the applicant island's bed exactly as it was: its Stream Cafe track on the ambient channel, no music channel", () => {
    const manager = new AudioManagerImpl();
    manager.setAmbience({ phase: "applicant-island" });
    manager.enable();
    expect(playing()).toEqual(["/audio/ambient/applicant-ocean-railway.ogg"]);
    expect(FakeAudio.all[0].volume).toBeCloseTo(0.7 * 0.6 * 0.18);
    manager.stop();
  });

  it("member ambience is silent until real ambience is authored", () => {
    for (const phase of ["dawn", "day", "dusk", "night"] as const) expect(ambientCandidates({ phase, weather: "rain", season: "winter" })).toEqual([]);
    expect(ambientCandidates({ phase: "night", weather: "rain" }, new Set(["night-rain"]))).toEqual(["/audio/ambient/night-rain.ogg"]);
  });
});

describe("a musical loop layer ducks the bed", () => {
  class FakeParam { value = 0; setTargetAtTime(v: number) { this.value = v; } }
  class FakeContext {
    state = "running"; currentTime = 0; destination = {};
    createGain() { return { gain: new FakeParam(), connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} }; }
    decodeAudioData() { return Promise.resolve({ duration: 8 }); }
    resume() { return Promise.resolve(); }
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  it("silences the bed while the drums play and brings it back when they stop", async () => {
    (globalThis.window as unknown as { AudioContext: typeof FakeContext }).AudioContext = FakeContext;
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "22", phase: "night" });
    manager.enable();
    const bed = FakeAudio.all[0], full = 0.7 * 0.55;
    expect(bed.volume).toBeCloseTo(full);

    manager.setLoop("/audio/drums/taiko.ogg", 0.9); // by the fire with a dancer
    expect(bed.volume).toBeCloseTo(full); // still loading: nothing plays yet, so nothing ducks
    await settle();
    expect(bed.volume).toBe(0); // the drums replace the bed

    manager.setLoop("/audio/drums/taiko.ogg", 0.075); // walking away: at the edge of the drums' range, half the bed
    expect(bed.volume).toBeCloseTo(full / 2);
    manager.setLoop("/audio/drums/taiko.ogg", 0); // out of range
    expect(bed.volume).toBeCloseTo(full);
    manager.stop();
  });

  it("a missing loop file never ducks the bed", async () => {
    (globalThis.window as unknown as { AudioContext: typeof FakeContext }).AudioContext = FakeContext;
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, status: 404 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = new AudioManagerImpl();
    manager.setMusic({ block: "12", phase: "day" });
    manager.enable();
    manager.setLoop("/audio/drums/softbeat.ogg", 0.5);
    await settle();
    expect(FakeAudio.all[0].volume).toBeCloseTo(0.7 * 0.55);
    manager.stop();
  });
});
