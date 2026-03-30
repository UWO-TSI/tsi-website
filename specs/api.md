# API Contracts

> Owner: Backend agent. Frontend and QA reference this.

---

## Schema Audit Summary

**Existing from 001_initial_schema.sql:** profiles (~30 fields), teams, invite_codes, announcements, bounties, bounty_claims, bounty_deliverables, events, kanban, marketplace, job_listings, quests, achievements, transactions, notifications, mentorship, portfolios, time_capsules, themes.

**Migration 004 changes:**
- Tier constraint expanded: `BETWEEN 1 AND 4` → `BETWEEN 1 AND 5`
- Added: `avatar_config JSONB`, `skills TEXT[]`, `social_links JSONB`
- Added indexes on: tier, is_active, display_name, level, position, class
- Added trigram index on display_name for search

**Migration 005 adds:** `avatar_items`, `player_inventory` (with RLS)

**Migration 006 adds:** `bounty_submissions` (stub, not wired to UI)

**Fields kept as-is:** All existing profile fields preserved. No removals — existing auth, election, and gamification fields remain intact.

---

## Authentication

All API routes require Supabase auth. The server-side client reads the session from cookies (set by middleware).

**Error responses:**
- `401 Unauthorized` — No valid session
- `403 Forbidden` — Insufficient tier
- `404 Not Found` — Resource doesn't exist
- `400 Bad Request` — Invalid input / validation failure
- `500 Internal Server Error` — Database error

---

## `GET /api/directory`

Returns filtered member list for the directory page.

### Auth
Requires authenticated session.

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `role` | string | Filter by position (e.g. `developer`, `pm`) |
| `year` | string | Filter by year |
| `active` | `"true"` \| `"false"` | Filter by active status |
| `search` | string | Search display_name (case-insensitive, partial match) |

### Visibility Rules
- **T1/T2** callers see all members (active and inactive)
- **T3+** callers see only active members (`is_active = true`)

### Response `200`

```json
{
  "members": [
    {
      "id": "uuid",
      "display_name": "Jane Doe",
      "avatar_url": "https://...",
      "tier": 3,
      "position": "developer",
      "class": "ENGINEER",
      "level": 5,
      "xp": 1200,
      "skills": ["React", "TypeScript"],
      "is_active": true
    }
  ]
}
```

Sorted by `level` descending.

---

## `GET /api/profile`

Returns the authenticated user's full profile (all fields).

### Auth
Requires authenticated session.

### Response `200`

```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Jane Doe",
    "tier": 3,
    "position": "developer",
    "class": "ENGINEER",
    "subclass": null,
    "team_id": null,
    "portfolio": null,
    "side": null,
    "xp": 1200,
    "level": 5,
    "rank": "Adept",
    "tethos_coins": 500,
    "onboarding_completed": true,
    "onboarding_step": 4,
    "has_voted": true,
    "avatar_config": { "body": "base_m", "hair": "short_1" },
    "skills": ["React", "TypeScript"],
    "social_links": { "github": "janedoe", "discord": "jane#1234" },
    "year": "3",
    "program": "Computer Science",
    "hometown": "Toronto",
    "birthday": "2003-05-15",
    "phone": null,
    "preferred_email": null,
    "uwo_email": "jdoe@uwo.ca",
    "gdrive_email": null,
    "github_username": "janedoe",
    "instagram": null,
    "linkedin": "jane-doe",
    "discord_tag": "jane#1234",
    "favourite_music": "Lo-fi",
    "dream_retirement": "Beach house",
    "spirit_animal": "Fox",
    "fun_fact": "I can solve a Rubik's cube in 30s",
    "avatar_url": null,
    "bio": "Full-stack dev, coffee enthusiast",
    "active_theme": "dark",
    "is_alumni": false,
    "is_active": true,
    "created_at": "2026-01-15T00:00:00Z",
    "updated_at": "2026-03-29T12:00:00Z",
    "last_login_at": "2026-03-29T12:00:00Z",
    "login_streak": 7
  }
}
```

