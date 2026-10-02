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
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "../grid/GridWorld";
import PlayerAvatar from "../PlayerAvatar";
import Character, { type CharacterMotion } from "../character/Character";
import { hashSeed, randomLook, seeded } from "@/lib/game/character/look";
import { GLBProp } from "../NatureModels";
import { IslandAtmosphere, useFollowCamera } from "../IslandAtmosphere";
import MobFx from "./MobFx";
import CombatFx from "./CombatFx";
import { AimReticle, Blasts, EnemyBars, EnemyInstances, FloaterProjector, PlayerAuras, Projectiles, Telegraphs, Totems, Wisps } from "./EncounterRender";
import { BOSS_CENTER, ESCORT_PATHS, EXIT_SPOT, FETCH_SPOTS, GATE_PLAZA, RUINS_BROKEN_ARCHES, RUINS_MOAI, RUINS_PILLARS, RUINS_ROCKS, RUINS_SPAWN, RUINS_TORCHES, SURVIVE_CIRCLES, createRuins } from "@/lib/game/ruins";
import { combat, publishCombat, takeMissionQueue, V2_SLOT_IDS, type AbilityId, type CombatRuntime, type CueKind } from "@/lib/game/combat/runtime";
import { classKey, equipClassKit, pressUlt, stepClass } from "@/lib/game/combat/classRuntime";
import { unlocksAt } from "@/lib/combat/classes";
import { AudioManager, type SFXName } from "@/lib/game/audio";
import { useAbilityKeys } from "@/lib/game/movement/keys";
import { screenOf, useMoveParticles } from "../movement/moveFx";
import { defeatPuff } from "@/lib/game/movement/juice";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { holdFov, shakeCamera, widenFov } from "@/lib/game/cameraJuice";
import { timeScale as worldSpeed, ultSlowMotion } from "@/lib/game/slowMotion";
import { FlashLimiter, hitImpact, HitstopBudget, impactView, ultBeats } from "@/lib/game/combat/impact";
import { readComfort } from "@/lib/game/comfortSettings";
import { ULT } from "@/lib/combat/ult";
import { capture, crosshairAim } from "@/lib/game/orbitCamera";
import { boxOccluder } from "@/lib/game/occluders";
import { BUFFER, createInputs, runInputs, spawnWave } from "@/lib/game/combat/actions";
import { missionEvent } from "@/lib/game/combat/abilities";
import { stepCombat } from "@/lib/game/combat/encounter";
import { claimBossReward, claimMinibossReward, postKill, postMissionEvents } from "@/lib/game/combat/progression";
import { materialsLabel } from "@/lib/game/combat/missions";
import { ENEMIES, WEAPONS } from "@/lib/game/combat/data";
import { inRect, spawnEnemy, type Vec } from "@/lib/game/combat/sim";
import { capacity, respawnAfter, SPAWN_TABLE, SPAWNS, WAVES } from "@/lib/game/combat/spawns";
import { BOSS_DROPS, ELDER_DROPS, MINIBOSS_DROPS } from "@/lib/combat/content";
import { TRAITS } from "@/lib/combat/kits";
import { ISLAND_TERRAIN, type IslandLight } from "@/lib/game/islandLighting";
import type { SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import type { WeaponKind } from "@/lib/game/combat/contract";
import styles from "../DefaultIslandWorld.module.css";

export type RuinsNear = "exit" | "lantern" | null;
const F = "/assets/acnh/furniture/";
const TYPES = SPAWN_TABLE.map(r => r.type);
/** Models your summons and shades can borrow (every non-boss enemy). */
const ALLY_TYPES = TYPES.filter(t => t !== "guardian-statue");

export function resetEncounter() {
  const rt = combat.rt;
  rt.enemies = SPAWNS.map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z, s.pack));
  rt.projectiles = []; rt.units = []; rt.buffs = []; rt.blasts = []; rt.floaters = []; rt.hazards = []; rt.mobFx = []; rt.casting = null; rt.wave = null; rt.bossEngaged = false; rt.banner = null;
  rt.player = { ...rt.player, hp: rt.player.maxHp, alive: true, safe: true, dodgeAge: null, dodgeCd: 0, attackCd: 0, hurt: 0, downFor: 0, shield: 0, shieldFor: 0, dash: null, impulse: { x: 0, z: 0 } };
  rt.transform = null;
  rt.idol = rt.idol === "carried" ? "temple" : rt.idol;
  const path = rt.mission?.def.template === "escort" && rt.mission.status === "active" ? ESCORT_PATHS[rt.mission.def.id] : null;
  rt.escort = path ? { x: path[0].x, z: path[0].z, hp: 60, waypoint: 1 } : null;
  rt.player.energy = Math.max(rt.player.energy, 0);
  // Classes v2: the meter starts empty on entry and empties on defeat (§1.2); nothing held, toggled or queued carries over.
  if (rt.v2) Object.assign(rt.v2, { meter: 0, cast: null, queue: [], holding: rt.v2.holding.map(() => null), toggled: rt.v2.toggled.map(() => false), recast: rt.v2.recast.map(() => 0), combatT: 0 });
  rt.player.ultIframes = 0; rt.player.kick = null; rt.player.clip = null; rt.fx = [];
}

