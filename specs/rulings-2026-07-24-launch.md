# Launch Rulings — One-Pager (2026-07-24)

> Four blockers, one recommendation each. Rule inline (edit this file, tell me in chat, or say "approve all") and the loop picks up the buildable launch items immediately. Context: `specs/sprint-2026-08-launch-track.md`.

## 1. Migration hold (L1) — RECOMMEND: formally lift it

The 2026-07-03 remote inspection (you watching) found migrations 014-022 **already applied** to prod Supabase — tables, seeds, check-in columns, both storage buckets all present — and `bounty_submissions` was restored via ledger-recorded migration. The hold is guarding a door that's already open. Nothing new needs applying; lifting the hold just makes the paperwork match reality.

**Action on approval:** I run `_check-migrations.mjs` extended to diff expected schema vs live and report any drift; hold language removed from CLAUDE.md/qa.md/ux-status.

**Sub-item:** `bounty_deliverables` (empty legacy table) has RLS DISABLED — Supabase critical advisory. Recommend: enable deny-all RLS (one statement, embed keeps returning empty, closes the advisory).

## 2. Deploy safety (L2) — RECOMMEND: convention + smoke, no new infra

Vercel already builds previews per branch. The actual risk was mid-iteration commits auto-deploying from main. Recommend: (a) document the convention "main receives only QA-waved merges" (we're already living it — the art branch has 300+ commits off-main), (b) I build a one-command post-deploy smoke script (`/` 200, login 200, dashboard 307, key APIs 401) that runs after every merge. No CI gate to maintain, no promote step to forget.

## 3. Beta cohort + date (L4) — RECOMMEND: 5-8 execs, week of Aug 17

Small enough to hand-hold, big enough to exercise leaderboard anonymization (needs 10+ profiles — seed the rest with test accounts). You pick names; I need the count and the date to build the funnel instrumentation against. Mid-August keeps two weeks of fix headroom before Sept 1.

## 4. Prod `ANTHROPIC_API_KEY` — RECOMMEND: confirm it's set in Vercel env

Two minutes in the Vercel dashboard. Without it, NPC chat dead on prod and the beta's most magical feature no-ops. I can't verify env vars from here — this one is purely yours.

---

## Already decided today (recorded, no action needed)

- **Next loop rock:** cliff system (river-kit bank pieces archived at `7143205` are the prep).
- **Merge path:** full QA wave on `restart/art-cohesion-v2` → your in-game eyeball → merge to main before beta prep.
- **Sea King:** vacant until you supply marquee models; wiring is a one-wake job when they land.
