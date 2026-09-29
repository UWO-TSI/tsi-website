# Sprint: Launch Track — From Beautiful World to Live Community

> **Goal:** Get real TSI members into the world. The village is now genuinely good (organic island, interiors, fishing, lighting v4, ACNH kit) — but zero members have touched it, migrations are on hold, content is unseeded, and prod auto-deploys with no gate. This track closes the launch half while David's world loop keeps running.
> **Why now:** David set the anchor 2026-07-22: **Sept fall onboarding is the launch moment, August exec beta is the gate before it.** That's ~6 weeks out.
> **Sprint window:** 2026-07-22 → ~2026-08-31 (beta mid-August, launch-ready by Sept 1)
> **Owner:** `build` agent + David (several items are his alone). Reviewer: David.
> **Origin:** 2026-07-22 restart audit on `7143205` (fresh Playwright sweep, 18 captures, desktop + mobile LITE). This spec deliberately does NOT plan world/art work — that's David's standing loop with its own queue (cliffs prep, lighting verdict, flag-list).

---

## What the restart audit found (state on `7143205`)

**The world track is in great shape.** Round curved island with ocean horizon, three distinct GLB buildings with furnished interiors, river v2 with bank walls, ACNH road tiles, plaza + fountain + market cart, player/NPC pixel sprites, toolbelt dock HUD, sheet system over the living world, minimap, weather matrix, fishing/critters/collection book, CC0 audio shipped, mobile LITE mode v1. Lint 74/52 baseline, tests 32/32, QA waves through 28. The 2026-07-22 decisions "art & cohesion focus / overlay conversion" are **already satisfied** by the July loop.

**The launch track is untouched:**

