import { describe, expect, it } from "vitest";
import { memoryIdentityStore } from "@/lib/identity/memoryStore";
import { DICHOTOMIES, familyFor, FIRST, itemOrder, keeperBeat, rawScores, score, tiedDichotomies, type Answers } from "./engine";
import { STATEMENTS, TIE_BREAKERS } from "./items";
import { RESPEC_FEE_COINS, startDecision } from "./retake";
import { answerBatch, finishReading, oracleStatus, startReading } from "./service";

const M = "00000000-0000-4000-8000-0000000000aa";
const now = new Date("2026-09-24T16:00:00Z");

/** Answer so that each dichotomy leans toward the given letter by `strength` (±2 on every item). */
function answersFor(type: string, strength = 2): Answers {
  const out: Answers = {};
  for (const s of STATEMENTS) {
    const want = type[DICHOTOMIES.indexOf(s.dichotomy)];
    out[s.id] = s.pole === want ? strength : -strength;
  }
  return out;
}
const neutral = (): Answers => Object.fromEntries(STATEMENTS.map((s) => [s.id, 0]));

describe("item bank", () => {
  it("has 64 authored statements, 16 per dichotomy, balanced keying, plus 4 tie-breakers each", () => {
    expect(STATEMENTS).toHaveLength(64);
    for (const d of DICHOTOMIES) {
      const items = STATEMENTS.filter((s) => s.dichotomy === d);
      expect(items).toHaveLength(16);
      expect(items.filter((s) => s.pole === FIRST[d])).toHaveLength(8);
      expect(TIE_BREAKERS.filter((t) => t.dichotomy === d)).toHaveLength(4);
    }
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(64);
    expect(new Set(STATEMENTS.map((s) => s.text)).size).toBe(64);
  });
});

describe("scoring", () => {
  it("recovers every one of the 16 types and maps the family (row 19)", () => {
    const families: Record<string, string> = {};
    for (const e of "EI") for (const sn of "SN") for (const tf of "TF") for (const jp of "JP") {
      const type = `${e}${sn}${tf}${jp}`;
      const r = score(answersFor(type));
      expect(r.type).toBe(type);
      expect(r.dichotomies.every((d) => d.clarity === 100 && d.decided_by === "items")).toBe(true);
      families[type] = r.family;
    }
    expect([families.INTJ, families.ENTP, families.ISTJ, families.ESFJ, families.ISTP, families.ESFP, families.INFJ, families.ENFP]).toEqual(["Arcane", "Arcane", "Ranger", "Ranger", "Vanguard", "Vanguard", "Warden", "Warden"]);
    expect(familyFor("estp")).toBe("Vanguard");
  });
  it("reverse-scores items keyed to the second pole", () => {
    const one = STATEMENTS.find((s) => s.id === "ei02")!; // keyed I
    expect(rawScores({ [one.id]: 2 }).EI).toBe(-2);
    expect(rawScores({ ei01: 2 }).EI).toBe(2);
  });
  it("uses tie-breakers only for exactly tied dichotomies", () => {
    const a = answersFor("ENTJ", 1);
    for (const s of STATEMENTS.filter((x) => x.dichotomy === "TF")) a[s.id] = 0; // TF tied
    expect(tiedDichotomies(a)).toEqual(["TF"]);
    expect(score(a, { "tf-t1": "F", "tf-t2": "F", "tf-t3": "T" })).toMatchObject({ type: "ENFJ", family: "Warden" });
    expect(score(a, { "tf-t1": "F", "tf-t2": "F", "tf-t3": "T" }).dichotomies[2]).toMatchObject({ decided_by: "tie_breaker", clarity: 0 });
  });
  it("falls back to the single strongest answer, then to I/N/F/P with low clarity", () => {
    const a = neutral();
    a.sn03 = 2; // S-keyed, strong
    a.sn02 = 1; // N-keyed, weaker → SN sum = 2 - 1 = 1 → S by items
    expect(score(a).dichotomies[1]).toMatchObject({ letter: "S", decided_by: "items" });
    const b = neutral();
    b.jp01 = 2; // J, strong
    b.jp02 = 2; // P, strong → tie; strongest: first in bank order among equals (jp01) → J
    expect(score(b).dichotomies[3]).toMatchObject({ letter: "J", decided_by: "strongest_answer" });
    const c = score(neutral());
    expect(c).toMatchObject({ type: "INFP", family: "Warden", low_clarity: true });
    expect(c.dichotomies.every((d) => d.decided_by === "default")).toBe(true);
  });
  it("ignores unknown items and out-of-range values", () => {
    expect(rawScores({ nope: 2, ei01: 3, ei03: 1.5, ei05: 2 } as Answers).EI).toBe(2);
  });
  it("serves a deterministic, interleaved order and a keeper beat every 10 answers", () => {
    const o = itemOrder("seed-1");
    expect(o).toEqual(itemOrder("seed-1"));
    expect(o).not.toEqual(itemOrder("seed-2"));
    expect(new Set(o).size).toBe(64);
    for (let i = 0; i < 64; i += 4) expect(new Set(o.slice(i, i + 4).map((id) => id.slice(0, 2))).size).toBe(4);
    expect([keeperBeat(9, 64), keeperBeat(10, 64), keeperBeat(60, 64), keeperBeat(64, 64)]).toEqual([null, 1, 6, null]);
  });
});

