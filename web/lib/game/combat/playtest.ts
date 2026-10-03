/**
 * The class playtest harness (specs/classes/playtest.md), dev-only: on a page with `?combat=demo` (the in-memory combat
 * demo, lib/game/combat/demo.ts) and never in a production build. The picker's roster (every subclass, its kit when its
 * family wave has landed in CLASS_KITS, "coming" until then), the dev flags (god mode, infinite mana), the spawner at
 * the gate plaza with its dummies, the 5 s DPS meter and the notes. Outside the demo every entry point does nothing.
 */
import { CLASS_KITS, CLASS_RENAMES, classKit, type ClassKit, type StatDirection } from "@/lib/combat/classes";
import { SUBCLASSES } from "@/lib/combat/kits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import type { Family } from "@/lib/oracle/engine";
import type { EnemyType } from "./contract";
import { ENEMIES } from "./data";
import { mobFx } from "./mobs";
import { energyMax, type CombatRuntime } from "./runtime";
import { spawnEnemy, type Enemy, type Vec } from "./sim";
import { capacity, packAt } from "./spawns";

let search: string | null = null, on = false, harness = false;
function read() {
  const s = window.location?.search ?? "";
  if (s !== search) { const q = new URLSearchParams(s); search = s; on = q.get("combat") === "demo"; harness = on && q.get("playtest") === "1"; }
}
/** The demo is on: a dev build and `?combat=demo` on this page (the dev panel's controls, the flags, the spawner). */
export function playtestOn(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false;
  read();
  return on;
}
/** Opened from /lab/classes (`&playtest=1` too): the ruins HUD (meter, notes, key card) and the signature weapon put in hand. Other demo pages stay as they were. */
export function playtestHarness(): boolean {
  return playtestOn() && harness;
}

// ── The roster (the picker and the panel's switch) ──────────────
/** The design sheet's LOCKED line, stat direction and style for each subclass, for the cards whose kit hasn't landed yet. */
const SHEET: Record<string, { fantasy: string; stat: StatDirection; style: "basic" | "skill" }> = {
  elementalist: { fantasy: "Four elements on 1–4; press two together for a combo. Mana only, no cooldowns.", stat: "max_mana", style: "skill" },
  illusionist: { fantasy: "Clones that fight like you, swaps, a mirror parry and Vanish.", stat: "duration", style: "skill" },
  necromancer: { fantasy: "Raise the fallen as skeletons, command them, then blow up the corpses.", stat: "summon_count", style: "skill" },
  transmuter: { fantasy: "Shift into the fox, crab, wisp, pollen swarm or golem you have defeated.", stat: "cooldown", style: "skill" },
  marksman: { fantasy: "Hold fire and keep moving: Focus ramps the bow from 1.5 to 8 shots a second.", stat: "attack_speed", style: "basic" },
  hunter: { fantasy: "Fill the field with traps, mark your prey, harpoon it into them.", stat: "duration", style: "skill" },
  sniper: { fantasy: "A glass cannon: slow heavy shots, weak points always crit, kills stack damage.", stat: "crit_damage", style: "skill" },
  gunslinger: { fantasy: "Six shots, then a reload with a gold zone; the sixth bullet always crits.", stat: "reload_speed", style: "basic" },
  guardian: { fantasy: "Shield and sword: block, time the parry, counter-slash, plant a dome.", stat: "armor", style: "skill" },
  monk: { fantasy: "Muay Thai: a jab, cross, hook and kick chain with techniques woven in.", stat: "attack_speed", style: "basic" },
  juggernaut: { fantasy: "A war hammer nothing stops: charges, ground slams, and Titan.", stat: "max_hp", style: "basic" },
  assassin: { fantasy: "Get behind them: blinks and vaults into backstabs that always crit.", stat: "crit_chance", style: "skill" },
  summoner: { fantasy: "Hand signs call shadow beasts: wolves, an owl, a toad, a serpent, rabbits.", stat: "summon_power", style: "skill" },
  shaman: { fantasy: "Throw totems, link them with lightning, then Overcharge the field.", stat: "area", style: "skill" },
  druid: { fantasy: "Stack max HP: every heal is a share of it; roots and thorns hold the line.", stat: "max_hp", style: "skill" },
  priest: { fantasy: "Draw your spells: heals, shields and holy light, stronger the cleaner you draw.", stat: "healing", style: "skill" },
};
export interface ClassRow { key: string; name: string; family: Family; fantasy: string; stat: StatDirection; style: "basic" | "skill";
  /** Its v2 kit once its family wave has landed (CLASS_KITS); null shows "coming". */
  kit: ClassKit | null }
