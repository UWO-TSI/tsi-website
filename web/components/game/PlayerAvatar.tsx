"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { liveIslandWeather } from "@/lib/game/islandWeather";
import { AudioManager, type SFXName } from "@/lib/game/audio";
import { WORLD_SNOW } from "@/lib/game/modelMaterials";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { WATER_DROP } from "@/lib/game/grid";
import { calculateCurvedHtmlPosition, pickCurvedSurface } from "@/lib/game/worldProjection";
import MoveTargetIndicator from "./MoveTargetIndicator";
import Character, { CHARACTER_HEIGHT, CHARACTER_SCALE, type CharacterMotion, type ClipName } from "./character/Character";
import type { CharacterLook } from "@/lib/game/character/look";
import { useMyLook } from "@/lib/game/character/lookStore";
import { airPhase, combatClip, seatLift, type CombatView } from "@/lib/game/character/clips";
import { useWorldClips } from "./character/useWorldClips";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { combatFacing, combatPush, combatTuning, dashDodge } from "@/lib/game/combat/actions";
import { WEAPONS } from "@/lib/game/combat/data";
import { STUCK_TIME, advanceMove, clearSpot, createMoveSim, createMoveState, interpolated, topSpeed, towards, MOVE_TUNING, NO_INPUT, type MoveEvent, type MoveInput, type MoveSim, type MoveState, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import { crouchKey, useKeyboardLocked, useMoveKeys } from "@/lib/game/movement/keys";
import { routePilot, type RouteStep } from "@/lib/game/movement/course";
import { BASE_FOV, EVENT_CLIP, MOVE_JUICE, TAKEOFF, applyFov, liveWind, momentumOf, screenOf, touchStick, useMoveParticles, type MoveJuice, type MoveTelemetry } from "./movement/moveFx";
import { cooldownWisp, dashBurst, dashReady as dashBack, footstep, groundUnder, handPuff, landKind, landing, leafBits, puffRing, scuff, settle, slideBurst, slidePop, slideTrail, splash, streak, takeoff, trail, type GroundKind } from "@/lib/game/movement/juice";

/**
 * The player on the movement kit (specs/movement.md): keys, the touch stick or
 * a tap, camera-relative, stepped through lib/game/movement/sim at a fixed
 * 120 Hz on the scene's `world` and drawn between steps as the shared 3D
 * character (row 105). Each step's events and each foot contact become juice
 * on this avatar (look spec §7.1, specs/movement-feel.md): clips, squash and
 * stretch, our painted particles by the ground underfoot (lib/game/movement/
 * juice.ts), sounds, a dash's streaks and afterimages, and the wind at the
 * heels while the dash recharges. It writes the follow camera's focus
 * (`camTarget`: a lead along the velocity, at the level it stands on) and
 * widens the FOV with speed.
 *
 * World interactions become clip requests: sit/study/sleep seats (tsi:sit),
 * fishing (tsi:fish-cast / tsi:fish-end), forage and net (tsi:peaceful-act,
 * tsi:flower-pick, tsi:critter-catch), emotes (tsi:emote {clip}), and the encounter state when `combat` is set: there Q's dash is the
 * dodge (its i-frames), knockback and ability dashes push through the sim, and
 * a cast roots you until a dodge breaks it.
 *
 * `glider` (the leaf glider is owned and this scene allows it, specs/glider.md)
 * turns the sim's glide on and puts the leaf in the right hand while gliding: it
 * pops open, the avatar banks into turns and sways under it, faint wind lines
 * at speed, a soft puff on landing, and the camera eases down with it.
 */

interface PlayerAvatarProps {
  spawnPosition: [number, number, number];
  /** Written when the avatar moves: where the player stands (the scene's shared position). */
  player?: React.RefObject<THREE.Vector3>;
  /** What the kit walks on: `top` and `wet` (lib/game/movement/sim). */
  world: MoveWorld;
  groundHeight: (x: number, z: number) => number;
  groundSurface?: (x: number, z: number) => number;
  /** Written every frame: where the follow camera looks (IslandAtmosphere useFollowCamera). */
  camTarget?: React.RefObject<THREE.Vector3>;
  playerName?: string;
  showNameplate?: boolean;
  /** The member's level (combat progression); the nameplate leaves it out until known. */
  playerLevel?: number;
  /** TSI member (row 223): subtle blue dot + glow on the nameplate. */
  member?: boolean;
  /** Encounter: the ruins' kit (Q dodges); clips and facing follow the combat runtime; the weapon is in hand. */
  combat?: boolean;
  /** A change puts you back at the spawn (the ruins' defeat wakes you at the gate without remounting the scene). */
  respawn?: number;
  /** The leaf glider: owned, and this area allows it (the village and the home island; never the ruins). */
  glider?: boolean;
  frozen?: boolean;
  desktopClickToMove?: boolean;
  /** /lab/move: live tuning and juice, slow motion, the HUD's readout and the Walk clip's pace. */
  tuning?: MoveTuning;
  juice?: MoveJuice;
  timeScale?: number;
  telemetry?: React.RefObject<MoveTelemetry>;
  walkSpeed?: number;
  /** Walk only (the café, cafe-polish §4): no running, jumping or dashing. */
  walkOnly?: boolean;
}

const playSFX = (name: SFXName, rate = 1, gain = 1) => AudioManager.playSFX(name, { rate, gain });
/** The ground under a point, for the effect, tint and sound of every move there (module scope: see turnTo). */
function groundAt(surface: ((x: number, z: number) => number) | undefined, world: MoveWorld, x: number, z: number): GroundKind {
  return groundUnder(surface?.(x, z), WORLD_SNOW.value, world.wet, x, z);
}
/** The jump's anticipation: the body stays crouched on the ground this long (seconds) while the sim already rises, then springs after it. */
const ANTIC = 0.06;
/** Streaks through a dash, a step apart (s); fainter ones at top speed. */
const STREAK_EVERY = 0.05, FAST_STREAK_EVERY = 0.12;

/** Face a point (module scope: the react compiler freezes values reached through hooks inside component code). */
function turnTo(s: MoveState | undefined, x: number, z: number) { if (s) s.facing = Math.atan2(x - s.x, z - s.z); }

/**
 * Bank the body about a pivot `pivotY` above the anchor (a glider's grip overhead, a slide's seat on the ground): `roll`
 * about the way it faces (into a turn), `pitch` about its side (a slide lies back deeper with speed). Module scope, see turnTo.
 */
const bankAxis = new THREE.Vector3(), bankPivot = new THREE.Vector3(), pitchQ = new THREE.Quaternion();
function bankAbout(group: THREE.Group, yaw: number, roll: number, pivotY: number, pitch = 0) {
  if (Math.abs(roll) < 1e-4 && Math.abs(pitch) < 1e-4) { group.quaternion.identity(); group.position.set(0, 0, 0); return; }
  group.quaternion.setFromAxisAngle(bankAxis.set(Math.sin(yaw), 0, Math.cos(yaw)), roll);
  group.quaternion.multiply(pitchQ.setFromAxisAngle(bankAxis.set(Math.cos(yaw), 0, -Math.sin(yaw)), pitch));
  bankPivot.set(0, pivotY, 0);
  group.position.copy(bankPivot).sub(bankPivot.applyQuaternion(group.quaternion));
}
/** The grip's height above the feet in the Glide clip (build_clips.py GLIDE_GRIP, rig units × the character's scale). */
const GRIP_Y = 0.58 * CHARACTER_SCALE;

/** Clips that hold while seated; the seat branch owns them. */
const SEAT_CLIPS = new Set<ClipName>(["Sit", "Study", "Stretch", "Sleep"]);
type Seat = { x: number; z: number; clip: ClipName; lift: number; yaw: number };

export default function PlayerAvatar({ spawnPosition, player, world, groundHeight, groundSurface, camTarget, playerName = "Player", showNameplate = true, playerLevel, member = false, combat: inCombat = false, respawn = 0, glider = false, frozen = false, desktopClickToMove = false, tuning, juice, timeScale, telemetry, walkSpeed = MOVE_TUNING.walkSpeed, walkOnly = false }: PlayerAvatarProps) {
  const anchor = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null, afterimages: true });
  const { look } = useMyLook();
  const { camera, gl } = useThree();
  const bindings = useMoveKeys(), locked = useKeyboardLocked();
  // Crouch/slide: Ctrl on macOS, C elsewhere (Ctrl there only in fullscreen with the keyboard locked).
  const crouch = crouchKey(bindings, locked);
  const [x0, , z0] = spawnPosition;
  const sim = useRef<MoveSim | null>(null), simAt = useRef<[number, number, number] | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const presses = useRef({ jump: false, dash: false });
  const target = useRef<{ x: number; z: number } | null>(null);
  const seat = useRef<Seat | null>(null);
  const reported = useRef<THREE.Vector3 | null>(null);
  const fx = useRef({ sq: 0, sqv: 0, steps: 0, trail: 0, stuck: 0, level: 0, punch: 0, leaf: 0, leafV: 0, bank: 0, pitch: 0, sliding: false, slideT: 0, slideBeat: 0, drop: 0, heading: 0, lead: new THREE.Vector2(), pan: new THREE.Vector2(), rise: new THREE.Vector2(), focus: new THREE.Vector3(x0, 0, z0),
    // Juice timers (specs/movement-feel.md): anticipation, the Air pose, the camera dip, streaks, afterimages, the cooldown wind.
    antic: 0, anticY: 0, jumped: false, vy0: 6, fallT: 0, dip: 0, dipV: 0, streakT: 0, streakK: 0, ghostT: 0, dashT: 0, cdT: 0, wispT: 0, ready: true });
  // The glider is a flag on the sim (never in an encounter); the lab's tuning can carry it too.
  const kit = useMemo(() => (glider ? { ...(tuning ?? MOVE_TUNING), glider: 1 } : tuning ?? MOVE_TUNING), [tuning, glider]);
  const leafOwned = !inCombat && kit.glider > 0;
  const particles = useMoveParticles();
  const combatPrev = useRef<CombatView | null>(null);
  const indicatorId = useRef(0);
  const [indicators, setIndicators] = useState<Array<{ id: number; position: [number, number, number] }>>([]);
  // Micro-anim loop iter 1 (2026-07-24): cozy sit beat, a settle puff and a brief contented ♪ over the head.
  const [sitNote, setSitNote] = useState(false);
  const sitNoteTimer = useRef<number | null>(null);
  /** Dev (evidence): a scripted pilot, and pause / run-for-a-moment to shoot frames. */
  const dev = useRef<{ pilot: ReturnType<typeof routePilot> | null; paused: boolean; budget: number }>({ pilot: null, paused: false, budget: 0 });

  // Keys (remappable, lib/game/movement/keys); held keys are read each frame, presses wait for the sim.
  useEffect(() => {
    if (frozen) return;
    const b = bindings, walk = [b.forward, b.left, b.back, b.right];
    return bindGameKeys({ keys: keys.current, accepted: [...Object.values(b).filter(k => k !== b.crouch), crouch].filter(Boolean),
      onReset: () => { target.current = null; },
      onPress: (e) => {
        const k = e.key.toLowerCase();
        // Ctrl with a game key is play (crouch/slide): no browser shortcut, where a page can stop one.
        if (k === b.jump || k === b.dash || e.ctrlKey) e.preventDefault();
        if (e.repeat) return;
        if (k === b.jump) presses.current.jump = true;
        if (k === b.dash) presses.current.dash = true;
        if (walk.includes(k)) target.current = null;
      },
    });
  }, [bindings, crouch, frozen]);

  // Tap-to-walk: touch only (refinement 2026-07-22: on fine pointers WASD is the verb and misclicks kept sending you walking).
  const raycaster = useRef(new THREE.Raycaster());
  const handleClick = useCallback((e: MouseEvent) => {
    if (frozen || e.defaultPrevented) return;
    if (!desktopClickToMove && window.matchMedia("(pointer: fine)").matches) return;
    const rect = gl.domElement.getBoundingClientRect();
    raycaster.current.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    // Against the visually curved heightfield, not a flat plane (2026-07-08 sync fix).
    const hit = pickCurvedSurface(raycaster.current.ray, camera, groundHeight);
    if (!hit) return;
    target.current = { x: hit.x, z: hit.z };
    fx.current.stuck = 0;
    playSFX("click");
    const id = indicatorId.current++;
    setIndicators(prev => [...prev, { id, position: [hit.x, groundHeight(hit.x, hit.z), hit.z] }]);
  }, [camera, gl, groundHeight, frozen, desktopClickToMove]);
  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl, handleClick]);

  // Getting up puts you in the open beside the seat, its front first; the avatar eases over from the seat.
  const leaveSeat = useCallback(() => {
    const s = seat.current;
    if (!s) return;
    seat.current = null;
    motion.current.pose = null;
    const [x, z] = clearSpot(world, s.x, s.z, groundHeight(s.x, s.z), s.yaw);
    sim.current = createMoveSim(createMoveState(x, z, world, s.yaw));
    fx.current.rise.set(s.x - x, s.z - z);
    fx.current.sqv += 3;
    setSitNote(false);
  }, [world, groundHeight]);

  // G3 seats: the same seat without a clip stands you up; a different or first seat sits you there. The same seat WITH
  // a clip re-poses you (study: Study in focus, Stretch on breaks). detail.clip picks Sit/Study/Stretch/Sleep; detail.seatY
  // is the furniture's seat (or bed) top in world y, the clip's authored seat height taken off it (ruling 18); detail.yaw
  // faces the seat's front (default: the camera).
  useEffect(() => {
    const onSit = (e: Event) => {
      const { x, z, clip, seatY, yaw = Math.PI } = (e as CustomEvent<{ x: number; z: number; clip?: ClipName; seatY?: number; yaw?: number }>).detail;
      const cur = seat.current, same = !!cur && cur.x === x && cur.z === z;
      const at = (c: ClipName): Seat => ({ x, z, clip: c, yaw, lift: seatY === undefined ? 0 : seatLift(c, seatY - groundHeight(x, z), CHARACTER_SCALE) });
      if (same && clip) { seat.current = at(clip); return; }
      if (same) { leaveSeat(); return; }
      seat.current = at(clip ?? "Sit");
      motion.current.pose = seat.current.clip;
      target.current = null;
      puffRing(particles.pool, groundAt(groundSurface, world, x, z), x, groundHeight(x, z), z);
      setSitNote(true);
      if (sitNoteTimer.current) window.clearTimeout(sitNoteTimer.current);
      sitNoteTimer.current = window.setTimeout(() => setSitNote(false), 1700);
    };
    window.addEventListener("tsi:sit", onSit);
    return () => {
      window.removeEventListener("tsi:sit", onSit);
      if (sitNoteTimer.current) window.clearTimeout(sitNoteTimer.current);
    };
  }, [groundHeight, groundSurface, world, leaveSeat, particles]);

  // World interactions → clips (fish, forage, net, emotes).
  const faceToward = useCallback((x: number, z: number) => turnTo(sim.current?.state, x, z), []);
  useWorldClips(motion, faceToward);

  useEffect(() => {
    // Dev (evidence scripts): read the sim, teleport, drive a route, step the sim a moment at a time.
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __move: {
      sim,
      teleport: (x: number, z: number, facing = 0) => { seat.current = null; sim.current = createMoveSim(createMoveState(x, z, world, facing)); },
      autopilot: (route?: RouteStep[]) => { dev.current.pilot = routePilot(route); },
      pause: () => { dev.current.paused = true; dev.current.budget = 0; },
      run: (seconds: number) => { dev.current.paused = true; dev.current.budget += seconds; },
      resume: () => { dev.current.paused = false; },
      /** Where the avatar is on the page (evidence crops), and the camera (evidence: no lag, no bob). */
      screen: () => (sim.current ? screenOf(interpolated(sim.current), camera, gl.domElement) : null),
      camera: () => camera.position.toArray(),
      /** Particles alive in the scene's movement system, and the ground under the avatar (evidence labels). */
      particles: () => particles.pool.alive,
      ground: () => { const s = sim.current?.state; return s ? groundAt(groundSurface, world, s.x, s.z) : null; },
    } });
  }, [world, camera, gl, particles, groundSurface]);

  useFrame((_state, rawDelta) => {
    const g = anchor.current, bd = body.current, hd = head.current;
    if (!g || !bd || !hd) return;
    const p = combat.rt.player, d = dev.current, f = fx.current, m = motion.current, j = juice ?? MOVE_JUICE, st = touchStick, k = keys.current, b = bindings;
    const t = inCombat ? combatTuning(p.speed) : kit;
    if (!sim.current || simAt.current?.[0] !== x0 || simAt.current[1] !== z0 || simAt.current[2] !== respawn) {
      sim.current = createMoveSim(createMoveState(x0, z0, world));
      simAt.current = [x0, z0, respawn];
    }
    // Spawned or built into something (an exit painted inside a prop, furniture placed where you stand): step out to the nearest open spot.
    const at = sim.current.state;
    if (at.mode === "ground" && !seat.current && (!(at.y < Infinity) || world.wet(at.x, at.z) || world.top(at.x, at.z) > at.y + t.stepUp)) {
      const [x, z] = clearSpot(world, at.x, at.z, groundHeight(at.x, at.z), at.facing, t);
      sim.current = createMoveSim(createMoveState(x, z, world, at.facing));
    }
    if (!reported.current) f.level = sim.current.state.y;
    let dt = Math.min(rawDelta, 0.1) * (timeScale ?? 1);
    if (d.paused) { dt = Math.min(dt, d.budget); d.budget -= dt; }
    if (inCombat && combat.hitstop > 0) dt = 0; // a beat of hitstop: the swing's pose holds too (m.rate)

    // Intent: keys give a unit direction, the stick keeps its tilt; either drops a tap target, and any move gets you up from a seat.
    let ix = (k[b.right] ? 1 : 0) - (k[b.left] ? 1 : 0), iz = (k[b.forward] ? 1 : 0) - (k[b.back] ? 1 : 0);
    const keyed = Math.hypot(ix, iz), tilt = Math.hypot(st.x, st.z);
    if (keyed) { ix /= keyed; iz /= keyed; } else { ix = st.x; iz = st.z; }
    const jumpPressed = !walkOnly && (presses.current.jump || st.jumpPressed), dashPressed = !walkOnly && (presses.current.dash || st.dashPressed);
    presses.current.jump = presses.current.dash = false;
    st.jumpPressed = st.dashPressed = false;
    if (frozen || keyed || tilt > 0.05) target.current = null;
    if (seat.current && !frozen && (keyed || tilt > 0.2 || target.current || jumpPressed || dashPressed)) leaveSeat();

    const s = sim.current!, sitting = seat.current, push = inCombat ? combatPush(p) : undefined;
    let events: MoveEvent[] = [];
    if (!sitting) {
      if (m.pose && SEAT_CLIPS.has(m.pose)) m.pose = null;
      const { fx: fwdX, fz: fwdZ } = getCameraForwardXZ(camera);
      const goal = target.current && towards(s.state, target.current.x, target.current.z, t);
      if (!goal) target.current = null;
      // In the ruins defeat stops you and a cast roots you; the dodge still goes, and breaks the cast (row C3).
      const down = inCombat && !p.alive, live = !frozen && !down && !(inCombat && combat.rt.casting);
      const piloted = d.pilot && dt > 0 ? d.pilot(s.state, dt) : null;
      if (d.pilot && dt > 0 && !piloted) d.pilot = null;
      const input: MoveInput = piloted ?? (live ? {
        x: goal ? goal.x : fwdX * iz - fwdZ * ix, z: goal ? goal.z : fwdZ * iz + fwdX * ix,
        sprint: !walkOnly && (!!k[b.sprint] || (!keyed && tilt > 0.92)), sneak: (!!crouch && !!k[crouch]) || st.crouch,
        jump: !walkOnly && (!!k[b.jump] || st.jump), jumpPressed, dashPressed,
      } : { ...NO_INPUT, dashPressed: !frozen && !down && dashPressed });
      if (inCombat) { input.push = push; if (p.aimHold > 0 || Math.hypot(s.state.vx, s.state.vz) < 0.6) s.state.facing = p.facing; } // attacking or standing: the kit turns from your facing (a dash with no stick goes that way)
      events = advanceMove(s, input, dt, world, t);
      if (target.current) {
        f.stuck = Math.hypot(s.state.vx, s.state.vz) < 0.3 ? f.stuck + dt : 0;
        if (f.stuck > STUCK_TIME) target.current = null;
      }
      if (inCombat && events.some(e => e.kind === "dash")) dashDodge(combat.rt, { x: s.state.dashX, z: s.state.dashZ }, s.state.airDashes > 0); // an air dash: no i-frames
    }
    const state = s.state, speed = sitting ? 0 : Math.hypot(state.vx, state.vz);
    const [x, y, z] = sitting ? [sitting.x, groundHeight(sitting.x, sitting.z), sitting.z] : interpolated(s);
    const wet = world.wet(x, z), floor = wet ? world.top(x, z) - WATER_DROP : world.top(x, z), groundY = Math.min(y, floor);
    const aloft = state.mode === "air" || state.mode === "glide", grounded = !!sitting || (!aloft && state.mode !== "mantle" && state.mode !== "splash");

    // ── Events → clips, particles from our pack by the ground underfoot, sounds, squash (specs/movement-feel.md) ──
    const pool = particles.pool, rain = liveIslandWeather() === "rain";
    for (let i = 0; i < events.length; i++) {
      const e = events[i], clip = EVENT_CLIP[e.kind];
      if (clip && !(e.kind === "dash" && state.mode === "glide")) m.play = clip; // the gust keeps the Glide pose: the leaf stays overhead
      switch (e.kind) {
        case "hop":
          // Touch down and straight back up: a quick squash that springs into the stretch, a light chained puff.
          f.sq = Math.min(f.sq, -0.12 * j.squash); f.sqv = 6 * j.squash;
          takeoff(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z, state.vx, state.vz, j.takeoff, true);
          f.jumped = true; f.vy0 = Math.max(2, state.vy); f.fallT = 0; playSFX("jump"); break;
        case "slidejump":
          // Out of the slide: its own gather (SlideJump), no anticipation hold; a pop of dust where it left the ground.
          f.sqv += 4 * j.squash;
          slidePop(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z, state.vx, state.vz, j.slideBurst);
          f.jumped = true; f.vy0 = Math.max(2, state.vy); f.fallT = 0; playSFX("jump", 0.92); break;
        case "slide": case "dashslide": case "landslide": {
          // Into the slide: the FOV punches out a touch and the camera drops with you; out of a dash or a landing, a spray.
          f.punch = Math.max(f.punch, j.slideKick * (e.kind === "slide" ? 1 : 1.3)); f.sqv -= 2 * j.squash; f.slideT = 0;
          if (e.kind !== "slide") slideBurst(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z, state.vx, state.vz, j.slideBurst * (e.kind === "landslide" ? 0.7 : 1));
          if (e.kind === "dashslide") playSFX("blip4", 0.8, 0.6);
          playSFX("footstep", 0.6, 0.85); break;
        }
        case "stand": if (!m.play) m.play = state.crouch ? "SlideStand" : "SlideUp"; playSFX("footstep", 1.1, 0.55); break;
        case "jump": case "long": case "dashjump":
          // Anticipation, visual only: the body holds a crouch on the ground for a few frames while the sim rises, then springs.
          if (j.anticipation > 0) { f.antic = ANTIC; f.anticY = e.y; f.sq = -0.14 * j.squash * j.anticipation; f.sqv = 0; } else f.sqv += 4.5 * j.squash;
          takeoff(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z, state.vx, state.vz, j.takeoff);
          f.jumped = true; f.vy0 = Math.max(2, state.vy); f.fallT = 0; playSFX("jump"); break;
        case "glide": m.stop = true; f.leafV += 9; leafBits(pool, e.x, e.y + GRIP_Y + 0.95, e.z, groundY); playSFX("blip2"); break;
        case "land": {
          f.jumped = false;
          // A landing that launches the next hop (same step) leaves its thump to the hop; any other ends a short hop's Jump clip (no sliding feet).
          if (events[i + 1] && TAKEOFF.has(events[i + 1].kind)) break;
          m.stop = true;
          const g = groundAt(groundSurface, world, e.x, e.z);
          if (events[i - 1]?.kind === "furl") { puffRing(pool, g, e.x, e.y, e.z, j.landing); playSFX("footstep"); break; } // the leaf sets you down: a soft puff
          if (e.drop < 0.15) break; // a lip too small to feel: no landing at all
          const kind = landKind(e.drop);
          landing(pool, g, kind, e.x, e.y, e.z, state.vx, state.vz, j.landing);
          if (kind === "tap") { f.sqv -= 1.5 * j.squash; playSFX("footstep", 1.2, 0.5); break; }
          f.sqv -= Math.min(9, 2.5 + e.drop * 2.4) * j.squash;
          if (kind === "heavy") {
            // A big drop: the bigger burst, a little dip of the camera, and the long landing pose when not rolling on.
            f.dipV -= 1.7 * j.camDip;
            playSFX("footstep", 0.7); playSFX("exit", 1.5, 0.45);
            if (e.speed < 3 && !m.play) m.play = "LandHeavy";
          } else {
            playSFX("footstep", 0.95);
            if (e.speed < 3 && e.drop > 0.6 && !m.play) m.play = "Land";
          }
          break;
        }
        case "roll": break; // the land before it threw the ring; the roll trails dust (below)
        case "dash": {
          f.sqv -= 2 * j.squash; f.punch = j.dashKick;
          const g = groundAt(groundSurface, world, e.x, e.z);
          dashBurst(pool, g, aloft, e.x, e.y, e.z, groundY, state.dashX, state.dashZ, j.dashBurst);
          // Faint afterimages: the pose you left, and one more a moment in.
          if (j.afterimage > 0) { m.ghost = true; f.ghostT = 0.07; }
          for (let k = 0; k < 2; k++) streak(pool, e.x, e.y, e.z, groundY, state.dashX, state.dashZ, state.dashSpeed, f.streakK++, j.streaks);
          f.streakT = STREAK_EVERY; f.cdT = 0;
          playSFX("blip4", aloft ? 1.2 : 1); break;
        }
        case "skid": playSFX("footstep", 0.85); break;
        case "mantle": {
          const [tx, ty, tz] = state.to;
          handPuff(pool, groundAt(groundSurface, world, tx, tz), (e.x + tx) / 2, ty, (e.z + tz) / 2, j.landing);
          playSFX("blip1"); break;
        }
        case "bonk":
          f.sqv -= 3 * j.squash; playSFX("footstep");
          // A slide into something: the stumble, a thud and a puff.
          if (f.sliding) { m.play = "SlideBonk"; f.dipV -= 1.2 * j.camDip; playSFX("exit", 1.4, 0.45); puffRing(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z, j.slideBurst); }
          break;
        case "splash": splash(pool, e.x, e.y + 0.02, e.z, j.landing); playSFX("blip5"); break;
        case "respawn": puffRing(pool, groundAt(groundSurface, world, e.x, e.z), e.x, e.y, e.z); playSFX("blip3"); f.pan.set(f.focus.x - x - f.lead.x, f.focus.z - z - f.lead.y); break;
      }
    }
    // Footsteps from the feet: each contact the Walk or Run clip passes (Character counts them) throws the ground's
    // flecks, grains or puff from that foot and plays its sound; boards and stone only sound. On rain days, ripples too.
    if (m.steps !== undefined && m.steps !== f.steps) {
      f.steps = m.steps;
      if (!sitting && state.mode === "ground" && speed > 0.6 && state.dashT <= 0) {
        const side = m.foot === 0 ? 0.1 : -0.1, a = state.facing, px = x + Math.cos(a) * side + Math.sin(a) * 0.05, pz = z - Math.sin(a) * side + Math.cos(a) * 0.05;
        // Crouch-walking tiptoes: half the dust and a softer step.
        const soft = state.crouch ? 0.5 : 1, sound = footstep(pool, groundAt(groundSurface, world, px, pz), px, groundY, pz, state.vx, state.vz, rain, j.footsteps * soft);
        playSFX(sound.name, sound.rate, sound.gain * soft);
      }
    }
    // Dust along the ground while skidding (and its scuff), rolling or dashing.
    const trailing = !sitting && grounded && (state.mode === "skid" || state.mode === "roll" || state.dashT > 0);
    f.trail -= dt;
    if (trailing && f.trail <= 0) {
      f.trail = 0.045;
      const g = groundAt(groundSurface, world, x, z);
      trail(pool, g, x - state.vx * 0.02, groundY, z - state.vz * 0.02, state.vx, state.vz, j.footsteps);
      if (state.mode === "skid") scuff(pool, g, x, groundY, z, state.vx, state.vz, j.footsteps);
    }
    // The slide's trail: a beat every 0.5u of travel, dust off the heels, the ground's spray from the lead heel (ahead of the seat), a scuff every third beat.
    if (!sitting && state.mode === "slide") {
      f.slideT -= speed * dt;
      if (f.slideT <= 0) {
        f.slideT = 0.5;
        const g = groundAt(groundSurface, world, x, z), fx0 = Math.sin(state.facing), fz0 = Math.cos(state.facing);
        slideTrail(pool, g, x - state.vx * 0.015, groundY, z - state.vz * 0.015, x + fx0 * 0.36, z + fz0 * 0.36, state.vx, state.vz, f.slideBeat++ % 3 === 0, j.slideTrail);
      }
    }
    // Streaks through a dash, and faintly at top speed or gliding fast; the second afterimage; the settle as a ground dash ends.
    const gliding = !sitting && state.mode === "glide", sprinting = speed > t.walkSpeed * 1.35;
    f.streakT -= dt;
    if (!sitting && f.streakT <= 0 && speed > 0.5) {
      const dashing = state.dashT > 0, faint = sprinting ? 0.3 : gliding && speed > 6 ? 0.22 : 0;
      if (dashing || faint > 0) {
        f.streakT = dashing ? STREAK_EVERY : FAST_STREAK_EVERY;
        streak(pool, x, y, z, groundY, state.vx / speed, state.vz / speed, speed, f.streakK++, (dashing ? 0.85 : faint) * j.streaks);
      }
    }
    if (f.ghostT > 0 && (f.ghostT -= dt) <= 0 && state.dashT > 0) m.ghost = true;
    if (f.dashT > 0 && state.dashT <= 0 && grounded && !sitting) settle(pool, groundAt(groundSurface, world, x, z), x, groundY, z, j.dashBurst);
    f.dashT = state.dashT;
    // The dash cooldown as wind at the heels: a wisp circling the feet that gathers as it fills, lifting away with a glint when it's back.
    const spent = !sitting && aloft && state.airDashes >= t.airDashes, dashReady = !!sitting || (state.dashCd <= 0 && !spent && state.mode !== "recover");
    if (!dashReady && !spent && state.dashT <= 0) {
      f.cdT += dt; f.wispT -= dt;
      if (f.wispT <= 0) { f.wispT = 0.06; cooldownWisp(pool, x, y, z, 1 - state.dashCd / Math.max(0.01, t.dashCooldown), f.cdT, j.cooldown); }
    }
    if (dashReady && !f.ready && !sitting) dashBack(pool, x, y, z, j.cooldown);
    f.ready = dashReady;
    particles.tick(_state.clock.elapsedTime, dt, camera, liveWind());

    // Squash and stretch: a spring, stretched by vertical speed in the air, held in the anticipation crouch, which then
    // springs into the stretch. The drawn body trails the sim's rise through the crouch and catches up. Getting up eases over from the seat.
    const antic = f.antic;
    f.antic = Math.max(0, f.antic - dt);
    if (antic > 0 && f.antic === 0) f.sqv += 5 * j.squash;
    const hold = f.antic / ANTIC, drawnY = y - Math.max(0, y - f.anticY) * hold * hold;
    const want = f.antic > 0 ? -0.14 * j.squash * j.anticipation : !sitting && state.mode === "air" ? THREE.MathUtils.clamp(state.vy * 0.012, -0.07, 0.12) * j.squash : 0;
    f.sqv += ((want - f.sq) * 260 - f.sqv * 16) * dt;
    f.sq = THREE.MathUtils.clamp(f.sq + f.sqv * dt, -0.3, 0.3);
    f.rise.multiplyScalar(Math.exp(-18 * dt));
    const sy = 1 + f.sq, sxz = 1 / Math.sqrt(sy), rx = x + f.rise.x, rz = z + f.rise.y;
    g.position.set(rx, groundY, rz);
    bd.scale.set(sxz, sy, sxz);
    hd.position.set(rx, sitting ? groundY : y + Math.min(1, f.leaf) * 0.45, rz); // the nameplate clears an open leaf

    // Character: yaw, lift above the ground under it, the movement state clip; a seat holds its clip.
    if (sitting) Object.assign(m, { speed: 0, yaw: sitting.yaw, lift: sitting.lift, pose: sitting.clip, move: null });
    else {
      m.yaw = state.facing;
      m.lift = (drawnY - groundY) / sy;
      m.speed = state.mode === "ground" ? Math.hypot(state.vx + (push?.x ?? 0), state.vz + (push?.z ?? 0)) : 0;
      // In the air the Air pose follows vertical speed (rise, apex tuck, fall, reaching for the ground); a long fall bicycles.
      f.fallT = state.mode === "air" && state.vy < 0 ? f.fallT + dt : 0;
      m.air = airPhase(state.vy, f.vy0, f.jumped);
      m.move = gliding ? "Glide" : state.mode === "splash" || (state.mode === "air" && f.fallT > 0.6) ? "Fall" : state.mode === "air" ? "Air" : state.mode === "skid" ? "Skid"
        : state.mode === "slide" ? "Slide" : state.crouch ? (speed > 0.3 ? "CrouchWalk" : "CrouchIdle") : null;
    }
    f.sliding = !sitting && state.mode === "slide";
    // The leaf springs open past full size (the pop) and folds away; gliding banks into turns and sways about the grip.
    f.leafV += (((gliding ? 1 : 0) - f.leaf) * 220 - f.leafV * 15) * dt;
    f.leaf = THREE.MathUtils.clamp(f.leaf + f.leafV * dt, 0, 1.3);
    m.leaf = f.leaf;
    const heading = Math.atan2(state.vx, state.vz), turn = speed > 1 && dt > 0 ? Math.atan2(Math.sin(heading - f.heading), Math.cos(heading - f.heading)) / dt : 0;
    f.heading = heading;
    // Gliding banks into turns and sways about the grip; sliding leans into the steer and lies back deeper the faster it goes (about the seat on the ground).
    const deep = f.sliding ? THREE.MathUtils.clamp((speed - t.walkSpeed * t.slideEnterAt) / Math.max(1, t.momentumCeiling - t.walkSpeed * t.slideEnterAt), 0, 1) : 0;
    f.bank = THREE.MathUtils.damp(f.bank, gliding ? THREE.MathUtils.clamp(-turn * 0.12, -0.3, 0.3) + 0.035 * Math.sin(state.modeT * Math.PI) : f.sliding ? THREE.MathUtils.clamp(-turn * 0.09, -0.24, 0.24) : 0, 6, dt);
    f.pitch = THREE.MathUtils.damp(f.pitch, -0.12 * deep, 5, dt);
    bankAbout(bd, state.facing, f.bank, gliding ? y - groundY + GRIP_Y : 0.05, f.pitch);
    m.rate = rawDelta > 0 ? dt / Math.min(rawDelta, 0.1) : 1;
    if (inCombat) {
      // Encounter: face the way you move, the aim when standing or attacking (combatFacing); attacks, dodges, hits, casting and defeat drive the clips.
      const view: CombatView = { alive: p.alive, dodgeAge: p.dodgeAge, hurt: p.hurt, attackCd: p.attackCd };
      const next = combatClip(view, combatPrev.current ?? view, !!combat.rt.casting, WEAPONS[p.weapon].kind);
      combatPrev.current = view;
      // A slide faces the way it goes like a run (its legs lead), not the aim.
      if (p.alive && dt > 0) p.facing = combatFacing(p, { x, z }, state.facing, state.mode === "ground" || state.mode === "slide" ? speed : 0, dt);
      m.yaw = p.facing;
      m.pose = next.pose;
      if (next.play) m.play = next.play;
    }

    // Camera focus: the avatar, a lead along its velocity, and the level it stands on. A hop never lifts the level;
    // landing on a new one, a mantle (to its top) or falling below it reframes. A respawn pans rather than cuts.
    // Gliding, it eases down with you (no further than 1.5u below, so you stay in frame) toward the ground under you.
    f.level = gliding ? THREE.MathUtils.damp(f.level, Math.min(f.level, Math.max(groundY, y - 1.5)), 3, dt)
      : THREE.MathUtils.damp(f.level, !sitting && state.mode === "mantle" ? state.to[1] : grounded ? y : Math.min(f.level, y), 8, dt);
    const lead = Math.min(1.5, speed * j.camLead), dir = speed > 0.1 ? lead / speed : 0;
    f.lead.x = THREE.MathUtils.damp(f.lead.x, state.vx * dir, 3, dt);
    f.lead.y = THREE.MathUtils.damp(f.lead.y, state.vz * dir, 3, dt);
    f.pan.multiplyScalar(Math.exp(-5 * dt));
    // A heavy landing dips the camera a touch and springs it back.
    f.dipV += (-f.dip * 180 - f.dipV * 18) * dt;
    f.dip += f.dipV * dt;
    // Sliding, the camera's focus drops a little with you.
    f.drop = THREE.MathUtils.damp(f.drop, f.sliding ? j.slideDrop : 0, 8, dt);
    f.focus.set(x + f.lead.x + f.pan.x, f.level + f.dip - f.drop, z + f.lead.y + f.pan.y);
    camTarget?.current.copy(f.focus);
    f.punch *= Math.exp(-6 * dt);
    const fast = THREE.MathUtils.clamp((speed - t.walkSpeed) / Math.max(0.1, topSpeed(t) - t.walkSpeed), 0, 1);
    applyFov(camera, BASE_FOV + j.fovKick * fast + f.punch, Math.min(rawDelta, 0.1));

    if (telemetry) Object.assign(telemetry.current, { x, y, z, speed, mode: state.mode, hops: state.hops, dashReady, long: state.long, momentum: momentumOf(state, speed, t.walkSpeed, t.sprintSpeed), slideJump: state.slideJump });
    const last = reported.current;
    if (!last || Math.abs(last.x - x) + Math.abs(last.y - y) + Math.abs(last.z - z) > 1e-4) {
      (reported.current ??= new THREE.Vector3()).set(x, y, z);
      player?.current.set(x, y, z);
    }
  }, -4);

  return (
    <>
      {/* Sprint A8: tap-to-walk target rings in world space */}
      {indicators.map((ind) => (
        <MoveTargetIndicator key={ind.id} position={ind.position}
          onComplete={() => setIndicators((prev) => prev.filter((i) => i.id !== ind.id))} />
      ))}
      <group ref={anchor} position={spawnPosition}>
        <group ref={body}><PlayerCharacter look={look} motion={motion} inCombat={inCombat} walkSpeed={walkSpeed} leaf={leafOwned} /></group>
      </group>
      <group ref={head} position={spawnPosition}>
        {showNameplate && <Html calculatePosition={calculateCurvedHtmlPosition} zIndexRange={[40, 0]}
          position={[0, CHARACTER_HEIGHT + 0.28, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            className="whitespace-nowrap text-center"
            style={{
              background: "rgba(15, 15, 16, 0.6)",
              padding: "2px 8px",
              borderRadius: "4px",
              boxShadow: member ? "0 0 0 1px rgba(96, 165, 250, 0.55), 0 0 10px rgba(96, 165, 250, 0.45)" : undefined,
            }}
            data-member={member || undefined}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#f1ffff", lineHeight: 1.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {member && <span aria-label="TSI member" title="TSI member" style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 4px #60A5FA", flex: "none" }} />}
              {playerName}
            </div>
            {playerLevel !== undefined && <div style={{ fontSize: "9px", color: "#b8c3c3", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.2 }}>
              Lv. {playerLevel}
            </div>}
          </div>
        </Html>}

        {/* Cozy sit beat: a brief contented note over the head. */}
        {sitNote && (
          <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 2.1, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div style={{ fontSize: 20, animation: "tsi-sit-note 1.7s ease-out forwards" }}>♪</div>
            <style>{`
              @keyframes tsi-sit-note {
                0% { opacity: 0; transform: translateY(6px) rotate(-8deg); }
                20% { opacity: 0.9; transform: translateY(0) rotate(4deg); }
                100% { opacity: 0; transform: translateY(-14px) rotate(-4deg); }
              }
            `}</style>
          </Html>
        )}
      </group>
    </>
  );
}

/** The player's character, with the equipped weapon: in hand in an encounter, across the back once the ruins gate is open (row 140). */
function PlayerCharacter({ look, motion, inCombat, walkSpeed, leaf }: { look: CharacterLook; motion: React.RefObject<CharacterMotion>; inCombat: boolean; walkSpeed: number; leaf: boolean }) {
  // Only the weapon, and whether it shows, re-render the character (the runtime publishes ~10×/s).
  const key = useCombatValue(() => combat.rt.player.weapon), shown = useCombatValue(() => (inCombat ? combat.rt.player.alive : combat.rt.player.armed));
  const weapon = useMemo(() => {
    const w = WEAPONS[key];
    return w?.model && shown ? { kind: w.kind, model: w.model, modelScale: w.modelScale, inHand: inCombat, grip: w.grip } : null;
  }, [key, shown, inCombat]);
  return <Character look={look} motion={motion} walkSpeed={walkSpeed} weapon={weapon} leaf={leaf} />;
}
