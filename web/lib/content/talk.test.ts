import { describe, expect, it } from "vitest";
import { PROPOSED_RESIDENTS } from "./residentRoster";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import { validateResidentDraft } from "./residents";
import { TALK_LIMITS, fillName, parseTalkLine, pickConversation, talkFor, validateTalk } from "./talk";

describe("resident talk lines: parsing", () => {
  it("reads an expression at the start of a line and leaves the words", () => {
    expect(parseTalkLine("[happy] Oh! Hi there.")).toEqual({ text: "Oh! Hi there.", face: "happy" });
    expect(parseTalkLine("  [Surprised]   You found one?")).toEqual({ text: "You found one?", face: "surprised" });
    expect(parseTalkLine("Morning.")).toEqual({ text: "Morning.", face: null });
    // An unknown word in brackets is just words.
    expect(parseTalkLine("[wizard] Hm.")).toEqual({ text: "[wizard] Hm.", face: null });
  });

  it("puts the member's island name in, or leaves it out gracefully", () => {
    expect(fillName("Welcome back, {name}!", "Juniper")).toBe("Welcome back, Juniper!");
    expect(fillName("Welcome back, {name}!", null)).toBe("Welcome back!");
    expect(fillName("{name}! There you are.", null)).toBe("There you are.");
  });
});

describe("resident talk lines: what admins may save", () => {
  it("accepts conversations of one to four boxes with known expressions", () => {
    expect(validateTalk([["[happy] Hi!", "Club goals are coming along."], ["Tide's turning."]])).toBeNull();
    expect(validateTalk([])).toBeNull();
  });
  it("refuses anything else, saying what to fix", () => {
    expect(validateTalk("hi")).toMatch(/conversations/);
    expect(validateTalk([[]])).toMatch(/1-4/);
    expect(validateTalk([["a", "b", "c", "d", "e"]])).toMatch(/1-4/);
    expect(validateTalk([["   "]])).toMatch(/empty/);
    expect(validateTalk([["x".repeat(TALK_LIMITS.chars + 1)]])).toMatch(/200/);
    expect(validateTalk([["[wizard] Hm."]])).toMatch(/expression/);
    expect(validateTalk(Array.from({ length: TALK_LIMITS.conversations + 1 }, () => ["Hi."]))).toMatch(/12/);
  });
  it("is part of the resident draft check the server runs", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", talk: [["Hello."]] })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", talk: [["[wizard] Hm."]] }).join()).toMatch(/talk/);
  });
});

describe("resident talk lines: the loader", () => {
  const base = DEFAULT_NPC_PERSONAS[0];
  it("uses the resident's own authored conversations first", () => {
    const talk = talkFor({ ...base, talk: [["[happy] First.", "Second."]] });
    expect(talk).toEqual([[{ text: "First.", face: "happy" }, { text: "Second.", face: null }]]);
  });
  it("falls back to the proposed roster's lines by slug (a live row saved before the column existed)", () => {
    const wren = PROPOSED_RESIDENTS.find(r => r.slug === "wren")!;
    const talk = talkFor({ ...wren, talk: undefined });
    expect(talk.length).toBeGreaterThanOrEqual(2);
    expect(talk.flat().every(l => l.text.length > 0)).toBe(true);
  });
  it("then to the resident's bubble lines, one box each, then to gentle fillers", () => {
    expect(talkFor({ slug: "kit", talk: [], canned_dialogue: ["Tide's in."] })).toEqual([[{ text: "Tide's in.", face: null }]]);
    const filler = talkFor({ slug: "kit", talk: [], canned_dialogue: [] });
    expect(filler.length).toBeGreaterThan(0);
  });
  it("every proposed resident and the two seeded ones has two or three conversations of their own", () => {
    for (const r of [...PROPOSED_RESIDENTS, ...DEFAULT_NPC_PERSONAS]) {
      expect(r.talk?.length, r.slug).toBeGreaterThanOrEqual(2);
      expect(r.talk!.length, r.slug).toBeLessThanOrEqual(3);
      expect(validateTalk(r.talk), r.slug).toBeNull();
    }
  });
  it("picks a conversation by the day, then the next one each time you talk again", () => {
    const first = pickConversation(3, "wren", "2026-10-03", 0);
    expect(pickConversation(3, "wren", "2026-10-03", 0)).toBe(first);
    expect(pickConversation(3, "wren", "2026-10-03", 1)).toBe((first + 1) % 3);
    expect(pickConversation(3, "wren", "2026-10-03", 3)).toBe(first);
    expect(pickConversation(0, "wren", "2026-10-03", 0)).toBe(0);
  });
});