/** The 16 subclasses in family order, each with its kit when it has landed. Read at call time, so a merged wave shows up. */
export function classRows(): ClassRow[] {
  return SUBCLASSES.map(s => {
    const kit = CLASS_KITS.find(k => k.key === s.key && !k.dev) ?? null, sheet = SHEET[s.key];
    return { key: s.key, name: kit?.name ?? CLASS_RENAMES[s.key] ?? s.name, family: s.family, fantasy: sheet?.fantasy ?? "",
      stat: kit?.stat.kind ?? sheet?.stat ?? "duration", style: kit?.style ?? sheet?.style ?? "skill", kit };
  });
}
/** The best tier of the kit's signature weapon type among `owned` (the one to put in hand). */
export function bestSignature(kitKey: string, owned: readonly string[]): string | null {
  const type = classKit(kitKey)?.signature.type;
  return SYSTEM_WEAPONS.filter(w => w.type === type && owned.includes(w.key)).sort((a, b) => b.tier - a.tier)[0]?.key ?? null;
}

// ── Dev flags (applied each frame by playtestFrame) ─────────────
export const PLAYTEST = { god: false, mana: false };
export function setPlaytest(flag: keyof typeof PLAYTEST, value: boolean) { if (playtestOn()) PLAYTEST[flag] = value; }

// ── The spawner ─────────────────────────────────────────────────
export type SpawnId = "dummy" | "shell" | "ranged" | "shadow-fox" | "thorn-crab" | "mushroom-beast" | "rune-wisp" | "pollen-sprite" | "elder-thorn-crab" | "guardian-statue";
export const SPAWNER: { id: SpawnId; label: string; title: string }[] = [
  { id: "dummy", label: "Dummy", title: "A training dummy: never fights back, never dies" },
  { id: "shell", label: "Shell dummy", title: "A dummy with a crab's front shell: flank it or backstab it" },
  { id: "ranged", label: "Ranged dummy", title: "A dummy that fires a slow bolt at you every few seconds: parry it or mirror it back" },
  { id: "shadow-fox", label: "Fox pack", title: "Three shadow foxes" },
  { id: "thorn-crab", label: "Crab", title: "A thorn crab" },
  { id: "mushroom-beast", label: "Mushroom", title: "A mushroom beast" },
  { id: "rune-wisp", label: "Wisp", title: "A rune wisp" },
  { id: "pollen-sprite", label: "Pollen cloud", title: "A cloud of nine pollen sprites" },
  { id: "elder-thorn-crab", label: "Elder Thorn Crab", title: "The zone's mini-boss" },
  { id: "guardian-statue", label: "Guardian Statue", title: "The ruins' boss" },
];
/** Where things appear: the mouth of the gate plaza, just past the safe zone's edge (z −24.6). */
export const TEST_GROUND: Vec = { x: 0, z: -18.5 };
/** Dummies borrow a mob's body (no art of their own) and stand still, held, with this much health and no defense. */
const DUMMY_BODY = { dummy: "stone-golem", shell: "thorn-crab", ranged: "rune-wisp" } as const;
const DUMMY_HP = 1_000_000;
/** The ranged dummy's bolt: slow enough to time a parry, every few seconds while you're within reach and outside the safe zone. */
export const DUMMY_BOLT = { speed: 5, every: 2.6, reach: 14, damage: 6 } as const;
const dummyType = (kind: keyof typeof DUMMY_BODY): EnemyType => ({ ...ENEMIES[DUMMY_BODY[kind]], name: SPAWNER.find(s => s.id === kind)!.label, hp: DUMMY_HP, defense: 0, armor: 0, xp: 0, elite: false, aggroRadius: 0 });
export const dummyKind = (e: Pick<Enemy, "id">) => (e.id.startsWith("pt-dummy-") ? "dummy" : e.id.startsWith("pt-shell-") ? "shell" : e.id.startsWith("pt-ranged-") ? "ranged" : null);

