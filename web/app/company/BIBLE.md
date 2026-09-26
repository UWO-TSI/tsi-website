# Company Page — Design Bible

> **Audience:** CTOs, engineering leads, startup founders, HR/talent acquisition at tech companies
> **Motion budget:** Low — confident stillness. Transitions crisp, not flashy. No parallax.
> **Emotional target:** Credibility, professionalism, peer-to-peer respect. A CTO should finish scrolling and think: *"this is a real team that ships real software. I want to work with them."*

---

## 1. Audience & Emotional Target

### Who Is Here
A CTO or engineering manager at a company with an engineering problem. They're evaluating two distinct propositions: (a) hire Tethos to build something, or (b) recruit from Tethos's talent pipeline. They think in terms of deliverables, velocity, and risk. They've seen student portfolios that look good but deliver nothing. They need to see evidence of shipping, not enthusiasm.

The secondary visitor: talent acquisition at a mid-to-large tech company. They're here because someone told them Tethos alumni go to FAANG. They want to see the talent bench and understand the pipeline.

### What They Need to Feel
- **Credibility:** real projects, real tech stacks, real metrics
- **Peer-to-peer respect:** this isn't a student club asking for charity; this is a team making a direct business case
- **No-nonsense clarity:** what can you build, what will it cost (or what do I offer), who has worked with you before
- **Social proof:** the alumni list is the proof for talent; the case studies are the proof for build

### What Will Kill the Sale
- Empty placeholder sections (currently most of the page)
- Vague copy ("we build impactful solutions") with no specifics
- Motion that feels self-celebrating — a CTO interprets kinetic pages as overcompensating
- Alumni section that's just text names with no context

---

## 2. Current State

### What Exists
- **CompanyHero** (`components/hero/CompanyHero.tsx`) — exists. Title: "Build With Us. / Hire From Us." Two CTAs: "Start a Project" and "Partner for Talent." Copy is direct and correct.
- **BuildSection** (`app/company/build/BuildSection.tsx`) — exists, quality unknown
- **CompanyTimeline** (`app/company/build/CompanyTimeline.tsx`) — exists inside build section
- **ProgramsSection** (`app/company/programs/ProgramsSection.tsx`) — exists, quality unknown
- **AlumniSection** (`app/company/alumni/AlumniSection.tsx`) — exists. Currently a 2×4 grid of company name + role. Text only. ✓ (decent bones)
- **WorkSection** (`app/company/work/WorkSection.tsx`) — **empty placeholder.** Just a full-screen section with the heading "Work" centered. The most critical section on the page is empty.
- **FAQSection** (`app/company/faqs/FAQSection.tsx`) — exists, quality unknown
- **GetStartedSection** (`app/company/get-started/GetStartedSection.tsx`) — exists, quality unknown
- **TalentSection** (`app/company/talent/TalentSection.tsx`) — exists but not rendered in page.tsx

### Critical Gaps
1. **WorkSection is completely empty.** This is the conversion section — proof of what Tethos ships. Currently renders "Work" in white text on a black background. Highest priority fix on the entire site.
2. **AlumniSection is text-only.** Company names without logos, real names, or any human signal.
3. **No real project data anywhere.** No screenshots, no metrics, no tech stack references.
4. **TalentSection not connected** — exists as a component but isn't in the page composition.

---

## 3. Page Vision

### The Cinematic Concept
The company page is a **quiet confidence play**. It doesn't need to impress you with motion — it impresses you with evidence. The visual language is borrowed from Linear.app and Stripe: spare, high-contrast, typography-forward, with content that speaks for itself.

The page makes two separate arguments, one after the other:
1. **Build argument:** We have a process, a methodology, a team — here's what we've shipped.
2. **Hire argument:** Our alumni go to the best companies in the world — here's how to access them.

These two arguments should feel like two distinct sections of a pitch deck, both using the same clean design language.

### The Narrative Arc
1. **Hero:** Direct value proposition. Two paths, stated plainly.
2. **Build:** What we can build for you, with process.
3. **Work (Case Studies):** What we've built. Evidence. This is the page's center of gravity.
4. **Programs:** How the engagement works (scope, timeline, pricing model).
5. **Alumni:** Where our talent goes. The proof for the hire argument.
6. **FAQ:** Handle objections.
7. **Get Started:** Close.

---

## 4. Section-by-Section Breakdown

### 4.1 CompanyHero
**Current:** Title "Build With Us. / Hire From Us." Two CTAs. Unknown animation state.

