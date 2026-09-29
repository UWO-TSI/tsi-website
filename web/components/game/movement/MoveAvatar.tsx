"use client";

/**
 * The player on the movement sim (specs/movement.md): keyboard or touch
 * intent, camera-relative, stepped through lib/game/movement/sim at a fixed
 * 120 Hz and drawn between steps as the shared character. Each step's events
 * become juice on this avatar (look spec §7.1): squash and stretch, dust,
 * thumps, clips, dash speed lines and the dash cooldown ring at its feet. It
 * also writes the follow camera's focus (a lead along the velocity, at the
 * level it stands on, so hops never bob the view) and widens the FOV a little
 * with speed and on a dash.
 *
 * Built for /lab/move; the village, home island and ruins swap to it once
 * David approves the feel (spec build order 4).
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Character, { type CharacterMotion, type ClipName } from "../character/Character";
import { useMyLook } from "@/lib/game/character/lookStore";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { juiceFovOffset } from "@/lib/game/cameraJuice";
import { getLabFov } from "@/lib/game/devLab";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { useSFX } from "@/lib/game/useAudio";
import { WATER_DROP } from "@/lib/game/grid";
import { advanceMove, createMoveSim, createMoveState, interpolated, topSpeed, type MoveEvent, type MoveSim, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import type { MoveAction } from "@/lib/game/movement/keys";
import { routePilot, type RouteStep } from "@/lib/game/movement/course";

/** Feel values on the renderer's side, tuned next to the sim's in /lab/move. */
export const MOVE_JUICE = {
  camLead: 0.1, // seconds of velocity the camera looks ahead by (capped at 1.5u)
  fovKick: 2.5, // degrees wider at top speed
  dashKick: 2, // degrees the FOV punches out on a dash
  squash: 1, // squash and stretch amount
  dust: 1, // dust size
  streaks: 1, // speed lines on a dash and at bunny-hop speed
};
export type MoveJuice = typeof MOVE_JUICE;

/** Touch intent (screen space: x right, z up the screen) and presses waiting for the sim. */
export interface StickInput { x: number; z: number; jump: boolean; dash: boolean; jumpPressed: boolean; dashPressed: boolean }
export const newStick = (): StickInput => ({ x: 0, z: 0, jump: false, dash: false, jumpPressed: false, dashPressed: false });

/** What the HUD reads (a few times a second). */
export interface MoveTelemetry { x: number; y: number; z: number; speed: number; mode: string; hops: number; dashReady: boolean; long: boolean }
const TAKEOFF = new Set<MoveEvent["kind"]>(["jump", "hop", "long", "dashjump"]);

