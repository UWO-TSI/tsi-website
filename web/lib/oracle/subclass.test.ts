import { describe, expect, it } from "vitest";
import { SUBCLASSES } from "@/lib/combat/kits";
import { familyFor } from "./engine";
import { DECIDING, SUBCLASS_FOR_TYPE, suggestSubclass } from "./subclass";

const TYPES = ["E", "I"].flatMap(a => ["S", "N"].flatMap(b => ["T", "F"].flatMap(c => ["J", "P"].map(d => a + b + c + d))));

describe("the Oracle's subclass suggestion (the LOCKED MBTI map, row 19)", () => {
  it("maps all 16 types, each to one subclass inside its family, every subclass exactly once", () => {
    expect(Object.keys(SUBCLASS_FOR_TYPE).sort()).toEqual([...TYPES].sort());
    const picked = TYPES.map(t => SUBCLASS_FOR_TYPE[t].subclass);
    expect(new Set(picked).size).toBe(16);
    expect([...picked].sort()).toEqual(SUBCLASSES.map(s => s.key).sort());
    for (const t of TYPES) expect(SUBCLASSES.find(s => s.key === SUBCLASS_FOR_TYPE[t].subclass)!.family, t).toBe(familyFor(t));
  });
  it("matches the locked table", () => {
    const want = { INTP: "elementalist", ENTP: "illusionist", ENTJ: "necromancer", INTJ: "transmuter", ESTJ: "marksman", ISTJ: "sniper", ISFJ: "hunter", ESFJ: "gunslinger",
      ISFP: "guardian", ESFP: "monk", ESTP: "juggernaut", ISTP: "assassin", ENFP: "summoner", INFJ: "shaman", INFP: "druid", ENFJ: "priest" };
    for (const [t, s] of Object.entries(want)) expect(SUBCLASS_FOR_TYPE[t].subclass).toBe(s);
  });
  it("chooses within a family on the two deciding dichotomies (E/I with J/P for N types, with T/F for S types)", () => {
    for (const t of TYPES) {
      const fam = familyFor(t), [a, b] = DECIDING[fam];
      const inFamily = TYPES.filter(x => familyFor(x) === fam);
      expect(inFamily).toHaveLength(4);
      expect(new Set(inFamily.map(x => x["EISNTFJP".indexOf(a[0]) >> 1] + x["EISNTFJP".indexOf(b[0]) >> 1])).size).toBe(4);
    }
  });
  it("shows the two closest when a deciding dichotomy is under 15% clear, the stronger first", () => {
    expect(suggestSubclass("INTP")).toMatchObject({ subclass: "elementalist", pair: null, family: "Arcane" });
    expect(suggestSubclass("intp", [{ dichotomy: "EI", clarity: 40 }, { dichotomy: "JP", clarity: 8 }])).toMatchObject({ subclass: "elementalist", pair: "transmuter" });
    expect(suggestSubclass("INTP", [{ dichotomy: "EI", clarity: 5 }, { dichotomy: "JP", clarity: 8 }])).toMatchObject({ pair: "illusionist" }); // the least clear flips
    expect(suggestSubclass("ISFJ", [{ dichotomy: "TF", clarity: 3 }, { dichotomy: "JP", clarity: 1 }])).toMatchObject({ subclass: "hunter", pair: "sniper" }); // J/P doesn't decide for SJ
    expect(suggestSubclass("XXXX")).toBeNull();
  });
});
