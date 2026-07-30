"use client";

/**
 * /lab/map — the tile editor (M6).
 *
 * WHY THIS EXISTS. Six of the last eight terrain changes were David describing
 * what he wanted and me guessing at numbers in `author-elevation.mjs`: "less
 * hills", "too vertical", "half steps should blend", each one a round trip
 * through a script, a regenerate and a screenshot. This turns that into
 * drawing.
 *
 * It edits the SHIPPED map, not a copy of the authoring script's inputs, so
 * what you paint is what loads. Export puts the whole `island-map.json` on the
 * clipboard, following the "Export all → clipboard" convention already in
 * `components/lab/LabPanel.tsx` — no API route, no write path to disk, which
 * keeps a dev tool from being able to corrupt the world.
 *
 * THE CHECKS ARE THE POINT. A hand-painted map breaks in ways that are invisible
 * until you walk it: an unreachable terrace, a cliff with no piece, a one-cell
 * wall. Those all cost real debugging this week, so they run live in the panel
 * on every edit rather than at the end.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IslandMapDoc } from "@/lib/game/grid";
import islandMapDoc from "@/data/island-map.json";
import {
  parseIslandMap,
  serialiseIslandMap,
  setCell,
  levelAt,
  surfaceAt,
  isVoid,
  isRiver,
  isRamp,
  needsCliff,
  cliffPieceFor,
  rampDir,
  halfCliffEdges,
  Surface,
  MAX_LEVEL,
  CLIFF_LEVELS,
  ORTHOGONAL,
  inBounds,
  type IslandMap,
  type PlacedProp,
} from "@/lib/game/grid";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Cell colours, close enough to the world's own palette to read as the map. */
const SURFACE_FILL: Record<number, string> = {
  [Surface.Grass]: "#8FA16C",
  [Surface.Soil]: "#BA9664",
  [Surface.Stone]: "#B0ACA6",
  [Surface.Sand]: "#E2CB93",
  [Surface.Wood]: "#A0784E",
  [Surface.Brick]: "#BA7A68",
  [Surface.River]: "#4A85A8",
  [Surface.Void]: "#1b2733",
  [Surface.Ramp]: "#D8CFC0",
};

const SURFACE_NAME: Record<number, string> = {
  [Surface.Grass]: "grass",
  [Surface.Soil]: "soil",
  [Surface.Stone]: "stone",
  [Surface.Sand]: "sand",
  [Surface.Wood]: "wood",
  [Surface.Brick]: "brick",
  [Surface.River]: "river",
  [Surface.Void]: "sea",
  [Surface.Ramp]: "ramp",
};

type Tool = "raise" | "lower" | "surface" | "ramp";

interface Health {
  reachable: number;
  walkable: number;
  stranded: number;
  cliffCells: number;
  missingPiece: number;
  thinWalls: number;
  orphanRamps: number;
  tooTall: number;
  levels: Record<number, number>;
}

/**
 * Every check that cost real debugging this week, run on the live map.
 *
 * Reachability is the one that matters most and the one nothing else surfaces:
 * with hard cliffs a terrace can be perfectly drawn and simply unreachable, and
 * the only symptom is a player who cannot get there.
 */
