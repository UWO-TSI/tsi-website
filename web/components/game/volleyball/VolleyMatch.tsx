"use client";

/**
 * The match's full view (specs/minigames/beach-volleyball.md), mounted only for the player in it: the camera (a glide
 * into the court as the match starts, then over the shoulder), the court's controls (lib/game/volleyball/courtInput),
 * the match stepped at the movement sim's rate with its slow motion (feel.ts), the bots, the beach ball with its squash
 * and stretch, the rings (the landing circle on the sand, the serve's timing ring with its aiming cursor, the aim on the
 * far side), the calls and the placeholder juice. Everyone else sees the court's light view (Court.tsx) and this
 * player's avatar, moved through its ride (myTrip.ride). Everything here sits in the court's frame (a group at the
 * court's middle).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character from "../character/Character";
import VolleyFx from "./VolleyFx";
import { CUT_FLOOR, CUT_RADIUS, CUTOUT, CUTOUT_CROWN, CUTOUT_VIEW, lineBlocked, type Occluder } from "@/lib/game/occluders";
import { bendViewPoint } from "@/lib/game/worldProjection";
import { useMoveKeys } from "@/lib/game/movement/keys";
import { myTrip } from "@/lib/game/myTrip";
import { randomLook, seeded, type CharacterLook } from "@/lib/game/character/look";
import type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
import { BALL_R, COURT, sideOf, toLocal, toWorld } from "@/lib/game/volleyball/court";
import { timeToHeight } from "@/lib/game/volleyball/ball";
import { COURT_TUNING, HAND, NO_COURT_INPUT, advanceMatch, reachOf, serveErrNow, serverOf, sideOfPlayer, type CourtInput, type Match, type MatchEvent, type Touch } from "@/lib/game/volleyball/match";
import { SERVE_WINDOW, grade } from "@/lib/game/volleyball/timing";
import { VB_FEEL } from "@/lib/game/volleyball/feel";
import { stanceOf } from "@/lib/game/volleyball/actions";
import { bindCourtControls, newControls, takePresses, type CourtControls } from "@/lib/game/volleyball/courtInput";
import { MOVE_OF, clipFor, stanceClip, syncRate } from "@/lib/game/volleyball/moves";
import { VB_CLIPS_URL, type VbClip } from "@/lib/game/volleyball/clips";
import { emitFx, fxBus } from "@/lib/game/volleyball/fxBus";
import { noteFlash, volley, volleyChanged, volleyOver, type CourtSpot } from "@/lib/game/volleyball/session";
import styles from "./volley.module.css";

/**
 * The camera. Over the shoulder (the reference: close, behind the back, the right shoulder), and on the match's start
 * a glide into the court (as the sushi bar's stool view glides in): from wherever the island's camera was, up and
 * behind your baseline to take in the whole court, then down to your shoulder. The island's fog draws in while you
 * play, so the court is the stage.
 */
export const VB_CAMERA = {
  back: 3.1, right: 0.65, up: 1.95, ahead: 7, lookUp: 1.0, fov: 60, pitch: { min: -0.35, max: 0.5 }, sensitivity: 0.0028,
  intro: { time: 1.8, high: 7, behind: 8 },
  stageFog: { near: 20, far: 70 },
};
/** Team edges under the players' feet (home, away): 3D materials, not UI. */
const TEAM = ["#ef7a5a", "#4bb3c8"];
/** The landing circle: full size this many seconds out, closing to the inner ring (a fifth of it) as the ball reaches your hands. */
const RING_T = 1.4, RING_R = 1.2;
/** The serve's timing ring round the ball: the target ring's radius (u). */
const SERVE_R = 0.5;
export const BALL_URL = "/assets/game/props/beach-ball.glb";
const NONE: readonly Occluder[] = [];

const newMotion = (): CharacterMotion => ({ speed: 0, yaw: 0, lift: 0 });
/** The Air clip's phase from the vertical speed: 0 take-off, 0.5 the top, 1 reaching for the sand. */
const airPhase = (vy: number) => { const v0 = (2 * COURT_TUNING.jumpHeight) / COURT_TUNING.jumpApexTime; return vy > 0 ? 0.5 * (1 - Math.min(1, vy / v0)) : 0.5 + 0.5 * Math.min(1, -vy / v0); };

