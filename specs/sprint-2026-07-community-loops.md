# Sprint: Community Loops — Emotes + Guestbook + Presence

> **Goal:** Make the world feel social even when no other real players are online. Async patterns only — no multiplayer infrastructure needed.
> **Why:** Design principle #1 (community over productivity). Principle #2 (world never feels empty). After LLM-NPCs, the next thing players need is a way to leave their mark and feel each other's presence asynchronously.
> **Sprint window:** 2026-07-14 → ~2026-08-04 (~3 weeks)
> **Owner:** `build` agent. Reviewer: David.

---

## Why this sprint, not multiplayer

Per CLAUDE.md design principles, Colyseus multiplayer is deferred until usage justifies the infra cost. But the community pitch needs *some* form of player-to-player presence. Three async patterns deliver 80% of the feel for 5% of the engineering cost:

1. **Emotes** — a member can wave/dance/laugh, which other members see *next time they're in the same area* (replay-based)
2. **Guestbook at HQ** — physical sign-the-wall: members leave timestamped notes that everyone sees
3. **Ghost-replay presence** — recent member positions (last 24h) shown as faded ghosts walking past, so the world looks populated

None require websockets or per-tick sync. All driven by Supabase reads + occasional writes.

---

## Design principle alignment

- **#1 Community over productivity** — pure community-feel features.
- **#2 World never feels empty** — ghost-replay is the explicit solution to the empty-world problem.
- **#3 XP rewards IRL only** — emoting does NOT award XP. Guestbook signing does NOT award XP. Confirmed.
- **#4 Cosmetic > functional** — emotes are pure flair.
- **#5 Mobile-aware** — guestbook + emotes work fine on phone. Ghost-replay works on phone (lower density if perf is tight).
- **#7 Senior members can mute** — toggle in settings to disable ambient ghost-replay if it's distracting.
- **#8 Monthly content cadence** — admins drop new emote types each month via the C1 content pipeline.

---

## Definition of Done

A new visitor opens the world and:

1. Sees 3-5 faded "ghost" avatars walking around at half opacity — these are the last positions of real members from the past 24h. Each labeled with a small "last seen 3h ago" or just a name tag.
2. Walks to HQ, sees a guestbook wall with the last 20 entries from members. Can sign their own message.
3. Opens an emote menu (keyboard shortcut: E, or sidebar icon) — picks "wave" — their avatar plays the wave animation. The emote is logged.
4. When another member walks past their old position later, that member sees the player's emote replayed at that spot.

Admins can:
5. Add new emote types via content pipeline (slug, name, animation_key, unlock_condition)
6. Moderate guestbook entries (T1/T2 only — delete or hide a message)

`npm run build` passes. `npm run lint` errors ≤ 74. Performance still ≥ 50 FPS with all ghosts + emotes rendered.

---

## Deliverables

### E1. Migration: emotes + guestbook tables

`/Users/DavidLiu/Documents/GitHub/uwotsi/web/supabase/migrations/019_community_loops.sql`

```sql
CREATE TABLE IF NOT EXISTS emote_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  animation_key TEXT NOT NULL,  -- e.g., 'wave', 'dance', 'laugh' — drives client animation
  icon_url TEXT,                -- for emote menu
  unlock_condition TEXT,        -- nullable; e.g., 'level:5', 'class:explorer'. NULL = always unlocked
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emote_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emote_type_id UUID NOT NULL REFERENCES emote_types(id) ON DELETE CASCADE,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_emote_logs_recent ON emote_logs(triggered_at DESC);
CREATE INDEX idx_emote_logs_location ON emote_logs(world_x, world_z);

CREATE TABLE IF NOT EXISTS guestbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 200),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_guestbook_recent ON guestbook_entries(created_at DESC);

CREATE TABLE IF NOT EXISTS player_positions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_player_positions_recent ON player_positions(recorded_at DESC);

-- RLS (wrap auth.uid() in select per established pattern)
-- Seed initial emote types (5): wave, dance, laugh, point, sit
```

Add full RLS per the pattern: anyone can SELECT emote_types where active=true; users INSERT their own emote_logs / guestbook_entries / player_positions (upsert); T1/T2 moderate (UPDATE hidden on guestbook, DELETE on emote_logs).

### E2. Emote menu UI

`web/components/game/EmoteMenu.tsx` — quick radial or grid menu (5-8 emotes). Keyboard shortcut E or sidebar icon. Click → plays animation on player + writes to emote_logs.

### E3. Emote animation on PlayerAvatar

Extend PlayerAvatar with an `activeEmote` state. When set, plays a brief animation (3-4 seconds) — for wave it's an arm-raise sprite swap or a small `<Html>` floating "👋" near the avatar. Cosmetic only, no gameplay impact.

### E4. Position tracking

Heartbeat that writes to `player_positions` every 30 seconds while the player is in the world. Throttle on movement to avoid spam.

`web/lib/game/usePositionHeartbeat.ts` (new hook).

### E5. Ghost-replay rendering

`web/components/game/GhostReplay.tsx` — fetches recent positions (last 24h) excluding the current user, renders semi-transparent NPC-like quads at those positions. Each ghost slowly drifts (interpolating between consecutive recorded positions of that user, or simple wander).

Caps at ~10 ghosts max for perf. Updates every 5 minutes.

### E6. Guestbook wall at HQ

`web/components/game/GuestbookWall.tsx` — rendered inside HQ building (when player enters HQ or as a clickable wall element). Opens an overlay showing the last 20 entries + a sign-message form.

Includes simple profanity guard (server-side, ~20 word blocklist).

### E7. Admin moderation for guestbook

Extend `/student/dashboard/admin/content/` with a `guestbook/` page. T1/T2 can hide entries.

### E8. Emote admin editor (lightweight)

`web/components/portal/EmoteEditor.tsx` — CRUD for emote_types via the existing draft/preview/publish content pipeline. Reuse C1/C2 pattern.

### E9. Settings toggle for ghost-replay

In settings, a toggle: "Show ghost replays of past members" (default ON). When OFF, ghost-replay component is hidden.

---

## Out of scope

- Real-time multiplayer (Colyseus) — defer
- Voice or text chat between live players — defer to multiplayer sprint
- Player-to-player emote *reactions* (e.g., wave back) — defer
- Emote animations beyond simple sprite/Html overlays — defer to richer animation sprint
- Guestbook search / pagination beyond last 20 — keep simple

---

## Open questions

1. **Position heartbeat frequency**: 30s OK, or too chatty? At 150 active users × 30s = 5 writes/sec to Supabase. Should be fine. Bump to 60s if needed.
2. **Ghost-replay age cutoff**: 24h, or longer (3 days for less-active worlds)? Start 24h.
3. **Emote unlock conditions**: enforce client-side, server-side, or honor system? Recommend honor system this sprint — no enforcement — and add server-side checks if abuse appears.
4. **Guestbook entry rate limit**: 1 per user per 24h? Or unlimited? Recommend 5/day to prevent spam.
