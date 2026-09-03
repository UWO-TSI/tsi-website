"use client";

/**
 * RoadTiles (P2 polish 2026-07-13) — the real ACNH road system.
 *
 * Replaces the painted alpha-ribbon paths with the actual road tile
 * geometry from the dump (Terrain/unit-road-*): 0.89u grid cells
 * auto-tiled over the corridor rectangles with marching-squares
 * variants — plain interior (4-a), soft-wobble edge (1-a, soft side +Z at
 * rot 0), rounded outer corner (2-b, spanning +Z/-X at rot 0). Layout and
 * rotation conventions were locked visually in the tile harness.
 *
 * One InstancedMesh per variant per zone material — the whole network is
 * ~14 draw calls. Everything is static: built once in useMemo.
 *
 * Zones (Beach Cove 2026-07-14): the plaza around the main crossing is
 * STONE, the spur to the south-east beach is SAND ending in a WOOD deck
 * pad, everything else soil — the ACNH village pattern. Neighbor checks
 * stay global so materials transition tile-to-tile without gaps.
 *
 * The N-S spine splits at the river banks (the bridge deck owns the
 * crossing), mirroring the Path split from 47edb40.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getTerrainHeight } from "./terrain";

const CELL = 0.89; // one ACNH road unit (8.9 raw) at world scale 0.1
const SCALE = 0.1;

// Corridor rectangles in world XZ — keep in sync with PATH_CORRIDORS in
// terrain.ts (same extents; spine split at the river like the old Path).
const RECTS = [
  { x0: -1.75, x1: 1.75, z0: -24, z1: -1.1 },
  { x0: -1.75, x1: 1.75, z0: 5.9, z1: 27 },
  { x0: -26, x1: 26, z0: 8.25, z1: 11.75 },
  { x0: -17, x1: 17, z0: -14.75, z1: -11.25 },
  // Beach Cove spur: east off the south spine, then south to the shore.
  { x0: 1.2, x1: 20, z0: 22, z1: 25.5 },
  { x0: 16.5, x1: 20, z0: 25.5, z1: 40 },
  // Beach deck pad (wood zone) at the sand line.
  { x0: 15.6, x1: 21, z0: 39.9, z1: 44.2 },
];

type Variant = "interior" | "edge" | "corner" | "cap";
export type RoadZone = "soil" | "stone" | "sand" | "wood";
type Zone = RoadZone;
export interface RoadRect { x0: number; x1: number; z0: number; z1: number }
export interface RoadConfig {
  rects: RoadRect[];
  zoneAt: (x: number, z: number) => Zone;
  /** Inclusive cell index ranges swept by the auto-tiler. */
  grid: { gx: [number, number]; gz: [number, number] };
  heightAt: (x: number, z: number) => number;
}

const ZONE_URLS: Record<Zone, Record<Variant, string>> = {
  soil: {
    interior: "/assets/acnh/road/4-a.glb",
    edge: "/assets/acnh/road/1-a.glb",
    corner: "/assets/acnh/road/2-b.glb",
    cap: "/assets/acnh/road/0-a.glb",
  },
  stone: {
    interior: "/assets/acnh/road/stone-4-a.glb",
    edge: "/assets/acnh/road/stone-1-a.glb",
    corner: "/assets/acnh/road/stone-2-b.glb",
    cap: "/assets/acnh/road/stone-0-a.glb",
  },
  sand: {
    interior: "/assets/acnh/road/sand-4-a.glb",
    edge: "/assets/acnh/road/sand-1-a.glb",
    corner: "/assets/acnh/road/sand-2-b.glb",
    cap: "/assets/acnh/road/sand-0-a.glb",
  },
  wood: {
    interior: "/assets/acnh/road/wood-4-a.glb",
    edge: "/assets/acnh/road/wood-1-a.glb",
    corner: "/assets/acnh/road/wood-2-b.glb",
    cap: "/assets/acnh/road/wood-0-a.glb",
  },
};
const ZONES = Object.keys(ZONE_URLS) as Zone[];
const VARIANTS: Variant[] = ["interior", "edge", "corner", "cap"];
for (const z of ZONES) Object.values(ZONE_URLS[z]).forEach((u) => useGLTF.preload(u));

