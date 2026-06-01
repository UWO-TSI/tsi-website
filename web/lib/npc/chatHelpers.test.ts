import { describe, it, expect } from "vitest";
import {
  containsProfanity,
  extractMemoryUpdate,
  mergeMemory,
  pickCannedDialogue,
  buildSystemPrompt,
  createRateLimiter,
  validateMessageInput,
  RATE_LIMIT_COUNT,
  RATE_LIMIT_WINDOW_MS,
  MAX_MESSAGE_LEN,
  type NPCPersona,
} from "./chatHelpers";

const personaFixture: NPCPersona = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "mayor",
  display_name: "Mayor Eliza",
  persona_prompt: "You are Mayor Eliza, warm club historian.",
  canned_dialogue: ["Welcome to TSI.", "Hello there.", "Good to see you."],
  active: true,
};

describe("containsProfanity", () => {
  it("flags exact-match profanity", () => {
    expect(containsProfanity("you are an asshole")).toBe(true);
  });
  it("flags case-insensitive", () => {
    expect(containsProfanity("WHAT THE FUCK")).toBe(true);
  });
  it("does not flag clean text", () => {
    expect(containsProfanity("hello mayor, how are you today")).toBe(false);
  });
  it("does not flag substrings (word-boundary)", () => {
    // 'class' contains 'ass' but ass is not in the blocklist; 'asshole' is.
    // 'hello' contains 'ell' — should not match anything.
    expect(containsProfanity("class is in session")).toBe(false);
    expect(containsProfanity("Scunthorpe is a place")).toBe(false); // 'cunt' is in the word but bounded by letters
  });
  it("handles empty string", () => {
    expect(containsProfanity("")).toBe(false);
  });
});

describe("extractMemoryUpdate", () => {
  it("strips a valid memory block and returns parsed update", () => {
    const raw = `Of course I remember you, David.
<memory_update>{"facts": ["studies CS", "likes React"], "last_topic": "React project"}</memory_update>`;
    const { cleaned, update } = extractMemoryUpdate(raw);
    expect(cleaned).toBe("Of course I remember you, David.");
    expect(update?.facts).toEqual(["studies CS", "likes React"]);
    expect(update?.last_topic).toBe("React project");
  });

  it("returns null update when no block present", () => {
    const { cleaned, update } = extractMemoryUpdate("Hello there.");
    expect(cleaned).toBe("Hello there.");
    expect(update).toBeNull();
  });

  it("strips block but returns null update on invalid JSON", () => {
    const raw = `Hi.
<memory_update>not valid json</memory_update>`;
    const { cleaned, update } = extractMemoryUpdate(raw);
    expect(cleaned).toBe("Hi.");
    expect(update).toBeNull();
  });

  it("handles block at start of reply", () => {
    const raw = `<memory_update>{"facts": []}</memory_update>
The rest of the reply.`;
    const { cleaned, update } = extractMemoryUpdate(raw);
    expect(cleaned).toBe("The rest of the reply.");
    expect(update?.facts).toEqual([]);
  });

  it("handles multi-line content inside the block", () => {
    const raw = `Hi.
<memory_update>
{"facts": ["a", "b"], "last_topic": "x"}
</memory_update>`;
    const { update } = extractMemoryUpdate(raw);
    expect(update?.facts).toEqual(["a", "b"]);
  });
});

describe("mergeMemory", () => {
  it("returns current when update is null", () => {
    const current = { facts: ["a"], last_topic: "x" };
    expect(mergeMemory(current, null)).toEqual(current);
  });

  it("deduplicates facts when merging", () => {
    const current = { facts: ["studies CS", "likes React"], last_topic: "x" };
    const update = { facts: ["likes React", "lives in Toronto"], last_topic: "y" };
    const merged = mergeMemory(current, update);
    expect(merged.facts).toEqual([
      "studies CS",
      "likes React",
      "lives in Toronto",
    ]);
    expect(merged.last_topic).toBe("y");
  });

  it("preserves current last_topic when update has no last_topic", () => {
    const current = { facts: [], last_topic: "old" };
    const update = { facts: ["new fact"] };
    expect(mergeMemory(current, update).last_topic).toBe("old");
  });

  it("filters out non-string facts", () => {
    const current = { facts: ["valid"] };
    // Bypass type system to test runtime resilience to bad input
    const update = { facts: ["new", 42, null] as unknown as string[] };
    expect(mergeMemory(current, update).facts).toEqual(["valid", "new"]);
  });

  it("handles missing facts arrays on either side", () => {
    expect(mergeMemory({}, { facts: ["a"] }).facts).toEqual(["a"]);
    expect(mergeMemory({ facts: ["a"] }, {}).facts).toEqual(["a"]);
  });
});

