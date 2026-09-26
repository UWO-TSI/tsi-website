# Launch-readiness fixes (from Phase 1)

Owner: one agent. Rulings 1, 3, 7, 8 at the end of `specs/phase1-staging-questions.md`. Load `ponytail`. Every fix with a fail-first test (SQL smoke or vitest); rerun the Phase 1 staging flows that touch them on `tethos-staging` (ref `jjiyeroyralfbluowbjq`, access as in `specs/phase1-staging.md`; production read-only only).
1. Membership default and backfill in the identity migration path (new timestamped migration; do not rewrite applied-on-staging history silently: add a follow-up migration that sets existing non-staff, non-hired profiles to `public` and new sign-ups to `public` unless invite code), plus a T1/T2-only `POST /api/admin/members/:id/membership` route (the admin UI comes in the admin pass).
2. Public accounts tier 5 on sign-up (trigger path), members unchanged; make sure no tier-4 gate grants public accounts member-only club tools (grep the tier checks).
3. Event RSVP owner-only delete policy in a migration; test un-RSVP.
4. Chapter completion atomic (single service function or idempotent reward on retry); test failure-after-save.
5. Launch runbook `specs/launch-runbook.md`: exact order (Pro upgrade if needed → drift reconcile → security/game migrations in filename order via management API → invite code rotation → deploy → verification queries → smoke flows), rollback notes, and the reminder never to use `db push`.
Gates: tsc, full vitest, SQL smoke chain, staging reruns with evidence under `specs/evidence/launch-fixes/`.
