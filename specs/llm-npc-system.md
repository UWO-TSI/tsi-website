# LLM-Driven NPC System (γ tier)

> **Status:** Forward-looking spec. NOT in current sprint. Lands after the world-building + admin-tooling sprints (~2026-07).
> **Owner:** `build` agent (future). Reviewer: David.
> **Decided 2026-05-25:** Skip α (scripted) and β (canned dialogue) tiers entirely. Go straight to γ — LLM-driven NPCs that remember players across conversations.

---

## Goal

NPCs feel like *characters*, not animations. A member can walk up to the shopkeeper, have a real conversation, leave, come back next week, and the shopkeeper remembers what they talked about ("Hey, how'd the React project go?").

This is Tethos' AI flex — the kind of thing a tech club shows off in a recruitment video.

---

## Tech choice: Claude Haiku 4.5 + Memory tool

**Why Haiku:**
- Cheap (~$0.25/M input, ~$1.25/M output)
- Fast (1-2s response time at ~200-token outputs)
- Smart enough for casual character dialogue
- First-party Anthropic Memory tool — automatic per-NPC × per-user memory management, no custom embedding/retrieval stack

**Alternatives considered:**
- **Kimi 2.5k** — even cheaper, used by BumBot. Less natural English dialogue, weaker context retention. Pass.
- **GPT-4o-mini** — comparable cost. No native memory tool. Would need custom RAG. Pass.
- **Claude Sonnet 4.6** — better dialogue but 5-10x cost, 3-4x latency. Overkill for casual chat. Pass.

**Budget envelope:**
- 150 members × 5 NPC conversations/day × 30 days = 22,500 interactions/month
- Each interaction: ~500 input tokens (system prompt + history + user message) + ~150 output tokens
- Monthly cost: ~16M tokens ≈ **$4-6/month**
- Well within hobbyist tier; scales fine to 500 members

---

## Data model

### Persona definition (already in `013_content_pipeline.sql` per world-building sprint)

```sql
npc_personas (
  id uuid,
  slug text,                  -- 'mayor-eliza'
  display_name text,
  sprite_url text,
  persona_prompt text,         -- system prompt (defined by admins)
  canned_dialogue text[],      -- fallback if LLM disabled or rate-limited
  is_permanent boolean,
  active boolean,
  ...
)
```

### Per-NPC × per-user memory (new in this sprint)

```sql
create table npc_memories (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid references npc_personas(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  memory_state jsonb not null,        -- Claude Memory tool state
  last_interaction_at timestamptz default now(),
  interaction_count integer default 0,
  unique (npc_id, user_id)
);

create index on npc_memories(user_id);
create index on npc_memories(last_interaction_at);
```

RLS:
- A user can read their own memories (for transparency / debugging)
- Only the service role can write (via the NPC chat API)
- T1 admins can read all (debugging / moderation)

### Conversation transcript log (for moderation + debugging)

```sql
create table npc_conversations (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid references npc_personas(id),
  user_id uuid references profiles(id),
  user_message text,
  npc_response text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz default now()
);

create index on npc_conversations(user_id, created_at desc);
create index on npc_conversations(npc_id, created_at desc);
```

Retention: prune older than 90 days. Admins can search transcripts for safety review.

---

## API route

`POST /api/npc/chat`

**Request:**
```ts
{
  npc_id: string;
  message: string;
}
```

**Response:**
```ts
{
  reply: string;
  thinking_ms: number;
}
```

**Server logic:**
1. Auth check (must be logged in)
2. Rate limit: 30 messages per user per 5 min (prevent abuse)
3. Load NPC persona from `npc_personas`
4. Load memory state from `npc_memories` (or create blank if first interaction)
5. Call Claude Haiku with:
   - System prompt = NPC's `persona_prompt` + global guardrails (no off-topic, no offensive, keep replies under 80 words)
   - Memory tool enabled, state passed in
   - User message
6. Receive response + updated memory state
7. Save updated memory back to `npc_memories`
8. Log interaction to `npc_conversations`
9. Return reply to client

