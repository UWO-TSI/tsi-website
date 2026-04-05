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

### Tier 1: Fix Before Merge to Main

These are functional or visual issues that should be resolved before the student portal goes live.

| # | Issue | Spec | Review | Effort |
|---|-------|------|--------|--------|
| 1 | Settings page needs tabs (Profile/Social/Appearance/Account) | `ux-settings.md` | v4 | Medium |
| 2 | Settings: add sign out button | `ux-settings.md` §7.4 | v4 | Small |
| 3 | Leaderboard: own-row highlight + sticky | `ux-leaderboard.md` §4 | v4 | Small |
| 4 | Oracle: Lucide icons instead of emoji | `ux-classes.md` | v5 | Small |
| 5 | Oracle: Mage color → #6366F1 (indigo) | `ux-classes.md` | v5 | Small |
| 6 | Oracle: exit button with progress save | `ux-oracle-v2.md` §7.2 | v5 | Small |
| 7 | Bounty: submit deliverables flow | `ux-bounty.md` §6 | v4 | Medium |

### Tier 2: Post-Launch Sprint

Important features that enhance the experience but aren't blocking launch.

| # | Issue | Spec | Effort |
|---|-------|------|--------|
| 8 | Quest checklist widget (6 quests, 275 XP) | `ux-onboarding.md` §5 | Medium |
| 9 | Dark/light theme toggle | `ux-settings.md` §6 | Medium |
| 10 | Class identity in sidebar, directory, profile | `ux-classes.md` §4 | Small |
| 11 | Directory: Role/Class + Year filter dropdowns | `ux-directory.md` §3.4 | Small |
| 12 | Directory: skeleton loading rows | `ux-directory.md` §6.1 | Small |
| 13 | Profile: social links editing | `ux-directory.md` §7.5 | Small |
| 14 | Path softening (alpha-blended edges) | `ux-game-world-v2.md` §4.2 | Medium |
| 15 | River curve (not straight) | `ux-game-world-v2.md` §5 | Medium |
| 16 | XP toast notifications | `ux-onboarding.md` §5.3 | Small |
| 17 | Onboarding: custom skills input | `ux-onboarding.md` | Small |

### Tier 3: Future Sprints

Major features that require dedicated sprints.

| # | Feature | Spec | Effort |
|---|---------|------|--------|
| 18 | Building interiors (HQ, HQ Admin, Shop, Oracle Temple) | `ux-interiors.md` | Large |
| 19 | Oracle v2 card-game encounter (2D backdrop, monk, fanned cards) | `ux-oracle-v2.md` | Large |
| 20 | Mobile/responsive (landscape lock, touch, bottom sheets) | `ux-mobile.md` | Large |
| 21 | Avatar creator (inline sprite editor) | `ux-dashboard.md` §6, `ux-settings.md` §4.2 | Large (blocked on sprite assets) |
| 22 | Building silhouette variety (unique shapes per building) | `ux-game-world-v2.md` §6 | Medium |
| 23 | Missing props (signposts, stepping stones, butterflies, campfire) | `ux-asset-map.md` §3 | Medium |
| 24 | Shop: product variants (size/color selectors) | `ux-shop.md` §5.2 | Medium |
| 25 | Multiplayer presence (Colyseus) | `asset-stack.md` | Large (deferred) |

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
