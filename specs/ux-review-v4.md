# UXUI Design Review v4 — Round 2 Pages (Bounty, Leaderboard, Shop, Jobs, Settings)

> **Reviewer:** UXUI Agent · **Date:** 2026-04-05
> **Reviewed:** `davidliu/frontend` commit `46cd409` (Build 5 dashboard pages)
> **Compared against:** `ux-bounty.md`, `ux-leaderboard.md`, `ux-shop.md`, `ux-jobs.md`, `ux-settings.md`

---

## Summary

**All 5 pages are functional and well-built.** Consistent styling across pages — same filter tab pill pattern, same modal overlay pattern, same section/card styling. API wiring is clean. A few spec deviations exist (mostly layout simplifications from the detailed specs), but the core user flows work correctly.

**Severity:** 🟢 Matches spec · 🟡 Minor deviation · 🔴 Major deviation

---

## 1. Bounty Board (`bounty/page.tsx` vs `ux-bounty.md`)

### 🟢 Card grid layout — correct
- 2-column grid on `sm:` breakpoint, 1-column on mobile. Matches spec Section 3.3 (2-column).
- Cards have `#111827` bg, `rgba(255,255,255,0.06)` border, `16px` padding, `16px` border-radius.

### 🟢 Filter tabs — correct
- All/Available/My Claims/Completed tabs.
- Pill style: 36px height, brand-blue selected state, rounded-full.
- Spec called for status tabs at the top — matches.

### 🟢 Difficulty badges — correct
- Easy (green `#22c55e`), Medium (yellow `#facc15`), Hard (red `#ef4444`).
- Uses `!`/`!!`/`!!!` indicator — creative interpretation of difficulty.

### 🟢 Coin rewards — correct
- Gold `#ffd166` TSI coin display with Lucide `Coins` icon.
- XP reward shown in green `#22c55e`.

### 🟢 Detail modal — correct pattern
- Uses overlay panel: `#0d1b2a` bg, `rgba(0, 47, 167, 0.3)` border, `16px` radius.
- Back button + X close, backdrop click to close.
- Claim button: full-width, brand-blue, 44px height.

### 🟢 Loading skeleton — good
- 4 skeleton cards with `animate-pulse`. Better than a spinner.

### 🟡 Missing: Tech stack tags on cards
- **Spec Section 3.4:** Cards should show tech stack tags (e.g., "React", "Node.js").
- **Built:** Tags shown in detail modal but not on the card preview.
- **Built cards do show tech_stack:** Actually, looking again, cards DO show `tech_stack` — up to 3 tags. This is correct.

### 🟡 Missing: Submission flow
- **Spec Section 6:** After claiming, members should be able to submit deliverables.
- **Built:** Claim button works, but no submit deliverables UI.
- **Impact:** Medium — the claim flow works, but completing a bounty requires the submit step. Backend has `POST /api/bounties/[id]/submit`.
- **Fix:** Add a submit button/form on claimed bounties in the detail modal.

### 🟡 Container max-width differs
- **Spec:** Uses overlay panel `800px max-width` for overlay mode.
- **Built:** `800px` for the page container — correct for page mode. Detail modal uses `560px` — reasonable for detail view.

### 🟡 Missing: Bounty Hunter application
- **Spec Section 7:** "Apply to become a Bounty Hunter" CTA for T4-T5 members.
- **Built:** Not implemented. Low priority for MVP.

---

## 2. Leaderboard (`leaderboard/page.tsx` vs `ux-leaderboard.md`)

### 🟢 Ranked table — well-implemented
- Grid-based table with proper columns: Rank, Avatar, Name, Level, XP, Tier.
- Responsive column hiding: Level hidden below `sm`, Tier hidden below `md`.

### 🟢 Time period tabs — correct
- Weekly / Monthly / All-Time tabs with same pill style as bounty.

### 🟢 Rank colors — exact match
- #1 gold (`#ffd166`), #2 silver (`#d4d4d8`), #3 bronze (`#cd7f32`).

### 🟢 Loading skeleton — good
- 10 skeleton rows with pulse animation.

### 🟢 Tier-colored avatars — correct
- Uses `TIER_COLORS` from portal types for avatar bg/border.

