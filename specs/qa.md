# QA Report

> Owner: QA agent. All agents check this for bugs in their area.
> Last updated: 2026-03-30

---

## Wave 4 — Post-Backend Merge Full Retest

### Build Report (`npm run build`)

**Result: ✅ BUILD PASSES**

- Next.js 16.1.6 (Turbopack)
- Compiled successfully in 9.0s
- TypeScript check: passed
- Pages generated: **45** (up from 14 in Wave 1)
- New warning: `"middleware" file convention is deprecated. Please use "proxy" instead.`

**All routes:**
| Route | Type | Status |
|-------|------|--------|
| `/` | Static | ✅ |
| `/_not-found` | Static | ✅ |
| `/api/an-token` | Dynamic | ✅ |
| `/api/directory` | Dynamic | ✅ NEW |
| `/api/profile` | Dynamic | ✅ NEW |
| `/api/profile/[id]` | Dynamic | ✅ NEW |
| `/company` | Static | ✅ |
| `/globe-demo` | Static | ✅ |
| `/globe-test` | Static | ✅ |
| `/navbar-test` | Static | ✅ |
| `/npo` | Static | ✅ |
| `/npo/test` | Static | ✅ NEW |
| `/pylon-demo` | Static | ✅ |
| `/sponsor` | Static | ✅ |
| `/student` | Static | ✅ |
| `/student/auth/callback` | Dynamic | ✅ NEW |
| `/student/dashboard` | Dynamic | ✅ NEW |
| `/student/dashboard/admin` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/analytics` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/announcements` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/bounties` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/election` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/members` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/bounty` | Dynamic | ✅ NEW |
| `/student/dashboard/calendar` | Dynamic | ✅ NEW |
| `/student/dashboard/directory` | Dynamic | ✅ NEW |
| `/student/dashboard/jobs` | Dynamic | ✅ NEW |
| `/student/dashboard/kanban` | Dynamic | ✅ NEW |
| `/student/dashboard/leaderboard` | Dynamic | ✅ NEW |
| `/student/dashboard/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/mentorship` | Dynamic | ✅ NEW |
| `/student/dashboard/portfolio` | Dynamic | ✅ NEW |
| `/student/dashboard/profile` | Dynamic | ✅ NEW |
| `/student/dashboard/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/tools` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/ascii` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/rag` | Dynamic | ✅ NEW |
| `/student/election` | Static | ✅ NEW |
| `/student/login` | Static | ✅ NEW |
| `/student/onboarding` | Static | ✅ NEW |
| `/student/signup` | Static | ✅ NEW |
| `/under-construction` | Static | ✅ |

**Dashboard pages: 23 total** (15 regular + 8 admin)

---

### Lint Report (`npm run lint`)

**Result: ❌ LINT FAILS (exit code 1)**

#### NEW errors from Backend's dashboard pages

| File | Error | Rule |
|------|-------|------|
| `student/dashboard/admin/announcements/page.tsx:31` | `fetchAnnouncements` accessed before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx:5` | Unused import `Check` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/bounty/page.tsx` | Multiple `fetchX` before declaration errors | `react-hooks/immutability` |
| `student/dashboard/calendar/page.tsx` | `fetchEvents` before declaration | `react-hooks/immutability` |
| `student/dashboard/directory/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/jobs/page.tsx` | `fetchJobs` before declaration | `react-hooks/immutability` |
| `student/dashboard/kanban/page.tsx` | `fetchBoard` before declaration | `react-hooks/immutability` |
| `student/dashboard/leaderboard/page.tsx` | `fetchLeaderboard` before declaration | `react-hooks/immutability` |
| `student/dashboard/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/mentorship/page.tsx` | `fetchMentors` before declaration | `react-hooks/immutability` |
| `student/dashboard/portfolio/page.tsx` | `fetchPortfolio` before declaration | `react-hooks/immutability` |
| `student/dashboard/profile/page.tsx` | `fetchProfile` before declaration | `react-hooks/immutability` |
| `student/dashboard/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/analytics/page.tsx:53` | Unused `tcSpent` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/admin/members/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx` | `fetchBounties` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/announcements/page.tsx` | `fetchAnnouncements` before declaration | `react-hooks/immutability` |

**Pattern:** Nearly ALL dashboard pages use `useEffect(() => { fetchX(); }, [])` with `fetchX` declared AFTER the effect. The function hoisting works at runtime but the React hooks linter flags it as accessing a variable before declaration.

**Fix:** Move each `async function fetchX()` declaration ABOVE the `useEffect` that calls it, or wrap in `useCallback`.

