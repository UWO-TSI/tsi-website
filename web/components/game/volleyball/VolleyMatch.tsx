"use client";

/**
 * The match's full view (specs/minigames/beach-volleyball.md), mounted only for the player in it: the over-the-shoulder
 * camera, the keys and the mouse, the match stepped at the movement sim's rate, the bots, the ball, the rings (the
 * landing circle on the sand, the serve's timing circle round the ball, the aim on the far side), the calls and the
 * juice. Everyone else sees the court's light view (Court.tsx) and this player's avatar, moved through its ride
 * (myTrip.ride), which syncs like any walk. Everything here sits in the court's frame (a group at the court's middle).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import Character from "../character/Character";
import { useMoveParticles, liveWind } from "../movement/moveFx";
import { landing as landPuff, slideBurst, takeoff } from "@/lib/game/movement/juice";
import { useMoveKeys } from "@/lib/game/movement/keys";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { myTrip } from "@/lib/game/myTrip";
import { randomLook, seeded, type CharacterLook } from "@/lib/game/character/look";
import type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
import { BALL_R, sideOf, toLocal, toWorld } from "@/lib/game/volleyball/court";
import { timeToHeight } from "@/lib/game/volleyball/ball";
import { COURT_TUNING, HAND, NO_COURT_INPUT, advanceMatch, serverOf, sideOfPlayer, type CourtInput, type Match, type MatchEvent } from "@/lib/game/volleyball/match";
import { SERVE_WINDOW, serveError } from "@/lib/game/volleyball/timing";
import { GRAVITY } from "@/lib/game/volleyball/ball";
import { volley, volleyChanged, type CourtSpot } from "@/lib/game/volleyball/session";
import styles from "./volley.module.css";

/** The over-the-shoulder camera (the reference: close, behind the back, the right shoulder). */
export const VB_CAMERA = { back: 2.7, right: 0.6, up: 1.75, ahead: 6, lookUp: 0.9, fov: 60, pitch: { min: -0.35, max: 0.45 }, sensitivity: 0.0028 };
/** Team edges under the players' feet (home, away): 3D materials, not UI. */
const TEAM = ["#ef7a5a", "#4bb3c8"];
/** The landing circle: full size this many seconds out, closing to the inner ring (a fifth of it) as the ball reaches your hands. */
const RING_T = 1.1, RING_R = 1.1;

const CONTACT_CLIP: Record<string, { play?: ClipName; upper?: ClipName }> = {
  bump: { play: "Pickup" }, set: { upper: "Cheer" }, jumpset: { upper: "Cheer" }, spike: { upper: "AttackMelee" },
  block: { upper: "Cheer" }, serve: { upper: "AttackMelee" }, dig: {},
};

const newMotion = (): CharacterMotion => ({ speed: 0, yaw: 0, lift: 0 });
/** The Air clip's phase from the vertical speed: 0 take-off, 0.5 the top, 1 reaching for the sand. */
const airPhase = (vy: number) => { const v0 = (2 * COURT_TUNING.jumpHeight) / COURT_TUNING.jumpApexTime; return vy > 0 ? 0.5 * (1 - Math.min(1, vy / v0)) : 0.5 + 0.5 * Math.min(1, -vy / v0); };

type Dev = { input: Partial<CourtInput>; yaw: number | null; pitch: number | null; paused: boolean; steps: number; log: MatchEvent[] };

interface Rig {
  keys: Record<string, boolean>;
  presses: { jump: boolean; dash: boolean; left: boolean; leftUp: boolean; right: boolean; e: boolean; ctrl: boolean };
  left: boolean; yaw: number; pitch: number; shake: number; stop: number; slow: number; airborne: boolean[];
  dev: Dev; motions: CharacterMotion[]; motionRefs: { current: CharacterMotion }[];
  look: THREE.Vector3; ray: THREE.Raycaster; centre: THREE.Vector2; plane: THREE.Plane; hit: THREE.Vector3;
}
function newRig(spot: CourtSpot): Rig {
  const motions = [0, 1, 2, 3].map(newMotion);
  return {
    keys: {}, presses: { jump: false, dash: false, left: false, leftUp: false, right: false, e: false, ctrl: false }, left: false,
    yaw: 0, pitch: 0.08, shake: 0, stop: 0, slow: 0, airborne: [false, false, false, false],
    dev: { input: {}, yaw: null, pitch: null, paused: false, steps: 0, log: [] }, motions, motionRefs: motions.map(current => ({ current })),
    look: new THREE.Vector3(), ray: new THREE.Raycaster(), centre: new THREE.Vector2(0, -0.1), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -spot.y), hit: new THREE.Vector3(),
  };
}
type Ref<T> = { current: T };
interface Parts {
  bodies: Ref<(THREE.Group | null)[]>; calls: Ref<(HTMLDivElement | null)[]>; ball: Ref<THREE.Mesh | null>; shadow: Ref<THREE.Mesh | null>;
  landRing: Ref<THREE.Group | null>; outer: Ref<THREE.Mesh | null>; serveRing: Ref<THREE.Group | null>; serveOuter: Ref<THREE.Mesh | null>;
  aimMark: Ref<THREE.Mesh | null>; flashes: Ref<THREE.Mesh[]>;
}
interface Env { spot: CourtSpot; camera: THREE.Camera; particles: ReturnType<typeof useMoveParticles>; bindings: ReturnType<typeof useMoveKeys>; selfLook?: CharacterLook }

