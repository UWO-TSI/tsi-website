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
import { createLive, justReloaded, reloadKey, stepFire, takeRounds, type FireState } from "./classFire";
import { attune, formTier, mimic, refusal, reveal } from "./primitives";
import { energyMax, V2_SLOT_IDS, type CombatRuntime } from "./runtime";
import type { Vec } from "./sim";

/** The ult's beats in seconds after its anticipation (§1.6): the freeze, then 200 ms more of i-frames; the sequence's presentation lasts this long (after a sustained ult's finisher). */
export const ULT_BEATS = { freeze: 0.12, iframesAfter: ULT.iframesAfterFreeze, end: 3 } as const;
/** How far an ult reaches (its widest area, or its `reach` when it isn't an area): the bot's trigger, the channel's warning glow. */
const reach = (e: Effect): number => (e.kind === "area" || e.kind === "zone" ? e.radius : e.kind === "sweep" ? e.width / 2 : e.kind === "delay" ? Math.max(0, ...e.effects.map(reach)) : e.kind === "projectile" ? 1.5 : 0);
export const ULT_REACH = (a: ClassAbility & { reach?: number }) => a.reach ?? Math.max(2, ...a.effects.map(reach));
/** Seconds after the last threat that you still count as in combat (§1.3). */
export const IN_COMBAT = 5;

type Queued = { intent: Intent | { kind: "ult" }; left: number };
export interface ClassState {
  kit: ClassKit; mastery: number; mods: ClassMods;
  /** At this mastery, ranks and the stat direction applied; null where a key is still locked. */
  keys: (ClassAbility | null)[]; combos: { keys: [number, number]; ability: ClassAbility; hold?: ClassAbility }[]; ult: ClassUlt; passive: Passive;
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
   * first-last ult's finisher), its potency (a channel's mash). `shift`: the sequence replays from the anticipation's
   * end shifted this far (a finisher, or a hit that asks for it, `big` playing it larger).
   */
  cast: { t: number; aim: Vec; seed: number; fired: boolean; last?: boolean; potency?: number; shift?: number; big?: boolean } | null;
  /** The kit's live counters: Focus, the cylinder, special rounds, the Killstreak, damage over time (classFire.ts). */
  live: FireState;
  /** A channelled ult's charge (Cataclysm): seconds in, where it will land, the mash's notes (key indices), the next note, hits and misses. */
  channel: { t: number; aim: Vec; notes: number[]; at: number; hits: number; misses: number; pulse: number } | null;
  /** The form taken (the Transmuter's FORMS key; null: your own body) and the one before the Chimera. */
  form: string | null; formBefore: string | null;
  /** The last element(s) cast ("fire", "fire+water"): the staff's crystal and the attunement passive read it. */
  element: string | null;
  /** Traits learned (member_progression.traits): forms unlock with their mob's first defeat. */
  traits: Record<string, number>;
  /** The equipped cosmetics of this subclass's row, and the weapon skin they put on (the mastery trim, a bought skin's key), from the progression view. */
  cosmetics?: Partial<Record<"weapon_skin" | "aura" | "frame", string>>; skin?: string | null;
  moveCd: number;
  combatT: number;
  /** The input layer's clock (real seconds). */
  clock: number;
  /** Mastery XP into this level and what the next needs (the HUD's thin bar; 0 needed at 20). */
  progress: { into: number; needed: number };
}

const weaponType = (rt: CombatRuntime) => SYSTEM_WEAPONS.find(w => w.key === rt.player.weapon)?.type;
const slotId = (slot: number) => V2_SLOT_IDS[slot];

