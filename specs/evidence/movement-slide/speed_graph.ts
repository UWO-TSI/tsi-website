// The speed graph of a full tech chain (specs/movement-slide.md evidence), from the pure sim at 120 Hz on flat ground:
// sprint, dash into a slide, slide-jump, land into a slide, slide-jump, land into a hop, a plain landing (the grace,
// then the bleed), and a dash with nothing after it. Coloured by momentum (kept, bleeding); the old model (the dash
// fading to 0.55, a slow bleed, no grace) faint underneath for contrast. Writes the SVG to the path given (rsvg-convert it).
//   cd web && npx vite-node --config vitest.config.ts ../specs/evidence/movement-slide/speed_graph.ts -- <out.svg>
import { writeFileSync } from "node:fs";
import { createMoveState, stepMove, MOVE_TUNING, NO_INPUT, STEP, type MoveInput, type MoveState, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import { momentumOf } from "@/components/game/movement/moveFx";

const flat: MoveWorld = { top: () => 0, wet: () => false };
const OUT = process.argv.at(-1)!.endsWith(".svg") ? process.argv.at(-1)! : "/tmp/speed-graph.svg";
const T = MOVE_TUNING, BEFORE: MoveTuning = { ...T, dashExit: 0.55, overspeedDecay: 5, keepGrace: 0 };

/** The chain as held keys by time; presses are edges the script makes on the step they start. */
function chain(t: MoveTuning) {
  let s = createMoveState(0, 0, flat), phase = "sprint", phaseT = 0, landings = 0;
  const rows: { time: number; speed: number; state: string; events: string[] }[] = [];
  for (let i = 0; i < Math.round(5 / STEP); i++) {
    const time = i * STEP, input: Partial<MoveInput> = { z: 1, sprint: true };
    phaseT += STEP;
    if (phase === "sprint" && time >= 1.2) { phase = "dashslide"; phaseT = 0; input.dashPressed = true; }
    if (phase === "dashslide") { input.sneak = true; if (s.mode === "slide" && s.modeT >= 0.15) { input.jump = input.jumpPressed = true; phase = "air1"; } }
    else if (phase === "air1") { input.sneak = true; if (s.mode === "slide") { phase = "slide2"; } }
    else if (phase === "slide2") { input.sneak = true; if (s.modeT >= 0.12) { input.jump = input.jumpPressed = true; phase = "air2"; } }
    else if (phase === "air2") { input.jump = s.vy > 0 || s.mode === "air"; if (s.events.some(e => e.kind === "hop")) phase = "air3"; }
    else if (phase === "air3") { if (s.mode === "ground" && s.modeT > 0.9) { phase = "dash2"; input.dashPressed = true; } }
    s = stepMove(s, { ...NO_INPUT, ...input }, STEP, flat, t);
    if (s.events.some(e => e.kind === "land")) landings++;
    const speed = Math.hypot(s.vx, s.vz);
    rows.push({ time: time + STEP, speed, state: momentumOf(s as MoveState, speed, t.walkSpeed, t.sprintSpeed), events: s.events.map(e => e.kind) });
  }
  return rows;
}
const now = chain(T), before = chain(BEFORE);

// ── The SVG ──
const W = 1100, H = 440, L = 60, R = 20, TOP = 40, BOT = 80, maxV = 20, maxT = 5;
const x = (t: number) => L + (t / maxT) * (W - L - R), y = (v: number) => TOP + (1 - v / maxV) * (H - TOP - BOT);
const COLOR: Record<string, string> = { kept: "#e0a526", bleeding: "#d9644a", "": "#3f9e8a" };
const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Menlo, monospace" font-size="12">`,
  `<rect width="${W}" height="${H}" fill="#0b0e14"/>`,
  `<text x="${L}" y="22" fill="#f1ffff" font-size="15">Speed through a full tech chain (sim, 120 Hz, flat ground): kept while you chain, bled only on plain ground</text>`];
for (const [v, label] of [[T.momentumCeiling, `ceiling ${T.momentumCeiling}`], [T.sprintSpeed, `sprint ${T.sprintSpeed}`], [T.walkSpeed, `walk ${T.walkSpeed}`], [T.dashSpeed * T.dashExit, `dash keeps ${(T.dashSpeed * T.dashExit).toFixed(1)}`]] as const)
  parts.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v === T.momentumCeiling ? 0.4 : 0.16})" stroke-dasharray="${v === T.momentumCeiling ? "5 4" : "2 4"}"/>`,
    `<text x="${W - R - 4}" y="${y(v) - 4}" fill="#8a939a" text-anchor="end">${label}</text>`);
for (let t = 0; t <= maxT; t++) parts.push(`<text x="${x(t)}" y="${H - BOT + 16}" fill="#8a939a" text-anchor="middle">${t}s</text>`);
for (let v = 0; v <= maxV; v += 5) parts.push(`<text x="${L - 8}" y="${y(v) + 4}" fill="#8a939a" text-anchor="end">${v}</text>`);
parts.push(`<polyline fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" points="${before.map(r => `${x(r.time).toFixed(1)},${y(r.speed).toFixed(1)}`).join(" ")}"/>`);
for (let i = 1; i < now.length; i++) parts.push(`<line x1="${x(now[i - 1].time).toFixed(1)}" y1="${y(now[i - 1].speed).toFixed(1)}" x2="${x(now[i].time).toFixed(1)}" y2="${y(now[i].speed).toFixed(1)}" stroke="${COLOR[now[i].state]}" stroke-width="3"/>`);
// Event marks along the bottom.
const NAMES: Record<string, string> = { dash: "dash", dashslide: "dash-slide", slidejump: "slide-jump", landslide: "land-slide", hop: "hop", land: "land", stand: "stand" };
let lastX = -99, row = 0;
for (const r of now) for (const e of r.events) if (NAMES[e] && !(e === "land" && r.events.some(k => k === "landslide" || k === "hop"))) {
  const px = x(r.time);
  row = px - lastX < 130 ? (row + 1) % 3 : 0; lastX = px;
  parts.push(`<line x1="${px}" x2="${px}" y1="${y(r.speed)}" y2="${H - BOT + 22 + row * 14}" stroke="rgba(255,255,255,0.18)"/>`, `<text x="${px + 3}" y="${H - BOT + 32 + row * 14}" fill="#c9d1d6">${NAMES[e]} ${r.speed.toFixed(1)}</text>`);
}
parts.push(`<g transform="translate(${L},${TOP + 4})"><rect width="14" height="4" y="4" fill="${COLOR.kept}"/><text x="20" y="11" fill="#c9d1d6">kept</text>`,
  `<rect x="70" width="14" height="4" y="4" fill="${COLOR.bleeding}"/><text x="90" y="11" fill="#c9d1d6">bleeding</text>`,
  `<rect x="170" width="14" height="4" y="4" fill="${COLOR[""]}"/><text x="190" y="11" fill="#c9d1d6">run</text>`,
  `<rect x="230" width="14" height="4" y="4" fill="rgba(255,255,255,0.28)"/><text x="250" y="11" fill="#c9d1d6">before: the dash fading to 0.55 of its burst, a slow bleed, no grace</text></g>`, "</svg>");
writeFileSync(OUT, parts.join("\n"));
const peak = Math.max(...now.map(r => r.speed));
console.log(`wrote ${OUT}; peak ${peak.toFixed(2)} u/s; events ${now.flatMap(r => r.events.map(e => `${e}@${r.time.toFixed(2)}/${r.speed.toFixed(1)}`)).join(" ")}`);