/** Face the net from your side as the match starts. */
function faceNet(rig: Rig, m: Match, spot: CourtSpot) {
  const [fx, fz] = toWorld({ x: 0, z: 0, yaw: spot.yaw }, 0, -sideOfPlayer(m, 0));
  rig.yaw = Math.atan2(fx, fz);
}

/** Keys and buttons: WASD, Space, Q, Shift from the movement keys; E, Ctrl, the mouse buttons for the court. */
function bindCourtInput(rig: Rig, b: ReturnType<typeof useMoveKeys>, el: HTMLCanvasElement) {
  const p = rig.presses;
  const unbind = bindGameKeys({ keys: rig.keys, accepted: [b.forward, b.left, b.back, b.right, b.jump, b.dash, b.sprint, "e", "control"],
    onPress: (e) => {
      const k = e.key.toLowerCase();
      if (k === b.jump || k === b.dash || k === "control" || e.ctrlKey) e.preventDefault();
      if (e.repeat) return;
      if (k === b.jump) p.jump = true;
      if (k === b.dash) p.dash = true;
      if (k === "e") p.e = true;
      if (k === "control") p.ctrl = true;
    } });
  const down = (e: MouseEvent) => {
    if (e.button === 0) { p.left = true; rig.left = true; }
    if (e.button === 2) p.right = true;
    if (!document.pointerLockElement) Promise.resolve(el.requestPointerLock?.()).catch(() => {});
  };
  const up = (e: MouseEvent) => { if (e.button === 0) { rig.left = false; p.leftUp = true; } };
  const move = (e: MouseEvent) => {
    if (document.pointerLockElement !== el) return;
    rig.yaw -= e.movementX * VB_CAMERA.sensitivity;
    rig.pitch = THREE.MathUtils.clamp(rig.pitch + e.movementY * VB_CAMERA.sensitivity, VB_CAMERA.pitch.min, VB_CAMERA.pitch.max);
  };
  const menu = (e: Event) => e.preventDefault();
  el.addEventListener("mousedown", down);
  window.addEventListener("mouseup", up);
  window.addEventListener("mousemove", move);
  el.addEventListener("contextmenu", menu);
  return () => { unbind(); el.removeEventListener("mousedown", down); window.removeEventListener("mouseup", up); window.removeEventListener("mousemove", move); el.removeEventListener("contextmenu", menu); };
}

/** Dev only (evidence): script the inputs, set the look, pause and step. */
function exposeDev(rig: Rig, spot: CourtSpot) {
  if (process.env.NODE_ENV === "production") return;
  const w = window as unknown as { __volley?: unknown };
  w.__volley = { dev: rig.dev, match: () => volley.match, spot };
  return () => { delete w.__volley; };
}

/** Leaving: your avatar walks on from where the match left it. */
function leaveRide() { myTrip.ride.active = false; }

