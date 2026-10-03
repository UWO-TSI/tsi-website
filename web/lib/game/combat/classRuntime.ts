/**
 * Classes v2 in the encounter (design sheet §1.2, §1.6, the LOCKED kits; behind the classes_v2 flag): the kit at the
 * member's mastery with its stat direction, keys 1–5 through the input layer (taps, combos, holds, charges, toggles,
 * recasts, drawn shapes), the signature-weapon gate, movement riders and the movement passive, the ult meter and the
 * ult itself (F: i-frames from the press to 200 ms past the freeze, its hits at the anticipation's end), and the
 * in-combat flag. The ability effects, hits and statuses are the one ability system's (abilities.ts); this file only
 * decides when they run. Pure over the runtime: the ruins scene and the balance bot drive it the same way.
 */
import { classMods, holdsSignature, kitAt, signatureHint, withMods, type ClassAbility, type ClassKit, type ClassMods, type ClassUlt, type MovementPassive } from "@/lib/combat/classes";
import type { Effect, Passive } from "@/lib/combat/kits";
import { derived } from "@/lib/combat/progression";
import { ultBlock, ULT } from "@/lib/combat/ult";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { CAST, context, floater, fx, runEffects, spend } from "./abilities";
import { BUFFER, faceAim } from "./actions";
import { chargePotency, createInputState, press, release, tick, type InputKit, type InputState, type Intent } from "./input";
import { addKick, MOVE_NEEDS, moveOk, speedBonus } from "./moveHooks";
import { breakStealth, createLive, justReloaded, reloadKey, stepFire, takeRounds, type FireState } from "./classFire";
import { energyMax, V2_SLOT_IDS, type CombatRuntime } from "./runtime";
import type { Vec } from "./sim";

/** The ult's beats in seconds after its anticipation (§1.6): the freeze, then 200 ms more of i-frames; the sequence's presentation lasts this long (after a sustained ult's finisher). */
export const ULT_BEATS = { freeze: 0.12, iframesAfter: ULT.iframesAfterFreeze, end: 3 } as const;
/** Seconds after the last threat that you still count as in combat (§1.3). */
export const IN_COMBAT = 5;

type Queued = { intent: Intent | { kind: "ult" }; left: number };
export interface ClassState {
  kit: ClassKit; mastery: number; mods: ClassMods;
  /** At this mastery, ranks and the stat direction applied; null where a key is still locked. */
  keys: (ClassAbility | null)[]; combos: { keys: [number, number]; ability: ClassAbility }[]; ult: ClassUlt; passive: Passive;
  capacity: number;
  input: InputState; inputKit: InputKit;
  /** Seconds left per ability key (keys, combos). */
  cd: Record<string, number>;
  /** Intents waiting up to BUFFER for a cooldown. */
  queue: Queued[];
  /** Seconds a hold or charge key has been down (null: it isn't). */
  holding: (number | null)[];
  toggled: boolean[];
  /** Seconds a recast key's second press stays open. */
  recast: number[];
  meter: number;
  /**
   * The ult under way: seconds since the press (real time), where it aims, its seed, whether its hits landed (and a
   * first-last ult's finisher). `shift`: the sequence replays from the anticipation's end shifted this far (a finisher,
   * or a hit that asks for it, `big` playing it larger).
   */
  cast: { t: number; aim: Vec; seed: number; fired: boolean; last?: boolean; shift?: number; big?: boolean } | null;
  /** The kit's live counters: Focus, the cylinder, special rounds, the Killstreak, damage over time, zones (classFire.ts). */
  live: FireState;
  moveCd: number;
  combatT: number;
  /** The input layer's clock (real seconds). */
  clock: number;
  /** Mastery XP into this level and what the next needs (the HUD's thin bar; 0 needed at 20). */
  progress: { into: number; needed: number };
}

const weaponType = (rt: CombatRuntime) => SYSTEM_WEAPONS.find(w => w.key === rt.player.weapon)?.type;
const slotId = (slot: number) => V2_SLOT_IDS[slot];

