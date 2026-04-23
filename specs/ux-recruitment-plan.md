# Recruitment Flow — Awwwards-Grade Polish Plan

**Goal:** every page, screen, and transition in the student application flow reaches 10/10 design quality before portal opens in 2 weeks.

**Method per page:** UI/UX pro max pass → frontend implementation → design-feedback critique → revise → QA checklist. Loop until no critique items remain.

**Tracked surfaces:**
1. `/student/apply` — listing + hero + phase timeline
2. `/student/apply/[role-slug]` — position detail + auth gate
3. `AuthModal` — sign in / sign up
4. `ApplicationForm` — 4 steps (personal → resume → essays → review)
5. `SuccessScreen` — submission confirmation
6. `/student/apply/dashboard` — status tracker
7. `/student/apply/internal` — alumni gated listing

Admin dashboard `/admin/recruit` is out of scope (internal-facing, shipped).

---

## Global design system guardrails

Before per-page work. Every page must comply:

- **Type scale:** clamp-based responsive scale, no hardcoded `text-3xl` jumps. Headings 600 weight, body 400.
- **Color:** Tethos brand `#002FA7` blue, `#FFD166` yellow accent, `#F1FFFF` fg on `var(--color-bg-main)` bg. Status colors already in `lib/recruitment.ts:33`.
- **Motion:** all entrances use `fadeUpVariants` from `lib/motion`. Stagger 80ms. No more than 200ms duration for interactions, 600ms for entrances.
- **Radii:** 16px cards, 12px inputs, 9999px pills. No mixed radii within one card.
- **Focus rings:** 2px `#002FA7` with 30% alpha shadow, matches AuthModal inputs.
- **Loading:** no spinners longer than 2 frames — use optimistic UI or skeletons.
- **Empty states:** every list state must have a designed empty, not just missing content.
- **Accessibility:** WCAG AA contrast on every text/bg pair, `prefers-reduced-motion` respected, keyboard nav on all interactive elements, aria-labels on icon-only buttons.
- **Mobile:** 375px min, test every page at 375/768/1280/1920.

QA gate: run Playwright snapshot at all 4 widths + axe-core scan before marking any page complete.

---

## 1. `/student/apply` — listing page

**Current state:** hero, 2-phase timeline, position cards in 2-col grid, phase filter, seed-data fallback.

### Design pass (ui-ux-pro-max)
- **Hero:** full-viewport with massive typography statement ("Build with us. / 2026-27 cohort."). Live countdown to recruitment open date (Phase 1 = May 1 2026). Subtle aurora/gradient backdrop, not stock illustration.
- **Phase timeline:** horizontal rail at 40% viewport height. Active phase pulses. Hovering a phase reveals position list preview. Completed phases desaturate with checkmark.
- **Position cards:** break the grid. Asymmetric bento — VP Internal card spans 2 cols, VP External + Marketing side-by-side below. Each card has (a) role name, (b) one-line hook, (c) open/closed/upcoming pill, (d) deadline countdown, (e) hover reveal showing essay question count + estimated time. Bento gives visual hierarchy without making it look like a job board.
- **Empty/closed states:** when Phase 1 closes, cards go to `closed` state with "Applications closed — Phase 2 opens Sept" message, still visible for transparency.
- **Scroll storytelling:** as user scrolls past hero, a "why Tethos" strip appears with 3 stats (teams shipped, clients served, members placed). Not a sales pitch, credibility anchor.
- **Footer CTA:** "Not sure which role fits? → " with email link to recruitment@tethos.ca.

### Frontend (frontend-design)
- Use `SpotlightCard` component already in the repo for bento.
- Countdown: `useCountdown(date)` hook, updates per second, degrades to "Opens May 1" if >7 days out.
- Phase timeline: CSS grid with `grid-template-columns` based on phase count, framer-motion layout animation between active states.
- Cards: `will-change: transform` only on hover, release after.