describe("retake rules", () => {
  it("first reading free, resume open ones, respec for a fee after the cooldown", () => {
    expect(startDecision({ openAttemptId: null, lastResultAt: null, now })).toEqual({ kind: "free" });
    expect(startDecision({ openAttemptId: "a1", lastResultAt: "2026-01-01T00:00:00Z", now })).toEqual({ kind: "resume", attemptId: "a1" });
    expect(startDecision({ openAttemptId: null, lastResultAt: "2026-09-20T00:00:00Z", now })).toMatchObject({ kind: "cooldown" });
    expect(startDecision({ openAttemptId: null, lastResultAt: "2026-09-01T00:00:00Z", now })).toEqual({ kind: "respec", fee: RESPEC_FEE_COINS });
  });
  it("runs a full reading, then a paid respec that keeps the first aura", async () => {
    let clock = now;
    const m = memoryIdentityStore(() => clock);
    const s = await startReading(m.store, M, "start-0001", now);
    expect(s).toMatchObject({ ok: true, data: { total: 64, fee_paid: 0, resumed: false } });
    const id = s.ok ? s.data.attempt_id : "";
    expect(await startReading(m.store, M, "start-0002", now)).toMatchObject({ ok: true, data: { attempt_id: id, resumed: true } });
    const a = answersFor("INTP");
    const ids = Object.keys(a);
    for (let i = 0; i < 60; i += 10) await answerBatch(m.store, M, id, ids.slice(i, i + 10).map((k) => ({ item_id: k, value: a[k] })));
    expect(await finishReading(m.store, M, id, undefined)).toMatchObject({ ok: false, code: "incomplete" });
    expect(await answerBatch(m.store, M, id, [{ item_id: "ei01", value: 5 }])).toMatchObject({ ok: false, code: "bad_answer" });
    expect(await answerBatch(m.store, M, id, ids.slice(60).map((k) => ({ item_id: k, value: a[k] })))).toMatchObject({ ok: true, data: { answered: 64 } });
    expect(await finishReading(m.store, M, id, undefined)).toMatchObject({ ok: true, data: { status: "done", type: "INTP", family: "Arcane", color: "purple", aura_new: true, previous_family: null } });
    expect(await startReading(m.store, M, "start-0003", now)).toMatchObject({ ok: false, code: "cooldown" });
    const later = new Date(now.getTime() + 8 * 86_400_000);
    clock = later;
    expect(await startReading(m.store, M, "start-0004", later)).toMatchObject({ ok: false, code: "insufficient" });
    m.fund(M, 300);
    const r = await startReading(m.store, M, "start-0005", later);
    expect(r).toMatchObject({ ok: true, data: { fee_paid: 250 } });
    expect(m.coinsOf(M)).toBe(50);
    const rid = r.ok ? r.data.attempt_id : "";
    const b = answersFor("ESFJ");
    await answerBatch(m.store, M, rid, Object.entries(b).map(([k, v]) => ({ item_id: k, value: v })));
    expect(await finishReading(m.store, M, rid, undefined)).toMatchObject({ ok: true, data: { family: "Ranger", previous_family: "Arcane" } });
    expect(m.respecs).toEqual([{ member: M, from: "Arcane", to: "Ranger", fee: 250 }]);
    const st = await oracleStatus(m.store, M, later);
    expect(st.ok && st.data.auras.sort()).toEqual(["Arcane", "Ranger"]);
  });
  it("asks for tie-breakers when a dichotomy is exactly even", async () => {
    const m = memoryIdentityStore(() => now);
    const s = await startReading(m.store, M, "start-0010", now);
    const id = s.ok ? s.data.attempt_id : "";
    const a = answersFor("ISTJ");
    for (const st of STATEMENTS.filter((x) => x.dichotomy === "EI")) a[st.id] = 0;
    await answerBatch(m.store, M, id, Object.entries(a).map(([k, v]) => ({ item_id: k, value: v })));
    const first = await finishReading(m.store, M, id, undefined);
    expect(first.ok && first.data.status === "needs_tie_breakers" && first.data.tie_breakers.map((t) => t.id)).toEqual(["ei-t1", "ei-t2", "ei-t3", "ei-t4"]);
    expect(await finishReading(m.store, M, id, { "ei-t1": "E", "ei-t2": "E", "ei-t3": "I", "ei-t4": "E" })).toMatchObject({ ok: true, data: { type: "ESTJ", family: "Ranger" } });
  });
});