#### Pre-existing errors (from Wave 1)

| File | Error | Rule |
|------|-------|------|
| `components/cards/CardCarouselLayout.tsx:30` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/layout/GlassNavbar.tsx:213` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/ui/InteractivePylon3D.tsx:85` | Modifying hook return value | `react-hooks/immutability` |
| `components/ui/Lanyard.tsx` | 7x `any` types | `@typescript-eslint/no-explicit-any` |

#### Warnings (~35 total)

Mostly `@typescript-eslint/no-unused-vars` across marketing pages and dashboard widgets. See lint output for full list. Key new ones:
- `components/dashboard/widgets/AnnouncementWidget.tsx:3` — unused `Link`
- `components/dashboard/widgets/CalendarWidget.tsx:25` — unused `formatDate`
- `app/npo/test/page.tsx:621` — missing dep `data` in useEffect
- `app/npo/sections/NPOAbout.tsx:120` — `<img>` should be `<Image />`

---

### Marketing Pages

**Result: ✅ ALL 5 PASS**

| Page | Route | Build Status |
|------|-------|-------------|
| Home | `/` | ✅ Static |
| NPO | `/npo` | ✅ Static |
| Company | `/company` | ✅ Static |
| Sponsor | `/sponsor` | ✅ Static |
| Student | `/student` | ✅ Static |

---

### Auth Flow Testing (Code Review)

**Result: ✅ Auth infrastructure NOW EXISTS (after Backend merge)**

Cannot do runtime testing without Supabase credentials, but code review confirms:

#### Files present
| File | Status |
|------|--------|
| `web/lib/supabase/client.ts` | ✅ Browser client helper |
| `web/lib/supabase/server.ts` | ✅ Server client helper |
| `web/lib/supabase/middleware.ts` | ✅ Route protection (162 lines) |
| `web/lib/supabase/types.ts` | ✅ Full type system (301 lines) |
| `web/middleware.ts` | ✅ Next.js middleware entry point |
| `web/app/student/signup/page.tsx` | ✅ Signup page (343 lines) |
| `web/app/student/login/page.tsx` | ✅ Login page (232 lines) |
| `web/app/student/auth/callback/route.ts` | ✅ Auth callback handler |
| `web/app/student/onboarding/page.tsx` | ✅ Onboarding flow (750 lines) |
| `web/app/student/election/page.tsx` | ✅ Election page (601 lines) |

#### Middleware routing logic (verified via code review)

| Route | Condition | Action |
|-------|-----------|--------|
| `/student/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/election` | `ENABLE_ELECTION === 'true'` + no auth | Redirect to `/student/login` |
| `/student/dashboard/admin/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/dashboard/admin/election` | Auth + T3+ | Redirect to `/student/dashboard` (T1/T2 only) |
| `/student/dashboard/admin/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/admin/*` | Auth + T4/T5 | Redirect to `/student/dashboard` |
| `/student/dashboard/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/*` | Auth + `!onboarding_completed` | Redirect to `/student/onboarding` |
| `/student/onboarding` | No auth | Redirect to `/student/login` |
| `/student/onboarding` | Auth + `onboarding_completed` | Redirect to `/student/dashboard` |
| `/student/login` or `/student/signup` | Logged in | Redirect to `/student/dashboard` |

**Middleware matcher covers:** `/student/dashboard/:path*`, `/student/login`, `/student/signup`, `/student/onboarding/:path*`, `/student/election`

#### Invite code
- `TETHOS-W26` seeded in migration `001_initial_schema.sql` line 658 as active invite code for term `W2026`

---

### Dashboard Pages Inventory (23 pages)

#### Regular dashboard (15 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Home | `/student/dashboard` | ✅ | ✅ |
| Directory | `/student/dashboard/directory` | ✅ | ✅ |
| Bounty Board | `/student/dashboard/bounty` | ✅ | ✅ |
| Calendar | `/student/dashboard/calendar` | ✅ | ✅ |
| Jobs | `/student/dashboard/jobs` | ✅ | ✅ |
| Kanban | `/student/dashboard/kanban` | ✅ | ✅ |
| Leaderboard | `/student/dashboard/leaderboard` | ✅ | ✅ |
| Marketplace | `/student/dashboard/marketplace` | ✅ | ✅ |
| Mentorship | `/student/dashboard/mentorship` | ✅ | ✅ |
| Portfolio | `/student/dashboard/portfolio` | ✅ | ✅ |
| Profile | `/student/dashboard/profile` | ✅ | ✅ |
| Quests | `/student/dashboard/quests` | ✅ | ✅ |
| Tools | `/student/dashboard/tools` | ✅ | ✅ |
| Tools > ASCII | `/student/dashboard/tools/ascii` | ✅ | ✅ |
| Tools > RAG | `/student/dashboard/tools/rag` | ✅ | ✅ |