### Critique loop (design-feedback)
Expected findings:
- "Hero feels like every other student-org hero" → solve with countdown + custom typography treatment, not stock gradient
- "2-col grid is dated" → bento solves
- "No emotional hook" → add founder quote or member testimonial strip above position cards
- "Phase timeline unclear without hover" → add permanent date labels, hover is enhancement not requirement

Iterate until no items remain.

### QA checklist
- [ ] Countdown accurate across timezones (use UTC internally, display local)
- [ ] Position cards clickable in entirety, not just title
- [ ] Phase filter state survives refresh via URL param `?phase=1`
- [ ] Seed-data fallback shows banner: "showing preview — live positions load shortly"
- [ ] Closed position cards cannot be clicked (cursor: not-allowed, aria-disabled)
- [ ] 375px: cards stack to single col, hero type scales down without clipping
- [ ] Lighthouse perf ≥ 90 on mobile, LCP < 2.5s
- [ ] No layout shift from countdown mounting

---

## 2. `/student/apply/[role-slug]` — position detail

**Current state:** title, description, essay preview, auth gate OR form.

### Design pass
- **Split layout:** left 40% sticky sidebar with role meta (phase, deadline, time commitment, est. application time, essay count, word limits totaled). Right 60% scrollable with sections: Overview → Responsibilities → What you'll build → Who we're looking for → Application process preview (steps shown as a mini-map).
- **Read-before-apply gate (locked decision #5):** the "Start application" button is disabled until two conditions pass: (a) scroll depth ≥90% of main content, tracked via IntersectionObserver on a sentinel at the end of "Who we're looking for", and (b) user checks "I've read the role description and I'm ready to apply." Checkbox appears only after scroll condition met — progressive disclosure. This is the gate between marketing and application, meant to raise application quality.
- **Application preview:** show the 4 steps of the form as a visual mini-map so candidates know scope before committing. Renders above the acknowledgement checkbox.
- **Auth gate:** if unauthenticated, checkbox + button replaced with "Sign in to apply" — Google OAuth inline in sticky bottom bar, not modal. Consistent with AuthModal for users who prefer it. On successful auth, return to this page with scroll position + read state preserved.
- **Authenticated + acknowledged state:** big CTA button "Start application — 15 min" with time estimate (calc'd from essay word counts × 60wpm reading + 3min buffer).
- **Closed position:** gate hidden, CTA flips to "Notify me when Phase 2 opens" with email capture.
- **Related roles:** at bottom, "Also open this phase" rail with sibling positions.

### Frontend
- Sticky sidebar uses `position: sticky` with IntersectionObserver fallback for Safari edge cases.
- Auth bottom bar: `<dialog>` or portal-mounted floating panel, respects `prefers-reduced-motion`.
- Time estimate: pure calc on `essay_questions` array, memoized.

### Critique loop
- "Two separate places to sign in (bar + modal) confusing" → pick one, keep modal for consistency with listing page CTA
- "Application preview is marketing fluff" → strip to icons + step names, no illustrations
- "Sticky sidebar breaks on mobile" → collapse to top accordion under 768px

### QA checklist
- [ ] Deep link `/student/apply/vp-internal` works unauthenticated (doesn't redirect loop)
- [ ] Back button from form returns here with scroll position preserved
- [ ] 404 for invalid slug, not blank page
- [ ] Essay questions preview matches form exactly (single source of truth)
- [ ] Time estimate handles 0 essays gracefully ("< 5 min")
- [ ] Screen reader announces page role + deadline correctly
- [ ] Auth bottom bar dismissible with Esc
- [ ] Related roles exclude current position
- [ ] Scroll-depth tracker triggers at 90% of main content (not viewport)
- [ ] Acknowledgement checkbox disabled until scroll condition met, enabled smoothly (no flash)
- [ ] Start-application button disabled state explains why ("Please read the full role description")
- [ ] Refresh preserves both scroll position and acknowledgement state (sessionStorage)
- [ ] OAuth return preserves read state — no need to re-scroll and re-check

---

## 3. `AuthModal` — sign in / sign up

**Current state:** modal with Google + email/password, inline success banner (just fixed).

### Design pass
- **Reduce to one primary path:** Google OAuth as giant primary button. Email/password collapsed under "Or use email →" disclosure. 90% of students will Google-auth with their @uwo.ca.
- **Signup as default tab** when entering from application flow (they don't have accounts yet). Signin as default only when coming from dashboard link.
- **Inline field validation:** email format on blur, password strength meter on type.
- **Success state animation:** when verification email sent, modal transforms — inputs fade, success banner scales up, email icon illustration with "check your inbox" + the user's email address highlighted.
- **Trust signals:** small print under buttons: "We use Tethos accounts to track your application. No spam, no third-party sharing."

### Frontend
- Collapsible email section: framer-motion height animation, content-visibility for perf.
- Password strength: zxcvbn or simple regex (length + class count), colored bar.
- Success state: same modal container, swap inner content via AnimatePresence mode=wait.

### Critique loop
- "Google + email feels like standard SaaS" → differentiate with custom illustrated empty-inbox state
- "Trust signal too small" → move into form description, not below CTA
- "Modal feels cramped on mobile" → full-screen sheet on <640px

### QA checklist
- [x] Email signup without session shows inline banner, not alert (fixed)
- [ ] Google OAuth redirects back to correct `redirectTo` after callback
- [ ] Close button (X) and backdrop click both work
- [ ] Esc closes modal
- [ ] Focus trap inside modal, focus returns to trigger on close
- [ ] Form doesn't submit twice on double-click (disable button on loading)
- [ ] Error messages clear on mode toggle
- [ ] 375px: full-screen sheet, inputs large enough (44px min tap target)
- [ ] Password field has show/hide toggle

---

## 4. `ApplicationForm` — 4 steps

**Current state:** personal info → resume → essays → review, step indicator, validation.

### Design pass per step

#### Step 0: Personal info
- **Single column, generous spacing.** Don't cram 8 fields. Pair naturally: [full name] / [email + phone row] / [program + year row] / [LinkedIn] / [how heard].
- **Progressive disclosure:** LinkedIn marked optional with "skip if you don't have one", not rendered with asterisk.
- **Smart defaults:** if user authed with Google, pre-fill full_name and email from session. Show "using details from your account — edit if needed".
- **How heard:** radio pills, not dropdown. Faster to scan.
- **Year of study:** visual selector — 1 / 2 / 3 / 4 / 5+ buttons instead of dropdown.

#### Step 1: Resume
- **Drag-and-drop primary,** file input fallback. Huge drop zone with dashed border, hover state shows blue highlight.
- **Upload preview:** after select, show filename, size, PDF icon, "Replace" link. No progress bar until submit (client-side only).
- **Constraints front-loaded:** "PDF, 5MB max" visible BEFORE interaction, not as error.
- **Empty state illustration:** subtle document icon, not stock "upload cloud".

#### Step 2: Essays
- **One question per screen on mobile,** all on desktop with clear scroll landmarks.
- **Word counter inline right of question,** color shifts red past limit with shake animation.
- **Auto-save draft** to localStorage every 10s, restore on return. Banner: "Draft restored — last edited 2 min ago".
- **AI-assist disclaimer:** small footer "We can tell when essays are AI-written. Be yourself." (optional, but signals authenticity expectation).
- **Markdown-lite:** allow line breaks, render as paragraph tags.

#### Step 3: Review
- **Scannable summary,** grouped by section with edit buttons per section ("Edit personal info") that jump back to that step preserving all other data.
- **Resume preview embedded** via `<iframe>` or PDF.js for final check.
- **Submit button disabled until user checks "I confirm all information is accurate"** — one-time friction before irreversible submit.
- **Confetti preview disabled** until successful submit.

### Global form behaviors
- **Step indicator:** horizontal progress bar with step names, clickable to jump back (not forward until validated).
- **Save & exit:** button in header saves draft to localStorage immediately + syncs to Supabase `application_drafts` table (migration 009) if authenticated. Users can return days later from any device.
- **Draft restore:** on form mount, check Supabase first (authoritative), fall back to localStorage. Merge newer of the two. Show banner: "Draft restored — last edited {relative time}."
- **Keyboard nav:** Cmd+Enter to continue, Esc to save-and-exit.
- **Validation tone:** "We need your email" not "Email is required". Warm.

### New migrations required
- `009_application_drafts.sql` — table with `user_id`, `position_id`, `form_data` (jsonb), `updated_at`. Unique constraint on (user_id, position_id). Deleted on successful submission.
- `010_positions_calendly.sql` — adds `calendly_url text` column to positions table for interview scheduling.

### Frontend
- Step state in URL hash `#step=2` for back-button nav.
- Draft persistence: debounced localStorage + periodic Supabase sync if authenticated.
- Resume preview: `react-pdf` or `<iframe src={drive_url}>` after upload completes.

### Critique loop
- "Too many steps" → keep 4, but compress visual weight of indicator so it doesn't loom
- "Auto-save might save junk text" → only save after first valid field filled
- "Review step is just a list, boring" → group visually like a "letter to the team" — name/role at top, essays as body
- "Edit-per-section jump breaks progress" → preserve all data, step indicator shows which steps are valid

### QA checklist per step
- [ ] Back button between steps preserves all entered data
- [ ] Refresh mid-form offers draft restore
- [ ] Required field errors scroll into view + focus first invalid
- [ ] Word counter accurate (matches server-side check)
- [ ] Resume >5MB rejected client-side with helpful message, not generic
- [ ] Resume non-PDF rejected
- [ ] Essay word limit enforced but allows slight overage with warning (e.g., 501/500 warns, 520 blocks)
- [ ] Review step's edit buttons jump to correct step
- [ ] Double-submit prevented (button disabled during POST)
- [ ] Network failure mid-submit shows retry, doesn't lose data
- [ ] Submit with resume upload failure surfaces error clearly, form state preserved
- [ ] Tab order logical through all inputs
- [ ] Screen reader announces step changes

---

## 5. `SuccessScreen` — confirmation

**Current state:** confetti + "Application Submitted" + next steps + 2 CTAs.

### Design pass
- **Calmer than confetti.** Awwwards-tier sites don't overdo celebration. Keep confetti 1.5s max, then settle into a confident layout.
- **Personalized:** "Thanks, {firstName}. Your application for {positionTitle} is in." Use first name only, more personal.
- **Timeline expectation:** visual timeline showing where they are now (Submitted → Review starts {date} → Interview decisions {date} → Final {date}). Removes "when will I hear back" anxiety.
- **Actionable next steps:** not bullet platitudes. Concrete: "While you wait: (a) follow @tethos on LinkedIn, (b) read our 2025 impact report, (c) come to the open house April 28".
- **Share:** optional "share this role with a friend" button (copies position URL). Light growth loop.
- **Secondary CTA:** "View more roles" should respect current phase — only show roles still open.

### Frontend
- Confetti via `canvas-confetti`, 1.5s then cleanup.
- Timeline: reuse dashboard `StatusPipeline` component.
- Share button: `navigator.share` on mobile, clipboard fallback with toast.

### Critique loop
- "Confetti looks AI-generated" → use tethos brand colors only (blue/yellow/white), custom particle shapes (triangles not circles)
- "Timeline dates hardcoded" → pull from position.closes_at + offsets defined in recruitment.ts
- "Share feels transactional" → only show to users who got all the way through, not for closed-beta feel

### QA checklist
- [ ] Confetti respects `prefers-reduced-motion` (skip entirely)
- [ ] Dates in user's timezone, not UTC
- [ ] "More roles" link excludes the just-submitted one
- [ ] Deep link to this screen returns to dashboard instead (can't re-trigger confetti)
- [ ] Email confirmation sends reliably (QA test: submit 10x, all 10 emails arrive)
- [ ] Screen readable without animation

---

## 6. `/student/apply/dashboard` — status tracker

**Current state:** list of applications, status pipeline visualization.

### Design pass
- **One hero application per tab** if user has >1, tabs at top. For most users this is just 1-2 applications.
- **Status as the focal element:** large status pipeline component taking 60% of card height, current step glowing, past steps dimmed, future steps outlined.
- **Activity feed per application:** "Application submitted — {date}", "Moved to screening — {date}", "Interview invite sent — {date}". Each is a subtle row with timestamp.
- **Action area:** if status = `interview_invite`, render Calendly inline embed (`react-calendly` InlineWidget) below the pipeline — students book without leaving the page. Admin sets `positions.calendly_url` column (migration 010) per position. If `offer`, show accept/decline. If `declined`, show "feedback available" link.
- **Empty state:** for users with 0 applications (shouldn't happen but safe), "You haven't applied yet. → Browse roles" CTA.
- **Resume preview:** collapsible section showing the PDF they submitted, with "download" option.

### Frontend
- Tabs: framer-motion layout animation between tabs.
- Activity feed: computed from status_releases table, ordered DESC.
- Calendly / offer accept: behind feature flag, not required for launch.

### Critique loop
- "Feels too barren for users with 1 application" → fill with Tethos content (upcoming events, recent wins) to make dashboard feel alive
- "Status pipeline dominates" → correct, that's the point
- "Action area inconsistent across statuses" → standardize card height, empty action slot becomes motivational copy ("We're reviewing — average turnaround is 5 days")

### QA checklist
- [ ] Unauthenticated visit redirects to login, returns here after
- [ ] Status updates reflect immediately after admin release (test end-to-end)
- [ ] Multiple applications sorted by most recent status change
- [ ] Activity timestamps relative ("2 days ago") with absolute on hover
- [ ] Resume download link still works 30+ days after submit (Drive permissions persist)
- [ ] Terminal statuses (offer/waitlist/declined) render distinct visual treatment
- [ ] No status change notifications duplicated
- [ ] 375px: pipeline scrolls horizontally if needed, no overflow

---

## 7. `/student/apply/internal` — alumni gated listing

**Current state:** `InternalGate` component for code entry, then listing.

### Design pass
- **Gate screen:** single centered card, Tethos logo, "Welcome back" headline, code input with monospace font, Unlock button. Below: "Not a past member? → Apply publicly" link.
- **Code hint:** small text "Check the Slack #alumni channel for this year's code" — removes friction for legitimate alumni who forgot.
- **Unlock animation:** card scales up, content morphs, "Welcome back, {name}" if authenticated (pull first name from Google session).
- **Listing:** same bento pattern as public, with yellow `#FFD166` accent instead of blue to differentiate. Header: "These roles are exclusive to past members."

### Frontend
- Gate code input: mask if desired, or plain text — plain is fine for this use.
- Error shake animation on wrong code, not destructive color shift.
- Remember code in sessionStorage (not localStorage — gate re-locks on browser close for security).

### Critique loop
- "Code input feels like a password field, uncomfortable" → make it feel like an invite code, mono font, spacing
- "No way to request code if lost" → add "Request access →" mailto link
- "Welcome state doesn't feel welcoming" → add subtle confetti burst (1s) on unlock

### QA checklist
- [ ] Code is trimmed + lowercased before comparison server-side
- [ ] Wrong code message specific ("Code not recognized") not vague
- [ ] Correct code persists across page nav within session
- [ ] Refresh after unlock stays unlocked (sessionStorage)
- [ ] Closing browser re-locks
- [ ] Gate accessible via keyboard (Enter submits)
- [ ] Screen reader announces locked / unlocked state

---

## Integration QA — cross-page flows

After per-page passes, run these end-to-end walkthroughs:

### Flow A: Fresh student, happy path
1. Land `/student/apply` → scroll through → click VP Internal
2. Detail page → "Sign in to apply" → Google OAuth
3. Callback returns to `/student/apply/vp-internal` (not dashboard)
4. Start application → fill all 4 steps → submit
5. Success screen → click "Track application" → dashboard shows submission
6. Refresh dashboard → data persists
7. Check email → confirmation arrived within 30s

### Flow B: Returning alumni
1. Share internal code out-of-band
2. Visit `/student/apply/internal` → enter code → unlock
3. Click PM Internal → sign in (existing account)
4. Complete application (shorter, 1 essay)
5. Dashboard shows both applications if applied to multiple

### Flow C: Error recovery
1. Start application → fill step 1 → close browser
2. Return next day → detail page → "Continue your application" CTA
3. Resume pre-filled, resume upload re-required (security), essays preserved
4. Network cut during submit → retry button, no data loss

### Flow D: Admin workflow
1. Admin logs in → `/admin/recruit`
2. New application visible within 1 min of student submit
3. Admin sets draft_status = screening → releases
4. Student dashboard updates within 1 min
5. Status update email sent

### Performance budgets
- LCP ≤ 2.5s on 4G mobile for every page
- CLS ≤ 0.1
- TBT ≤ 200ms
- Bundle size per route ≤ 200KB gzipped
- Resume upload should start transfer within 500ms of submit click

### Accessibility acceptance
- axe-core: 0 violations on every page
- Manual keyboard-only walkthrough of full flow completes without mouse
- VoiceOver walkthrough announces all state changes
- Color contrast AA on all text
- Form errors announced via aria-live

---

## Execution order (14 days)

| Day | Work |
|-----|------|
| 1-2 | Design pass + frontend for pages 1 + 2 (landing, detail). Ship behind feature flag. |
| 3 | Design-feedback critique 1+2, revise, ship |
| 4 | Pages 3 + 5 (auth modal, success screen) |
| 5 | Pages 6 + 7 (dashboard, internal) |
| 6-8 | ApplicationForm — biggest piece, one step per day with critique |
| 9 | Draft persistence (localStorage + optional Supabase `application_drafts` table migration) |
| 10 | Integration QA flows A-D |
| 11 | Accessibility + performance audit, fix |
| 12 | Cross-browser (Safari 15+, Firefox, Chrome), mobile real devices |
| 13 | Load test — simulate 500 concurrent submissions |
| 14 | Buffer / stakeholder review |

---

## Locked decisions

1. **Draft persistence:** both. localStorage writes debounced 10s (instant recovery, no auth required). Supabase `application_drafts` table syncs when authenticated (cross-device). Requires migration `009_application_drafts.sql`.
2. **AI-writing disclaimer:** included. Small footer on essay step: "We can tell when essays are AI-written. Be yourself."
3. **Confetti:** kept. 1.5s, brand colors only (blue/yellow/white), custom particle shapes, respects `prefers-reduced-motion`.
4. **Interview scheduling:** v1 via `react-calendly` inline embed on dashboard when status = `interview_invite`. Admin configures Calendly event URL per position in admin UI. v1.1 adds Calendly webhook → Supabase status sync (auto-move to `interview` status on booking). Rationale: rebuilding scheduler in-house = 2-3 weeks of work we don't have; external link breaks UX flow; embed keeps students on site with zero backend.
5. **Role detail as gate before application:** role detail page (`/student/apply/[role-slug]`) becomes a required read-before-apply step. Scroll-depth tracker + explicit "I've read the role and I'm ready to apply" checkbox before the "Start application" CTA unlocks. Prevents low-effort applications from candidates who didn't read the description. Detail page gets expanded content — responsibilities, what you'll build, who we're looking for, time commitment, application process preview.
6. **Internal code distribution:** manual DM from founder. Alumni list ~20-30 people, personal outreach carries signal. Revisit automated distribution if list exceeds 100.

---

## Definition of done

A page is 10/10 when:
- No items remain on design-feedback critique
- All QA checklist items green
- Lighthouse ≥ 90 across all categories on mobile
- axe-core 0 violations
- Manual walkthrough on iPhone + Android + desktop passes
- Reviewed by at least one non-technical Tethos member for comprehension

A flow is ready to launch when all 7 pages are done AND integration flows A-D pass end-to-end in staging AND load test 500 concurrent submissions succeeds.
