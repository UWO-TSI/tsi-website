"use client";

/**
 * The ruins zone behind the cliff gate (specs/combat-foundation.md §3–4).
 * Canyon terrain from the grid's cliff kit; dump ruins pieces (arches,
 * pillars, moai, torches) as set dressing and collision; the encounter loop
 * (aim, attack, dodge, abilities, enemies, projectiles, missions, safe-zone
 * reset, defeat → wake at the gate) runs here every frame against the combat
 * runtime. No shadow maps: blob shadows only (30 FPS on integrated graphics).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "../grid/GridWorld";
import PlayerAvatar from "../PlayerAvatar";
import { GLBProp } from "../NatureModels";
import { InteriorKeeper } from "../interiorShared";
import { IslandAtmosphere, useFollowCamera } from "../IslandAtmosphere";
import BlobShadows from "../BlobShadows";
import { AimReticle, Blasts, EnemyInstances, FloaterProjector, Projectiles, Telegraphs, Wisps } from "./EncounterRender";
import { BOSS_CENTER, ESCORT_PATH, EXIT_SPOT, GATE_PLAZA, LANTERN_SPOT, RUINS_BROKEN_ARCHES, RUINS_MOAI, RUINS_PILLARS, RUINS_ROCKS, RUINS_SPAWN, RUINS_TORCHES, RUNE_CIRCLE, createRuins } from "@/lib/game/ruins";
import { combat, publishCombat, readAbilityKeys, takeMissionQueue, type AbilityId } from "@/lib/game/combat/runtime";
import { attack, floater, hurtPlayer, missionEvent, regenEnergy, resolvePlayerShot, spawnWave, startDodge, triggerAbility } from "@/lib/game/combat/actions";
import { postKill, postMissionEvents } from "@/lib/game/combat/progression";
import { ENEMIES } from "@/lib/game/combat/data";
import { DODGE, inRect, spawnEnemy, stepEnemy, strikeLands, sweptHit } from "@/lib/game/combat/sim";
import { SPAWNS, WAVES } from "@/lib/game/combat/spawns";
import { ISLAND_TERRAIN, type IslandLight } from "@/lib/game/islandLighting";
import type { SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import styles from "../DefaultIslandWorld.module.css";

export type RuinsNear = "exit" | "lantern" | null;
const F = "/assets/acnh/furniture/";
const TYPE_COUNTS = SPAWNS.reduce<Record<string, number>>((m, s) => ({ ...m, [s.type]: (m[s.type] ?? 0) + 1 }), {});

export function resetEncounter() {
  const rt = combat.rt;
  rt.enemies = SPAWNS.map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z));
  rt.projectiles = []; rt.minions = []; rt.blasts = []; rt.floaters = []; rt.casting = null; rt.wave = null; rt.bossEngaged = false;
  rt.player = { ...rt.player, hp: rt.player.maxHp, alive: true, safe: true, dodgeAge: null, dodgeCd: 0, attackCd: 0, hurt: 0, downFor: 0 };
  rt.idol = rt.idol === "carried" ? "temple" : rt.idol;
  rt.escort = rt.mission?.def.template === "escort" && rt.mission.status === "active" ? { x: 0, z: -27, hp: 60, waypoint: 1 } : null;
  rt.player.energy = Math.max(rt.player.energy, 0);
}

export default function RuinsScene({ phase, light, look, weather, liteMode, zoom, player, onMove, onNear, onDefeat, start }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; zoom: number;
  player: React.RefObject<THREE.Vector3>; onMove: (p: THREE.Vector3) => void; onNear: (near: RuinsNear) => void; onDefeat: () => void;
  /** Dev: start somewhere other than the gate (screenshots). */
  start?: [number, number, number] | null;
}) {
  const spawn = start ?? RUINS_SPAWN;
  const ruins = useMemo(() => createRuins(), []);
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const { camera, gl } = useThree();
  const impulse = useRef({ x: 0, z: 0 });
  const input = useRef({ ndc: new THREE.Vector2(0, 0), hasPointer: false, attack: false, dodge: false, abilities: [] as AbilityId[], keys: { w: false, a: false, s: false, d: false } });
  const near = useRef<RuinsNear>(null);
  const zones = useRef({ circle: false, gate: true });
  const syncAt = useRef(0);
  const publishAt = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { player.current.set(...spawn); resetEncounter(); publishCombat(); }, [player, spawn]);
  useFollowCamera(player, zoom, null);

  // Mouse aim + click attack on the canvas; Space dodge; ability keys (remappable).
  useEffect(() => {
    const el = gl.domElement;
    const keys = readAbilityKeys();
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); input.current.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); input.current.hasPointer = true; };
    const down = (e: PointerEvent) => { if (e.button === 0) { move(e); input.current.attack = true; } };
    const up = () => { input.current.attack = false; };
    const key = (e: KeyboardEvent, on: boolean) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      if (k in input.current.keys) input.current.keys[k as "w"] = on;
      if (!on || e.repeat) return;
      if (k === " ") { input.current.dodge = true; e.preventDefault(); }
      const ability = (Object.keys(keys) as AbilityId[]).find(a => keys[a] === k);
      if (ability) input.current.abilities.push(ability);
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    const onKeys = () => Object.assign(keys, readAbilityKeys());
    el.addEventListener("pointermove", move); el.addEventListener("pointerdown", down); window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("tsi:ability-keys", onKeys);
    return () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("tsi:ability-keys", onKeys);
    };
  }, [gl]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const rt = combat.rt, p = rt.player, pl = player.current, inp = input.current;
    const me = { x: pl.x, z: pl.z };
    // Aim: pointer ray onto the floor plane; facing follows the aim.
    if (inp.hasPointer) {
      ray.setFromCamera(inp.ndc, camera); plane.current.constant = -ruins.ground(pl.x, pl.z);
      if (ray.ray.intersectPlane(plane.current, hit)) p.aim = { x: hit.x, z: hit.z };
    } else p.aim = { x: pl.x, z: pl.z + 3 };
    p.facing = Math.atan2(p.aim.x - pl.x, p.aim.z - pl.z);
    // Timers.
    p.attackCd = Math.max(0, p.attackCd - dt); p.swing = Math.max(0, p.swing - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.hurt = Math.max(0, p.hurt - dt);
    for (const k of Object.keys(rt.cooldowns) as AbilityId[]) rt.cooldowns[k] = Math.max(0, rt.cooldowns[k] - dt);
    p.safe = inRect(me, GATE_PLAZA);
    // Defeat: wake at the gate (row 229).
    if (!p.alive) {
      p.downFor += dt; impulse.current = { x: 0, z: 0 };
      if (p.downFor > 1.8) { missionEvent(rt, { kind: "defeated" }); onDefeat(); }
    }
    // Inputs.
    if (inp.dodge) {
      inp.dodge = false;
      const k = inp.keys, cf = new THREE.Vector3(); camera.getWorldDirection(cf);
      const fx = cf.x, fz = cf.z, l = Math.hypot(fx, fz) || 1;
      let dx = 0, dz = 0;
      if (k.w) { dx += fx / l; dz += fz / l; } if (k.s) { dx -= fx / l; dz -= fz / l; }
      if (k.d) { dx -= fz / l; dz += fx / l; } if (k.a) { dx += fz / l; dz -= fx / l; }
      startDodge(rt, dx || dz ? { x: dx, z: dz } : { x: Math.sin(p.facing), z: Math.cos(p.facing) });
    }
    while (inp.abilities.length) triggerAbility(rt, inp.abilities.shift()!, me);
    regenEnergy(rt, dt);
    if (inp.attack) attack(rt, me);
    // Dodge dash / knockback impulse for PlayerAvatar.
    if (p.dodgeAge !== null) {
      p.dodgeAge += dt;
      const on = p.dodgeAge < DODGE.duration;
      impulse.current = on ? { x: p.dodgeDir.x * DODGE.speed * (1 - p.dodgeAge / DODGE.duration * 0.6), z: p.dodgeDir.z * DODGE.speed * (1 - p.dodgeAge / DODGE.duration * 0.6) } : { x: 0, z: 0 };
      if (!on) p.dodgeAge = null;
    } else impulse.current = p.hurt > 0.2 ? { x: p.dodgeDir.x * 5, z: p.dodgeDir.z * 5 } : { x: 0, z: 0 };
    // Enemies.
    const target = { x: pl.x, z: pl.z, safe: p.safe, alive: p.alive };
    for (const e of rt.enemies) {
      const ev = stepEnemy(e, target, dt, (x, z) => ruins.free(x, z, e.type.radius * 0.6));
      if (!ev) continue;
      if (ev.kind === "strike") {
        if (strikeLands(e, me)) hurtPlayer(rt, e.type.attack.damage, e, me);
        if (rt.escort && strikeLands(e, rt.escort, 0.4)) { rt.escort.hp -= e.type.attack.damage; floater(rt, rt.escort, 1.8, `-${e.type.attack.damage}`, "hurt"); }
        if (rt.escort && Math.hypot(rt.escort.x - e.x, rt.escort.z - e.z) < Math.hypot(pl.x - e.x, pl.z - e.z)) e.aim = { x: rt.escort.x, z: rt.escort.z };
      } else if (ev.kind === "spit") {
        const d = Math.hypot(ev.to.x - e.x, ev.to.z - e.z) || 1, sp = 9;
        rt.projectiles.push({ id: rt.seq++, x: e.x, z: e.z, vx: ((ev.to.x - e.x) / d) * sp, vz: ((ev.to.z - e.z) / d) * sp, life: (e.type.attack.range + 2) / sp, from: "enemy", damage: e.type.attack.damage, kind: "spit", radius: 0.3 });
      }
    }
    rt.bossEngaged = rt.enemies.some(e => e.type.kind === "boss" && ["chase", "windup", "recover"].includes(e.state));
    // Projectiles.
    for (let i = rt.projectiles.length - 1; i >= 0; i--) {
      const s = rt.projectiles[i], from = { x: s.x, z: s.z };
      s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
      const to = { x: s.x, z: s.z };
      let gone = s.life <= 0 || !ruins.free(s.x, s.z, 0.05);
      if (!gone && s.from === "player") gone = resolvePlayerShot(rt, i, from, to, sweptHit);
      else if (!gone && s.from === "enemy" && sweptHit(from, to, me, 0.35 + s.radius)) { hurtPlayer(rt, s.damage, from, me); gone = true; }
      if (gone) rt.projectiles.splice(i, 1);
    }
    // Wisps (summons): drift to the nearest enemy and nip it.
    for (let i = rt.minions.length - 1; i >= 0; i--) {
      const m = rt.minions[i]; m.life -= dt; m.cooldown -= dt;
      if (m.life <= 0) { rt.minions.splice(i, 1); continue; }
      const foe = rt.enemies.filter(e => e.state !== "dead" && e.state !== "return" && Math.hypot(e.x - m.x, e.z - m.z) < 8).sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0];
      const goal = foe ?? { x: pl.x - 0.8, z: pl.z - 0.4 };
      const d = Math.hypot(goal.x - m.x, goal.z - m.z);
      if (d > 0.9) { m.x += ((goal.x - m.x) / d) * 5 * dt; m.z += ((goal.z - m.z) / d) * 5 * dt; }
      else if (foe && m.cooldown <= 0) {
        m.cooldown = 0.9;
        rt.projectiles.push({ id: rt.seq++, x: m.x, z: m.z, vx: ((foe.x - m.x) / (d || 1)) * 14, vz: ((foe.z - m.z) / (d || 1)) * 14, life: 0.3, from: "player", damage: -1, kind: "bolt", radius: 0.2 });
      }
    }
    for (let i = rt.blasts.length - 1; i >= 0; i--) { rt.blasts[i].age += dt; if (rt.blasts[i].age > rt.blasts[i].life) rt.blasts.splice(i, 1); }
    for (let i = rt.floaters.length - 1; i >= 0; i--) { rt.floaters[i].age += dt; if (rt.floaters[i].age > 1.1) rt.floaters.splice(i, 1); }
    // Places → mission events.
    const inCircle = Math.hypot(me.x - RUNE_CIRCLE.x, me.z - RUNE_CIRCLE.z) < RUNE_CIRCLE.r;
    if (p.safe && !zones.current.gate && rt.idol === "carried") missionEvent(rt, { kind: "return" });
    zones.current = { gate: p.safe, circle: inCircle };
    if (rt.idol === "carried" && rt.mission?.status === "complete" && rt.mission.def.template === "fetch") rt.idol = "returned";
    // Survive waves: start on stepping into the rune circle; next wave when the last is down.
    if (rt.mission?.def.template === "survive" && rt.mission.status === "active") {
      if (!rt.wave && inCircle) { rt.wave = { index: 0, active: true }; spawnWave(rt, WAVES[0]); }
      if (rt.wave?.active && rt.mission.status === "active") rt.mission.note = `Wave ${rt.wave.index + 1} of ${WAVES.length}${inCircle ? "" : " · get back in the circle"}`;
      else if (rt.wave?.active && WAVES[rt.wave.index].every(w => rt.enemies.find(e => e.id === w.id)?.state === "dead")) {
        missionEvent(rt, { kind: "wave-cleared", wave: rt.wave.index + 1 });
        const next = rt.wave.index + 1;
        if (next < WAVES.length && rt.mission.status === "active") { rt.wave = { index: next, active: true }; spawnWave(rt, WAVES[next]); } else rt.wave.active = false;
      }
    }
    // Escort: the archivist walks the path while you're close, and waits otherwise.
    if (rt.escort) {
      const esc = rt.escort, wp = ESCORT_PATH[Math.min(esc.waypoint, ESCORT_PATH.length - 1)];
      const d = Math.hypot(wp.x - esc.x, wp.z - esc.z);
      if (Math.hypot(pl.x - esc.x, pl.z - esc.z) < 5 && d > 0.1) { const st = Math.min(d, 2.6 * dt); esc.x += ((wp.x - esc.x) / d) * st; esc.z += ((wp.z - esc.z) / d) * st; }
      if (d < 0.3 && esc.waypoint < ESCORT_PATH.length - 1) { missionEvent(rt, { kind: "checkpoint", n: esc.waypoint }); esc.waypoint++; }
      if (esc.hp <= 0) { missionEvent(rt, { kind: "escort-down" }); rt.escort = null; }
      else { const end = ESCORT_PATH[ESCORT_PATH.length - 1]; if (esc.waypoint === ESCORT_PATH.length - 1 && Math.hypot(esc.x - end.x, esc.z - end.z) < 0.3) missionEvent(rt, { kind: "arrived" }); }
    }
    // Prompts.
    const next: RuinsNear = Math.hypot(pl.x - EXIT_SPOT.x, pl.z - EXIT_SPOT.z) < 1.6 ? "exit"
      : rt.mission?.def.template === "fetch" && rt.mission.status === "active" && rt.idol === "temple" && Math.hypot(pl.x - LANTERN_SPOT.x, pl.z - LANTERN_SPOT.z) < 1.4 ? "lantern" : null;
    if (near.current !== next) { near.current = next; onNear(next); }
    if (clock.elapsedTime - publishAt.current > 0.1) { publishAt.current = clock.elapsedTime; publishCombat(); }
    // Server sync (~1/s): kill XP and mission events; both idempotent by key/id.
    if (clock.elapsedTime - syncAt.current > 1) {
      syncAt.current = clock.elapsedTime;
      for (const k of rt.killQueue.splice(0)) void postKill(k.enemy, k.key);
      const pid = rt.mission?.progressId;
      if (pid && rt.mission?.queue.length) void postMissionEvents(pid, takeMissionQueue());
    }
  });

  const blobs = useMemo(() => [
    ...RUINS_PILLARS.map(p => ({ ...p, y: 0, rx: 0.9, rz: 0.8 })), ...RUINS_ROCKS.map(p => ({ ...p, y: 0, rx: 1, rz: 0.8 })),
    ...RUINS_MOAI.map(p => ({ ...p, y: 0, rx: 1, rz: 1 })),
  ], []);
  return <>
    <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={false} overview={false}
      player={player} ground={ruins.ground} cloudSize={[40, 66]} shadowExtent={16} fireflyAnchors={[]} />
    <GridWorld map={ruins.map} water={light.water} palette={terrain} windScale={liteMode ? 0 : 1} />
    <BlobShadows placements={blobs} opacity={0.4} />
    <Suspense fallback={null}>
      {/* Gate plaza (safe) and the way back. */}
      <GLBProp url={`${F}ruins-arch.glb`} position={[0, ruins.ground(0, -24.4), -24.4]} scale={0.1} castShadow={false} />
      <GLBProp url={`${F}ruins-arch.glb`} position={[0, ruins.ground(0, 1.2), 1.2]} scale={0.1} castShadow={false} />
      {RUINS_BROKEN_ARCHES.map((a, i) => <GLBProp key={i} url={`${F}ruins-arch-broken.glb`} position={[a.x, ruins.ground(a.x, a.z), a.z]} rotation={[0, a.yaw, 0]} scale={0.1} castShadow={false} />)}
      {RUINS_PILLARS.map((p, i) => <GLBProp key={i} url={`${F}ruins-pillar.glb`} position={[p.x, ruins.ground(p.x, p.z), p.z]} rotation={[0, i * 1.3, 0]} scale={0.09} castShadow={false} />)}
      {RUINS_ROCKS.map((r, i) => <GLBProp key={i} url={`/assets/acnh/props/${r.model}.glb`} position={[r.x, ruins.ground(r.x, r.z), r.z]} rotation={[0, r.yaw, 0]} castShadow={false} />)}
      {RUINS_MOAI.map((m, i) => <GLBProp key={i} url={`${F}ruins-moai.glb`} position={[m.x, ruins.ground(m.x, m.z), m.z]} rotation={[0, Math.PI, 0]} scale={0.07} castShadow={false} />)}
      {RUINS_TORCHES.map((t, i) => <GLBProp key={i} url={`${F}ruins-torch.glb`} position={[t.x, ruins.ground(t.x, t.z), t.z]} scale={0.1} castShadow={false} />)}
      <pointLight position={[BOSS_CENTER.x, 3, BOSS_CENTER.z]} color="#ffb366" intensity={light.lampsOn ? 18 : 6} distance={12} />
      {Object.keys(TYPE_COUNTS).map(t => <EnemyInstances key={t} typeId={t} capacity={TYPE_COUNTS[t] + 4} ground={ruins.ground} />)}
      <RuneCircle ground={ruins.ground} />
      <Idol ground={ruins.ground} player={player} />
      <Escort ground={ruins.ground} player={player} />
      <Wisps ground={ruins.ground} />
    </Suspense>
    <Telegraphs ground={ruins.ground} />
    <Projectiles ground={ruins.ground} />
    <Blasts ground={ruins.ground} />
    <AimReticle player={player} ground={ruins.ground} />
    <FloaterProjector />
    <Html position={[EXIT_SPOT.x, 2.2, EXIT_SPOT.z]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>Gate · safe zone</div></Html>
    <PlayerAvatar spawnPosition={spawn} playerName="You" onMove={onMove} frozen={!!combat.rt.casting || !combat.rt.player.alive}
      groundHeight={ruins.ground} constrainMove={ruins.move} impulse={impulse} noHop combat />
  </>;
}