/** One frame: the inputs into the match, the match stepped, the players, the ball, the rings and the camera. */
function frameStep(rig: Rig, P: Parts, E: Env, state: { clock: THREE.Clock }, raw: number) {
  const match = volley.match;
  if (!match) return;
  const dt = Math.min(raw, 0.1), d = rig.dev, p = rig.presses, b = E.bindings, k = rig.keys;
  if (d.yaw !== null) rig.yaw = d.yaw;
  if (d.pitch !== null) rig.pitch = d.pitch;
  // Camera-relative walking, turned into the court's frame.
  const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
  const ix = (k[b.right] ? 1 : 0) - (k[b.left] ? 1 : 0), iz = (k[b.forward] ? 1 : 0) - (k[b.back] ? 1 : 0);
  const wx = sy * iz - cy * ix, wz = cy * iz + sy * ix;
  const c = Math.cos(E.spot.yaw), s = Math.sin(E.spot.yaw);
  // The look's aim on the sand (the screen's middle, a touch low), in the court's frame.
  rig.ray.setFromCamera(rig.centre, E.camera);
  const aimAt = rig.ray.ray.intersectPlane(rig.plane, rig.hit) ? toLocal(E.spot, rig.hit.x, rig.hit.z) : null;
  const input: CourtInput = { ...NO_COURT_INPUT, x: wx * c - wz * s, z: wx * s + wz * c, sprint: !!k[b.sprint], jump: !!k[b.jump], jumpPressed: p.jump, dashPressed: p.dash,
    left: rig.left, leftPressed: p.left, leftReleased: p.leftUp, ePressed: p.e, rightPressed: p.right, ctrlPressed: p.ctrl,
    aim: aimAt ? { x: aimAt[0], z: aimAt[1] } : null, ...d.input };
  p.jump = p.dash = p.left = p.leftUp = p.right = p.e = p.ctrl = false;
  // Hit stop on a spike, slow motion on the win.
  let step = dt;
  if (rig.stop > 0) { rig.stop -= dt; step = 0; }
  if (rig.slow > 0) { rig.slow -= dt; step *= 0.35; }
  if (d.paused) { step = d.steps > 0 ? 1 / 60 : 0; d.steps = Math.max(0, d.steps - 1); }
  const phase0 = match.phase, score0 = match.score.points[0] + match.score.points[1];
  const events = advanceMatch(match, input, step);
  for (const e of events) juice(rig, P, E, e, match);
  if (events.length && process.env.NODE_ENV !== "production") { d.log.push(...events); if (d.log.length > 300) d.log.splice(0, d.log.length - 300); }
  if (match.phase !== phase0 || match.score.points[0] + match.score.points[1] !== score0 || events.some(e => e.kind === "toss" || e.kind === "call")) volleyChanged();
  E.particles.tick(state.clock.elapsedTime, dt, E.camera, liveWind());

  // The players: bots (and you, in the lab) drawn here; on the island you through the ride.
  for (let i = 0; i < 4; i++) {
    const pl = match.players[i], mo = rig.motions[i], g = P.bodies.current[i];
    const air = pl.s.mode === "air";
    Object.assign(mo, { speed: pl.down > 0 || pl.dive ? 0 : Math.hypot(pl.s.vx, pl.s.vz), yaw: pl.s.facing, move: pl.dive?.strong || pl.down > 0 ? "Slide" : air ? "Air" : null, air: airPhase(pl.s.vy) });
    if (rig.airborne[i] !== air) {
      rig.airborne[i] = air;
      const [gx, gz] = toWorld(E.spot, pl.s.x, pl.s.z);
      if (air) takeoff(E.particles.pool, "sand", gx, E.spot.y + pl.s.y, gz, 0, 0, 0.8); else landPuff(E.particles.pool, "sand", "normal", gx, E.spot.y + pl.s.y, gz, 0, 0, 0.8);
    }
    if (g) g.position.set(pl.s.x, pl.s.y, pl.s.z);
    const call = P.calls.current[i];
    if (call) call.style.opacity = pl.call > 0 ? "1" : "0";
    if (i === 0 && !E.selfLook) {
      const r = myTrip.ride, [rx, rz] = toWorld(E.spot, pl.s.x, pl.s.z);
      Object.assign(r, { active: true, x: rx, y: E.spot.y + pl.s.y, z: rz, yaw: pl.s.facing + E.spot.yaw, speed: mo.speed, seated: false, lift: 0, roll: 0, pitch: 0,
        ground: "sand", move: mo.move, air: mo.air });
      r.focus.x = rx; r.focus.y = E.spot.y + pl.s.y; r.focus.z = rz;
      if (mo.play) { r.play = mo.play; mo.play = null; }
      if (mo.upper) { r.upper = mo.upper; mo.upper = null; }
    }
  }

  // The ball and its shadow.
  const bl = match.ball, gy = match.ground(bl.x, bl.z);
  P.ball.current?.position.set(bl.x, bl.y, bl.z);
  if (P.ball.current) P.ball.current.rotation.x += (bl.vz * dt) / BALL_R * 0.3;
  if (P.shadow.current) { P.shadow.current.position.set(bl.x, gy + 0.02, bl.z); const h = Math.max(0, bl.y - gy); P.shadow.current.scale.setScalar(Math.max(0.4, 1.4 - h * 0.12)); }

  // The landing circle: on your side, closing in as the ball comes down to your hands.
  const me = match.players[0], mySide = sideOfPlayer(match, 0);
  const land = match.phase === "rally" && match.landing && sideOf(match.landing.z) === mySide ? match.landing : null;
  if (P.landRing.current) {
    P.landRing.current.visible = !!land;
    if (land) {
      P.landRing.current.position.set(land.x, match.ground(land.x, land.z) + 0.03, land.z);
      const t = timeToHeight(bl, me.s.y + (me.s.mode === "air" ? HAND.spike : HAND.bump)) ?? 0;
      P.outer.current?.scale.setScalar(0.2 + 0.8 * Math.min(1, t / RING_T));
    }
  }
  // The serve's timing circle round the ball while you serve.
  const serving = match.phase === "toss" && serverOf(match) === 0;
  if (P.serveRing.current) {
    P.serveRing.current.visible = serving;
    if (serving) {
      P.serveRing.current.position.set(bl.x, bl.y, bl.z);
      P.serveRing.current.quaternion.copy(E.camera.quaternion);
      const err = -serveError(bl.y, bl.vy, me.s.y + HAND.serve, GRAVITY);
      P.serveOuter.current?.scale.setScalar(Math.max(0.2, Math.min(3, 1 + Math.max(0, err) / SERVE_WINDOW.good * 0.9)));
    }
  }
  // Where you look: on the far side while you serve or are in the air.
  if (P.aimMark.current) {
    const show = !!aimAt && (match.phase === "serve" || serving || me.s.mode === "air") && sideOf(aimAt[1]) !== mySide;
    P.aimMark.current.visible = show;
    if (show) P.aimMark.current.position.set(aimAt![0], match.ground(aimAt![0], aimAt![1]) + 0.04, aimAt![1]);
  }
  // Contact flashes fade out.
  for (const f of P.flashes.current) if (f.visible) { const mat = f.material as THREE.MeshBasicMaterial; mat.opacity -= dt * 3; f.scale.multiplyScalar(1 + dt * 4); if (mat.opacity <= 0) f.visible = false; }

  // The E.camera: behind your back, over the right shoulder.
  const [px, pz] = toWorld(E.spot, me.s.x, me.s.z), py = E.spot.y + me.s.y;
  const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw), rx = -fz, rz = fx;
  rig.shake = Math.max(0, rig.shake - dt * 2.5);
  const sh = rig.shake * rig.shake * 0.12, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
  E.camera.position.set(px - fx * VB_CAMERA.back + rx * VB_CAMERA.right + jx, py + VB_CAMERA.up + jy, pz - fz * VB_CAMERA.back + rz * VB_CAMERA.right);
  rig.look.set(px + fx * VB_CAMERA.ahead, py + VB_CAMERA.lookUp - rig.pitch * VB_CAMERA.ahead, pz + fz * VB_CAMERA.ahead);
  E.camera.lookAt(rig.look);
  const cam = E.camera as THREE.PerspectiveCamera;
  if (cam.isPerspectiveCamera && cam.fov !== VB_CAMERA.fov) { cam.fov = VB_CAMERA.fov; cam.updateProjectionMatrix(); }
}

