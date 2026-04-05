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

## Bounty System API

### `GET /api/bounties`

List bounties with optional filters.

**Query params:** `?status=open`, `?difficulty=3`
**Default:** excludes `pending` bounties.

**Response:** `{ "bounties": [...] }`

---

### `POST /api/bounties`

Create a bounty. T1-T3 auto-approved to `open`, others go to `pending`.

**Body:** `{ title, description?, client_name, pay_cad?, pay_tc?, xp_reward?, difficulty?, deadline?, tech_stack? }`

**Response:** `201 { "bounty": {...} }`

---

### `GET /api/bounties/[id]`

Get bounty detail with claims and deliverables.

**Response:** `{ "bounty": { ..., bounty_claims: [...], bounty_deliverables: [...] } }`

---

### `PATCH /api/bounties/[id]`

Update bounty (T1-T3 only). Can update status, title, description, difficulty, pay, deadline, tech_stack.

---

### `DELETE /api/bounties/[id]`

Delete bounty (T1-T2 only).

---

### `POST /api/bounties/[id]/claim`

Claim an open bounty. Creates a `bounty_claims` row, sets bounty to `claimed`.

**Errors:** `409` if already claimed or bounty not open.

---

### `POST /api/bounties/[id]/submit`

Submit deliverables for a claimed bounty. Requires active claim.

**Body:** `{ submission_text, attachment_urls? }`

Sets bounty to `review`.

---

### `PATCH /api/bounties/[id]/review`

Review a submission (T1-T3 only).

**Body:** `{ submission_id, status: "approved"|"rejected"|"revision_requested", reviewer_notes? }`

On `approved`: completes bounty, awards `pay_tc` coins + `xp_reward` XP, records transactions.
On `revision_requested`: sets bounty back to `in_progress`.

---

## Economy API

### `GET /api/economy`

Get own coin balance and transaction history.

**Query params:** `?limit=50` (max 100)

**Response:**
```json
{
  "balance": 1200,
  "xp": 3500,
  "level": 8,
  "transactions": [
    { "id": "uuid", "amount": -500, "balance_after": 1200, "type": "spend_marketplace", "description": "Purchased 1x Cyberpunk Theme", "created_at": "..." }
  ]
}
```

---

### `POST /api/economy` — Purchase

Atomic shop purchase: validates stock + balance, deducts coins, creates order, decrements stock, records transaction. Refunds on failure.

**Body:** `{ action: "purchase", item_id: "uuid", quantity?: 1 }`

**Response:** `{ success: true, balance: 700, item_name: "Cyberpunk Theme", total_cost: 500 }`

**Errors:** `404` item not found, `409` insufficient stock/coins.

---

### `POST /api/economy` — Admin Award

Award coins to a user (T1-T2 only).

**Body:** `{ action: "award", user_id: "uuid", amount: 500, description?: "Hackathon prize" }`

**Response:** `{ success: true, user: "uuid", awarded: 500, new_balance: 1700 }`

---

## Onboarding API

### `GET /api/onboarding`

Get current onboarding status.

**Response:** `{ completed: false, current_step: 2, total_steps: 4 }`

### `POST /api/onboarding`