function Idol({ ground, player }: { ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current, rt = combat.rt; if (!g) return;
    const active = rt.mission?.def.template === "fetch";
    g.visible = active && rt.idol !== "returned";
    const at = rt.idol === "carried" ? { x: player.current.x, z: player.current.z } : LANTERN_SPOT;
    g.position.set(at.x, (rt.idol === "carried" ? player.current.y + 1.5 : ground(at.x, at.z)) + Math.sin(clock.elapsedTime * 2) * 0.05, at.z);
    g.rotation.y = clock.elapsedTime * 0.8;
  });
  return <group ref={ref}><GLBProp url="/assets/acnh/props/stone-lantern.glb" scale={0.45} castShadow={false} /></group>;
}

/** The survive mission's rune circle: a faint ring on the ground (brighter while waves run). */
function RuneCircle({ ground }: { ground: (x: number, z: number) => number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (mat.current) mat.current.opacity = combat.rt.wave?.active ? 0.55 + Math.sin(clock.elapsedTime * 4) * 0.2 : 0.22; });
  return <mesh position={[RUNE_CIRCLE.x, ground(RUNE_CIRCLE.x, RUNE_CIRCLE.z) + 0.04, RUNE_CIRCLE.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <ringGeometry args={[RUNE_CIRCLE.r - 0.18, RUNE_CIRCLE.r, 64]} /><meshBasicMaterial ref={mat} color="#b48cff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
  </mesh>;
}

function Escort({ ground, player }: { ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current, esc = combat.rt.escort; if (!g) return;
    g.visible = !!esc;
    if (esc) { g.position.set(esc.x, ground(esc.x, esc.z), esc.z); g.rotation.y = Math.atan2(player.current.x - esc.x, player.current.z - esc.z); }
  });
  return <group ref={ref}>
    <InteriorKeeper position={[0, 0, 0]} rotY={0} watch={[0, 0]} colors={{ apron: "#7a5c3e", shirt: "#e8dcc4" }} hat="straw" playerPosRef={player as React.MutableRefObject<THREE.Vector3>} />
  </group>;
}