/** Dev only (evidence): scripted inputs, the look, pause and step, the log, and a fixed camera beside the ball (`side`: its offset, court frame). */
type Dev = { input: Partial<CourtInput>; yaw: number | null; pitch: number | null; paused: boolean; steps: number; log: MatchEvent[]; side: [number, number, number] | null };

interface Rig {
  parts?: Parts; cam?: THREE.Camera; cut: number; c: CourtControls; yaw: number; pitch: number; lift: number; shake: number; time: number; airborne: boolean[];
  intro: number; fog: { obj: THREE.Fog | null; near: number; far: number };
  squash: { t: number; dir: THREE.Vector3 }; spinAxis: THREE.Vector3; lastPhase: string;
  dev: Dev; motions: CharacterMotion[]; motionRefs: { current: CharacterMotion }[];
  look: THREE.Vector3; ray: THREE.Raycaster; centre: THREE.Vector2; plane: THREE.Plane; hit: THREE.Vector3;
  pos: THREE.Vector3; at: THREE.Vector3; est: THREE.Vector3; estLook: THREE.Vector3; fromPos: THREE.Vector3; fromLook: THREE.Vector3;
}
function newRig(spot: CourtSpot): Rig {
  const motions = [0, 1, 2, 3].map(newMotion);
  return {
    cut: 0, c: newControls(), yaw: 0, pitch: 0.08, lift: 0, shake: 0, time: 1, airborne: [false, false, false, false],
    intro: 0, fog: { obj: null, near: 0, far: 0 },
    squash: { t: 9, dir: new THREE.Vector3(0, 1, 0) }, spinAxis: new THREE.Vector3(1, 0, 0), lastPhase: "",
    dev: { input: {}, yaw: null, pitch: null, paused: false, steps: 0, log: [], side: null }, motions, motionRefs: motions.map(current => ({ current })),
    look: new THREE.Vector3(), ray: new THREE.Raycaster(), centre: new THREE.Vector2(0, -0.1), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -spot.y), hit: new THREE.Vector3(),
    pos: new THREE.Vector3(), at: new THREE.Vector3(), est: new THREE.Vector3(), estLook: new THREE.Vector3(), fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  };
}
type Ref<T> = { current: T };
interface Parts {
  bodies: Ref<(THREE.Group | null)[]>; calls: Ref<(HTMLDivElement | null)[]>;
  ball: Ref<THREE.Group | null>; spin: Ref<THREE.Group | null>; shadow: Ref<THREE.Mesh | null>;
  landRing: Ref<THREE.Group | null>; outer: Ref<THREE.Mesh | null>; serveRing: Ref<THREE.Group | null>; serveOuter: Ref<THREE.Mesh | null>; cursor: Ref<THREE.Mesh | null>;
  aimMark: Ref<THREE.Mesh | null>;
}
interface Env { spot: CourtSpot; camera: THREE.Camera; scene: THREE.Scene; occluders: readonly Occluder[]; bindings: ReturnType<typeof useMoveKeys>; selfLook?: CharacterLook }

const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

/** Face the net from your side as the match starts. */
function faceNet(rig: Rig, m: Match, spot: CourtSpot) {
  const [fx, fz] = toWorld({ x: 0, z: 0, yaw: spot.yaw }, 0, -sideOfPlayer(m, 0));
  rig.yaw = Math.atan2(fx, fz);
  rig.intro = 0;
}

