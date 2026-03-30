-- ─── Profile Cleanup & Game Extensions ──────────────────────────────────────
-- Extends profiles for 5-tier system and game world MVP.
-- Adds avatar_config, skills array, social_links JSONB.
-- Adds indexes on commonly queried fields.

-- 1. Expand tier constraint from 1-4 to 1-5
--    T1=David, T2=presidents, T3=PM/VP, T4=dev/director, T5=volunteer
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check CHECK (tier BETWEEN 1 AND 5);

-- 2. Add new game/profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}';

-- 3. Indexes for directory queries and common lookups
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level);
CREATE INDEX IF NOT EXISTS idx_profiles_position ON profiles(position);
CREATE INDEX IF NOT EXISTS idx_profiles_class ON profiles(class);

-- 4. Full-text search index on display_name for directory search
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON profiles USING gin (display_name gin_trgm_ops);

-- Note: gin_trgm_ops requires pg_trgm extension. If not enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Run this in Supabase SQL Editor if the trigram index fails.