// ── Dust: a small pool of flat puffs, no React per puff ────────────
const DUST = 32;
class DustPool {
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

// ── Speed lines: PlayerAvatar's sprint wind rods, strong through a dash and faint at bunny-hop speed ──
class Streaks {
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
class DashRing {
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
function applyFov(camera: THREE.Camera, target: number, dt: number) {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return;
  const fov = THREE.MathUtils.damp(cam.fov, target - juiceFovOffset(dt), 6, dt);
  if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
function place(group: THREE.Object3D, x: number, y: number, z: number, sy: number) {
  group.position.set(x, y, z);
  const sxz = 1 / Math.sqrt(sy);
  group.scale.set(sxz, sy, sxz);
}

function screenOf([x, y, z]: [number, number, number], camera: THREE.Camera, canvas: HTMLCanvasElement) {
  const v = new THREE.Vector3(x, y + 0.7, z).project(camera), r = canvas.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}

/** The presses went to the sim this frame. */
function consumePresses(stick: StickInput) { stick.jumpPressed = stick.dashPressed = false; }

/** One-shot clip per event (the character plays it once over locomotion). */
const EVENT_CLIP: Partial<Record<MoveEvent["kind"], ClipName>> = { jump: "Jump", hop: "Jump", long: "Jump", dashjump: "Jump", roll: "Roll", mantle: "Mantle", dash: "Dash", recover: "Land" };

export default function MoveAvatar({ world, tuning, juice, spawn, stick, bindings, camTarget, telemetry, timeScale, walkSpeed, onEvents, frozen = false }: {
  world: MoveWorld;
  tuning: RefObject<MoveTuning>;
  juice: RefObject<MoveJuice>;
  spawn: [number, number];
  stick: RefObject<StickInput>;
  bindings: Record<MoveAction, string>;
  /** Written every frame: where the follow camera looks. */
  camTarget: RefObject<THREE.Vector3>;
  telemetry: RefObject<MoveTelemetry>;
  /** Slow motion for judging a move (1 = real time). */
  timeScale?: RefObject<number>;
  /** Walking pace the Walk clip plays at 1× (the tuning's walkSpeed). */
  walkSpeed: number;
  onEvents?: (events: MoveEvent[]) => void;
  frozen?: boolean;
}) {
  const { camera, gl } = useThree();
  const { look } = useMyLook();
  const { play: playSFX } = useSFX();
  const anchor = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null });
  const sim = useRef<MoveSim | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const presses = useRef({ jump: false, dash: false });
  const fx = useRef({ sq: 0, sqv: 0, step: 0, trail: 0, level: 0, punch: 0, lead: new THREE.Vector2(), pan: new THREE.Vector2(), clock: 0 });
  const dust = useMemo(() => new DustPool(), []);
  const streaks = useMemo(() => new Streaks(), []);
  const ring = useMemo(() => new DashRing(), []);
  /** Dev (evidence): a scripted pilot, and pause / run-for-a-moment to shoot frames. */
  const dev = useRef<{ pilot: ReturnType<typeof routePilot> | null; paused: boolean; budget: number }>({ pilot: null, paused: false, budget: 0 });
  useEffect(() => () => { dust.dispose(); streaks.dispose(); ring.dispose(); }, [dust, streaks, ring]);

  // Start (and restart when the spawn moves) on the ground.
  useEffect(() => {
    sim.current = createMoveSim(createMoveState(spawn[0], spawn[1], world));
    fx.current.level = sim.current.state.y;
  }, [spawn, world]);
  useEffect(() => {
    // Dev (evidence scripts): read the sim, teleport.
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __move: {
      sim,
      teleport: (x: number, z: number, facing = 0) => { sim.current = createMoveSim(createMoveState(x, z, world, facing)); },
      autopilot: (route?: RouteStep[]) => { dev.current.pilot = routePilot(route); },
      pause: () => { dev.current.paused = true; dev.current.budget = 0; },
      run: (seconds: number) => { dev.current.paused = true; dev.current.budget += seconds; },
      resume: () => { dev.current.paused = false; },
      /** Where the avatar is on the page (evidence crops), and the camera (evidence: no lag, no bob). */
      screen: () => (sim.current ? screenOf(interpolated(sim.current), camera, gl.domElement) : null),
      camera: () => camera.position.toArray(),
    } });
  }, [world, camera, gl]);

  useEffect(() => {
    if (frozen) return;
    return bindGameKeys({ keys: keys.current, accepted: Object.values(bindings),
      onPress: (e) => {
        const k = e.key.toLowerCase();
        if (e.repeat) { if (k === " ") e.preventDefault(); return; }
        if (k === bindings.jump) { presses.current.jump = true; e.preventDefault(); }
        if (k === bindings.dash) { presses.current.dash = true; e.preventDefault(); }
      },
    });
  }, [bindings, frozen]);

