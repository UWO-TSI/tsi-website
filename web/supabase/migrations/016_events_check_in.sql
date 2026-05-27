-- ─── C4: Event check-in + IRL flag ────────────────────────────────────────────
-- Adds the columns the event editor (C4) needs for the QR check-in flow.
-- Spec: only IRL events award XP (design principle #3). qr_check_in_code is the
-- UUID encoded into the printable QR; the runtime check-in route lands later.
-- Capacity is optional (NULL = unlimited). Schema-only — do not apply yet; the
-- DB migration ships separately.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_irl BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS qr_check_in_code UUID UNIQUE DEFAULT gen_random_uuid();

-- Backfill the QR code for any pre-existing rows that escaped the DEFAULT.
UPDATE events
  SET qr_check_in_code = gen_random_uuid()
  WHERE qr_check_in_code IS NULL;
