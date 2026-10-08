// Synthesized sound effects. No audio files; everything is built from oscillators and noise.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05);
}

function tone(
  freq: number,
  { type = "sine", at = 0, dur = 0.15, vol = 0.2, attack = 0.005, slide }: {
    type?: OscillatorType;
    at?: number;
    dur?: number;
    vol?: number;
    attack?: number;
    slide?: number;
  } = {}
) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ at = 0, dur = 0.1, vol = 0.2, freq = 1200, q = 1 } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  key() {
    noise({ dur: 0.03, vol: 0.12, freq: 3800, q: 4 });
    tone(1800, { type: "square", dur: 0.025, vol: 0.02 });
  },
  clunk() {
    tone(110, { dur: 0.32, vol: 0.5, slide: 45 });
    noise({ dur: 0.18, vol: 0.35, freq: 420, q: 0.8 });
    for (let i = 0; i < 6; i++) noise({ at: 0.05 + i * 0.045, dur: 0.02, vol: 0.1, freq: 2600, q: 6 });
  },
  lamp(i: number, kind: "green" | "amber") {
    tone(kind === "green" ? 880 + i * 110 : 520 + i * 60, { at: 0.12 + i * 0.08, dur: 0.12, vol: 0.07, type: "triangle" });
  },
  close() {
    tone(660, { at: 0.45, dur: 0.12, vol: 0.08, type: "triangle" });
    tone(622, { at: 0.58, dur: 0.22, vol: 0.08, type: "triangle" });
  },
  deny() {
    for (let i = 0; i < 4; i++) {
      tone(220, { at: i * 0.32, dur: 0.22, vol: 0.12, type: "sawtooth", slide: 180 });
    }
    tone(55, { dur: 1.2, vol: 0.25, slide: 40 });
  },
  open() {
    for (let i = 0; i < 4; i++) tone(988 + i * 165, { at: 0.15 + i * 0.16, dur: 0.14, vol: 0.06, type: "triangle" });
    for (let i = 0; i < 10; i++) noise({ at: 0.9 + i * 0.05, dur: 0.05, vol: 0.18, freq: 1500, q: 3 });
    tone(80, { at: 1.6, dur: 1.4, vol: 0.4, slide: 50 });
    noise({ at: 1.6, dur: 1.2, vol: 0.12, freq: 300, q: 0.5 });
  },
  // Faint choir-like swell when the ticket appears.
  angel() {
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((f, i) => {
      tone(f, { at: i * 0.05, dur: 3.2, vol: 0.022, attack: 0.9, type: "sine" });
      tone(f * 1.003, { at: i * 0.05, dur: 3.2, vol: 0.012, attack: 1.1, type: "triangle" });
    });
    tone(2093, { at: 0.6, dur: 1.8, vol: 0.008, attack: 0.6 });
  },
};