// Untextured kit tiles take a flat tint (roads ship 0.8-gray).
const ZONE_COLORS: Record<Zone, string> = {
  soil: "#C9A66B",
  stone: "#B9B4A8",
  sand: "#E7D3A0",
  wood: "#B5885C",
};

// Path-texture pass (2026-07-14, David: "path texture needs tuning"):
// per-zone procedural detail canvases — the kit UVs span each tile, so
// the pattern repeats per tile. Deterministic; module-cached. Values
// stay near-white to modulate ZONE_COLORS, same trick as the grass quilt.
const _zoneTex: Partial<Record<Zone, THREE.CanvasTexture>> = {};
function getZoneTexture(zone: Zone): THREE.CanvasTexture {
  const cached = _zoneTex[zone];
  if (cached) return cached;
  const S = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  let seed = 811 + zone.length * 37;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (zone === "soil") {
    // warm speckle: scattered darker grains
    for (let i = 0; i < 260; i++) {
      const v = 225 + Math.floor(rnd() * 22);
      ctx.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + (rnd() < 0.25 ? 1 : 0), 1);
    }
  } else if (zone === "stone") {
    // mottled patches + faint joint cracks
    for (let i = 0; i < 26; i++) {
      const v = 235 + Math.floor(rnd() * 18);
      ctx.fillStyle = `rgba(${v},${v},${v - 4},0.55)`;
      const r = 4 + rnd() * 8;
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(180,176,168,0.6)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(rnd() * S, rnd() * S);
      ctx.lineTo(rnd() * S, rnd() * S);
      ctx.stroke();
    }
  } else if (zone === "sand") {
    // fine grain + a few darker shell dots
    for (let i = 0; i < 420; i++) {
      const v = 236 + Math.floor(rnd() * 18);
      ctx.fillStyle = `rgb(${v},${v - 2},${v - 8})`;
      ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "rgba(190,170,140,0.8)";
      ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 2, 2);
    }
  } else {
    // wood: four planks with grain + gap lines
    const plank = S / 4;
    for (let p = 0; p < 4; p++) {
      const base = 232 + Math.floor(rnd() * 16);
      ctx.fillStyle = `rgb(${base},${base - 8},${base - 20})`;
      ctx.fillRect(p * plank, 0, plank, S);
      ctx.strokeStyle = `rgba(150,110,70,0.35)`;
      for (let g = 0; g < 3; g++) {
        const gx = p * plank + 2 + rnd() * (plank - 4);
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 2, S * 0.3, gx - 2, S * 0.7, gx, S);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(120,90,60,0.65)";
      ctx.fillRect(p * plank, 0, 1, S);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _zoneTex[zone] = tex;
  return tex;
}

const PLAZA = { x0: -5.4, x1: 5.4, z0: -16.6, z1: -9.4 };
const SAND_RECTS = [RECTS[4], RECTS[5]];
const WOOD_PAD = RECTS[6];
const inRect = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) =>
  x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

function zoneAt(x: number, z: number): Zone {
  if (inRect(WOOD_PAD, x, z)) return "wood";
  if (SAND_RECTS.some((r) => inRect(r, x, z))) return "sand";
  if (inRect(PLAZA, x, z)) return "stone";
  return "soil";
}

// The member island's network (default). Other scenes pass their own.
const MAIN_ISLAND: RoadConfig = {
  rects: RECTS,
  zoneAt,
  grid: { gx: [-32, 32], gz: [-30, 50] },
  heightAt: getTerrainHeight,
};

function mergedGeometry(scene: THREE.Group): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const cl = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(cl.attributes)) {
        if (!["position", "normal", "uv"].includes(k)) cl.deleteAttribute(k);
      }
      geos.push(cl);
    }
  });
  return mergeGeometries(geos, false) ?? geos[0];
}

interface Placement { x: number; z: number; rot: number }