/** One event's juice: clips, sand, a flash, the camera. */
function juice(rig: Rig, P: Parts, E: Env, e: MatchEvent, match: Match) {
  const pool = E.particles.pool;
  if (e.kind === "contact") {
    const clip = CONTACT_CLIP[e.how];
    if (clip?.play) rig.motions[e.who].play = clip.play;
    if (clip?.upper) rig.motions[e.who].upper = clip.upper;
    const f = P.flashes.current.find(x => !x.visible);
    if (f) { f.visible = true; f.position.set(e.x, e.y, e.z); f.scale.setScalar(0.2 + e.quality * 0.2); (f.material as THREE.MeshBasicMaterial).opacity = 0.9; f.quaternion.copy(E.camera.quaternion); }
    if (e.how === "spike") { rig.stop = 0.04; rig.shake = Math.max(rig.shake, 0.6 + e.quality * 0.4); }
    if (e.how === "block") rig.shake = Math.max(rig.shake, 0.5);
  } else if (e.kind === "toss") rig.motions[e.who].upper = "CastSwing";
  else if (e.kind === "call") rig.motions[e.who].upper = "Wave";
  else if (e.kind === "dive") {
    const pl = match.players[e.who], [gx, gz] = toWorld(E.spot, pl.s.x, pl.s.z);
    if (!e.strong) rig.motions[e.who].play = "DodgeRoll";
    slideBurst(pool, "sand", gx, E.spot.y + pl.s.y, gz, 0, 0, e.strong ? 1.4 : 1);
  } else if (e.kind === "land") {
    const [gx, gz] = toWorld(E.spot, e.x, e.z);
    landPuff(pool, "sand", "heavy", gx, E.spot.y + match.ground(e.x, e.z), gz, 0, 0, 1.6);
  } else if (e.kind === "point") {
    rig.shake = Math.max(rig.shake, 0.5);
    for (let i = 0; i < 4; i++) rig.motions[i].upper = match.players[i].team === e.team ? "Cheer" : null;
  } else if (e.kind === "win") { rig.slow = 1.6; for (let i = 0; i < 4; i++) if (match.players[i].team === e.team) rig.motions[i].play = "Cheer"; }
}