let made = 0;
/** At most `capacity(type)` of a type draw (EncounterRender's instanced meshes): the oldest go first, the spawn table's before ours. */
function makeRoom(rt: CombatRuntime, type: string, n: number) {
  const live = rt.enemies.filter(e => e.type.id === type && e.state !== "dead");
  const out = new Set(live.slice(0, Math.max(0, live.length + n - capacity(type))));
  if (out.size) rt.enemies = rt.enemies.filter(e => !out.has(e));
}
/** Put one of the menu's things at the test ground (idle until you come close; dummies held for good). Returns what it added. */
export function spawnPlaytest(rt: CombatRuntime, id: SpawnId): Enemy[] {
  if (!playtestOn()) return [];
  const n = ++made, g = TEST_GROUND;
  let list: Enemy[];
  if (id === "dummy" || id === "shell" || id === "ranged") {
    const row = rt.enemies.filter(e => dummyKind(e) === id).length, x = g.x + { dummy: -3, shell: 0, ranged: 3 }[id], z = g.z + row * 2;
    const e = spawnEnemy(`pt-${id}-${n}`, dummyType(id), x, z);
    e.status.hold = 1e9;
    list = [e];
  } else {
    const at = { x: g.x, z: g.z + (ENEMIES[id].kind === "boss" || ENEMIES[id].miniboss ? 5 : 3) }, pack = id === "shadow-fox" ? 3 : id === "pollen-sprite" ? 9 : 0;
    list = pack ? packAt(`pt-${id}-${n}`, id, at.x, at.z, pack).map(s => spawnEnemy(s.id, ENEMIES[id], s.x, s.z, s.pack)) : [spawnEnemy(`pt-${id}-${n}`, ENEMIES[id], at.x, at.z)];
  }
  makeRoom(rt, list[0].type.id, list.length);
  rt.enemies.push(...list);
  return list;
}
/** Every enemy, its shots and what it left on the ground gone (the spawn table too, until you leave the ruins). */
export function clearPlaytest(rt: CombatRuntime) {
  if (!playtestOn()) return;
  rt.enemies = []; rt.projectiles = rt.projectiles.filter(s => s.from === "player"); rt.hazards = []; rt.mobFx = [];
  rt.bossEngaged = false; rt.wave = null;
}

// ── The 5 s DPS meter (fight time: slow motion and hitstop don't count) ──
const N = 256, ts = new Float64Array(N), ds = new Float64Array(N);
const meter = { clock: 0, head: 0, count: 0, last: -1, floater: -1, hits: [] as { t: number; n: number; crit: boolean }[] };
export const DPS_WINDOW = 5;
function sample(rt: CombatRuntime, dt: number) {
  const m = meter;
  m.clock += dt;
  if (m.clock - m.last >= 0.05) { ts[m.head] = m.clock; ds[m.head] = rt.tally.dealt; m.head = (m.head + 1) % N; m.count = Math.min(N, m.count + 1); m.last = m.clock; }
  for (const f of rt.floaters) {
    if (f.id <= m.floater || (f.kind !== "hit" && f.kind !== "crit" && f.kind !== "ult")) continue;
    m.hits.push({ t: m.clock, n: Number(f.text), crit: f.kind !== "hit" });
  }
  for (const f of rt.floaters) m.floater = Math.max(m.floater, f.id);
  while (m.hits.length && m.hits[0].t < m.clock - DPS_WINDOW) m.hits.shift();
}
/** Damage over the last 5 s of fight time, its per-second rate, the biggest hit in it and the last few. */
export function dpsView(rt: Pick<CombatRuntime, "tally">) {
  const m = meter, from = m.clock - DPS_WINDOW;
  let base = rt.tally.dealt;
  for (let i = 0; i < m.count; i++) { const k = (m.head - 1 - i + N) % N; base = ds[k]; if (ts[k] <= from) break; }
  const total = Math.max(0, rt.tally.dealt - base), top = m.hits.reduce((b, h) => (h.n > b.n ? h : b), { t: 0, n: 0, crit: false });
  return { total, dps: total / DPS_WINDOW, biggest: top.n ? top : null, last: m.hits.slice(-6) };
}

