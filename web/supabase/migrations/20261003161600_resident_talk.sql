-- Resident talk (specs/polish/reachability.md deliverable 1; rows 123, 215, 218): what a resident says when a member
-- walks up and talks to them, as authored data T1/T2 edit in the Residents editor (principle 8), beside the bubble
-- lines they say in passing (canned_dialogue). A list of conversations, each one to four lines (a text box each); a
-- line may open with an expression in brackets ("[happy] Oh! Hi."), "{name}" is the member's island name. The game
-- reads it with the rest of the row (lib/content/talk.ts); drafts are checked on the server (validateTalk) and here.
-- Test: web/supabase/tests/resident_talk_smoke.sql.

-- The shape the game can say: up to 12 conversations of 1-4 non-empty lines of up to 200 characters, and only the
-- painted face's expressions in brackets.
CREATE OR REPLACE FUNCTION public.npc_talk_ok(t JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(t) = 'array' AND jsonb_array_length(t) <= 12 AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(t) c
    WHERE CASE
      WHEN jsonb_typeof(c) <> 'array' THEN TRUE
      WHEN jsonb_array_length(c) NOT BETWEEN 1 AND 4 THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM jsonb_array_elements(c) l
        WHERE CASE
          WHEN jsonb_typeof(l) <> 'string' THEN TRUE
          ELSE char_length(l #>> '{}') > 200
            OR btrim(regexp_replace(l #>> '{}', '^\s*\[[A-Za-z]+\]', '')) = ''
            OR coalesce(lower(substring(l #>> '{}' FROM '^\s*\[([A-Za-z]+)\]')), 'neutral')
               NOT IN ('neutral', 'happy', 'surprised', 'sad', 'angry', 'sleepy')
        END)
    END)
$$;

ALTER TABLE npc_personas ADD COLUMN IF NOT EXISTS talk JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'npc_personas_talk_shape') THEN
    ALTER TABLE npc_personas ADD CONSTRAINT npc_personas_talk_shape CHECK (public.npc_talk_ok(talk));
  END IF;
END $$;

-- The two seeded residents get their conversations (lib/content/residentRoster.ts RESIDENT_TALK, for David's review,
-- specs/polish/reachability-questions.md); an edit already made in the editor is kept. The rest of the proposed
-- roster carries its own when its seed lands (specs/polish/living-village-questions.md).
UPDATE npc_personas SET talk = '[["[happy] Ah, {name}. Stay a while, if you like.","This island started as one bench and an argument about where HQ should go.","We were all wrong, of course. It went exactly where it needed to be."],["Every club goal you finish, the island remembers.","[happy] The club monument grows a little each time. I check on it every morning."],["The light here changes with the seasons. Have you noticed?","[surprised] Autumn''s my favourite. The whole path goes gold."]]'::jsonb
  WHERE slug = 'mayor' AND talk = '[]'::jsonb;
UPDATE npc_personas SET talk = '[["Welcome. Browse if you must.","I keep the shelves in order of usefulness. Nobody has ever noticed.","[sad] I''ve started to take it personally."],["Selling your catches? The rarer ones fetch more.","That isn''t me being generous. It''s the rules.","[happy] I''m a little generous."],["[sleepy] Inventory day. I counted the hoodies twice.","There are the same number of hoodies. There are always the same number of hoodies."]]'::jsonb
  WHERE slug = 'shopkeeper' AND talk = '[]'::jsonb;
