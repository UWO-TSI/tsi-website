"use client";

/**
 * The ruins zone behind the cliff gate (specs/combat-foundation.md §3–4,
 * combat-content.md A). Canyon terrain from the grid's cliff kit; dump ruins
 * pieces (arches, pillars, moai, torches) as set dressing and collision; the
 * encounter loop (aim, attack, dodge, abilities, enemies from the spawn
 * table, the guardian's patterns, projectiles, missions, safe-zone reset,
 * defeat → wake at the gate) runs here every frame against the combat
 * runtime. Shadows follow the islands' logic (look spec §9): sun shadows on
 * High, contact shadows on both tiers.
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
import { AimReticle, Blasts, EnemyInstances, FloaterProjector, PlayerAuras, Projectiles, Telegraphs, Totems, Wisps } from "./EncounterRender";
import { BOSS_CENTER, ESCORT_PATHS, EXIT_SPOT, FETCH_SPOTS, GATE_PLAZA, RUINS_BROKEN_ARCHES, RUINS_MOAI, RUINS_PILLARS, RUINS_ROCKS, RUINS_SPAWN, RUINS_TORCHES, SURVIVE_CIRCLES, createRuins } from "@/lib/game/ruins";
import { combat, publishCombat, readAbilityKeys, takeMissionQueue, type AbilityId } from "@/lib/game/combat/runtime";
import { attack, missionEvent, spawnWave, triggerAbility } from "@/lib/game/combat/actions";
import { stepCombat } from "@/lib/game/combat/encounter";
import { claimBossReward, postKill, postMissionEvents } from "@/lib/game/combat/progression";
import { materialsLabel } from "@/lib/game/combat/missions";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";
import { inRect, spawnEnemy } from "@/lib/game/combat/sim";
import { capacity, respawnAfter, SPAWN_TABLE, SPAWNS, WAVES } from "@/lib/game/combat/spawns";
import { BOSS_DROPS } from "@/lib/combat/content";
import { TRAITS } from "@/lib/combat/kits";
import { ISLAND_TERRAIN, type IslandLight } from "@/lib/game/islandLighting";
import type { SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import styles from "../DefaultIslandWorld.module.css";

export type RuinsNear = "exit" | "lantern" | null;
const F = "/assets/acnh/furniture/";
const TYPES = SPAWN_TABLE.map(r => r.type);
/** Models your summons and shades can borrow (every non-boss enemy). */
const ALLY_TYPES = TYPES.filter(t => t !== "guardian-statue");
const ESCORTEE: Record<string, { colors: { apron: string; shirt: string }; hat: "straw" | "hood" }> = {
  botanist: { colors: { apron: "#7a5c3e", shirt: "#e8dcc4" }, hat: "straw" },
  scholar: { colors: { apron: "#4b3f6b", shirt: "#d9d2ec" }, hat: "hood" },
};

export function resetEncounter() {
  const rt = combat.rt;
  rt.enemies = SPAWNS.map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z));
  rt.projectiles = []; rt.units = []; rt.buffs = []; rt.blasts = []; rt.floaters = []; rt.casting = null; rt.wave = null; rt.bossEngaged = false; rt.banner = null;
  rt.player = { ...rt.player, hp: rt.player.maxHp, alive: true, safe: true, dodgeAge: null, dodgeCd: 0, attackCd: 0, hurt: 0, downFor: 0, shield: 0, shieldFor: 0, dash: null, impulse: { x: 0, z: 0 } };
  rt.transform = null;
  rt.idol = rt.idol === "carried" ? "temple" : rt.idol;
  const path = rt.mission?.def.template === "escort" && rt.mission.status === "active" ? ESCORT_PATHS[rt.mission.def.id] : null;
  rt.escort = path ? { x: path[0].x, z: path[0].z, hp: 60, waypoint: 1 } : null;
  rt.player.energy = Math.max(rt.player.energy, 0);
}