/** Classes v2: a kill trained the active subclass; a new level's unlocks apply now (the meter and cooldowns carry). */
function masteryUp(m: { mastery: number; into: number; needed: number; levelled_up: boolean }, now: number) {
  const rt = combat.rt, v = rt.v2, level = m.mastery;
  if (!v) return;
  v.progress = { into: m.into, needed: m.needed };
  if (!m.levelled_up || level <= v.mastery) return;
  equipClassKit(rt, v.kit, level, v.progress);
  rt.banner = { kind: "mastery", title: `${v.kit.name} mastery ${level}`, text: unlocksAt(v.kit, level).join(" · ") || "Your path grows stronger.", until: now + 6 };
  publishCombat();
}

/** A Transmuter's first defeat of a species (row 40): the server taught a trait; it joins the kit, equipped at the Oracle. Returns its name. */
function traitLearned(key: string, now: number, card = true): string | null {
  const rt = combat.rt, t = TRAITS.find(x => x.key === key);
  if (!t || !rt.kit) return null;
  rt.kit.traits = { ...rt.kit.traits, [key]: Math.max(1, rt.kit.traits[key] ?? 0) };
  if (card) rt.banner = { kind: "trait", title: `New trait: ${t.ability.name}`, text: `From its ${t.part}. Equip it at the Oracle.`, until: now + 6 };
  publishCombat();
  return t.ability.name;
}

/** The fights with spoils: the guardian (boss-reward) and the mini-bosses (miniboss-reward, the elder thorn crab). */
const VICTORY: Record<string, string> = { [BOSS_DROPS.enemy]: "The guardian falls", [ELDER_DROPS.enemy]: "The elder thorn crab yields" };
const RARITY = { legendary: "Legendary", epic: "Epic", rare: "Rare" } as const;
/** Down: a card now, the server's roll when it answers (the kill must post first). */
function victory(enemy: string, eventKey: string, now: number) {
  const rt = combat.rt, mini = enemy !== BOSS_DROPS.enemy;
  rt.banner = { kind: "victory", title: VICTORY[enemy] ?? "Victory", text: "Counting the spoils…", until: now + 8 };
  void postKill(enemy, eventKey).then(k => {
    if (!k.ok) return;
    const trait = k.data.trait_unlocked ? traitLearned(k.data.trait_unlocked, now, false) : null; // the elder can teach the Crab Shell
    void (mini ? claimMinibossReward(enemy, eventKey) : claimBossReward(eventKey)).then(r => {
      const b = combat.rt.banner;
      if (!b) return;
      if (!r.ok) { b.text = r.error; publishCombat(); return; }
      const { coins, materials, weapon, rarity } = r.data.reward, w = weapon ? WEAPONS[weapon] : null;
      b.text = `+${coins} coins · ${materialsLabel(materials)}${w && rarity ? ` · ${RARITY[rarity]}: ${w.name}` : ""}${trait ? ` · New trait: ${trait}` : ""}`;
      if (w && !combat.rt.player.owned.includes(w.id)) { combat.rt.player.owned.push(w.id); combat.rt.player.durability[w.id] = w.maxDurability; }
      publishCombat();
    });
  });
}

const ENGAGED = new Set(["chase", "windup", "active", "recover"]);

/**
 * Combat cues on the existing CC0 set (public/audio/sfx/MANIFEST.md): [file, rate, gain]. A rate below 1 plays a file
 * lower and longer, so one file can serve two cues. The dodge is the kit's dash sound (PlayerAvatar).
 */
