-- ─── NPC Memories + Conversations: per-NPC × per-user memory + transcript log ──
-- Foundation for LLM-driven NPCs (sprint D, llm-npc-system.md). Memory state is
-- a JSONB blob managed by Claude's Memory tool. Conversations are an audit log
-- for moderation (T1/T2) and per-user history (D4 chat overlay).
-- All writes happen server-side via service role — no client INSERT/UPDATE/DELETE
-- policies are defined intentionally.

CREATE TABLE IF NOT EXISTS npc_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES npc_personas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_state JSONB NOT NULL DEFAULT '{}',
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interaction_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (npc_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_npc_memories_user ON npc_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_npc_memories_last ON npc_memories(last_interaction_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_npc_conv_user ON npc_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_npc_conv_npc ON npc_conversations(npc_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_npc_conv_flagged ON npc_conversations(flagged, created_at DESC) WHERE flagged = TRUE;

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

-- All writes via service role (server-side chat endpoint). No client INSERT/UPDATE/DELETE policies.