describe("pickCannedDialogue", () => {
  it("returns a fallback when no canned lines", () => {
    const p = { ...personaFixture, canned_dialogue: [] };
    expect(pickCannedDialogue(p)).toMatch(/not feeling chatty/i);
  });
  it("returns a fallback when canned_dialogue is null", () => {
    const p = { ...personaFixture, canned_dialogue: null };
    expect(pickCannedDialogue(p)).toMatch(/not feeling chatty/i);
  });
  it("returns one of the canned lines", () => {
    const line = pickCannedDialogue(personaFixture);
    expect(personaFixture.canned_dialogue).toContain(line);
  });
});

describe("buildSystemPrompt", () => {
  it("includes the persona prompt + display name + user name", () => {
    const prompt = buildSystemPrompt(personaFixture, {}, "David");
    expect(prompt).toContain("Mayor Eliza, warm club historian");
    expect(prompt).toContain('named "David"');
    expect(prompt).toContain("You are Mayor Eliza");
  });

  it("shows 'Nothing yet' summary when memory is empty", () => {
    const prompt = buildSystemPrompt(personaFixture, {}, "David");
    expect(prompt).toContain("Nothing yet");
  });

  it("includes existing memory facts when present", () => {
    const memory = { facts: ["studies CS"], last_topic: "React" };
    const prompt = buildSystemPrompt(personaFixture, memory, "David");
    expect(prompt).toContain("studies CS");
    expect(prompt).toContain("React");
  });

  it("includes the memory_update output instruction", () => {
    expect(buildSystemPrompt(personaFixture, {}, "x")).toContain(
      "<memory_update>",
    );
  });
});

describe("createRateLimiter", () => {
  it("allows up to RATE_LIMIT_COUNT messages in a window", () => {
    let now = 1000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < RATE_LIMIT_COUNT; i++) {
      expect(limiter.check("user1")).toBe(true);
    }
    expect(limiter.check("user1")).toBe(false);
  });

  it("resets after the window expires", () => {
    let now = 1000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < RATE_LIMIT_COUNT; i++) limiter.check("user1");
    expect(limiter.check("user1")).toBe(false);
    now += RATE_LIMIT_WINDOW_MS + 1;
    expect(limiter.check("user1")).toBe(true);
  });

  it("tracks users independently", () => {
    let now = 1000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < RATE_LIMIT_COUNT; i++) limiter.check("user1");
    expect(limiter.check("user1")).toBe(false);
    expect(limiter.check("user2")).toBe(true);
    expect(limiter.size()).toBe(2);
  });
});

describe("validateMessageInput", () => {
  const validId = "00000000-0000-0000-0000-000000000001";

  it("accepts a valid UUID + message", () => {
    const res = validateMessageInput({ npc_id: validId, message: "hello" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.message).toBe("hello");
  });

  it("trims whitespace", () => {
    const res = validateMessageInput({ npc_id: validId, message: "  hi  " });
    if (res.ok) expect(res.message).toBe("hi");
    else throw new Error("expected ok");
  });

  it("rejects empty / whitespace-only", () => {
    expect(
      validateMessageInput({ npc_id: validId, message: "   " }).ok,
    ).toBe(false);
  });

  it("rejects non-UUID npc_id", () => {
    expect(
      validateMessageInput({ npc_id: "not-a-uuid", message: "hi" }).ok,
    ).toBe(false);
  });

  it("rejects over-long messages", () => {
    const tooLong = "a".repeat(MAX_MESSAGE_LEN + 1);
    expect(
      validateMessageInput({ npc_id: validId, message: tooLong }).ok,
    ).toBe(false);
  });

  it("rejects non-object body", () => {
    expect(validateMessageInput(null).ok).toBe(false);
    expect(validateMessageInput("hi").ok).toBe(false);
    expect(validateMessageInput(undefined).ok).toBe(false);
  });

  it("rejects missing message field", () => {
    expect(validateMessageInput({ npc_id: validId }).ok).toBe(false);
  });
});
