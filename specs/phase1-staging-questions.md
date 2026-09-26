# phase1-staging: open questions for David

Each has the assumption I worked on. None blocks the branch.

1. **All 315 production profiles become members at launch.** `20260926150700_identity` adds `profiles.membership` with default `'member'` at ALTER time ("existing profiles are club members"), then switches the default to `'public'`. 217 of the 315 are recruitment applicants who signed in with Google to apply. *Assumption:* left as written; the launch data reset (roadmap Phase 4, decision 48) should set `membership = 'public'` for profiles that aren't real members (e.g. not on the whitelist and tier 4 with an application). David decides.

2. **The only active invite code in production is public.** `TETHOS-W26` is seeded in `001_initial_schema.sql` (in git) and is production's single active code (read-only check). With identity's sign-up trigger, any email sign-up carrying that code becomes a TSI member, and production has email sign-up on with auto-confirm. `20260926155300` stops codes being listed, but can't un-publish this one. *Assumption:* David or the coordinator deactivates it and issues a new code before the launch migrations run (a production write, so not done here).

3. **Public accounts are tier 4.** The `profiles.tier` column default is 4, so a public account has the same tier as directors/developers. Nothing I exercised grants anything at tier 4 that a member alone should have (routes gate on T1/T2, RLS on `<= 3`), so no fix. *Assumption:* fine for launch; a default of 5 for public accounts would match the RBAC table.

4. **The ruins gate is client-side only.** `/api/combat/missions/start` accepted an inner-zone mission (`hunt-wisps`) for a level-1 member with no family (gate reason "Visit the Oracle…"), and mission progress is client-reported. See `flows.md` (combat). *Assumption:* not fixed; the gate rule (family + level 10 + subclass) and where XP comes from before level 10 need a ruling first. If inner missions must be gated, the smallest fix is a zone check in `startMission` using `islandProgression`.

5. **Production's migration ledger is incomplete.** `supabase_migrations.schema_migrations` lists 10 versions; `001`–`028` and the two 2026-09-26 security files were run in the SQL editor. *Assumption:* launch applies files by hand in name order (as `applied.md`); nobody runs `supabase db push` against production without `migration repair` first.

6. **`avatar_config` is added twice.** `20260926155000_schema_drift_reconcile` (all three 004 columns + grants) and study-character's `20260926170000_profiles_avatar_config` (merged later) both add it idempotently with the grant; on staging the second is a no-op. *Assumption:* keep both (harmless); drop `170000` if you want one source.

7. **Un-RSVP does nothing in production.** `/api/events/[id]/rsvp` deletes the user's row with the user's key; the delete policy (`008`) never ran in production and the reconciliation drops it from fresh replays (with it, a member could delete and re-insert attendance). The route answers success while the row stays. *Assumption:* legacy portal, left as is.

8. **Chapter completion is not atomic.** `advanceChapter` saves the chapter as completed, then sends the letter, then pays the reward. Any failure after the save loses the reward for good (a retry answers "Chapter already finished"); that's how the 500 on staging cost the member chapter 1's 100 coins. The root cause (the letters index) is fixed. *Assumption:* not reordered; crediting first (the credit is idempotent) would make any later failure retry-safe.

## Coordinator rulings (2026-09-26)
1. **Membership at launch:** existing profiles default to `public`; backfill `member` for tier ≤ 3, for applicants hired through recruitment (application status hired/accepted in the recruitment tables), and for anyone a T1/T2 admin marks (admin pass adds a "mark member" tool). New sign-ups are public unless they use the active invite code.
2. **Invite code:** rotate at launch; the new code lives only in the database (never in a migration or seed); `TETHOS-W26` is deactivated.
3. **Public accounts are tier 5** (general), members keep 4 or their assigned tier; the drift reconcile already widens the tier check to 1–5.
4. **Ruins gate server-side:** being fixed in combat content A.
5. **Launch applies migrations through the management API in filename order; never `supabase db push`** (production's migration ledger is incomplete). Recorded in the roadmap's launch steps.
6. Double `avatar_config` add: both idempotent; keep both (the later one carries a smoke test).
7. **Un-RSVP:** restore an owner-only delete policy on event RSVPs in the reconcile migration so members can cancel their own RSVP.
8. **Chapter completion atomic:** completion, letter and reward in one service transaction, or retries pay an unpaid reward; fail-first test.
Items 1, 3, 7, 8 are implemented by the launch-readiness fixes task (`specs/launch-readiness-fixes.md`).
