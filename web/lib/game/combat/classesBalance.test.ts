import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLASS_KITS, classKit } from "@/lib/combat/classes";
import { balanceRowV2, bossMinutes, bossRowV2, signatureWeapon, ultAdds, V2_TARGETS, type BalanceRowV2, type BossRowV2 } from "./balance";
import { ENEMIES } from "./data";

/**
 * Classes v2, wave 5: all sixteen kits on one bot (design sheet §3 and §4 "Wave 5"), the band measured against the
 * sixteen instead of each family's interim reference. `WRITE_BALANCE=1` writes specs/evidence/classes/K5-balance.md.
 * Mastery 1 and 20 on the normal and the sanctum runs (20 seeds), the looped sanctum and what each ult adds there
 * (ultAdds, 20 seeds each way), the scripted guardian fight (12 seeds) and the content pass's formula.
 */
const KITS = CLASS_KITS.filter(k => !k.dev).map(k => k.key);
const SEEDS = 20, BOSS = 12;
const FAMILIES = ["Arcane", "Ranger", "Warden", "Vanguard"] as const;
/** The kit numbers the wave-5 tuning commits change (before → after); false here: the numbers below are the families'. */
const TUNING_APPLIED = false;

interface Row { key: string; name: string; family: string; role: string; charge: number; n1: BalanceRowV2; h1: BalanceRowV2; n20: BalanceRowV2; h20: BalanceRowV2; loop: BalanceRowV2; adds: number; b1: BossRowV2; b20: BossRowV2; formula: number }
const rows: Row[] = KITS.map(key => {
  const kit = classKit(key)!;
  return { key, name: kit.name, family: kit.family, role: kit.role, charge: kit.ult.charge,
    n1: balanceRowV2(key, "survive-circle", 1, SEEDS), h1: balanceRowV2(key, "survive-sanctum", 1, SEEDS),
    n20: balanceRowV2(key, "survive-circle", 20, SEEDS), h20: balanceRowV2(key, "survive-sanctum", 20, SEEDS),
    loop: balanceRowV2(key, "sanctum-loop", 1, SEEDS), adds: ultAdds(key, 1, SEEDS),
    b1: bossRowV2(key, 1, BOSS), b20: bossRowV2(key, 20, BOSS), formula: bossMinutes(signatureWeapon(key)) };
});

const med = (v: number[]) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const mean = (v: number[]) => v.reduce((n, x) => n + x, 0) / v.length;
const ROLE = V2_TARGETS.roles as Record<string, readonly [number, number]>;

/** Where the sixteen sit against §3. `ref` for roles: the mean (see "The band's reference" in the evidence). */
function band(r: Row[]) {
  const median = med(r.map(x => x.n1.dps)), avg = mean(r.map(x => x.n1.dps)), median20 = med(r.map(x => x.n20.dps));
  const taken = r.map(x => x.h1.takenPerMin), out = (cond: (x: Row) => boolean) => r.filter(cond).map(x => x.name);
  const inRole = (x: Row, ref: number) => { const [lo, hi] = ROLE[x.role]; const k = x.n1.dps / ref; return k >= lo && k <= hi; };
  const family = (f: string, get: (x: Row) => number) => mean(r.filter(x => x.family === f).map(get));
  return {
    median, avg, median20, ratio20: median20 / median,
    dps: { low: Math.min(...r.map(x => x.n1.dps)) / median, high: Math.max(...r.map(x => x.n1.dps)) / median, out: out(x => x.n1.dps / median < 0.75 || x.n1.dps / median > 1.25) },
    rolesMean: out(x => !inRole(x, avg)), rolesMedian: out(x => !inRole(x, median)),
    spread: Math.max(...taken) / Math.min(...taken), takenLow: Math.min(...taken), takenHigh: Math.max(...taken),
    tanksLeast: Math.max(...r.filter(x => x.role === "tank").map(x => x.h1.takenPerMin)) <= Math.min(...r.filter(x => x.role !== "tank").map(x => x.h1.takenPerMin)),
    clearNormal: Math.min(...r.map(x => x.n1.medianClear)) / med(r.map(x => x.n1.medianClear)), clearHard: Math.min(...r.map(x => x.h1.medianClear)) / med(r.map(x => x.h1.medianClear)),
    fillHard: out(x => !(x.h1.ultFill >= 60 && x.h1.ultFill <= 90)), fillNormal: out(x => !(x.n1.ultFillProjected >= 45 && x.n1.ultFillProjected <= 90)),
    adds: out(x => x.adds < 0.08 || x.adds > 0.15),
    each20: out(x => x.n20.dps / median20 < 0.75 || x.n20.dps / median20 > 1.25),
    guardian: med(r.map(x => x.b1.rateMinutes)), guardian20: med(r.map(x => x.b20.rateMinutes)),
    guardianFalls: r.reduce((n, x) => n + x.b1.deaths, 0), loopFalls: out(x => x.loop.deaths > 0),
    g2: FAMILIES.map(f => ({ f, minHp: family(f, x => x.h1.minHp), clear: family(f, x => x.h1.medianClear) })),
  };
}