/** A Transmuter's first defeat of a species (row 40): the server taught a trait; it joins the kit, equipped at the Oracle. */
function traitLearned(key: string, now: number) {
  const rt = combat.rt, t = TRAITS.find(x => x.key === key);
  if (!t || !rt.kit) return;
  rt.kit.traits = { ...rt.kit.traits, [key]: Math.max(1, rt.kit.traits[key] ?? 0) };
  rt.banner = { text: `New trait: ${t.ability.name} (${t.part}). Equip it at the Oracle.`, until: now + 6 };
  publishCombat();
}

/** Boss down: a card now, the server's roll when it answers (the kill must post first). */
function bossVictory(eventKey: string, now: number) {
  const rt = combat.rt;
  rt.banner = { text: "The guardian falls.", until: now + 8 };
  void postKill(BOSS_DROPS.enemy, eventKey).then(k => {
    if (!k.ok) return;
    void claimBossReward(eventKey).then(r => {
      const b = combat.rt.banner;
      if (!b) return;
      if (!r.ok) { b.text = `The guardian falls. ${r.error}`; publishCombat(); return; }
      const { coins, materials, weapon, rarity } = r.data.reward, w = weapon ? WEAPONS[weapon] : null;
      b.text = `The guardian falls. +${coins} coins · ${materialsLabel(materials)}${w ? ` · ${rarity === "legendary" ? "Legendary" : "Epic"}: ${w.name}` : ""}`;
      if (w && !combat.rt.player.owned.includes(w.id)) { combat.rt.player.owned.push(w.id); combat.rt.player.durability[w.id] = w.maxDurability; }
      publishCombat();
    });
  });
}

