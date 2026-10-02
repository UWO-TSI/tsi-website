/**
 * The orbit camera (specs/camera-orbit.md, row 277): the follow camera turns round the player with the mouse
 * (pointer lock), the arrow keys or two fingers. Yaw is the camera's heading in the sim's facing convention,
 * forward = (sin yaw, cos yaw): 0 is today's view (looking +z, west), and the default tilt is today's 34.4°
 * (focus + (0, 7.4, −10.8)). Input moves `target`; the rig draws `view`, eased toward it. Per device
 * (localStorage), never world state: the camera is the viewer's.
 */
import * as THREE from "three";
import { pickCurvedSurface } from "./worldProjection";

/** Today's follow distance and tilt: (0, 7.4, −10.8) from the look point. */
export const ORBIT_DISTANCE = Math.hypot(7.4, 10.8);
export const DEFAULT_PITCH = Math.atan2(7.4, 10.8);
/**
 * The tilt band, radians down from level: 47° (a little steeper than today) to 20°. At 20° with the 48° FOV the
 * top of the frame looks 4° above level, so the bent sea's rim and a band of sky show; lower, the sea's far edge
 * and the empty space past the fog would.
 */
export const PITCH_MIN = 0.35, PITCH_MAX = 0.82;
/** Zoom (× the follow distance): the wheel's range; Z flips between 1 and ZOOM_OUT. */
export const ZOOM_MIN = 0.6, ZOOM_MAX = 1.6, ZOOM_OUT = 1.4;
/** The Settings sheet's mouse sensitivity (× the rates below). */
export const SENSITIVITY_MIN = 0.25, SENSITIVITY_MAX = 2.5;
/** Radians per pixel of mouse (or two-finger drag), and per second of a held arrow key, at sensitivity 1. */
export const LOOK_RATE = 0.0035, KEY_YAW_RATE = 2.2, KEY_PITCH_RATE = 1.1;
/** How fast the drawn view catches the input, per second: a short ease (about 60 ms), no lag behind the player. */
export const EASE = 16;

export interface OrbitAngles { yaw: number; pitch: number; zoom: number }
export interface OrbitPrefs { sensitivity: number; invertY: boolean; mouseLook: boolean; autoFollow: boolean }
const DEFAULT: OrbitAngles = { yaw: 0, pitch: DEFAULT_PITCH, zoom: 1 };
const DEFAULT_PREFS: OrbitPrefs = { sensitivity: 1, invertY: false, mouseLook: true, autoFollow: true };

/** `idle`: seconds since the mouse, the arrows or two fingers last turned the camera (auto-follow waits for it). */
export const orbit = { target: { ...DEFAULT }, view: { ...DEFAULT }, prefs: { ...DEFAULT_PREFS }, idle: 0 };
type Orbit = typeof orbit;

export const clampPitch = (p: number) => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
/** An angle in (−π, π]. */
export const wrapAngle = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));

/** Mouse-look by (dx, dy) pixels: right turns the view right, down tilts it down (inverted with `invertY`). */
export function lookOrbit(dx: number, dy: number, o: Orbit = orbit) {
  const k = LOOK_RATE * o.prefs.sensitivity;
  o.idle = 0;
  o.target.yaw -= dx * k;
  o.target.pitch = clampPitch(o.target.pitch + (o.prefs.invertY ? -dy : dy) * k);
}

/** A wheel step (pixels, + is away): zoom out multiplicatively, in the band. */
export function zoomOrbit(deltaY: number, o: Orbit = orbit) {
  o.target.zoom = clampZoom(o.target.zoom * Math.exp(deltaY * 0.0012));
}

/** Z: out to ZOOM_OUT, or back to 1 from anywhere past the middle. */
export function toggleZoom(o: Orbit = orbit) {
  o.target.zoom = o.target.zoom < (1 + ZOOM_OUT) / 2 ? ZOOM_OUT : 1;
}

/** A quarter turn (+1 left, −1 right) from the nearest quarter: the painter's draft walk steps round the island (/lab/island?draft=1). */
export function turnQuarter(dir: 1 | -1, o: Orbit = orbit) {
  o.idle = 0;
  o.target.yaw = (Math.round(o.target.yaw / (Math.PI / 2)) + dir) * (Math.PI / 2);
}

/** Back to today's view: the nearest whole turn (the short way round), the default tilt and zoom. */
export function snapBack(o: Orbit = orbit) {
  o.idle = 0;
  o.target.yaw = 2 * Math.PI * Math.round(o.target.yaw / (2 * Math.PI));
  o.target.pitch = DEFAULT_PITCH;
  o.target.zoom = 1;
}