#### Admin dashboard (8 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Admin Home | `/student/dashboard/admin` | ✅ | ✅ |
| Analytics | `/student/dashboard/admin/analytics` | ✅ | ✅ |
| Announcements | `/student/dashboard/admin/announcements` | ✅ | ✅ |
| Bounties | `/student/dashboard/admin/bounties` | ✅ | ✅ |
| Election | `/student/dashboard/admin/election` | ✅ | ✅ |
| Marketplace | `/student/dashboard/admin/marketplace` | ✅ | ✅ |
| Members | `/student/dashboard/admin/members` | ✅ | ✅ |
| Quests | `/student/dashboard/admin/quests` | ✅ | ✅ |

---

### Profiles Table Schema (FULL documentation)

#### From `001_initial_schema.sql` — profiles table

| Column | Type | Default | Nullable | Constraint |
|--------|------|---------|----------|------------|
| `id` | UUID | — | NOT NULL | PK, FK → auth.users(id) ON DELETE CASCADE |
| `email` | TEXT | — | NOT NULL | — |
| `display_name` | TEXT | — | NOT NULL | — |
| `tier` | INTEGER | 4 | NOT NULL | CHECK (1-4), upgraded to 1-5 in 004 |
| `position` | TEXT | NULL | YES | — |
| `class` | TEXT | NULL | YES | — |
| `subclass` | TEXT | NULL | YES | — |
| `team_id` | UUID | NULL | YES | FK → teams(id) |
| `portfolio` | TEXT | NULL | YES | — |
| `side` | TEXT | NULL | YES | — |
| `xp` | INTEGER | 0 | NOT NULL | — |
| `level` | INTEGER | 1 | NOT NULL | — |
| `rank` | TEXT | 'Initiate' | NOT NULL | — |
| `tethos_coins` | INTEGER | 0 | NOT NULL | — |
| `onboarding_completed` | BOOLEAN | FALSE | NOT NULL | — |
| `onboarding_step` | INTEGER | 0 | NOT NULL | — |
| `has_voted` | BOOLEAN | FALSE | YES | Added in 002 |
| `year` | TEXT | NULL | YES | — |
| `program` | TEXT | NULL | YES | — |
| `hometown` | TEXT | NULL | YES | — |
| `birthday` | DATE | NULL | YES | — |
| `phone` | TEXT | NULL | YES | — |
| `preferred_email` | TEXT | NULL | YES | — |
| `uwo_email` | TEXT | NULL | YES | — |
| `gdrive_email` | TEXT | NULL | YES | — |
| `github_username` | TEXT | NULL | YES | — |
| `instagram` | TEXT | NULL | YES | — |
| `linkedin` | TEXT | NULL | YES | — |
| `discord_tag` | TEXT | NULL | YES | — |
| `favourite_music` | TEXT | NULL | YES | — |
| `dream_retirement` | TEXT | NULL | YES | — |
| `spirit_animal` | TEXT | NULL | YES | — |
| `fun_fact` | TEXT | NULL | YES | — |
| `avatar_url` | TEXT | NULL | YES | — |
| `bio` | TEXT | NULL | YES | — |
| `active_theme` | TEXT | 'dark' | NOT NULL | — |
| `is_alumni` | BOOLEAN | FALSE | NOT NULL | — |
| `is_active` | BOOLEAN | TRUE | NOT NULL | — |
| `created_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `updated_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `last_login_at` | TIMESTAMPTZ | NULL | YES | — |
| `login_streak` | INTEGER | 0 | NOT NULL | — |
| `avatar_config` | JSONB | '{}' | NOT NULL | Added in 004 |
| `skills` | TEXT[] | '{}' | NOT NULL | Added in 004 |
| `social_links` | JSONB | '{}' | NOT NULL | Added in 004 |

**Total: 42 columns** (39 from 001, +1 from 002, +3 from 004)

#### Indexes (from 004)
- `idx_profiles_tier` — on `tier`
- `idx_profiles_is_active` — on `is_active`
- `idx_profiles_display_name` — on `display_name`
- `idx_profiles_level` — on `level`
- `idx_profiles_position` — on `position`
- `idx_profiles_class` — on `class`
- `idx_profiles_display_name_trgm` — GIN trigram on `display_name` (requires pg_trgm)

