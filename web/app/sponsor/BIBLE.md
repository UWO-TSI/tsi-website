# Sponsor Page — Design Bible

> **Audience:** Corporate partners, CSR teams, DEI program leads, talent acquisition leaders at established companies
> **Motion budget:** Minimal — fade-ins only. No scroll-pin. Premium = restraint.
> **Emotional target:** Pride, exclusivity, impact. A sponsor should feel: *"our logo belongs here, and this is worth more than a banner ad."*

---

## 1. Audience & Emotional Target

### Who Is Here
A VP of Partnerships or Director of Social Impact at a mid-to-large technology company. They have a CSR budget. They've evaluated other sponsorship opportunities. They're comparing Tethos to a university sponsorship booth and a career fair presence. They want to know: what is the reach, what do I get, who else is in the room, and what does this cost?

The secondary visitor: a talent acquisition lead who has seen Tethos alumni on LinkedIn and wants to formalize the relationship.

### What They Need to Feel
- **Premium:** this is not a student club asking for a check. This is a structured partnership program with real deliverables.
- **Exclusivity:** limited tiers, limited partners, you belong in this cohort
- **Impact clarity:** what exactly does my sponsorship enable — show me the numbers, show me the faces
- **Trust:** other serious organizations are already here (the "Trusted By" section)

### What Will Kill the Sale
- Placeholder testimonials (currently in the code — these MUST be real before the page goes live publicly)
- Placeholder gallery photos (currently 6 gray boxes — same issue)
- Motion that feels playful or student-oriented — sponsors are buying premium partnership, not youth energy
- Generic copy ("supporting the next generation")
- Anything that feels unfinished or rushed

---

## 2. Current State

### What Exists
- **Hero** (`app/sponsor/page.tsx:233`) — "Fund Technology That Matters." Clear label, headline, body copy, two CTAs: "Become a Sponsor" (primary) and "Download Package" (secondary). Good. ✓
- **Sponsorship Tiers** (`app/sponsor/page.tsx:288`) — 4 tiers: Silver, Gold, Platinum, Catalyst. 4-column grid. Perk lists. Staggered reveal on scroll. Bones are solid.
- **Current Sponsors** (`app/sponsor/page.tsx:350`) — "Trusted By" section. 3 logos/names: Morrissette Entrepreneurship, 2 placeholders. Text-only, opacity 0.45 default.
- **Impact Stats** (`app/sponsor/page.tsx:384`) — 4 counters: 50+ Nonprofits Served, 200+ Student Developers, 100+ Projects Completed, 10K+ Lives Impacted. Animated counters. `// TODO: replace with real stats` comment. Placeholder numbers.
- **Package Highlights** (`app/sponsor/page.tsx:407`) — 4 cards: Brand Visibility, Talent Pipeline, Impact Reports, Event Access. 2×2 grid. Solid.
- **Event Gallery** (`app/sponsor/page.tsx:438`) — **6 gray placeholder boxes.** The most visually dead section on the page.
- **Testimonials** (`app/sponsor/page.tsx:466`) — **Placeholder quotes** with fake names (Jane Smith, Michael Chen) and fake companies (TechCorp Foundation, Innovate Inc.). Currently using made-up testimonials.
- **Contact CTA** (`app/sponsor/page.tsx:503`) — "Let's Build Together." Download Package (primary) + mailto link (secondary). Works.

### Critical Gaps
1. **Gallery is 6 gray boxes.** The most powerful emotional section — showing real humans, real events, real community — is currently empty placeholders.
2. **Testimonials are fabricated.** Using fake names and companies is a liability risk and an integrity problem. These must be replaced with real quotes before the page goes live.
3. **Current Sponsors section has 2 placeholders.** Only 1 real sponsor listed. The "Trusted By" section should not exist until there are at least 3–4 real logos.
4. **Stats are placeholder.** All 4 counter values are marked as TODO.
5. **No narrative about past events.** A sponsor deciding whether to invest wants to see what Genesis looks like — photos, attendee counts, atmosphere.

---

## 3. Page Vision

### The Cinematic Concept
The sponsor page is the most restrained page on the site. Its premium register comes entirely from typography, negative space, and the quality of its content — not from motion or decoration.

