-- ─── 030 Homes: personal home layout, rooms, mailbox ────────────────────────
--
-- DRAFT 2026-09-24. NOT APPLIED. Spec: specs/homes.md (rows 68-71, 82, 115-117,
-- 127, 187, 95). Depends on 001 (profiles); coins go through
-- public.wallet_apply() from 20260926150600_economy.sql (apply 029-033 as one batch).
--
-- The layout document is web/lib/homes/layout.ts (HomeLayoutDoc v1): one row
-- per room plus the outdoor list. Members read their own rows; every write
-- goes through /api/homes/* (service role) after server validation, via the
-- two functions below so saves and purchases are atomic and retry-safe.
-- Prototype gameplay: resettable at launch (row 48). Spent coins are play
-- currency, never money.

CREATE TABLE IF NOT EXISTS member_homes (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rooms_count INTEGER NOT NULL DEFAULT 1 CHECK (rooms_count BETWEEN 1 AND 4),
  outdoor JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(outdoor) = 'array'),
  -- Mailbox binding (row 95/187): letters to member_id are read here.
  mailbox_x REAL NOT NULL DEFAULT 2.3,
  mailbox_z REAL NOT NULL DEFAULT 1.3,
  -- Optimistic concurrency + idempotent saves.
  revision INTEGER NOT NULL DEFAULT 0,
  last_save_key TEXT CHECK (last_save_key IS NULL OR char_length(last_save_key) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_home_rooms (
  member_id UUID NOT NULL REFERENCES member_homes(member_id) ON DELETE CASCADE,
  room_index INTEGER NOT NULL CHECK (room_index BETWEEN 0 AND 3),
  room_id TEXT NOT NULL CHECK (char_length(room_id) BETWEEN 1 AND 32),
  wallpaper TEXT NOT NULL DEFAULT 'plaster00' CHECK (char_length(wallpaper) <= 40),
  flooring TEXT NOT NULL DEFAULT 'simpleparquet00' CHECK (char_length(flooring) <= 40),
  items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, room_index)
);

CREATE TABLE IF NOT EXISTS home_room_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL CHECK (room_number BETWEEN 2 AND 4),
  price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, room_number),
  UNIQUE (member_id, idempotency_key)
);

ALTER TABLE member_homes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Homes readable by owner or T1/T2" ON member_homes
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE member_home_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Home rooms readable by owner or T1/T2" ON member_home_rooms
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE home_room_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room purchases readable by owner" ON home_room_purchases
  FOR SELECT USING (member_id = (select auth.uid()));

-- ─── Save: whole document, optimistic, idempotent ────────────────────────────
-- Returns the new revision. Replaying the last save key returns the current
-- revision unchanged. A stale base revision raises 'revision_conflict'.
-- Room count comes from rooms_count (bought rooms); a save can't add rooms.
CREATE OR REPLACE FUNCTION public.home_save_layout(
  p_member_id UUID, p_base_revision INTEGER, p_save_key TEXT, p_rooms JSONB, p_outdoor JSONB
) RETURNS TABLE (revision INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_home member_homes%ROWTYPE;
  v_room JSONB;
  v_i INTEGER := 0;
BEGIN
  INSERT INTO member_homes (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_home FROM member_homes WHERE member_id = p_member_id FOR UPDATE;
  IF v_home.last_save_key = p_save_key THEN
    RETURN QUERY SELECT v_home.revision, TRUE; RETURN;
  END IF;
  IF v_home.revision <> p_base_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
  IF jsonb_typeof(p_rooms) <> 'array' OR jsonb_array_length(p_rooms) <> v_home.rooms_count THEN
    RAISE EXCEPTION 'room_count_mismatch';
  END IF;
  FOR v_room IN SELECT * FROM jsonb_array_elements(p_rooms) LOOP
    INSERT INTO member_home_rooms (member_id, room_index, room_id, wallpaper, flooring, items, updated_at)
    VALUES (p_member_id, v_i, v_room->>'id', v_room->>'wallpaper', v_room->>'flooring', COALESCE(v_room->'items', '[]'::jsonb), NOW())
    ON CONFLICT (member_id, room_index) DO UPDATE
      SET room_id = EXCLUDED.room_id, wallpaper = EXCLUDED.wallpaper, flooring = EXCLUDED.flooring,
          items = EXCLUDED.items, updated_at = NOW();
    v_i := v_i + 1;
  END LOOP;
  UPDATE member_homes
     SET outdoor = p_outdoor, revision = member_homes.revision + 1, last_save_key = p_save_key, updated_at = NOW()
   WHERE member_id = p_member_id;
  RETURN QUERY SELECT v_home.revision + 1, FALSE;
END;
$$;

-- ─── Buy a room: server price, cap 4, coins debited once ─────────────────────
CREATE OR REPLACE FUNCTION public.home_buy_room(
  p_member_id UUID, p_price INTEGER, p_max_rooms INTEGER, p_idempotency_key TEXT,
  p_room_id TEXT, p_wallpaper TEXT, p_flooring TEXT
) RETURNS TABLE (rooms_count INTEGER, coins INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_home member_homes%ROWTYPE;
  v_coins INTEGER;
BEGIN
  INSERT INTO member_homes (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_home FROM member_homes WHERE member_id = p_member_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM home_room_purchases WHERE member_id = p_member_id AND idempotency_key = p_idempotency_key) THEN
    SELECT COALESCE((SELECT w.coins FROM wallets w WHERE w.member_id = p_member_id), 0) INTO v_coins;
    RETURN QUERY SELECT v_home.rooms_count, v_coins, TRUE; RETURN;
  END IF;
  IF v_home.rooms_count >= LEAST(p_max_rooms, 4) THEN RAISE EXCEPTION 'room_cap'; END IF;
  -- Single wallet path (20260926150600_economy.sql): raises 'insufficient'.
  SELECT a.balance INTO v_coins FROM public.wallet_apply(p_member_id, 'coins', -p_price, 'room', 'room-' || (v_home.rooms_count + 1), 'room:' || p_idempotency_key) a;
  INSERT INTO home_room_purchases (member_id, room_number, price_coins, idempotency_key)
  VALUES (p_member_id, v_home.rooms_count + 1, p_price, p_idempotency_key);
  INSERT INTO member_home_rooms (member_id, room_index, room_id, wallpaper, flooring)
  VALUES (p_member_id, v_home.rooms_count, p_room_id, p_wallpaper, p_flooring)
  ON CONFLICT (member_id, room_index) DO NOTHING;
  UPDATE member_homes SET rooms_count = rooms_count + 1, revision = revision + 1, updated_at = NOW()
   WHERE member_id = p_member_id;
  RETURN QUERY SELECT v_home.rooms_count + 1, v_coins, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.home_save_layout(UUID, INTEGER, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_save_layout(UUID, INTEGER, TEXT, JSONB, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.home_buy_room(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_buy_room(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