Advance to next step. Steps must be completed sequentially (can't skip).

**Steps:** 0=not started, 1=welcome viewed, 2=profile basics, 3=avatar configured, 4=tutorial done (completes onboarding)

**Body:**
```json
{
  "step": 2,
  "profile_data": {
    "display_name": "Jane",
    "bio": "Hi!",
    "program": "CS",
    "year": "3",
    "avatar_config": { "body": "base_f", "hair": "long_1" }
  }
}
```

On step 4 (final): marks `onboarding_completed = true`, awards 100 coins + 50 XP welcome bonus.

**Errors:** `409` if already completed, `400` if skipping steps.

---

## Quest System API

### `GET /api/quests`

List quests with user's progress.

**Query params:** `?type=daily|weekly|seasonal`, `?status=available|in_progress|completed`

**Response:** Each quest includes `user_status`, `user_progress`, `accepted_at`, `completed_at`.

### `POST /api/quests`

Create quest (T1-T3 only).

**Body:** `{ title, description, quest_type, xp_reward?, tc_reward?, criteria?, max_completions?, start_date?, end_date?, is_recurring? }`

### `POST /api/quests/[id]/accept`

Accept a quest. Creates `quest_progress` row with status `accepted`.

**Errors:** `409` if already accepted, `404` if quest inactive.

### `POST /api/quests/[id]/complete`

Complete a quest. Awards `xp_reward` + `tc_reward`, records transactions.

**Response:** `{ completed: true, rewards: { coins: 50, xp: 100, new_balance: 650, new_xp: 3600, new_level: 8, new_rank: "Veteran" } }`

**Errors:** `400` if not accepted, `409` if already completed.

---

## Events/Calendar API

### `GET /api/events`

List events with optional date range and type filters. Each event includes attendee count and user's RSVP status.

**Query params:** `?type=club|team|bounty|volunteer|social|workshop|meeting`, `?from=ISO`, `?to=ISO`, `?limit=50` (max 200)

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Weekly Standup",
      "description": "Team sync",
      "event_type": "meeting",
      "start_time": "2026-04-10T14:00:00Z",
      "end_time": "2026-04-10T15:00:00Z",
      "location": "Discord",
      "is_all_day": false,
      "status": "approved",
      "tc_reward": 10,
      "xp_reward": 5,
      "created_by": "uuid",
      "attendee_count": 12,
      "user_rsvp": "registered"
    }
  ]
}
```

Only shows approved events. Sorted by start_time ascending.

---

### `POST /api/events`

Create an event (T1-T3 only). Auto-approved.

**Body:**
```json
{
  "title": "Hackathon Kickoff",
  "description": "24-hour build event",
  "event_type": "club",
  "start_time": "2026-04-15T09:00:00Z",
  "end_time": "2026-04-16T09:00:00Z",
  "location": "SEB 2100",
  "is_all_day": false,
  "tc_reward": 100,
  "xp_reward": 50
}
```

**Response:** `201 { "event": {...} }`

---

### `POST /api/events/[id]/rsvp`

Toggle RSVP for an event. If already registered, un-registers. If not registered, registers.

**Response:**
```json
{ "action": "registered"|"unregistered", "event_id": "uuid", "event_title": "Hackathon Kickoff" }
```

**Errors:** `404` if event not found, `400` if event not active.

---

## Inventory API

### `GET /api/inventory`

List user's owned avatar items with equipped state.

**Query params:** `?type=hair`, `?equipped=true|false`

**Response:**
```json
{
  "inventory": [
    {
      "id": "uuid",
      "item_id": "uuid",
      "equipped": true,
      "acquired_at": "2026-04-01T00:00:00Z",
      "avatar_items": {
        "id": "uuid",
        "name": "Cyber Mohawk",
        "type": "hair",
        "category": "shop",
        "coin_price": 200,
        "sprite_url": "/assets/items/hair_cyber.png",
        "rarity": "rare"
      }
    }
  ]
}
```

---

### `POST /api/inventory`

Equip or unequip an avatar item. Equipping auto-unequips any other item of the same type (one per slot).

**Body:** `{ action: "equip"|"unequip", item_id: "uuid" }`

**Response:** `{ success: true, action: "equipped", item_id: "uuid", item_name: "Cyber Mohawk" }`

**Errors:** `404` if item not in inventory, `409` if already equipped/unequipped.

---

## Achievement System API

### `GET /api/achievements`

List all achievements with user's unlock status.

**Query params:** `?include_secret=true` (default: false, hides secret achievements)

**Response:**
```json
{
  "achievements": [
    {
      "id": "uuid",
      "name": "first_bounty",
      "display_name": "Bounty Hunter",
      "description": "Complete your first bounty",
      "icon": "🎯",
      "tc_reward": 50,
      "xp_reward": 100,
      "is_secret": false,
      "criteria_type": "bounties_completed",
      "criteria_value": 1,
      "created_at": "2026-01-01T00:00:00Z",
      "unlocked": true,
      "unlocked_at": "2026-03-15T12:00:00Z"
    }
  ]
}
```

---

### `POST /api/achievements`

Create a new achievement (T1-T3 only).

**Body:**
```json
{
  "name": "first_bounty",
  "display_name": "Bounty Hunter",
  "description": "Complete your first bounty",
  "icon": "🎯",
  "tc_reward": 50,
  "xp_reward": 100,
  "is_secret": false,
  "criteria_type": "bounties_completed",
  "criteria_value": 1
}
```

**Response:** `201 { "achievement": {...} }`

**Errors:** `403` if not T1-T3, `409` if name already exists.

---

### `POST /api/achievements/[id]/award`

Award an achievement to a user (T1-T3 only). Awards associated TC + XP rewards with auto level-up.

**Body:** `{ user_id: "uuid" }`

**Response:**
```json
{
  "success": true,
  "achievement": "Bounty Hunter",
  "user": "uuid",
  "rewards": {
    "coins": 50,
    "xp": 100,
    "new_balance": 650,
    "new_xp": 3600,
    "new_level": 8,
    "new_rank": "Veteran"
  }
}
```

**Errors:** `403` if not T1-T3, `404` if achievement/user not found, `409` if already awarded.

---

## Shared Helper: `awardRewards()`

All XP-granting endpoints (bounty review, quest completion, onboarding, achievement award) use a shared `awardRewards()` helper from `@/lib/supabase/helpers`. This function:

1. Reads current profile (tethos_coins, xp, level, rank)
2. Computes new XP total
3. Auto-computes new `level` via `levelFromXp()` and `rank` via `rankFromLevel()`
4. Updates profile with new coins, xp, level, rank
5. Records TC transaction and XP transaction

This ensures level-up is automatic and consistent everywhere XP is granted.

---

## Oracle API

### `GET /api/oracle/quiz`

Returns 12 MBTI-style personality questions. 3 questions per dimension (E/I, S/N, T/F, J/P).

**Response:**
```json
{
  "questions": [
    {
      "id": 1,
      "dimension": "EI",
      "text": "At a guild meetup, you tend to...",
      "options": [
        { "label": "Jump into conversations with strangers", "pole": "E" },
        { "label": "Stick with people you already know", "pole": "I" }
      ]
    }
  ],
  "already_classified": false,
  "current_class": null,
  "current_subclass": null
}
```

---

### `POST /api/oracle/result`

Scores 12 answers → MBTI type → RPG class + subclass. Saves to profile.

**Body:**
```json
{
  "answers": [
    { "question_id": 1, "pole": "E" },
    { "question_id": 2, "pole": "I" },
    ...12 total
  ]
}
```

**Response:** `{ mbti_type: "INTJ", class: "ARCHITECT", subclass: "Mastermind" }`

**MBTI → Class mapping:**
| MBTI | Class | Subclass |
|------|-------|----------|
| INTJ | ARCHITECT | Mastermind |
| INTP | ORACLE | Sage |
| ENTJ | COMMANDER | Warlord |
| ENTP | STRATEGIST | Trickster |
| INFJ | ORACLE | Mystic |
| INFP | SCOUT | Dreamwalker |
| ENFJ | COMMANDER | Herald |
| ENFP | SCOUT | Wanderer |
| ISTJ | WARDEN | Sentinel |
| ISFJ | WARDEN | Guardian |
| ESTJ | OPERATIVE | Marshal |
| ESFJ | OPERATIVE | Consul |
| ISTP | ENGINEER | Artificer |
| ISFP | INITIATE | Bard |
| ESTP | ENGINEER | Tinker |
| ESFP | INITIATE | Jester |

---

## Jobs API

### `GET /api/jobs`

List job listings with optional filters.

**Query params:** `?type=internship|full_time|part_time|contract`, `?search=`, `?category=`, `?limit=50` (max 100)

**Response:** `{ jobs: [...] }`

Excludes flagged listings. Sorted by created_at desc.

---

### `POST /api/jobs`

Create a job listing. Any authenticated user can post.

**Body:**
```json
{
  "title": "Frontend Developer Intern",
  "company": "TechCorp",
  "location": "Toronto, ON",
  "job_type": "internship",
  "url": "https://techcorp.com/careers/123",
  "categories": ["engineering", "frontend"],
  "tags": ["react", "typescript"],
  "description": "Looking for a frontend intern..."
}
```

**Response:** `201 { "job": {...} }`

---

## Leaderboard API

### `GET /api/leaderboard`

Top N profiles sorted by XP desc with rank numbers.

**Query params:** `?limit=50` (max 100)

**Response:**
```json
{
  "leaderboard": [
    {
      "rank_position": 1,
      "id": "uuid",
      "display_name": "Jane Doe",
      "avatar_url": null,
      "tier": 3,
      "position": "developer",
      "class": "ENGINEER",
      "subclass": "Artificer",
      "level": 12,
      "xp": 5400,
      "rank": "Veteran",
      "is_active": true
    }
  ],
  "your_rank": 15,
  "total_returned": 50
}
```

If the requesting user isn't in the top N, `your_rank` is computed separately.

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

// Achievements
Achievement, UserAchievement, AchievementWithStatus

// Jobs
JobListing, JobType

// Leaderboard
LeaderboardEntry

// Oracle
OracleQuestion, OracleResult

// Events
CalendarEvent, EventType, AttendanceStatus

// Directory views
DirectoryMember, PublicProfile

// Mappings
POSITION_CLASS_MAP, POSITION_TIER_MAP, TIER_LABELS

// Helpers
xpForLevel(), levelFromXp(), rankFromLevel(), canAccessFeature()
```
