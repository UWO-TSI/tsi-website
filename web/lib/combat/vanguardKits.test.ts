import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSASSIN, GUARDIAN, JUGGERNAUT, MARTIAL_ARTIST, VANGUARD_KITS, VANGUARD_WEAPONS } from "./vanguardKits";
import { classKit, kitAt, memberKit, type ClassAbility } from "./classes";
import { subclassByKey } from "./kits";
import { signatureSeedSql } from "./seed";
import { signatureGrant, WEAPONS } from "./weapons";
import { SUBCLASS_FOR_TYPE } from "@/lib/oracle/subclass";
import { FX } from "@/lib/game/fx/combat";
import { WEAPONS as ISLAND_WEAPONS } from "@/lib/game/combat/data";
import { gripFor } from "@/lib/game/character/clips";
import { VERB_BY_NAME } from "@/lib/game/character/look";

const PUBLIC = join(__dirname, "../../public");
const all = (k: (typeof VANGUARD_KITS)[number]): ClassAbility[] => [...k.keys, k.ult];

/** The Vanguard wave as David locked it (specs/classes/design-sheet.md: Guardian, Juggernaut, Martial Artist, Assassin). */
describe("the Vanguard kits (LOCKED sections and the build overrides)", () => {
  it("four kits in the family, members can choose them, the dev flag off", () => {
    expect(VANGUARD_KITS.map(k => k.key)).toEqual(["guardian", "juggernaut", "monk", "assassin"]);
    for (const k of VANGUARD_KITS) { expect(k.family).toBe("Vanguard"); expect(k.dev).toBeUndefined(); expect(memberKit(k.key)).toBe(k); expect(classKit(k.key)).toBe(k); }
  });
  it("the Martial Artist keeps the key monk and shows its new name everywhere", () => {
    expect(MARTIAL_ARTIST.key).toBe("monk");
    expect(MARTIAL_ARTIST.name).toBe("Martial Artist");
    expect(subclassByKey("monk")!.name).toBe("Martial Artist"); // today's kit too, while the flag is off
  });
  it("roles, styles, stat directions (the table), keys 1–5 (the Juggernaut's four)", () => {
    expect(VANGUARD_KITS.map(k => [k.role, k.style, k.stat.kind, k.keys.length])).toEqual([
      ["tank", "skill", "armor", 5], ["tank", "basic", "max_hp", 4], ["damage", "basic", "attack_speed", 5], ["damage", "skill", "crit_chance", 5]]);
    for (const k of VANGUARD_KITS) expect(k.stat.at20, k.key).toBeGreaterThan(k.stat.at1); // mastery raises it
  });
  it("one key unlocks at mastery 3 (the per-class track); the rest from the start", () => {
    for (const k of VANGUARD_KITS) {
      expect(k.keys.filter(a => (a.unlock ?? 1) > 1).map(a => a.unlock), k.key).toEqual([3]);
      expect(kitAt(k, 2).keys.filter(a => !a).length).toBe(1);
      expect(kitAt(k, 3).keys.every(Boolean)).toBe(true);
    }
  });
  it("the designed inputs: the Guardian's hold-to-block with a 0.25 s parry; Kunai Blink a recast; Shadow Step two charges; techniques chain", () => {
    const block = GUARDIAN.keys[0];
    expect(block.input).toEqual({ kind: "hold", max_s: 3 });
    expect(block.effects).toContainEqual({ kind: "buff", stat: "parry", value: 1, duration: 0.25 });
    expect(block.effects).toContainEqual({ kind: "buff", stat: "block", value: 0.7, duration: 3 });
    expect(ASSASSIN.keys[1].input?.kind).toBe("recast");
    expect(ASSASSIN.keys[0]).toMatchObject({ charges: 2, refund: "backstab" });
    expect(MARTIAL_ARTIST.keys.every(a => a.chain)).toBe(true);
    expect(MARTIAL_ARTIST.basic?.chain?.map(s => s.clip)).toEqual(["Unique_Jab", "Unique_Cross", "Unique_Hook", "Unique_BodyKick"]);
    expect(JUGGERNAUT.basic?.hp).toBe(0.02);
    expect(ASSASSIN.mods?.max_hp).toBe(-0.15);
    expect(ASSASSIN.passive).toMatchObject({ kind: "backstab", value: 0.5 });
    expect(ASSASSIN.movement).toMatchObject({ name: "Vault", on: "dash" });
  });
  it("the ults: Unbreakable 6 s, Titan 2.5× for 10 s, eight strikes, Death Lotus in ink", () => {
    expect(GUARDIAN.ult).toMatchObject({ name: "Unbreakable", impacts: "first-last", duration: 6 });
    expect(JUGGERNAUT.ult).toMatchObject({ name: "Titan", impacts: "first-last", duration: 10 });
    expect(JUGGERNAUT.ult.effects[0]).toMatchObject({ kind: "buff", stat: "size", value: 1.5, duration: 10 });
    expect(MARTIAL_ARTIST.ult.name).toBe("Art of Eight Limbs");
    expect(MARTIAL_ARTIST.ult.effects.length + 1).toBe(8); // seven, and the finisher
    expect(ASSASSIN.ult).toMatchObject({ name: "Death Lotus", world: "ink", impacts: "first" });
  });
  it("the Oracle suggests each once: ISFP Guardian, ESFP Martial Artist, ESTP Juggernaut, ISTP Assassin", () => {
    expect([SUBCLASS_FOR_TYPE.ISFP, SUBCLASS_FOR_TYPE.ESFP, SUBCLASS_FOR_TYPE.ESTP, SUBCLASS_FOR_TYPE.ISTP].map(x => x.subclass)).toEqual(["guardian", "monk", "juggernaut", "assassin"]);
  });
  it("every effect a kit names exists (cast, travel, impact, zone, and its delayed strikes'), every icon is on disk", () => {
    for (const k of VANGUARD_KITS) {
      for (const a of all(k)) {
        for (const key of Object.values(a.vfx ?? {})) expect(FX[key as string], `${a.key} ${key}`).toBeDefined();
        for (const e of a.effects) if (e.kind === "after" && e.fx) expect(FX[e.fx], e.fx).toBeDefined();
        expect(existsSync(join(PUBLIC, a.icon!)), a.icon).toBe(true);
      }
      expect(existsSync(join(PUBLIC, k.look.icon)), k.look.icon).toBe(true);
      for (const icon of [k.passive.icon, k.movement?.icon]) if (icon) expect(existsSync(join(PUBLIC, icon)), icon).toBe(true);
      expect(k.passive.icon).toBeDefined();
      if (k.basic?.throw?.fx) expect(FX[k.basic.throw.fx]).toBeDefined();
    }
  });
});