The design reference is a physical sponsorship prospectus — the kind produced by prestigious institutions. Heavy stock, white space, precise typography, evidence-forward. Every section earns its place. Nothing decorates.

Scroll through this page and it should feel like reading a well-formatted investor memo: each section makes one argument, then stops. No padding to fill space. No animation to distract.

The **Gallery section is the heart of this page** — when real photos arrive, it transforms from the weakest section to the strongest. The design must be built to do justice to real photography.

### The Narrative Arc
1. **Hero:** The investment frame. "Fund Technology That Matters." Direct, weighty, no embellishment.
2. **Tiers:** Here are your options. Structured, clear, one tier is clearly the flagship.
3. **What You Enable:** The case for impact. This is what your money actually does.
4. **Stats:** The proof that this is at scale.
5. **Who's Already Here:** Social proof from existing sponsors.
6. **Gallery:** Atmosphere. What does Genesis look and feel like?
7. **Testimonials:** Peer voices from sponsors who already invested.
8. **CTA:** Download the package or contact us.

---

## 4. Section-by-Section Breakdown

### 4.1 Hero
**Current:** `min-h-[90vh]`, centered text, label + headline + body + two CTAs. Working.

**Vision:**
The hero is close to correct. Two refinements:

1. **The "Download Package" CTA needs to feel premium.** Currently it has a download icon and text, which is correct, but the container styling is muted. The PDF download should feel like receiving a premium document — the CTA button should have a slightly more considered treatment: a thin line border (not filled), monospace font for the "Download Package" label, and a subtle hover that brightens the border to the brand blue. No fill. No glow. The restraint IS the premium signal.

2. **Add a single line of context below the headline**, before the body paragraph: a one-sentence framing of the opportunity:
   > `Genesis 2026 — June 2026 · Western University`
   Styled in IBM Plex Mono, `text-xs`, `tracking-[0.3em]`, muted. Grounds the ask in a specific, real event.

**Animation:** Keep existing `opacity: 0, y: 20 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER`, stagger `STAGGER_NORMAL`. Correct.

**`data-navbar-theme="dark"`** — already set. Keep.

---

### 4.2 Sponsorship Tiers
**Current:** 4-column grid, Silver/Gold/Platinum/Catalyst. Staggered reveal. Catalyst tier has blue border. Good bones.

**Vision:**
Minor refinements — the structure is largely right.

1. **Catalyst tier should be visually distinguished more strongly.** Currently it's the only card with a blue border (`1px solid #002FA7`). Add also: a subtle `box-shadow: 0 0 20px rgba(0,47,167,0.15)` on the Catalyst card only. This is within the glow opacity guidelines (background max 0.15 per STYLE.md).

2. **Add a pricing note** — currently "Contact for pricing" on all tiers. This is correct for a custom sponsorship program. Add a small footnote below the grid in `IBM Plex Mono`, `text-xs`, muted: `Pricing is custom based on chapter scale and engagement type. All tiers include Genesis 2026 access.`

3. **Tier names** — the current Silver/Gold/Platinum/Catalyst naming is conventional. Consider whether a Tethos-specific naming convention would feel more premium (e.g., `Node / Partner / Foundation / Catalyst`). This is a copy decision, not a design decision — flag for editorial review.

**Animation:** Keep existing staggered reveal (`opacity: 0, y: 24 → 1, 0`, `STAGGER_NORMAL`, `EASE_ENTER`).

---

### 4.3 Package Highlights
**Current:** 4 cards in 2×2 grid: Brand Visibility, Talent Pipeline, Impact Reports, Event Access. Solid.

**Vision:**
The cards are underwritten. Each benefit has a title and 1-2 sentences. For a sponsor audience, more specificity = more trust.

**Upgrade each card description:**
- **Brand Visibility:** "Logo placement on Tethos.ca, all Genesis event materials, and chapter social channels. Reach 5,000+ students, mentors, and industry professionals annually."
- **Talent Pipeline:** "Priority access to vetted student developers for summer internships and co-op terms. Review applications from top performers before they're publicly listed."
- **Impact Reports:** "Quarterly PDF report with project milestones, nonprofit outcomes, and aggregate chapter metrics. Shareable for internal CSR reporting."
- **Event Access:** "Speaking slot, branded workshop space, and 4–6 representative passes to Genesis. Premium networking with student developers and their mentors."