/** Held arrows (← → turn, ↑ ↓ tilt: ↑ looks up), then the view eases to the target. Returns the view to draw. */
export function stepOrbit(dt: number, keys: Readonly<Record<string, boolean>>, o: Orbit = orbit): OrbitAngles {
  const t = o.target, v = o.view, s = o.prefs.sensitivity;
  const turn = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0), tilt = (keys.arrowdown ? 1 : 0) - (keys.arrowup ? 1 : 0);
  if (turn) t.yaw += turn * KEY_YAW_RATE * s * dt;
  if (tilt) t.pitch = clampPitch(t.pitch + tilt * KEY_PITCH_RATE * s * dt);
  o.idle = turn || tilt ? 0 : o.idle + dt;
  const k = 1 - Math.exp(-EASE * dt);
  v.yaw += (t.yaw - v.yaw) * k;
  v.pitch += (t.pitch - v.pitch) * k;
  v.zoom += (t.zoom - v.zoom) * k;
  return v;
}

/**
 * Gentle auto-follow (David, row 282; Zelda or Mario feel): running (at least FOLLOW_SPEED) with the camera left alone
 * for FOLLOW_IDLE s, the heading eases in behind the way you travel, ramping up over FOLLOW_RAMP s and never turning
 * faster than FOLLOW_TURN (a held strafe circles you slowly round, it does not spin the view). Any camera input
 * takes over at once (it zeroes `idle`). It never swings round to face you: running at the camera (more than
 * FOLLOW_MAX off the heading) holds it. The caller passes `allowed` false while standing in the cursor hold, a sheet
 * or the crosshair; the setting turns it off.
 */
export const FOLLOW_IDLE = 1, FOLLOW_RAMP = 0.6, FOLLOW_SPEED = 2.5, FOLLOW_RATE = 0.7, FOLLOW_TURN = 0.6, FOLLOW_MAX = (110 * Math.PI) / 180;
export function autoFollow(dt: number, vx: number, vz: number, allowed: boolean, o: Orbit = orbit) {
  if (!allowed || !o.prefs.autoFollow || o.idle < FOLLOW_IDLE || Math.hypot(vx, vz) < FOLLOW_SPEED) return;
  const off = wrapAngle(Math.atan2(vx, vz) - o.target.yaw);
  if (Math.abs(off) > FOLLOW_MAX) return;
  const ramp = Math.min(1, (o.idle - FOLLOW_IDLE) / FOLLOW_RAMP);
  const step = off * (1 - Math.exp(-FOLLOW_RATE * ramp * dt)), most = FOLLOW_TURN * ramp * dt;
  o.target.yaw += Math.max(-most, Math.min(most, step));
}

/** The camera's offset from the point it looks at: behind along the heading, up by the tilt. */
export function orbitOffset(yaw: number, pitch: number, distance: number): [number, number, number] {
  const back = Math.cos(pitch) * distance;
  return [-Math.sin(yaw) * back, Math.sin(pitch) * distance, -Math.cos(yaw) * back];
}

/** A horizontal offset (x, z) turned with the camera's heading: the overview's eye circles its focus. */
export function turnOffset(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, z * c - x * s];
}

// ── Mouse capture ──────────────────────────────────────────────────────
/**
 * Pointer-lock mouse-look as a state machine (David, 2026-10-01): `free` shows the cursor and the "Click to look
 * around" hint; a canvas click asks for the lock; `captured` turns the camera with the mouse; holding right click is
 * `cursor` (the pointer is released and the camera holds) and letting go asks for the lock again; any sheet, dialog
 * or text field is `menu` (released, and closing it does not re-capture); `off` is the cursor mode (the setting, a
 * touch screen). Esc is the browser's: it ends the lock (`unlocked`). A refused request (Chrome's cooldown after an
 * Esc, a gesture that ran out) stays `free`, and the next click asks again.
 */
export type CaptureState = "off" | "free" | "captured" | "cursor" | "menu";
export type CaptureEvent = "enable" | "disable" | "click" | "locked" | "unlocked" | "failed" | "rightDown" | "rightUp" | "menuOpen" | "menuClose";
/** The next state, and whether to ask for the lock (`request`) or let go of it (`exit`). */
export interface CaptureStep { state: CaptureState; request?: true; exit?: true }

