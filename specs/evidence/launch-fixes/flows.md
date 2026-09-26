# Launch-readiness fixes: staging reruns (2026-09-26)

Staging `tethos-staging` (`jjiyeroyralfbluowbjq`) only; production was read with `"read_only": true` and never written. Accounts: the Phase 1 users (member T4, public, staff T2; ids in `specs/evidence/phase1/applied.md`) plus two made for this run, `launch-l1@tethos-staging.test` and `launch-l2@tethos-staging.test` (GoTrue admin API; passwords only in the keychain as `tethos-staging <email>`), and throwaway `launch-probe-*` sign-ups.

## Migrations applied to staging

Through the management API, one transaction per file (the runbook's step 2 command):

| File (name now) | Applied as | Result (UTC) |
|---|---|---|
| `20260926200000_membership_launch.sql` | `20260926190000_membership_launch.sql` (renamed after combat content took `190000`; content identical, git rename 100%) | ok 17:47:25 |
| `20260926200100_event_rsvp_cancel.sql` | `20260926190100_event_rsvp_cancel.sql` | ok 17:47:28 |
| `20260926190000_combat_content.sql` (merged from `feat/game-default-island`) | same | ok 17:53:27 |

The two launch files and combat content touch disjoint objects, so staging's order (launch files first) doesn't matter; production gets filename order.

Readback after `200000` (`stg-state.sql`): phase1-member (whitelisted) member T4, phase1-staff member T2, phase1-public public **4 → 5**, and a sign-up made before the migration (`launch-probe-before-plain`, public T4) public **4 → 5**. `handle_new_user` now sets the tier; `admin_set_membership` exists; `event_attendance` has `Users can cancel own RSVP` (DELETE, own row, `registered` only).

## 1. Membership on sign-up, with and without the invite code

Anonymous `POST /auth/v1/signup` with the anon key, `data.invite_code` as `/student/signup` sends it (after `invite_code_valid`); readback from `profiles`.

**Before `200000`** (staging as Phase 1 left it): no code → `public`, **tier 4**.

**Invite code rotation rehearsed** (runbook step 3, after `200000`): every active code off (`TETHOS-W26`), one new random code on. The code exists only in the keychain (`tethos-staging launch invite code`) and in staging's table; the SQL file that carried it was deleted.

```
invite_codes: TETHOS-W26 active=false ; (new, keychain) active=true
invite_code_valid(new code, lower-case, spaces) = true
invite_code_valid(TETHOS-W26) = false
list invite_codes as anon: []
```

**After:**

| Sign-up | membership | tier |
|---|---|---|
| new code (sent lower-case) | member | 4 |
| `tethos-w26` (deactivated) | public | 5 |
| no code | public | 5 |

Display names came through (`Launch Probe`); the name fallbacks are covered by `launch_fixes_smoke.sql` §2 (`full_name` only → "Grace Hopper").

## 2. Un-RSVP (member)

Straight at PostgREST with the member's JWT, which is what `/api/events/[id]/rsvp` does with the user key:

- **Before `200100`:** `DELETE /rest/v1/event_attendance?event_id=eq.2b43…&user_id=eq.c298…` → `200 []` (nothing deleted); readback: the `registered` row still there.
- **After:** the same request → `200 [{… "status":"registered"}]`; readback: no row.

## 3. Route reruns (dev server `:4200`, env `web/.env.staging.local` only, shared lock held)

`flows.mjs` signs in through `@supabase/ssr` (the same cookie the routes read), calls the real Next routes and reads back with the management API. Full log: `flows-run.txt` (36 checks, **ALL PASS**).

**Admin mark (`POST /api/admin/members/:id/membership`).** New plain account `launch-l1` → public T5 (trigger). Member T4 → 403; public → 403; staff with `{"membership":"boss"}` → 400; staff `member` → 200 `{membership: member, tier: 4}`, again → 200 no-op; readback member, T4, badge `member`. Staff making itself (T2) public → 409 "Staff (T1-T3) stay members"; unknown id → 404; the Phase 1 member made public → T5, then member again → T4.

**Un-RSVP (`POST /api/events/[id]/rsvp`, member).** `registered` → readback 1 row → `unregistered` → readback **0 rows** → `registered` again. With `launch-l1`'s JWT at PostgREST: deleting its own `attended` row removes nothing (row stays), deleting the member's RSVP removes nothing.

**Chapter completion with an injected failure.** Staging-only trigger `tmp_launch_fail` raising on the account's `chapter:settle-in` insert, dropped right after:

| Account | Injected in | `report_hq` | Readback after the failure (status, completed, reward rows, coins, letters) | Retry | Readback after the retry | Third call |
|---|---|---|---|---|---|---|
| `launch-l1` (member T4, marked by staff) | the letter (after the reward, the Phase 1 failure) | 500 | active, false, 1, 100, 0 | 200 completed | completed, true, 1, 100, 1 | 409, still 1 reward row |
| `launch-l2` (public T5) | the reward credit | 500 | active, false, 0, 0, 0 | 200 completed | completed, true, 1, 100, 1 | 409, still 1 reward row |

Before the fix (Phase 1, `specs/evidence/phase1/flows.md` §1) the same 500 left the chapter completed with no reward and every retry answered "Chapter already finished." The vitest fail-first test (`lib/progression/service.test.ts`, "a failure while finishing a chapter…") injects both failures in the memory store.

## 4. Verification query on staging

The runbook's step 5 query, run on staging after everything (`staging-verify.txt`): functions all present, `signup_public_t5` true; membership member T2 1, member T4 2, public T5 4 (before the route run added `launch-l1`/`l2`); policies `Event attendance insertable`, `Event attendance readable`, `Users can cancel own RSVP`; one active invite code, `TETHOS-W26` off; 0 tables without RLS; user-callable SECURITY DEFINER functions exactly the five from Phase 1; no cron jobs (staging never schedules the recruitment job).

## 5. Gates

- **SQL smoke chain** (`sql-smoke.sh`, throwaway Postgres 16, every migration through `20260926200100`, including combat content and character art 2's regenerated seeds): `sql-smoke-after.txt`, every smoke ok, no `ERROR`. Fail-first: `sql-smoke-before.txt` is `launch_fixes_smoke.sql` against the chain without the two launch files: all four sections fail.
- **tsc** clean; **vitest** 908 tests pass (after merging `feat/game-default-island` at `f838efb8`).

## 6. Staging kept in step with merges

- Combat content `20260926190000` applied 17:53Z (§ migrations).
- Character art pass 2 regenerated `catalogue_ref` on 7 seed rows in `150600_economy` and `160000_crafting`. Both inserts are `ON CONFLICT (slug) DO NOTHING`, so re-running the files changes nothing on an existing database; staging got the equivalent `update shop_items set catalogue_ref = …` for those 7 slugs (readback: all 7 set). Production gets the files fresh.

## Left on staging

`launch-l1`/`launch-l2` (keychain passwords) and the four `launch-probe-*` sign-ups stay as test data; the Phase 1 member keeps an RSVP on the RSVP test event. The rotated invite code is in the keychain only.
