import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  containsProfanity,
  extractMemoryUpdate,
  mergeMemory,
  pickCannedDialogue,
  buildSystemPrompt,
  createRateLimiter,
  validateMessageInput,
  MONTHLY_INTERACTION_CAP,
  type MemoryState,
  type NPCPersona,
} from "@/lib/npc/chatHelpers";

// ─── Config ─────────────────────────────────────────────────────────────────
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 250;

// Module-singleton rate limiter shared across requests. Tested separately
// in chatHelpers.test.ts; production uses the default Date.now clock.
const rateLimiter = createRateLimiter();

export async function POST(request: Request) {
  // 1. Parse + validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateMessageInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { npc_id: npcId, message } = parsed;

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
  if (!rateLimiter.check(user.id)) {
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