describe("the Vanguard clips (build_clips.py: the kits' own, in the verbs catalogue)", () => {
  it("every clip a kit names is baked, for its weapon's grip; the ult clips are Ult_<Subclass>", () => {
    for (const k of VANGUARD_KITS) {
      const named = [...k.keys.map(a => a.clip), k.ult.clip, k.ult.finish, k.movement?.clip].flatMap(c => (c && "unique" in c ? [c.unique] : []));
      for (const n of [...named, ...(k.basic?.chain ?? []).map(s => s.clip)]) {
        const c = VERB_BY_NAME.get(n);
        expect(c, n).toBeDefined();
        expect(c!.grip, n).toBe(gripFor(k.signature.type));
        expect(c!.impact, n).toBeGreaterThan(0);
        expect(c!.impact, n).toBeLessThan(1);
      }
    }
    expect(["Ult_Guardian", "Ult_Juggernaut", "Ult_MartialArtist", "Ult_Assassin"].every(n => VERB_BY_NAME.has(n))).toBe(true);
  });
  it("the Martial Artist's chain: four strikes, the punches over a run, the kick full-body; the eight strikes' clip lands its first at the anticipation", () => {
    const [jab, cross, hook, kick] = MARTIAL_ARTIST.basic!.chain!.map(s => VERB_BY_NAME.get(s.clip)!);
    expect([jab.upper, cross.upper, hook.upper, kick.upper]).toEqual([true, true, true, false]);
    for (const c of [jab, cross, hook]) expect(c.impact * c.length).toBeLessThan(0.16); // the hit lands early: the chain stays quick
    const ult = VERB_BY_NAME.get("Ult_MartialArtist")!;
    expect(ult.impact * ult.length).toBeCloseTo(MARTIAL_ARTIST.ult.anticipation_ms / 1000, 2);
    const clinch = VERB_BY_NAME.get("Unique_ClinchKnees")!;
    expect(clinch.length).toBeCloseTo(1.4, 1); // the whole technique: three knees at 0.3, 0.7 and 1.1 s
  });
});

describe("the Vanguard signature weapons (§1.5)", () => {
  it("one type per subclass, tiers 1–5 each, the island knows each (a look and a model) and the grip it's held in", () => {
    for (const k of VANGUARD_KITS) {
      const tiers = VANGUARD_WEAPONS.filter(w => w.subclass === k.key);
      expect(tiers.map(w => w.tier), k.key).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(tiers.map(w => w.type))).toEqual(new Set([k.signature.type]));
      for (const w of tiers) { expect(WEAPONS).toContain(w); expect(ISLAND_WEAPONS[w.key]?.model, w.key).toBe(`/assets/game/weapons/${w.key}.glb`); }
      expect(signatureGrant(k.key, 1)!.tier).toBe(1);
      expect(signatureGrant(k.key, 4)!.tier).toBe(4);
    }
    expect([GUARDIAN, JUGGERNAUT, MARTIAL_ARTIST, ASSASSIN].map(k => gripFor(k.signature.type))).toEqual(["OneHand", "Staff", "Fists", "Fists"]);
  });
  it("the seed migration carries exactly these rows", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261002191742_classes_v2_vanguard_seed.sql"), "utf8");
    expect(sql).toContain(signatureSeedSql(["guardian", "juggernaut", "monk", "assassin"]));
  });
});