  useFrame((_, rawDelta) => {
    const s = sim.current, g = anchor.current;
    if (!s || !g) return;
    let dt = Math.min(rawDelta, 0.1) * (timeScale?.current ?? 1);
    const t = tuning.current, j = juice.current, d = dev.current;
    if (d.paused) { dt = Math.min(dt, d.budget); d.budget -= dt; }
    const k = keys.current, b = bindings, st = stick.current;
    // Camera-relative intent: keys give a unit direction, the stick keeps its tilt.
    const { fx: fwdX, fz: fwdZ } = getCameraForwardXZ(camera);
    let sx = (k[b.right] ? 1 : 0) - (k[b.left] ? 1 : 0), sz = (k[b.forward] ? 1 : 0) - (k[b.back] ? 1 : 0);
    const len = Math.hypot(sx, sz);
    if (len > 0) { sx /= len; sz /= len; } else { sx = st.x; sz = st.z; }
    const tilt = Math.hypot(st.x, st.z);
    const piloted = d.pilot && dt > 0 ? d.pilot(s.state, dt) : null;
    if (d.pilot && dt > 0 && !piloted) d.pilot = null;
    const input = frozen ? { x: 0, z: 0, sprint: false, sneak: false, jump: false, jumpPressed: false, dashPressed: false } : piloted ?? {
      x: fwdX * sz - fwdZ * sx, z: fwdZ * sz + fwdX * sx,
      sprint: !!k[b.sprint] || (len === 0 && tilt > 0.92), sneak: !!k[b.sneak],
      jump: !!k[b.jump] || st.jump, jumpPressed: presses.current.jump || st.jumpPressed, dashPressed: presses.current.dash || st.dashPressed,
    };
    presses.current.jump = presses.current.dash = false;
    consumePresses(stick.current);

    const events = advanceMove(s, input, dt, world, t);
    const state = s.state, [x, y, z] = interpolated(s);
    const f = fx.current, m = motion.current, speed = Math.hypot(state.vx, state.vz);
    f.clock += dt;
    const wet = world.wet(x, z), floor = wet ? world.top(x, z) - WATER_DROP : world.top(x, z), groundY = Math.min(y, floor);
    const grounded = state.mode !== "air" && state.mode !== "mantle" && state.mode !== "splash";

    // ── Events → clips, dust, thumps, squash (puffs grow with speed; a trailing one at a run) ──
    const back = speed > 0.1 ? 1 / speed : 0, puff = (e: MoveEvent, size: number) => {
      dust.spawn(e.x, e.y, e.z, Math.min(2, size) * j.dust);
      if (e.speed > t.walkSpeed) dust.spawn(e.x - state.vx * back * 0.45, e.y, e.z - state.vz * back * 0.45, Math.min(2, size) * 0.7 * j.dust, false, 0.45);
    };
    events.forEach((e, i) => {
      const clip = EVENT_CLIP[e.kind];
      if (clip) m.play = clip;
      switch (e.kind) {
        case "hop":
          // Touch down and straight back up: a quick squash that springs into the stretch.
          f.sq = Math.min(f.sq, -0.12 * j.squash); f.sqv = 6 * j.squash; puff(e, 0.6 + e.speed * 0.04); playSFX("jump"); break;
        case "jump": case "long": case "dashjump":
          f.sqv += 4.5 * j.squash; puff(e, 0.5 + e.speed * 0.04); playSFX("jump"); break;
        case "land":
          // A landing that launches the next hop (same step) leaves its thump to the hop; any other ends a short hop's Jump clip (no sliding feet).
          if (events[i + 1] && TAKEOFF.has(events[i + 1].kind)) break;
          m.stop = true;
          if (e.drop > 0.3) {
            f.sqv -= Math.min(9, 2.5 + e.drop * 2.4) * j.squash;
            puff(e, 0.6 + e.drop * 0.35 + e.speed * 0.03);
            playSFX("footstep");
            if (e.speed < 3 && e.drop > 0.6 && !m.play) m.play = "Land";
          }
          break;
        case "roll": puff(e, 1.3); break;
        case "dash": f.sqv -= 2 * j.squash; f.punch = j.dashKick; dust.spawn(e.x, e.y, e.z, 1.2 * j.dust); playSFX("blip4"); break;
        case "skid": playSFX("footstep"); break;
        case "mantle": playSFX("blip1"); break;
        case "bonk": f.sqv -= 3 * j.squash; playSFX("footstep"); break;
        case "splash": dust.spawn(e.x, e.y + 0.05, e.z, 2.2, true, 0.9); playSFX("blip5"); break;
        case "respawn": dust.spawn(e.x, e.y, e.z, 1.2 * j.dust); playSFX("blip3"); f.pan.set(camTarget.current.x - x - f.lead.x, camTarget.current.z - z - f.lead.y); break;
      }
    });
    onEvents?.(events);
    // Trails while skidding, rolling or dashing on the ground; footfalls while running.
    const trailing = grounded && (state.mode === "skid" || state.mode === "roll" || state.dashT > 0);
    f.trail -= dt;
    if (trailing && f.trail <= 0) { f.trail = 0.05; dust.spawn(x - state.vx * 0.02, groundY, z - state.vz * 0.02, 0.8 * j.dust, false, 0.45); }
    if (grounded && state.mode === "ground" && speed > 1 && state.dashT <= 0) {
      f.step += dt;
      if (f.step >= Math.max(0.2, 2.96 / speed)) {
        f.step = 0;
        playSFX("footstep");
        if (speed > t.walkSpeed * 1.1) dust.spawn(x - state.vx * 0.03, groundY, z - state.vz * 0.03, (0.5 + speed * 0.03) * j.dust);
      }
    } else f.step = 0;
    dust.update(dt);
    // Speed lines through a dash, faint once hops carry you past sprint speed; the cooldown ring at the feet.
    streaks.update(dt, x, y, z, state.vx, state.vz, j.streaks * (state.dashT > 0 ? 0.4 : speed > t.sprintSpeed * 1.08 && state.mode === "air" ? 0.14 : 0));
    const spent = state.mode === "air" && state.airDashes >= t.airDashes, dashReady = state.dashCd <= 0 && !spent && state.mode !== "recover";
    ring.update(dt, x, groundY, z, spent ? 0 : 1 - state.dashCd / Math.max(0.01, t.dashCooldown), dashReady);

    // Squash and stretch: a spring, stretched by vertical speed in the air.
    const want = state.mode === "air" ? THREE.MathUtils.clamp(state.vy * 0.012, -0.07, 0.12) * j.squash : 0;
    f.sqv += ((want - f.sq) * 260 - f.sqv * 16) * dt;
    f.sq = THREE.MathUtils.clamp(f.sq + f.sqv * dt, -0.3, 0.3);
    const sy = 1 + f.sq;
    place(g, x, groundY, z, sy);

    // Character: yaw, lift above the ground under it, the movement state clip.
    m.yaw = state.facing;
    m.rate = rawDelta > 0 ? dt / Math.min(rawDelta, 0.1) : 1;
    m.lift = (y - groundY) / sy;
    m.speed = grounded && state.mode === "ground" ? speed : 0;
    m.move = state.mode === "air" || state.mode === "splash" ? "Fall" : state.mode === "skid" ? "Skid" : null;

    // Camera focus: the avatar, a lead along its velocity, and the level it stands on. A hop never lifts the level;
    // landing on a new one, a mantle (to its top) or falling below it reframes. A respawn pans rather than cuts.
    // The lab camera sits rigidly on this point (MoveLab useMoveCamera), so at any speed it neither lags nor swings.
    f.level = THREE.MathUtils.damp(f.level, state.mode === "mantle" ? state.to[1] : grounded ? y : Math.min(f.level, y), 8, dt);
    const lead = Math.min(1.5, speed * j.camLead), dir = speed > 0.1 ? lead / speed : 0;
    f.lead.x = THREE.MathUtils.damp(f.lead.x, state.vx * dir, 3, dt);
    f.lead.y = THREE.MathUtils.damp(f.lead.y, state.vz * dir, 3, dt);
    f.pan.multiplyScalar(Math.exp(-5 * dt));
    camTarget.current.set(x + f.lead.x + f.pan.x, f.level, z + f.lead.y + f.pan.y);
    f.punch *= Math.exp(-6 * dt);
    const fast = THREE.MathUtils.clamp((speed - t.walkSpeed) / Math.max(0.1, topSpeed(t) - t.walkSpeed), 0, 1);
    applyFov(camera, (getLabFov() ?? 48) + j.fovKick * fast + f.punch, Math.min(rawDelta, 0.1));

    Object.assign(telemetry.current, { x, y, z, speed, mode: state.mode, hops: state.hops, dashReady, long: state.long });
  }, -4);

  return <>
    <primitive object={dust.group} />
    <primitive object={streaks.group} />
    <primitive object={ring.group} />
    <group ref={anchor}>
      <Character look={look} motion={motion} walkSpeed={walkSpeed} />
    </group>
  </>;
}
