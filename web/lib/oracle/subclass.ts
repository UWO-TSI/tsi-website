/**
 * The Oracle's subclass suggestion (design sheet §1.11; the MBTI → subclass map LOCKED by David 2026-10-02, row 19):
 * one subclass per type, inside the type's family, each once. Within a family the temperament fixes two letters, so
 * two dichotomies choose among the four: E/I and J/P for NT and NF, E/I and T/F for SJ and SP. When either deciding
 * dichotomy's clarity is under 15%, the sheet shows the two closest ("The light flickers between …") and highlights
 * the stronger. A suggestion, never an assignment: any of the family's four can be chosen.
 */
import type { Dichotomy } from "./items";
import { familyFor, type DichotomyScore, type Family } from "./engine";

/** Type → the suggested subclass key and the keeper's reason, in plain words. */
export const SUBCLASS_FOR_TYPE: Record<string, { subclass: string; reason: string }> = {
  INTP: { subclass: "elementalist", reason: "You love the theory, and the combos it unlocks." },
  ENTP: { subclass: "illusionist", reason: "A trickster's wit: you'd rather outthink a fight than outlast it." },
  ENTJ: { subclass: "necromancer", reason: "You command. An army rises when you call it." },
  INTJ: { subclass: "transmuter", reason: "You study the enemy, then become the counter." },
  ESTJ: { subclass: "marksman", reason: "A relentless rhythm: you keep the pressure on and never break it." },
  ISTJ: { subclass: "sniper", reason: "Disciplined and precise: one shot, placed exactly." },
  ISFJ: { subclass: "hunter", reason: "Patient. You prepare the ground, and the fight comes to you." },
  ESFJ: { subclass: "gunslinger", reason: "The showman: every reload is a performance." },
  ISFP: { subclass: "guardian", reason: "A quiet protector: you stand in front so others don't have to." },
  ESFP: { subclass: "monk", reason: "In the moment, all flow: strike after strike without a pause." },
  ESTP: { subclass: "juggernaut", reason: "Bold and physical: straight through, and nothing stops you." },
  ISTP: { subclass: "assassin", reason: "A cool, precise operator: in, done, gone." },
  ENFP: { subclass: "summoner", reason: "You bring everyone along: many companions, one bond." },
  INFJ: { subclass: "shaman", reason: "You hear the spirits, and the ancestors answer." },
  INFP: { subclass: "druid", reason: "Nature and the world inside you: you grow, and you endure." },
  ENFJ: { subclass: "priest", reason: "You lift everyone up, yourself included." },
};

/** The two dichotomies that choose among a family's four (the temperament fixes the other two). */
export const DECIDING: Record<Family, [Dichotomy, Dichotomy]> = { Arcane: ["EI", "JP"], Warden: ["EI", "JP"], Ranger: ["EI", "TF"], Vanguard: ["EI", "TF"] };
export const LOW_CLARITY = 15;
const FLIP: Record<string, string> = { E: "I", I: "E", S: "N", N: "S", T: "F", F: "T", J: "P", P: "J" };
const AT: Record<Dichotomy, number> = { EI: 0, SN: 1, TF: 2, JP: 3 };

/**
 * The suggestion for a reading: the type's subclass, its keeper line and, when a deciding dichotomy's clarity is
 * under 15%, the runner-up (the type with the least clear of the two deciding letters flipped).
 */
export function suggestSubclass(type: string, dichotomies: Pick<DichotomyScore, "dichotomy" | "clarity">[] = []) {
  const t = type.toUpperCase(), s = SUBCLASS_FOR_TYPE[t];
  if (!s) return null;
  const family = familyFor(t), unclear = DECIDING[family]
    .map(d => ({ d, clarity: dichotomies.find(x => x.dichotomy === d)?.clarity ?? 100 }))
    .filter(x => x.clarity < LOW_CLARITY).sort((a, b) => a.clarity - b.clarity)[0];
  const other = unclear ? t.split("").map((c, i) => (i === AT[unclear.d] ? FLIP[c] : c)).join("") : null;
  return { type: t, family, subclass: s.subclass, reason: s.reason, pair: other ? SUBCLASS_FOR_TYPE[other].subclass : null };
}