| # | Gap | Severity for Sept |
|---|-----|-------------------|
| G1 | Migrations 014-022 ON HOLD (David 2026-07-01) — NPC chat, community loops, events check-in, content pipeline, bounty submissions all dead against prod DB until applied | Blocker |
| G2 | Zero seeded content: bounty board, shop, events all empty. The beautiful world opens onto empty feature pages | Blocker |
| G3 | No real member has ever completed signup → onboarding → oracle → world on prod | Blocker |
| G4 | Prod auto-deploys `main` on every push, no staging gate — mid-art-iteration commits go straight to tethos.ca (flagged in AGENT_LOG 2026-07-14, no ruling yet) | High |
| G5 | Admin monthly-drop cadence (principle #8) never dry-run end-to-end by a human admin | High |
| G6 | Mobile LITE "village is quiet" state depends on presence data that needs G1 migrations | Medium |
| G7 | August beta: no cohort, no date | David's call |

**Bugs found + already fixed this session** (commit `0b17a99`): calendar crashed without env AND silently showed zero events in prod (queried a nonexistent `type` column — schema is `event_type`); welcome modal showed WASD/right-click copy to touch users who entered full 3D from LITE mode; added `web/scripts/_check-deps.mjs` (dependency-resolution check for QA waves — a missing-dep incident killed the world route in another checkout).

---

## Definition of Done

1. All portal migrations applied to prod Supabase (or David's explicit subset ruling documented), and every feature page verified against the live schema.
2. Bounty full cycle works on prod: post → claim → submit deliverables → admin review → TC lands in the member's balance.
3. First real event exists with a printed QR code; check-in grants XP on scan (principle #3's only XP path, proven live).
4. Shop has ≥5 real items; a test purchase completes.
5. 5-15 exec beta members complete signup → onboarding → oracle quiz → enter the world, on their own devices, without hand-holding. Drop-off points logged.
6. A T2 admin (not David) executes one full monthly content drop through the CMS alone: new NPC + new shop item + new event + palette switch.
7. Deploy safety ruling implemented (G4): either preview-branch flow or an accepted straight-to-prod policy with a post-deploy smoke check.
8. Mobile LITE shows real presence (ghosts/NPC positions) once migrations land — "the village is quiet" only when it actually is.
9. Gates hold: `tsc` clean, lint ≤ 74/52, tests green, build passes.

---

## Deliverables

### L1. Migration apply + schema verification (David + build)
- David lifts the 2026-07-01 hold (or rules a subset). Sequence: apply 014-022 in order on prod Supabase; `web/scripts/_check-migrations.mjs` extended to diff expected tables/columns against live schema and report drift.
- Post-apply verification matrix: NPC chat (needs `ANTHROPIC_API_KEY` in prod env), emotes log, guestbook, player positions/ghosts, events check-in columns, content pipeline tables, bounty-submissions bucket.
- **Risk note:** recruitment system shares the DB and is live — apply during a quiet window, verify recruitment flows after (`/apply` smoke).

### L2. Deploy safety (David ruling + build implementation)
- Options for G4: (a) Vercel preview deployments per branch + manual promote of `main`; (b) keep auto-deploy but add a required status check (build + lint + `_check-deps.mjs` + smoke) before push lands on main; (c) accept as-is, documented.
- Whatever the ruling, add a post-deploy smoke script (hit `/`, `/student/login`, `/student/dashboard` 307, key APIs 401) that can be run in one command.

### L3. Content seeding via the CMS (David/T2 admin, build supports)
- Seed through the admin UI, not SQL — this doubles as the G5 dry-run: 5-10 real bounties with TC values, ≥5 shop items, the first real IRL event (QR printed), one seasonal palette queued for September.
- Build fixes whatever friction the dry-run surfaces in the editors (that's the deliverable: the CMS survives contact with a real admin).

### L4. Beta cohort onboarding (David picks cohort, build instruments)
- David: 5-15 exec/senior members + a date in mid-August.
- Build: onboarding funnel instrumentation (signup → onboarding steps → oracle → first world entry, timestamps per step into an existing table or lightweight log), plus a pre-beta E2E pass with 2-3 test accounts on prod.
- Fix-first rule during beta week: member-reported breakage outranks all other work.

### L5. Feature-loop verification on prod data (build)
- Bounty cycle end-to-end (the Wave 18 XP-zeroing + TC payout path, live).
- Leaderboard top-half/bottom-half anonymization with 10+ real profiles.
- Sheet system deep links (`?sheet=bounty` etc.) against auth'd sessions.
- Calendar shows the seeded events (the `event_type` fix in `0b17a99` makes this possible — it silently showed nothing before).

### L6. Mobile LITE presence polish (build, after L1)
- Wire ghosts/NPC dots into the LITE minimap so a phone member sees a living village, not "quiet right now".
- Verify emote row logs to `emote_logs` from LITE.

### L7. Launch comms (David, out of agent scope)
- Invite copy, launch-week Instagram assets, GENESIS-style announcement. Note only — `/social-post` exists for this.

---

## Sequencing

- **Week 1 (Jul 22-28):** L2 ruling + smoke script; L1 if David lifts the hold early.
- **Week 2-3 (Jul 29-Aug 11):** L1 apply + verify → L3 seeding dry-run → L5 verification. L6 after L1.
- **Week 4 (Aug 12-18):** L4 beta week. Fix-first.
- **Week 5-6 (Aug 19-31):** beta findings → fixes → launch-ready call.

## Explicitly out of scope

- World/art iteration — David's standing loop owns it (active queue: cliff system prep `7143205`, lighting-chemistry final verdict, flag-list: brick plaza, plaza stalls, seasonal/winter variants, hedge/park fences).
- Colyseus multiplayer, Nano Banana avatar creator, Oracle v2 (unchanged Phase-2+).
- Recruitment system (except the L1 post-apply smoke).

## David's personal checklist (nothing moves without these)

1. Rule on the migration hold (L1) — the single biggest unblock.
2. Rule on deploy safety (L2): preview flow / gated main / accept as-is.
3. Pick beta cohort + date (L4).
4. Confirm `ANTHROPIC_API_KEY` in prod env (NPC chat).
5. Keep the world loop running — it's working. The AC snapshots verdict on the pastel grade is still open from 2026-07-15.
