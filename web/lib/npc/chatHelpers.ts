/**
 * Pure helpers extracted from /api/npc/chat for unit testing.
 *
 * Imported by the route handler; nothing else. Adding tests against these
 * gives us regression protection on the LLM-NPC integration without
 * needing the full Anthropic SDK or Supabase mocks.
 */

export const RATE_LIMIT_COUNT = 30;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const MAX_MESSAGE_LEN = 500;
export const MONTHLY_INTERACTION_CAP = 200;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PROFANITY_BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "slut",
  "whore",
  "fag",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "tranny",
  "kike",
  "spic",
  "chink",
  "gook",
] as const;

export function containsProfanity(message: string): boolean {
  const lowered = message.toLowerCase();
  return PROFANITY_BLOCKLIST.some((bad) => {
    const re = new RegExp(`\\b${bad}\\b`, "i");
    return re.test(lowered);
  });
}

export type MemoryState = {
  facts?: string[];
  last_topic?: string;
  [k: string]: unknown;
};

export type NPCPersona = {
  id: string;
  slug: string;
  display_name: string;
  persona_prompt: string | null;
  canned_dialogue: string[] | null;
  active: boolean;
};

export function buildSystemPrompt(
  persona: NPCPersona,
  memory: MemoryState,
  userName: string,
): string {
  const memorySummary =
    memory && memory.facts && memory.facts.length > 0
      ? JSON.stringify({
          facts: memory.facts,
          last_topic: memory.last_topic ?? null,
        })
      : "Nothing yet — this is your first interaction.";

  return `${persona.persona_prompt ?? ""}

The person you're talking to is named "${userName}".

What you remember about them so far:
${memorySummary}

Rules:
- Keep replies under 80 words unless asked for a story.
- Never break character. You are ${persona.display_name}.
- Don't reference other club members by name.
- After each conversation, update your memory of this person with anything new you learned (their interests, projects, mood, what they asked about).

After your reply, output a JSON block on its own line:
<memory_update>{"facts": ["fact 1", "fact 2"], "last_topic": "..."}</memory_update>`;
}

export function pickCannedDialogue(persona: NPCPersona): string {
  const lines = persona.canned_dialogue ?? [];
  if (lines.length === 0) return "I'm not feeling chatty right now.";
  return lines[Math.floor(Math.random() * lines.length)];
}

export function extractMemoryUpdate(raw: string): {
  cleaned: string;
  update: MemoryState | null;
} {
  const re = /<memory_update>([\s\S]*?)<\/memory_update>/i;
  const match = raw.match(re);
  if (!match) return { cleaned: raw.trim(), update: null };

  const cleaned = raw.replace(re, "").trim();
  try {
    const parsed = JSON.parse(match[1].trim()) as MemoryState;
    return { cleaned, update: parsed };
  } catch {
    return { cleaned, update: null };
  }
}

export function mergeMemory(
  current: MemoryState,
  update: MemoryState | null,
): MemoryState {
  if (!update) return current;
  const existingFacts = Array.isArray(current.facts) ? current.facts : [];
  const newFacts = Array.isArray(update.facts) ? update.facts : [];
  const mergedFacts = Array.from(
    new Set([...existingFacts, ...newFacts].filter((f) => typeof f === "string")),
  );
  return {
    ...current,
    facts: mergedFacts,
    last_topic:
      typeof update.last_topic === "string"
        ? update.last_topic
        : current.last_topic,
  };
}

/**
 * In-memory rate limiter factory. Pass in `now()` for deterministic
 * testing; production passes Date.now via default.
 */
export function createRateLimiter(now: () => number = () => Date.now()) {
  const map = new Map<string, { count: number; resetAt: number }>();
  return {
    check(userId: string): boolean {
      const t = now();
      const entry = map.get(userId);
      if (!entry || entry.resetAt < t) {
        map.set(userId, { count: 1, resetAt: t + RATE_LIMIT_WINDOW_MS });
        return true;
      }
      if (entry.count >= RATE_LIMIT_COUNT) return false;
      entry.count += 1;
      return true;
    },
    /** Test helper: number of users currently tracked. */
    size(): number {
      return map.size;
    },
  };
}

export function validateMessageInput(input: unknown): {
  ok: true;
  npc_id: string;
  message: string;
} | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid body" };
  const obj = input as { npc_id?: unknown; message?: unknown };
  if (typeof obj.npc_id !== "string" || !UUID_RE.test(obj.npc_id)) {
    return { ok: false, error: "Invalid npc_id" };
  }
  if (typeof obj.message !== "string") return { ok: false, error: "Invalid message" };
  const trimmed = obj.message.trim();
  if (trimmed.length === 0) return { ok: false, error: "Empty message" };
  if (trimmed.length > MAX_MESSAGE_LEN) return { ok: false, error: "Message too long" };
  return { ok: true, npc_id: obj.npc_id, message: trimmed };
}