/** Put a v2 kit on at a mastery level (progression load, a level-up): today's slots go, the meter starts empty. */
export function equipClassKit(rt: CombatRuntime, kit: ClassKit, mastery: number, progress?: { into: number; needed: number }) {
  const mods = classMods(kit, mastery), at = kitAt(kit, mastery), p = rt.player, d = derived(p.stats, p.level, kit.mods);
  const keys = at.keys.map(a => a && withMods(a, mods)), combos = at.combos.map(c => ({ keys: c.keys, ability: withMods(c.ability, mods) }));
  rt.kit = null; rt.slots = [null, null, null, null];
  const same = rt.v2?.kit === kit ? rt.v2 : null; // a level-up mid-run: the meter, cooldowns and what's held carry over
  rt.v2 = { kit, mastery, mods, keys, combos, ult: withMods(at.ult, mods), passive: at.passive, capacity: d.summon_capacity + mods.capacity,
    input: same?.input ?? createInputState(), inputKit: { inputs: keys.map(a => (a ? a.input ?? { kind: "tap" } : null)), combos: combos.map(c => c.keys) },
    cd: same?.cd ?? {}, queue: same?.queue ?? [], holding: same?.holding ?? keys.map(() => null), toggled: same?.toggled ?? keys.map(() => false), recast: same?.recast ?? keys.map(() => 0),
    meter: same?.meter ?? 0, cast: same?.cast ?? null, moveCd: same?.moveCd ?? 0, combatT: same?.combatT ?? 0, clock: same?.clock ?? 0,
    live: same?.live ?? createLive(kit.fire?.ammo?.size),
    progress: progress ?? same?.progress ?? { into: 0, needed: 0 } };
  p.maxHp = Math.round(d.max_hp * mods.maxHp); p.hp = Math.min(p.hp, p.maxHp);
  p.energy = Math.min(p.energy, energyMax(rt));
}

/** Can `a` start now? (Cooldown aside: the queue waits on that.) Says why not with a floater. */
function usable(rt: CombatRuntime, a: ClassAbility, me: Vec, energy = a.energy): boolean {
  const p = rt.player, v = rt.v2!;
  if (!p.alive || p.dash || rt.casting || (v.cast && v.cast.t < v.ult.anticipation_ms / 1000 + ULT_BEATS.freeze)) return false;
  if (!holdsSignature(v.kit, weaponType(rt))) { floater(rt, me, 1.9, signatureHint(v.kit), "info"); return false; }
  if (a.when && !moveOk(a.when, p.move)) { floater(rt, me, 1.9, MOVE_NEEDS[a.when], "info"); return false; }
  if (a.needs === "reloaded" && !justReloaded(rt)) { floater(rt, me, 1.9, "Right after a reload", "info"); return false; }
  if (p.energy < energy) { floater(rt, me, 1.9, "Not enough energy", "info"); return false; }
  return true;
}

/** Run an ability's effects now (energy and cooldown paid unless told), with its tier, FX and clip. */
function fire(rt: CombatRuntime, a: ClassAbility, me: Vec, potency = 1, opts: { cooldown?: boolean; effects?: ClassAbility["effects"]; energy?: boolean } = {}, random = Math.random) {
  const p = rt.player, v = rt.v2!;
  // Rounds from the cylinder (the Gunslinger): none left, or reloading, and it doesn't fire.
  let effects = opts.effects ?? a.effects;
  if (a.ammo && !opts.effects) {
    const got = takeRounds(rt, a.ammo);
    if (!got) { floater(rt, me, 1.9, "Reload first", "info"); return; }
    effects = roundsFired(effects, got.n, got.last);
  }
  if (opts.energy !== false) spend(rt, a.energy);
  if (opts.cooldown !== false) v.cd[a.key] = a.cooldown_s;
  p.attackCd = Math.max(p.attackCd, 0.25); p.swing = 0.22;
  faceAim(p, me);
  if (!a.effects.some(e => e.kind === "buff" && e.stat === "stealth")) breakStealth(rt); // acting gives you away
  if (a.clip) p.clip = "verb" in a.clip ? { verb: a.clip.verb, scale: a.clip.scale ?? 1, upper: true } : { verb: a.clip.unique, scale: 1, upper: false };
  const ctx = context(rt, a, me, potency * (1 + (a.scale ? speedBonus(p.move.speed, a.scale.max) : 0)), p.aim);
  ctx.impact = a.heavy ? "heavy" : "ability"; ctx.fx = a.vfx;
  fx(rt, a.vfx?.cast, "cast", me, ctx.aim, ctx.impact);
  if (a.when === "airborne") p.kick = addKick(p.kick, 0, 0, 0, 0, true); // a short hang at an air cast
  runEffects(rt, effects, ctx, random);
}
/** An ammo ability's shots: one per round taken; with Last Round, the last chamber's shot crits. */
function roundsFired(effects: ClassAbility["effects"], n: number, last: boolean): ClassAbility["effects"] {
  return effects.flatMap((e): Effect[] => {
    if (e.kind !== "projectile") return [e];
    const count = (e.count ?? 1) === 1 ? 1 : n;
    return last && count > 1 ? [{ ...e, count: count - 1 }, { ...e, count: 1, spread: 0, crit: true }] : [{ ...e, count, crit: e.crit || (last && count === 1) || undefined }];
  });
}

