/**
 * The Arcane family's seed (design sheet §4 waves 1–4): its signature weapons (§1.5: one type per subclass, tiers 1–5 on
 * one base mesh with the shared trim kit: wood and cloth, iron, rune-cut, gold with a glow part, animated runes) and its
 * shop cosmetics (§1.10: weapon skins as material sets on that mesh, aura colours as three hex values; about one in four
 * Gem-priced, no rate shown anywhere). supabase/migrations/*_classes_v2_arcane_seed.sql carries the same rows (a test
 * keeps them equal); the models come from art/props-enemies/build_arcane.py.
 */
import type { WeaponDef } from "./weapons";

const TIERS = ["", "1", "2", "3", "4", "5"] as const;
const set = (type: string, subclass: string, basic: WeaponDef["basic"], names: [string, string, string, string, string]): WeaponDef[] =>
  names.map((name, i) => ({ key: `${type}-${TIERS[i + 1]}`, name, type, tier: (i + 1) as WeaponDef["tier"], scaling: ["arcana"], max_durability: 60 + (i + 1) * 30, repair_per_point: i + 1, subclass, basic }));

export const ARCANE_WEAPONS: WeaponDef[] = [
  ...set("prism-staff", "elementalist", "staff", ["Driftwood prism staff", "Iron-banded prism staff", "Rune-cut prism staff", "Gilded prism staff", "Starlit prism staff"]),
  ...set("trick-deck", "illusionist", "staff", ["Paper trick deck", "Silver-edged trick deck", "Rune-inked trick deck", "Gilded trick deck", "Starlit trick deck"]),
  ...set("bone-tome", "necromancer", "staff", ["Cracked bone tome", "Iron-clasped bone tome", "Rune-bound bone tome", "Gilded bone tome", "Soul-lit bone tome"]),
  ...set("tooth-charm", "transmuter", "melee", ["Corded tooth charm", "Iron-set tooth charm", "Rune-carved tooth charm", "Gilded tooth charm", "Soul-lit tooth charm"]),
];

/** A shop cosmetic: a weapon skin (re-colours the named materials of that subclass's weapon) or an aura colour set. Gems when `gems`. */
export interface Cosmetic { slug: string; name: string; description: string; coins?: number; gems?: number;
  kind: "weapon_skin" | "aura"; subclass: string; skin?: Record<string, string>; ramp?: [string, string, string]; glow?: boolean }
const skin = (slug: string, name: string, subclass: string, description: string, materials: Record<string, string>, price: { coins?: number; gems?: number }, glow = false): Cosmetic =>
  ({ slug, name, description, kind: "weapon_skin", subclass, skin: materials, ...price, ...(glow ? { glow } : {}) });
const aura = (slug: string, name: string, subclass: string, description: string, ramp: [string, string, string], price: { coins?: number; gems?: number }): Cosmetic =>
  ({ slug, name, description, kind: "aura", subclass, ramp, ...price });

/** The skin key a weapon_skin row carries (its slug's last word: skin-prism-ember → ember), as shop_items.cosmetic.skin. */
export const skinKey = (c: Cosmetic) => c.slug.replace(/^skin-[a-z]+-/, "");
export const ARCANE_COSMETICS: Cosmetic[] = [
  skin("skin-prism-ember", "Ember prism staff", "elementalist", "Charred wood and copper bands for the Elementalist's staff. Looks only: your tier still shows.", { M_Body: "#4a2a20", M_Trim: "#c8742e", M_Accent: "#ffb35c" }, { coins: 800 }),
  skin("skin-prism-glacier", "Glacier prism staff", "elementalist", "Pale birch and frosted silver for the Elementalist's staff. Looks only.", { M_Body: "#e6ecef", M_Trim: "#9fc4d8", M_Accent: "#5a86a8" }, { coins: 800 }),
  aura("aura-elementalist-fire", "Wildfire aura", "elementalist", "Your aura's motes burn orange.", ["#fff6d8", "#ff8a3d", "#5a1408"], { coins: 300 }),
  aura("aura-elementalist-tide", "Tide aura", "elementalist", "Your aura's motes run sea-blue.", ["#f2fdff", "#4fb8ff", "#0c2c5a"], { coins: 300 }),
  aura("aura-elementalist-storm", "Storm shimmer aura", "elementalist", "Two-tone motes, violet into storm-teal.", ["#ffffff", "#7fd8ff", "#5a2a9a"], { gems: 150 }),
  skin("skin-deck-joker", "Joker's deck", "illusionist", "Midnight card backs with gold edges and a red Joker. Looks only.", { M_Body: "#2b1f3a", M_Trim: "#e8c25a", M_Accent: "#c0303a" }, { coins: 800 }),
  aura("aura-illusionist-mirror", "Mirror-shard aura", "illusionist", "Your floating cards glint like broken glass.", ["#ffffff", "#bfe8ff", "#2a3a6a"], { coins: 300 }),
  skin("skin-tome-ossuary", "Ossuary binding", "necromancer", "A pale bone binding with an iron spine and a sea-green soul gem. Looks only.", { M_Body: "#e6dcc4", M_Trim: "#3a2f2a", M_Accent: "#5cffc8" }, { coins: 800 }),
  aura("aura-necromancer-soulfire", "Soul-fire aura", "necromancer", "Your bone dust burns with green soul-fire.", ["#f0fff8", "#5cffc8", "#0a3a2a"], { coins: 300 }),
  aura("aura-necromancer-violet", "Violet soul-fire aura", "necromancer", "Two-tone soul-fire, violet into green.", ["#fff4ff", "#c77dff", "#1f3a2a"], { gems: 150 }),
  skin("skin-charm-obsidian", "Obsidian tooth charm", "transmuter", "A black glass fang on a violet cord. Looks only.", { M_Body: "#1e1a24", M_Trim: "#6a5a8a", M_Accent: "#b48cff" }, { coins: 800 }),
  skin("skin-charm-amber", "Amber tooth charm", "transmuter", "A fang set in glowing amber that pulses with your forms.", { M_Body: "#c88a2e", M_Trim: "#7a4a1a", M_Accent: "#ffd27a" }, { gems: 200 }, true),
];

/** The family's weapon skins as material sets, by `${subclass}:${skin}` (classes.ts WEAPON_SKINS). */
export const ARCANE_SKINS: Record<string, Record<string, string>> = Object.fromEntries(ARCANE_COSMETICS.filter(c => c.kind === "weapon_skin").map(c => [`${c.subclass}:${skinKey(c)}`, c.skin!]));
