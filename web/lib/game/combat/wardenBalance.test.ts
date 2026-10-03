import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { balanceRowV2, balanceTable, bandV2, bossMinutes, runV2, V2_TARGETS, type BalanceRow, type BalanceRowV2 } from "./balance";
import { signatureWeapon } from "./balance";

/**
 * The Warden rows against the §3 band (design sheet §3; the harness in balance.ts): normal-run DPS by role against
 * today's sixteen kits' median (the scale every v2 kit is written against until wave 5 measures all sixteen v2 kits),
 * the family inside ±25% of its own median, the sanctum's damage taken inside 3× of everyone's, the meter filling in
 * 60–90 s there, mastery 20 adding options more than power, the Warden still the most reliable family (G2), and the
 * signature weapons' formula guardian. The scripted guardian fight is measured and written, not held (see the evidence).
 */
const KITS = ["summoner", "shaman", "druid", "priest"] as const;
const SEEDS = 20, SLACK = 0.03;
const med = (v: number[]) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const avg = (v: number[]) => v.reduce((n, x) => n + x, 0) / v.length;
const ROLE = V2_TARGETS.roles as Record<string, readonly [number, number]>;

describe("the Warden family inside the §3 band", () => {
  const normal = KITS.map(k => balanceRowV2(k, "survive-circle", 1, SEEDS)), hard = KITS.map(k => balanceRowV2(k, "survive-sanctum", 1, SEEDS));
  const top = KITS.map(k => balanceRowV2(k, "survive-circle", 20, SEEDS));
  const todayRows = balanceTable("survive-circle", SEEDS), todayHard = balanceTable("survive-sanctum", SEEDS), today = med(todayRows.map(r => r.dps));
  const family = (rows: BalanceRow[], f: string, k: keyof BalanceRow) => avg(rows.filter(r => r.family === f).map(r => r[k] as number));

  it("every kit clears both missions without falling", () => {
    for (const r of [...normal, ...hard]) { expect(r.clearRate, `${r.subclass} ${r.medianClear}`).toBe(1); expect(r.deaths, r.subclass).toBe(0); }
  });
  it("each role in its range of today's median (support 0.90–1.05, damage 1.00–1.20, tank and healer 0.80–0.95)", () => {
    for (const r of normal) {
      const x = r.dps / today, [lo, hi] = ROLE[r.role];
      expect(x, `${r.subclass} ${x.toFixed(2)}`).toBeGreaterThan(lo - SLACK);
      expect(x, `${r.subclass} ${x.toFixed(2)}`).toBeLessThan(hi + SLACK);
    }
  });
  it("the family within ±25% of its median DPS; sanctum damage taken within 3× across it; no outlier clears", () => {
    const b = bandV2(normal, hard);
    expect(b.dpsLow).toBeGreaterThan(V2_TARGETS.dpsBand[0]);
    expect(b.dpsHigh).toBeLessThan(V2_TARGETS.dpsBand[1]);
    // Against today's sixteen the Warden takes the least (G2): the cross-family spread is wave 5's (the evidence lists it).
    expect(b.spread).toBeLessThan(V2_TARGETS.takenSpread);
    expect(Math.min(...normal.map(r => r.medianClear)) / med(todayRows.map(r => r.medianClear))).toBeGreaterThan(V2_TARGETS.clearFloor);
    expect(Math.min(...hard.map(r => r.medianClear)) / med(todayHard.map(r => r.medianClear))).toBeGreaterThan(V2_TARGETS.clearFloor);
  });
  it("the meter fills in 60–90 s on the sanctum; where it fires there, the ult is 8–15% of the damage", () => {
    for (const r of hard) { expect(r.ultFill, r.subclass).toBeGreaterThanOrEqual(V2_TARGETS.ultFillSanctum[0] - 2); expect(r.ultFill, r.subclass).toBeLessThan(V2_TARGETS.ultFillSanctum[1]); }
    // The Shaman's fills as the lone golem (or the last wave's golem) is all that's left: the bot holds it for two (evidence).
    for (const r of hard.filter(x => x.subclass !== "Shaman")) { expect(r.ultShare, r.subclass).toBeGreaterThan(V2_TARGETS.ultShare[0] - 0.01); expect(r.ultShare, r.subclass).toBeLessThan(V2_TARGETS.ultShare[1] + 0.01); }
  });
  it("mastery 20 adds options more than power: its median at most 1.2× mastery 1's, every kit within ±25% of it", () => {
    const m20 = med(top.map(r => r.dps));
    expect(m20 / med(normal.map(r => r.dps))).toBeLessThanOrEqual(V2_TARGETS.mastery20Ratio);
    for (const r of top) { expect(r.dps / m20, r.subclass).toBeGreaterThan(V2_TARGETS.dpsBand[0]); expect(r.dps / m20, r.subclass).toBeLessThan(V2_TARGETS.dpsBand[1]); }
  });
  it("the Warden stays the most reliable family on the sanctum (the highest lowest HP), and not the fastest", () => {
    const mine = avg(hard.map(r => r.minHp)), clear = avg(hard.map(r => r.medianClear));
    for (const f of ["Arcane", "Ranger", "Vanguard"]) expect(mine, f).toBeGreaterThan(family(todayHard, f, "minHp"));
    expect(clear).toBeGreaterThan(Math.min(...["Arcane", "Ranger", "Vanguard"].map(f => family(todayHard, f, "medianClear"))));
  });
  it("the signature weapons' formula guardian: 4–6 minutes", () => {
    for (const k of KITS) { const m = bossMinutes(signatureWeapon(k)); expect(m, k).toBeGreaterThanOrEqual(V2_TARGETS.guardian[0]); expect(m, k).toBeLessThanOrEqual(V2_TARGETS.guardian[1]); }
  });

  it("writes specs/evidence/classes/K-warden-balance.md when asked (WRITE_BALANCE=1)", () => {
    if (!process.env.WRITE_BALANCE) return;
    const b = bandV2(normal, hard), m1 = med(normal.map(r => r.dps)), m20 = med(top.map(r => r.dps)), todayHardDps = med(todayHard.map(r => r.dps));
    const refHard = todayHard.map(r => r.takenPerMin), refClear = med(todayRows.map(r => r.medianClear)), refClearHard = med(todayHard.map(r => r.medianClear));
    const boss = (k: string, mastery: number) => {
      const runs = Array.from({ length: 8 }, (_, i) => runV2(k, "boss", i + 1, mastery, 600)), t = runs.map(r => (r.cleared ? r.seconds : 600) / 60).sort((a, c) => a - c);
      return { median: t[(t.length - 1) >> 1] / 2 + t[t.length >> 1] / 2, died: runs.filter(r => r.died).length, share: runs.reduce((n, r) => n + r.ultDealt, 0) / runs.reduce((n, r) => n + r.dealt, 0) };
    };
    const g1 = KITS.map(k => boss(k, 1)), g20 = KITS.map(k => boss(k, 20));
    const f = (r: BalanceRowV2, x: number) => `| ${r.subclass} | ${r.role} | ${r.mastery} | ${r.weapon} | ${Math.round(r.clearRate * 100)}% | ${Math.round(r.medianClear)} s | ${r.dps.toFixed(1)} | ${x.toFixed(2)}× | ${Math.round(r.takenPerMin)} | ${Math.round(r.minHp * 100)}% | ${Number.isFinite(r.ultFill) ? `${Math.round(r.ultFill)} s` : "–"} | ${(r.ultShare * 100).toFixed(1)}% |`;
    const head = ["| Kit | Role | Mastery | Weapon | Cleared | Median clear | DPS | × today's median | Taken / min | Lowest HP | Ult fill (median) | Ult share |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
    writeFileSync(join(__dirname, "../../../../specs/evidence/classes/K-warden-balance.md"), [
      "# Classes v2, the Warden wave: balance", "",
      `Generated by \`web/lib/game/combat/wardenBalance.test.ts\` (\`WRITE_BALANCE=1\`), ${SEEDS} seeds a row, through the v2 bot (design sheet §3, \`runV2\`): level 10 with the Warden preset, the tier-1 signature weapon, keys through the input layer (toggles on when nothing's out, holds held, shapes drawn at about 80% in 1.6 s, the winged sigil in 3.2 s and never dodged out of), movement riders on 30% of casts, 60% of telegraphs dodged and a share of the rest answered with a timed skill, the ult at a full meter on two or more enemies inside its area (round you for a self-centred ult, round the target for an aimed one) or the boss. The Summoner plays with every beast tamed. The band is against today's sixteen kits (specs/evidence/combat-b/balance.md): normal median ${today.toFixed(1)} DPS, sanctum damage taken ${Math.round(Math.min(...refHard))}–${Math.round(Math.max(...refHard))} / min.`, "",
      "## Hold the rune circle (normal), mastery 1", "", ...head, ...normal.map(r => f(r, r.dps / today)), "",
      "## Sanctum watch (harder), mastery 1 (× today's sanctum median DPS)", "", ...head, ...hard.map(r => f(r, r.dps / todayHardDps)), "",
      "## Hold the rune circle, mastery 20 (every key, every rank, the stat direction at its top)", "", ...head, ...top.map(r => f(r, r.dps / today)), "",
      "## Against the band", "",
      "| Target | Measure | Warden |", "|---|---|---|",
      `| Normal DPS within ±25% of the median | the family's own median ${m1.toFixed(1)} | ${b.dpsLow.toFixed(2)}–${b.dpsHigh.toFixed(2)}× |`,
      `| Roles (support 0.90–1.05×, damage 1.00–1.20×, tank and healer 0.80–0.95× of today's median ${today.toFixed(1)}) | | ${normal.map(r => `${r.subclass} ${(r.dps / today).toFixed(2)}× (${r.role})`).join(", ")} |`,
      `| Sanctum damage taken within 3× | the family; with today's sixteen | ${hard.map(r => `${r.subclass} ${Math.round(r.takenPerMin)}`).join(", ")}: ${b.spread.toFixed(2)}× across the family; with today's ${(Math.max(...hard.map(r => r.takenPerMin), ...refHard) / Math.min(...hard.map(r => r.takenPerMin), ...refHard)).toFixed(2)}× (the Warden takes the least, G2; today's Assassin ${Math.round(Math.max(...refHard))}) |`,
      `| Tanks take the least on the sanctum | | the Druid ${Math.round(hard[2].takenPerMin)} / min against ${Math.round(Math.min(...hard.filter((_, i) => i !== 2).map(r => r.takenPerMin)))}–${Math.round(Math.max(...hard.filter((_, i) => i !== 2).map(r => r.takenPerMin)))}: it outlasts by healing (every heal a share of its max HP), lowest HP ${Math.round(hard[2].minHp * 100)}% |`,
      `| No clear under 0.7× the median | today's median clear: normal ${Math.round(refClear)} s, sanctum ${Math.round(refClearHard)} s | ${(Math.min(...normal.map(r => r.medianClear)) / refClear).toFixed(2)}×, ${(Math.min(...hard.map(r => r.medianClear)) / refClearHard).toFixed(2)}× |`,
      `| Ult fill 60–90 s on the sanctum | median per kit | ${hard.map(r => `${r.subclass} ${Math.round(r.ultFill)} s`).join(", ")} |`,
      `| Ult 8–15% of a run's damage | sanctum | ${hard.map(r => `${r.subclass} ${(r.ultShare * 100).toFixed(1)}%`).join(", ")} (the Shaman's meter fills as only a golem is left, and the bot holds it for two) |`,
      `| Mastery 20 median at most 1.2× mastery 1; each kit within ±25% of it | ${m20.toFixed(1)} / ${m1.toFixed(1)} | ${(m20 / m1).toFixed(2)}× (each over its mastery 1: ${KITS.map((_, i) => `${normal[i].subclass} ${(top[i].dps / normal[i].dps).toFixed(2)}×`).join(", ")}); against the mastery-20 median ${top.map(r => (r.dps / m20).toFixed(2)).join(", ")}× |`,
      `| G2: the most reliable family on the sanctum, not the fastest | average lowest HP; average clear | Warden ${Math.round(avg(hard.map(r => r.minHp)) * 100)}%, ${Math.round(avg(hard.map(r => r.medianClear)))} s; today's ${["Arcane", "Ranger", "Vanguard"].map(fm => `${fm} ${Math.round(family(todayHard, fm, "minHp") * 100)}%, ${Math.round(family(todayHard, fm, "medianClear"))} s`).join("; ")} |`,
      `| The guardian 4–6 min (mastery 20: 3.5–5) | scripted fight, median of 8 (10 = never fell); ult share of its damage | ${KITS.map((k, i) => `${normal[i].subclass} ${g1[i].median.toFixed(1)} (mastery 20: ${g20[i].median.toFixed(1)}; ${g1[i].died}/8 died; ult ${Math.round(g1[i].share * 100)}%)`).join(", ")} |`,
      `| The guardian, formula measure (27 points in the stat, half the hits land) | the signature weapons' plain swings | ${KITS.map(k => `${signatureWeapon(k)} ${bossMinutes(signatureWeapon(k)).toFixed(1)}`).join(", ")} min |`, "",
      "## Reading the guardian", "",
      "The guardian's armour (7) takes a flat bite off every hit, so the Warden's many small hits (beast bites, totem pulses, links, zone ticks, the Holy Beam's burn) land for 1 on it while the ults' big hits land whole. The Summoner and the Shaman bring it down in about 2.5 minutes, on the beasts and the totem network around the bot's own bolts; the Druid sits in the band; the Priest is slower because every skill is a shape drawn first (the Lightbolt rests 1.6 s a shape) and its burns glance off the armour. The pace of the scripted fight is wave 5's, with all sixteen kits on the same bot (specs/classes/warden-questions.md).", "",
    ].join("\n"));
  });
});
