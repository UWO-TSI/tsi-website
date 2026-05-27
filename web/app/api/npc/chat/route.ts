import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Config ─────────────────────────────────────────────────────────────────
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 250;
const MAX_MESSAGE_LEN = 500;
const RATE_LIMIT_COUNT = 30;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MONTHLY_INTERACTION_CAP = 200;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tiny manually-curated profanity guard — caught at the door, never sent to
// Claude. Not a substitute for proper moderation; pair with admin transcript
// review (D6). Keep lowercase; messages are lowercased for compare.
const PROFANITY_BLOCKLIST = [
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
];

// In-memory rate limit resets per server-instance. Upgrade to Redis if abuse
// appears.
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimits.get(userId);
  if (!entry || entry.resetAt < now) {
    userRateLimits.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }
  if (entry.count >= RATE_LIMIT_COUNT) return false;
  entry.count += 1;
  return true;
}

function containsProfanity(message: string): boolean {
  const lowered = message.toLowerCase();
  return PROFANITY_BLOCKLIST.some((bad) => {
    const re = new RegExp(`\\b${bad}\\b`, "i");
    return re.test(lowered);
  });
}

type MemoryState = {
  facts?: string[];
  last_topic?: string;
  [k: string]: unknown;
};

type NPCPersona = {
  id: string;
  slug: string;
  display_name: string;
  persona_prompt: string | null;
  canned_dialogue: string[] | null;
  active: boolean;
};

function buildSystemPrompt(
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

function pickCannedDialogue(persona: NPCPersona): string {
  const lines = persona.canned_dialogue ?? [];
  if (lines.length === 0) return "I'm not feeling chatty right now.";
  return lines[Math.floor(Math.random() * lines.length)];
}

function extractMemoryUpdate(raw: string): {
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

function mergeMemory(
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

export async function POST(request: Request) {
  // 1. Parse + validate input
  let body: { npc_id?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const npcId = typeof body.npc_id === "string" ? body.npc_id.trim() : "";
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.trim().slice(0, MAX_MESSAGE_LEN);

  if (!UUID_RE.test(npcId)) {
    return NextResponse.json({ error: "Invalid npc_id" }, { status: 400 });
  }
  if (message.length === 0) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (containsProfanity(message)) {
    return NextResponse.json(
      { error: "Please keep messages respectful." },
      { status: 400 },
    );
  }

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many messages — please wait a few minutes." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  // 4. Load NPC persona + user display_name
  const [{ data: persona, error: personaError }, { data: profile }] =
    await Promise.all([
      admin
        .from("npc_personas")
        .select("id, slug, display_name, persona_prompt, canned_dialogue, active")
        .eq("id", npcId)
        .eq("active", true)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (personaError || !persona) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  const userDisplayName =
    (profile?.display_name as string | undefined) ?? "Friend";

  // 5. Load memory state
  const { data: memoryRow } = await admin
    .from("npc_memories")
    .select("memory_state, interaction_count")
    .eq("npc_id", npcId)
    .eq("user_id", user.id)
    .maybeSingle();

  const currentMemory: MemoryState =
    (memoryRow?.memory_state as MemoryState | null) ?? {};

  // 6. Monthly budget guard — fall back to canned reply if exceeded.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: monthlyCount } = await admin
    .from("npc_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());

  if ((monthlyCount ?? 0) > MONTHLY_INTERACTION_CAP) {
    const fallback = pickCannedDialogue(persona as NPCPersona);
    await admin.from("npc_conversations").insert({
      npc_id: npcId,
      user_id: user.id,
      user_message: message,
      npc_response: fallback,
      tokens_in: 0,
      tokens_out: 0,
    });
    return NextResponse.json({ reply: fallback, thinking_ms: 0 });
  }

  // 7. Call Claude Haiku
  let cleanedReply: string;
  let thinkingMs = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let memoryUpdate: MemoryState | null = null;
  let apiOk = false;

  try {
    const client = new Anthropic();
    const startMs = Date.now();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(
        persona as NPCPersona,
        currentMemory,
        userDisplayName,
      ),
      messages: [{ role: "user", content: message }],
    });
    thinkingMs = Date.now() - startMs;

    const textBlock = response.content.find((b) => b.type === "text");
    const rawReply =
      textBlock && textBlock.type === "text" ? textBlock.text : "";

    const extracted = extractMemoryUpdate(rawReply);
    cleanedReply = extracted.cleaned;
    memoryUpdate = extracted.update;
    tokensIn = response.usage?.input_tokens ?? 0;
    tokensOut = response.usage?.output_tokens ?? 0;
    apiOk = true;
  } catch (err) {
    console.error("[npc/chat] Anthropic API error:", err);
    cleanedReply = pickCannedDialogue(persona as NPCPersona);
    thinkingMs = 0;
    tokensIn = 0;
    tokensOut = 0;
  }

  // 8. Upsert memory (only if API call succeeded — preserve memory on fallback)
  if (apiOk) {
    const mergedMemory = mergeMemory(currentMemory, memoryUpdate);
    const previousCount = memoryRow?.interaction_count ?? 0;
    await admin.from("npc_memories").upsert(
      {
        npc_id: npcId,
        user_id: user.id,
        memory_state: mergedMemory,
        last_interaction_at: new Date().toISOString(),
        interaction_count: previousCount + 1,
      },
      { onConflict: "npc_id,user_id" },
    );
  }

  // 9. Log conversation
  await admin.from("npc_conversations").insert({
    npc_id: npcId,
    user_id: user.id,
    user_message: message,
    npc_response: cleanedReply,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  });

  // 10. Return
  return NextResponse.json({ reply: cleanedReply, thinking_ms: thinkingMs });
}
