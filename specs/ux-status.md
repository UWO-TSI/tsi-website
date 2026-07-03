# UX Spec Status Report — Design Debt Backlog

> **Owner:** UXUI · **Date:** 2026-04-05
> **Purpose:** Comprehensive audit of all UXUI specs vs implementation state. Design debt backlog for prioritization.

---

## 1. Spec Inventory (18 files)

| # | File | Lines | Status | Last Updated |
|---|------|-------|--------|-------------|
| 1 | `ux-dashboard.md` | ~200 | ✅ Implemented | 2026-03-27 |
| 2 | `ux-game-world.md` | ~300 | ⚠️ DEPRECATED (replaced by v2) | 2026-03-27 |
| 3 | `ux-game-world-v2.md` | ~520 | ✅ Mostly implemented (gaps noted) | 2026-03-30 |
| 4 | `ux-directory.md` | ~390 | ✅ Implemented | 2026-03-27 |
| 5 | `tokens.md` | ~400 | ✅ Implemented (game-tokens.css) | 2026-04-04 |
| 6 | `ux-shop.md` | ~290 | ✅ Implemented (basic) | 2026-03-29 |
| 7 | `ux-bounty.md` | ~280 | ✅ Implemented (basic) | 2026-03-29 |
| 8 | `ux-leaderboard.md` | ~200 | ✅ Implemented (gaps) | 2026-03-29 |
| 9 | `ux-jobs.md` | ~250 | ✅ Implemented (strong) | 2026-03-29 |
| 10 | `ux-oracle.md` | ~250 | ⚠️ Quiz layout REPLACED by v2 | 2026-03-29 |
| 11 | `ux-oracle-v2.md` | ~370 | ❌ Not implemented (stretch goal) | 2026-04-05 |
| 12 | `ux-onboarding.md` | ~300 | ✅ Mostly implemented | 2026-03-29 |
| 13 | `ux-interiors.md` | ~350 | ❌ Not started | 2026-04-04 |
| 14 | `ux-settings.md` | ~350 | 🟡 Partially implemented | 2026-04-04 |
| 15 | `ux-mobile.md` | ~400 | ❌ Not started | 2026-04-04 |
| 16 | `ux-classes.md` | ~350 | 🟡 Data exists, UI not applied | 2026-04-05 |
| 17 | `ux-asset-map.md` | ~350 | ✅ Nature kit extracted + wired | 2026-04-04 |
| 18 | `oracle-questions.md` | ~180 | ✅ Embedded in oracle page | 2026-03-30 |

**Reviews:**

| # | File | Score | Status |
|---|------|-------|--------|
| 1 | `ux-review.md` | — | Backend's initial dashboard (historical) |
| 2 | `ux-review-v2.md` | 8/10 | AC visual implementation |
| 3 | `ux-review-v3.md` | 9/10 | API-wired portal components |
| 4 | `ux-review-v4.md` | 7.5/10 | 5 Round 2 pages |
| 5 | `ux-review-v5.md` | 8/10 | Onboarding + Oracle + Auth |

---

## 2. Implementation Fidelity by Feature

### Fully Implemented (low/no design debt)

| Feature | Score | Notes |
|---------|-------|-------|
| Dashboard shell (layout + sidebar) | 9/10 | 240px sidebar, 2px accent, hamburger at 768px, auth context wired |
| Directory (list + profile) | 9/10 | 64px rows, tier colors, XP bars, search/filter, profile edit |
| Game world exterior (AC style) | 8/10 | Palette exact, sphere trees, river/bridge, flowers/props, time-of-day cycle |
| Design tokens | 10/10 | `game-tokens.css` with all 13+ categories |
| Nature kit GLBs | 10/10 | 24 models extracted, NatureModels.tsx component, used in GameWorld |
| Overlay panels | 10/10 | `#0d1b2a`, blue glow border, 16px radius, escape/backdrop close |
| Transition overlay | 10/10 | 0.3s fade, state machine, pointer blocking |
| Jobs page | 9/10 | Type badges, search, submit form, bookmarks |

### Mostly Implemented (minor design debt)

| Feature | Score | Gaps |
|---------|-------|------|
| Onboarding flow | 8/10 | No quest checklist, no custom skills input |
| Oracle quiz (v1 layout) | 7/10 | Emoji → Lucide icons, Mage color, no exit button |
| Bounty board | 8/10 | No submit deliverables UI |
| Shop | 8/10 | No variants, no cart, /api/shop may not exist yet |
| Leaderboard | 7/10 | No own-row highlight, time periods not wired, 56px rows |
| Auth context + sidebar | 9/10 | Working — shows real name/level |

### Partially Implemented (significant design debt)

| Feature | Score | Gaps |
|---------|-------|------|
| Settings page | 6/10 | No tabs (flat sections), no theme toggle, no sign out, no avatar editor |
| Class visual identity | 4/10 | Data exists in oracle page but UI not applied (sidebar, directory, profile, nameplate) |
| Game world terrain | 7/10 | Rolling hills working, but paths still sharp-edged, river straight |