function measure(map: IslandMap): Health {
  const W = map.width;
  const D = map.depth;
  const walkAt = (x: number, z: number) =>
    inBounds(map, x, z) && !isVoid(surfaceAt(map, x, z)) && !isRiver(surfaceAt(map, x, z));

  let walkable = 0;
  let cliffCells = 0;
  let missingPiece = 0;
  let thinWalls = 0;
  let orphanRamps = 0;
  let tooTall = 0;
  const levels: Record<number, number> = {};
  let seed: [number, number] | null = null;

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (isVoid(surfaceAt(map, x, z))) continue;
      const l = levelAt(map, x, z);
      levels[l] = (levels[l] ?? 0) + 1;
      if (walkAt(x, z)) {
        walkable++;
        if (!seed && l === 0) seed = [x, z];
      }
      if (needsCliff(map, x, z)) {
        cliffCells++;
        if (!cliffPieceFor(map, x, z)) missingPiece++;
      }
      if (isRamp(surfaceAt(map, x, z)) && !rampDir(map, x, z)) orphanRamps++;
      // The cliff kit is one piece tall and does not stack, so a face taller
      // than CLIFF_LEVELS has nothing to draw it and renders as a hole. The
      // authoring script enforces this; a hand edit can break it in one click.
      for (const [dx, dz] of ORTHOGONAL) {
        if (!inBounds(map, x + dx, z + dz)) continue;
        const ns = surfaceAt(map, x + dx, z + dz);
        const nl = isVoid(ns) ? 0 : levelAt(map, x + dx, z + dz);
        if (Math.abs(l - nl) > CLIFF_LEVELS) tooTall++;
      }
      // A raised cell with lower ground on both sides of an axis is a wall you
      // cannot stand on.
      const lower = (dx: number, dz: number) =>
        walkAt(x + dx, z + dz) && levelAt(map, x + dx, z + dz) < l;
      if (l > 0 && ((lower(-1, 0) && lower(1, 0)) || (lower(0, -1) && lower(0, 1)))) thinWalls++;
    }
  }

  let reachable = 0;
  if (seed) {
    const seen = new Uint8Array(W * D);
    const stack: [number, number][] = [seed];
    while (stack.length) {
      const [x, z] = stack.pop()!;
      const i = z * W + x;
      if (seen[i] || !walkAt(x, z)) continue;
      seen[i] = 1;
      reachable++;
      for (const [dx, dz] of ORTHOGONAL) {
        const nx = x + dx;
        const nz = z + dz;
        if (!walkAt(nx, nz)) continue;
        const d = Math.abs(levelAt(map, nx, nz) - levelAt(map, x, z));
        const viaRamp = isRamp(surfaceAt(map, nx, nz)) || isRamp(surfaceAt(map, x, z));
        // A blended half step is walkable; a full cliff needs a ramp.
        if (d < CLIFF_LEVELS || viaRamp) stack.push([nx, nz]);
      }
    }
  }

  return {
    reachable,
    walkable,
    stranded: walkable - reachable,
    cliffCells,
    missingPiece,
    thinWalls,
    orphanRamps,
    tooTall,
    levels,
  };
}

/**
 * The map lives at module scope, not in state.
 *
 * Editing mutates the typed arrays in place — copying 16k cells per brush dab
 * would be pointless — and the react-compiler lint (correctly) forbids mutating
 * anything that came out of useState or useMemo. So the working copy sits here
 * and `version` is what React actually re-renders on.
 */
let WORLD: { map: IslandMap; props: PlacedProp[] } | null = null;
function world() {
  if (!WORLD) WORLD = parseIslandMap(islandMapDoc as IslandMapDoc);
  return WORLD;
}

