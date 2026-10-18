/**
 * The TSI lanyard laid flat for the shop's detail view (David, 2026-10-18: "have it horizontal" and "can see front and
 * back"): its two strands as two horizontal runs, one above the other, joined by the neck fold on the left and sewn into
 * the tab on the right (where the D-ring and the snap hook hang). One strand lies flipped, so the outside print
 * (GENESIS / TETHOS / the mark) reads along the top run and the inside quote along the bottom one, both left to right.
 * Each run carries the other print on its back, set so that turned over (half a turn about the horizontal axis) the
 * runs swap places and read left to right again: the rest of the quote, and the outside of the other strand.
 *
 * Model units of 10 cm (the strap 2 cm wide). The print is art/merch/lanyard_atlas.py's atlas: each side resampled to
 * 4590 x 102 (the strap end to end) and cut into rows 1024 long, the outside in rows 0-4 and the inside in rows 5-9;
 * UVs are glTF's (v down from the image's top), as the GLB's own texture is loaded.
 */
export const STRAP_W = 0.2, STRAP_L = 9.0;
export const ATLAS = 1024, ROW = 102, SIDE_PX = 45 * ROW;
/** The runs: centres this far above and below the middle; straight for RUN_L, then in to the tab over CONVERGE_L. */
export const RUN_Y = 0.125, RUN_L = 4.0, CONVERGE_L = 0.35, TAB_L = 0.2;
/** Where the D-ring's bar is (the tab's end), and the whole lay's extent along x. */
export const BAR_X = RUN_L + CONVERGE_L + TAB_L;
export const LAY_X0 = -RUN_Y - STRAP_W / 2, LAY_X1 = BAR_X + 0.47;
/** The plain navy below the rows (for the fold and the edges). */
export const NAVY_UV: [number, number] = [0.5, 1022 / ATLAS];

export type Side = "outside" | "inside";
/** A point of the print: s along the strap (0..STRAP_L), across from the file's top edge (0) to its bottom (1). */
export function printUv(side: Side, s: number, across: number, row?: number): [number, number] {
  const x = Math.min(SIDE_PX - 1e-3, Math.max(0, (s / STRAP_L) * SIDE_PX));
  const r = row ?? Math.min(4, Math.floor(x / ATLAS));
  return [(x - r * ATLAS) / ATLAS, (((side === "inside" ? 5 : 0) + r) * ROW + across * ROW) / ATLAS];
}

/** The s values a run samples between s0 and s1: every `step`, and exactly at each atlas row's start. */
export function runSamples(s0: number, s1: number, step = 0.05): number[] {
  const out = new Set<number>();
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) out.add(s0 + ((s1 - s0) * i) / n);
  for (let r = 1; r < 5; r++) { const b = (r * ATLAS * STRAP_L) / SIDE_PX; if (b > s0 && b < s1) out.add(b); }
  return [...out].sort((a, b) => a - b);
}

export interface Run { s0: number; s1: number; y: number; front: Side; back: Side; z: number }
/** The default lay: the top run the second strand's outside, the bottom run the first strand's inside (the quote's
 * start); their backs the other prints. */
export const RUNS: readonly Run[] = [
  { s0: 4.55, s1: 8.95, y: RUN_Y, front: "outside", back: "inside", z: 0.0015 },
  { s0: 0.05, s1: 4.45, y: -RUN_Y, front: "inside", back: "outside", z: -0.0015 },
];

/** A run's centre at t (0 at the neck end, 1 at the tab), straight then easing in to the middle. */
function runPath(run: Run, t: number): [number, number] {
  const total = RUN_L + CONVERGE_L + TAB_L, d = t * total;
  if (d <= RUN_L) return [d, run.y];
  const k = Math.min(1, (d - RUN_L) / CONVERGE_L), e = k * k * (3 - 2 * k);
  return [d, run.y * (1 - e) + Math.sign(run.y) * 0.004 * e];
}

export interface Lay { position: Float32Array; normal: Float32Array; uv: Float32Array; index: Uint32Array }
/** The strap laid flat: both runs (front and back faces) and the neck fold, one mesh. */
export function flatLay(): Lay {
  const P: number[] = [], N: number[] = [], U: number[] = [], I: number[] = [];
  const vert = (x: number, y: number, z: number, nz: number, uv: [number, number]) => { P.push(x, y, z); N.push(0, 0, nz); U.push(uv[0], uv[1]); return P.length / 3 - 1; };
  const T = 0.002;
  for (const run of RUNS) {
    const ss = runSamples(run.s0, run.s1);
    // each segment between two samples: its atlas row is its middle's (no segment crosses a row's start)
    for (let i = 0; i < ss.length - 1; i++) {
      const a = ss[i], b = ss[i + 1], mid = (a + b) / 2;
      const row = Math.min(4, Math.floor(((mid / STRAP_L) * SIDE_PX) / ATLAS));
      const [xa, ya] = runPath(run, (a - run.s0) / (run.s1 - run.s0)), [xb, yb] = runPath(run, (b - run.s0) / (run.s1 - run.s0));
      for (const face of ["front", "back"] as const) {
        const nz = face === "front" ? 1 : -1, z = run.z + nz * T;
        const side = face === "front" ? run.front : run.back;
        // the front reads with the file's top edge up; the back with it down (upright once turned over)
        const top = face === "front" ? 0 : 1;
        const q = [
          vert(xa, ya + STRAP_W / 2, z, nz, printUv(side, a, top, row)), vert(xb, yb + STRAP_W / 2, z, nz, printUv(side, b, top, row)),
          vert(xb, yb - STRAP_W / 2, z, nz, printUv(side, b, 1 - top, row)), vert(xa, ya - STRAP_W / 2, z, nz, printUv(side, a, 1 - top, row)),
        ];
        if (face === "front") I.push(q[0], q[3], q[1], q[1], q[3], q[2]); else I.push(q[0], q[1], q[3], q[1], q[2], q[3]);
      }
    }
  }
  // the neck fold: a half ring joining the runs' left ends, plain navy both faces
  const segs = 12, r0 = RUN_Y - STRAP_W / 2, r1 = RUN_Y + STRAP_W / 2;
  for (const nz of [1, -1]) {
    const ring: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const ang = Math.PI / 2 + (Math.PI * i) / segs, c = Math.cos(ang), s = Math.sin(ang);
      ring.push([vert(c * r0, s * r0, nz * T, nz, NAVY_UV), vert(c * r1, s * r1, nz * T, nz, NAVY_UV)]);
    }
    for (let i = 0; i < segs; i++) {
      const [a0, a1] = ring[i], [b0, b1] = ring[i + 1];
      if (nz > 0) I.push(a0, a1, b0, b0, a1, b1); else I.push(a0, b0, a1, b0, b1, a1);
    }
  }
  return { position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(U), index: new Uint32Array(I) };
}