### Not Implemented (full design debt)

| Feature | Spec Ready? | Blocker |
|---------|-------------|---------|
| Building interiors (4 rooms) | ✅ `ux-interiors.md` | Frontend time — complex 3D scenes |
| Oracle v2 (card-game encounter) | ✅ `ux-oracle-v2.md` | Frontend stretch goal |
| Mobile/responsive | ✅ `ux-mobile.md` | Frontend time — landscape lock, touch controls, bottom sheets |
| Quest checklist widget | ✅ `ux-onboarding.md` §5 | Frontend time — floating widget + quest tracking |
| Dark/light theme toggle | ✅ `ux-settings.md` §6 | Frontend time — CSS overrides + localStorage |
| Avatar creator | ✅ `ux-dashboard.md` §6 | Blocked — needs sprite assets (Nano Banana) |

---

## 3. Design Debt Backlog — Prioritized

> **Updated 2026-05-25:** Reframed to community-first hangout (see `CLAUDE.md` design principles). NPCs + ambient life + mobile + presence move ahead of Avatar Creator + Interiors. Tier-1 punch list bumped from "merge blocker" to "post-look-feel polish" — the world-feel sprint comes first.
>
> **Updated 2026-07-02:** The sprints between the reframe and now all shipped: Game World Look & Feel + content pipeline (QA Wave 14), Admin Tooling CRUD (Wave 15), LLM-NPC + community loops + action controls + the 2026-06-01 visual/perf burst (Wave 16), Tier-1 Rounds 1+2 (Wave 17), Tier-1 Round 3 + bounty-XP ruling (Wave 18). **The Tier-1 punch list below is CLOSED** — the portal is merge-ready per the Tier-1 definition.

### ✅ Tier 1: CLOSED 2026-07-02 (QA Wave 18)

All 7 punch-list items shipped and QA-verified (Rounds 1+2, Wave 17 PASS), plus the Round-3 follow-ups (quest checklist `ce4f3b7`, theme toggle `13c375a` + fix `633571d`, sky shader `4b27a62`) and the bounty-XP principle-#3 ruling (`5e5372a`), verified in Wave 18.

| # | Issue | Shipped |
|---|-------|---------|
| 1 | Settings tabs (Profile/Social/Appearance/Account) | ✅ `8556faf` (R1) |
| 2 | Settings: sign out button | ✅ `8556faf` (R1) |
| 3 | Leaderboard: own-row + sticky + half-anonymized policy | ✅ `d2e3c0d` (R2) |
| 4 | Oracle: Lucide icons | ✅ `1d75189` (R1) |
| 5 | Oracle: Mage color #6366F1 | ✅ `1d75189` (R1) |
| 6 | Oracle: exit button with progress save | ✅ `1d75189` (R1) |
| 7 | Bounty: submit deliverables flow | ✅ `e931e84` (R2) |

**Open follow-ups out of Wave 18 — status after the 2026-07-02 autonomous loop (Wave 19):**
- ~~**W18-1** sky disc invisible~~ — **fixed** (`5c636be`): camera-relative shader test + low 3-8° arc + 2x size; sun/moon verified in-game at look-around poses. Remaining design call for David: the default top-down pose can never frame the sky (measured); putting the sun in the default frame means changing the default camera framing.
- ~~Portal-wide light-theme token sweep~~ — **done** (`87e87fb`): 15 files, new `--surface-hover`/`--surface-chip` tokens, verified light + dark. Long-tail stragglers on unswept pages are one-line fixes now.
- ~~Principle-#3 legacy paths~~ — **enforced** (`222bed5`) per David's standing ruling: quest completion is status-only, onboarding keeps 100 TC and drops the 50 XP. Awaiting David's formal sign-off (easy revert if he wants onboarding XP back).
- ~~Shop dual pricing~~ — **David ruled 2026-07-02: fine as is.** Dual pricing is a deliberate pay-cash-or-coins feature; the implied ratio doesn't count as revealing the internal rate.
- ~~Middleware 4s fail-open~~ — **David signed off 2026-07-02**, pushed with the batch.
- ~~Principle-#3 enforcement (quests + onboarding XP)~~ — **David signed off 2026-07-02: keep both.**
- ~~Default camera framing~~ — **David ruled 2026-07-02: keep current framing.** Sun/moon stay a look-around discovery; no default-frame change.

### Tier 2: Admin Tooling + Community Loops (sprint after Tier 1)

