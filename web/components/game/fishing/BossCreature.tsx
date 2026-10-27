"use client";

/**
 * The boss catch in the world (specs/launch/v1-gameplay.md, "Fish tiers and fights", and David's addition): a
 * legendary surfaces as a creature the size of a building, a divine as something far bigger (lib/game/bossCreatures.ts). Hooked, it surfaces out of the
 * water past your bobber while the camera pulls out to frame it (lib/game/bossCam.ts), fights through the reel's
 * moves (lib/game/fishingRig.ts `live.boss`: it rears back on a warning, tears sideways on a run, leaps, sounds, lunges
 * on slack), and when it's landed rears up and crashes down in a great splash; if it gets away it sinks out of sight.
 *
 * PLACEHOLDERS: plain shapes in flat colours, clearly temporary, until David picks the creatures and sends references
 * (no designed creatures here). They stay mounted from the start, parked far below the world, so the loading
 * warm-up (LoadGate) compiles them and the cutscene never stalls on a first draw.
 *
 * Driven by the overlay's window events for this client's own cast (`live.cast`, set by useWorldClips), or a raid
 * joined from elsewhere (`at`, where it was hooked):
 *   tsi:boss-surface {tier, at?} → surface; tsi:fish-caught → land it; tsi:fish-escaped → sink; tsi:fish-end → gone.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frameBoss, releaseBossCam } from "@/lib/game/bossCam";
import { creatureFor } from "@/lib/game/bossCreatures";
import { shakeCamera } from "@/lib/game/cameraJuice";
import { HOOK, type HookTier } from "@/lib/game/fishing";
import { live, sceneWater } from "@/lib/game/fishingRig";
import { fishLeaps } from "@/lib/game/fx/fishingFx";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { useMoveParticles } from "../movement/moveFx";

type BossTier = Exclude<HookTier, "common">;
/** Each creature's height over the water (u, bossCreatures.ts scale), how far past the bobber it surfaces, and its splash's size (bursts). */
const SIZE: Record<BossTier, { height: number; past: number; splash: number }> = {
  legendary: { height: creatureFor("legendary").scale, past: 7, splash: 3 },
  divine: { height: creatureFor("divine").scale, past: 24, splash: 6 },
};
const PARKED = -1000;
const LAND_S = 2.4, ESCAPE_S = 1.4;

interface Boss {
  tier: BossTier | null; mode: "parked" | "surface" | "fight" | "landed" | "escaped"; t: number;
  x: number; y: number; z: number; dirX: number; dirZ: number; height: number; splashed: number;
  /** Eased offsets: sideways, up, toward the angler, the rear-back tilt. */
  side: number; up: number; toward: number; tilt: number;
}

/** Joining a raid from further off than this (u), the shot is taken this far from it instead. */
const FAR_SHOT = 30;

