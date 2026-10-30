"use client";

/**
 * The match's effects (David's approved plan, 2026-10-30: fifteen effects, every contact in four timing grades), for
 * the player in the match only: mounted inside VolleyMatch's court group, fed by lib/game/volleyball/fxBus. Pooled and
 * allocation-free per frame:
 * - two particle systems of the match's own (lit sand and dust, and additive light), so a long rally never starves
 *   the island's footsteps: three draws at most;
 * - fixed pools of rings (camera-facing flashes and shockwaves, ground pulses, net ripples), sand craters, the court's
 *   outline flash, the OUT cross, the ball's two trails (the rally's heat, the set's team ribbon) and the set's apex
 *   marker. Each draws only while it shows.
 * The look of each contact by its grade is data (fxPlan.ts). Lite tier: half the particles, no fire every frame, no
 * craters or skid marks, three fireworks.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MoveParticles, liveWind } from "../movement/moveFx";
import { GlowParticles } from "../GlowFx";
import { takeoff, landing as landPuff } from "@/lib/game/movement/juice";
import { seedAt, type Recipe } from "@/lib/game/fx/particles";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { GRAVITY } from "@/lib/game/volleyball/ball";
import { COURT, toWorld } from "@/lib/game/volleyball/court";
import { HAND, type Match } from "@/lib/game/volleyball/match";
import { meterPower } from "@/lib/game/volleyball/timing";
import { volley, type CourtSpot } from "@/lib/game/volleyball/session";
import { camBeat, drainFx, emitFx, fxBus, type VbFx } from "@/lib/game/volleyball/fxBus";
import {
  CHARGE_MOTE, CONFETTI, DIVE_CLOUD, DIVE_SPRAY, DUST_PLUME, DUST_RING, FIREWORK, FLAME, FX_COLOR, GLINT, GLOW_BURST, HEAT, SAND_BLAST, SAND_PUFF,
  SKID, SOFT_PUFF, SPARKLES, SPEED_LINES, SWISH, TEAM_COLOR, contactBeat, contactPlan, heatColor, heatOf, landScale,
} from "@/lib/game/volleyball/fxPlan";

const RINGS = 14, CRATERS = 3, TRAIL = 26, SHELLS = 7;
type RingFace = 0 | 1 | 2; // the camera, the ground, the net's plane
interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; life: number; from: number; to: number; alpha: number; face: RingFace; delay: number }
interface Trail { mesh: THREE.Mesh; pos: Float32Array; col: Float32Array; attrP: THREE.BufferAttribute; attrC: THREE.BufferAttribute }

/** Everything the effects hold: pools, the ball's history and the continuous effects' state. */
interface Fx {
  move: MoveParticles; glow: GlowParticles;
  glowRings: Ring[]; softRings: Ring[];
  craters: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number }[];
  outline: { mesh: THREE.Mesh | null; mat: THREE.MeshBasicMaterial; age: number; life: number; color: THREE.Color };
  cross: { group: THREE.Group; mat: THREE.MeshBasicMaterial; age: number };
  apex: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial };
  heat: Trail; ribbon: Trail; hist: Float32Array; histN: number;
  lastHow: string; lastTeam: number; tick: number; seed: number;
  glinted: boolean[]; skidT: number; chargeT: number; shells: { at: number; x: number; y: number; z: number; tint: number }[]; clock: number;
  lite: boolean; built: Match | null;
  q: THREE.Quaternion; qYaw: THREE.Quaternion; tmp: THREE.Vector3; side: THREE.Vector3; color: { r: number; g: number; b: number };
}

const UP = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0), CAM = new THREE.Vector3();
const RING_GEO = new THREE.RingGeometry(0.8, 1, 48);
const DISC_GEO = new THREE.CircleGeometry(1, 28);

/** A soft round sand-dark spot (the crater): one small canvas texture, made once. */
let craterTex: THREE.Texture | null = null;
function craterTexture(): THREE.Texture {
  if (craterTex) return craterTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!, r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.15)"); r.addColorStop(0.55, "rgba(255,255,255,0.9)"); r.addColorStop(0.72, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  craterTex = new THREE.CanvasTexture(c);
  return craterTex;
}