export function nextCapture(s: CaptureState, e: CaptureEvent): CaptureStep {
  const held = s === "captured" ? { exit: true as const } : {};
  if (e === "disable") return { state: "off", ...held };
  if (s === "off") return { state: e === "enable" ? "free" : "off" };
  if (e === "menuOpen") return { state: "menu", ...held };
  switch (s) {
    case "free": return e === "click" ? { state: "free", request: true } : { state: e === "locked" ? "captured" : "free" };
    case "captured": return e === "unlocked" ? { state: "free" } : e === "rightDown" ? { state: "cursor", exit: true } : { state: "captured" };
    case "cursor": return e === "rightUp" ? { state: "free", request: true } : { state: e === "locked" ? "captured" : "cursor" };
    case "menu": return e === "menuClose" ? { state: "free" } : e === "locked" ? { state: "menu", exit: true } : { state: "menu" };
  }
}

/** The live capture state, for the HUD (the hint, the crosshair) and the Esc guard. */
export const capture = { state: "off" as CaptureState, /** When the lock last ended (ms, performance.now). */ unlockedAt: -Infinity };
const captureListeners = new Set<() => void>();
export function setCaptureState(state: CaptureState) {
  if (capture.state === state) return;
  if (capture.state === "captured") capture.unlockedAt = performance.now();
  capture.state = state;
  captureListeners.forEach(l => l());
}
export function subscribeCapture(listener: () => void) {
  captureListeners.add(listener);
  return () => { captureListeners.delete(listener); };
}
export const readCapture = () => capture.state;
/** The Esc that ended the lock is the browser's; it closes nothing in the game (a later Esc does). */
export const escapeEndedCapture = (now = performance.now()) => capture.state === "captured" || now - capture.unlockedAt < 250;

/** Reasons the game wants the cursor right now besides the dialogs the input sees (decorating, a greeting). */
export const cursorHolds = new Set<string>();
export function holdCursor(reason: string, on: boolean) { if (on) cursorHolds.add(reason); else cursorHolds.delete(reason); }

// ── The crosshair ──────────────────────────────────────────────────────
const _ray = new THREE.Ray(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/**
 * The crosshair's aim: the ray from the camera through the screen centre onto the ground as drawn (the curved world),
 * or the level plane at `y` when that ray finds no ground (it looks out over the sea). Null only when it points up.
 */
export function crosshairAim(camera: THREE.Camera, ground: (x: number, z: number) => number, y: number, out: THREE.Vector3): THREE.Vector3 | null {
  camera.getWorldPosition(_ray.origin);
  camera.getWorldDirection(_ray.direction);
  const hit = pickCurvedSurface(_ray, camera, ground);
  if (hit) return out.copy(hit);
  _plane.constant = -y;
  return _ray.intersectPlane(_plane, out);
}

// ── This device ────────────────────────────────────────────────────────
const STORE = "tsi.camera.v1";
const prefListeners = new Set<() => void>();
let loaded = false;

/** The saved angle, zoom and preferences, once (the rig and the Settings sheet call it). The view starts where it was left. */
export function loadOrbit(o: Orbit = orbit) {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<OrbitAngles & OrbitPrefs> | null;
    if (!raw || typeof raw !== "object") return;
    const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
    o.target.yaw = wrapAngle(num(raw.yaw, 0));
    o.target.pitch = clampPitch(num(raw.pitch, DEFAULT_PITCH));
    o.target.zoom = clampZoom(num(raw.zoom, 1));
    Object.assign(o.view, o.target);
    o.prefs.sensitivity = Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, num(raw.sensitivity, 1)));
    o.prefs.invertY = raw.invertY === true;
    o.prefs.mouseLook = raw.mouseLook !== false;
    o.prefs.autoFollow = raw.autoFollow !== false;
  } catch { /* defaults */ }
}

export function saveOrbit(o: Orbit = orbit) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ yaw: wrapAngle(o.target.yaw), pitch: o.target.pitch, zoom: o.target.zoom, ...o.prefs }));
  } catch { /* this session only */ }
}

export function setOrbitPrefs(patch: Partial<OrbitPrefs>) {
  const p = orbit.prefs;
  if (patch.sensitivity !== undefined) p.sensitivity = Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, patch.sensitivity));
  if (patch.invertY !== undefined) p.invertY = patch.invertY;
  if (patch.mouseLook !== undefined) p.mouseLook = patch.mouseLook;
  if (patch.autoFollow !== undefined) p.autoFollow = patch.autoFollow;
  orbit.prefs = { ...p }; // a new snapshot for useSyncExternalStore
  saveOrbit();
  prefListeners.forEach(l => l());
}
export function subscribeOrbitPrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => { prefListeners.delete(listener); };
}
export const readOrbitPrefs = () => { loadOrbit(); return orbit.prefs; };
