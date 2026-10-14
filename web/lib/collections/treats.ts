/**
 * Treats (the traditions calendar's trick-or-treat, lib/content/traditions.ts): candies a resident hands over at their
 * door. Bag items like the crafting materials (lib/crafting/recipes.ts MATERIALS), not museum species: fruit, so they
 * stack 30 to a slot and can be eaten from the tool wheel; never donated. Seeded by 20261013210000_traditions.sql
 * (keep the two in step); their models are art/props-enemies/build_treats.py.
 */
import type { Species } from "./roster";

const treat = (key: string, name: string, rarity: Species["rarity"], oneLiner: string, position: number): Species => ({
  key, category: "fruit", sub: "treat", name, biome: "ground", tool: "hand", rarity, size: null, hours: null, rainAnyHour: false, weather: [],
  months: [], oneLiner, icon: `/assets/icons/${key}.webp`, model: `/assets/game/items/${key}.glb`, assetReady: true, donatable: false, wing: null, position,
});

export const TREATS: Species[] = [
  treat("treat_toffee", "Wrapped toffee", "common", "Twisted in waxed paper. Sticks to your teeth in the friendliest way.", 201),
  treat("treat_lollipop", "Swirl lollipop", "common", "A spiral of every colour the shop had. Lasts a whole walk home.", 202),
  treat("treat_candy_corn", "Candy corn", "uncommon", "Somebody on this island loves it. Nobody will say who.", 203),
];
export const isTreat = (key: string) => TREATS.some(t => t.key === key);

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** The treat a resident gives a member on a night: the same answer however often it's asked (candy corn the rarer). */
export function treatFor(memberId: string, resident: string, night: string): Species {
  const u = hash(`${memberId}|${resident}|${night}`) % 100;
  return u < 40 ? TREATS[0] : u < 80 ? TREATS[1] : TREATS[2];
}