// ── One frame (RuinsScene, after the encounter tick) ────────────
/** God mode and infinite mana top up after the tick (a hit still shows, nothing is lost); dummies hold still and drift home; the ranged one fires. */
export function playtestFrame(rt: CombatRuntime, me: Vec, dt: number) {
  if (!playtestOn()) return;
  const p = rt.player;
  if (PLAYTEST.god && p.alive) p.hp = p.maxHp;
  if (PLAYTEST.mana) p.energy = energyMax(rt);
  for (const e of rt.enemies) {
    const kind = dummyKind(e);
    if (!kind || e.state === "dead") continue;
    e.status.hold = 1e9; e.facing = Math.PI; // its front stays toward the gate
    const hx = e.spawnX - e.x, hz = e.spawnZ - e.z, away = Math.hypot(hx, hz);
    if (!e.kx && !e.kz && away > 0.02) { const s = Math.min(away, 1.5 * dt) / away; e.x += hx * s; e.z += hz * s; }
    if (kind !== "ranged" || e.cd > 0 || !p.alive || p.safe) continue;
    const dx = me.x - e.x, dz = me.z - e.z, d = Math.hypot(dx, dz);
    if (d > DUMMY_BOLT.reach || d < 0.5) continue;
    e.cd = DUMMY_BOLT.every;
    rt.projectiles.push({ id: rt.seq++, x: e.x, z: e.z, vx: (dx / d) * DUMMY_BOLT.speed, vz: (dz / d) * DUMMY_BOLT.speed, life: (d + 3) / DUMMY_BOLT.speed, from: "enemy", damage: DUMMY_BOLT.damage, kind: "rune", radius: 0.3, knock: 1.5 });
    mobFx(rt, "runes", e.x, e.z);
  }
  sample(rt, dt);
}

// ── Notes (this browser; listed on /lab/classes) ────────────────
export interface PlaytestNote { at: string; subclass: string; mastery: number | null; text: string }
export const NOTES_KEY = "tsi.playtest.notes.v1";
export function readNotes(): PlaytestNote[] {
  try { const v = JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** A timestamped line with the class being played. False when it couldn't be kept (outside the demo, storage off). */
export function addNote(rt: CombatRuntime, text: string, at = new Date()): boolean {
  const t = text.trim();
  if (!t || !playtestOn()) return false;
  const v2 = rt.v2, note: PlaytestNote = { at: at.toISOString(), subclass: v2?.kit.name ?? rt.kit?.subclass.name ?? "No class", mastery: v2?.mastery ?? null, text: t };
  try { localStorage.setItem(NOTES_KEY, JSON.stringify([...readNotes(), note])); return true; } catch { return false; }
}
const two = (v: number) => String(v).padStart(2, "0");
/** When it was written, in this machine's time. */
export function noteTime(n: PlaytestNote) {
  const d = new Date(n.at);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
export const noteClass = (n: PlaytestNote) => `${n.subclass}${n.mastery ? ` (mastery ${n.mastery})` : ""}`;
/** One line per note, for pasting to the coordinator. */
export const noteLine = (n: PlaytestNote) => `${noteTime(n)} · ${noteClass(n)} · ${n.text}`;