/** One intent: "done" (fired, or refused for good), "wait" (on cooldown, still inside its buffer). */
function run(rt: CombatRuntime, q: Queued, me: Vec, random: () => number): "done" | "wait" {
  const v = rt.v2!, p = rt.player, it = q.intent;
  const deny = (slot: number | null) => { if (slot !== null) rt.denied[slotId(slot)]++; else rt.denied.ult++; return "done" as const; };
  const cooling = (a: ClassAbility, slot: number | null) => { const cd = v.cd[a.key] ?? 0; return cd <= 0 ? null : cd > q.left ? deny(slot) : "wait" as const; };
  switch (it.kind) {
    case "ult": {
      const why = ultBlock({ meter: v.meter, alive: p.alive, safe: p.safe, drawing: !!rt.casting, signature: holdsSignature(v.kit, weaponType(rt)), active: !!v.cast });
      if (why === "charging") return "wait";
      if (why) { if (why === "weapon") floater(rt, me, 1.9, signatureHint(v.kit), "info"); return deny(null); }
      startUlt(rt, me);
      return "done";
    }
    case "combo": {
      const combo = v.combos[it.combo];
      if (!combo) return "done";
      const a = combo.ability, c = cooling(a, combo.keys[0]); if (c) return c;
      if (usable(rt, a, me)) fire(rt, a, me, 1, {}, random);
      return "done";
    }
    case "tap": {
      const a = v.keys[it.slot];
      if (!a) return "done";
      if (a.input?.kind === "recast" && v.recast[it.slot] > 0) { // the second press: its release, free
        v.recast[it.slot] = 0;
        if (a.release) fire(rt, a, me, 1, { cooldown: false, energy: false, effects: a.release }, random);
        return "done";
      }
      const c = cooling(a, it.slot); if (c) return c;
      if (!usable(rt, a, me)) return "done";
      fire(rt, a, me, 1, {}, random);
      if (a.input?.kind === "recast") v.recast[it.slot] = a.input.window_s;
      return "done";
    }
    case "holdStart": case "chargeStart": {
      const a = v.keys[it.slot];
      if (!a) return "done";
      const c = cooling(a, it.slot); if (c) return c;
      if (!usable(rt, a, me)) return "done";
      v.holding[it.slot] = 0;
      if (it.kind === "holdStart") fire(rt, a, me, 1, { cooldown: false }, random); // its buffers last while held; the cooldown starts on release
      else fx(rt, a.vfx?.cast, "cast", me, p.aim, a.heavy ? "heavy" : "ability"); // the charge glow; it fires on release
      return "done";
    }
    case "holdEnd": {
      const a = v.keys[it.slot];
      if (!a || v.holding[it.slot] === null) return "done";
      v.holding[it.slot] = null;
      rt.buffs = rt.buffs.filter(b => b.source !== a.key);
      v.cd[a.key] = a.cooldown_s;
      if (a.release) fire(rt, a, me, 1, { cooldown: false, energy: false, effects: a.release }, random);
      return "done";
    }
    case "charge": {
      const a = v.keys[it.slot];
      if (!a || v.holding[it.slot] === null) return "done";
      v.holding[it.slot] = null;
      if (usable(rt, a, me)) fire(rt, a, me, chargePotency(it.level), {}, random);
      return "done";
    }
    case "toggle": {
      const a = v.keys[it.slot];
      if (!a) return "done";
      if (v.toggled[it.slot]) { // off: its release, and what it called goes
        v.toggled[it.slot] = false;
        rt.units = rt.units.filter(u => u.source !== a.key);
        if (a.release) fire(rt, a, me, 1, { cooldown: false, energy: false, effects: a.release }, random);
        return "done";
      }
      const c = cooling(a, it.slot); if (c) return c;
      if (!usable(rt, a, me)) return "done";
      fire(rt, a, me, 1, {}, random);
      v.toggled[it.slot] = true;
      return "done";
    }
    case "draw": {
      const a = v.keys[it.slot];
      if (!a || a.input?.kind !== "drawn") return "done";
      const c = cooling(a, it.slot); if (c) return c;
      if (!usable(rt, a, me, Math.ceil(a.energy * CAST.start))) return "done";
      spend(rt, Math.ceil(a.energy * CAST.start)); // a quarter now, the rest on a good release (resolveCast)
      rt.casting = { id: rt.seq++, rune: a.input.shape, aim: { ...p.aim }, slot: it.slot, ability: a, free: true };
      fx(rt, a.vfx?.cast, "cast", me, p.aim, "ability");
      return "done";
    }
  }
}

