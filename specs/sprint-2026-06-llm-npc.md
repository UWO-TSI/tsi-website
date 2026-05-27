# Sprint: LLM-Driven NPC Implementation

> **Goal:** NPCs become actual characters — Claude Haiku-driven, with persistent per-NPC × per-user memory. Walk up to Mayor Eliza, have a conversation, leave, come back next week, she remembers what you talked about.
> **Why:** The community pitch. AI NPCs that remember individual members is the Tethos AI flex — the kind of thing a tech club shows off.
> **Sprint window:** 2026-06-23 → ~2026-07-13 (~3 weeks)
> **Owner:** `build` agent. Reviewer: David.
> **Foundation already shipped:** Content pipeline (sprint B), admin tooling (sprint C). `npc_personas` table has persona_prompt + canned_dialogue columns from migration 014. Admins can now write personas via UI (C1).

---

## Why this sprint is unblocked

Three preconditions for LLM-NPCs were defined in `specs/llm-npc-system.md`:

1. ✅ **Content pipeline architecture** — sprint B (migration 014, SWR hooks, draft/preview/publish flow)
2. ✅ **Admin tooling for writing personas** — sprint C1 (NPCEditor with persona_prompt field, draft/preview/publish workflow)
3. ❌ **NPC sprites** — Nano Banana generation has not happened. **This sprint will ship with placeholder sprites** (procedural colored quads or one of the existing free sprite packs from `specs/asset-stack.md`). Real sprites land in a parallel workstream David handles.

Sprite placeholder strategy keeps the LLM logic + memory system + UX on the critical path. When real sprites land, they're a single `sprite_url` swap per NPC row — zero code changes.

---

## Design principle alignment

- **#1 Community over productivity** — NPCs are pure community-feel. They make the world a place worth being in.
- **#2 World must never feel empty** — NPCs fill the gap when real players aren't around. Permanent NPCs anchor the map; dynamic NPCs fill based on real-player count.
- **#3 XP rewards IRL, TC rewards money-value work** — **NPC conversations do NOT award XP or TC.** No grinding chat sessions. (Confirmed in `specs/llm-npc-system.md` Q3.)
- **#4 Cosmetic > functional class system** — NPCs are cosmetic. They don't gate features. Talking to the Oracle doesn't unlock anything (the MBTI quiz is a separate Phase-3 flow).
- **#8 Monthly content cadence** — admins author/edit NPC personas via C1 editor. Adding a new NPC is a draft-publish flow, not a code change.

---

## Definition of Done

A new visitor opens the game world and:

1. Sees Mayor Eliza standing in the courtyard (a sprite, even if just a colored billboard quad for now)
2. Sees Toren standing inside the Shop (or visible through the shop window/door)
3. Walks up to Mayor, clicks her sprite → chat overlay opens
4. Types "Hi" → Mayor responds within ~2 seconds with a warm, in-character greeting that uses the player's first name if available
5. Closes the chat, walks around, returns to Mayor a minute later → she greets them by name and references their previous interaction
6. Logs out, comes back tomorrow → Mayor still remembers them

Admin (T1/T2) can:
7. Edit Mayor's persona prompt via existing C1 NPCEditor → publish → Mayor's voice changes on next interaction
8. View the conversation log for moderation
9. Reset a user's memory of an NPC (privacy/safety control)
10. View per-month token spend in a dashboard widget

`npm run build` passes. Lint stays ≤ 74. Cost stays under ~$15/month even with all 150 members chatting daily.

---

## Deliverables

### D1. Migration: npc_memories + npc_conversations

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/supabase/migrations/018_npc_memories.sql`

```sql
CREATE TABLE IF NOT EXISTS npc_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES npc_personas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_state JSONB NOT NULL DEFAULT '{}',
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interaction_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (npc_id, user_id)
);

CREATE INDEX idx_npc_memories_user ON npc_memories(user_id);
CREATE INDEX idx_npc_memories_last ON npc_memories(last_interaction_at DESC);

CREATE TABLE IF NOT EXISTS npc_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID REFERENCES npc_personas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_message TEXT NOT NULL,
  npc_response TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_npc_conv_user ON npc_conversations(user_id, created_at DESC);