export default function RuinsScene({ phase, light, look, weather, liteMode, castShadows, zoom, player, onMove, onNear, onDefeat, start }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; castShadows: boolean; zoom: number;
  player: React.RefObject<THREE.Vector3>; onMove: (p: THREE.Vector3) => void; onNear: (near: RuinsNear) => void; onDefeat: () => void;
  /** Dev: start somewhere other than the gate (screenshots). */
  start?: [number, number, number] | null;
}) {
  const spawn = start ?? RUINS_SPAWN;
  const ruins = useMemo(() => createRuins(), []);
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const { camera, gl } = useThree();
  const input = useRef({ ndc: new THREE.Vector2(0, 0), hasPointer: false, attack: false, abilities: [] as AbilityId[] });
  const near = useRef<RuinsNear>(null);
  const zones = useRef({ circle: false, gate: true });
  const syncAt = useRef(0);
  const publishAt = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    player.current.set(...spawn); resetEncounter(); publishCombat();
    // Dev (screenshots): hold a telegraph with __combat.freeze, stage mission steps with __combatDev.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __combatDev: { player: player.current, missionEvent: (ev: Parameters<typeof missionEvent>[1]) => missionEvent(combat.rt, ev), spawnWave: (id: string, i: number) => spawnWave(combat.rt, WAVES[id][i]) } });
  }, [player, spawn]);
  // Dev (screenshots): where a ground point is on the page, to aim the mouse at an enemy.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __combatDev?: Record<string, unknown> }, v = new THREE.Vector3();
    w.__combatDev = { ...w.__combatDev, screenOf: (x: number, z: number) => {
      const r = gl.domElement.getBoundingClientRect(); v.set(x, ruins.ground(x, z) + 0.5, z).project(camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    } };
  }, [camera, gl, ruins, spawn]);
  const focus = useRef(new THREE.Vector3(...spawn));
  useFollowCamera(focus, zoom, null);

  // Mouse aim + click attack on the canvas; ability keys (remappable). Movement, Space's jump and Q's dash-dodge are PlayerAvatar's (the kit).
  useEffect(() => {
    const el = gl.domElement;
    const keys = readAbilityKeys();
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); input.current.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); input.current.hasPointer = true; };
    const down = (e: PointerEvent) => { if (e.button === 0) { move(e); input.current.attack = true; } };
    const up = () => { input.current.attack = false; };
    const kd = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) return;
      const k = e.key.toLowerCase(), ability = (Object.keys(keys) as AbilityId[]).find(a => keys[a] === k);
      if (ability) input.current.abilities.push(ability);
    };
    const onKeys = () => Object.assign(keys, readAbilityKeys());
    el.addEventListener("pointermove", move); el.addEventListener("pointerdown", down); window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd); window.addEventListener("tsi:ability-keys", onKeys);
    return () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd); window.removeEventListener("tsi:ability-keys", onKeys);
    };
  }, [gl]);

  useFrame(({ clock }, rawDelta) => {
    const dt = combat.freeze ? 0 : Math.min(rawDelta, 0.05);
    const rt = combat.rt, p = rt.player, pl = player.current, inp = input.current;
    const me = { x: pl.x, z: pl.z };
    // Aim: pointer ray onto the floor plane; facing follows the aim.
    if (inp.hasPointer) {
      ray.setFromCamera(inp.ndc, camera); plane.current.constant = -ruins.ground(pl.x, pl.z);
      if (ray.ray.intersectPlane(plane.current, hit)) p.aim = { x: hit.x, z: hit.z };
    } else p.aim = { x: pl.x, z: pl.z + 3 };
    p.facing = Math.atan2(p.aim.x - pl.x, p.aim.z - pl.z);
    p.safe = inRect(me, GATE_PLAZA);
    // Defeat: wake at the gate (row 229).
    if (!p.alive) {
      p.downFor += dt;
      if (p.downFor > 1.8) { missionEvent(rt, { kind: "defeated" }); onDefeat(); }
    }
    // Inputs.
    while (inp.abilities.length) triggerAbility(rt, inp.abilities.shift()!, me);
    if (inp.attack) attack(rt, me);
    // Timers, energy, enemies, projectiles, summons and totems (lib/game/combat/encounter.ts); ability dashes and knockback push PlayerAvatar.
    stepCombat(rt, me, dt, ruins.free);
    // Respawn (spawn-table enemies only) once dead long enough and you're away from the spot.
    for (const [i, e] of rt.enemies.entries()) {
      const after = e.state === "dead" && !e.summoned ? respawnAfter(e.id) : 0;
      if (after && e.deadFor > after && Math.hypot(pl.x - e.spawnX, pl.z - e.spawnZ) > 12) rt.enemies[i] = spawnEnemy(e.id, e.type, e.spawnX, e.spawnZ);
    }
    rt.bossEngaged = rt.enemies.some(e => e.type.kind === "boss" && ["chase", "windup", "active", "recover"].includes(e.state));
    if (rt.banner && clock.elapsedTime > rt.banner.until) rt.banner = null;
    // Places → mission events.
    const mission = rt.mission?.status === "active" ? rt.mission : null;
    const circle = mission ? SURVIVE_CIRCLES[mission.def.id] : undefined;
    const inCircle = !!circle && Math.hypot(me.x - circle.x, me.z - circle.z) < circle.r;
    if (p.safe && !zones.current.gate && rt.idol === "carried") missionEvent(rt, { kind: "return" });
    zones.current = { gate: p.safe, circle: inCircle };
    if (rt.idol === "carried" && rt.mission?.status === "complete" && rt.mission.def.template === "fetch") rt.idol = "returned";
    // Survive waves: start on stepping into the mission's circle; next wave when the last is down.
    const waves = mission?.def.template === "survive" ? WAVES[mission.def.id] : undefined;
    if (mission && waves) {
      if (!rt.wave && inCircle) { rt.wave = { index: 0, active: true }; spawnWave(rt, waves[0]); }
      if (rt.wave?.active && waves[rt.wave.index].every(w => rt.enemies.find(e => e.id === w.id)?.state === "dead")) {
        missionEvent(rt, { kind: "wave-cleared", wave: rt.wave.index + 1 });
        const next = rt.wave.index + 1;
        if (next < waves.length && rt.mission?.status === "active") { rt.wave = { index: next, active: true }; spawnWave(rt, waves[next]); } else rt.wave.active = false;
      }
      if (rt.wave?.active && rt.mission?.status === "active") rt.mission.note = `Wave ${rt.wave.index + 1} of ${waves.length}${inCircle ? "" : " · get back in the circle"}`;
    }
    // Escort: the resident walks the path while you're close, and waits otherwise.
    const path = rt.escort && rt.mission ? ESCORT_PATHS[rt.mission.def.id] : undefined;
    if (rt.escort && path) {
      const esc = rt.escort, wp = path[Math.min(esc.waypoint, path.length - 1)];
      const d = Math.hypot(wp.x - esc.x, wp.z - esc.z);
      if (Math.hypot(pl.x - esc.x, pl.z - esc.z) < 5 && d > 0.1) { const st = Math.min(d, 2.6 * dt); esc.x += ((wp.x - esc.x) / d) * st; esc.z += ((wp.z - esc.z) / d) * st; }
      if (d < 0.3 && esc.waypoint < path.length - 1) { missionEvent(rt, { kind: "checkpoint", n: esc.waypoint }); esc.waypoint++; }
      if (esc.hp <= 0) { missionEvent(rt, { kind: "escort-down" }); rt.escort = null; }
      else { const end = path[path.length - 1]; if (esc.waypoint === path.length - 1 && Math.hypot(esc.x - end.x, esc.z - end.z) < 0.3) missionEvent(rt, { kind: "arrived" }); }
    }
    // Prompts.
    const spot = mission?.def.template === "fetch" ? FETCH_SPOTS[mission.def.params.item ?? ""] : undefined;
    const next: RuinsNear = Math.hypot(pl.x - EXIT_SPOT.x, pl.z - EXIT_SPOT.z) < 1.6 ? "exit"
      : spot && rt.idol === "temple" && Math.hypot(pl.x - spot.x, pl.z - spot.z) < 1.4 ? "lantern" : null;
    if (near.current !== next) { near.current = next; onNear(next); }
    if (clock.elapsedTime - publishAt.current > 0.1) { publishAt.current = clock.elapsedTime; publishCombat(); }
    // Server sync (~1/s): kill XP and mission events; both idempotent by key/id. The boss kill also claims its drop.
    if (clock.elapsedTime - syncAt.current > 1) {
      syncAt.current = clock.elapsedTime;
      for (const k of rt.killQueue.splice(0)) {
        if (k.enemy === BOSS_DROPS.enemy) bossVictory(k.key, clock.elapsedTime);
        else void postKill(k.enemy, k.key).then(r => { if (r.ok && r.data.trait_unlocked) traitLearned(r.data.trait_unlocked, clock.elapsedTime); });
      }
      const pid = rt.mission?.progressId;
      if (pid && rt.mission?.queue.length) void postMissionEvents(pid, takeMissionQueue());
    }
  });

  return <>
    {/* The shadow box spans the 40 × 66 canyon (half-diagonal ~39). */}
    <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={false}
      ground={ruins.ground} cloudSize={[40, 66]} shadowExtent={36} fireflyAnchors={[]} />
    <GridWorld map={ruins.map} water={light.water} palette={terrain} windScale={liteMode ? 0 : 1} />
    <Suspense fallback={null}>
      {/* Gate plaza (safe) and the way back. */}
      <GLBProp url={`${F}ruins-arch.glb`} position={[0, ruins.ground(0, -24.4), -24.4]} scale={0.1} />
      <GLBProp url={`${F}ruins-arch.glb`} position={[0, ruins.ground(0, 1.2), 1.2]} scale={0.1} />
      {RUINS_BROKEN_ARCHES.map((a, i) => <GLBProp key={i} url={`${F}ruins-arch-broken.glb`} position={[a.x, ruins.ground(a.x, a.z), a.z]} rotation={[0, a.yaw, 0]} scale={0.1} />)}
      {RUINS_PILLARS.map((p, i) => <GLBProp key={i} url={`${F}ruins-pillar.glb`} position={[p.x, ruins.ground(p.x, p.z), p.z]} rotation={[0, i * 1.3, 0]} scale={0.09} />)}
      {RUINS_ROCKS.map((r, i) => <GLBProp key={i} url={`/assets/acnh/props/${r.model}.glb`} position={[r.x, ruins.ground(r.x, r.z), r.z]} rotation={[0, r.yaw, 0]} />)}
      {RUINS_MOAI.map((m, i) => <GLBProp key={i} url={`${F}ruins-moai.glb`} position={[m.x, ruins.ground(m.x, m.z), m.z]} rotation={[0, Math.PI, 0]} scale={0.07} />)}
      {RUINS_TORCHES.map((t, i) => <GLBProp key={i} url={`${F}ruins-torch.glb`} position={[t.x, ruins.ground(t.x, t.z), t.z]} scale={0.1} />)}
      <pointLight position={[BOSS_CENTER.x, 3, BOSS_CENTER.z]} color="#ffb366" intensity={light.lampsOn ? 18 : 6} distance={12} />
      {TYPES.map(t => <EnemyInstances key={t} typeId={t} capacity={capacity(t)} ground={ruins.ground} />)}
      {Object.entries(SURVIVE_CIRCLES).map(([id, c]) => <RuneCircle key={id} id={id} circle={c} ground={ruins.ground} />)}
      {Object.entries(FETCH_SPOTS).map(([item, s]) => <FetchItem key={item} item={item} spot={s} ground={ruins.ground} player={player} />)}
      <Escort ground={ruins.ground} player={player} />
      <Wisps ground={ruins.ground} />
      {ALLY_TYPES.map(t => <EnemyInstances key={`ally-${t}`} typeId={t} capacity={6} ground={ruins.ground} allies />)}
    </Suspense>
    <Telegraphs ground={ruins.ground} />
    <Projectiles ground={ruins.ground} />
    <Blasts ground={ruins.ground} />
    <Totems ground={ruins.ground} />
    <PlayerAuras player={player} ground={ruins.ground} />
    <AimReticle player={player} ground={ruins.ground} />
    <FloaterProjector />
    <Html position={[EXIT_SPOT.x, 2.2, EXIT_SPOT.z]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>Gate · safe zone</div></Html>
    <PlayerAvatar spawnPosition={spawn} playerName="You" onMove={onMove}
      world={ruins.world} groundHeight={ruins.ground} camTarget={focus} combat />
  </>;
}

