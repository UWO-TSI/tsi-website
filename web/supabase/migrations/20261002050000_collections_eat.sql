-- Eating a held snack (specs/game-ui.md §2, row 279): the tool wheel's pinned fruit, eaten with a left click.
-- One of the member's own stock, fruit only; a moment, no reward (principle 3). Service role only, like every
-- member_collections write (20260926150900). Returns how many are left.
CREATE OR REPLACE FUNCTION public.collections_eat(p_member_id UUID, p_item_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE left_over INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM collection_species WHERE key = p_item_key AND category = 'fruit' AND active) THEN
    RAISE EXCEPTION 'not_edible';
  END IF;
  UPDATE member_collections SET count = count - 1, updated_at = NOW()
   WHERE user_id = p_member_id AND item_key = p_item_key AND count >= 1
  RETURNING count INTO left_over;
  IF NOT FOUND THEN RAISE EXCEPTION 'none_left'; END IF;
  RETURN left_over;
END;
$$;

REVOKE ALL ON FUNCTION public.collections_eat(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collections_eat(UUID, TEXT) TO service_role;