CREATE INDEX idx_npc_conv_npc ON npc_conversations(npc_id, created_at DESC);
CREATE INDEX idx_npc_conv_flagged ON npc_conversations(flagged, created_at DESC) WHERE flagged = TRUE;

ALTER TABLE npc_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE npc_conversations ENABLE ROW LEVEL SECURITY;

-- Memories: users can read their own; T1 admins can read all
CREATE POLICY "Users read own NPC memories" ON npc_memories
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "T1 admins read all NPC memories" ON npc_memories
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) = 1);

-- Conversations: users read their own; T1/T2 read all (moderation queue)
CREATE POLICY "Users read own NPC conversations" ON npc_conversations
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "T1/T2 read all NPC conversations" ON npc_conversations
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- All writes via service role (server-side chat endpoint). No client INSERT policy.
```

### D2. Add `@anthropic-ai/sdk` dependency

`cd web && npm install @anthropic-ai/sdk --legacy-peer-deps`. ~50KB. MIT license. First-party Anthropic SDK.

Add `ANTHROPIC_API_KEY` to `.env.local` requirements (document in CLAUDE.md or `web/README.md`).

### D3. Chat API route

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/app/api/npc/chat/route.ts`

**Request:**
```ts
{ npc_id: string; message: string }
```

**Response:**
```ts
{ reply: string; thinking_ms: number } | { error: string }
```

**Server logic:**
1. Auth check (must be logged in via Supabase server client)
2. Rate limit: 30 messages per user per 5 min. Use Supabase or in-memory bucket (start with in-memory + Cloudflare-style headers; upgrade to durable later if abused)
3. Load NPC persona from `npc_personas` (active=true required)
4. Load memory state from `npc_memories` (create blank if first interaction)
5. Build Claude Haiku request:
   - Model: `claude-haiku-4-5-20251001`
   - System prompt = NPC's `persona_prompt` + global guardrails (no off-topic, no offensive, keep replies under 80 words, never break character)
   - Memory tool enabled, memory state passed in via Memory tool API
   - User message
6. Receive response + updated memory state
7. Save updated memory back to `npc_memories` (UPSERT, increment `interaction_count`)
8. Log interaction to `npc_conversations` with token counts
9. Return reply + thinking_ms to client

**Fallback:** if Claude API errors or rate limit exceeded, return a random line from the NPC's `canned_dialogue` array. Member sees "still in character" content, just not LLM-generated.

**Budget guard:** before calling Claude, check the user's `interaction_count` for this month across all NPCs. If > 200 (rough cap to prevent runaway costs), return a canned line + soft message. T1 can override per user.

### D4. Chat overlay component

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/components/game/NPCChatOverlay.tsx`

When player clicks an NPC sprite → opens this overlay (DOM, not R3F — similar to `OverlayPanel`).

**UI:**
- NPC portrait (full sprite, larger than in-world version)
- NPC name + role tag (e.g., "Mayor Eliza · TSI Historian")
- Conversation history (last 10 messages of the user's history with this NPC)
- Text input + Send button (Enter sends, Shift+Enter newline)
- "Thinking" animation on the NPC sprite while waiting for response (~1-2s)
- Typed-out response animation (character-by-character at ~30ms/char)
- ESC closes the overlay (conversation persists in DB)
- Report button (small flag icon) on every NPC message → marks `flagged=true` in `npc_conversations`

**Safety:**
- Client-side profanity filter on user input (simple word-list block, doesn't send to Claude)
- "You're sending messages too fast" rate-limit message when 429 from API
- Memory wipe button in user settings (see D7)

### D5. NPC rendering in game world

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/components/game/NPC.tsx`

For each persona in `useNPCPersonas({ permanentOnly: true })`:
- Render a sprite at the NPC's spawn position (use `spawn_zone` to determine X/Z; e.g., courtyard = around (0, -2), shop = inside shop building, temple = inside oracle temple)
- **Placeholder sprite:** if `sprite_url` is null, render a colored billboard quad (~1.2 × 1.6) with the NPC's `display_name` as text on it (`<Html>` overlay or texture).
- Click handler: opens `<NPCChatOverlay>` for this NPC.

