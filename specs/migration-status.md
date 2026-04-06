# Migration Runbook — Applying 001-008 to Production

> **Owner:** Backend agent
> **Date:** 2026-04-05
> **Status:** Migrations written, NOT yet applied to production Supabase

---

## Prerequisites

- Supabase project with admin access (Dashboard → SQL Editor)
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- pg_trgm extension available (migration 004 uses trigram index)

## Migration Order (MUST be sequential)

| # | File | Dependencies | Destructive? | Notes |
|---|------|-------------|-------------|-------|
| 1 | `001_initial_schema.sql` | None | No | Creates all base tables: profiles, teams, bounties, events, quests, achievements, transactions, notifications, marketplace, etc. Full RLS + seed data. **Already applied** if auth/election works. |
| 2 | `002_election_votes.sql` | 001 | No | Election voting table, has_voted flag. **Already applied** if election was used. |
| 3 | `003_profile_trigger.sql` | 001 | No | Auto-creates profile on auth signup. **Already applied** if user registration works. |
| 4 | `004_cleanup_and_extend.sql` | 001 | **Modifies profiles table** | Expands tier constraint 1-4 → 1-5. Adds columns: `avatar_config`, `skills`, `social_links`. Creates 6 indexes + trigram search. Requires `CREATE EXTENSION IF NOT EXISTS pg_trgm`. |
| 5 | `005_avatar_items.sql` | 001 | No | New tables: `avatar_items`, `player_inventory`. RLS policies. |
| 6 | `006_bounty_system.sql` | 001 | No | New table: `bounty_submissions`. RLS policies. |
| 7 | `007_achievement_policies.sql` | 001 | No | Adds INSERT/UPDATE RLS policies for `achievements` and `user_achievements`. |
| 8 | `008_event_attendance_policies.sql` | 001 | No | Adds DELETE policy for `event_attendance` (un-RSVP). |

## How to Apply

### Option A: Supabase Dashboard (recommended for first time)

1. Go to Supabase Dashboard → SQL Editor
2. For each migration file (004 through 008):
   - Copy the SQL content
   - Paste into SQL Editor
   - Click "Run"
   - Verify: "Success. No rows returned" or similar
3. Verify by querying: `SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('avatar_config', 'skills', 'social_links');`

### Option B: Supabase CLI

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

Note: The CLI will apply all migrations in `web/supabase/migrations/` in order. If 001-003 are already applied, it may error. In that case, mark them as applied:

```bash
supabase migration repair 001_initial_schema --status applied
supabase migration repair 002_election_votes --status applied
supabase migration repair 003_profile_trigger --status applied
```

## Verification Checklist

After applying 004-008, verify:

- [ ] `SELECT * FROM avatar_items LIMIT 1;` — table exists
- [ ] `SELECT * FROM player_inventory LIMIT 1;` — table exists
- [ ] `SELECT * FROM bounty_submissions LIMIT 1;` — table exists
- [ ] `SELECT avatar_config, skills, social_links FROM profiles LIMIT 1;` — new columns exist
- [ ] `SELECT tier FROM profiles WHERE tier = 5 LIMIT 1;` — tier 5 allowed (may return 0 rows, that's OK)
- [ ] Test INSERT into `user_achievements` with an authenticated user — should succeed
- [ ] Test DELETE from `event_attendance` for own user — should succeed

## Rollback

Migrations 004-008 are additive (new columns, new tables, new policies). To rollback:

- **004:** `ALTER TABLE profiles DROP COLUMN avatar_config, DROP COLUMN skills, DROP COLUMN social_links;` + drop indexes
- **005:** `DROP TABLE player_inventory; DROP TABLE avatar_items;`
- **006:** `DROP TABLE bounty_submissions;`
- **007:** `DROP POLICY ... ON achievements; DROP POLICY ... ON user_achievements;`
- **008:** `DROP POLICY "Users can delete own attendance" ON event_attendance;`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `ENABLE_ELECTION` | No | Set to `"true"` to enable election routes (default: off) |

## Seed Data

Migration 001 includes seed data (invite codes, default bounties, etc.). Migrations 004-008 do NOT include seed data. To seed avatar items or achievements, use the admin API endpoints:

```bash
# Create an achievement (requires T1-T3 auth)
POST /api/achievements
{ "name": "first_login", "display_name": "Welcome!", "description": "Log in for the first time", "tc_reward": 10, "xp_reward": 25 }

# Create avatar items (direct SQL or admin tool)
INSERT INTO avatar_items (name, type, category, coin_price, rarity) VALUES
('Default Hair', 'hair', 'default', 0, 'common'),
('Cyber Mohawk', 'hair', 'shop', 200, 'rare');
```