function computePlacements(zone: Zone, cfg: RoadConfig): Record<Variant, Placement[]> {
  const isRoad = (x: number, z: number) => cfg.rects.some((r) => inRect(r, x, z));
  const out: Record<string, Placement[]> = { interior: [], edge: [], corner: [], cap: [] };
  for (let gx = cfg.grid.gx[0]; gx <= cfg.grid.gx[1]; gx++) {
    for (let gz = cfg.grid.gz[0]; gz <= cfg.grid.gz[1]; gz++) {
      // half-cell offset: corridors span an even tile count symmetrically
      const cx = (gx + 0.5) * CELL;
      const cz = (gz + 0.5) * CELL;
      if (!isRoad(cx, cz)) continue;
      if (cfg.zoneAt(cx, cz) !== zone) continue;
      const n = isRoad(cx, cz + CELL);
      const s = isRoad(cx, cz - CELL);
      const e = isRoad(cx - CELL, cz);
      const w = isRoad(cx + CELL, cz);
      const missing = [!n, !s, !e, !w].filter(Boolean).length;
      let kind: Variant = "interior";
      let rot = 0;
      if (missing === 1) {
        kind = "edge";
        rot = !n ? 0 : !s ? Math.PI : !w ? Math.PI / 2 : -Math.PI / 2;
      } else if (missing === 2) {
        if ((!n && !s) || (!e && !w)) {
          kind = "interior"; // opposite-sided exposure never happens at 4-wide
        } else {
          kind = "corner";
          rot = !n && !e ? 0 : !n && !w ? Math.PI / 2 : !s && !w ? Math.PI : -Math.PI / 2;
        }
      } else if (missing >= 3) {
        kind = "cap";
      }
      out[kind].push({ x: cx, z: cz, rot });
    }
  }
  return out as Record<Variant, Placement[]>;
}

export default function RoadTiles({ config = MAIN_ISLAND }: { config?: RoadConfig } = {}) {
  const soilI = useGLTF(ZONE_URLS.soil.interior).scene;
  const soilE = useGLTF(ZONE_URLS.soil.edge).scene;
  const soilC = useGLTF(ZONE_URLS.soil.corner).scene;
  const soilK = useGLTF(ZONE_URLS.soil.cap).scene;
  const stoneI = useGLTF(ZONE_URLS.stone.interior).scene;
  const stoneE = useGLTF(ZONE_URLS.stone.edge).scene;
  const stoneC = useGLTF(ZONE_URLS.stone.corner).scene;
  const stoneK = useGLTF(ZONE_URLS.stone.cap).scene;
  const sandI = useGLTF(ZONE_URLS.sand.interior).scene;
  const sandE = useGLTF(ZONE_URLS.sand.edge).scene;
  const sandC = useGLTF(ZONE_URLS.sand.corner).scene;
  const sandK = useGLTF(ZONE_URLS.sand.cap).scene;
  const woodI = useGLTF(ZONE_URLS.wood.interior).scene;
  const woodE = useGLTF(ZONE_URLS.wood.edge).scene;
  const woodC = useGLTF(ZONE_URLS.wood.corner).scene;
  const woodK = useGLTF(ZONE_URLS.wood.cap).scene;

  const meshes = useMemo(() => {
    const scenes: Record<Zone, Record<Variant, THREE.Group>> = {
      soil: { interior: soilI, edge: soilE, corner: soilC, cap: soilK },
      stone: { interior: stoneI, edge: stoneE, corner: stoneC, cap: stoneK },
      sand: { interior: sandI, edge: sandE, corner: sandC, cap: sandK },
      wood: { interior: woodI, edge: woodE, corner: woodC, cap: woodK },
    };
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(SCALE, SCALE, SCALE);
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const result: THREE.InstancedMesh[] = [];
    for (const zone of ZONES) {
      const placements = computePlacements(zone, config);
      const mat = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS[zone],
        map: getZoneTexture(zone),
        roughness: 0.9,
        metalness: 0,
      });
      for (const kind of VARIANTS) {
        const list = placements[kind];
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(mergedGeometry(scenes[zone][kind]), mat, list.length);
        list.forEach((t, i) => {
          q.setFromAxisAngle(up, t.rot);
          p.set(t.x, config.heightAt(t.x, t.z) + 0.02, t.z);
          m4.compose(p, q, sc);
          im.setMatrixAt(i, m4);
        });
        im.receiveShadow = true; // P-light v2: roads catch the sun shadows
        im.instanceMatrix.needsUpdate = true;
        result.push(im);
      }
    }
    return result;
  }, [config, soilI, soilE, soilC, soilK, stoneI, stoneE, stoneC, stoneK, sandI, sandE, sandC, sandK, woodI, woodE, woodC, woodK]);

  return (
    <group>
      {meshes.map((im, i) => (
        <primitive key={i} object={im} />
      ))}
    </group>
  );
}