function ringPool(additive: boolean): Ring[] {
  return Array.from({ length: RINGS }, () => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(RING_GEO, mat);
    mesh.visible = false; mesh.renderOrder = 4; mesh.frustumCulled = false;
    return { mesh, mat, age: 1, life: 1, from: 0, to: 0, alpha: 0, face: 0 as RingFace, delay: 0 };
  });
}

function trail(additive: boolean): Trail {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(TRAIL * 2 * 3), col = new Float32Array(TRAIL * 2 * 4), idx: number[] = [];
  for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const attrP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), attrC = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("position", attrP); g.setAttribute("color", attrC); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const mesh = new THREE.Mesh(g, mat);
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 4;
  return { mesh, pos, col, attrP, attrC };
}

function newFx(): Fx {
  const crossMat = new THREE.MeshBasicMaterial({ color: FX_COLOR.out, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const cross = new THREE.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) { const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), crossMat); bar.rotation.set(-Math.PI / 2, 0, r); cross.add(bar); }
  cross.visible = false;
  const apexMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const apex = new THREE.Mesh(RING_GEO, apexMat);
  apex.visible = false; apex.renderOrder = 4;
  const outlineMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
  return {
    move: new MoveParticles(), glow: new GlowParticles(),
    glowRings: ringPool(true), softRings: ringPool(false),
    craters: Array.from({ length: CRATERS }, () => {
      const mat = new THREE.MeshBasicMaterial({ color: FX_COLOR.crater, map: craterTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new THREE.Mesh(DISC_GEO, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false;
      return { mesh, mat, age: 99 };
    }),
    outline: { mesh: null, mat: outlineMat, age: 99, life: 0.9, color: new THREE.Color() },
    cross: { group: cross, mat: crossMat, age: 99 },
    apex: { mesh: apex, mat: apexMat },
    heat: trail(true), ribbon: trail(false), hist: new Float32Array(TRAIL * 3), histN: 0,
    lastHow: "", lastTeam: 0, tick: 0, seed: 1,
    glinted: [false, false, false, false], skidT: 0, chargeT: 0, shells: [], clock: 0,
    lite: false, built: null,
    q: new THREE.Quaternion(), qYaw: new THREE.Quaternion(), tmp: new THREE.Vector3(), side: new THREE.Vector3(), color: { r: 1, g: 1, b: 1 },
  };
}

/** The court's outline as one flat ribbon draped on the sand (the point's and the OUT's flash), in the court's frame. */
function outlineGeometry(m: Match, w = 0.16): THREE.BufferGeometry {
  const hw = COURT.halfWidth, hl = COURT.halfLength, pos: number[] = [], idx: number[] = [];
  const edge = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n, x2 = x + nx * w, z2 = z + nz * w, v = pos.length / 3;
      pos.push(x - nx * w * 0.3, m.ground(x, z) + 0.03, z - nz * w * 0.3, x2, m.ground(x2, z2) + 0.03, z2);
      if (i) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  };
  edge(-hw, -hl, -hw, hl, 1, 0); edge(hw, -hl, hw, hl, -1, 0); edge(-hw, -hl, hw, -hl, 0, 1); edge(-hw, hl, hw, hl, 0, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ── Pools ───────────────────────────────────────────────────────────────────

function ring(pool: Ring[], x: number, y: number, z: number, face: RingFace, from: number, to: number, life: number, tint: number, alpha = 1, delay = 0) {
  let r = pool[0];
  for (const c of pool) { if (!c.mesh.visible && c.delay <= 0) { r = c; break; } if (c.age / c.life > r.age / r.life) r = c; }
  r.mesh.position.set(x, y, z);
  Object.assign(r, { age: 0, life, from, to, alpha, face, delay });
  r.mat.color.setHex(tint);
  r.mat.opacity = 0;
  r.mesh.visible = delay <= 0;
  r.mesh.scale.setScalar(from);
  if (face === 1) r.mesh.quaternion.setFromAxisAngle(X_AXIS, -Math.PI / 2);
  else if (face === 2) r.mesh.quaternion.identity();
}

function stepRings(pool: Ring[], dt: number, q: THREE.Quaternion) {
  for (const r of pool) {
    if (r.delay > 0) { r.delay -= dt; if (r.delay <= 0) r.mesh.visible = true; else continue; }
    if (!r.mesh.visible) continue;
    r.age += dt;
    const t = Math.min(1, r.age / r.life), e = 1 - (1 - t) ** 3;
    r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
    r.mat.opacity = r.alpha * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
    if (r.face === 0) r.mesh.quaternion.copy(q);
    if (t >= 1) r.mesh.visible = false;
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

interface Ctx { spot: CourtSpot; m: Match; lite: boolean }
const W = (c: Ctx, x: number, z: number) => toWorld(c.spot, x, z);

/** Throw a recipe at a court-frame spot (the pools live in the world). */
function throwAt(f: Fx, pool: "move" | "glow", r: Recipe, c: Ctx, x: number, y: number, z: number, dx: number, dz: number, scale: number, tint: number, alpha = 1) {
  const [wx, wz] = W(c, x, z), cs = Math.cos(c.spot.yaw), sn = Math.sin(c.spot.yaw);
  const gy = c.spot.y + c.m.ground(x, z);
  // A court-frame direction turned to the world's.
  const wdx = dx * cs + dz * sn, wdz = -dx * sn + dz * cs;
  return (pool === "move" ? f.move.pool : f.glow.pool).burst(r, wx, c.spot.y + y, wz, gy, wdx, wdz, scale, tint, seedAt(wx, wz, ++f.seed), alpha, 0, f.lite ? 0.5 : 1);
}

function onContact(f: Fx, c: Ctx, e: Extract<VbFx, { kind: "contact" }>) {
  const m = c.m, p = m.players[e.who], plan = contactPlan(e.how, e.timing, e.who === m.human, e.team === m.players[Math.max(0, m.human)].team);
  const L = plan.look, s = L.scale, feetY = m.ground(p.s.x, p.s.z), b = m.ball;
  f.lastHow = e.how; f.lastTeam = e.team;
  // The flash at the hands: a painted ring in the grade's colour over a soft dark edge (light alone washes out on a
  // sunny beach), the perfect one with a core of light; an early or late touch only a small grey ring and a matte puff.
  if (plan.flash || L.sparkles > 0) {
    for (let k = 0; k < L.rings; k++) {
      const to = L.ringSize * s * (1 + 0.35 * k), life = 0.32 + 0.08 * k, delay = k * 0.05;
      ring(f.softRings, e.x, e.y, e.z, 0, 0.15 * s, to * 1.04, life, 0x000000, 0.2, delay);
      ring(f.softRings, e.x, e.y, e.z, 0, 0.15 * s, to, life, L.tint, 0.95, delay);
    }
  } else {
    ring(f.softRings, e.x, e.y, e.z, 0, 0.1, L.ringSize * 1.04, 0.3, 0x000000, 0.15);
    ring(f.softRings, e.x, e.y, e.z, 0, 0.1, L.ringSize, 0.3, L.tint, 0.8);
  }
  if (L.glow) throwAt(f, "glow", GLOW_BURST, c, e.x, e.y, e.z, 0, 0, s, L.tint);
  if (L.sparkles === 0) throwAt(f, "move", SOFT_PUFF, c, e.x, e.y, e.z, 0, 0, 1, L.tint);
  if (plan.pulse) { ring(f.softRings, p.s.x, feetY + 0.05, p.s.z, 1, 0.2, 1.15 * s, 0.45, 0x000000, 0.15); ring(f.softRings, p.s.x, feetY + 0.05, p.s.z, 1, 0.2, 1.1 * s, 0.45, L.tint, 0.85); }
  if (plan.sand) throwAt(f, "move", SAND_PUFF, c, p.s.x, feetY, p.s.z, 0, 0, s, FX_COLOR.sandDark);
  if (plan.sparkles) throwAt(f, "move", SPARKLES, c, e.x, e.y, e.z, 0, 0, s * L.sparkles, L.tint);
  if (plan.glint) throwAt(f, L.glow ? "glow" : "move", GLINT, c, e.x, e.y + 0.1, e.z, 0, 0, L.glow ? s : 0.8, L.glow ? L.tint : FX_COLOR.spark, L.glow ? 1 : 0.8);
  if (plan.lines) throwAt(f, "move", SPEED_LINES, c, e.x, e.y, e.z, b.vx, b.vz, s, L.tint, 0.95);
  if (plan.shield) {
    // A ripple across the raised hands, in the blocker's colour, and sparks off it.
    const tint = TEAM_COLOR[e.team];
    for (let k = 0; k < 3; k++) ring(f.glowRings, e.x, e.y, 0, 2, 0.2, 0.9 + 0.35 * k, 0.5, k === 0 ? FX_COLOR.white : tint, 0.9 - 0.2 * k, k * 0.06);
    throwAt(f, "glow", SPARKLES, c, e.x, e.y, 0, 0, Math.sign(b.vz) || 1, 1.5, FX_COLOR.spark);
  }
  if (plan.spray) {
    throwAt(f, "move", DIVE_SPRAY, c, p.s.x, feetY, p.s.z, p.s.vx, p.s.vz, 1.1, FX_COLOR.sandDark);
    throwAt(f, "move", DIVE_CLOUD, c, p.s.x, feetY, p.s.z, p.s.vx, p.s.vz, 1, FX_COLOR.sand);
  }
  const beat = contactBeat(e.how, e.timing, e.speed);
  // The camera answers your touches and the big ones near you; a far bump is the bots' business.
  const near = e.who === m.human || e.how === "spike" || e.how === "block";
  if (near) camBeat(e.who === m.human ? beat : { ...beat, shake: beat.shake * 0.6, slow: 0, punch: beat.punch * 0.5 });
}

function onLand(f: Fx, c: Ctx, e: Extract<VbFx, { kind: "land" }>) {
  const m = c.m, gy = m.ground(e.x, e.z), k = landScale(e.speed, e.heat);
  // The sand explodes: grains thrown up, a low ring of dust, a plume; a shockwave across the sand; a crater left behind.
  throwAt(f, "move", SAND_BLAST, c, e.x, gy, e.z, 0, 0, k, FX_COLOR.sandDark);
  throwAt(f, "move", DUST_RING, c, e.x, gy, e.z, 0, 0, k, FX_COLOR.sand);
  throwAt(f, "move", DUST_PLUME, c, e.x, gy, e.z, 0, 0, k, FX_COLOR.sand);
  ring(f.softRings, e.x, gy + 0.04, e.z, 1, 0.3, 2.4 * k, 0.55, FX_COLOR.white, 0.8);
  ring(f.softRings, e.x, gy + 0.04, e.z, 1, 0.2, 1.4 * k, 0.4, FX_COLOR.sand, 0.9, 0.08);
  if (heatOf(e.heat) >= HEAT.fireAt / HEAT.full) {
    // A rally that caught fire ends in a burst of its heat.
    throwAt(f, "glow", FIREWORK, c, e.x, gy + 0.3, e.z, 0, 0, 0.8 * k, FX_COLOR.heatOrange);
    ring(f.glowRings, e.x, gy + 0.06, e.z, 1, 0.3, 3 * k, 0.6, FX_COLOR.heatPink, 0.9);
  }
  if (!f.lite) {
    const cr = f.craters.reduce((a, b) => (b.age > a.age ? b : a));
    cr.mesh.position.set(e.x, gy + 0.025, e.z); cr.mesh.scale.setScalar(0.45 * k); cr.age = 0; cr.mesh.visible = true;
  }
  camBeat({ shake: 0.3 + 0.35 * Math.min(1, e.speed / 20), stop: e.in ? 0.06 : 0 });
  if (!e.in) {
    f.cross.group.position.set(e.x, gy + 0.04, e.z); f.cross.age = 0; f.cross.group.visible = true;
    flashOutline(f, FX_COLOR.out);
  }
}

function flashOutline(f: Fx, tint: number) {
  f.outline.age = 0; f.outline.mat.color.setHex(tint);
  if (f.outline.mesh) f.outline.mesh.visible = true;
}

function onPoint(f: Fx, c: Ctx, e: Extract<VbFx, { kind: "point" }>) {
  const m = c.m, gy = m.ground(e.x, e.z), tint = TEAM_COLOR[e.team];
  flashOutline(f, tint);
  throwAt(f, "move", CONFETTI, c, e.x, gy, e.z, 0, 0, 1, tint);
  throwAt(f, "move", CONFETTI, c, e.x, gy, e.z, 0, 0, 0.8, FX_COLOR.gold);
  throwAt(f, "glow", SPARKLES, c, e.x, gy + 0.6, e.z, 0, 0, 1.6, tint);
}

function onWin(f: Fx, c: Ctx, e: Extract<VbFx, { kind: "win" }>) {
  camBeat({ slow: 1.6, slowScale: 0.3, shake: 0.4 });
  const side = c.m.score.side0 === (e.team === 0 ? 1 : -1) ? 1 : -1;
  const n = f.lite ? 3 : SHELLS, tints = [FX_COLOR.gold, TEAM_COLOR[e.team], FX_COLOR.heatPink, FX_COLOR.white, FX_COLOR.away, FX_COLOR.heatOrange, FX_COLOR.gold];
  // Fireworks beyond the losers' end, high over the water's side of the beach.
  for (let i = 0; i < n; i++) f.shells.push({ at: f.clock + 0.4 + i * 0.55, x: (i % 3 - 1) * 5 + (i % 2) * 1.5, y: 9 + (i % 4) * 1.4, z: -side * (COURT.halfLength + 8 + (i % 3) * 3), tint: tints[i % tints.length] });
  const gy = c.m.ground(0, 0);
  throwAt(f, "move", CONFETTI, c, 0, gy, side * 3, 0, 0, 1.6, TEAM_COLOR[e.team]);
  throwAt(f, "move", CONFETTI, c, 0, gy, side * 3, 0, 0, 1.4, FX_COLOR.gold);
}

function handle(f: Fx, c: Ctx, e: VbFx) {
  const m = c.m;
  switch (e.kind) {
    case "contact": return onContact(f, c, e);
    case "land": return onLand(f, c, e);
    case "point": return onPoint(f, c, e);
    case "win": return onWin(f, c, e);
    case "net": case "tape": {
      // The net ripples where the ball met it.
      for (let k = 0; k < (e.kind === "net" ? 3 : 2); k++) ring(f.softRings, e.x, e.y, 0.02, 2, 0.15, 0.7 + 0.35 * k, 0.45, FX_COLOR.white, 0.75 - 0.2 * k, k * 0.07);
      camBeat({ shake: e.kind === "net" ? 0.25 : 0.12 });
      return;
    }
    case "takeoff": {
      const [wx, wz] = W(c, e.x, e.z), p = m.players[e.who];
      takeoff(f.move.pool, "sand", wx, c.spot.y + e.y, wz, p.s.vx, p.s.vz, e.who === m.human ? 1.3 : 0.8);
      if (e.who === m.human) throwAt(f, "glow", SPEED_LINES, c, e.x, e.y + 0.3, e.z, 0, 0, 0.6, FX_COLOR.white, 0.5);
      f.glinted[e.who] = false;
      return;
    }
    case "touchdown": {
      const [wx, wz] = W(c, e.x, e.z);
      landPuff(f.move.pool, "sand", "normal", wx, c.spot.y + e.y, wz, 0, 0, e.who === m.human ? 1 : 0.7);
      return;
    }
    case "dive": {
      const p = m.players[e.who], gy = m.ground(e.x, e.z), k = e.strong ? 1.45 : 1;
      throwAt(f, "move", DIVE_SPRAY, c, e.x, gy, e.z, e.dx, e.dz, k, FX_COLOR.sandDark);
      throwAt(f, "move", DIVE_CLOUD, c, e.x, gy, e.z, -e.dx, -e.dz, k, FX_COLOR.sand);
      if (e.who === m.human) camBeat({ punch: e.strong ? 3 : 1.5, shake: e.strong ? 0.3 : 0.18 });
      void p;
      return;
    }
    case "toss": {
      const b = m.ball;
      if (e.max) {
        // Max power: a gold burst round the ball, sparkles and a ring.
        throwAt(f, "glow", GLOW_BURST, c, b.x, b.y, b.z, 0, 0, 2, FX_COLOR.gold);
        throwAt(f, "glow", SPARKLES, c, b.x, b.y, b.z, 0, 0, 1.8, FX_COLOR.gold);
        ring(f.glowRings, b.x, b.y, b.z, 0, 0.2, 1.6, 0.45, FX_COLOR.gold, 1);
        if (e.who === m.human) camBeat({ punch: 2.5, shake: 0.2 });
      }
      return;
    }
    case "whiff": {
      const p = m.players[e.who];
      throwAt(f, "move", SWISH, c, p.s.x, p.s.y + HAND.set, p.s.z, 0, 0, 1, FX_COLOR.white, 0.7);
      return;
    }
    case "call": {
      // "Mine!": a pop over the caller's head.
      const p = m.players[e.who], tint = TEAM_COLOR[p.team];
      ring(f.glowRings, p.s.x, p.s.y + 2.05, p.s.z, 0, 0.1, 0.6, 0.35, tint, 0.9);
      throwAt(f, "glow", SPARKLES, c, p.s.x, p.s.y + 2.05, p.s.z, 0, 0, 0.6, tint);
      return;
    }
  }
}

// ── Each frame ──────────────────────────────────────────────────────────────

/** The ball's two trails: the rally's heat (white to orange to hot pink, wider as it heats) and a set's team ribbon. */
function stepTrails(f: Fx, m: Match, camLocal: THREE.Vector3) {
  const b = m.ball, live = m.phase === "rally" || m.phase === "toss";
  // The history: newest first.
  if (live) { f.hist.copyWithin(3, 0, (TRAIL - 1) * 3); f.hist[0] = b.x; f.hist[1] = b.y; f.hist[2] = b.z; f.histN = Math.min(TRAIL, f.histN + 1); } else f.histN = Math.max(0, f.histN - 2);
  const k = b.k ?? 1, speed = Math.hypot(b.vx, b.vy, b.vz) * k, heat = heatOf(m.rallyTouches);
  const set = live && m.phase === "rally" && (f.lastHow === "set" || f.lastHow === "jumpset");
  const hot = live && !set && (m.phase === "toss" || speed > 8 || heat > 0.3);
  fillTrail(f, f.heat, hot, m.phase === "toss" ? 0.05 : 0.05 + 0.2 * heat + Math.min(0.08, speed * 0.004), heat, camLocal, -1);
  fillTrail(f, f.ribbon, set, 0.09, 0, camLocal, f.lastTeam);
}

function fillTrail(f: Fx, t: Trail, on: boolean, width: number, heat: number, cam: THREE.Vector3, team: number) {
  t.mesh.visible = on && f.histN > 2;
  if (!t.mesh.visible) return;
  const h = f.hist, n = f.histN, col = f.color;
  if (team >= 0) { const c = TEAM_COLOR[team]; col.r = ((c >> 16) & 255) / 255; col.g = ((c >> 8) & 255) / 255; col.b = (c & 255) / 255; } else heatColor(heat, col);
  for (let i = 0; i < TRAIL; i++) {
    const j = Math.min(i, n - 1), a = j * 3, nb = Math.min(j + 1, n - 1) * 3, pr = Math.max(j - 1, 0) * 3;
    // Across the trail: perpendicular to its run and to the eye.
    f.tmp.set(h[pr] - h[nb], h[pr + 1] - h[nb + 1], h[pr + 2] - h[nb + 2]);
    f.side.set(cam.x - h[a], cam.y - h[a + 1], cam.z - h[a + 2]).cross(f.tmp).normalize();
    const u = i / (TRAIL - 1), w = width * (1 - u) * (i < n ? 1 : 0);
    t.pos[i * 6] = h[a] + f.side.x * w; t.pos[i * 6 + 1] = h[a + 1] + f.side.y * w; t.pos[i * 6 + 2] = h[a + 2] + f.side.z * w;
    t.pos[i * 6 + 3] = h[a] - f.side.x * w; t.pos[i * 6 + 4] = h[a + 1] - f.side.y * w; t.pos[i * 6 + 5] = h[a + 2] - f.side.z * w;
    const al = (1 - u) ** 1.5 * (team >= 0 ? 0.85 : 0.75);
    for (const o of [0, 4]) { t.col[i * 8 + o] = col.r; t.col[i * 8 + o + 1] = col.g; t.col[i * 8 + o + 2] = col.b; t.col[i * 8 + o + 3] = al; }
  }
  t.attrP.needsUpdate = true; t.attrC.needsUpdate = true;
}

function frame(f: Fx, c: Ctx, camera: THREE.Camera, root: THREE.Object3D, dt: number, stamp: number) {
  const m = c.m;
  f.clock += dt; f.tick++; f.lite = c.lite;
  if (f.built !== m) {
    f.built = m;
    const g = outlineGeometry(m);
    if (f.outline.mesh) { f.outline.mesh.geometry.dispose(); f.outline.mesh.geometry = g; }
    else { f.outline.mesh = new THREE.Mesh(g, f.outline.mat); f.outline.mesh.visible = false; f.outline.mesh.renderOrder = 4; root.add(f.outline.mesh); }
  }
  for (const e of drainFx()) handle(f, c, e);
  // The camera's turn in the court's frame (rings that face it), and the eye there (trails).
  f.qYaw.setFromAxisAngle(UP, -c.spot.yaw);
  f.q.copy(camera.quaternion).premultiply(f.qYaw);
  const camLocal = root.worldToLocal(camera.getWorldPosition(CAM));
  stepRings(f.glowRings, dt, f.q); stepRings(f.softRings, dt, f.q);
  for (const cr of f.craters) if (cr.mesh.visible) { cr.age += dt; cr.mat.opacity = 0.55 * Math.max(0, 1 - cr.age / 2.6); if (cr.age > 2.6) cr.mesh.visible = false; }
  const o = f.outline;
  if (o.mesh?.visible) { o.age += dt; const t = o.age / o.life; o.mat.opacity = t < 0.1 ? t * 9 : Math.max(0, 0.9 * (1 - (t - 0.1) / 0.9)) * (0.75 + 0.25 * Math.cos(o.age * 30)); if (t >= 1) o.mesh.visible = false; }
  const x = f.cross;
  if (x.group.visible) { x.age += dt; const t = x.age / 1.6; x.mat.opacity = t < 0.08 ? t * 12 : Math.max(0, 1 - (t - 0.6) / 0.4); x.group.scale.setScalar(t < 0.15 ? 0.4 + 4 * t : 1); if (t >= 1) x.group.visible = false; }
  stepTrails(f, m, camLocal);
  const b = m.ball, heat = heatOf(m.rallyTouches);
  // The ball on fire after a long rally.
  if (m.phase === "rally" && m.rallyTouches >= HEAT.fireAt && f.tick % (f.lite ? 3 : 1) === 0) throwAt(f, "glow", FLAME, c, b.x, b.y, b.z, -b.vx, -b.vz, 0.7 + heat * 0.5, f.tick % 2 ? FX_COLOR.heatOrange : FX_COLOR.heatPink, 0.9);
  // A set's apex: a glowing marker where the ball will top out.
  const set = m.phase === "rally" && (f.lastHow === "set" || f.lastHow === "jumpset") && b.vy > 0.3;
  f.apex.mesh.visible = set;
  if (set) {
    const g = GRAVITY + (b.cy ?? 0), t = b.vy / g;
    f.apex.mesh.position.set(b.x + b.vx * t, b.y + 0.5 * b.vy * t, b.z + b.vz * t);
    f.apex.mesh.quaternion.copy(f.q);
    f.apex.mesh.scale.setScalar(0.28 + 0.05 * Math.sin(f.clock * 12));
    f.apex.mat.color.setHex(TEAM_COLOR[f.lastTeam]); f.apex.mat.opacity = 0.9;
  }
  // The serve's charge: light drawn in to the ball, more and warmer as the bar fills.
  if (m.meter !== null) {
    const pw = meterPower(m.meter);
    f.chargeT -= dt;
    if (f.chargeT <= 0) {
      f.chargeT = (f.lite ? 0.12 : 0.06) / (0.5 + pw);
      const a = f.clock * 7.3, r = 0.75, dx = Math.cos(a), dz = Math.sin(a);
      throwAt(f, "glow", CHARGE_MOTE, c, b.x + dx * r, b.y + Math.sin(a * 1.7) * 0.25, b.z + dz * r, -dx, -dz, 1, pw > 0.85 ? FX_COLOR.gold : FX_COLOR.white, 0.6 + 0.4 * pw);
    }
  }
  for (let i = 0; i < 4; i++) {
    const p = m.players[i];
    // The spike's apex: a glint at the hand as the ball comes to it.
    if (p.s.mode === "air" && !f.glinted[i] && Math.abs(p.s.vy) < 1.4 && Math.hypot(b.x - p.s.x, b.y - (p.s.y + HAND.spike), b.z - p.s.z) < 1.1) {
      f.glinted[i] = true;
      throwAt(f, "glow", GLINT, c, p.s.x, p.s.y + HAND.spike + 0.15, p.s.z, 0, 0, 1, FX_COLOR.spark);
    }
    // The slide dive's skid marks.
    if (!f.lite && p.dive?.strong && p.dive.t < 0.4) {
      f.skidT -= dt;
      if (f.skidT <= 0) { f.skidT = 0.03; throwAt(f, "move", SKID, c, p.s.x, m.ground(p.s.x, p.s.z) + 0.02, p.s.z, p.dive.dx, p.dive.dz, 1, FX_COLOR.sandDark, 0.7); }
    }
  }
  // Fireworks, one shell at a time.
  for (let i = f.shells.length - 1; i >= 0; i--) {
    const s = f.shells[i];
    if (f.clock < s.at) continue;
    throwAt(f, "glow", FIREWORK, c, s.x, s.y, s.z, 0, 0, 1.6, s.tint);
    throwAt(f, "glow", GLOW_BURST, c, s.x, s.y, s.z, 0, 0, 4, s.tint);
    f.shells.splice(i, 1);
  }
  const wind = liveWind();
  f.move.tick(stamp, dt, camera, wind);
  f.glow.tick(stamp, dt, camera, wind);
}

/** Dev only (evidence): fire an effect, and pause and step the effects a 60th of a second at a time. */
const DEV = { paused: false, steps: 0 };
function exposeDev(f: Fx) {
  if (process.env.NODE_ENV === "production") return;
  const w = window as unknown as { __volleyFx?: unknown };
  const probe = () => ({ soft: f.softRings.filter(r => r.mesh.visible).map(r => [r.mat.color.getHexString(), +r.mat.opacity.toFixed(2), +r.mesh.scale.x.toFixed(2), r.mesh.parent?.type, r.mesh.position.toArray().map(v => +v.toFixed(2))]), move: f.move.pool.alive, glow: f.glow.pool.alive });
  w.__volleyFx = { emit: emitFx, dev: DEV, cam: fxBus.cam, probe };
  return () => { delete w.__volleyFx; };
}

/** The effects' clock: the match's hit-stops and slow-mo beats hold it too; dev pauses step it. */
function fxDt(raw: number): number {
  if (DEV.paused) { if (DEV.steps > 0) { DEV.steps--; return 1 / 60; } return 0; }
  const c = fxBus.cam, dt = Math.min(raw, 0.1);
  return c.stop > 0 ? dt * 0.1 : c.slow > 0 ? dt * c.slowScale : dt;
}

export default function VolleyFx() {
  const { scene, camera } = useThree();
  const [{ liteMode }] = useGraphicsSettings();
  const f = useMemo(() => newFx(), []);
  const root = useMemo(() => {
    const g = new THREE.Group();
    g.add(...f.glowRings.map(r => r.mesh), ...f.softRings.map(r => r.mesh), ...f.craters.map(c => c.mesh), f.cross.group, f.apex.mesh, f.heat.mesh, f.ribbon.mesh);
    return g;
  }, [f]);
  useEffect(() => {
    scene.add(...f.move.meshes, f.glow.mesh);
    return () => { scene.remove(...f.move.meshes, f.glow.mesh); f.move.clear(); f.move.dispose(); f.glow.clear(); f.glow.dispose(); };
  }, [scene, f]);
  useEffect(() => exposeDev(f), [f]);
  useFrame((state, raw) => {
    const m = volley.match, spot = volley.spot;
    if (!m || !spot) { drainFx(); return; }
    frame(f, { spot, m, lite: liteMode }, camera, root, fxDt(raw), state.clock.elapsedTime);
  });
  return <primitive object={root} />;
}