#### RLS Policies
- `SELECT`: authenticated users can read all profiles
- `UPDATE`: users can update own profile only (auth.uid() = id)
- `INSERT`: users can insert own profile (auth.uid() = id)

#### Auto-profile creation (003)
- Trigger `on_auth_user_created` fires after `INSERT ON auth.users`
- Creates profile with: `id`, `email`, `display_name` (from metadata or email prefix)

---

### All Migrations Summary

| Migration | Contents |
|-----------|----------|
| `001_initial_schema.sql` | 30 tables, RLS policies, seed data (themes, achievements, invite code TETHOS-W26) |
| `002_election_votes.sql` | `election_votes` table, `has_voted` column on profiles, `get_election_results()` function |
| `003_profile_trigger.sql` | `handle_new_user()` trigger for auto-profile creation on signup |
| `004_cleanup_and_extend.sql` | Tier constraint 1-5, `avatar_config`, `skills`, `social_links` columns, 7 indexes |
| `005_avatar_items.sql` | `avatar_items` table, `player_inventory` table, indexes, RLS |
| `006_bounty_system.sql` | `bounty_submissions` table with review workflow, indexes, RLS |

### All Tables (32 total)

profiles, teams, invite_codes, announcements, announcement_dismissals, bounties, bounty_claims, bounty_deliverables, bounty_submissions, events, event_attendance, kanban_boards, kanban_columns, kanban_cards, kanban_card_assignees, kanban_card_labels, kanban_card_comments, kanban_card_checklist, marketplace_items, marketplace_orders, job_listings, job_comments, quests, quest_progress, achievements, user_achievements, tc_transactions, xp_transactions, notifications, mentorship_profiles, mentorship_matches, portfolios, portfolio_items, time_capsules, themes, user_themes, election_votes, avatar_items, player_inventory

---

### API Routes Testing (Code Review)

| Route | Method | Auth Required | Status |
|-------|--------|--------------|--------|
| `GET /api/directory` | GET | Yes (Supabase session) | ✅ Exists, builds |
| `GET /api/profile` | GET | Yes | ✅ Exists, builds |
| `PATCH /api/profile` | PATCH | Yes | ✅ Exists, builds |
| `GET /api/profile/[id]` | GET | Yes | ✅ Exists, builds |
| `POST /api/an-token` | POST | No | ✅ Pre-existing |

Cannot runtime test without Supabase credentials configured.

---

### Middleware Deprecation Warning

**NEW:** Next.js 16.1.6 warns: `The "middleware" file convention is deprecated. Please use "proxy" instead.`

This affects `web/middleware.ts`. The current middleware still works but should be migrated to the `proxy` convention before the next Next.js major version. Not blocking.

---

### Dependency Issues

- **Peer dependency conflict:** `@ai-sdk/react` vs React 19 — requires `--legacy-peer-deps` (resolved via `.npmrc`)
- **npm vulnerabilities:** 10 total (7 moderate, 3 high)
- **New deps added:** `@supabase/supabase-js`, `@supabase/ssr` — installed successfully

---

### Summary

| Check | Wave 1 | Wave 4 | Change |
|-------|--------|--------|--------|
| Build | ✅ 14 pages | ✅ 45 pages | +31 pages, all compile |
| Lint errors | ~25 | ~40+ | +15 new (mostly `fetchX` before declaration) |
| Lint warnings | ~30 | ~35 | +5 new |
| Auth flow | ⚠️ N/A | ✅ Code complete | Full auth + middleware built |
| Marketing pages | ✅ 5/5 | ✅ 5/5 | No regression |
| Dashboard pages | N/A | ✅ 23/23 | All build as dynamic |
| Profiles schema | ⚠️ N/A | ✅ 42 columns documented | Full schema exists |
| Migrations | ⚠️ N/A | ✅ 6 migrations, 32+ tables | Complete |
| API routes | N/A | ✅ 4 routes | All build |
| Middleware | N/A | ✅ 5 route patterns | Deprecation warning |

### Critical Items for Other Agents

**Backend:**
- Fix the `fetchX` before declaration pattern across ALL dashboard pages — move function declarations above the `useEffect` calls
- Fix unused imports (`Check` in bounties, `Link` in AnnouncementWidget, `formatDate` in CalendarWidget)

**Frontend:**
- Game world (R3F) is the #1 priority — zero game code exists yet
- Pre-existing lint errors still need fixing (CardCarouselLayout setState, InteractivePylon3D pointer mutation)

**Management:**
- `middleware.ts` deprecation warning — plan migration to `proxy` convention
- 10 npm vulnerabilities should be audited before production deploy