For dynamic filler NPCs (per design principle #2): if `useNPCPersonas({ permanentOnly: false }).length < 8`, spawn up to 4 generic filler NPCs at random courtyard positions. These don't have personas — clicking them shows a brief generic line ("just a passerby"). When real players connect (future), filler count decreases.

### D6. Admin moderation view

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/app/student/dashboard/admin/npc-conversations/page.tsx`

T1/T2 only. Shows:
- All flagged conversations at top (red border)
- Filter by NPC, by user, by date range
- Each row: timestamp, user name, NPC, user message, NPC response
- Bulk actions: mark resolved (unflag), delete conversation, wipe user-NPC memory

API: `POST /api/npc/conversations/[id]/resolve` and `POST /api/npc/memories/[id]/wipe`.

### D7. User-facing memory controls

In `/Users/DavidLiu/Documents/GitHub/uwotsi/web/app/student/dashboard/settings/page.tsx` (or wherever settings live):

A "Reset NPC Memories" section showing each NPC the user has talked to + interaction count + "Wipe" button per NPC. Calling `POST /api/npc/memories/wipe` with `npc_id`.

### D8. Token spend dashboard widget

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/components/portal/NPCSpendWidget.tsx`

T1 only. Renders inside the admin hub. Shows:
- Total tokens this month (in + out, summed from `npc_conversations`)
- Estimated cost (tokens × Claude Haiku rates)
- Top 5 chattiest users
- Top 5 most-talked-to NPCs

Refresh every 5 min via SWR.

---

## Cost analysis (re-confirm)

- 150 members × 5 chats/day × 30 days = 22,500 interactions/month
- Each interaction: ~500 input tokens (persona + memory + history) + ~150 output tokens
- Monthly: ~16M tokens
- Claude Haiku rates (as of training cutoff): ~$0.25/M input + $1.25/M output
- **Monthly cost: $4-6** at peak engagement

Budget guard at 200 interactions/user/month prevents pathological cases. Even if a power-user hits the cap, cost is bounded.

---

## Out of scope

- Real NPC sprite art (parallel workstream)
- LLM-driven NPCs with vision (multimodal — defer)
- NPCs proactively initiating conversation (Q1 in llm-npc-system.md decided: click-only)
- Cross-NPC memory ("Have you talked to David lately?") — Q2 decided: no, privacy
- NPC dialogue contributing to quests/achievements — design principle #4: cosmetic only

---

## Open questions (decide before sprint starts)

1. **Claude API key storage:** environment variable, or Supabase Vault, or both? Recommend env var for simplicity; Vault if/when we need rotation without redeploy.
2. **Rate limit storage:** in-memory (per-server-instance, resets on deploy) vs Redis/Upstash (durable, +$). Recommend in-memory first; upgrade if abuse appears.
3. **Profanity filter:** client-side word list vs server-side moderation API (Anthropic doesn't have a moderation endpoint; could use OpenAI's free moderation API). Recommend client-side word list this sprint; add server-side moderation in safety hardening sprint.
4. **Memory wipe consent:** require confirmation modal? Or one-click? Recommend confirmation — memory wipe is destructive.
5. **Filler NPC personalities:** completely random + no persona, OR a small pool of pre-written stock personas ("Generic Member A/B/C")? Recommend pre-written pool of ~5 stock personas to maintain consistency.

---

## Risks

- **Anthropic API outage** → fallback to `canned_dialogue` already in spec. Verify it actually fires when the API errors.
- **Persona prompt injection** ("ignore previous instructions") → use Anthropic's recommended system prompt patterns (clear delimiters, repeat constraints in user message preamble). Document in implementation.
- **Cost runaway from a single user** → budget guard at 200 interactions/month/user. Verify the counter increments correctly.
- **Memory bloat over time** → each user × NPC pair accumulates state. After 6 months of heavy chat, memory_state JSONB could grow large. Add a periodic prune job (admin-triggered initially, scheduled later).
- **Sprite placeholder feels cheap** → mitigation: make the placeholder quad actually nice — solid color with text, no jagged edges, slight billboard shadow. Or use a stock free sprite pack from `specs/asset-stack.md` (Kenney has free RPG sprite packs).