### 🟡 Missing: "Your row" sticky highlight
- **Spec Section 4:** Current user's row should be highlighted and sticky at the bottom.
- **Built:** No user identification or highlight. All rows look the same.
- **Impact:** Users can't quickly find themselves in the ranking.
- **Fix:** Compare logged-in user ID against each row. Highlight with `rgba(0, 47, 167, 0.1)` bg. If below viewport, show sticky row at bottom.

### 🟡 Time periods not wired to backend
- **Built:** `period` state exists but `useEffect` always fetches from `/api/directory` without period filtering.
- **Impact:** Changing tabs re-fetches but returns the same data. Backend would need a dedicated leaderboard endpoint with time filtering.
- **Fix:** Use `GET /api/leaderboard?period=weekly` when Backend delivers this endpoint.

### 🟡 Row height slightly different
- **Spec:** `48px` rows.
- **Built:** `56px` rows.
- **Impact:** Minor — taller rows are actually more comfortable for touch.

---

## 3. Shop (`shop/page.tsx` vs `ux-shop.md`)

### 🟢 Product grid — correct
- `auto-fill, minmax(260px, 1fr)` responsive grid. Matches spec's product card layout.
- Cards: image (1:1 aspect), name, price (CAD + TSI coins).

### 🟢 Dual currency — correct
- Shows both `$X.XX` (CAD) and `X TSI` (coins). Uses "or" separator when both exist.
- Coin balance displayed in header with gold `#ffd166`.

### 🟢 Category tabs — correct
- All / Apparel / Accessories / Digital / Merch — same pill style.

### 🟢 Detail modal — correct
- Product image, name, prices, description, buy button.
- Buy button disabled when insufficient balance with "Not enough coins" text.
- Purchase via `POST /api/economy`.

### 🟢 Loading skeleton — excellent
- 8 skeleton cards with aspect-ratio placeholder + text bars. Best skeleton implementation of the 5 pages.

### 🟡 Container max-width differs
- **Spec:** `1200px`.
- **Built:** `1120px`.
- **Impact:** Negligible — 80px difference barely visible.

### 🟡 Missing: Product variants
- **Spec Section 5.2:** Product detail should show variant selectors (size, color).
- **Built:** No variant selection — shows product description only.
- **Fix:** Add when product catalog has variants. OK for MVP.

### 🟡 Missing: Cart stub
- **Spec Section 7:** Cart icon in header with item count.
- **Built:** No cart — purchase is immediate from detail modal.
- **Fix:** Low priority — direct purchase flow works for MVP.

### 🟡 No /api/shop endpoint exists yet
- Shop fetches from `/api/shop` which may not exist. Gracefully handles with empty array.
- Products will appear when Backend creates the endpoint.

---

## 4. Jobs (`jobs/page.tsx` vs `ux-jobs.md`)

### 🟢 Job cards — well-implemented
- Company name, role title, type badge, location, date, description, apply button.
- Cards: `#111827` bg, standard border, `24px` padding.

### 🟢 Type badges — color-coded per spec
- Internship: cyan (`#22d3ee`), Full-Time: blue (`#4A7AFF`), Freelance: gold (`#ffd166`), Part-Time: green (`#22c55e`).
- Matches spec's color-per-type system exactly.

### 🟢 Search — correct
- Search input with Lucide `Search` icon, `40px` height, standard styling.
- Filters by company, role, description.

### 🟢 Filter tabs — correct
- All / Internship / Full-Time / Freelance / Part-Time — same pill style.

### 🟢 Submit job form — well-built
- Modal with form fields: company, role, type, location, URL, description.
- Validation: company + role + URL required.
- Submit via `POST /api/jobs`.

### 🟢 Bookmark/save — nice addition
- Save button with filled/unfilled bookmark icon, gold when active.
- Client-side only (no persistence) — appropriate for MVP.

### 🟡 Missing: Admin review indicator
- **Spec Section 6.2:** Show "Pending review" badge for user-submitted jobs awaiting T1-T3 approval.
- **Built:** No review status display.
- **Fix:** Show a "Pending" badge if `job.status === "pending"` after submission.

### 🟡 Missing: Location filter
- **Spec:** Location dropdown filter (Remote, In-person, Hybrid).
- **Built:** Location shown on cards but not filterable.
- **Fix:** Add location filter dropdown alongside type tabs. Low priority.

---

