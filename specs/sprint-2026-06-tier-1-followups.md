# Sprint: Tier-1 Punch List Follow-ups (Round 3+)

> **Owner:** reviewer · **Date:** 2026-06-02
> **Status:** Dispatch-ready. Waits on Round 1 (build-A ✅, build-B, qa) + Round 2 (build-C, build-D) to land.

## Goal

Close the remaining design-debt items that didn't fit in the Tier-1 punch list (items 1-7 covered by Rounds 1+2) plus the visual-debt followups deferred from the 2026-06-01 autonomous burst. After this round, the portal is **merge-ready to main** per the Tier-1 "merge-ready" definition.

## What's already done (Rounds 1+2)

| Item | Round | Owner | Status |
|------|-------|-------|--------|
| Settings: 4 tabs + sign out | 1 | build-A | ✅ `8556faf` |
| Oracle: Lucide + Mage color + exit | 1 | build-B | in flight |
| QA Wave 16 baseline | 1 | qa | in flight |
| Leaderboard: own-row + sticky + tier-half policy | 2 | build-C | in flight |
| Bounty: submit deliverables | 2 | build-D | in flight |

## Round 3 deliverables

| # | Deliverable | Owner | Effort | Conflicts? |
|---|-------------|-------|--------|------------|
| R3-1 | Quest checklist widget (`ux-onboarding.md` §5) | build | Medium | None — new floating component |
| R3-2 | Dark/light theme toggle (`ux-settings.md` §6.2-6.4) | build | Small | Touches Appearance tab from build-A — clean handoff |
| R3-3 | Sky shader sun/moon corona (P12 + P17 deferred) | build | Medium | None — GameWorld shader patch |
| R3-4 | Avatar editor inline preview (`ux-dashboard.md` §6) | build | Medium | Blocked on Nano Banana sprite gen — defer to Phase 2 |

### R3-1: Quest checklist widget

- Floating widget bottom-right, collapsible, opt-in per design principle #7.
- Spec: `ux-onboarding.md` §5. Reads from a `quests` table or hardcoded JSON for MVP. Senior members (T1-T3) can mute via Settings → Appearance → "Show onboarding quests" toggle.
- Files: `web/components/portal/QuestChecklist.tsx` (new), wired into `web/app/student/dashboard/layout.tsx`.
- Mobile: collapses to a single icon, taps to expand.
- TC/XP: completion grants nothing online — quest items must trigger via QR check-in (XP) or bounty approval (TC) per design principle #3. Quests are signposts, not reward triggers.

### R3-2: Theme toggle

- Spec: `ux-settings.md` §6.2-6.4. CSS variable override + `localStorage["tsi.theme"]` ∈ `"light" | "dark" | "system"`.
- Files: `web/styles/game-tokens.css` (add `[data-theme="light"]` overrides), `web/app/student/dashboard/settings/page.tsx` (Appearance tab, where placeholder copy currently says "More appearance options coming soon"), `web/components/portal/ThemeToggle.tsx` (new, 3-button radio).
- Default: dark (current behavior). System detection on first load if no localStorage entry.
- Game world: respects theme for menu chrome only — in-world TOD palette is independent (Day stays bright even in dark theme).

### R3-3: Sky shader sun/moon corona

- Defers from P12 + P17 (twice attempted+reverted in 2026-06-01 burst). Plane/sphere approach failed — needs proper sky shader integration.
- Approach: extend the existing sky gradient shader (or add a fragment-shader patch via `onBeforeCompile` like `Path.tsx` does for vertex-alpha) to render a sun disc at azimuth derived from wall-clock hour. Color: bright `#FFFAE0` (sun, day) / `#E8E8FF` (moon, night). High-contrast against fog tone.
- Files: `web/components/game/Sky.tsx` (or wherever the sky dome lives — check first).
- Verification: Playwright screenshot at noon and midnight, confirm visible disc.

### R3-4 (deferred to Phase 2): Avatar editor

- Blocked on Nano Banana sprite generation pipeline. Not in scope this sprint.

## Round 4+ (queued, not dispatched)

- Migrations 016-022 application to remote Supabase (David, irreversible)
- Push 85+ commits to `origin/main`
- Nano Banana sprite gen for player + 6-8 named NPCs
- Audio content drop (4 TOD `.ogg` loops + footstep/click SFX)
- Visual WebGL Playwright test (Wave 14 carry-over)
- Admin review surface for bounty submissions (out of scope for build-D)

## Definition of Done (Round 3)

- All 3 deliverables shipped + appended to AGENT_LOG.md
- `npm run lint` ≤ 78 errors / 59 warnings (baseline match)
- `npm run build` PASS
- `npm test` 32/32 green
- QA Wave 17 verifies + ux-status.md updated to mark Tier-1 punch list closed

## Dispatch plan

Wait for Round 1 + Round 2 to all complete and tasks #2-#5 marked done. Then:
- **build-E** → R3-1 (quest checklist)
- **build-F** → R3-2 (theme toggle)
- **build-G** → R3-3 (sky shader)
- (no parallel qa this round — qa runs Wave 17 at end)