/** Put a v2 kit on at a mastery level (progression load, a level-up, a form learned): today's slots go, the meter starts empty. */
export function equipClassKit(rt: CombatRuntime, kit: ClassKit, mastery: number, progress?: { into: number; needed: number }, traits?: Record<string, number>) {
  const same = rt.v2?.kit === kit ? rt.v2 : null; // a level-up mid-run: the meter, cooldowns, form and what's held carry over
  const learnt = traits ?? same?.traits ?? {};
  const mods = classMods(kit, mastery), at = kitAt(kit, mastery, learnt), p = rt.player, d = derived(p.stats, p.level, kit.mods);
  const keys = at.keys.map(a => a && withMods(a, mods)), combos = at.combos.map(c => ({ keys: c.keys, ability: withMods(c.ability, mods), ...(c.hold ? { hold: withMods(c.hold, mods) } : {}) }));
  rt.kit = null; rt.slots = [null, null, null, null];
  rt.v2 = { kit, mastery, mods, keys, combos, ult: withMods(at.ult, mods), passive: at.passive, capacity: d.summon_capacity + mods.capacity,
    input: same?.input ?? createInputState(), inputKit: { inputs: keys.map(a => (a ? a.input ?? { kind: "tap" } : null)), combos: combos.map(c => c.keys), holds: combos.map(c => !!c.hold) },
    cd: same?.cd ?? {}, queue: same?.queue ?? [], holding: same?.holding ?? keys.map(() => null), toggled: same?.toggled ?? keys.map(() => false), recast: same?.recast ?? keys.map(() => 0),
    meter: same?.meter ?? 0, cast: same?.cast ?? null, moveCd: same?.moveCd ?? 0, combatT: same?.combatT ?? 0, clock: same?.clock ?? 0,
    live: same?.live ?? createLive(kit.fire?.ammo?.size),
    progress: progress ?? same?.progress ?? { into: 0, needed: 0 },
    channel: same?.channel ?? null, form: same?.form ?? null, formBefore: same?.formBefore ?? null, element: same?.element ?? null, traits: learnt, cosmetics: same?.cosmetics, skin: same?.skin };
  p.maxHp = Math.round(d.max_hp * mods.maxHp); p.hp = Math.min(p.hp, p.maxHp);
  p.energy = Math.min(p.energy, energyMax(rt));
}

/** The cooldown an ability runs on: its own, or its group's (the Transmuter's forms share one). */
export const cdKey = (a: ClassAbility) => a.group ?? a.key;
/** The Chimera (a form "chimera"): the forms' moves without their cooldown or energy (a beat between them), and the body stays the Chimera. */
const unbound = (v: ClassState, a: ClassAbility) => v.form === "chimera" && !!a.group;
/** The beat between two moves in the Chimera (no form cooldown, but not every frame). */
export const UNBOUND_BEAT = 0.5;

/** Can `a` start now? (Cooldown aside: the queue waits on that.) Says why not with a floater. */
function usable(rt: CombatRuntime, a: ClassAbility, me: Vec, energy = a.energy): boolean {
  const p = rt.player, v = rt.v2!;
  if (!p.alive || p.dash || rt.casting || v.channel || (v.cast && v.cast.t < v.ult.anticipation_ms / 1000 + ULT_BEATS.freeze)) return false;
  if (!holdsSignature(v.kit, weaponType(rt))) { floater(rt, me, 1.9, signatureHint(v.kit), "info"); return false; }
  if (a.when && !moveOk(a.when, p.move)) { floater(rt, me, 1.9, MOVE_NEEDS[a.when], "info"); return false; }
  if (a.needs === "reloaded" && !justReloaded(rt)) { floater(rt, me, 1.9, "Right after a reload", "info"); return false; }
  if (p.energy < energy && !unbound(v, a)) { floater(rt, me, 1.9, "Not enough energy", "info"); return false; }
  const why = refusal(rt, a.effects, p.aim, a.key);
  if (why) { floater(rt, me, 1.9, why, "info"); return false; }
  return true;
}