/** The scripted guardian fight with the guardian changed (health, armour, its hits ×): the median kit's minutes at its damage rate, the range, falls. */
function guardianOption(hp: number, armor: number, hits: number, mastery: number) {
  const g = ENEMIES["guardian-statue"], was = { hp: g.hp, armor: g.armor, attacks: g.attacks };
  g.hp = hp; g.armor = armor; g.attacks = g.attacks.map(a => ({ ...a, damage: Math.round(a.damage * hits) }));
  try {
    const b = KITS.map(k => bossRowV2(k, mastery, BOSS)), rate = b.map(x => x.rateMinutes);
    const starters = ["sword-driftwood", "bow-willow", "staff-oak"].map(w => bossMinutes(w));
    return { median: med(rate), low: Math.min(...rate), high: Math.max(...rate), falls: b.reduce((n, x) => n + x.deaths, 0), starters };
  } finally { Object.assign(g, was); }
}

describe("all sixteen v2 kits on one bot (wave 5)", () => {
  it("every kit clears the normal and the sanctum runs, at mastery 1 and 20, without falling", () => {
    for (const x of rows) for (const r of [x.n1, x.h1, x.n20, x.h20]) { expect(r.clearRate, `${x.name} m${r.mastery}`).toBe(1); expect(r.deaths, x.name).toBe(0); }
  });
  it("every ult fires on the looped sanctum, and the meter fills there", () => {
    for (const x of rows) { expect(Number.isFinite(x.loop.ultFill), x.name).toBe(true); expect(x.adds, x.name).toBeGreaterThan(0); }
  });

  it("writes specs/evidence/classes/K5-balance.md when asked (WRITE_BALANCE=1)", () => {
    if (!process.env.WRITE_BALANCE) return;
    const b = band(rows), pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`, s = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} s` : "–");
    const x2 = (v: number) => `${v.toFixed(2)}×`, m = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "–"), list = (v: string[]) => (v.length ? v.join(", ") : "none");
    const options = [
      { name: "A. As built", hp: 1700, armor: 7, hits: 1 },
      { name: "B. Armour 4, health 2800, its hits ×0.75", hp: 2800, armor: 4, hits: 0.75 },
      { name: "C. Armour 4, health 3000, its hits ×0.75", hp: 3000, armor: 4, hits: 0.75 },
      { name: "D. Health 2600, its hits ×0.75 (armour 7)", hp: 2600, armor: 7, hits: 0.75 },
    ].map(o => ({ ...o, m1: guardianOption(o.hp, o.armor, o.hits, 1), m20: guardianOption(o.hp, o.armor, o.hits, 20) }));
    const doc = [
      "# Classes v2, wave 5: the all-16 balance pass",
      "",
      `Generated by \`web/lib/game/combat/classesBalance.test.ts\` (\`WRITE_BALANCE=1\`). All sixteen kits on the v2 bot (\`runV2\`, design sheet §3): level 10 and the family preset, the tier-1 signature weapon, keys through the input layer, movement riders on 30% of casts, 60% of telegraphs dodged and 30% of the rest answered with a timed skill, the ult at a full meter on two or more enemies in its area, the boss, or an elite in its area. ${SEEDS} seeds a row; the guardian ${BOSS}. The harness fixes this pass made are listed at the end.`,
      "",
      TUNING_APPLIED
        ? "**These numbers include the proposed tuning** (the commits after the measurement; \"Proposed data-only fixes\" lists each with its before and after). The measurement commit's version of this file has the families' numbers."
        : "**These are the families' numbers, before any wave-5 tuning.** The proposed fixes (below) are separate commits; with them merged, this file regenerates with their numbers.",
      "",
      "## Headline",
      "",
      `- **The all-16 median** normal-run DPS at mastery 1 is **${b.median.toFixed(1)}** (mean ${b.avg.toFixed(1)}). It replaces the interim references: today's sixteen kits' 26.8 (the Ranger, Warden and Vanguard waves) and each family's own median (Arcane ${med(rows.filter(x => x.family === "Arcane").map(x => x.n1.dps)).toFixed(1)}, Warden ${med(rows.filter(x => x.family === "Warden").map(x => x.n1.dps)).toFixed(1)}, Vanguard ${med(rows.filter(x => x.family === "Vanguard").map(x => x.n1.dps)).toFixed(1)}). The v2 kits run ${pct(b.median / 26.8 - 1)} hotter than today's.`,
      `- **Inside the band:** DPS ${x2(b.dps.low)}–${x2(b.dps.high)} the median (±25%); roles against the mean (${list(b.rolesMean)} outside); clears; the ult's fill on the sanctum (${list(b.fillHard)} outside); mastery 20 at ${x2(b.ratio20)} mastery 1's median.`,
      `- **Outside it:** the sanctum's damage-taken spread ${x2(b.spread)} (${Math.round(b.takenLow)}–${Math.round(b.takenHigh)} a minute; target 3×); tanks ${b.tanksLeast ? "take" : "don't take"} the least; what the ult adds (${list(b.adds)} outside 8–15%); mastery 20 per kit (${list(b.each20)} outside ±25% of the mastery-20 median); the guardian at ${b.guardian.toFixed(1)} minutes median (target 4–6; mastery 20 ${b.guardian20.toFixed(1)}, target 3.5–5).`,
      "",
      "## Mastery 1: damage and clears",
      "",
      "| Kit | Family | Role | Normal DPS | × median | × mean | Normal clear | Sanctum DPS | Sanctum clear | Charge |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...rows.map(x => `| ${x.name} | ${x.family} | ${x.role} | ${x.n1.dps.toFixed(1)} | ${x2(x.n1.dps / b.median)} | ${x2(x.n1.dps / b.avg)} | ${s(x.n1.medianClear)} | ${x.h1.dps.toFixed(1)} | ${s(x.h1.medianClear)} | ${x.charge} |`),
      "",
      "## Mastery 1: damage taken",
      "",
      "\"Mitigated\": the share of what reached the bot past a dodge that guard, blocks, parries, shields and absorbs kept off its health. The loop is the sanctum's four waves three times, about five minutes with no healing but the kit's own.",
      "",
      "| Kit | Role | Normal taken / min | Sanctum taken / min | Lowest HP (sanctum) | Mitigated | Loop taken / min | Loop falls (of " + SEEDS + ") |",
      "|---|---|---|---|---|---|---|---|",
      ...rows.map(x => `| ${x.name} | ${x.role} | ${Math.round(x.n1.takenPerMin)} | ${Math.round(x.h1.takenPerMin)} | ${pct(x.h1.minHp)} | ${pct(x.h1.mitigated)} | ${Math.round(x.loop.takenPerMin)} | ${x.loop.deaths} |`),
      "",
      "## Mastery 1: the ult",
      "",
      "- **Fill**: the median seconds from a press (or the start) to a full meter: on the sanctum run, projected on the normal run (100 points at its own charge rate; it ends before the meter fills), and on the loop.",
      "- **Adds (loop)**: the band's ult weight, `ultAdds`: 1 − the kit's DPS on the loop with the bot never pressing F, over its DPS with the ult. It counts everything the ult changes and charges it for its cost.",
      "- **Share (sanctum)**: every hit counted as the ult's, a sustained window's swings included (today's accounting); **uplift (sanctum)**: the ult's own hits plus what a sustained window dealt above the kit's rate. Both attribute hits on the one sanctum run, where the meter fills once, late.",
      "",
      "| Kit | Fill (sanctum) | Fill (normal, projected) | Fill (loop) | Adds (loop) | Share (sanctum) | Uplift (sanctum) |",
      "|---|---|---|---|---|---|---|",
      ...rows.map(x => `| ${x.name} | ${s(x.h1.ultFill)} | ${s(x.n1.ultFillProjected)} | ${s(x.loop.ultFill)} | ${pct(x.adds, 1)} | ${pct(x.h1.ultShare, 1)} | ${pct(x.h1.ultUplift, 1)} |`),
      "",
      "## Mastery 20 (every key, every rank, the stat direction at its top)",
      "",
      "| Kit | Normal DPS | × mastery-20 median | × its mastery 1 | Sanctum DPS | Sanctum fill |",
      "|---|---|---|---|---|---|",
      ...rows.map(x => `| ${x.name} | ${x.n20.dps.toFixed(1)} | ${x2(x.n20.dps / b.median20)} | ${x2(x.n20.dps / x.n1.dps)} | ${x.h20.dps.toFixed(1)} | ${s(x.h20.ultFill)} |`),
      "",
      `Mastery-20 median ${b.median20.toFixed(1)}: ${x2(b.ratio20)} the mastery-1 median (at most 1.2×).`,
      "",
      "## The guardian",
      "",
      `The scripted fight (bot rules plus the stagger window, 10 min limit). \"Minutes\" is the guardian's health over the damage the bot put on it a second, so a fall doesn't hide the pace; falls and clears are counted apart. \"Formula\" is the content pass's measure for the signature weapon's plain swings (27 points in its stat, half the hits land).`,
      "",
      "| Kit | Minutes (mastery 1) | Falls of " + BOSS + " | Clear time (its clears) | Ult uplift | Minutes (mastery 20) | Falls | Formula |",
      "|---|---|---|---|---|---|---|---|",
      ...rows.map(x => `| ${x.name} | ${m(x.b1.rateMinutes)} | ${x.b1.deaths} | ${Number.isFinite(x.b1.medianClear) ? `${x.b1.medianClear.toFixed(1)} min` : "–"} | ${pct(x.b1.ultUplift)} | ${m(x.b20.rateMinutes)} | ${x.b20.deaths} | ${m(x.formula)} |`),
      "",
      "Changing the guardian (the same sixteen kits; minutes at the damage rate, median and range; falls of " + KITS.length * BOSS + "; the starters' formula, sword, bow and staff):",
      "",
      "| Guardian | Mastery 1 | Falls | Mastery 20 | Falls | Formula |",
      "|---|---|---|---|---|---|",
      ...options.map(o => `| ${o.name} | ${o.m1.median.toFixed(1)} (${o.m1.low.toFixed(1)}–${o.m1.high.toFixed(1)}) | ${o.m1.falls} | ${o.m20.median.toFixed(1)} (${o.m20.low.toFixed(1)}–${o.m20.high.toFixed(1)}) | ${o.m20.falls} | ${o.m1.starters.map(v => v.toFixed(1)).join(", ")} |`),
      "",
      "## Against the band (§3), all sixteen",
      "",
      "| Target | Measure | Now | Outside |",
      "|---|---|---|---|",
      `| Normal-run DPS within ±25% of the median | the all-16 median ${b.median.toFixed(1)} | ${x2(b.dps.low)}–${x2(b.dps.high)} | ${list(b.dps.out)} |`,
      `| Roles: damage 1.00–1.20, support 0.90–1.05, tank and healer 0.80–0.95 | against the mean ${b.avg.toFixed(1)} (proposed); against the median | mean: ${b.rolesMean.length} outside; median: ${b.rolesMedian.length} outside | mean: ${list(b.rolesMean)}; median: ${list(b.rolesMedian)} |`,
      `| Sanctum damage taken, spread at most 3× | taken a minute | ${x2(b.spread)} (${Math.round(b.takenLow)}–${Math.round(b.takenHigh)}) | ${list(rows.filter(x => x.h1.takenPerMin > 3 * b.takenLow).map(x => x.name))} over 3× the lowest |`,
      `| Tanks take the least on the sanctum | | ${rows.filter(x => x.role === "tank").map(x => `${x.name} ${Math.round(x.h1.takenPerMin)}`).join(", ")}; lowest of the rest ${Math.round(Math.min(...rows.filter(x => x.role !== "tank").map(x => x.h1.takenPerMin)))} | ${b.tanksLeast ? "none" : "the tanks"} |`,
      `| No clear under 0.7× the median | normal, sanctum | ${x2(b.clearNormal)}, ${x2(b.clearHard)} | ${b.clearNormal >= 0.7 && b.clearHard >= 0.7 ? "none" : "see the clears"} |`,
      `| Ult fill 60–90 s on the sanctum (45–90 s normal) | median per kit | sanctum ${Math.round(Math.min(...rows.map(x => x.h1.ultFill)))}–${Math.round(Math.max(...rows.map(x => x.h1.ultFill)))} s; normal ${Math.round(Math.min(...rows.map(x => x.n1.ultFillProjected)))}–${Math.round(Math.max(...rows.map(x => x.n1.ultFillProjected)))} s | sanctum: ${list(b.fillHard)}; normal: ${list(b.fillNormal)} |`,
      `| Ult weight 8–15% | what the ult adds on the loop | ${pct(Math.min(...rows.map(x => x.adds)), 1)}–${pct(Math.max(...rows.map(x => x.adds)), 1)} | ${list(b.adds)} |`,
      `| Mastery 20: median at most 1.2× mastery 1's; each within ±25% of it | | ${x2(b.ratio20)}; ${x2(Math.min(...rows.map(x => x.n20.dps / b.median20)))}–${x2(Math.max(...rows.map(x => x.n20.dps / b.median20)))} | ${list(b.each20)} |`,
      `| The guardian 4–6 min (mastery 20: 3.5–5) | minutes at the damage rate, median | ${b.guardian.toFixed(1)}; ${b.guardian20.toFixed(1)} | the median; falls ${b.guardianFalls} of ${KITS.length * BOSS} |`,
      `| G2: Warden the most reliable on the sanctum, not the fastest | average lowest HP; average clear | ${b.g2.map(g => `${g.f} ${pct(g.minHp)}, ${Math.round(g.clear)} s`).join("; ")} | ${b.g2.every(g => g.f === "Warden" || g.minHp < b.g2.find(w => w.f === "Warden")!.minHp) && b.g2.some(g => g.clear < b.g2.find(w => w.f === "Warden")!.clear) ? "none" : "Warden"} |`,
      "",
      ...NARRATIVE,
    ].join("\n");
    writeFileSync(join(__dirname, "../../../../specs/evidence/classes/K5-balance.md"), doc);
  });
}, 1_200_000);

