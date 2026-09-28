"use client";

/**
 * The player on the movement sim (specs/movement.md): keyboard or touch
 * intent, camera-relative, stepped through lib/game/movement/sim at a fixed
 * 120 Hz and drawn between steps as the shared character. Each step's events
 * become juice on this avatar (look spec §7.1): squash and stretch, dust,
 * thumps, clips. It also writes the follow camera's target (a slight lead
 * along the velocity) and kicks the FOV a little at top speed.
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
import { advanceMove, createMoveSim, createMoveState, interpolated, type MoveEvent, type MoveSim, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import type { MoveAction } from "@/lib/game/movement/keys";
import { routePilot, type RouteStep } from "@/lib/game/movement/course";

/** Feel values on the renderer's side, tuned next to the sim's in /lab/move. */
export const MOVE_JUICE = {
  camLead: 0.12, // seconds of velocity the camera looks ahead by (capped at 1.8u)
  fovKick: 3, // degrees wider at the top chained speed
  squash: 1, // squash and stretch amount
  dust: 1, // dust size
};
export type MoveJuice = typeof MOVE_JUICE;

/** Touch intent (screen space: x right, z up the screen) and presses waiting for the sim. */
export interface StickInput { x: number; z: number; jump: boolean; dash: boolean; jumpPressed: boolean; dashPressed: boolean }
export const newStick = (): StickInput => ({ x: 0, z: 0, jump: false, dash: false, jumpPressed: false, dashPressed: false });

/** What the HUD reads (a few times a second). */
export interface MoveTelemetry { x: number; y: number; z: number; speed: number; mode: string; hops: number; dashReady: boolean; long: boolean }

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
  const { camera } = useThree();
  const { look } = useMyLook();
  const { play: playSFX } = useSFX();
  const anchor = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null });
  const sim = useRef<MoveSim | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const presses = useRef({ jump: false, dash: false });
  const fx = useRef({ sq: 0, sqv: 0, step: 0, trail: 0, groundY: 0, lead: new THREE.Vector2(), clock: 0 });
  const dust = useMemo(() => new DustPool(), []);
  /** Dev (evidence): a scripted pilot, and pause / run-for-a-moment to shoot frames. */
  const dev = useRef<{ pilot: ReturnType<typeof routePilot> | null; paused: boolean; budget: number }>({ pilot: null, paused: false, budget: 0 });
  useEffect(() => () => dust.dispose(), [dust]);

  // Start (and restart when the spawn moves) on the ground.
  useEffect(() => {
    sim.current = createMoveSim(createMoveState(spawn[0], spawn[1], world));
    fx.current.groundY = sim.current.state.y;
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
    } });
  }, [world]);

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

    // ── Events → clips, dust, thumps, squash ─────────────────────────
    for (const e of events) {
      const clip = EVENT_CLIP[e.kind];
      if (clip) m.play = clip;
      switch (e.kind) {
        case "jump": case "hop": case "long": case "dashjump":
          f.sqv += 4.5 * j.squash; dust.spawn(e.x, e.y, e.z, (e.kind === "long" ? 1.1 : 0.8) * j.dust); playSFX("jump"); break;
        case "land":
          if (e.drop > 0.3) {
            f.sqv -= Math.min(9, 2.5 + e.drop * 2.4) * j.squash;
            dust.spawn(e.x, e.y, e.z, Math.min(2, 0.9 + e.drop * 0.35) * j.dust);
            playSFX("footstep");
            if (e.speed < 3 && e.drop > 0.6 && !m.play) m.play = "Land";
          }
          break;
        case "roll": dust.spawn(e.x, e.y, e.z, 1.3 * j.dust); break;
        case "dash": f.sqv -= 2 * j.squash; dust.spawn(e.x, e.y, e.z, 1.2 * j.dust); playSFX("blip4"); break;
        case "skid": playSFX("footstep"); break;
        case "mantle": playSFX("blip1"); break;
        case "bonk": f.sqv -= 3 * j.squash; playSFX("footstep"); break;
        case "splash": dust.spawn(e.x, e.y + 0.05, e.z, 2.2, true, 0.9); playSFX("blip5"); break;
        case "respawn": dust.spawn(e.x, e.y, e.z, 1.2 * j.dust); playSFX("blip3"); break;
      }
    }
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
        if (speed > t.walkSpeed * 1.1) dust.spawn(x - state.vx * 0.03, groundY, z - state.vz * 0.03, 0.9 * j.dust);
      }
    } else f.step = 0;
    dust.update(dt);

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

    // Camera: look a little ahead of the velocity, ride the ground rather than every hop.
    if (grounded) f.groundY = THREE.MathUtils.damp(f.groundY, y, 10, dt);
    else f.groundY = THREE.MathUtils.damp(f.groundY, Math.min(y, f.groundY + 1.2), 3, dt);
    const lead = Math.min(1.8, speed * j.camLead), dir = speed > 0.1 ? lead / speed : 0;
    f.lead.x = THREE.MathUtils.damp(f.lead.x, state.vx * dir, 3, dt);
    f.lead.y = THREE.MathUtils.damp(f.lead.y, state.vz * dir, 3, dt);
    camTarget.current.set(x + f.lead.x, f.groundY, z + f.lead.y);
    const top = t.sprintSpeed * t.longJumpBoost + t.hopChainMax * t.hopBoost;
    applyFov(camera, (getLabFov() ?? 48) + j.fovKick * THREE.MathUtils.clamp((speed - t.walkSpeed) / Math.max(0.1, top - t.walkSpeed), 0, 1), Math.min(rawDelta, 0.1));

    Object.assign(telemetry.current, { x, y, z, speed, mode: state.mode, hops: state.hops, dashReady: state.dashCd <= 0, long: state.long });
  }, -4);

  return <>
    <primitive object={dust.group} />
    <group ref={anchor}>
      <Character look={look} motion={motion} walkSpeed={walkSpeed} />
    </group>
  </>;
}