**Fallback:** if Claude API errors or rate limit exceeded, return a random `canned_dialogue` line.

---

## Client UX

### Initiating a conversation
- Click NPC sprite → opens chat overlay (similar to `OverlayPanel`)
- Chat overlay shows:
  - NPC portrait (full sprite, not just face)
  - NPC name + class/role tag
  - Conversation history (most recent 10 messages)
  - Text input + send button
- ESC closes overlay (conversation persists in DB for next time)

### Latency masking
- After sending: NPC sprite shows "thinking" animation (dot-dot-dot bubble) for ~1-2s
- Reply appears as a typed-out animation (character-by-character, ~30ms/char) so the wait feels intentional, not laggy

### Safety
- Profanity filter on user input (basic word list — block, don't send to LLM)
- Report button on every NPC message (T1/T2 reviews flagged conversations)
- Rate limit shown to user when hit ("Maya needs a moment — try again in a few minutes")

---

## Persona writing guidelines (for admins)

Personas are written in plain English in the admin NPC editor. Template:

```
You are Mayor Eliza of TSI Town. You are warm, slightly formal, and proud of the club's
history. You always greet by name if you remember it. You know roughly:
- TSI was founded in [year]
- The Annual Hackathon is the biggest event
- David is the president
You don't know:
- Specific personal details about the person unless they tell you

When the conversation ends, save what you learned about them (name, year, what they
study, what they're working on).

Keep replies under 80 words. Use the player's first name if you know it. Never break
character.
```

The Memory tool handles the "save what you learned" part automatically.

### Persona library (initial set — David picks N)

| Slug | Name | Role | Location | Vibe |
|------|------|------|----------|------|
| `mayor` | Mayor Eliza | Town mayor / club historian | HQ entrance | warm, formal, encyclopedic |
| `shopkeeper` | Toren | Shop merchant | Shop interior | dry humor, salesy |
| `oracle` | Sage Vaela | MBTI oracle | Oracle Temple | mystical, speaks in metaphors |
| `bouncer` | Captain Renn | Bounty Board guard | next to Bounty Board | gruff, no-nonsense |
| `gardener` | Pippa | Tending the flowers | Courtyard | chatty, gossipy |
| `bard` | Lior | Plays a lute on a bench | Bench near Shop | melodramatic, tells stories |

---

## Phasing

This spec is a single sprint, gated on:
- Content pipeline architecture lands (current sprint) ✓ planned
- Admin tooling lands (next sprint) — needed to write personas without code
- NPC sprites land (parallel to admin tooling, via Nano Banana) — needed to make NPCs visible

When all three are ready, this sprint kicks off.

---

## Risks

- **Cost spike from abuse.** Mitigation: rate limits + monthly per-user token budget (hard cap at e.g. 50K tokens/user/month).
- **Off-topic / unsafe outputs.** Mitigation: global guardrails in system prompt + report button + admin transcript review.
- **Memory drift / personas going off-character.** Mitigation: periodic memory resets, transcript audits, clear persona rewrites.
- **Latency feels slow.** Mitigation: typed-out reply animation + thinking bubble masks the 1-2s wait.
- **NPCs feel same-y.** Mitigation: each persona's system prompt has distinct voice rules, NOT just "you are X." Test by hand before shipping.

---

## Open questions (decide before sprint kicks off)

- **Q1)** Should NPCs proactively initiate conversation (greet player who walks past)? Or only respond when clicked? Recommend: click-only, proactive feels intrusive.
- **Q2)** Can NPCs reference other members by name in conversation? e.g., "Have you talked to David lately?" Privacy implications. Recommend: no — NPCs only know the person they're talking to.
- **Q3)** Should NPC conversations contribute XP / TC? Per design principle #3, NO — no online activity rewards.
- **Q4)** Persona moderation: review each persona prompt before it goes live, or trust admins? Recommend: T2+ can publish personas without review, T3 personas need T2 approval.
- **Q5)** Memory wipe policy: never, monthly, on demand by user, on demand by admin? Recommend: user can wipe their own memory per NPC at any time. Admins can wipe globally.
