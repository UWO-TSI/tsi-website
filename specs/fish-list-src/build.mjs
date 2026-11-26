// Fills template.md's {{key}} markers with tables from data.mjs and res.json, writes the spec.
import { readFileSync, writeFileSync } from "node:fs";
import { WATER, RAR } from "./data.mjs";
import { RODS } from "./analyze.mjs";
const dir = new URL(".", import.meta.url).pathname;
const res = JSON.parse(readFileSync(dir + "res.json", "utf8"));
const T = {};
const row = (a) => `| ${a.join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const ORDER = ["c", "u", "r", "e", "l", "d"];
const seasons = (s) => s.length === 4 ? "all year" : s.join(" ");
const hrs = (f) => {
  const h = f.hours === "any" ? "any hour" : f.hours;
  switch (f.weather) {
    case "rain+": return `${h}, any hour in rain`;
    case "rain": return `${h}, rain only`;
    case "snow": return `${h}, snow only`;
    case "cloudy": return `${h}, cloud, fog or snow only`;
    case "sunny": return `${h}, clear sky only`;
    case "rainx2": return `${h}, x2 in rain`;
    case "rainx3": return `${h}, x3 in rain`;
    default: return h;
  }
};
const status = (f) => ({ T: "", N1: "new (r1)", N2: "**new**", M: "from the sea", X1: "new (r1), from the river" }[f.status]);
const SHORT = { R: "river", C: "cliff", P: "pond", S: "sea", D: "deep" };
// counts
T.counts = table(["Water", "common", "uncommon", "rare", "epic", "legendary", "Divine", "All", "Epic and up", "New this round"],
  Object.keys(WATER).map(w => { const c = res.counts[w]; const all = ORDER.reduce((a, r) => a + c[r], 0); const fs = res.perFish.filter(f => f.water === w);
    return [WATER[w], c.c, c.u, c.r, c.e, c.l, c.d || "", all, `${Math.round(100 * (c.e + c.l + c.d) / all)}%`, fs.filter(f => f.status === "N2").length]; }));
// new fish by name, per water
T.newByWater = Object.keys(WATER).map(w => {
  const by = (st) => ORDER.map(r => { const n = res.perFish.filter(f => f.water === w && f.rarity === r && st(f)).map(f => f.name); return n.length ? `${RAR[r]}: ${n.join(", ")}` : null; }).filter(Boolean).join("; ");
  const moved = res.perFish.filter(f => f.water === w && (f.status === "M" || f.status === "X1")).map(f => f.name);
  return `- **${WATER[w]}.** New this round: ${by(f => f.status === "N2")}. From round 1: ${by(f => f.status === "N1") || "none"}.${moved.length ? ` Moved in: ${moved.join(", ")}.` : ""}`;
}).join("\n");
// roster per water
for (const w of Object.keys(WATER)) {
  T["roster" + w] = table(["Fish", "Rarity", "Seasons", "Hours, weather", "Status", "Let it go", "Also", "Reel task", "First rod %", "Full stack %"],
    res.perFish.filter(f => f.water === w).sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity)).map(f => [f.name, RAR[f.rarity], seasons(f.seasons), hrs(f), status(f), f.material, f.also, f.task, f.alone, f.full]));
}
// tasks by kind
const KINDS = ["Leap", "Run", "Snag", "Pry", "Dark", "Spark"];
T.taskAssign = table(["Task", "Epic fish (water)", "Count"], KINDS.map(k => { const fs = res.perFish.filter(f => f.rarity === "e" && f.task === k); return [k, fs.map(f => `${f.name} (${SHORT[f.water]})`).join(", "), fs.length]; }));
T.legTasks = table(["Creature", "Water", "Its boss reel, in order"], res.perFish.filter(f => f.rarity === "l").map(f => [f.name, WATER[f.water], f.task]));
// materials: from
const mats = {};
for (const f of res.perFish) { if (f.material === "none") continue; const m = f.material.replace(/ x2$/, ""); (mats[m] ||= []).push(f.name + (/ x2$/.test(f.material) ? " (x2)" : "")); for (const extra of (f.also.match(/Roe too/) ? ["Roe"] : [])) (mats[extra] ||= []).push(f.name); }
const MAT = [
  ["Fish Scale", "common", "rod grips, every Guardian shield's facing, fishing outfit trims"],
  ["Shell Grit", "common", "the polish in every crafted rod; shell housings for sudos later (lore: beachcombing)"],
  ["Squid Ink", "common", "Summoner seals, Illusionist cards, Necromancer pages"],
  ["Fin", "uncommon", "Marksman fletching, Hunter bolt vanes, Shaman totem feathers"],
  ["Crab Shell", "uncommon", "Juggernaut and Guardian plating"],
  ["Spine", "uncommon", "Assassin kunai, Hunter barbs"],
  ["Eel Skin", "uncommon", "Martial Artist wraps, bow and holster leather"],
  ["Glow Ink", "uncommon", "Illusionist and Summoner glow"],
  ["Pearl", "rare", "Gunslinger grips, Priest and Sniper settings, Elementalist staff tips"],
  ["Nacre", "rare", "Illusionist card faces, staff inlays"],
  ["Fang", "rare", "Transmuter charms, Assassin and Hunter edges"],
  ["Armour Scale", "rare", "Juggernaut, Sniper stock"],
  ["Ray Leather", "rare", "Martial Artist wraps, Marksman grip"],
  ["Turtle Shell", "rare", "Guardian shield"],
  ["Lantern Lure", "rare", "Shaman totem light, the Rune staff"],
  ["Night Ink", "rare", "Necromancer and Summoner"],
  ["Axolotl Frill", "rare", "Druid"],
  ["Crystal Carapace", "rare", "Elementalist staffs"],
  ["Golden Scale", "epic", "the gold trim on any epic-look piece of any class"],
  ["Roe", "epic", "a dish ingredient only (the tasting book's big dishes)"],
];
T.materials = table(["Material", "Rarity", "From (let it go)", "Used for"], MAT.map(([m, r, u]) => [m, r, (mats[m] || []).join(", "), u]));
const PARTS = { "Arapaima Scale": "Guardian", "Silver Scale": "Illusionist", Whisker: "Shaman", "Ancient Bone": "Necromancer", "Muskie Fang": "Transmuter", "Gar Fang": "Assassin", "Frost Fin": "Elementalist", "Storm Coil": "Elementalist", "Living Moss": "Druid", "Sun Scale": "Priest", "Great White Tooth": "Transmuter", "Hammer Crest": "Juggernaut", "Black Pearl": "Gunslinger", "Sail Fin": "Shaman", "Barreleye Lens": "Sniper", "Isopod Plate": "Guardian", "Oar Ribbon": "Illusionist", "Marlin Bill": "Marksman", "Whale Shark Hide": "Martial Artist", "Saw Rostrum": "Hunter", "Abyss Ink": "Summoner" };
T.parts = table(["Epic part", "Subclass", "From"], Object.entries(PARTS).sort((a, b) => a[1].localeCompare(b[1])).map(([m, s]) => [m, s, (mats[m] || []).join(", ")]));
// odds
const B = res.bandTables;
const oddsRows = (filter) => B.filter(filter).map(t => [t.water, t.rod, t.label, t.L, t.c, t.u, t.r, t.e, t.leg, t.div]);
const OH = ["Water", "Rod", "Setup", "Luck (L)", "common %", "uncommon %", "rare %", "epic %", "legendary, in its window", "Divine, in its window"];
T.oddsRiver = table(OH, oddsRows(t => t.water === "River" && t.st !== "later"));
T.oddsOther = table(OH, oddsRows(t => t.water !== "River" && /Glass|Tidewarden|Fallen/.test(t.rod)));
T.oddsToday = table(["Water", "Today's gear and cast", "Luck", "common %", "uncommon %", "rare %", "epic %"], res.today.map(t => [t.water, t.label, t.L, t.c, t.u, t.r, t.e]));
// rods
const LEAN = { "Flimsy rod": "even, the floor", "Driftwood rod": "luck and lure, a weak line", "Cedar rod": "luck, bite and lure", "Bamboo rod": "steady: strength, reel, control", "Glass rod": "control (the widest bar)", "Coral rod": "luck and lure, a sea rod", "Lighthouse rod": "bite window, all-round", "Tidewarden rod": "bite window, strong line", "Abyss rod": "strength and reel, for runs and the deep sea", "Fallen Star rod": "control and luck" };
const ST = { today: "today", later: "later (example)", new: "proposed" };
const rodLuck = (s) => (0.04 * (Math.min(100, s) - 10) / 10).toFixed(2);
T.rods = table(["Rod", "Rarity", "Source", "Status", "Luck", "Bite", "Strength", "Reel", "Lure", "Control", "Total", "Lean", "Rig luck (alone / + Lucky bobber)"],
  RODS.map(r => [r.name, RAR[r.rarity], r.source, ST[r.st], ...r.s, r.s.reduce((a, b) => a + b, 0), LEAN[r.name], `${rodLuck(r.s[0])} / ${rodLuck(r.s[0] + 20)}`]));
let tpl = readFileSync(dir + "template.md", "utf8");
tpl = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in T)) throw new Error("missing " + k); return T[k]; });
writeFileSync(process.argv[2], tpl);
console.log("ok", tpl.length);