type Sound = [SFXName, number, number];
const CUE_SOUND: Record<Exclude<CueKind, "swing">, Sound[]> = {
  hit: [["blip3", 0.8, 0.9]],
  crit: [["blip3", 0.62, 1], ["click", 0.85, 0.8]],
  hurt: [["exit", 1.35, 0.75]],
  defeat: [["confirm", 0.75, 0.6]],
  windup: [["blip1", 0.7, 0.4]],
  stagger: [["exit", 0.6, 1]],
  bossDefeat: [["enter", 0.6, 1], ["confirm", 0.6, 0.9]],
};
const SWING_SOUND: Record<WeaponKind, Sound> = { melee: ["footstep", 1.5, 0.7], bow: ["click", 0.7, 0.7], staff: ["blip2", 0.8, 0.5], summon: ["blip1", 1.2, 0.5] };
/** Impact (combat polish 4): a beat of hitstop on melee hits, crits and hits taken; a small shake (world units) per cue. */
const HITSTOP = 0.06;
const SHAKE: Partial<Record<CueKind, number>> = { crit: 0.07, hurt: 0.12, stagger: 0.1, bossDefeat: 0.25 };
const budget = new HitstopBudget(), flashes = new FlashLimiter();
function impact(rt: CombatRuntime, pool: ParticlePool, ground: (x: number, z: number) => number) {
  if (rt.v2) return impactV2(rt, pool, ground);
  for (const c of rt.cues) {
    if ((c.kind === "hit" && c.melee) || c.kind === "crit" || c.kind === "hurt") combat.hitstop = Math.max(combat.hitstop, HITSTOP);
    const shake = c.kind === "hit" && c.melee ? 0.035 : SHAKE[c.kind];
    if (shake) shakeCamera(shake);
    // An enemy falls: it pops (EncounterRender) and leaves a puff of our painted dust.
    if (c.kind === "defeat" || c.kind === "bossDefeat") defeatPuff(pool, c.x, ground(c.x, c.z), c.z, c.kind === "bossDefeat" ? 2.2 : 1);
  }
}
/**
 * Classes v2 (design sheet §1.6): each hit by its tier through the hitstop budget (the longest wins, at most 200 ms a
 * second), the Screen shake setting, the heavy tier's FOV kick; the world draws a hit's sparks, the heavy tier's
 * speed lines and shock ring, from FX events in the kit's ramp (lib/game/fx/combat.ts).
 */
function impactV2(rt: CombatRuntime, pool: ParticlePool, ground: (x: number, z: number) => number) {
  const now = performance.now() / 1000, reduce = readComfort().reduceFlashing;
  for (const c of rt.cues) {
    const tier = c.kind === "defeat" && c.tier === "heavy" ? "heavy" : c.kind === "hit" || c.kind === "crit" ? c.tier ?? "light" : null;
    if (tier) {
      const h = hitImpact(tier, c.melee, !!c.first, reduce);
      combat.hitstop = budget.take(Math.max(h.hitstop, c.kind === "crit" ? HITSTOP : 0), combat.hitstop, now);
      if (h.shake) shakeCamera(h.shake);
      if (h.fov) widenFov(h.fov);
      if (rt.v2 && tier !== "ult") rt.fx.push({ caster: "me", key: `hit.${tier}`, phase: "impact", x: c.x, z: c.z, aim: { x: c.x, z: c.z }, seed: (Math.round(c.x * 97) ^ Math.round(c.z * 89) ^ rt.seq++) >>> 0, tier, ramp: rt.v2.kit.look.ramp });
    }
    if (c.kind === "hurt") combat.hitstop = budget.take(HITSTOP, combat.hitstop, now);
    if (c.kind === "bossDefeat") bossBeat = { t: 0, aim: { x: c.x, z: c.z } }; // the boss defeat lands at the ult tier (§1.6)
    const shake = SHAKE[c.kind];
    if (shake && c.kind !== "crit") shakeCamera(shake);
    if (c.kind === "defeat" || c.kind === "bossDefeat") defeatPuff(pool, c.x, ground(c.x, c.z), c.z, c.kind === "bossDefeat" ? 2.2 : 1);
  }
}

/**
 * The ult's beats each frame (impact.ts ultBeats): the freeze as hitstop, the FOV hold, slow motion, the heavy shake
 * once, the flash frame through the limiter (the canvas cut to two tones, or darkened with Reduce flashing), and the
 * overlay pass's screen spots. The meter filling plays the ready chime and the bottom-edge glow.
 */