/** Dev only (evidence): script the inputs, set the look, pause and step; the controls for real-input checks. */
function exposeDev(rig: Rig, spot: CourtSpot) {
  if (process.env.NODE_ENV === "production") return;
  const w = window as unknown as { __volley?: unknown };
  // Read-only probes for real-input checks: the serve's timing error now and a touch's reach for you.
  const probe = {
    serveErr: () => { const m = volley.match; return m ? serveErrNow(m.ball, m.players[0].s.y + HAND.serve) : null; },
    reach: (how: Touch) => { const m = volley.match; return m ? reachOf(m, 0, how) : null; },
    stance: () => { const m = volley.match; return m ? stanceOf(m, 0) : null; },
    yaw: () => rig.yaw, intro: () => rig.intro, time: () => rig.time, hand: () => HAND,
    /** The ball on screen (px), for close-up crops. */
    screen: () => { const g = rig.parts?.ball.current; if (!g || !rig.cam) return null; const v = g.getWorldPosition(new THREE.Vector3()).project(rig.cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
    ring: () => { const g = rig.parts?.serveRing.current; if (!g) return null; const w = g.getWorldPosition(new THREE.Vector3()); return { visible: g.visible, w: w.toArray(), kids: g.children.map(c => (c as THREE.Mesh).visible), scale: g.scale.toArray(), parentVisible: g.parent?.visible }; },
  };
  w.__volley = { dev: rig.dev, match: () => volley.match, spot, controls: rig.c, probe };
  return () => { delete w.__volley; };
}

/** Leaving: your avatar walks on from where the match left it; the island's fog comes back. */
function leave(rig: Rig) {
  myTrip.ride.active = false;
  const f = rig.fog;
  if (f.obj) { f.obj.near = f.near; f.obj.far = f.far; f.obj = null; }
}

/**
 * A move's clip on player `i` (the borrowed clip until vb_clips.glb lands, moves.ts), timed so its contact frame meets
 * the ball `inS` seconds from now.
 */
function playMove(rig: Rig, i: number, move: VbClip | undefined, inS = 0) {
  if (!move) return;
  const c = clipFor(move), mo = rig.motions[i];
  mo.play = c.clip;
  mo.playRate = syncRate(c.contact, inS);
}

/** One frame: the inputs into the match, the match stepped, the players, the ball, the rings and the camera. */
function frameStep(rig: Rig, P: Parts, E: Env, raw: number) {
  const match = volley.match;
  rig.parts = P; rig.cam = E.camera;
  if (!match) return;
  const dt = Math.min(raw, 0.1), d = rig.dev, c = rig.c, k = c.keys, b = E.bindings;
  // The look: the mouse turns the camera (when it isn't curving the serve or aiming the ring).
  rig.yaw -= c.look.dx * VB_CAMERA.sensitivity;
  rig.pitch = THREE.MathUtils.clamp(rig.pitch + c.look.dy * VB_CAMERA.sensitivity, VB_CAMERA.pitch.min, VB_CAMERA.pitch.max);
  c.look.dx = c.look.dy = 0;
  if (d.yaw !== null) rig.yaw = d.yaw;
  if (d.pitch !== null) rig.pitch = d.pitch;
  const stance = stanceOf(match, 0);
  // A new toss: the ring's cursor starts in the middle.
  if (match.phase !== rig.lastPhase) { if (match.phase === "toss") c.ring.x = c.ring.y = 0; rig.lastPhase = match.phase; }
  // Camera-relative walking, turned into the court's frame.
  const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
  const ix = (k[b.right] ? 1 : 0) - (k[b.left] ? 1 : 0), iz = (k[b.forward] ? 1 : 0) - (k[b.back] ? 1 : 0);
  const wx = sy * iz - cy * ix, wz = cy * iz + sy * ix;
  const cs = Math.cos(E.spot.yaw), sn = Math.sin(E.spot.yaw);
  // The look's aim on the sand (the screen's middle, a touch low), in the court's frame.
  rig.ray.setFromCamera(rig.centre, E.camera);
  const aimAt = rig.ray.ray.intersectPlane(rig.plane, rig.hit) ? toLocal(E.spot, rig.hit.x, rig.hit.z) : null;
  const p = takePresses(c);
  const input: CourtInput = { ...NO_COURT_INPUT, x: wx * cs - wz * sn, z: wx * sn + wz * cs, sprint: !!k[b.sprint], jump: !!k[b.jump], jumpPressed: p.jump, dashPressed: p.dash,
    left: c.left, leftPressed: p.left, leftReleased: p.leftUp, ePressed: p.e, rightPressed: p.right, ctrlPressed: p.ctrl,
    aim: aimAt ? { x: aimAt[0], z: aimAt[1] } : null, ring: stance === "toss" ? { ...c.ring } : null, spin: { ...c.spin }, ...d.input };

  // Time: hit stop on a spike, slow motion near the top of your jump with the ball close, and on the win.
  const me = match.players[0], bl = match.ball;
  const apex = me.s.mode === "air" && Math.abs(me.s.vy) < VB_FEEL.apexSlow.underVy && match.phase === "rally"
    && Math.hypot(bl.x - me.s.x, bl.y - me.s.y - HAND.spike, bl.z - me.s.z) < VB_FEEL.apexSlow.ballNear;
  rig.time = THREE.MathUtils.damp(rig.time, apex ? VB_FEEL.apexSlow.scale : 1, VB_FEEL.apexSlow.ease, dt);
  let step = dt * rig.time;
  const beat = fxBus.cam;
  if (beat.stop > 0) { beat.stop -= dt; step = 0; }
  if (beat.slow > 0) { beat.slow -= dt; step *= beat.slowScale; }
  if (d.paused) { step = d.steps > 0 ? 1 / 60 : 0; d.steps = Math.max(0, d.steps - 1); }
  const phase0 = match.phase, score0 = match.score.points[0] + match.score.points[1];
  const events = advanceMatch(match, input, step);
  for (const e of events) juice(rig, e, match);
  if (events.length && process.env.NODE_ENV !== "production") { d.log.push(...events); if (d.log.length > 400) d.log.splice(0, d.log.length - 400); }
  if (match.phase !== phase0 || match.score.points[0] + match.score.points[1] !== score0 || events.some(e => e.kind === "toss" || e.kind === "call")) volleyChanged();

  // The players: bots (and you, in the lab) drawn here; on the island you through the ride.
  for (let i = 0; i < 4; i++) {
    const pl = match.players[i], mo = rig.motions[i], g = P.bodies.current[i];
    const air = pl.s.mode === "air", speed = Math.hypot(pl.s.vx, pl.s.vz);
    // A dive plays its clip (vb_dive, vb_slide_dive: started on the dive) and the body stays on the sand until up.
    const diving = !!pl.dive || pl.down > 0;
    // In a rally on the sand, slow moves are the ready stance and its shuffle, stepping the way you go; faster, the run.
    const sideways = pl.s.vx * -Math.cos(pl.s.facing) + pl.s.vz * Math.sin(pl.s.facing);
    const stance = !air && !diving && match.phase === "rally" ? stanceClip(sideways, speed, VB_FEEL.shuffleUnder) : null;
    const held: ClipName | null = diving ? null : air ? "Air" : stance;
    Object.assign(mo, { speed: diving || stance ? 0 : speed, yaw: pl.s.facing, move: held, air: airPhase(pl.s.vy) });
    if (rig.airborne[i] !== air) {
      rig.airborne[i] = air;
      emitFx({ kind: air ? "takeoff" : "touchdown", who: i, x: pl.s.x, y: pl.s.y, z: pl.s.z });
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
      if (mo.playRate) { r.playRate = mo.playRate; mo.playRate = undefined; }
    }
  }

  ballView(rig, P, match, dt);

  // The landing circle: on your side, closing in as the ball comes down to your hands.
  const mySide = sideOfPlayer(match, 0);
  const land = match.phase === "rally" && match.landing && sideOf(match.landing.z) === mySide ? match.landing : null;
  if (P.landRing.current) {
    P.landRing.current.visible = !!land;
    if (land) {
      P.landRing.current.position.set(land.x, match.ground(land.x, land.z) + 0.03, land.z);
      const t = timeToHeight(bl, me.s.y + (me.s.mode === "air" ? HAND.spike : HAND.bump)) ?? 0;
      P.outer.current?.scale.setScalar(0.2 + 0.8 * Math.min(1, t / RING_T));
    }
  }
  // The serve's timing ring round the ball while you serve: the outer ring closes on the target ring; the cursor is
  // where your click will land in it (the serve's direction).
  const serving = match.phase === "toss" && serverOf(match) === 0;
  // The camera now, so what faces it (the serve's ring here, the effects' billboards after) faces this frame's view.
  camera(rig, E, match, dt, serving);
  if (P.serveRing.current) {
    P.serveRing.current.visible = serving;
    if (serving) {
      P.serveRing.current.position.set(bl.x, bl.y, bl.z);
      P.serveRing.current.quaternion.copy(E.camera.quaternion);
      // The camera's turn sits in world space; the ring's group is in the court's: undo the court's yaw.
      P.serveRing.current.quaternion.premultiply(tmpQ.setFromAxisAngle(UP, -E.spot.yaw));
      const err = -serveErrNow(bl, me.s.y + HAND.serve);
      P.serveOuter.current?.scale.setScalar(Math.max(0.15, Math.min(3, 1 + Math.max(0, err) / SERVE_WINDOW.good * 0.7)));
      P.cursor.current?.position.set(c.ring.x * SERVE_R, c.ring.y * SERVE_R, 0.01);
    }
  }
  // Where you look: on the far side while you serve or are in the air.
  if (P.aimMark.current) {
    const show = !!aimAt && (match.phase === "serve" || serving || me.s.mode === "air") && sideOf(aimAt[1]) !== mySide;
    P.aimMark.current.visible = show;
    if (show) P.aimMark.current.position.set(aimAt![0], match.ground(aimAt![0], aimAt![1]) + 0.04, aimAt![1]);
  }
}

/** The ball: its place, its roll, its squash on a touch and its stretch in a fast flight, and its shadow. */
function ballView(rig: Rig, P: Parts, match: Match, dt: number) {
  const bl = match.ball, gy = match.ground(bl.x, bl.z), k = bl.k ?? 1, g = P.ball.current;
  if (g) {
    g.position.set(bl.x, bl.y, bl.z);
    const v = tmp.set(bl.vx, bl.vy, bl.vz).multiplyScalar(k), speed = v.length();
    // Squash along the touch's direction, springing back; between touches a stretch along the flight.
    rig.squash.t += dt;
    const sq = VB_FEEL.squash, s = rig.squash.t < sq.time ? Math.sin((rig.squash.t / sq.time) * Math.PI) * Math.exp(-rig.squash.t * 6) : 0;
    const along = s > 0.001 ? 1 - sq.amount * s : 1 + Math.min(sq.stretchMax, speed * sq.stretchPerSpeed);
    const dir = s > 0.001 ? rig.squash.dir : speed > 0.5 ? v.normalize() : UP;
    g.quaternion.setFromUnitVectors(UP, dir);
    g.scale.set(BALL_R / Math.sqrt(along), BALL_R * along, BALL_R / Math.sqrt(along));
    // The roll (inside the squash): about the axis across its flight.
    if (P.spin.current && speed > 0.2) {
      rig.spinAxis.set(bl.vz, 0, -bl.vx).normalize().applyQuaternion(tmpQ.copy(g.quaternion).invert());
      P.spin.current.rotateOnAxis(rig.spinAxis, (Math.hypot(bl.vx, bl.vz) * k * dt) / BALL_R * 0.4);
    }
  }
  if (P.shadow.current) { P.shadow.current.position.set(bl.x, gy + 0.02, bl.z); const h = Math.max(0, bl.y - gy); P.shadow.current.scale.setScalar(Math.max(0.4, 1.4 - h * 0.12)); }
}

/** The camera: the glide in at the start, then behind your back over the right shoulder; the stage's fog. */
function camera(rig: Rig, E: Env, match: Match, dt: number, serving: boolean) {
  const me = match.players[0], spot = E.spot;
  const [px, pz] = toWorld(spot, me.s.x, me.s.z), py = spot.y + me.s.y;
  const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw), rx = -fz, rz = fx;
  rig.shake = Math.max(0, Math.max(rig.shake, fxBus.cam.shake) - dt * 2.5);
  fxBus.cam.shake = 0;
  // A zoom punch (an effect's request, in FOV degrees) eases back out.
  fxBus.cam.punch = THREE.MathUtils.damp(fxBus.cam.punch, 0, 7, dt);
  const sh = rig.shake * rig.shake * 0.12, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
  rig.pos.set(px - fx * VB_CAMERA.back + rx * VB_CAMERA.right + jx, py + VB_CAMERA.up + jy, pz - fz * VB_CAMERA.back + rz * VB_CAMERA.right);
  // Your toss: the look lifts a little to keep the ball and its ring in view.
  rig.lift = THREE.MathUtils.damp(rig.lift, serving ? 0.3 : 0, 6, dt);
  rig.at.set(px + fx * VB_CAMERA.ahead, py + VB_CAMERA.lookUp - (rig.pitch - rig.lift) * VB_CAMERA.ahead, pz + fz * VB_CAMERA.ahead);
  // The glide in: from the island's view, up behind your baseline over the whole court, then down to the shoulder.
  const I = VB_CAMERA.intro;
  if (rig.intro < 1) {
    rig.intro = Math.min(1, rig.intro + dt / I.time);
    const side = sideOfPlayer(match, 0), [ex, ez] = toWorld(spot, 0, side * (COURT.halfLength + I.behind));
    rig.est.set(ex, spot.y + I.high, ez); rig.estLook.set(spot.x, spot.y + 0.8, spot.z);
    rig.fromPos.copy(E.camera.position);
    rig.fromLook.copy(E.camera.position).add(tmp.set(0, 0, -6).applyQuaternion(E.camera.quaternion));
    const a = THREE.MathUtils.smootherstep(rig.intro, 0, 0.45), b = THREE.MathUtils.smootherstep(rig.intro, 0.35, 1);
    rig.pos.lerpVectors(rig.fromPos.lerp(rig.est, a), rig.pos, b);
    rig.at.lerpVectors(rig.fromLook.lerp(rig.estLook, a), rig.at, b);
  }
  const side = rig.dev.side;
  if (side) {
    // Dev: a close-up beside the ball (the squash frames).
    const b = match.ball, [wx, wz] = toWorld(spot, b.x + side[0], b.z + side[2]), [bx, bz] = toWorld(spot, b.x, b.z);
    rig.pos.set(wx, spot.y + b.y + side[1], wz); rig.at.set(bx, spot.y + b.y, bz);
  }
  E.camera.position.copy(rig.pos);
  E.camera.lookAt(rig.at);
  const cam = E.camera as THREE.PerspectiveCamera;
  const fov = VB_CAMERA.fov - fxBus.cam.punch;
  if (cam.isPerspectiveCamera && Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
  if (cam.isPerspectiveCamera) cutIn(rig, cam, px, py, pz, E.occluders, dt);
  // The stage: the fog draws in as the camera glides in (and goes back on leaving).
  const fog = E.scene.fog instanceof THREE.Fog ? E.scene.fog : null, f = rig.fog;
  if (fog && fog !== f.obj) { if (f.obj) { f.obj.near = f.near; f.obj.far = f.far; } Object.assign(f, { obj: fog, near: fog.near, far: fog.far }); }
  if (fog) {
    const w = THREE.MathUtils.smootherstep(rig.intro, 0.2, 1);
    fog.near = THREE.MathUtils.lerp(f.near, Math.min(f.near, VB_CAMERA.stageFog.near), w);
    fog.far = THREE.MathUtils.lerp(f.far, Math.min(f.far, VB_CAMERA.stageFog.far), w);
  }
}

/**
 * A tree or building between this camera and you eases see-through round you (the island's own cut, lib/game/occluders,
 * which IslandAtmosphere computes for the follow camera; in a match the camera is ours, so the cut is aimed from it).
 */
function cutIn(rig: Rig, cam: THREE.PerspectiveCamera, px: number, py: number, pz: number, list: readonly Occluder[], dt: number) {
  cam.updateMatrixWorld();
  const c = tmp.set(px, py + 1, pz), blocked = list.length > 0 && (lineBlocked(cam.position, c, list) || lineBlocked(cam.position, tmp2.set(px, py + 1.3, pz), list));
  rig.cut = THREE.MathUtils.damp(rig.cut, blocked ? 1 : 0, 8, dt);
  c.applyMatrix4(cam.matrixWorldInverse);
  const depth = -c.z;
  bendViewPoint(c).applyMatrix4(cam.projectionMatrix);
  CUTOUT.value.set(c.x, c.y, CUT_RADIUS / (depth * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))), rig.cut < 0.01 ? 0 : rig.cut);
  CUTOUT_VIEW.value.set(cam.aspect, depth, py + CUT_FLOOR);
  CUTOUT_CROWN.value.set(0, 0);
}