---

## `PATCH /api/profile`

Updates the authenticated user's own profile. Validates with Zod.

### Auth
Requires authenticated session.

### Request Body (all fields optional)

```json
{
  "display_name": "Jane Doe",
  "bio": "Updated bio",
  "skills": ["React", "TypeScript", "Supabase"],
  "social_links": {
    "github": "janedoe",
    "discord": "jane#1234",
    "website": "https://jane.dev"
  },
  "avatar_config": {
    "body": "base_f",
    "hair": "long_2",
    "hair_color": "#8B4513"
  },
  "year": "4",
  "program": "Software Engineering",
  "hometown": "Vancouver",
  "phone": "+1234567890",
  "preferred_email": "jane@gmail.com",
  "github_username": "janedoe",
  "instagram": "janedoe",
  "linkedin": "jane-doe",
  "discord_tag": "jane#1234",
  "favourite_music": "Jazz",
  "dream_retirement": "Mountain cabin",
  "spirit_animal": "Owl",
  "fun_fact": "I've been to 20 countries"
}
```

### Validation Rules

| Field | Constraint |
|-------|-----------|
| `display_name` | 1-50 chars |
| `bio` | max 500 chars |
| `skills` | max 10 items, each max 30 chars |
| `social_links` | each value max 200 chars |
| `preferred_email` | must be valid email |
| `phone` | max 20 chars |

### Response `200`

Returns the updated full profile (same shape as `GET /api/profile`).

### Response `400`

```json
{
  "error": "Validation failed",
  "details": { "fieldErrors": {}, "formErrors": [] }
}
```

---

## `GET /api/profile/[id]`

Returns another user's public profile (limited fields).

### Auth
Requires authenticated session.

### URL Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Target user's profile ID |

### Response `200`

```json
{
  "profile": {
    "id": "uuid",
    "display_name": "Jane Doe",
    "avatar_url": null,
    "tier": 3,
    "position": "developer",
    "class": "ENGINEER",
    "subclass": null,
    "level": 5,
    "xp": 1200,
    "rank": "Adept",
    "skills": ["React", "TypeScript"],
    "bio": "Full-stack dev",
    "social_links": { "github": "janedoe" },
    "is_active": true,
    "created_at": "2026-01-15T00:00:00Z"
  }
}
```

### Response `400`
Invalid UUID format.

### Response `404`
Profile not found.

---

## Middleware Routing

### Election (archived behind `ENABLE_ELECTION` env var)

| Route | Behavior when flag OFF | Behavior when flag ON |
|-------|----------------------|----------------------|
| `/student/election` | Redirect → `/student/dashboard` | Require auth, show election |
| `/student/dashboard/admin/election` | Redirect → `/student/dashboard` | Require auth + T1/T2 |

### Dashboard

| Route | Rule |
|-------|------|
| `/student/dashboard/admin/*` | Require auth + T1-T3 |
| `/student/dashboard/*` | Require auth + `onboarding_completed === true` |
| `/student/onboarding/*` | Require auth; skip to dashboard if already onboarded |
| `/student/login`, `/student/signup` | Redirect to `/student/dashboard` if logged in |

### Marketing pages
Untouched — no middleware applied.

---

## TypeScript Types (for Frontend)

Import from `@/lib/supabase/types`:

```typescript
// Core
Profile, Tier, Position, ClassName, RankTitle, Side, Portfolio

// Game/Avatar
AvatarConfig, SocialLinks, AvatarItem, PlayerInventoryItem
ItemType, ItemCategory, ItemRarity

// Bounty
Bounty, BountySubmission, BountyStatus, SubmissionStatus

// Directory views
DirectoryMember, PublicProfile

// Mappings
POSITION_CLASS_MAP, POSITION_TIER_MAP, TIER_LABELS

// Helpers
xpForLevel(), levelFromXp(), rankFromLevel(), canAccessFeature()
```