/** The prose: the band's reference, the answers to what the families left to this pass, the proposals, the harness fixes. */
const NARRATIVE = [
  "## The band's reference (Vanguard Q18)",
  "",
  "The ±25% band uses the all-16 median, as §3 says. Roles shouldn't: nine of the sixteen are damage kits, so the median always falls between the two slowest damage kits, and the slower of them sits at or under 1.00× by construction (here the Marksman, 0.99×). Against the mean every role holds its own range with the families' numbers. **Proposed:** roles against the all-16 mean, the ±25% band against the median. Against today's 26.8 (the interim reference) the damage kits read 1.1–1.2×; that reference goes with today's kits in the cleanup.",
  "",
  "## Answers to what the families left to this pass",
  "",
  "- **The ult when the bot holds for two enemies (Warden Q14, Ranger Q17, Arcane Q23).** A measurement error: the sanctum's third wave is a golem alone and its fourth ends on one, so five kits' ults went unfired (0–3% share). The bot now fires at an elite inside the ult's area too. The one sanctum run still fires one ult, late, so its share says more about where that ult lands than about the ult; the band's weight is measured on the looped sanctum instead (`ultAdds`).",
  "- **Titan's sustained-ult accounting (Vanguard Q5).** Counting every swing in a transformation's window as the ult's put Titan's baseline swings into its share, so its own hits were cut to 1.1 / 0.35 / 3.4 to stay under 15%. Measured by what it adds (the loop, ultAdds), Titan adds about 6.5% at those numbers and about 17% at the locked 3.2 / 1.0 / 9.6. **Proposed:** 2.2 / 0.7 / 7 (adds about 12%). The rule that hits in the window charge no meter stays: a 10 s form can't refill itself.",
  "- **The Juggernaut's 2% of max HP against the guardian (Vanguard Q6).** It isn't the boss killer on the shared bot: about 3 minutes at its damage rate, mid-pack (the Hunter, Sniper and Transmuter are faster). **Proposed:** keep the 2% (david-decisions #14, A).",
  "- **The damage-taken spread (Warden Q28).** With all sixteen on one bot the spread is the clones and beasts at one end (the Illusionist and the Summoner, whose decoys take the hits) and the squishy melee at the other (the Martial Artist and the Assassin, about 62 a minute, who also fall on the loop). No data-only change gets that under 3× without changing what those kits are. A question for David (specs/classes/launch-questions.md).",
  "- **The guardian's pace and the armour flattening small hits (Warden Q26, Arcane Q21).** Two fixes to the measurement first: the pace is now the guardian's health over the damage the bot put on it a second (a fall said nothing about pace and showed as 10 minutes), and the bot now dodges through the beam as it sweeps and waits out a smash ring it has left (it took every beam and walked back into rings; falls 53 → 32 of 128 before the tuning). Then the numbers: the v2 kits take about 3 minutes median (target 4–6), and the flat armour (7) turns every hit under about power 0.6 into 1, which is why the summons, totems, zones and the Priest's burns run 5–8 minutes while big-hit kits run 2. Lowering the armour narrows that; more health sets the pace. The options table above has the numbers; the choice is David's (content, not kit numbers).",
  "- **The melee falls in the guardian fight** are mostly the bot's: it doesn't go behind the guardian for the beam or kill the rune wisps first, so the Guardian, the Martial Artist and the Assassin fall in every option, even with the guardian's hits at 0.6×. The pace column is robust to it (it barely moved with the bot's fixes).",
  "",
  "## Proposed data-only fixes (separate commits; kit numbers and `ult.charge` only)",
  "",
  "| Kit | Change | Why | Measured effect |",
  "|---|---|---|---|",
  "| Juggernaut | Titan: opening slam 1.1 → 2.2, swing shockwave 0.35 → 0.7, fissure 3.4 → 7 | Adds about 6.5% on the loop (target 8–15%); answers Vanguard Q5 | Adds about 12% |",
  "| Guardian | Armour stat direction 10% → 30% at mastery 1, 25% → 45% at 20 | The parry tank took 47 a minute on the sanctum (third most) and fell in 14 of 20 loops, so its ult (7%) mostly went unfired | 33 a minute, 1 fall in 20; mitigates about 55%; its ult adds about 9% |",
  "| Druid | Vine Snare power 0.85 → 1.05, Wild Ground 0.22 → 0.3 | 0.76× the median (band floor 0.75) and 0.69× the mastery-20 median (floor 0.75) | 0.80× and 0.80× |",
  "| Illusionist | `ult.charge` 0.8 → 0.82 | Projected 91 s on the normal run (target 45–90) | About 88 s |",
  "",
  "Not changed, within the noise: the Shaman's ult adds 15.3% and the Martial Artist's 7.6% here; on two more seed sets 15.1% and 16.7%, and 10.2% and 8.6% (the Martial Artist's falls on the loop make it the noisiest).",
  "",
  "Not changed, for David (launch-questions.md): the Elementalist fills in about 56 s on the sanctum with its charge at 0.8, the floor of §1.2's 0.8–1.25 (target 60–90; Attunement is only about 2 s of it, and trimming its spells barely moves the fill); 0.75 fills in 61 s but needs the range widened. The Necromancer's and the Summoner's ults add 20–25% on the loop (the army they raise keeps the pack busy and leaves corpses for Raise Dead; about halving the skeletons' hits and bursts still leaves 19%), in band counting only their hits; the Illusionist's and the Transmuter's mastery 20 (locked numbers, david-decisions #14); the spread and the tanks rule; the guardian.",
  "",
  "## What the harness changed in this pass (balance.ts; balanceV2.test.ts has a fail-first test each)",
  "",
  "- The ult fires at an elite inside its area too (above).",
  "- The bot's keys stay off a channelled ult's mash: they were feeding the Cataclysm's notes (4–8 of 12 hit, potency about 1.05 instead of 1.3).",
  "- The bot casts pair combos: it only ever double-tapped one key, so it played the Elementalist's four solos and never Steam Veil, Fire Tornado or the four later pairs. With them the Elementalist reads 1.20× the mean (was 1.18×).",
  "- A fill is timed from the press: a channel drains the meter 5 s before its ult lands, and a drawn ult drains it as its shape resolves (the Priest's second fill wasn't timed at all).",
  "- A sustained ult's uplift (its window above the kit's rate), the per-charge weight, a projected fill for runs too short to fill, the mitigation column.",
  "- The looped sanctum and `ultAdds` (above): the band's ult weight.",
  "- The guardian fight: the pace at the damage rate, falls apart; the beam dodged through as it sweeps; smash rings waited out.",
  "- Runtime: counters only (`tally.window`, `direct`, `charged`, `aimed`); no rule changed.",
  "",
];