export default function BossCreature({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const particles = useMoveParticles();
  const legendary = useRef<THREE.Group>(null), divine = useRef<THREE.Group>(null);
  const boss = useRef<Boss>({ tier: null, mode: "parked", t: 0, x: 0, y: 0, z: 0, dirX: 0, dirZ: 1, height: 1, splashed: 0, side: 0, up: 0, toward: 0, tilt: 0 });
  useEffect(() => {
    const b = boss.current;
    const onSurface = (e: Event) => {
      const d = (e as CustomEvent<{ tier?: HookTier; at?: { x: number; z: number } }>).detail, tier = d?.tier, c = live.cast, p = player.current;
      if (tier !== "legendary" && tier !== "divine") return;
      const size = SIZE[tier];
      // Your own catch surfaces past your bobber; a raid you joined from elsewhere, where its angler hooked it, framed
      // from you, or from near it when you're far off (the shot cuts there).
      let fromX: number, fromZ: number, dirX: number, dirZ: number, waterY: number, x: number, z: number;
      if (d.at && p) {
        const dx = d.at.x - p.x, dz = d.at.z - p.z, l = Math.hypot(dx, dz) || 1;
        dirX = dx / l; dirZ = dz / l; waterY = sceneWater.height(d.at.x, d.at.z);
        x = d.at.x + dirX * size.past; z = d.at.z + dirZ * size.past;
        const back = Math.min(l, FAR_SHOT);
        fromX = d.at.x - dirX * back; fromZ = d.at.z - dirZ * back;
      } else if (c) {
        dirX = c.dirX; dirZ = c.dirZ; waterY = c.waterY; fromX = c.fromX; fromZ = c.fromZ;
        x = c.landX + c.dirX * size.past; z = c.landZ + c.dirZ * size.past;
      } else return;
      Object.assign(b, { tier, mode: "surface", t: 0, splashed: 0, side: 0, up: 0, toward: 0, tilt: 0, dirX, dirZ, height: size.height, y: waterY, x, z });
      frameBoss(fromX, waterY + 1, fromZ, dirX, dirZ, Math.hypot(x - fromX, z - fromZ), size.height);
      shakeCamera(HOOK[tier].shake * 0.6, 3); // a long rumble as it comes up
    };
    const onCaught = () => { if (b.tier && b.mode !== "parked") { b.mode = "landed"; b.t = 0; b.splashed = 0; } };
    const onEscaped = () => { if (b.tier && b.mode !== "parked") { b.mode = "escaped"; b.t = 0; } };
    const onEnd = () => { if (b.mode === "surface" || b.mode === "fight") park(b); };
    window.addEventListener("tsi:boss-surface", onSurface);
    window.addEventListener("tsi:fish-caught", onCaught);
    window.addEventListener("tsi:fish-escaped", onEscaped);
    window.addEventListener("tsi:fish-end", onEnd);
    return () => {
      window.removeEventListener("tsi:boss-surface", onSurface);
      window.removeEventListener("tsi:fish-caught", onCaught);
      window.removeEventListener("tsi:fish-escaped", onEscaped);
      window.removeEventListener("tsi:fish-end", onEnd);
      park(b);
    };
  }, [player]);
  useFrame((_, dt) => step(boss.current, legendary.current, divine.current, particles.pool, Math.min(dt, 0.1)));
  return <>
    <group ref={legendary} position={[0, PARKED, 0]}><LegendaryPlaceholder /></group>
    <group ref={divine} position={[0, PARKED, 0]}><DivinePlaceholder /></group>
  </>;
}

function park(b: Boss) {
  b.mode = "parked"; b.tier = null;
  releaseBossCam();
}

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/** Bursts of the catch's splash round the creature's base, spread across its size. */
function splash(pool: ParticlePool, b: Boss, count: number, waterY: number) {
  const r = b.height * 0.22;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    fishLeaps(pool, b.x + Math.cos(a) * r, waterY, b.z + Math.sin(a) * r);
  }
}

/** One frame of the creature (module scope: the react compiler freezes values reached through hooks). */
function step(b: Boss, legendary: THREE.Group | null, divine: THREE.Group | null, pool: ParticlePool, dt: number) {
  if (!legendary || !divine) return;
  if (b.mode === "parked" || !b.tier) {
    legendary.position.y = divine.position.y = PARKED;
    return;
  }
  const g = b.tier === "legendary" ? legendary : divine, other = g === legendary ? divine : legendary;
  other.position.y = PARKED;
  b.t += dt;
  const H = b.height, size = SIZE[b.tier];
  let rise = 0;
  if (b.mode === "surface") {
    const k = b.t / (HOOK[b.tier].surfaceMs / 1000);
    rise = -H * 1.05 * (1 - ease(k * 1.15));
    if (b.splashed === 0 && k > 0.1) { b.splashed = 1; splash(pool, b, size.splash, b.y); }
    if (b.splashed === 1 && k > 0.55) { b.splashed = 2; splash(pool, b, size.splash, b.y); shakeCamera(HOOK[b.tier].shake * 0.5); }
    if (k >= 1) { b.mode = "fight"; b.t = 0; }
  }
  // The fight: the reel's call moves it.
  const f = live.boss, move = f?.stage ? f.move : null, warn = f?.stage === "warn", tired = f ? 1 - f.stamina : 0;
  const goSide = b.mode === "fight" && move === "run" && !warn ? (Math.sin(b.t * 0.7) > 0 ? 1 : -1) * H * 0.45 : 0;
  const goUp = b.mode === "fight" ? (move === "jump" && !warn ? H * 0.35 : move === "dive" && !warn ? -H * 0.5 : 0) - tired * H * 0.12 : 0;
  const goToward = b.mode === "fight" && move === "slack" && !warn ? H * 0.25 : 0;
  b.side = damp(b.side, goSide, 2.5, dt); b.up = damp(b.up, goUp, move === "jump" ? 5 : 2.5, dt); b.toward = damp(b.toward, goToward, 3, dt);
  b.tilt = damp(b.tilt, b.mode === "fight" && warn ? -0.22 : 0, 6, dt);
  if (b.mode === "landed") {
    // Rears up, then crashes down in a great splash and sinks, spent.
    const k = b.t / LAND_S;
    rise = k < 0.3 ? H * 0.25 * ease(k / 0.3) : H * 0.25 - H * 1.4 * ease((k - 0.3) / 0.7);
    if (b.splashed < 3 && k > 0.42) { b.splashed = 3; splash(pool, b, size.splash * 2, b.y); shakeCamera(HOOK[b.tier].shake * 1.4); }
    if (k >= 0.8) releaseBossCam();
    if (k >= 1) { park(b); return; }
  } else if (b.mode === "escaped") {
    const k = b.t / ESCAPE_S;
    rise = -H * 1.1 * ease(k);
    if (k >= 0.6) releaseBossCam();
    if (k >= 1) { park(b); return; }
  }
  const sideX = b.dirZ, sideZ = -b.dirX, sway = Math.sin(performance.now() / 900) * 0.06;
  g.position.set(b.x + sideX * b.side - b.dirX * b.toward, b.y + rise + b.up, b.z + sideZ * b.side - b.dirZ * b.toward);
  g.rotation.set(b.tilt + sway * 0.5, Math.atan2(-b.dirX, -b.dirZ) + sway, sway * 0.4);
}