**Vision:**
The hero should feel like the opening slide of a pitch deck — precise, confident, no decoration.

**Option A (Recommended): Type-animation hero**
- The headline types itself in — not a scramble (that's for students), but a clean cursor-blink type effect where each word appears with a blinking caret
- Implements in ~15 lines of GSAP: `stagger` on word spans, each word transitions from `opacity: 0` to `opacity: 1` over `DURATION_MICRO` (0.2s) intervals of `STAGGER_NORMAL` (0.12s)
- After all words appear, the caret fades out
- This is the one "unexpected visual element" for the company hero — it signals code literacy without being garish

**Option B: Split-screen hero**
- Left: a technical artifact — a dark terminal/code block showing a short, readable snippet (e.g., a TypeScript interface for a component Tethos built, or a realistic git log)
- Right: the product it produces — a browser mockup of the deployed result
- A thin `1px` vertical divider between them, centered
- No animation except the two sides fading in with slight offset (left first, right delayed 0.3s)

Option A is preferred — more elegant, lower asset dependency.

**Animation:** Hero entrance: content block `opacity: 0, y: 20 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER`, delay 0.2s. No scroll effects on the hero. It lands and stays.

**`data-navbar-theme="dark"`** — page is entirely dark.

---

### 4.2 BuildSection
**Current:** Exists with CompanyTimeline inside.

**Vision:**
- A 2-column layout: left = service list with descriptions, right = a carousel or grid of 3–4 **service category mockups** (small screenshots or illustrations representing product types Tethos builds)
- Service categories (left column):
  - **Web Applications** — React/Next.js, full-stack
  - **Internal Tools** — dashboards, admin panels, data pipelines
  - **Mobile Apps** — React Native or Flutter
  - **AI Integrations** — LLM-powered features, workflow automation
  - **Design Systems** — component libraries, brand toolkits
- Each service: IBM Plex Mono label, Test Söhne title, 1-line description
- The CompanyTimeline component (build process phases) can live below this as a compact horizontal timeline — 4 phases: Scoping → Design → Build → Handoff

**Animation:** Section reveals with the default scroll pattern (`opacity: 0, y: 30 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER`, `"top 80%"`). Service list items stagger at `STAGGER_NORMAL`. No other effects.

---

### 4.3 WorkSection — The Signature Moment (Highest Priority)
**Current:** Empty. Renders only "Work" centered on a black screen.

**Vision — This is the most important section on the company page:**
A **horizontal-scroll case study reel** showing 4–6 completed projects. The horizontal scroll pattern is used because it forces a deliberate, one-at-a-time engagement with each project — you can't skim through them all at once.

**Layout:**
- Section is full-height, scroll-pinned while the user horizontally scrubs through cards
- Each card: 600–700px wide, full section height, dark surface (`#1A1A1C`), subtle border
- Card anatomy (top to bottom):
  1. **Hero screenshot** — full-width, takes 50% of card height, rounded top corners. The screenshot is real (browser mockup framing preferred).
  2. **Project type tag** — `IBM Plex Mono`, `text-xs`, uppercase, muted: e.g., `NPO · WEB APPLICATION`
  3. **Project name** — Test Söhne, `text-2xl`, semibold
  4. **One metric** — the headline outcome in large type: e.g., `3,200+ users served` or `40% time savings`
  5. **Tech stack** — 3–5 technology badges: `React`, `Node.js`, `PostgreSQL`, etc. — small pill shape, `border-radius: 6px`, muted border

**Horizontal scroll mechanics:**
- The section uses `PinnedSection` (`components/sections/PinnedSection.tsx`) or a custom GSAP horizontal scroll implementation
- Pin the section, translate the card container on scroll: `x: 0 → -(totalWidth - viewportWidth)`, `scrub: SCRUB_DEFAULT` (1), `ease: EASE_LINEAR`
- Add a progress bar below the cards: a thin `2px` line that fills left to right as the user scrolls through — `scaleX: 0 → 1`, same scrub trigger

**Navigation hint:** A "scroll right →" label with a small arrow, positioned right of the first card, that fades out after the first horizontal scroll movement.

**Empty state (until real projects exist):** 4–6 placeholder cards with real labels and placeholder screenshots. The structure should be correct even before the assets exist.

**Animation:**
- Section entrance: `opacity: 0 → 1`, `DURATION_SECTION`, non-horizontal scroll trigger before pin begins
- Card horizontal translate: GSAP `x` tween, `scrub: 1`, `ease: "none"` (linear scroll-linked)
- Progress bar: `scaleX: 0 → 1`, `transformOrigin: "left"`, same scrub trigger

---

### 4.4 ProgramsSection
**Current:** Exists, quality unknown.

**Vision:**
- Two program types, each in a large side-by-side card:
  - **Project Engagement:** Build custom software. 8-month timeline. Pro-bono for NPOs; fee-bearing for companies.
  - **Talent Pipeline:** Vetted student developers for internship/co-op/FTE hiring. Structured program with a defined selection process.
- Each card: solid surface (`#1A1A1C`), `p-10`, no glass, `border-radius: 16px`, subtle border
- Inside each card: mono label, heading, description, list of 3–4 key features, CTA button
- The Catalyst sponsorship tier (cross-referenced from sponsor page) can be mentioned as an upgrade path

**Animation:** Default scroll reveal. Cards stagger in together with `STAGGER_NORMAL`.

---

### 4.5 AlumniSection
**Current:** 2×4 grid: company name + role (text only). 8 placements: Google, Microsoft, Amazon, Stripe, Shopify, Meta, Figma, Notion.

**Vision:**
- Rename to "Where Our Talent Goes" — more active framing
- Add company **logos** (SVG monochrome, white fill, consistent size — 120×40px bounding box)
- Remove the role text from each cell — let the logos speak
- Grid: 4 columns, logos centered in each cell, generous padding, muted opacity (0.5) by default, rising to full opacity on hover
- Below the logo grid: a **social proof strip** in larger type: "Tethos alumni have received offers from 40+ companies across North America." — the stat makes the grid legible as a data point, not a list

**Animation:** Logo grid items stagger in: `opacity: 0, y: 20 → 1, 0`, `STAGGER_FAST` (0.06s), scroll trigger `"top 85%"`. Default opacity 0.5 applied via CSS, not GSAP.

**Asset:** SVG logos for all 8 companies needed (or use text-based alternatives as fallback). See Section 6.

---

### 4.6 FAQSection
**Current:** Exists, quality unknown.

**Vision:**
- 6–8 FAQs specifically handling company/CTO objections:
  - "Are these actually experienced developers?" → reference to alumni outcomes and project count
  - "What happens if a student leaves mid-project?" → address continuity/handoff protocols
  - "What do we own at the end?" → IP and code ownership
  - "How is this different from hiring a co-op student directly?" → collective delivery model
  - "What does 'pro-bono' mean for companies vs. nonprofits?" → clarify the fee model
- Accordion pattern: each FAQ is a closed row, click to expand
- Expand animation: `height: 0 → auto` using GSAP's `height: "auto"` tween, `DURATION_MICRO` (0.2s), `EASE_SMOOTH`
- No stagger on accordion items — they're interactive elements, not a reveal sequence

**Animation:** Section title fades up on scroll trigger. Individual accordion items have hover states only (border brightens slightly). No entrance animations on individual FAQ rows.

---

### 4.7 GetStartedSection
**Current:** Exists, quality unknown.

**Vision:**
- The closing CTA, matching the dark, direct register of the page
- Two paths, clearly bifurcated:
  - **"Start a Project"** → links to a typeform or contact page
  - **"Access Talent"** → separate action
- Each path gets its own column with a headline, 2-line description, and CTA button
- A thin `1px` vertical divider between the two columns
- Background: `#0F0F10`. Large `py-40` minimum. Extreme negative space — this is the close.

**Animation:** Section fades up, `DURATION_SECTION`, `EASE_ENTER`. Nothing else. The stillness is the statement.

---

## 5. Animation Choreography

### Core Principle
Every section on the company page uses the same base entrance. There is no signature cinematic moment per section (unlike NPO or Student). The WorkSection horizontal scroll is the one narrative motion moment.

### Default Section Reveal (applies to all sections except WorkSection)
```
From: opacity: 0, y: 30
To: opacity: 1, y: 0
Duration: DURATION_SECTION (0.9s)
Ease: EASE_ENTER ("power3.out")
Trigger: scrollTrigger { start: "top 80%", toggleActions: "play none none none" }
```

### WorkSection (horizontal scroll — the exception)
| Element | Animation | Easing | Notes |
|---|---|---|---|
| Section container | `opacity: 0 → 1` | `EASE_ENTER`, 0.9s | Triggers before pin begins |
| Card rail | `x: 0 → -(totalWidth - vw)` | `EASE_LINEAR` (scrub: 1) | GSAP scroll-linked |
| Progress bar | `scaleX: 0 → 1` | `EASE_LINEAR` (same scrub) | `transformOrigin: "left"` |
| Scroll hint label | `opacity: 1 → 0` | Scrub | Fades after first rightward movement |

### Stagger Values
- **Service list items:** `STAGGER_NORMAL` (0.12s)
- **Alumni logo grid:** `STAGGER_FAST` (0.06s)
- **Work cards initial reveal:** `STAGGER_NORMAL` (0.12s) on first entrance before pin
- **FAQ accordion:** no stagger (interaction-driven only)

### What Does NOT Animate
- FAQ accordion rows on scroll-in (they're interactive elements)
- AlumniSection default logo opacity (handled by CSS, not GSAP)
- CTA section elements (single fade, no stagger)
- Nothing on load except the hero entrance

---

## 6. Assets Required

### Screenshots / Visual Proof (Highest Priority)
- `work-project-1-hero.png` through `work-project-6-hero.png` — browser-framed screenshots of 4–6 past projects
- `work-project-N-meta.json` — structured data: name, client type, tech stack array, key metric

### Company Logos (Medium Priority)
- `logo-google.svg` — white monochrome
- `logo-microsoft.svg`
- `logo-amazon.svg`
- `logo-stripe.svg`
- `logo-shopify.svg`
- `logo-meta.svg`
- `logo-figma.svg`
- `logo-notion.svg`

### Build Section
- `build-service-mockup-1.png` through `build-service-mockup-3.png` — small UI screenshots or illustrations representing service categories (optional but preferred over text-only)

### Copy
- 4–6 real case study entries (project name, NPO/company client, 1-sentence outcome, tech stack, key metric)
- Real FAQ answers for the 6 objection questions listed in Section 4.6
- Company CTA contact/form URL

---

## 7. Existing Components to Reuse

| Component | Path | How to Use |
|---|---|---|
| `PinnedSection` | `components/sections/PinnedSection.tsx` | WorkSection horizontal scroll — pin the section while the card rail translates |
| `ImpactStats` | `components/sections/ImpactStats.tsx` | Reference counter pattern if stats appear elsewhere on the page |
| `EASE_ENTER`, `EASE_LINEAR`, `EASE_SMOOTH` | `lib/motion.ts` | All animations use these |
| `DURATION_SECTION`, `DURATION_MICRO` | `lib/motion.ts` | 0.9s for section reveals; 0.2s for accordion interaction |
| `STAGGER_FAST`, `STAGGER_NORMAL` | `lib/motion.ts` | 0.06s for logo grid; 0.12s for everything else |
| `SCRUB_DEFAULT` | `lib/motion.ts` | `scrub: 1` for the WorkSection horizontal scroll |
| `fadeUpVariants` | `lib/motion.ts` | Framer Motion variant for any component that needs Framer integration |

---

## 8. New Components to Build

### `WorkCaseCard` (medium complexity)
The case study card used in WorkSection's horizontal scroll reel.
- Props: `project: { name, clientType, metric, techStack, screenshotSrc, screenshotAlt }`
- Screenshot at top (50% card height), `object-fit: cover`, rounded top corners
- Type tag, project name, metric, tech stack badges below
- Solid surface. No glass.
- Subtle hover state: border brightens slightly, no tilt or lift — this is a company page, not a student page

### `WorkSection` (high complexity — currently empty)
Full horizontal scroll implementation:
- GSAP `ScrollTrigger` with `pin: true`, `scrub: 1`
- Card rail with `x` tween
- Progress bar
- Scroll hint that fades post-interaction
- Entrance animation before pin begins
- Accepts array of `WorkCaseCard` data as props

### `FAQAccordion` (low complexity, if not already built)
Accessible accordion with GSAP height animation on expand/collapse.

---

## 9. Priority Order

1. **WorkSection** — currently a placeholder on the most important section of the page. Build the component structure first with placeholder cards. Then fill with real data as it becomes available. This is blocking the page from being credible.
2. **AlumniSection logo upgrade** — text names → company logos with real visual weight. Medium effort, high impact on perceived credibility.
3. **CompanyHero type animation** — the one "unexpected" moment for the page. Low effort, high signal-to-noise.
4. **WorkCaseCard real data** — once the component exists, populate with real screenshots and metrics.
5. **BuildSection service mockups** — visual polish pass; functional already.
6. **FAQSection content audit** — ensure the 6 objection questions are answered.
