# UXUI Design Review v5 — Onboarding + Oracle + Auth Context

> **Reviewer:** UXUI Agent · **Date:** 2026-04-05
> **Reviewed:** `davidliu/frontend` commit `2ff179a` (Onboarding flow, Oracle MBTI quiz, auth context wiring)
> **Compared against:** `ux-onboarding.md`, `ux-oracle.md` (v1), `ux-oracle-v2.md`, `ux-dashboard.md`

---

## Summary

**Onboarding is solid — clean 3-step flow that works.** Oracle quiz is functional with correct scoring and class reveal, but uses the old v1 layout (flat centered page), not the new v2 card-game encounter. Auth context wiring fixes the sidebar P1 issue from review v3.

**Severity:** 🟢 Matches spec · 🟡 Minor deviation · 🔴 Major deviation

---

## 1. Onboarding (`/student/onboarding/page.tsx` vs `ux-onboarding.md`)

### 🟢 3-step flow — correct structure
- Step 1: Welcome (sparkles icon, title, tagline, CTA)
- Step 2: Profile setup (name, bio, year, skills, socials)
- Step 3: Avatar (placeholder — expected)
- Flow matches spec Section 2 exactly.

### 🟢 Step indicator — well-built
- Numbered circles (32px) with connector lines.
- Active/done states: brand-blue fill, white text. Inactive: ghost border.
- Checkmark on completed steps. "Step N of 3" label.
- Clean, matches spec Section 3.

### 🟢 Welcome step — matches spec
- Sparkles icon in blue-tinted rounded square.
- "Welcome to Tethos" (40px→50px responsive), tagline, description.
- "Let's Go" CTA with ChevronRight icon.
- Centered layout, max-width 560px container.

### 🟢 Profile step — comprehensive
- Display name with 30-char limit + counter.
- Bio textarea with 200-char limit + counter.
- Year dropdown (1st–5th+).
- Skills: 16 preset toggles (tap to select, 10 max). Blue when active.
- Social links: GitHub, LinkedIn, Website — inline inputs.
- "Continue" disabled until display name is filled.
- All inside a rounded card (`var(--color-surface)`, 32px padding, 24px radius).

### 🟢 Avatar step — appropriate placeholder
- User icon in blue circle, "coming soon" text.
- "Enter Campus" button to finish.
- Correct for now — sprite system not built yet.

### 🟢 API integration — correct
- Loads existing profile data from Supabase on mount.
- Redirects to dashboard if `onboarding_completed === true`.
- Saves all fields + `onboarding_completed: true` via `PATCH /api/profile`.

### 🟡 Missing: Quest checklist widget
- **Spec Section 5:** After onboarding, a quest checklist widget (6 quests, 275 XP) should appear as a collapsible widget on the dashboard.
- **Built:** Not implemented.
- **Impact:** Medium — quests are the onboarding tutorial that teaches new users the portal features.
- **Fix:** Build quest checklist as a floating widget or sidebar component. Quests: visit directory, visit oracle, edit profile, claim a bounty, check leaderboard, visit shop.

### 🟡 Missing: XP toast notifications
- **Spec Section 5.3:** Toast notification when quest is completed ("Quest completed! +50 XP").
- **Built:** Not implemented.
- **Fix:** Build a toast component (bottom-right, auto-dismiss 3s). Backend awards XP — Frontend shows toast on success.

### 🟡 Character counter styling
- **Spec:** Character count in `var(--color-text-subtle)`, right-aligned.
- **Built:** Left-aligned below input, `var(--color-text-subtle)`, `12px`. Close but not right-aligned.
- **Fix:** Add `text-align: right` or `ml-auto`.

### 🟡 Skills: no custom input
- **Spec Section 4.3:** Users should be able to type custom skills (not just presets).
- **Built:** Only 16 preset skill toggles. No free-text input.
- **Fix:** Add an input field after the presets: "Type a custom skill + Enter to add".

---

## 2. Oracle Quiz (`/student/dashboard/oracle/page.tsx` vs `ux-oracle.md` v1 + v2)

### 🟢 Question bank — exact match
- All 12 questions from `oracle-questions.md` are embedded.
- Correct MBTI axis assignments (E/I: Q1-3, S/N: Q4-6, T/F: Q7-9, J/P: Q10-12).
- 2-4 answer cards per question — correct counts.

### 🟢 Scoring — correct
- Tallies each letter, majority wins per axis. Tie-breaker defaults to first letter (E, S, T, J). Matches spec.

### 🟢 MBTI → Class mapping — exact match
- All 16 types mapped to correct class + subclass names from `ux-oracle.md` Section 8.2.
- Colors: Warrior #ef4444, Mage #002fa7, Healer #22c55e, Rogue #ffd166.