export default function VolleyMatch({ spot, selfLook }: {
  spot: CourtSpot;
  /** The lab draws you here; on the island your own avatar is moved through its ride. */
  selfLook?: CharacterLook;
}) {
  const { camera, gl } = useThree();
  const particles = useMoveParticles();
  const bindings = useMoveKeys();
  const rig = useMemo(() => newRig(spot), [spot]);
  const looks = useMemo(() => { const r = seeded(Math.floor(spot.x * 31 + spot.z)); return [0, 1, 2, 3].map(() => randomLook(r)); }, [spot]);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const calls = useRef<(HTMLDivElement | null)[]>([]);
  const ball = useRef<THREE.Mesh>(null), shadow = useRef<THREE.Mesh>(null);
  const landRing = useRef<THREE.Group>(null), outer = useRef<THREE.Mesh>(null);
  const serveRing = useRef<THREE.Group>(null), serveOuter = useRef<THREE.Mesh>(null);
  const aimMark = useRef<THREE.Mesh>(null);
  const flashes = useRef<THREE.Mesh[]>([]);
  const m = volley.match;
  useEffect(() => { if (m) faceNet(rig, m, spot); }, [m, spot, rig]);
  useEffect(() => bindCourtInput(rig, bindings, gl.domElement), [rig, bindings, gl]);
  useEffect(() => leaveRide, []);
  useEffect(() => exposeDev(rig, spot), [rig, spot]);
  useFrame((state, raw) => frameStep(rig, { bodies, calls, ball, shadow, landRing, outer, serveRing, serveOuter, aimMark, flashes }, { spot, camera, particles, bindings, selfLook }, state, raw));

  if (!m) return null;
  const drawn = selfLook ? [0, 1, 2, 3] : [1, 2, 3];
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]}>
      {drawn.map(i => (
        <group key={i} ref={g => { bodies.current[i] = g; }}>
          <Suspense fallback={null}><Character look={i === 0 && selfLook ? selfLook : looks[i]} motion={rig.motionRefs[i]} walkSpeed={COURT_TUNING.walkSpeed} /></Suspense>
          <mesh rotation-x={-Math.PI / 2} position-y={0.03}><ringGeometry args={[0.36, 0.42, 32]} /><meshBasicMaterial color={TEAM[m.players[i].team]} transparent opacity={0.85} depthWrite={false} /></mesh>
          <Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]}><div ref={el => { calls.current[i] = el; }} className={styles.call} style={{ opacity: 0 }}>Mine!</div></Html>
        </group>
      ))}
      {/* Your own "Mine!" on the island: over your avatar, which the ride moves. */}
      {!selfLook && <group ref={g => { bodies.current[0] = g; }}><Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]}><div ref={el => { calls.current[0] = el; }} className={styles.call} style={{ opacity: 0 }}>Mine!</div></Html></group>}
      <mesh ref={ball} castShadow><icosahedronGeometry args={[BALL_R, 2]} /><meshStandardMaterial color="#fbf6ea" roughness={0.5} /></mesh>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}><circleGeometry args={[BALL_R * 1.2, 20]} /><meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} /></mesh>
      <group ref={landRing} visible={false}>
        <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[RING_R * 0.2 - 0.04, RING_R * 0.2, 40]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} /></mesh>
        <mesh ref={outer} rotation-x={-Math.PI / 2}><ringGeometry args={[RING_R - 0.05, RING_R, 48]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} /></mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-0.005}><ringGeometry args={[RING_R * 0.2 - 0.08, RING_R * 0.2 + 0.04, 40]} /><meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} /></mesh>
      </group>
      <group ref={serveRing} visible={false}>
        <mesh><ringGeometry args={[0.2, 0.23, 40]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} /></mesh>
        <mesh ref={serveOuter}><ringGeometry args={[0.2, 0.225, 40]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.95} depthTest={false} /></mesh>
      </group>
      <mesh ref={aimMark} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[0.16, 0.22, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} /></mesh>
      {[0, 1, 2].map(i => <mesh key={i} ref={f => { if (f) flashes.current[i] = f; }} visible={false}><ringGeometry args={[0.7, 1, 32]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>)}
    </group>
  );
}