const ultScratch = new THREE.Vector3();
let ultPrevT = -1, wasReady = false, bossBeat: { t: number; aim: Vec } | null = null;
/** The boss defeat's sequence: no wind-up (it's already down), the rest of the ult's beats. */
const BOSS_A = 0.05;
function ultPresentation(rt: CombatRuntime, camera: THREE.Camera, canvas: HTMLCanvasElement, me: Vec, ground: (x: number, z: number) => number, real: number) {
  const v = rt.v2, reduce = readComfort().reduceFlashing, view = impactView;
  if (bossBeat && (bossBeat.t += real) > BOSS_A + 3) bossBeat = null;
  const cast = v?.cast ?? (v ? bossBeat : null), A = v?.cast ? v.ult.anticipation_ms / 1000 : BOSS_A;
  view.reduceFlashing = reduce;
  if (v) {
    view.color = v.kit.look.ramp[1];
    const ready = v.meter >= ULT.max;
    if (ready && !wasReady) { view.readyAt = performance.now() / 1000; AudioManager.playSFX("confirm", { rate: 1.25, gain: 0.7 }); }
    wasReady = ready;
  }
  if (!v || !cast) {
    if (view.beats) { view.beats = null; holdFov(0); ultSlowMotion(1); canvas.style.filter = ""; }
    ultPrevT = -1;
    return;
  }
  // A first-last ult (§1.6): past its window the finisher's beats run on the same clock again.
  const span = v?.cast && v.ult.impacts === "first-last" ? v.ult.duration ?? 0 : 0, shift = span && cast.t >= A + span ? span : 0;
  const b = ultBeats(cast.t - shift, A, reduce, ultPrevT - shift);
  if (b.freeze) combat.hitstop = Math.max(combat.hitstop, A + 0.12 - cast.t);
  if (b.flash && !view.beats?.flash) view.flashOk = b.flash === "full" && flashes.allow(performance.now() / 1000);
  if (b.shake) shakeCamera(0.35, 9, (cast.aim.x - me.x) * 0.15 / (Math.hypot(cast.aim.x - me.x, cast.aim.z - me.z) || 1));
  holdFov(b.fov);
  ultSlowMotion(b.slow);
  canvas.style.filter = b.flash === "full" && view.flashOk ? "grayscale(1) brightness(1.02) contrast(10)" : b.flash === "reduced" ? "saturate(0.35) brightness(0.75)" : "";
  const toScreen = (x: number, z: number, lift: number) => { ultScratch.set(x, ground(x, z) + lift, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + ((ultScratch.x + 1) / 2) * r.width, y: r.top + ((1 - ultScratch.y) / 2) * r.height }; };
  const c = toScreen(me.x, me.z, 0.7), edge = toScreen(me.x + 3, me.z, 0.7);
  view.caster = { x: c.x, y: c.y, r: Math.max(60, Math.hypot(edge.x - c.x, edge.y - c.y)) };
  view.hit = toScreen(cast.aim.x, cast.aim.z, 0.4);
  view.beats = b;
  ultPrevT = cast.t;
}

const heard = new Set<CueKind>();
/** This frame's cues as sounds: one of each kind (a crit over a hit), windups only within earshot. */
function playCues(rt: CombatRuntime, me: Vec) {
  heard.clear();
  for (const c of rt.cues) if (c.kind !== "windup" || Math.hypot(c.x - me.x, c.z - me.z) < 10) heard.add(c.kind);
  if (heard.has("crit")) heard.delete("hit");
  for (const k of heard) for (const [name, rate, gain] of k === "swing" ? [SWING_SOUND[WEAPONS[rt.player.weapon].kind]] : CUE_SOUND[k]) AudioManager.playSFX(name, { rate, gain });
}

