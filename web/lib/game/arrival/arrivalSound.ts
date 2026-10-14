"use client";

/**
 * The underwater beat's sound (specs/v1-drop.md §1.1): a muffled heartbeat and bubbles, then a gasp at the surface.
 * Synthesised with Web Audio (no files: the music and sound source is still David's call), at the sound effects'
 * volume and only with sound on (AudioManager). Everything goes through one low-pass "underwater" filter that opens
 * up as you break the surface.
 */
import { AudioManager } from "@/lib/game/audio";

let ctx: AudioContext | null = null;
let bus: { out: GainNode; muffle: BiquadFilterNode } | null = null;
let noise: AudioBuffer | null = null;

function audio(): { c: AudioContext; out: GainNode; muffle: BiquadFilterNode } | null {
  const s = AudioManager.getState();
  if (!s.enabled || s.muted || typeof window === "undefined") return null;
  const level = s.volumes.master * s.volumes.sfx;
  if (level <= 0.001) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (!bus) {
      const muffle = ctx.createBiquadFilter();
      muffle.type = "lowpass"; muffle.frequency.value = 520; muffle.Q.value = 0.8;
      const out = ctx.createGain();
      muffle.connect(out).connect(ctx.destination);
      bus = { out, muffle };
    }
    bus.out.gain.value = level;
    return { c: ctx, ...bus };
  } catch { return null; }
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** One heartbeat: lub-dub, low and thick, through the water. */
export function heartbeat(strength = 1) {
  const a = audio();
  if (!a) return;
  const { c, muffle } = a;
  for (const [delay, gain, pitch] of [[0, 0.9, 62], [0.24, 0.6, 52]] as const) {
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(pitch * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * strength, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(muffle);
    o.start(t); o.stop(t + 0.3);
  }
}

/** A few bubbles: short rising blips, each a little higher, scattered over `spread` s. */
export function bubbles(count = 4, spread = 0.6) {
  const a = audio();
  if (!a) return;
  const { c, muffle } = a;
  for (let i = 0; i < count; i++) {
    const t = c.currentTime + Math.random() * spread, f = 380 + Math.random() * 520, len = 0.05 + Math.random() * 0.06;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.4, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(muffle);
    o.start(t); o.stop(t + len + 0.02);
  }
}

/** Breaking the surface: the water opens up (the muffle lifts) and a sharp breath in. */
export function gasp() {
  const a = audio();
  if (!a) return;
  const { c, muffle } = a;
  const t = c.currentTime;
  muffle.frequency.cancelScheduledValues(t);
  muffle.frequency.setValueAtTime(muffle.frequency.value, t);
  muffle.frequency.exponentialRampToValueAtTime(9000, t + 0.12);
  // The splash: a burst of noise, bright then gone.
  const splash = c.createBufferSource(), sg = c.createGain(), sf = c.createBiquadFilter();
  splash.buffer = noiseBuffer(c);
  sf.type = "highpass"; sf.frequency.value = 900;
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  splash.connect(sf).connect(sg).connect(muffle);
  splash.start(t); splash.stop(t + 0.55);
  // The gasp: breathy noise through a vowel-ish band that rises, swelling in and catching.
  const breath = c.createBufferSource(), bf = c.createBiquadFilter(), bg = c.createGain();
  breath.buffer = noiseBuffer(c);
  bf.type = "bandpass"; bf.Q.value = 2.2;
  bf.frequency.setValueAtTime(900, t + 0.08);
  bf.frequency.exponentialRampToValueAtTime(2300, t + 0.45);
  bg.gain.setValueAtTime(0.0001, t + 0.08);
  bg.gain.exponentialRampToValueAtTime(0.42, t + 0.3);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
  breath.connect(bf).connect(bg).connect(muffle);
  breath.start(t + 0.08); breath.stop(t + 0.66);
}

/** Back under (a replay) or done: the muffle closes again for next time. */
export function resetMuffle() {
  if (!ctx || !bus) return;
  bus.muffle.frequency.cancelScheduledValues(ctx.currentTime);
  bus.muffle.frequency.value = 520;
}