/** A key went down or up (slot 0–4). Presses become intents now; they run in stepClass, waiting up to BUFFER for a cooldown. */
export function classKey(rt: CombatRuntime, slot: number, down: boolean) {
  const v = rt.v2;
  if (!v) return;
  for (const intent of (down ? press : release)(v.input, v.inputKit, slot, v.clock)) v.queue.push({ intent, left: BUFFER });
}
/** R for a kit with a cylinder: reload, or the active reload (classFire.ts); false when R swaps weapons as before. */
export const classReload = (rt: CombatRuntime, me: Vec) => reloadKey(rt, me);
/** F (buffered like the slots). */
export const pressUlt = (rt: CombatRuntime) => { rt.v2?.queue.push({ intent: { kind: "ult" }, left: ULT.buffer }); };

/** The ult's press: the meter drains, the caster is untouchable through the freeze, the wind-up plays; its hits land at the anticipation's end. */
function startUlt(rt: CombatRuntime, me: Vec) {
  const v = rt.v2!, p = rt.player, A = v.ult.anticipation_ms / 1000;
  v.meter = 0;
  v.cast = { t: 0, aim: { ...p.aim }, seed: (rt.seq++ * 2246822519) >>> 0, fired: false };
  p.ultIframes = A + ULT_BEATS.freeze + ULT_BEATS.iframesAfter;
  faceAim(p, me);
  if (v.ult.clip) p.clip = "verb" in v.ult.clip ? { verb: v.ult.clip.verb, scale: v.ult.clip.scale ?? 1, upper: false } : { verb: v.ult.clip.unique, scale: 1, upper: false };
  fx(rt, v.ult.vfx?.cast, "cast", me, p.aim, "ult");
}

/** The movement passive (ruins only): an air jump, a slide, a dash or a landing the avatar reports. */
export function classMove(rt: CombatRuntime, me: Vec, on: MovementPassive["on"], random = Math.random): boolean {
  const v = rt.v2, p = rt.player, m = v?.kit.movement;
  if (!v || !m || m.on !== on || !p.alive || v.moveCd > 0 || p.energy < m.energy) return false;
  spend(rt, m.energy);
  v.moveCd = m.cooldown_s ?? 0;
  const speed = Math.hypot(p.move.vx, p.move.vz), ahead = speed > 0.3 ? { x: me.x + (p.move.vx / speed) * 3, z: me.z + (p.move.vz / speed) * 3 } : p.aim;
  const ctx = context(rt, { key: `${v.kit.key}.movement`, name: m.name, description: m.description, cooldown_s: 0, energy: m.energy, effects: m.effects }, me, 1, ahead);
  runEffects(rt, m.effects, ctx, random);
  return true;
}

