// Our painted paper for the GUI sheet (specs/polish/gui-sheet.md): procedural textures and edge shapes, no downloads,
// no AI. Writes the block between the "paper" markers in styles/game-tokens.css; seeded, so a rerun is byte-identical.
//   node web/scripts/gui-paper.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../styles/game-tokens.css", import.meta.url);
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r1 = n => Math.round(n * 10) / 10;
const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim()).replace(/%20/g, " ").replace(/'/g, "%27")}")`;

/** A closed smooth path through `pts` (Catmull-Rom as cubic Béziers). */
function smooth(pts) {
  const n = pts.length, at = i => pts[(i + n) % n];
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + "Z";
}
/** A shape mask in a 100x100 box stretched to its element (preserveAspectRatio none). */
const shape = (pts, seed, wobble) => {
  const r = rng(seed);
  const d = smooth(pts.map(([x, y]) => [x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble]));
  return uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 102 102' preserveAspectRatio='none'><path d='${d}'/></svg>`);
};

// The dialogue: a wide paper whose shoulders bulge past a narrower foot (the kit's speech box).
const DIALOGUE = [[50, 0], [78, 1], [93, 4.5], [99.6, 18], [99.3, 34], [97.4, 46], [95.8, 56], [95.4, 68], [95.6, 82], [91, 95.5], [72, 99.6], [50, 100], [28, 99.6], [9, 95.5], [4.4, 82], [4.6, 68], [4.2, 56], [2.6, 46], [0.7, 34], [0.4, 18], [7, 4.5], [22, 1]];
// The menu box: a fat rounded pebble.
const MENU = [[50, 0], [82, 2], [97, 14], [100, 50], [97, 86], [82, 98], [50, 100], [18, 98], [3, 86], [0, 50], [3, 14], [18, 2]];
// The bag: a pillow, its sides drawn in a little at the waist.
const BAG = [[50, 0.6], [80, 0], [96, 5], [99.8, 26], [98.8, 50], [99.8, 74], [96, 95], [80, 100], [50, 99.4], [20, 100], [4, 95], [0.2, 74], [1.2, 50], [0.2, 26], [4, 5], [20, 0]];

/** A horizontal edge that tiles: low waves along the bottom of a 400x24 band (filled above). */
function wave(seed) {
  const r = rng(seed), W = 400, H = 24, k = [1, 2, 3].map(f => ({ f, a: (0.9 + r()) * (4 / f), p: r() * Math.PI * 2 }));
  const y = x => 12 + k.reduce((s, { f, a, p }) => s + a * Math.sin((x / W) * Math.PI * 2 * f + p), 0) * 0.55;
  let d = `M0 0H${W}V${r1(y(W))}`;
  for (let x = W; x >= 0; x -= 10) d += `L${x} ${r1(y(x))}`;
  return uri(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><path d='${d}Z'/></svg>`);
}
/** A torn paper edge that tiles: small irregular teeth along the bottom of a 240x10 band. */
function deckle(seed) {
  const r = rng(seed), W = 240, H = 10;
  const ys = Array.from({ length: W / 4 + 1 }, (_, i) => (i === 0 || i === W / 4 ? 5 : 3.2 + r() * 4.6));
  let d = `M0 0H${W}`;
  for (let i = ys.length - 1; i >= 0; i--) d += `L${i * 4} ${r1(ys[i])}`;
  return uri(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><path d='${d}Z'/></svg>`);
}
/** Paper fibre: fractal noise in the ink's brown, faint (multiply it over a fill). */
const grain = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' seed='7' stitchTiles='stitch'/>
  <feColorMatrix values='0 0 0 0 0.36 0 0 0 0 0.29 0 0 0 0 0.21 0 0 0 0.55 -0.2'/></filter><rect width='160' height='160' filter='url(#g)'/></svg>`);
/** The shop paper: soft rounded squares tumbling across a butter field (our take on the kit's background). */
function confetti(seed) {
  const r = rng(seed), W = 220, N = 5, cell = W / N, out = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { // one per cell of a staggered grid, jittered: even, never clumped
    const x = (i + 0.2 + r() * 0.6) * cell, y = ((j + 0.2 + r() * 0.6) * cell + (i % 2) * cell / 2) % W, s = 11 + r() * 5, a = r() * 90, c = ["#fff3b0", "#f7ec9a", "#fbe98c"][Math.floor(r() * 3)];
    for (const [dx, dy] of [[0, 0], [-W, 0], [W, 0], [0, -W], [0, W]]) // wrap so the tile repeats seamlessly
      if (x + dx > -s && x + dx < W + s && y + dy > -s && y + dy < W + s) out.push(`<rect x='${r1(x + dx - s / 2)}' y='${r1(y + dy - s / 2)}' width='${r1(s)}' height='${r1(s)}' rx='4' fill='${c}' transform='rotate(${r1(a)} ${r1(x + dx)} ${r1(y + dy)})'/>`);
  }
  return uri(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${W}'>${out.join("")}</svg>`);
}

const block = [
  "  /* Painted by scripts/gui-paper.mjs (seeded; rerun to regenerate). Masks: the shape is where the mask is opaque. */",
  `  --gui-grain: ${grain};`,
  `  --gui-confetti: ${confetti(11)};`,
  `  --gui-edge-wave: ${wave(5)};`,
  `  --gui-edge-deckle: ${deckle(3)};`,
  `  --gui-blob-dialogue: ${shape(DIALOGUE, 21, 1.2)};`,
  `  --gui-blob-menu: ${shape(MENU, 34, 1.6)};`,
  `  --gui-blob-bag: ${shape(BAG, 8, 1)};`,
].join("\n");
const css = readFileSync(FILE, "utf8");
const next = css.replace(/(\/\* paper:start \*\/)[\s\S]*?(\n\s*\/\* paper:end \*\/)/, `$1\n${block}$2`);
if (next === css && !css.includes(block)) throw new Error("paper markers not found in game-tokens.css");
writeFileSync(FILE, next);
console.log(`gui-paper: ${block.length} bytes of paper written`);
