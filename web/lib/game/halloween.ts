/**
 * Halloween on the island (the traditions calendar, lib/content/traditions.ts): where the pumpkin lanterns stand, which
 * doors answer a knock, and the fog-night light. An event overlay: everything is placed from what the map already has
 * (its lamp posts, resident anchors and building doors) at run time and nothing is written into the map. Pure: the
 * world (components/game/Halloween.tsx), the evidence and the tests share it.
 */
import * as THREE from "three";
import { LANDMARK_INFO, landmarks, turn, type Landmark, type LandmarkId } from "./defaultIsland";
import { HOME_LANDMARKS, POST_HOME, routineKeys } from "./residentRoutine";
import { objectsOf, type Village } from "./villageMap";
import type { IslandLight } from "./islandLighting";

export const PUMPKIN_URL = "/assets/game/props/pumpkin-lantern.glb";
/** A pumpkin's body (its footprint): placements keep this clear of each other. Its carved face is the model's −z, so a
 * yaw of 0 turns it to the game's camera (which looks along +z). */
const PUMPKIN_R = 0.3;

export interface PumpkinSpot { x: number; z: number; yaw: number; scale: number; /** What it stands by. */ by: string }

const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
/** Doors a building has (the museum has none: the middle of its front). */
export function doorPoint(l: Pick<Landmark, "id" | "x" | "z" | "yaw" | "scale" | "half">): [number, number] {
  const info = LANDMARK_INFO[l.id], k = l.scale ?? 1;
  const off = info.door ?? [0, -((info.half?.[1] ?? 0) + 0.3)];
  const [dx, dz] = turn(off[0] * k, off[1] * k, l.yaw);
  return [l.x + dx, l.z + dz];
}
/** A point beside a building's door, `side` along the facade (+1: its local +x) and `out` in front, in world XZ. */
function besideDoor(l: Landmark, side: number, out: number): [number, number] {
  const info = LANDMARK_INFO[l.id], k = l.scale ?? 1;
  const off = info.door ?? [0, -((info.half?.[1] ?? 0) + 0.3)];
  const [dx, dz] = turn((off[0] + side) * k, (off[1] - out) * k, l.yaw);
  return [l.x + dx, l.z + dz];
}
/** The buildings people live in and knock at (the wharf's home is a boat: no door). */
export const DOOR_HOMES: readonly LandmarkId[] = HOME_LANDMARKS.filter(id => id !== "wharf");
/** Where a resident knocks: beside the door on its latch side, by the pumpkin there. */
export const KNOCK_SIDE = 1.05, KNOCK_OUT = 0.35;

/**
 * The pumpkins: one by each lamp post, a pair flanking each lived-in building's door (the lit pumpkin is the old sign
 * that a house hands out treats) and two at each resident anchor's edge. `standable` keeps them off water, walls and
 * props; each is turned a little and sized a little differently, the same every load.
 */
export function pumpkinSpots(v: Village, standable: (x: number, z: number) => boolean): PumpkinSpot[] {
  const out: PumpkinSpot[] = [];
  const add = (x: number, z: number, faceYaw: number, by: string) => {
    if (!standable(x, z) || out.some(p => Math.hypot(p.x - x, p.z - z) < PUMPKIN_R * 2.2)) return;
    const u = hash01(`${by}:${x.toFixed(2)}:${z.toFixed(2)}`);
    out.push({ x, z, yaw: faceYaw + (u - 0.5) * 0.7, scale: 0.85 + 0.3 * hash01(`${by}#s`), by });
  };
  for (const l of objectsOf("lamp", v)) {
    const a = hash01(l.id) * Math.PI * 2;
    add(l.x + Math.cos(a) * 0.5, l.z + Math.sin(a) * 0.5, 0, `lamp:${l.id}`);
  }
  for (const l of landmarks(v).filter(m => DOOR_HOMES.includes(m.id))) {
    const facing = l.yaw ?? 0; // the carved face (the model's −z) looks out the way the door does, the building's −z
    for (const side of [KNOCK_SIDE, -KNOCK_SIDE]) add(...besideDoor(l, side, KNOCK_OUT), facing, `door:${l.id}`);
  }
  for (const a of objectsOf("anchor", v)) for (const [dx, dz] of [[-1.3, 0.5], [1.3, -0.4]]) add(a.x + dx, a.z + dz, 0, `anchor:${a.id}`);
  return out;
}

/** What a resident's row says about their home. */
export interface DoorResident { slug: string; display_name: string; post?: string | null; schedule?: Record<string, unknown> | null }
/** The building a resident lives in (residentRoutine planResident's rule): their schedule's `home`, else their post's. */
export function homeOf(r: Pick<DoorResident, "post" | "schedule">): LandmarkId {
  const own = r.schedule?.home;
  return (typeof own === "string" && (HOME_LANDMARKS as readonly string[]).includes(own) ? own : POST_HOME[r.post ?? "villager"] ?? "hq") as LandmarkId;
}
/** A knockable door: where you stand to knock, and who's behind it at night (in the order they answer). */
export interface KnockDoor { home: LandmarkId; x: number; z: number; residents: { slug: string; name: string }[] }
/** The doors with someone home at night: each resident whose night routine takes them home, at their building's door. */
export function knockDoors(v: Village, residents: readonly DoorResident[]): KnockDoor[] {
  const placed = new Map(landmarks(v).map(l => [l.id, l]));
  const doors = new Map<LandmarkId, KnockDoor>();
  for (const r of residents) {
    if (!routineKeys(r.schedule ?? null, "night").includes("home")) continue;
    const home = homeOf(r), l = placed.get(home);
    if (!l || !DOOR_HOMES.includes(home)) continue;
    let d = doors.get(home);
    if (!d) { const [x, z] = besideDoor(l, KNOCK_SIDE, KNOCK_OUT); doors.set(home, d = { home, x, z, residents: [] }); }
    d.residents.push({ slug: r.slug, name: r.display_name });
  }
  return [...doors.values()];
}
/** The next resident behind a door who hasn't answered you tonight, or null. */
export const nextAnswer = (d: KnockDoor, treated: ReadonlySet<string>) => d.residents.find(r => !treated.has(r.slug)) ?? null;

// ── Fog nights ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The fog nights' tint: a cool blue-grey haze drawn in close, and a colder moon. */
export const FOG_NIGHT = { fog: "#3d4a5e", moon: "#9ab6ff", mist: "#6d7f99", near: 0.45, far: 0.6, moonDim: 0.85 };
const _a = new THREE.Color(), _b = new THREE.Color();
const mix = (a: string, b: string, t: number) => `#${_a.set(a).lerp(_b.set(b), t).getHexString()}`;
/**
 * The island's light on a fog night, `k` 0 (none) to 1 (full), eased in by the caller with the dark: the fog's colour
 * cools and closes in, the moon (the night's key light) turns colder and a touch dimmer. Nothing is added to the scene.
 */
export function fogNightLight(light: IslandLight, k: number): IslandLight {
  if (k <= 0) return light;
  const t = Math.min(1, k);
  return {
    ...light,
    fogColor: mix(light.fogColor, FOG_NIGHT.fog, 0.6 * t),
    fogNear: light.fogNear * (1 - (1 - FOG_NIGHT.near) * t),
    fogFar: light.fogFar * (1 - (1 - FOG_NIGHT.far) * t),
    sun: mix(light.sun, FOG_NIGHT.moon, 0.55 * t),
    sunIntensity: light.sunIntensity * (1 - (1 - FOG_NIGHT.moonDim) * t),
  };
}