export default function RuinsScene({ level, phase, light, look, weather, liteMode, castShadows, zoom, player, onNear, onDefeat, start }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; castShadows: boolean; zoom: number;
  player: React.RefObject<THREE.Vector3>; onNear: (near: RuinsNear) => void; onDefeat: () => void;
  /** Dev: start somewhere other than the gate (screenshots). */
  start?: [number, number, number] | null;
  level?: number;
}) {
  const spawn = start ?? RUINS_SPAWN;
  const ruins = useMemo(() => createRuins(), []);
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const { camera, gl } = useThree();
  const input = useRef({ ndc: new THREE.Vector2(0, 0), hasPointer: false, presses: createInputs() });
  const near = useRef<RuinsNear>(null);
  const [respawn, setRespawn] = useState(0);
  const zones = useRef({ circle: false, gate: true });
  const named = useRef(new Set<string>());
  const syncAt = useRef(0);
  const publishAt = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useMemo(() => new THREE.Vector3(), []);
  const particles = useMoveParticles();
  useEffect(() => {
    player.current.set(...spawn); resetEncounter(); publishCombat();
    // Dev (screenshots): hold a telegraph with __combat.freeze, stage mission steps with __combatDev.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __combatDev: { player: player.current, missionEvent: (ev: Parameters<typeof missionEvent>[1]) => missionEvent(combat.rt, ev), spawnWave: (id: string, i: number) => spawnWave(combat.rt, WAVES[id][i]),
      /** One enemy of a type at (x, z), hunting you (evidence). */
      spawn: (type: string, x: number, z: number, id: string) => spawnWave(combat.rt, [{ id, type, x, z }]),
      /** The whole spawn table back at its spots, dens and clouds as packs (evidence). */
      reset: () => resetEncounter() } });
  }, [player, spawn]);
  // Dev (screenshots): where a ground point is on the page, to aim the mouse at an enemy.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __combatDev?: Record<string, unknown> };
    // Half a unit above the ground (screenOf lifts 0.7).
    w.__combatDev = { ...w.__combatDev, screenOf: (x: number, z: number) => screenOf([x, ruins.ground(x, z) - 0.2, z], camera, gl.domElement) };
  }, [camera, gl, ruins, spawn]);
  const focus = useRef(new THREE.Vector3(...spawn));
  // The arches, pillars, statues and broken arches stand in the way of the orbit camera; the canyon walls are terrain.
  const follow = useMemo(() => {
    const at = (p: Vec, hx: number, hz: number, h: number) => boxOccluder(p.x, p.z, hx, hz, ruins.ground(p.x, p.z), h);
    return { ground: ruins.ground, player, aim: true, occluders: [at({ x: 0, z: -24.4 }, 2.2, 0.6, 4.5), at({ x: 0, z: 1.2 }, 2.2, 0.6, 4.5), ...RUINS_PILLARS.map(p => at(p, 0.7, 0.7, 4)),
      ...RUINS_MOAI.map(p => at(p, 0.9, 0.9, 3.5)), ...RUINS_BROKEN_ARCHES.map(p => at(p, 1.6, 1.6, 3.5))] };
  }, [ruins, player]);
  useFollowCamera(focus, zoom, null, follow);

  // Mouse aim + click attack on the canvas; ability keys (remappable). A click or key waits BUFFER s for its cooldown (runInputs).
  // Movement, Space's jump and Q's dash-dodge are PlayerAvatar's (the kit).
  const keys = useAbilityKeys();
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); input.current.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); input.current.hasPointer = true; };
    const down = (e: PointerEvent) => { if (e.button === 0) { move(e); input.current.presses.held = true; input.current.presses.attack = BUFFER; } };
    const up = () => { input.current.presses.held = false; };
    // First (the capture phase): an ability key wins over a fixed key it shares here (V's camera reset, the Z X C V preset).
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase(), ability = (Object.keys(keys) as AbilityId[]).find(a => keys[a] === k);
      if (!ability) return;
      e.preventDefault();
      if (e.repeat) return;
      // Classes v2: keys 1–5 go through the input layer (holds and charges need the release too), F is the ult.
      const rt = combat.rt, slot = (V2_SLOT_IDS as readonly string[]).indexOf(ability);
      if (rt.v2 && slot >= 0) classKey(rt, slot, true);
      else if (rt.v2 && ability === "ult") pressUlt(rt);
      else if (ability !== "slot5" && ability !== "ult") input.current.presses.keys.push({ id: ability, left: BUFFER });
    };
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), slot = V2_SLOT_IDS.findIndex(a => keys[a] === k);
      if (combat.rt.v2 && slot >= 0) classKey(combat.rt, slot, false);
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerdown", down); window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd, true); window.addEventListener("keyup", ku, true);
    return () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd, true); window.removeEventListener("keyup", ku, true);
    };
  }, [gl, keys]);

  useFrame(({ clock }, rawDelta) => {
    // Hitstop holds the encounter (and the avatar, PlayerAvatar) for a beat after a melee hit, a crit or a hit taken.
    // The tool wheel slows the encounter while it's open (specs/game-ui.md §1).
    const dt = combat.freeze || combat.hitstop > 0 ? 0 : Math.min(rawDelta, 0.05) * worldSpeed();
    combat.hitstop = Math.max(0, combat.hitstop - rawDelta);
    const rt = combat.rt, p = rt.player, pl = player.current, inp = input.current;
    const me = { x: pl.x, z: pl.z };
    // Aim: in mouse-look the crosshair (the screen centre onto the ground drawn there), otherwise the pointer ray onto
    // the floor plane (until the mouse moves, ahead of you). Facing is PlayerAvatar's (combatFacing).
    if (capture.state === "captured") {
      if (crosshairAim(camera, ruins.ground, ruins.ground(pl.x, pl.z), hit)) { p.aim.x = hit.x; p.aim.z = hit.z; }
    } else if (inp.hasPointer) {
      ray.setFromCamera(inp.ndc, camera); plane.current.constant = -ruins.ground(pl.x, pl.z);
      if (ray.ray.intersectPlane(plane.current, hit)) { p.aim.x = hit.x; p.aim.z = hit.z; }
    } else { p.aim.x = pl.x + Math.sin(p.facing) * 3; p.aim.z = pl.z + Math.cos(p.facing) * 3; }
    p.safe = inRect(me, GATE_PLAZA);
    // Defeat: wake at the gate (row 229).
    if (!p.alive) {
      p.downFor += dt;
      // The scene resets in place: the encounter, and the avatar back at the gate (no remount, no reload).
      if (p.downFor > 1.8) { missionEvent(rt, { type: "defeat" }); onDefeat(); resetEncounter(); pl.set(...spawn); zones.current = { circle: false, gate: true }; setRespawn(n => n + 1); publishCombat(); }
    }
    // Inputs.
    if (runInputs(rt, inp.presses, me, Math.min(rawDelta, 0.05))) publishCombat(); // a refused key pulses its slot now
    // Classes v2: the input layer's intents, cooldowns, holds and toggles on the encounter clock; the ult's beats on the wall clock.
    stepClass(rt, me, dt, Math.min(rawDelta, 0.05));
    // Timers, energy, enemies, projectiles, summons and totems (lib/game/combat/encounter.ts); ability dashes and knockback push PlayerAvatar.
    stepCombat(rt, me, dt, ruins.free);
    playCues(rt, me);
    impact(rt, particles.pool, ruins.ground);
    rt.cues.length = 0;
    ultPresentation(rt, camera, gl.domElement, me, ruins.ground, Math.min(rawDelta, 0.05));
    // Respawn (spawn-table enemies only) once dead long enough and you're away from the spot.
    for (const [i, e] of rt.enemies.entries()) {
      const after = e.state === "dead" && !e.summoned ? respawnAfter(e.id) : 0;
      if (after && e.deadFor > after && Math.hypot(pl.x - e.spawnX, pl.z - e.spawnZ) > 12) rt.enemies[i] = spawnEnemy(e.id, e.type, e.spawnX, e.spawnZ, e.pack);
    }
    rt.bossEngaged = rt.enemies.some(e => e.type.kind === "boss" && ENGAGED.has(e.state));
    // A mini-boss joining the fight: its name card, once per fight (again after it has walked home).
    for (const e of rt.enemies) {
      if (!e.type.miniboss) continue;
      const fighting = ENGAGED.has(e.state);
      if (fighting && !named.current.has(e.id)) { named.current.add(e.id); if (!rt.banner) rt.banner = { kind: "foe", title: e.type.name, text: e.type.miniboss.title, until: clock.elapsedTime + 2.6 }; }
      else if (!fighting) named.current.delete(e.id);
    }
    if (rt.banner && clock.elapsedTime > rt.banner.until) rt.banner = null;
    // Places → mission events.
    const mission = rt.mission?.status === "active" ? rt.mission : null;
    const circle = mission ? SURVIVE_CIRCLES[mission.def.id] : undefined;
    const inCircle = !!circle && Math.hypot(me.x - circle.x, me.z - circle.z) < circle.r;
    if (p.safe && !zones.current.gate && rt.idol === "carried") missionEvent(rt, { type: "return" });
    zones.current = { gate: p.safe, circle: inCircle };
    if (rt.idol === "carried" && rt.mission?.status === "complete" && rt.mission.def.template === "fetch") rt.idol = "returned";
    // Survive waves: start on stepping into the mission's circle; next wave when the last is down.
    const waves = mission?.def.template === "survive" ? WAVES[mission.def.id] : undefined;
    if (mission && waves) {
      if (!rt.wave && inCircle) { rt.wave = { index: 0, active: true }; spawnWave(rt, waves[0]); }
      if (rt.wave?.active && waves[rt.wave.index].every(w => rt.enemies.find(e => e.id === w.id)?.state === "dead")) {
        missionEvent(rt, { type: "wave_cleared", wave: rt.wave.index + 1 });
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
      if (d < 0.3 && esc.waypoint < path.length - 1) { missionEvent(rt, { type: "checkpoint", n: esc.waypoint }); esc.waypoint++; }
      if (esc.hp <= 0) { missionEvent(rt, { type: "escort_down" }); rt.escort = null; }
      else { const end = path[path.length - 1]; if (esc.waypoint === path.length - 1 && Math.hypot(esc.x - end.x, esc.z - end.z) < 0.3) missionEvent(rt, { type: "arrived" }); }
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
        if (k.enemy === BOSS_DROPS.enemy || MINIBOSS_DROPS[k.enemy]) victory(k.enemy, k.key, clock.elapsedTime);
        else void postKill(k.enemy, k.key).then(r => {
          if (r.ok && r.data.trait_unlocked) traitLearned(r.data.trait_unlocked, clock.elapsedTime);
          if (r.ok && r.data.mastery) masteryUp(r.data.mastery, clock.elapsedTime);
        });
      }
      const pid = rt.mission?.progressId;
      if (pid && rt.mission?.queue.length) void postMissionEvents(pid, takeMissionQueue());
    }
  });

  return <>
    {/* The shadow box spans the 40 × 66 canyon (half-diagonal ~39). */}
    <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={false}
      ground={ruins.ground} cloudSize={[40, 66]} shadowExtent={36} fireflyAnchors={[]} />
    <GridWorld map={ruins.map} light={light} palette={terrain} windScale={liteMode ? 0 : 1} />
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
      <Projectiles ground={ruins.ground} />
      <Totems ground={ruins.ground} />
    </Suspense>
    <Telegraphs ground={ruins.ground} />
    <MobFx ground={ruins.ground} />
    <Blasts ground={ruins.ground} />
    <CombatFx ground={ruins.ground} lite={liteMode} />
    <PlayerAuras player={player} ground={ruins.ground} />
    <AimReticle player={player} ground={ruins.ground} />
    <FloaterProjector />
    <EnemyBars ground={ruins.ground} />
    <Html position={[EXIT_SPOT.x, 2.2, EXIT_SPOT.z]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>Gate · safe zone</div></Html>
    <PlayerAvatar spawnPosition={spawn} playerName="You" playerLevel={level} player={player}
      world={ruins.world} groundHeight={ruins.ground} groundSurface={ruins.surface} camTarget={focus} combat respawn={respawn} />
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

/** The escorted resident on the character rig, in a resident's look (seeded by who it is, as the village's are): it faces where it walks, and you while it waits. */
function Escort({ ground, player }: { ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null), last = useRef<{ x: number; z: number } | null>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const who = combat.rt.mission?.def.params.escortee ?? "botanist";
  const look = useMemo(() => randomLook(seeded(hashSeed(who))), [who]);
  useFrame((_, delta) => {
    const g = ref.current, esc = combat.rt.escort, m = motion.current; if (!g) return;
    g.visible = !!esc;
    if (!esc) { last.current = null; return; }
    const from = last.current ?? esc, step = Math.hypot(esc.x - from.x, esc.z - from.z), dt = Math.max(delta, 1e-3);
    m.speed = THREE.MathUtils.damp(m.speed, step / dt, 12, dt); // eased: a hitstop's still frames don't flick it to idle
    const heading = step > 1e-4 ? Math.atan2(esc.x - from.x, esc.z - from.z) : Math.atan2(player.current.x - esc.x, player.current.z - esc.z);
    m.yaw += Math.atan2(Math.sin(heading - m.yaw), Math.cos(heading - m.yaw)) * Math.min(1, dt * (step > 1e-4 ? 10 : 4));
    last.current = { x: esc.x, z: esc.z };
    g.position.set(esc.x, ground(esc.x, esc.z), esc.z);
  });
  return <group ref={ref}><Character look={look} motion={motion} walkSpeed={2.6} /></group>;
}