## 5. Settings (`settings/page.tsx` vs `ux-settings.md`)

### 🟡 Layout: Sections instead of tabs
- **Spec:** Tabbed layout — Profile | Social | Appearance | Account.
- **Built:** Vertically stacked sections (Profile, Social Links, Account). No tabs.
- **Impact:** All content is on one scrollable page. Functional but doesn't match the tabbed design David chose.
- **Fix:** Convert to tab-based layout. Add `Appearance` tab with dark/light toggle.

### 🟢 Profile editing — correct
- Display name, bio, skills (comma-separated) — all editable.
- Input styling matches: `#111827` bg, `var(--glass-border-soft)` border, `8px` radius.

### 🟢 Social links — correct
- GitHub, LinkedIn, Instagram, Discord, Website with platform icons.
- Individual input fields with icon prefix.

### 🟢 Account info — correct
- Email, Tier, Position, Member Since — all read-only.
- 2-column grid layout.

### 🟢 Save flow — correct
- `PATCH /api/profile` with all editable fields.
- Save button shows "Saved" with green checkmark for 3 seconds.

### 🟡 Missing: Appearance tab with dark/light toggle
- **Spec Section 6:** Dark/Light theme toggle with two selection cards.
- **Built:** Not implemented — no Appearance section at all.
- **Fix:** Add Appearance tab/section with `Moon`/`Sun` icon cards, `localStorage` persistence.

### 🟡 Missing: Inline avatar editor
- **Spec Section 4.2:** Full avatar creator embedded in Profile section.
- **Built:** No avatar editing.
- **Fix:** Phase 2 — avatar system needs sprite assets first. OK to skip for now.

### 🟡 Missing: Sign out button
- **Spec Section 7.4:** "Sign Out" button in Account section with danger-zone styling.
- **Built:** Not present.
- **Fix:** Add sign out button at the bottom of Account section.

### 🟡 Save is global, not per-section
- **Spec Section 8:** Per-section save buttons.
- **Built:** One global "Save Changes" button in header saves everything at once.
- **Impact:** Minor — global save is simpler and arguably better UX.

### 🟡 Max-width differs slightly
- **Spec:** `720px`.
- **Built:** `640px`.
- **Impact:** Negligible — both are reasonable.

---

## Overall Assessment

| Page | Score | Key Strengths | Key Gaps |
|------|-------|--------------|----------|
| Bounty | 🟢 8/10 | Card grid, claim flow, detail modal | Submit deliverables UI missing |
| Leaderboard | 🟢 7/10 | Ranked table, rank colors, responsive | Own-row highlight missing, periods not wired |
| Shop | 🟢 8/10 | Dual currency, skeleton, purchase flow | No variants, no cart (OK for MVP) |
| Jobs | 🟢 9/10 | Type badges, search, submit form, bookmark | Best of the 5 — minor gaps only |
| Settings | 🟡 6/10 | Profile + social editing works | No tabs, no theme toggle, no sign out |

**Overall: 7.5/10.** All pages are functional and follow consistent design patterns. Jobs is the strongest. Settings needs the most work (tabs + theme + sign out). The biggest cross-page gap is the leaderboard's missing own-row highlight.

---

## Priority Fix List (for Frontend)

### P1 — Should fix now
1. **Settings: Convert to tabs** — add tab bar (Profile | Social | Appearance | Account)
2. **Settings: Add theme toggle** — dark/light cards in Appearance tab (`localStorage` + `data-theme`)
3. **Settings: Add sign out button** — red-bordered ghost button in Account section
4. **Leaderboard: Own-row highlight** — identify logged-in user, highlight row with `rgba(0, 47, 167, 0.1)`, sticky at bottom if off-screen

### P2 — Fix when Backend is ready
5. **Bounty: Submit deliverables** — add submit form for claimed bounties (`POST /api/bounties/[id]/submit`)
6. **Leaderboard: Wire time periods** — use `GET /api/leaderboard?period=` when endpoint exists
7. **Shop: Wire real products** — currently gracefully empty, will populate when `/api/shop` exists

### P3 — Polish
8. **Jobs: Pending review badge** — show "Pending" for user-submitted jobs
9. **Leaderboard: Row height** — reduce from 56px to 48px per spec
10. **Settings: Avatar editor** — add when sprite system is ready
