import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManagerImpl } from "./audio";

class FakeAudio extends EventTarget {
  static all: FakeAudio[] = [];
  static failure: DOMException | null = null;
  src: string;
  loop = false;
  preload = "";
  volume = 1;
  paused = true;
  error: { code: number } | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) { super(); this.src = src; FakeAudio.all.push(this); }
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

describe("world audio lifecycle", () => {
  it("keeps applicant movement quieter than feedback, including after volume changes", () => {
    const manager = new AudioManagerImpl();
    manager.setPhase("applicant-island"); manager.enable();
    manager.playSFX("footstep"); manager.playSFX("jump"); manager.playSFX("confirm");
    const [step, jump, confirm] = FakeAudio.all.slice(-3);
    expect(step.volume).toBeCloseTo(0.7 * 0.8 * 0.25 * 0.35);
    expect(jump.volume).toBeCloseTo(step.volume);
    expect(confirm.volume).toBeCloseTo(0.7 * 0.8 * 0.25);
    manager.setVolumes({ master: 0 });
    expect([step.volume, jump.volume, confirm.volume]).toEqual([0, 0, 0]);
    manager.setVolumes({ master: 1 });
    expect(step.volume / confirm.volume).toBeCloseTo(0.35);
    expect(jump.volume).toBeCloseTo(step.volume);
    manager.dispose();
  });
  it("uses the requested quiet applicant tracks without changing saved member volumes", () => {
    const manager = new AudioManagerImpl();
    manager.setPhase("applicant-island"); manager.enable();
    expect(FakeAudio.all[0].src).toBe("/audio/ambient/applicant-ocean-railway.ogg");
    expect(FakeAudio.all[0].volume).toBeCloseTo(0.7 * 0.6 * 0.18);
    manager.setPhase("applicant-hq"); frame(800);
    expect(FakeAudio.all.at(-1)?.src).toBe("/audio/ambient/applicant-willow-tree.ogg");
    expect(FakeAudio.all.at(-1)?.volume).toBeCloseTo(0.7 * 0.6 * 0.18);
    expect(manager.getState().volumes).toEqual({ master: 0.7, ambient: 0.6, sfx: 0.8 });
    manager.setPhase("day"); frame(1600);
    expect(FakeAudio.all.at(-1)?.volume).toBeCloseTo(0.42);
    manager.dispose();
  });
  it("keeps the applicant soundtrack muted across HQ transitions", () => {
    const manager = new AudioManagerImpl(); manager.setPhase("applicant-island"); manager.enable();
    manager.setVolumes({ master: 0 }); manager.setPhase("applicant-hq"); frame(800);
    expect(FakeAudio.all.every(track => track.volume === 0)).toBe(true);
    manager.dispose();
  });
  it("keeps both ambient tracks muted through the remainder of a crossfade", () => {
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); manager.setPhase("night"); frame(400);
    expect(FakeAudio.all.map(a => a.volume)).toEqual([0.21, 0.21]);
    manager.setVolumes({ master: 0 }); expect(FakeAudio.all.map(a => a.volume)).toEqual([0, 0]);
    frame(600); frame(800);
    expect(FakeAudio.all.map(a => a.volume)).toEqual([0, 0]);
    expect(FakeAudio.all[0].paused).toBe(true); expect(FakeAudio.all[1].paused).toBe(false);
    manager.dispose();
  });
  it("applies volume changes proportionally to both tracks mid-fade", () => {
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); manager.setPhase("night"); frame(200);
    manager.setVolumes({ master: 1, ambient: 0.8 });
    expect(FakeAudio.all[0].volume).toBeCloseTo(0.6); expect(FakeAudio.all[1].volume).toBeCloseTo(0.2);
    frame(800); expect(FakeAudio.all[1].volume).toBeCloseTo(0.8); manager.dispose();
  });
  it("mutes already-playing one-shots and stops every sound and fade on exit", () => {
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); manager.playSFX("confirm"); manager.setPhase("night");
    manager.setVolumes({ master: 0 }); expect(FakeAudio.all.every(a => a.volume === 0)).toBe(true);
    manager.stop(); expect(FakeAudio.all.every(a => a.paused)).toBe(true); expect(frames.size).toBe(0);
    expect(manager.getState().enabled).toBe(true);
    manager.setPhase("night"); expect(FakeAudio.all.at(-1)?.paused).toBe(false);
    expect(FakeAudio.all.at(-1)?.src).toBe("/audio/ambient/night.ogg"); manager.dispose();
  });
  it("keeps only the newest fade when the phase changes rapidly", () => {
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); manager.setPhase("dusk"); frame(200); manager.setPhase("night");
    expect(FakeAudio.all[1].paused).toBe(true); expect(frames.size).toBe(1);
    frame(1000); expect(FakeAudio.all.filter(a => !a.paused).map(a => a.src)).toEqual(["/audio/ambient/night.ogg"]); manager.dispose();
  });
  it("allows retry after autoplay rejection instead of treating the file as missing", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    FakeAudio.failure = new DOMException("gesture required", "NotAllowedError");
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); await Promise.resolve();
    expect(manager.getState().enabled).toBe(false); expect(warning).not.toHaveBeenCalled();
    FakeAudio.failure = null; manager.enable(); await Promise.resolve();
    expect(manager.getState().enabled).toBe(true); expect(FakeAudio.all.at(-1)?.paused).toBe(false); manager.dispose();
  });
  it("ignores a rejected playback promise after its track has been stopped", async () => {
    FakeAudio.failure = new DOMException("late", "NotAllowedError");
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); manager.stop(); await Promise.resolve();
    expect(manager.getState().enabled).toBe(true); manager.dispose();
  });
  it("does not blacklist a track when play is interrupted", async () => {
    FakeAudio.failure = new DOMException("interrupted", "AbortError");
    const manager = new AudioManagerImpl(); manager.setPhase("day"); manager.enable(); await Promise.resolve(); manager.stop();
    FakeAudio.failure = null; manager.setPhase("day"); expect(FakeAudio.all).toHaveLength(2); manager.dispose();
  });
  it("rejects malformed saved volumes and keeps runtime values finite", () => {
    saved.set("tsi.audio.v1", JSON.stringify({ master: "loud", ambient: {}, sfx: -2 }));
    const manager = new AudioManagerImpl(); expect(manager.getState().volumes).toEqual({ master: 0.7, ambient: 0.6, sfx: 0 });
    manager.setVolumes({ master: NaN, ambient: Infinity, sfx: 4 }); expect(manager.getState().volumes).toEqual({ master: 0.7, ambient: 0.6, sfx: 1 }); manager.dispose();
  });
  it("releases finished one-shots from live volume updates", () => {
    const manager = new AudioManagerImpl(); manager.enable(); manager.playSFX("confirm"); const sound = FakeAudio.all[0]; const initial = sound.volume;
    sound.onended?.(); manager.setVolumes({ master: 0 }); expect(sound.volume).toBe(initial); manager.dispose();
  });
});