/**
 * One event: the players' clips, the ball's squash, the action bar's flash, and the effects and sounds (fxBus: the
 * approved effects plan, VolleyFx.tsx and sfx.ts), which also ask the camera for its beats.
 */
function juice(rig: Rig, e: MatchEvent, match: Match) {
  // Yours, for the action bar: a press flashes its slot, a whiff shakes it, a touch shows its grade.
  if ("who" in e && e.who === 0) {
    if (e.kind === "press" || e.kind === "whiff") noteFlash(e.how, e.kind === "press");
    else if (e.kind === "contact" && e.how !== "serve") noteFlash(e.how === "dig" ? "dive" : e.how, true, grade(e.quality));
    else if (e.kind === "block" || e.kind === "call") noteFlash(e.kind, true);
    else if (e.kind === "dive") noteFlash(e.strong ? "slide" : "dive", true);
  }
  const b = match.ball, heat = match.rallyTouches;
  if (e.kind === "press") {
    // A press that waits for the ball: the clip's contact meets its arrival at the hands.
    const p = match.players[e.who], hand = HAND[e.how === "jumpset" ? "set" : e.how];
    playMove(rig, e.who, MOVE_OF[e.how], p.pend ? timeToHeight(b, p.s.y + hand) ?? 0 : 0);
  } else if (e.kind === "whiff") emitFx({ kind: "whiff", who: e.who });
  else if (e.kind === "contact") {
    // A touch squashes the ball along where it's sent.
    rig.squash.t = 0;
    rig.squash.dir.set(b.vx, b.vy, b.vz).normalize();
    // A touch with no press first (a dig, a serve) plays its clip now.
    if (e.how === "serve") playMove(rig, e.who, match.players[e.who].s.mode === "air" ? "vb_serve_hit" : "vb_serve_stand");
    emitFx({ kind: "contact", who: e.who, team: match.players[e.who].team, how: e.how, timing: e.timing, quality: e.quality, x: e.x, y: e.y, z: e.z,
      speed: Math.hypot(b.vx, b.vy, b.vz) * (b.k ?? 1) });
  } else if (e.kind === "block") playMove(rig, e.who, "vb_block");
  else if (e.kind === "toss") { playMove(rig, e.who, "vb_serve_toss"); emitFx({ kind: "toss", who: e.who, power: e.power, max: e.max }); }
  else if (e.kind === "call") { rig.motions[e.who].upper = "Wave"; emitFx({ kind: "call", who: e.who }); }
  else if (e.kind === "dive") {
    const p = match.players[e.who], d = p.dive;
    playMove(rig, e.who, e.strong ? "vb_slide_dive" : "vb_dive");
    emitFx({ kind: "dive", who: e.who, strong: e.strong, x: p.s.x, z: p.s.z, dx: d?.dx ?? 0, dz: d?.dz ?? 1 });
  } else if (e.kind === "net" || e.kind === "tape") emitFx({ kind: e.kind, x: b.x, y: b.y });
  else if (e.kind === "land") {
    rig.squash.t = 0; rig.squash.dir.set(0, 1, 0);
    emitFx({ kind: "land", x: e.x, z: e.z, in: e.in, speed: Math.hypot(b.vx, b.vy, b.vz) * (b.k ?? 1), heat });
  } else if (e.kind === "point") {
    for (let i = 0; i < 4; i++) if (match.players[i].team === e.team) playMove(rig, i, "vb_celebrate_point");
    emitFx({ kind: "point", team: e.team, why: e.why, x: b.x, z: b.z, heat });
  } else if (e.kind === "win") {
    volleyOver(match.score.points);
    for (let i = 0; i < 4; i++) if (match.players[i].team === e.team) playMove(rig, i, "vb_celebrate_win");
    emitFx({ kind: "win", team: e.team });
  }
}