export default function MapLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { map, props } = world();
  const [tool, setTool] = useState<Tool>("raise");
  const [brush, setBrush] = useState(3);
  const [paintSurface, setPaintSurface] = useState<number>(Surface.Grass);
  const [zoom, setZoom] = useState(7);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(0);
  const painting = useRef(false);

  // Keyed on version, so hovering a cell does not re-run a 16k flood fill.
  // `version` looks unnecessary to the linter because the mutation it stands for
  // happens inside `map`'s typed arrays, which it cannot see. It is the key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const health = useMemo(() => measure(map), [map, version]);

  /**
   * Redraw everything. Fine at 128x128: the whole grid is 16k fills and a
   * repaint lands well inside a frame, so there is no reason for the complexity
   * of a dirty-rect scheme in a dev tool.
   */
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = map.width;
    const D = map.depth;
    cv.width = W * zoom;
    cv.height = D * zoom;
    ctx.imageSmoothingEnabled = false;

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const s = surfaceAt(map, x, z);
        const l = levelAt(map, x, z);
        ctx.fillStyle = SURFACE_FILL[s] ?? "#f0f";
        ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        // Level as brightness: higher ground reads lighter, which is the only
        // way to see elevation on a flat map. Tuned against a screenshot, not
        // guessed -- at 0.10 per level the level-2 plateaus were the same green
        // as the level-0 ground and the map read as flat.
        if (!isVoid(s) && l > 0) {
          ctx.fillStyle = `rgba(255,247,225,${Math.min(0.5, 0.17 * l)})`;
          ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        }
      }
    }

    // Cliff and half-step edges, drawn as the lines they will become.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (isVoid(surfaceAt(map, x, z))) continue;
        const full = needsCliff(map, x, z);
        for (const [dx, dz] of ORTHOGONAL) {
          if (!inBounds(map, x + dx, z + dz)) continue;
          const d = levelAt(map, x, z) - levelAt(map, x + dx, z + dz);
          if (d <= 0) continue;
          // Half steps get their own colour, not a fainter version of the cliff
          // line. They are the thing being tuned -- rare, blended, for
          // naturalness -- so "where are they and how many" has to be answerable
          // at a glance, and a 1px brown line at zoom 5 was not.
          ctx.strokeStyle = d >= CLIFF_LEVELS ? "#20140c" : "#e8a13c";
          ctx.lineWidth = d >= CLIFF_LEVELS ? Math.max(1.5, zoom * 0.3) : Math.max(1, zoom * 0.2);
          ctx.beginPath();
          const x0 = (x + (dx > 0 ? 1 : 0)) * zoom;
          const z0 = (z + (dz > 0 ? 1 : 0)) * zoom;
          if (dx !== 0) {
            ctx.moveTo(x0, z * zoom);
            ctx.lineTo(x0, (z + 1) * zoom);
          } else {
            ctx.moveTo(x * zoom, z0);
            ctx.lineTo((x + 1) * zoom, z0);
          }
          ctx.stroke();
        }
        if (full && !cliffPieceFor(map, x, z)) {
          ctx.fillStyle = "#ff0055";
          ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        }
      }
    }

    // Ramps: an arrow up the climb, so a mis-oriented one is obvious.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (!isRamp(surfaceAt(map, x, z))) continue;
        const dir = rampDir(map, x, z);
        ctx.fillStyle = dir ? "#2b7fff" : "#ff0055";
        ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        if (dir) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = Math.max(1, zoom * 0.18);
          ctx.beginPath();
          const cx = (x + 0.5) * zoom;
          const cz = (z + 0.5) * zoom;
          ctx.moveTo(cx - dir[0] * zoom * 0.35, cz - dir[1] * zoom * 0.35);
          ctx.lineTo(cx + dir[0] * zoom * 0.35, cz + dir[1] * zoom * 0.35);
          ctx.stroke();
        }
      }
    }

    for (const p of props) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(p.cell[0] * zoom + zoom * 0.3, p.cell[1] * zoom + zoom * 0.3, zoom * 0.4, zoom * 0.4);
    }

    if (hover) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      const r = brush - 1;
      ctx.strokeRect(
        (hover.x - r) * zoom + 0.5,
        (hover.z - r) * zoom + 0.5,
        (r * 2 + 1) * zoom - 1,
        (r * 2 + 1) * zoom - 1
      );
    }
  }, [map, props, zoom, hover, brush]);

  useEffect(() => {
    draw();
  }, [draw, version]);

  const apply = useCallback(
    (cx: number, cz: number) => {
      const r = brush - 1;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          if (!inBounds(map, x, z)) continue;
          const s = surfaceAt(map, x, z);
          if (tool === "surface") {
            setCell(map, x, z, levelAt(map, x, z), paintSurface);
          } else if (tool === "ramp") {
            if (!isVoid(s)) setCell(map, x, z, levelAt(map, x, z), Surface.Ramp);
          } else if (!isVoid(s)) {
            const d = tool === "raise" ? 1 : -1;
            const next = Math.min(MAX_LEVEL, Math.max(0, levelAt(map, x, z) + d));
            setCell(map, x, z, next, s);
          }
        }
      }
      setVersion((v) => v + 1);
    },
    [map, brush, tool, paintSurface]
  );

  const cellFrom = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      z: Math.floor((e.clientY - rect.top) / zoom),
    };
  };

  const btn = (active: boolean) => ({
    padding: "5px 11px",
    fontSize: 12,
    fontFamily: mono,
    borderRadius: 4,
    border: "1px solid #3a4148",
    background: active ? "#ffd166" : "#1c2126",
    color: active ? "#1c2126" : "#c8cfd4",
    cursor: "pointer",
  });

  // Everything `islandMap.test.ts` asserts. If the panel says healthy, pasting
  // the export over the map keeps the suite green -- that equivalence is the
  // whole contract, so a check must not be countable-but-ignored here.
  const bad =
    health.stranded > 0 ||
    health.missingPiece > 0 ||
    health.orphanRamps > 0 ||
    health.thinWalls > 0 ||
    health.tooTall > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#11151a", display: "flex", color: "#c8cfd4" }}>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <canvas
          ref={canvasRef}
          style={{ cursor: "crosshair", imageRendering: "pixelated" }}
          onMouseDown={(e) => {
            painting.current = true;
            const c = cellFrom(e);
            apply(c.x, c.z);
          }}
          onMouseUp={() => (painting.current = false)}
          onMouseLeave={() => {
            painting.current = false;
            setHover(null);
          }}
          onMouseMove={(e) => {
            const c = cellFrom(e);
            setHover(c);
            if (painting.current) apply(c.x, c.z);
          }}
        />
      </div>

      <div
        style={{
          width: 300,
          borderLeft: "1px solid #232a31",
          padding: 14,
          fontFamily: mono,
          fontSize: 12,
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 13, marginBottom: 10, color: "#ffd166" }}>/lab/map</div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
          {(["raise", "lower", "surface", "ramp"] as Tool[]).map((t) => (
            <button key={t} onClick={() => setTool(t)} style={btn(tool === t)}>
              {t}
            </button>
          ))}
        </div>

        {tool === "surface" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(SURFACE_NAME).map(([id, name]) => (
              <button
                key={id}
                onClick={() => setPaintSurface(Number(id))}
                style={{ ...btn(paintSurface === Number(id)), background: paintSurface === Number(id) ? "#ffd166" : SURFACE_FILL[Number(id)], color: "#12161a" }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <label style={{ display: "block", marginBottom: 8 }}>
          brush {brush * 2 - 1}×{brush * 2 - 1}
          <input type="range" min={1} max={8} value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ width: "100%" }} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          zoom {zoom}px
          <input type="range" min={2} max={12} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: "100%" }} />
        </label>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
          <div style={{ color: bad ? "#ff5577" : "#7fd1c0", marginBottom: 6 }}>
            {bad ? "PROBLEMS" : "healthy"}
          </div>
          <Row k="reachable" v={`${health.reachable}/${health.walkable}`} warn={health.stranded > 0} />
          <Row k="stranded" v={String(health.stranded)} warn={health.stranded > 0} />
          <Row k="cliff cells" v={String(health.cliffCells)} />
          <Row k="no kit piece" v={String(health.missingPiece)} warn={health.missingPiece > 0} />
          <Row k="orphan ramps" v={String(health.orphanRamps)} warn={health.orphanRamps > 0} />
          <Row k="1-cell walls" v={String(health.thinWalls)} warn={health.thinWalls > 0} />
          <Row k="faces too tall" v={String(health.tooTall)} warn={health.tooTall > 0} />
        </div>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
          {Object.keys(health.levels)
            .map(Number)
            .sort((a, b) => a - b)
            .map((l) => (
              <Row
                key={l}
                k={`level ${l}`}
                v={`${health.levels[l]}  ${((100 * health.levels[l]) / Math.max(1, Object.values(health.levels).reduce((a, b) => a + b, 0))).toFixed(1)}%`}
              />
            ))}
        </div>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, lineHeight: 1.7 }}>
          <Legend c="#20140c" label="full cliff (hard barrier)" />
          <Legend c="#e8a13c" label="half step (walkable, blended)" />
          <Legend c="#2b7fff" label="ramp, arrow points uphill" />
          <Legend c="#ff0055" label="broken: no kit piece or no climb" />
          <Legend c="#ffd166" label="prop" />
        </div>

        {hover && (
          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, color: "#8b949e" }}>
            <Row k="cell" v={`${hover.x}, ${hover.z}`} />
            <Row k="level" v={String(levelAt(map, hover.x, hover.z))} />
            <Row k="surface" v={SURFACE_NAME[surfaceAt(map, hover.x, hover.z)] ?? "?"} />
            <Row k="half steps" v={String(halfCliffEdges(map, hover.x, hover.z).length)} />
            <Row k="full cliff" v={needsCliff(map, hover.x, hover.z) ? "yes" : "no"} />
          </div>
        )}

        <button
          onClick={() => {
            const out = { ...islandMapDoc, ...serialiseIslandMap(map, props) };
            void navigator.clipboard.writeText(JSON.stringify(out, null, 1));
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          style={{ ...btn(false), width: "100%", padding: "9px 0", background: copied ? "#7fd1c0" : "#1c2126", color: copied ? "#12161a" : "#c8cfd4" }}
        >
          {copied ? "copied — paste into data/island-map.json" : "Export map → clipboard"}
        </button>
        <div style={{ color: "#5c6670", marginTop: 8, lineHeight: 1.5 }}>
          Paste over <code>web/data/island-map.json</code>. Re-running
          <code> author-elevation.mjs</code> overwrites hand edits.
        </div>
      </div>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {/* Outlined because the cliff swatch is near-black on a near-black panel. */}
      <span style={{ width: 11, height: 11, background: c, borderRadius: 2, flexShrink: 0, border: "1px solid #3a4148" }} />
      <span style={{ color: "#7d868e" }}>{label}</span>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span style={{ color: "#7d868e" }}>{k}</span>
      <span style={{ color: warn ? "#ff5577" : "#c8cfd4" }}>{v}</span>
    </div>
  );
}
