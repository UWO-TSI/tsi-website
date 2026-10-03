-- ─── realtime_player_card: what the multiplayer server knows about a player ──
--
-- Multiplayer M1 (specs/multiplayer.md §2.2, rows 296–299). The realtime server
-- (realtime/src/auth/card.ts) reads it once per join with the secret key, caches
-- it 60 s per user and re-reads it after a wardrobe, name or class change. Other
-- clients get keys and numbers only; the tier never leaves the server.
--
-- The name is member_identity.world_name, or "Islander" before one is set: never
-- profiles.display_name, which is the Google name (row 222), and never the email.
-- Keys (all present, null when unset):
--   name, badge ('member' for an active member, else null), tier,
--   look (avatar_config->'look' when it is an object of at most 2 KB),
--   family, level (1 before any progression row), subclass,
--   mastery, aura, frame (the active subclass's mastery row and cosmetics),
--   classes_v2 (economy_settings flag), muted_until,
--   removed_until (always null: the column arrives in M2), created_at (the profile's).
-- Null when the member has no profile. Read-only; service role only, like every
-- game function. Test: web/supabase/tests/realtime_card_smoke.sql.
--
-- Rollback (SQL editor): drop function if exists public.realtime_player_card(uuid);

CREATE OR REPLACE FUNCTION public.realtime_player_card(p_member UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', COALESCE(i.world_name, 'Islander'),
    'badge', CASE WHEN p.membership = 'member' AND p.is_active THEN 'member' END,
    'tier', p.tier,
    'look', CASE WHEN jsonb_typeof(p.avatar_config->'look') = 'object'
                  AND octet_length((p.avatar_config->'look')::TEXT) <= 2048
                 THEN p.avatar_config->'look' END,
    'family', i.family,
    'level', COALESCE(g.level, 1),
    'subclass', g.subclass,
    'mastery', m.mastery,
    'aura', m.cosmetics->>'aura',
    'frame', m.cosmetics->>'frame',
    'classes_v2', public.classes_v2_on(),
    'muted_until', i.muted_until,
    'removed_until', NULL::TIMESTAMPTZ,
    'created_at', p.created_at
  )
    FROM profiles p
    LEFT JOIN member_identity i ON i.member_id = p.id
    LEFT JOIN member_progression g ON g.member_id = p.id
    LEFT JOIN member_subclass_mastery m ON m.member_id = p.id AND m.subclass = g.subclass
   WHERE p.id = p_member
$$;

REVOKE ALL ON FUNCTION public.realtime_player_card(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_player_card(UUID) TO service_role;
