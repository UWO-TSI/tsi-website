/**
 * The movement kit's juice on the player's avatar (specs/movement.md; look
 * spec §7.1): dust, speed lines, the dash cooldown ring, the FOV, and the
 * touch stick. PlayerAvatar drives them from each sim step's events.
 */
import * as THREE from "three";
import type { ClipName } from "@/lib/game/character/clips";
import { juiceFovOffset } from "@/lib/game/cameraJuice";
import type { MoveEvent } from "@/lib/game/movement/sim";

/** Feel values on the renderer's side, tuned next to the sim's in /lab/move. */
export const MOVE_JUICE = {
  camLead: 0.1, // seconds of velocity the camera looks ahead by (capped at 1.5u)
  fovKick: 2.5, // degrees wider at top speed
  dashKick: 2, // degrees the FOV punches out on a dash
  squash: 1, // squash and stretch amount
  dust: 1, // dust size
  streaks: 1, // speed lines on a dash and at a sprint
};
export type MoveJuice = typeof MOVE_JUICE;

/** Touch intent (screen space: x right, z up the screen) and presses waiting for the sim; TouchControls writes it, the avatar reads it. */
export interface StickInput { x: number; z: number; jump: boolean; jumpPressed: boolean; dashPressed: boolean }
export const touchStick: StickInput = { x: 0, z: 0, jump: false, jumpPressed: false, dashPressed: false };

/** What the HUD reads (a few times a second). */
export interface MoveTelemetry { x: number; y: number; z: number; speed: number; mode: string; hops: number; dashReady: boolean; long: boolean }
export const TAKEOFF = new Set<MoveEvent["kind"]>(["jump", "hop", "long", "dashjump"]);

// ── Dust: a small pool of flat puffs, no React per puff ────────────
const DUST = 32;
export class DustPool {
  readonly group = new THREE.Group();
  private next = 0;
  private readonly puffs = Array.from({ length: DUST }, (_, i) => {
    const wet = i % 4 === 3; // a quarter of the pool are water rings
    const mesh = new THREE.Mesh(wet ? new THREE.RingGeometry(0.72, 1, 16) : new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({ color: wet ? "#DFF2FC" : "#D8C8A8", transparent: true, opacity: 0, depthWrite: false, fog: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    this.group.add(mesh);
    return { mesh, wet, t: 1, life: 0.6, size: 1 };
  });
  spawn(x: number, y: number, z: number, size: number, wet = false, life = 0.6) {
    for (let k = 0; k < DUST; k++) {
      const p = this.puffs[(this.next + k) % DUST];
      if (p.wet !== wet) continue;
      this.next = (this.next + k + 1) % DUST;
      Object.assign(p, { t: 0, life, size });
      p.mesh.position.set(x, y + 0.03, z);
      p.mesh.visible = true;
      return;
    }
  }
  update(dt: number) {
    for (const p of this.puffs) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + dt / p.life);
      const s = (p.wet ? 0.3 + p.t * 0.75 : 0.35 + p.t * 0.4) * p.size;
      p.mesh.scale.set(s, s, s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (p.wet ? 0.45 : 0.55) * (1 - p.t);
      p.mesh.visible = p.t < 1;
    }
  }
  dispose() { for (const p of this.puffs) { p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); } }
}

// ── Speed lines: the sprint wind rods, strong through a dash, faint at a sprint ──
export class Streaks {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(0.025, 0.025, 0.85);
  private readonly mats = [0, 1, 2, 3].map(i => {
    const mat = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false, fog: false });
    const rod = new THREE.Mesh(this.geometry, mat);
    rod.position.set(i % 2 ? 0.45 : -0.45, 0.45 + (i >> 1) * 0.5, -0.4);
    this.group.add(rod);
    return mat;
  });
  private clock = 0;
  update(dt: number, x: number, y: number, z: number, vx: number, vz: number, want: number) {
    this.clock += dt;
    let peak = 0;
    for (const m of this.mats) { m.opacity = THREE.MathUtils.damp(m.opacity, want, want > m.opacity ? 40 : 9, dt); peak = Math.max(peak, m.opacity); }
    this.group.visible = peak > 0.015;
    if (!this.group.visible) return;
    this.group.position.set(x, y, z);
    if (Math.hypot(vx, vz) > 0.5) this.group.rotation.y = Math.atan2(vx, vz);
    this.group.children.forEach((rod, i) => { rod.position.z = -0.15 - ((this.clock * 5 + i * 0.65) % 1) * 1.1; });
  }
  dispose() { this.geometry.dispose(); this.mats.forEach(m => m.dispose()); }
}

// ── Dash cooldown: a ring at the feet that fills clockwise, then flashes when the dash is back ──
const ARCS = 24;
export class DashRing {
  readonly group = new THREE.Group();
  /** Arcs filled from the top of the screen, clockwise (the camera looks +z: +x is screen left). */
  private readonly arcs = Array.from({ length: ARCS }, (_, i) => new THREE.RingGeometry(0.34, 0.42, 2 * (i + 1), 1, 1.5 * Math.PI, -((i + 1) / ARCS) * 2 * Math.PI));
  private readonly trackMat = new THREE.MeshBasicMaterial({ color: "#0b0e14", transparent: true, opacity: 0.3, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private readonly fillMat = new THREE.MeshBasicMaterial({ color: "#FFD166", transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private readonly track = new THREE.Mesh(this.arcs[ARCS - 1], this.trackMat);
  private readonly fill = new THREE.Mesh(this.arcs[0], this.fillMat);
  private flash = 1;
  private ready = true;
  constructor() {
    this.group.rotation.x = -Math.PI / 2;
    this.group.add(this.track, this.fill);
    this.group.visible = false;
  }
  /** `fill` 0..1 of the cooldown done (0 while an air dash is spent); `ready` = a dash would go now. */
  update(dt: number, x: number, y: number, z: number, fill: number, ready: boolean) {
    if (ready && !this.ready) this.flash = 0;
    this.ready = ready;
    this.flash = Math.min(1, this.flash + dt / 0.25);
    this.group.visible = !ready || this.flash < 1;
    if (!this.group.visible) return;
    this.group.position.set(x, y + 0.03, z);
    const n = Math.round(fill * ARCS);
    this.fill.visible = ready || n > 0;
    this.fill.geometry = this.arcs[ready ? ARCS - 1 : Math.max(0, n - 1)];
    this.track.visible = !ready;
    this.fillMat.opacity = ready ? 0.9 * (1 - this.flash) : 0.9;
    this.group.scale.setScalar(ready ? 1 + 0.4 * this.flash : 1);
  }
  dispose() { this.arcs.forEach(a => a.dispose()); this.trackMat.dispose(); this.fillMat.dispose(); }
}

// Module scope: three objects from hooks are frozen to the react compiler inside component code.
export function applyFov(camera: THREE.Camera, target: number, dt: number) {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return;
  const fov = THREE.MathUtils.damp(cam.fov, target - juiceFovOffset(dt), 6, dt);
  if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
export function screenOf([x, y, z]: [number, number, number], camera: THREE.Camera, canvas: HTMLCanvasElement) {
  const v = new THREE.Vector3(x, y + 0.7, z).project(camera), r = canvas.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}

/** One-shot clip per event (the character plays it once over locomotion). */
export const EVENT_CLIP: Partial<Record<MoveEvent["kind"], ClipName>> = { jump: "Jump", hop: "Jump", long: "Jump", dashjump: "Jump", roll: "Roll", mantle: "Mantle", dash: "Dash", recover: "Land" };