// ── Placeholder shapes (temporary until David's references) ─────────────────────────────────────────────────────
const legendaryBody = new THREE.MeshStandardMaterial({ name: "BossPlaceholderLegendary", color: "#2f5d62", roughness: 0.75, metalness: 0 });
const legendaryUnder = new THREE.MeshStandardMaterial({ name: "BossPlaceholderBelly", color: "#9cc7b4", roughness: 0.8, metalness: 0 });
const divineBody = new THREE.MeshStandardMaterial({ name: "BossPlaceholderDivine", color: "#d9def7", roughness: 0.6, metalness: 0.1, emissive: "#8a6dff", emissiveIntensity: 0.18 });
const eyeGlow = new THREE.MeshStandardMaterial({ name: "BossPlaceholderEye", color: "#fff3a8", emissive: "#ffd84a", emissiveIntensity: 1.6, roughness: 0.4 });
const holoEye = new THREE.MeshStandardMaterial({ name: "BossPlaceholderHoloEye", color: "#d6fff0", emissive: "#7dffc4", emissiveIntensity: 2, roughness: 0.3 });
const ball = new THREE.SphereGeometry(1, 20, 14);

/** The legendary placeholder, about 13 u tall: generic spheres (a column rising toward you, a top, a trail behind). */
function LegendaryPlaceholder() {
  const neck = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const u = i / 9;
    return { y: -1 + 12 * (1 - (1 - u) * (1 - u)), z: 4 * (1 - u) - 1.2 * u, r: 2.3 - 1.1 * u };
  }), []);
  return <group>
    {neck.map((s, i) => <mesh key={i} geometry={ball} material={legendaryBody} position={[0, s.y, s.z]} scale={[s.r, s.r * 1.1, s.r]} />)}
    <mesh geometry={ball} material={legendaryBody} position={[0, 11.4, -2.6]} scale={[1.5, 1.1, 2.6]} rotation={[0.25, 0, 0]} />
    <mesh geometry={ball} material={legendaryUnder} position={[0, 10.8, -3.2]} scale={[1.2, 0.6, 2]} rotation={[0.25, 0, 0]} />
    {[-0.8, 0.8].map((x) => <mesh key={x} geometry={ball} material={eyeGlow} position={[x, 12, -3.6]} scale={0.32} />)}
    {[7, 10.5, 14].map((z, i) => <mesh key={z} geometry={ball} material={legendaryBody} position={[(i % 2 ? 1 : -1) * 1.2, -0.4, z]} scale={[1.9 - i * 0.3, 1.9 - i * 0.3, 2.4]} />)}
  </group>;
}

/** The divine placeholder, about 34 u tall: generic spheres (a vast mass breaking the surface, two flat side pieces, two lights). */
function DivinePlaceholder() {
  return <group>
    <mesh geometry={ball} material={divineBody} position={[0, 8, 16]} scale={[13, 16, 30]} />
    <mesh geometry={ball} material={divineBody} position={[0, 20, -6]} scale={[10, 14, 13]} />
    <mesh geometry={ball} material={divineBody} position={[0, 27, 6]} scale={[2.2, 9, 5]} rotation={[-0.4, 0, 0]} />
    {[-1, 1].map((s) => <mesh key={s} geometry={ball} material={divineBody} position={[s * 15, 6, 0]} scale={[11, 1.6, 6]} rotation={[0, 0, s * 0.5]} />)}
    {[-4.5, 4.5].map((x) => <mesh key={x} geometry={ball} material={holoEye} position={[x, 23, -17]} scale={1.4} />)}
  </group>;
}