New priority post-reframe. Without admin tooling, the monthly-drop cadence can't sustain. Without community loops, the hangout has no reason to be a hangout.

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 8 | **Admin event CMS** (easy create/edit/delete, QR check-in code generation) | David's monthly-drop requirement. Events are the XP heartbeat. | Medium |
| 9 | **Emotes + guestbook at HQ** | Cheapest "we talk to each other" delivery. Async, no multiplayer needed. | Medium |
| 10 | **In-world member presence indicators** (ghost-replay of recent member positions, "Sarah was here 2h ago") | World-never-empty principle. Cheaper than full multiplayer. | Medium |
| 11 | **Mobile stripped mode** (view-only world + emote + profile + RSVP, no game world rendering) | Mobile-aware principle. Members live on phones. | Medium |
| 12 | Class identity in sidebar, directory, profile | `ux-classes.md` §4 — cosmetic flair | Small |
| 13 | Directory: Role/Class + Year filter dropdowns | `ux-directory.md` §3.4 | Small |
| 14 | Profile: social links editing | `ux-directory.md` §7.5 | Small |
| 15 | NPC dialogue system (canned lines, rotating monthly) | Phase β NPC — adds personality without LLM cost | Medium |
| 16 | Admin NPC dialogue editor | Required for monthly content drops | Small |
| 17 | Shop admin uploader (item CRUD, price set) | Required for monthly drops | Small |
| 18 | Seasonal palette switcher (admin can toggle Halloween / Frost / Spring) | Monthly content cadence | Small |

### Tier 3: Late-Game (Phase 3+)

Pushed deeper into the future per design principle #4 (cosmetic > functional, rich system is late-game).

| # | Feature | Spec | Effort |
|---|---------|------|--------|
| 19 | LLM-driven NPC dialogue (γ tier) | New spec needed | Large |
| 20 | Building interiors (HQ, HQ Admin, Shop, Oracle Temple) | `ux-interiors.md` | Large |
| 21 | Oracle v2 card-game encounter | `ux-oracle-v2.md` | Large |
| 22 | Full mobile responsive (touch controls, landscape lock, in-world rendering) | `ux-mobile.md` | Large |
| 23 | Avatar creator (rich cosmetic + layered sprites) | `ux-dashboard.md` §6 | Large (blocked on Nano Banana sprite gen) |
| 24 | Multiplayer presence (Colyseus) | `asset-stack.md` | Large (deferred until usage justifies $15/mo) |
| 25 | Class system gameplay impact (functional perks per MBTI class) | New spec needed | Large |
| 26 | Building silhouette variety | `ux-game-world-v2.md` §6 | Medium |
| 27 | Path softening + river curve | `ux-game-world-v2.md` §4.2/§5 | Medium |
| 28 | Shop: product variants (size/color selectors) | `ux-shop.md` §5.2 | Medium |
| 29 | Portfolio auto-build from bounty/project history | New — community-as-credential feature (low priority since David said the portal isn't a career tool) | Medium |

### Removed from backlog — later re-scoped and shipped (2026-07-02 reconcile)

- ~~Quest checklist widget (6 quests, 275 XP)~~ — dropped 2026-05-25 because of its XP rewards, then **re-scoped and shipped as R3-1** (`ce4f3b7`): quests are signposts only, zero online rewards, opt-in with a Settings mute toggle (principle #3 + #7 compliant). The original XP-granting design stays dead.
- ~~XP toast notifications for online actions~~ — **still dropped.** XP only comes from IRL event check-in; the toast will live in the QR check-in flow.
- ~~Dark/light theme toggle~~ — deferred 2026-05-25, then **re-prioritized and shipped as R3-2** (`13c375a` + fix `633571d`). Menu chrome only; the game world keeps its TOD palette.

---

## 4. Spec Coverage Summary

| Area | Specs Written | Implemented | Coverage |
|------|--------------|-------------|----------|
| Dashboard shell | 1 | 1 | 100% |
| Game world | 2 (v1 deprecated, v2 active) | 1 (mostly) | 85% |
| Directory + Profile | 1 | 1 | 90% |
| Tokens | 1 | 1 | 100% |
| Phase 2 pages (6) | 6 | 6 (varying quality) | 80% |
| Onboarding | 1 | 1 (partial) | 70% |
| Oracle quiz | 2 (v1 + v2) | 1 (v1 only) | 50% |
| Building interiors | 1 | 0 | 0% |
| Mobile | 1 | 0 | 0% |
| Class identity | 1 | 0 (data exists) | 30% |
| Settings | 1 | 1 (partial) | 50% |
| Asset map | 1 | 1 | 90% |
| **Total** | **18 specs** | **~12 implemented** | **~72%** |

---

## 5. Recommendations

### For Merge to Main
1. Fix the 7 Tier 1 items — all are small/medium effort
2. Settings is the weakest page — needs tabs + sign out at minimum
3. Oracle icons + colors are quick wins
4. Leaderboard own-row highlight improves core UX significantly

### For Next Sprint
- Quest checklist is the #1 priority — it teaches new users the portal
- Theme toggle adds user personalization
- Class identity in UI (sidebar, directory, profile) makes the RPG system feel real

### For Future
- Building interiors and Oracle v2 are the two biggest visual upgrades
- Mobile responsive is needed before any real device testing
- Avatar creator is blocked on Nano Banana sprite generation