/** A fetch mission's item: waits at its spot, rides above your head once picked up. */
function FetchItem({ item, spot, ground, player }: { item: string; spot: (typeof FETCH_SPOTS)[string]; ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current, rt = combat.rt; if (!g) return;
    g.visible = rt.mission?.def.template === "fetch" && rt.mission.def.params.item === item && rt.idol !== "returned";
    const at = rt.idol === "carried" ? { x: player.current.x, z: player.current.z } : spot;
    g.position.set(at.x, (rt.idol === "carried" ? player.current.y + 1.5 : ground(at.x, at.z)) + Math.sin(clock.elapsedTime * 2) * 0.05, at.z);
    g.rotation.y = clock.elapsedTime * 0.8;
  });
  // A pickup that hovers, spins and rides overhead once carried: nothing under it is its ground.
  return <group ref={ref} visible={false}><GLBProp url={spot.model} scale={spot.scale} shadow="none" /></group>;
}

/** A survive mission's circle: a faint ring on the ground (brighter while its waves run). */
function RuneCircle({ id, circle, ground }: { id: string; circle: { x: number; z: number; r: number }; ground: (x: number, z: number) => number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (mat.current) mat.current.opacity = combat.rt.wave?.active && combat.rt.mission?.def.id === id ? 0.55 + Math.sin(clock.elapsedTime * 4) * 0.2 : 0.22; });
  return <mesh position={[circle.x, ground(circle.x, circle.z) + 0.04, circle.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <ringGeometry args={[circle.r - 0.18, circle.r, 64]} /><meshBasicMaterial ref={mat} color="#b48cff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
  </mesh>;
}

function Escort({ ground, player }: { ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current, esc = combat.rt.escort; if (!g) return;
    g.visible = !!esc;
    if (esc) { g.position.set(esc.x, ground(esc.x, esc.z), esc.z); g.rotation.y = Math.atan2(player.current.x - esc.x, player.current.z - esc.z); }
  });
  const who = ESCORTEE[combat.rt.mission?.def.params.escortee ?? ""] ?? ESCORTEE.botanist;
  return <group ref={ref}>
    <InteriorKeeper position={[0, 0, 0]} rotY={0} watch={[0, 0]} colors={who.colors} hat={who.hat} playerPosRef={player as React.MutableRefObject<THREE.Vector3>} />
  </group>;
}