/** Run an ability's effects now (energy and cooldown paid unless told), with its tier, FX, colours and clip; your clones copy the cast. */
function fire(rt: CombatRuntime, a: ClassAbility, me: Vec, potency = 1, opts: { cooldown?: boolean; effects?: ClassAbility["effects"]; energy?: boolean } = {}, random = Math.random) {
  const p = rt.player, v = rt.v2!, free = unbound(v, a);
  // Rounds from the cylinder (the Gunslinger): none left, or reloading, and it doesn't fire.
  let effects = opts.effects ?? a.effects;
  if (a.ammo && !opts.effects) {
    const got = takeRounds(rt, a.ammo);
    if (!got) { floater(rt, me, 1.9, "Reload first", "info"); return; }
    effects = roundsFired(effects, got.n, got.last);
  }
  if (opts.energy !== false && !free) spend(rt, a.energy);
  if (opts.cooldown !== false) v.cd[cdKey(a)] = free ? UNBOUND_BEAT : a.cooldown_s;
  p.attackCd = Math.max(p.attackCd, 0.25); p.swing = 0.22;
  faceAim(p, me);
  if (!a.effects.some(e => e.kind === "stealth")) reveal(rt); // casting gives you away (Vanish and Camouflage themselves aside)
  const clip = a.clip ? ("verb" in a.clip ? a.clip.verb : a.clip.unique) : null;
  if (a.clip && clip) { p.clip = { verb: clip, scale: "verb" in a.clip ? a.clip.scale ?? 1 : 1, upper: true }; mimic(rt, clip); }
  const ctx = context(rt, a, me, potency * (1 + (a.scale ? speedBonus(p.move.speed, a.scale.max) : 0)), p.aim);
  ctx.impact = a.heavy ? "heavy" : "ability"; ctx.fx = a.vfx; ctx.ramp = a.ramp;
  const shift = a.effects.find(e => e.kind === "form");
  if (shift?.kind === "form") ctx.tier = formTier(rt, free ? "chimera" : shift.form); // a form's move hits at its trait's tier
  fx(rt, a.vfx?.cast, "cast", me, ctx.aim, ctx.impact, undefined, a.ramp);
  if (a.when === "airborne") p.kick = addKick(p.kick, 0, 0, 0, 0, true); // a short hang at an air cast
  if (a.elements) attune(rt, a.elements);
  runEffects(rt, effects.filter(e => !(free && e.kind === "form")), ctx, random);
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
  const cooling = (a: ClassAbility, slot: number | null) => { const cd = Math.min(v.cd[cdKey(a)] ?? 0, unbound(v, a) ? UNBOUND_BEAT : Infinity); return cd <= 0 ? null : cd > q.left ? deny(slot) : "wait" as const; };
  switch (it.kind) {
    case "ult": {
      const why = ultBlock({ meter: v.meter, alive: p.alive, safe: p.safe, drawing: !!rt.casting, signature: holdsSignature(v.kit, weaponType(rt)), active: !!v.cast });
      if (why === "charging") return "wait";
      if (why) { if (why === "weapon") floater(rt, me, 1.9, signatureHint(v.kit), "info"); return deny(null); }
      if (v.channel) return deny(null);
      if (v.ult.channel) startChannel(rt, me, random); else startUlt(rt, me);
      return "done";
    }
    case "combo": case "comboHold": {
      const combo = v.combos[it.combo];
      if (!combo) return "done";
      const a = it.kind === "comboHold" ? combo.hold ?? combo.ability : combo.ability, c = cooling(a, combo.keys[0]); if (c) return c;
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
      v.cd[cdKey(a)] = a.cooldown_s;
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

/** A key went down or up (slot 0–4). Presses become intents now; they run in stepClass, waiting up to BUFFER for a cooldown. A channel's mash takes keys 1–4. */
export function classKey(rt: CombatRuntime, slot: number, down: boolean) {
  const v = rt.v2;
  if (!v) return;
  if (v.channel) { if (down && slot < 4) mash(rt, slot); return; }
  for (const intent of (down ? press : release)(v.input, v.inputKit, slot, v.clock)) v.queue.push({ intent, left: BUFFER });
}
/** R for a kit with a cylinder: reload, or the active reload (classFire.ts); false when R swaps weapons as before. */
export const classReload = (rt: CombatRuntime, me: Vec) => reloadKey(rt, me);

// ── A channelled ult (Cataclysm): rooted, guarded, a mash of keys 1–4 three at a time; its hits set the potency ──
/** The next notes the mash shows (the front one first). */
export const mashNotes = (v: ClassState, n = 3) => (v.channel ? v.channel.notes.slice(v.channel.at, v.channel.at + n) : []);
/** A channel's potency from its mash: 0.5 with no hits to 1.5 with every note. */
export const mashPotency = (hits: number, notes: number) => 0.5 + Math.min(1, hits / Math.max(1, notes));
function startChannel(rt: CombatRuntime, me: Vec, random: () => number) {
  const v = rt.v2!, p = rt.player, ch = v.ult.channel!;
  v.meter = 0;
  let seed = (rt.seq++ * 2246822519) >>> 0, last = -1;
  const notes = Array.from({ length: ch.notes }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; let k = seed % 4; if (k === last) k = (k + 1 + (seed >> 8) % 3) % 4; last = k; return k; });
  v.channel = { t: 0, aim: { ...p.aim }, notes, at: 0, hits: 0, misses: 0, pulse: 0 };
  rt.buffs.push({ stat: "guard", value: ch.guard, t: ch.seconds + 0.5, source: "channel" });
  faceAim(p, me);
  p.clip = { verb: "Channel", scale: 1, upper: false };
  fx(rt, v.ult.vfx?.cast, "cast", me, v.channel.aim, "heavy");
  void random;
}
function mash(rt: CombatRuntime, slot: number) {
  const c = rt.v2!.channel!, note = c.notes[c.at];
  if (note === undefined) return;
  c.at++;
  if (slot === note) c.hits++; else c.misses++;
  const v = rt.v2!, me = rt.player.last ?? c.aim, kit = v.kit, element = kit.keys[note];
  // A hit pulses that element into the sky over the aim; a miss cracks it.
  fx(rt, slot === note ? "mash.hit" : "mash.miss", "impact", c.aim, me, "ability", 1, element?.ramp);
}
function endChannel(rt: CombatRuntime, me: Vec) {
  const v = rt.v2!, c = v.channel!;
  v.channel = null;
  rt.buffs = rt.buffs.filter(b => b.source !== "channel");
  floater(rt, me, 2.2, `Cataclysm · ${c.hits}/${c.notes.length}`, "info");
  startUlt(rt, me, mashPotency(c.hits, c.notes.length), c.aim);
}
/** F (buffered like the slots). */
export const pressUlt = (rt: CombatRuntime) => { rt.v2?.queue.push({ intent: { kind: "ult" }, left: ULT.buffer }); };

/** The ult's press (or a channel's release): the meter drains, the caster is untouchable through the freeze, the wind-up plays; its hits land at the anticipation's end. */
function startUlt(rt: CombatRuntime, me: Vec, potency = 1, aim = rt.player.aim) {
  const v = rt.v2!, p = rt.player, A = v.ult.anticipation_ms / 1000;
  v.meter = 0;
  v.cast = { t: 0, aim: { ...aim }, seed: (rt.seq++ * 2246822519) >>> 0, fired: false, potency };
  p.ultIframes = A + ULT_BEATS.freeze + ULT_BEATS.iframesAfter;
  faceAim(p, me);
  const clip = v.ult.clip ? ("verb" in v.ult.clip ? v.ult.clip.verb : v.ult.clip.unique) : null;
  if (clip) p.clip = { verb: clip, scale: v.ult.clip && "verb" in v.ult.clip ? v.ult.clip.scale ?? 1 : 1, upper: false };
  if (!v.ult.channel) fx(rt, v.ult.vfx?.cast, "cast", me, aim, "ult");
}

/** The movement passive (ruins only): an air jump, a slide, a dash or a landing the avatar reports. */
export function classMove(rt: CombatRuntime, me: Vec, on: MovementPassive["on"], random = Math.random): boolean {
  const v = rt.v2, p = rt.player, m = v?.kit.movement;
  if (!v || !m || m.on !== on || !p.alive || v.moveCd > 0 || p.energy < m.energy) return false;
  spend(rt, m.energy);
  v.moveCd = m.cooldown_s ?? 0;
  const speed = Math.hypot(p.move.vx, p.move.vz), ahead = speed > 0.3 ? { x: me.x + (p.move.vx / speed) * 3, z: me.z + (p.move.vz / speed) * 3 } : p.aim;
  const ctx = context(rt, { key: `${v.kit.key}.movement`, name: m.name, description: m.description, cooldown_s: 0, energy: m.energy, effects: m.effects }, me, 1, ahead);
  fx(rt, m.vfx, "cast", me, ahead, "ability");
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
  stepFire(rt, me, dt, random); // Focus, the cylinder, the Killstreak, a surge's shots, burns
  p.ultIframes = Math.max(0, p.ultIframes - real);
  // A channel (Cataclysm): rooted, the storm gathering over its aim; it releases at its end or with the last note.
  if (v.channel) {
    const c = v.channel, ch = v.ult.channel!;
    if (!p.alive) { v.channel = null; rt.buffs = rt.buffs.filter(b => b.source !== "channel"); }
    else {
      c.t += real; c.aim = { ...p.aim }; // the storm follows your aim while it gathers
      if ((c.pulse -= real) <= 0) { c.pulse = 0.35; fx(rt, v.ult.vfx?.zone, "zone", c.aim, me, "heavy", ULT_REACH(v.ult)); p.clip = { verb: "Channel", scale: 1, upper: false }; }
      if (c.t >= ch.seconds || c.at >= c.notes.length) endChannel(rt, me);
    }
  }
  // The ult: its hits at the anticipation's end (A), its presentation (impact.ts) until the end.
  if (v.cast) {
    if (!classDev.holdUlt) v.cast.t += real;
    const A = v.ult.anticipation_ms / 1000, finisherOnly = v.ult.impacts === "last";
    if (!v.cast.fired && v.cast.t >= A && p.alive) {
      v.cast.fired = true;
      const ctx = context(rt, v.ult, me, v.cast.potency ?? 1, v.cast.aim);
      ctx.impact = finisherOnly ? "heavy" : "ult"; ctx.ult = true; ctx.fx = v.ult.vfx; ctx.ramp = v.ult.ramp;
      runEffects(rt, v.ult.effects, ctx, random);
    }
    const span = v.ult.impacts !== "first" ? v.ult.duration ?? 0 : 0;
    if (span > 0 && !v.cast.last && v.cast.t >= A + span && p.alive) { // the finisher: its hits, and the sequence plays again (ultView)
      v.cast.last = true; v.cast.shift = span;
      p.ultIframes = ULT_BEATS.freeze + ULT_BEATS.iframesAfter; // nothing lands unseen in this freeze either
      const ctx = context(rt, v.ult, me, v.cast.potency ?? 1, p.aim);
      ctx.impact = "ult"; ctx.ult = true; ctx.fx = v.ult.vfx; ctx.ramp = v.ult.ramp;
      runEffects(rt, v.ult.release ?? v.ult.effects, ctx, random);
    }
    if (v.cast.t >= A + (v.ult.duration ?? 0) + ULT_BEATS.end) v.cast = null;
  }
  // In combat (§1.3): something hunting or hitting you, a wave running or the boss engaged, and for 5 s after.
  const threat = rt.wave?.active || rt.bossEngaged || rt.enemies.some(e => THREAT.has(e.state) && e.status.distract <= 0 && Math.hypot(e.x - me.x, e.z - me.z) < e.type.aggroRadius + 4);
  v.combatT = threat ? IN_COMBAT : Math.max(0, v.combatT - dt);
}