/** The beach ball (the low-poly copy: in play it's small on screen), unit radius, scaled by the squash group. */
function BeachBall() {
  const { scene } = useGLTF(BALL_URL);
  const ball = useMemo(() => { const s = scene.clone(); s.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }); return s; }, [scene]);
  // The prop rests on its origin (radius 1, centre at y 1): centred here for the squash.
  return <primitive object={ball} position-y={-1} />;
}

export default function VolleyMatch({ spot, selfLook, occluders = NONE }: {
  spot: CourtSpot;
  /** What can stand between the camera and you (the island's buildings and tree crowns): eased see-through. */
  occluders?: readonly Occluder[];
  /** The lab draws you here; on the island your own avatar is moved through its ride. */
  selfLook?: CharacterLook;
}) {
  const { camera, gl, scene } = useThree();
  const bindings = useMoveKeys();
  const rig = useMemo(() => newRig(spot), [spot]);
  const looks = useMemo(() => { const r = seeded(Math.floor(spot.x * 31 + spot.z)); return [0, 1, 2, 3].map(() => randomLook(r)); }, [spot]);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const calls = useRef<(HTMLDivElement | null)[]>([]);
  const ball = useRef<THREE.Group>(null), spin = useRef<THREE.Group>(null), shadow = useRef<THREE.Mesh>(null);
  const landRing = useRef<THREE.Group>(null), outer = useRef<THREE.Mesh>(null);
  const serveRing = useRef<THREE.Group>(null), serveOuter = useRef<THREE.Mesh>(null), cursor = useRef<THREE.Mesh>(null);
  const aimMark = useRef<THREE.Mesh>(null);
  const m = volley.match;
  useEffect(() => { if (m) faceNet(rig, m, spot); }, [m, spot, rig]);
  useEffect(() => { volley.controls = rig.c; return () => { volley.controls = null; }; }, [rig]);
  useEffect(() => bindCourtControls(rig.c, { el: gl.domElement, bindings, stance: () => (volley.match ? stanceOf(volley.match, 0) : "idle") }), [rig, bindings, gl]);
  useEffect(() => () => leave(rig), [rig]);
  useEffect(() => exposeDev(rig, spot), [rig, spot]);
  // Before the default frame callbacks (the effects', VolleyFx): the match places the camera for them. After the
  // island's follow camera (IslandAtmosphere, -3), which this overrides in a match.
  useFrame((_, raw) => frameStep(rig, { bodies, calls, ball, spin, shadow, landRing, outer, serveRing, serveOuter, cursor, aimMark }, { spot, camera, scene, occluders, bindings, selfLook }, raw), -2);

  if (!m) return null;
  const drawn = selfLook ? [0, 1, 2, 3] : [1, 2, 3];
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]}>
      {drawn.map(i => (
        <group key={i} ref={g => { bodies.current[i] = g; }}>
          <Suspense fallback={null}><Character look={i === 0 && selfLook ? selfLook : looks[i]} motion={rig.motionRefs[i]} walkSpeed={COURT_TUNING.walkSpeed} clips={VB_CLIPS_URL} /></Suspense>
          {i > 0 && <mesh rotation-x={-Math.PI / 2} position-y={0.03}><ringGeometry args={[0.36, 0.42, 32]} /><meshBasicMaterial color={TEAM[m.players[i].team]} transparent opacity={0.85} depthWrite={false} /></mesh>}
          <Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]}><div ref={el => { calls.current[i] = el; }} className={styles.call} style={{ opacity: 0 }}>Mine!</div></Html>
        </group>
      ))}
      {/* Your own "Mine!" on the island: over your avatar, which the ride moves. */}
      {!selfLook && <group ref={g => { bodies.current[0] = g; }}><Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]}><div ref={el => { calls.current[0] = el; }} className={styles.call} style={{ opacity: 0 }}>Mine!</div></Html></group>}
      <group ref={ball}><group ref={spin}><Suspense fallback={<mesh><icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color="#fbf6ea" /></mesh>}><BeachBall /></Suspense></group></group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}><circleGeometry args={[BALL_R * 1.2, 20]} /><meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} /></mesh>
      <group ref={landRing} visible={false}>
        <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[RING_R * 0.2 - 0.05, RING_R * 0.2, 40]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} /></mesh>
        <mesh ref={outer} rotation-x={-Math.PI / 2}><ringGeometry args={[RING_R - 0.06, RING_R, 48]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} /></mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-0.005}><ringGeometry args={[RING_R * 0.2 - 0.09, RING_R * 0.2 + 0.05, 40]} /><meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} /></mesh>
      </group>
      <group ref={serveRing} visible={false} renderOrder={10}>
        {/* The target ring (a soft dark edge so it reads on the sky), its perfect band, the closing ring and your cursor. They
            depth-test (the island's post pass drops depthTest-off materials) and draw last. */}
        <mesh><ringGeometry args={[SERVE_R - 0.012, SERVE_R + 0.05, 48]} /><meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} /></mesh>
        <mesh><ringGeometry args={[SERVE_R, SERVE_R + 0.035, 48]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} /></mesh>
        <mesh ref={serveOuter}><ringGeometry args={[SERVE_R - 0.005, SERVE_R + 0.025, 48]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.95} depthWrite={false} /></mesh>
        <mesh ref={cursor}><circleGeometry args={[0.055, 20]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} /></mesh>
        <mesh><ringGeometry args={[0.01, 0.02, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} /></mesh>
      </group>
      <mesh ref={aimMark} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[0.2, 0.28, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} /></mesh>
      {/* The approved effects (fxBus): pooled, in the court's frame. */}
      <VolleyFx />
    </group>
  );
}