export const inCombat = (rt: CombatRuntime) => (rt.v2?.combatT ?? 0) > 0;
/** Dev (evidence): hold the ult's clock where a script puts it, to film its beats one at a time. */
export const classDev = { holdUlt: false };
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") Object.assign(window, { __classDev: classDev });
const THREAT = new Set(["chase", "windup", "active", "recover"]);

/**
 * One frame of the class layer, before the encounter tick: `dt` is the encounter's (the freeze and slow motion hold
 * it), `real` the wall clock's (key timing, the ult's beats and i-frames).
 */
export function stepClass(rt: CombatRuntime, me: Vec, dt: number, real: number, random = Math.random) {
  const v = rt.v2, p = rt.player;
  if (!v) return;
  v.clock += real;
  for (const intent of tick(v.input, v.inputKit, v.clock)) v.queue.push({ intent, left: BUFFER });
  for (let i = 0; i < v.queue.length; i++) {
    const q = v.queue[i];
    if (run(rt, q, me, random) === "done") v.queue.splice(i--, 1);
    else if ((q.left -= real) <= 0) { v.queue.splice(i--, 1); if (q.intent.kind === "ult") rt.denied.ult++; } // F before the meter filled
  }
  for (const k in v.cd) v.cd[k] = Math.max(0, v.cd[k] - dt);
  for (let i = 0; i < v.holding.length; i++) {
    if (v.holding[i] !== null) v.holding[i]! += dt;
    v.recast[i] = Math.max(0, v.recast[i] - dt);
    const a = v.keys[i];
    if (v.toggled[i] && a && !rt.units.some(u => u.source === a.key)) v.toggled[i] = false; // what it called is gone
  }
  v.moveCd = Math.max(0, v.moveCd - dt);
  stepFire(rt, me, dt, random); // Focus, the cylinder, the Killstreak, stealth, a surge's shots, burns and zones
  p.ultIframes = Math.max(0, p.ultIframes - real);
  // The ult: its hits at the anticipation's end (A), its presentation (impact.ts) until the end.
  if (v.cast) {
    if (!classDev.holdUlt) v.cast.t += real;
    const A = v.ult.anticipation_ms / 1000;
    if (!v.cast.fired && v.cast.t >= A && p.alive) {
      v.cast.fired = true;
      const ctx = context(rt, v.ult, me, 1, v.cast.aim);
      ctx.impact = "ult"; ctx.ult = true; ctx.fx = v.ult.vfx;
      runEffects(rt, v.ult.effects, ctx, random);
    }
    const span = v.ult.impacts === "first-last" ? v.ult.duration ?? 0 : 0;
    if (span > 0 && !v.cast.last && v.cast.t >= A + span && p.alive) { // the finisher: its hits, and the sequence plays again (ultView)
      v.cast.last = true; v.cast.shift = span;
      p.ultIframes = ULT_BEATS.freeze + ULT_BEATS.iframesAfter; // nothing lands unseen in this freeze either
      const ctx = context(rt, v.ult, me, 1, p.aim);
      ctx.impact = "ult"; ctx.ult = true; ctx.fx = v.ult.vfx;
      runEffects(rt, v.ult.release ?? v.ult.effects, ctx, random);
    }
    if (v.cast.t >= A + (v.ult.duration ?? 0) + ULT_BEATS.end) v.cast = null;
  }
  // In combat (§1.3): something hunting or hitting you, a wave running or the boss engaged, and for 5 s after.
  const threat = rt.wave?.active || rt.bossEngaged || rt.enemies.some(e => THREAT.has(e.state) && e.status.distract <= 0 && Math.hypot(e.x - me.x, e.z - me.z) < e.type.aggroRadius + 4);
  v.combatT = threat ? IN_COMBAT : Math.max(0, v.combatT - dt);
}