The numbers make these credible. Make sure the numbers are real before publishing.

**Animation:** Keep existing section-level `opacity: 0, y: 30 → 1, 0` reveal.

---

### 4.4 Impact Stats
**Current:** 4 animated counters with TODO placeholder values. GSAP counter tween. Working animation.

**Vision:**
The animation is correct and working. The only task is **replacing placeholders with real numbers** before launch.

Until real stats are available: the section should still render, but consider a fallback design that doesn't highlight the numbers being placeholder. Options:
- Leave counters at real values only (even if they're lower — 12+ nonprofits is better than a fake 50+)
- Or: don't display this section publicly until real stats are confirmed

Do not animate to fake numbers. A sponsor who looks up the claims and finds them inflated will lose trust immediately.

**Animation:** Keep as-is once real values are in.

---

### 4.5 Current Sponsors (Trusted By)
**Current:** 3 entries, 2 are placeholders. Text-only.

**Vision:**
**Do not display this section** until there are at least 3–4 real sponsors with real logos. A "Trusted By" section with placeholder names actively undermines trust.

**When real sponsors exist:**
- Replace text names with SVG logos (white monochrome, consistent bounding box 160×48px)
- Default opacity: `0.5`, hover: `1.0` — same as alumni logo pattern in company page
- Add a short context line below the logos: `Current sponsors across all Genesis tiers.`
- Consider adding the sponsor name + tier level below each logo in `IBM Plex Mono`, `text-xs`, muted

**Animation:** Section fade-up reveal, `DURATION_SECTION`, `EASE_ENTER`. Logo items stagger at `STAGGER_FAST` (0.06s).

---

### 4.6 Gallery — The Signature Moment
**Current:** 6 gray placeholder boxes in a 2×3 grid with "Event Photo N" labels.

**Vision — This section is the heart of the page when real assets arrive:**

Replace the uniform grid with an **editorial photo essay** layout. The gallery is not a collection — it's a story told through photographs. Each image gets copy that contextualizes the moment.

**Layout (with real photos):**
- 3 photographs, each full-bleed within a container
- Each photo: aspect-ratio `16/9` on desktop, stacked vertically (3 tall photos)
- Over each photo: a cinematic overlay with a short caption describing the moment:
  - `"120 students. One weekend. Genesis 2024 — London, Ontario."`
  - `"Team Helix presenting to Food Bank Canada. March 2025."`
  - `"Onboarding night, Tethos Chapter Western, September 2025."`
- The overlay uses a gradient (`linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)`) — gradient is permitted here because it's an image overlay, not a section background (per STYLE.md rules).
- Caption text: IBM Plex Mono, `text-xs`, white, bottom-left of each image
- Photo containers: no gap, full-width, touch-to-touch, using negative space within each photo (not padding between them)

**Layout (placeholder state — current):**
- Display 3 placeholders instead of 6 — less obviously empty
- Replace "Event Photo N" with `// photo coming soon` in IBM Plex Mono style — at least it looks like a deliberate placeholder
- Add a section above the placeholders: a quote from a past Genesis participant in large type (even if the gallery is empty)

**Animation (minimal — per budget):**
- Each photo fades in sequentially: `opacity: 0 → 1`, `DURATION_SECTION` (0.9s), `STAGGER_SLOW` (0.2s) between each
- No scale, no parallax. Fade only.
- The captions fade in with a slight upward movement (`y: 10 → 0`) after the photo, delay 0.3s

---

### 4.7 Testimonials
**Current:** 2 testimonials with fabricated names and companies.

**Vision:**
**Do not display fabricated testimonials.** This is both an integrity issue and a trust liability.

**Until real testimonials are available:**
- Remove this section from the page entirely, or replace with a placeholder that doesn't fabricate attribution:
  ```
  // testimonials coming soon
  ```
  Styled as a centered mono label in the section space. A dignified empty state.

**When real testimonials exist:**
- Large-format treatment: each quote in full-width Test Söhne, `text-xl` or larger — not a card, not a bordered container. The whitespace holds the quote.
- Attribution below: name, title, organization in IBM Plex Mono, `text-sm`, muted
- Small headshot (48×48px, circular) next to attribution — only if available and permitted
- Two testimonials, one above the other, separated by generous vertical space (`py-16` between them)
- Background: light (`#F8F8F8` or white) — testimonials are a warmth moment; the light background creates contrast with the dark sections above/below
- `data-navbar-theme="light"` on this section

**Animation:** Each testimonial fades up: `opacity: 0, y: 20 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER`. No stagger between them — they're weighted statements, not a list.

---

### 4.8 Contact CTA
**Current:** "Let's Build Together." Download Package (primary blue) + mailto link (secondary). Working.

**Vision:**
The closing section is almost correct. One refinement:

The **"Download Sponsorship Package" CTA** should feel like opening a premium document — the interaction should signal intentionality. Current treatment: blue filled button, download icon, standard hover.

Proposed treatment:
- **Primary:** "Download Sponsorship Package" — keep the blue fill, keep the download icon. But increase the button height to `py-5` (from `py-4`), add `tracking-[0.05em]` to the label text. The extra space signals premium.
- **Secondary:** "Get in Touch" → rename to "Contact Partnerships" — more precise framing for the sponsor audience
- Add a small note below the CTAs: `We respond to all partnership inquiries within 48 hours.` — sets an expectation, reduces friction.

**Extreme negative space:** `py-40` minimum, centered. The sponsor page closes with silence.

**Animation:** Single fade-up for the whole CTA block. `DURATION_SECTION`, `EASE_ENTER`. Nothing else.

---

## 5. Animation Choreography

### Core Principle
The sponsor page's premium register comes from **what doesn't move**. Every animation on this page is a fade. No scale transforms on section reveals. No `y` translation on hero elements. No stagger on CTA buttons. Every moment of stillness is a statement.

The one exception to pure fades: the tier cards have a `y: 24` entrance (already implemented) — this is acceptable because it's the one "guidance" animation that helps the eye register the card grid layout.

### Hero
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| `[data-reveal]` children | `opacity: 0, y: 20` | `opacity: 1, y: 0` | `DURATION_SECTION` (0.9s) | `EASE_ENTER` | Load, stagger `STAGGER_NORMAL`, delay 0.2s |

### Tier Cards
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Each card | `opacity: 0, y: 24` | `opacity: 1, y: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 85%"`, delay `i * 0.1` |

### All Other Sections (default)
```
From: opacity: 0, y: 30
To: opacity: 1, y: 0
Duration: DURATION_SECTION (0.9s)
Ease: EASE_ENTER ("power3.out")
Trigger: scrollTrigger { start: "top 80%", toggleActions: "play none none none" }
```

### Gallery Photos
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Each photo | `opacity: 0` | `opacity: 1` | `DURATION_SECTION` | `EASE_SMOOTH` | `"top 80%"`, stagger `STAGGER_SLOW` (0.2s) |
| Photo captions | `opacity: 0, y: 10` | `opacity: 1, y: 0` | `DURATION_NORMAL` (0.6s) | `EASE_SMOOTH` | Photo trigger + 0.3s delay |

### Stat Counters
| Element | Animation | Duration | Easing | Notes |
|---|---|---|---|---|
| Counter value | `value: 0 → target` | `DURATION_CINEMATIC` (1.8s) | `EASE_SMOOTH` | `once: true`, stagger `STAGGER_SLOW` |

### What Does NOT Animate
- PDF download button (static, only hover state changes)
- FAQ/accordion (interaction-driven if present)
- Testimonial attribution (static)
- Section dividers
- Sponsor logos (CSS `opacity` transition only, no GSAP)

---

## 6. Assets Required

### Photography (Highest Priority — Page Is Blocked Without These)
- `genesis-2026-event-1.jpg` — wide establishing shot of the Genesis venue or keynote moment
- `genesis-2026-event-2.jpg` — close-in moment: student presenting, team huddle, workshop
- `genesis-2026-event-3.jpg` — sponsor/student interaction, networking moment, or award
- All photos: minimum 1920×1080px, high quality (professional or semi-pro photographer at the event)

### Sponsor Logos
- Real sponsor SVG logos (white monochrome) for all current and committed sponsors
- Morrissette Entrepreneurship logo already implicitly available — source from Western University

### Testimonials
- 2 real quotes from current sponsors: quote text, author name, title, organization
- Author headshots (optional but recommended): 80×80px, professional

### PDF Document
- `genesis-2026-sponsorship-package.pdf` — the downloadable package referenced in hero CTA. Must exist for the CTA to function. Verify file exists at `/public/genesis-2026-sponsorship-package.pdf`.

### Copy
- Verify all 4 impact stats with real data before publishing
- Accurate Genesis 2026 date and location for the hero event label
- Real tier pricing once finalized (or confirm "contact for pricing" model)

---

## 7. Existing Components to Reuse

| Component | Path | How to Use |
|---|---|---|
| `ImpactStats` | `components/sections/ImpactStats.tsx` | Reference the animated counter pattern — sponsor page counter tween is already implemented similarly |
| `SponsorStrip` | `components/sections/SponsorStrip.tsx` | Could be adapted for the "Trusted By" logos section |
| `EASE_ENTER`, `EASE_SMOOTH` | `lib/motion.ts` | All section fade animations |
| `DURATION_SECTION`, `DURATION_CINEMATIC`, `DURATION_NORMAL` | `lib/motion.ts` | 0.9s for section reveals; 1.8s for counters; 0.6s for caption sub-reveals |
| `STAGGER_SLOW`, `STAGGER_FAST` | `lib/motion.ts` | 0.2s for gallery photo stagger; 0.06s for logo grid stagger |
| `SCRUB_DEFAULT` | `lib/motion.ts` | Not used on this page — no scroll-pinned sections |
| `fadeInVariants` | `lib/motion.ts` | Framer Motion fallback if any section uses Framer instead of GSAP |

---

## 8. New Components to Build

### `SponsorGalleryPhoto` (low complexity)
A full-width photo with cinematic caption overlay.
- Props: `src: string`, `alt: string`, `caption: string`
- `aspect-ratio: 16/9`, `border-radius: 12px`, `overflow: hidden`
- Gradient overlay: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)`
- Caption: IBM Plex Mono, `text-xs`, white, positioned `bottom: 16px, left: 24px`
- Animation hooks: receives a GSAP ref for the fade-in trigger

### `SponsorLogoGrid` (low complexity, when real logos exist)
A responsive logo grid with hover opacity behavior.
- Props: `sponsors: { name, logoSrc, tier }[]`
- Default opacity: `0.5` per logo
- CSS `transition: opacity 0.2s` on hover to `1.0`
- Accessibility: `alt` text on each logo image
- No GSAP needed for the opacity behavior — pure CSS

### Gallery editorial layout update
Not a new component — a structural change to the existing gallery section:
- Remove the 2×3 grid
- Replace with 3 stacked full-width `SponsorGalleryPhoto` instances
- Add a section headline above: "Genesis & Community"

---

## 9. Priority Order

Build in this order. Note that several items are **blocked on assets** — the architecture is ready but content doesn't exist yet.

1. **Get real stats** — replace all placeholder counter values with real numbers, or remove the stats section. This is a data task, not a design task, but it's blocking launch credibility.
2. **Remove or fix fabricated testimonials** — replace with empty state or real quotes. Fabricated attribution is a blocking risk.
3. **Verify PDF exists at the correct path** — `genesis-2026-sponsorship-package.pdf` must be in `/public/`. If it doesn't exist, the primary CTA on this page and the hero are broken.
4. **Gallery editorial layout** (blocked on photos) — build the `SponsorGalleryPhoto` component and layout now; populate with real photos when they arrive.
5. **Package Highlights copy upgrade** — add specific numbers to each benefit description. Low effort, directly increases conversion.
6. **Catalyst tier visual treatment** — add the `box-shadow` glow to the featured tier. 5 minutes of CSS.
7. **Trusted By logo upgrade** — replace text names with SVGs when real logos are sourced.
8. **Hero CTA premium polish** — adjust Download Package button sizing and tracking. Low effort, signals premium care.