### 🟡 Mage color differs from class identity sheet
- **`ux-classes.md`:** Mage uses `#6366F1` (indigo).
- **Built:** Mage uses `#002fa7` (brand-blue).
- **Impact:** Minor — both are blue, but indigo is more distinctive for the Mage class. Brand-blue is already used everywhere else.
- **Fix:** Update to `#6366F1` per class identity sheet.

### 🟢 Class reveal animation — follows v1 spec timeline
- Staged reveals: "The Oracle has spoken..." → icon → class name (with glow) → subclass → description → MBTI label → "Enter the Campus" button.
- Timing matches v1 spec (0.5s → 0.8s → 2.0s → 2.5s → 3.3s → 4.5s).

### 🟢 Post-quiz class info page — correct
- Shows existing class with emoji icon, name, subclass, description.
- "Retake Quiz" ghost button for re-doing.

### 🟢 Profile save — correct
- `PATCH /api/profile` with `class` and `subclass` fields after scoring.

### 🔴 Quiz layout uses v1 (flat page), not v2 (card-game encounter)
- **v2 spec:** 2D backdrop, player sprite bottom-left, monk NPC top-right, speech bubble question, fanned cards at bottom, exit button, stage progress bar at top.
- **Built:** Flat centered page, question as text, cards in horizontal flex row, progress bar at bottom.
- **Expected:** Frontend built this before v2 spec existed. v2 was written same day.
- **Fix:** This is the Round 4 "stretch" task — apply `ux-oracle-v2.md` visual upgrade.

### 🟡 Missing: Exit/save-and-return button
- **v2 spec Section 7.2:** Exit button with "Leave quiz? Progress will be saved."
- **Built:** No exit button. User can navigate away but progress is lost.
- **Fix:** Add exit button to top bar. Save current `qIndex` and `answers` to localStorage.

### 🟡 Uses emoji icons, not Lucide
- **`ux-classes.md`:** Lucide icons (Sword, Sparkles, Heart, Wrench).
- **Built:** Emoji (⚔️, 🔮, 💚, 🗡️).
- **Impact:** Emoji renders differently per OS. Lucide is consistent.
- **Fix:** Import `Sword, Sparkles, Heart, Wrench` from lucide-react. Use `CLASS_DATA` from `ux-classes.md`.

### 🟡 Cards don't have staggered entrance animation
- **v1 spec Section 4.2:** "Staggered fade-up: 0.3s, stagger 0.08s."
- **Built:** `animation: fadeInUp 0.3s ease-out ${i * 0.08}s both` — actually this IS implemented with delay per card. Correct.
- **Correction:** This is actually matching. 🟢

---

## 3. Auth Context (`UserContext.tsx` + Sidebar wiring)

### 🟢 UserContext — clean implementation
- `UserProvider` wraps dashboard layout.
- `useUser()` hook returns `{ profile, loading, refetch }`.
- Fetches from `/api/profile` on mount.

### 🟢 Sidebar now shows real user data — P1 FIXED
- `const { profile } = useUser()` — pulls display_name and level.
- Shows actual name (fallback "Player") and actual level (fallback 1).
- This was the #1 priority fix from review v3. ✅ Resolved.

### 🟡 "Coming Soon" badges removed from some nav items
- Bounty, Shop, Jobs, Leaderboard no longer show "Soon" badge.
- Correct — these pages are now built. But Settings still has no badge and is also built.
- Consistent behavior. 🟢

---

## Overall Assessment

| Component | Score | Key Strengths | Key Gaps |
|-----------|-------|--------------|----------|
| Onboarding | 🟢 8/10 | Clean 3-step flow, profile editing, Supabase integration | Quest checklist missing, no custom skills input |
| Oracle Quiz | 🟢 7/10 | Correct scoring, all 16 subclasses, class reveal works | Uses v1 layout (not v2 card-game), emoji instead of Lucide, no exit button |
| Auth Context | 🟢 10/10 | Clean, fixes sidebar P1 | — |

**Overall: 8/10.** The core student journey works: signup → onboard → quiz → class → dashboard. Quest checklist is the biggest missing piece for guided exploration.

---

## Priority Fix List (for Frontend)

### P1 — Should fix now
1. **Mage color** — change `#002fa7` to `#6366F1` (indigo) in `MBTI_TO_CLASS` and reveal glow
2. **Class icons** — replace emoji with Lucide icons (Sword, Sparkles, Heart, Wrench)
3. **Oracle exit button** — add top-left exit with confirmation dialog, save progress to localStorage

### P2 — Next sprint
4. **Quest checklist widget** — 6 quests (visit directory, oracle, edit profile, claim bounty, check leaderboard, visit shop), 275 XP total, collapsible floating widget
5. **Custom skills input** — add free-text input after preset skill toggles in onboarding

### P3 — Stretch (Round 4)
6. **Oracle v2 visual upgrade** — 2D backdrop, monk sprite, speech bubble, fanned card hand (per `ux-oracle-v2.md`)
7. **XP toast notifications** — bottom-right auto-dismiss toast for quest/bounty XP awards
