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
