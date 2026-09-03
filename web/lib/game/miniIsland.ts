// The applicant island (David, 2026-09-02): one small round island whose
// only purpose is the student application portal. Spawn at the south end
// of a single stone road, walk north to Tethos HQ, apply inside.
//
// Everything about the island's shape lives here so the scene, the
// player clamp, the road tiler and the minimap-free HUD all agree. Flat
// ground (height 0) inside the grass disc, a sunken sand ring past it, and
// the water plane crossing that ring at SHORE_RADIUS.

import type { RoadConfig, RoadRect } from "@/components/game/RoadTiles";
import type { Position } from "@/lib/recruitment";
import type { KeeperHat } from "@/components/game/interiorShared";

/** The island's fixed hour: late afternoon, warm key, still bright. */
export const PORTAL_HOUR = 16.3;

/** Grass disc radius; sand begins just outside. */
export const GRASS_RADIUS = 21;
/** Radius where the sunken rim crosses the water plane (y = -0.55). */
export const SHORE_RADIUS = 22.8;

export const MINI_SPAWN: [number, number, number] = [0, 0, -14];
/** HQ door plane (model origin). The building extends north (+z) of it. */
export const HQ_POSITION: [number, number, number] = [0, 0, 3.4];
export const HQ_SIZE: [number, number, number] = [6.1, 4.8, 3];
/** Where the player reappears after leaving the office. */
export const HQ_EXIT_SPAWN: [number, number, number] = [0, 0, 0.6];

/** The one road: south spawn → HQ door, plus a small stone apron at the door. */
export const ROAD_RECTS: RoadRect[] = [
  { x0: -1.75, x1: 1.75, z0: -16.5, z1: 2.6 },
  { x0: -4.45, x1: 4.45, z0: 0.5, z1: 3.1 },
];

export const ROAD_CONFIG: RoadConfig = {
  rects: ROAD_RECTS,
  zoneAt: () => "stone",
  grid: { gx: [-6, 6], gz: [-20, 5] },
  heightAt: (x, z) => miniHeight(x, z),
};

/** Ground chevrons along the road, pointing north toward HQ. */
export const CHEVRONS: [number, number][] = [
  [0, -11.5],
  [0, -9],
  [0, -6.5],
  [0, -4],
  [0, -1.5],
];

/** Where the player may walk: the road and the door apron. */
const WALK_RECTS: RoadRect[] = [
  { x0: -1.6, x1: 1.6, z0: -16, z1: 2.6 },
  { x0: -4.2, x1: 4.2, z0: 0.4, z1: 2.7 },
];

export function miniHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= GRASS_RADIUS) return 0;
  const t = (r - GRASS_RADIUS) / 4;
  return -Math.min(t * t * 2.6, 3.2);
}

/** Radial fallback when something asks for a coast clamp. */
export function clampToIsland(x: number, z: number): [number, number] {
  const limit = GRASS_RADIUS - 0.8;
  const r = Math.hypot(x, z);
  if (r <= limit) return [x, z];
  return [(x / r) * limit, (z / r) * limit];
}

/** Snap a point into the nearest walkable rectangle. */
export function clampToRoad(x: number, z: number): [number, number] {
  let best: [number, number] = [x, z];
  let bestD = Infinity;
  for (const r of WALK_RECTS) {
    const cx = Math.min(Math.max(x, r.x0), r.x1);
    const cz = Math.min(Math.max(z, r.z0), r.z1);
    const d = Math.hypot(cx - x, cz - z);
    if (d === 0) return [x, z];
    if (d < bestD) {
      bestD = d;
      best = [cx, cz];
    }
  }
  return best;
}

// ─── Recruitment Office ────────────────────────────────────────────

export interface Recruiter {
  name: string;
  title: string;
  hat: KeeperHat;
  colors: { apron: string; shirt: string };
  greeting: string;
}

const RECRUITERS: Record<string, Recruiter> = {
  "vp-marketing": {
    name: "Mara",
    title: "Marketing lead",
    hat: "bun",
    colors: { apron: "#C2557A", shirt: "#FFF3E6" },
    greeting: "You make things people stop scrolling for? Sit. Let's talk.",
  },
  pm: {
    name: "Theo",
    title: "Projects lead",
    hat: "cap",
    colors: { apron: "#3E6FA6", shirt: "#F1FFFF" },
    greeting: "Seven nonprofit teams ship this year. One of them could be yours.",
  },
};

const DEFAULT_RECRUITER: Recruiter = {
  name: "Recruiter",
  title: "Tethos exec team",
  hat: "none",
  colors: { apron: "#4E7A52", shirt: "#FFF8EE" },
  greeting: "Welcome in. Take a look at the role and apply when you're ready.",
};

export function recruiterFor(slug: string): Recruiter {
  return RECRUITERS[slug] ?? DEFAULT_RECRUITER;
}

export interface Desk {
  position: Position;
  recruiter: Recruiter;
  /** Desk x in room space; desks sit on one row at DESK_Z. */
  x: number;
}

export const DESK_Z = 2.4;

/** Lay the open roles out on one row, centred, evenly spaced. */
export function layoutDesks(positions: Position[]): Desk[] {
  const n = positions.length;
  const spacing = n <= 2 ? 6.8 : n === 3 ? 4.8 : 3.6;
  return positions.map((position, i) => ({
    position,
    recruiter: recruiterFor(position.slug),
    x: (i - (n - 1) / 2) * spacing,
  }));
}
