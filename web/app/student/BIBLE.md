# Student Page — Design Bible

> **Audience:** University students (first-years to fourth-years) considering joining or starting a Tethos chapter
> **Motion budget:** High — kinetic entrances, scroll-driven reveals, the full cinematic suite
> **Emotional target:** Excitement, belonging, ambition. A first-year student should finish scrolling and feel: *"I want to be part of this. This is where I level up."*

---

## 1. Audience & Emotional Target

### Who Is Here
An 18–23 year old CS or engineering student. They're browsing at 11pm after a lecture. They're ambitious but haven't shipped anything real yet. Their portfolio has one todo-app and a class project. They want to matter. They've seen the Tethos name at a career fair or from a friend in the program. They're curious and slightly skeptical — is this real, or is it another club with a Notion page?

### What They Need to Feel
- **Energy:** this place is alive, there's momentum here
- **Belonging:** people like me are here, doing real things
- **Ambition:** this is where careers start
- **FOMO:** if I don't apply, I'm missing something real

### What Will Kill the Sale
- Placeholder content or generic copy
- Motion that feels flat or corporate — they can feel when a page wasn't built for them
- Benefit descriptions that sound like a textbook
- Benefits that feel generic (every club says "networking" and "leadership")

---

## 2. Current State

### What Exists
- **Hero section** (`app/student/page.tsx:238`) — `min-h-screen`, ASCII background texture, `AsciiReveal` scramble headline, body copy, two CTAs. The ASCII scramble is a good instinct but the section doesn't push far enough.
- **Benefits grid** (`app/student/page.tsx:292`) — 6 cards in a 3-column grid: Real Experience, Leadership, Impact, Network, Career Launch, Community. Standard dark cards with numbered icons and descriptions. Functional but generic.
- **"What You'll Build" section** (`app/student/page.tsx:334`) — A horizontal pill/tag cloud of project types. Currently: Web Applications, Mobile Apps, Design Systems, API Integrations, Data Dashboards, Internal Tools. Pure text, no visual treatment.
- **Vertical animated timeline** (`app/student/page.tsx:361`) — 4 steps: Gather Your Team, Submit Application, Get Approved, Start Building. Vertical line draws on scroll, items slide in from left. The line draw is working and good.
- **CTA section** (`app/student/page.tsx:417`) — Standard fade-in CTA block. "Ready to Start?" heading, two buttons.
- **AsciiDivider** elements between sections — texture connective tissue.

### Critical Gaps
1. **Hero plateaus** — the `AsciiReveal` scramble is a strong hook, but there's no visual weight or 3D element to anchor the section. After the headline, it reads flat.
2. **Benefits grid is generic** — 6 equal cards with numbered icons. Doesn't differentiate or communicate what these benefits actually feel like.
3. **"What You'll Build" is pure text** — a tag cloud of project types doesn't show any actual work. It should show real projects.
4. **Timeline is minimal** — the line draw is good but the steps are underspecified and the dot markers are small.
5. **No social proof from existing members** — no testimonials, no names, no faces.
6. **No chapter map** — no way to visualize the national/international scale of the network.

---

## 3. Page Vision

### The Cinematic Concept
The student page is the most kinetically alive page on the site. It earns the student's attention by meeting them at their energy level — surprising, fast-moving, technically expressive. But it's not noise: every high-energy moment serves a purpose in the conversion story.

The scroll journey moves from **who we are (energy, brand statement)** → **what you get (tangible benefits)** → **what you'll build (proof of work)** → **how to join (the path is clear)** → **do it now (close)**.

The page uses the full Tethos creative toolkit — ASCII art, 3D elements, scroll-driven reveals, character-level text animation — but each tool appears once. The rarity of each expressive moment is what makes it hit.

### The Narrative Arc
1. **Hero:** Identity statement. You'll feel the energy before you read a word.
2. **Benefits:** What being in Tethos actually changes about your career and your skill set.
3. **What You'll Build:** Proof of real work. Not a tag cloud — a gallery.
4. **How to Join (Timeline):** Four clear steps. The path is simple.
5. **CTA:** You know enough. Apply now.

---

## 4. Section-by-Section Breakdown

### 4.1 Hero — Push Further
**Current:** ASCII background texture (3% opacity), AsciiReveal scramble headline, body copy, two CTAs. Section height `min-h-screen`.

**Vision:**
The hero needs a visual anchor element. Two valid directions; choose one:

**Option A (Recommended): `InteractivePylon3D` as hero decoration**
- Mount `InteractivePylon3D` (`components/ui/InteractivePylon3D.tsx`) in the hero, positioned to the right of the heading text on desktop, or behind/below on mobile
- The physics-based tipping/tilting creates immediate "wow" for a student audience
- The Rapier physics pylon is perfectly on-brand: technical, tactile, unexpected
- Sizing: roughly 40% of viewport width, vertically centered
- The headline and body copy remain in the left column; the pylon occupies the right
- This creates a split layout: text left, interactive 3D right — a two-column hero
- Remove the full-width centered layout in favor of a max-width container with two columns
- On mobile: pylon collapses to a compact decorative element (100px tall, centered) above the text

**Option B: Particle system dissolve**
- A particle field that starts as scattered chaos and assembles into the Tethos logo or a geometric form as the page loads
- Lower priority — requires building a new Three.js particle component from scratch
- Reserve for a future iteration after Option A is proven

**Hero text (keep):**
- Label: `For Students`, `IBM Plex Mono`, `text-xs`, uppercase, `tracking-[0.3em]`, `color: var(--color-accent-cyan)`
- Headline: `AsciiReveal` scramble → keep. The scramble is distinctive and right for the student audience.
- Body copy: keep. "Join a nationwide collective of student developers building production software for nonprofits."
- CTAs: "Start a Chapter" (primary) + "Find Existing Chapter" (secondary) — keep hierarchy

**Background:** Keep the ASCII texture (`opacity: 0.03`). It's subtle background texture, not decoration.

**Animation:**
- `data-reveal` entrance: keep existing `opacity: 0, y: 30, scale: 0.98 → 1, 0, 1`, `DURATION_SECTION`, `EASE_ENTER`, stagger 0.1s
- Pylon: loads with physics, no GSAP needed — the component handles its own motion
- Add a subtle `box-shadow` glow behind the pylon container: `rgba(0,47,167,0.15)` — connects it to the blue brand without saturating it

---

### 4.2 Benefits — Reimagined as Visual Cards
**Current:** 6 equal dark cards, numbered icons, description text. Generic.

**Vision — The Signature Moment for this section:**
Transform the benefits from an information grid into a **large-format card experience** where each benefit gets a visual analogy alongside its description. The cards should be larger, more editorial, and more visually specific.

**New card anatomy:**
Each card is larger than the current grid cards — 2-column layout: text left, visual right (or top/bottom on mobile).

| Benefit | Visual Analogy |
|---|---|
| Real Experience | A GitHub contribution graph (generated SVG or screenshot) — real commits, real green squares |
| Leadership | A simple org chart or Slack thread mockup showing a student as team lead |
| Impact | A data visualization mockup: bar chart showing "Before Tethos" vs. "After Tethos" for a past NPO client |
| Network | A connection graph: student node linking to FAANG nodes via dotted lines |
| Career Launch | A LinkedIn notification mockup: "Jane Doe accepted a position at Stripe" |
| Community | A genuine member photo or candid grid of faces |

**Layout options:**
- **Option A:** Large 2×3 grid with bigger cards (`min-height: 280px`, `p-10`). Visual on the right side of each card. This is the simpler path.
- **Option B:** Horizontal scroll reel — cards are 500px wide, user scrolls horizontally through them one by one. Higher impact, more complex to build.

Option A is recommended for first implementation. The key change is card size and visual content — not layout complexity.

**Animation:**
- Entry: `opacity: 0, y: 40, rotateY: -8 → 1, 0, 0`, `DURATION_SECTION`, `EASE_ENTER` — **keep existing**
- Stagger: `i * 0.08` — keep existing
- Scroll trigger: `"top 85%"` — keep existing
- The visual analogy elements inside each card animate on a slight delay after the card itself: 0.15s after card entrance

---

### 4.3 "What You'll Build" — Upgrade to a Real Gallery
**Current:** A horizontal tag cloud of project type labels. Text only.

**Vision:**
Replace the tag cloud with a **real project gallery**: 3–4 past student projects shown as small browser-framed screenshots with project type, NPO partner name, and student team size.

**Layout:**
- 3 cards in a row on desktop, stacked on mobile
- Card: `280–320px` wide, `aspect-ratio: 16/10` screenshot at top, metadata below
- Metadata: `IBM Plex Mono` label (project type), heading (project name or NPO partner), 1-line description
- Below the grid: retain the project type tags, but styled smaller as a supplementary label group — not the headline feature

**If real project screenshots aren't available yet:**
- Use stylized placeholder cards with project type labels and "Coming Soon" treatment
- Or: use a mosaic of screenshots from Dribbble/open-source projects with a "Projects Like These" framing

**Animation:**
- Current: `opacity: 0, y: 30 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER` on the whole section — upgrade to stagger per card
- New: `STAGGER_NORMAL` (0.12s) between the 3 cards
- Cards: `opacity: 0, y: 24, scale: 0.97 → 1, 0, 1`, `DURATION_SECTION`, `EASE_ENTER`

---

### 4.4 Timeline — Push the Detail
**Current:** 4 steps, vertical line that draws on scroll, items slide in from left. Good bones. The line draw is right.

**Vision:**
The timeline itself is solid — the issue is the step content is thin. Each step needs one more layer of information:

| Phase | Title | Current | Add |
|---|---|---|---|
| 01 | Gather Your Team | "Recruit 5-10 committed students..." | Time estimate: `~2 weeks` |
| 02 | Submit Application | "Fill out our chapter application..." | What's in the application (3-bullet list) |
| 03 | Get Approved | "Our team reviews your application..." | What happens next: intro call, onboarding kit |
| 04 | Start Building | "Connect with local nonprofits..." | First project timeline expectation |

**Visual enhancement:**
- Each step dot is currently `w-3 h-3` (12px). Increase to `w-4 h-4` (16px) and add a blue glow: `box-shadow: 0 0 8px rgba(0,47,167,0.5)`
- The mono phase number should be styled more prominently — current `text-xs` is too small relative to the title. Try `text-sm`.

**Animation (keep entirely):**
- Line draw: `scaleY: 0 → 1`, `scrub: 1`, trigger `"top 60%"` to `"bottom 40%"` — keep
- Items slide in: `opacity: 0, x: -30 → 1, 0`, `DURATION_SECTION`, `EASE_ENTER`, trigger `"top 82%"`, delay `i * 0.06` — keep
- The dot glows can pulse once on enter: `scale: 1 → 1.3 → 1`, `DURATION_MICRO`, triggered with each timeline item reveal

---

### 4.5 CTA
**Current:** Fade up on scroll, "Ready to Start?", two buttons.

**Vision:**
The CTA is close but needs more specificity. "Ready to Start?" is fine. The subtext currently says "Join hundreds of students building the future of technology for social good." This is generic.

**Replace with:** A more specific version that gives the student a mental image:
> "Tethos chapters are active at 12+ universities. 200+ student developers shipped production software last year. Yours could be next."

**CTA button copy:**
- Primary: "Apply to Start a Chapter" — keep
- Secondary: "Explore Active Chapters" — replace "Sign In" which makes no sense as a CTA on this page

**Layout:** Max width, centered, generous padding `py-40` — keep the extreme negative space. The breathing room signals that this is a moment of decision.

**Animation:** Keep existing fade-up, `DURATION_SECTION`, `EASE_ENTER`. Single animation, no stagger.

---

## 5. Animation Choreography

### Motion Philosophy for Students
This page has the highest motion budget. Every section can have an entrance. The hero has a 3D element. The timeline has a scrub-linked animation. But: no ambient loops, no auto-plays, no spring bounce.

### Hero
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| `[data-reveal]` children | `opacity: 0, y: 30, scale: 0.98` | `opacity: 1, y: 0, scale: 1` | `DURATION_SECTION` (0.9s) | `EASE_ENTER` | Load, stagger 0.1s, delay 0.15s |
| InteractivePylon3D | Physics-driven | — | — | Rapier (internal) | Component mount |
| Pylon container | `opacity: 0` | `opacity: 1` | `DURATION_SECTION` | `EASE_SMOOTH` | Load, delay 0.4s |

### Benefits Grid
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Each card | `opacity: 0, y: 40, rotateY: -8` | `opacity: 1, y: 0, rotateY: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 85%"`, delay `i * 0.08` |
| Card visual element | `opacity: 0` | `opacity: 1` | `DURATION_SECTION` | `EASE_SMOOTH` | Card trigger + 0.15s delay |

### Projects Gallery
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Each project card | `opacity: 0, y: 24, scale: 0.97` | `opacity: 1, y: 0, scale: 1` | `DURATION_SECTION` | `EASE_ENTER` | `"top 80%"`, stagger `STAGGER_NORMAL` |

### Timeline
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Vertical line | `scaleY: 0` | `scaleY: 1` | — | `"none"` (scrub: 1) | `"top 60%"` to `"bottom 40%"` |
| Timeline items | `opacity: 0, x: -30` | `opacity: 1, x: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 82%"`, delay `i * 0.06` |
| Step dots | `scale: 1` | `scale: 1.3 → 1` | `DURATION_MICRO` (0.2s) | `EASE_SMOOTH` | On item reveal completion |

### CTA
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| CTA block | `opacity: 0, y: 30` | `opacity: 1, y: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 80%"` |

---

## 6. Assets Required

### 3D Component
- `InteractivePylon3D` — already exists at `components/ui/InteractivePylon3D.tsx`. No new asset needed. Verify it renders correctly when placed in a 2-column hero layout with constrained width.

### Photography / Screenshots
- `student-project-1-hero.png` through `student-project-3-hero.png` — browser-framed screenshots of 3 real student projects (the "What You'll Build" gallery). Can also be mockups if real screenshots aren't available.
- `student-benefit-community.jpg` — candid photo of Tethos members working together (for the Community benefit card)

### Benefit Visual Analogies (can be generated/illustrated)
- `benefit-experience-github.svg` — GitHub contribution graph SVG (generic, not real user data)
- `benefit-leadership-org.svg` — simplified org chart illustration
- `benefit-impact-chart.svg` — before/after bar chart illustration
- `benefit-network-graph.svg` — connection graph illustration
- `benefit-career-notification.svg` — LinkedIn notification mockup
- `benefit-community.jpg` — photo (see above)

### Copy
- 3 real student project entries (name, NPO partner, project type, team size, 1-line outcome)
- Accurate chapter count and student developer count for the CTA
- Real testimonial from a current or past member (name, year, major, what they built)

---

## 7. Existing Components to Reuse

| Component | Path | How to Use |
|---|---|---|
| `InteractivePylon3D` | `components/ui/InteractivePylon3D.tsx` | Hero right column — physics-based 3D element. Constrain to ~40vw max width. No modification needed. |
| `AsciiReveal` | `components/ascii/AsciiReveal.tsx` | Hero headline — keep existing usage. `scrambleDuration: 1.0`, `triggerOnScroll: false` |
| `AsciiDivider` | `components/ascii/AsciiDivider.tsx` | Keep existing dividers between sections — they're on-brand and add texture without decoration |
| `AsciiGlobe` | `components/ui/AsciiGlobe.tsx` | Optional: could be used as a subtle section divider or background element in the "What You'll Build" section if the 3D pylon is in the hero |
| `TextRevealSection` | `components/sections/TextRevealSection.tsx` | Can replace or supplement the benefits heading if character-level reveal is desired |
| `EASE_ENTER`, `EASE_SMOOTH` | `lib/motion.ts` | All scroll animations |
| `DURATION_SECTION`, `DURATION_MICRO` | `lib/motion.ts` | 0.9s for reveals; 0.2s for dot pulse |
| `STAGGER_NORMAL`, `STAGGER_SLOW` | `lib/motion.ts` | 0.12s for project cards; 0.2s for heavier reveals |
| `scaleUpVariants` | `lib/motion.ts` | Framer Motion variant for project cards if switching from pure GSAP |

---

## 8. New Components to Build

### `StudentProjectCard` (low complexity)
A project showcase card for the "What You'll Build" section.
- Props: `project: { name, partnerOrg, projectType, teamSize, screenshotSrc, screenshotAlt }`
- Screenshot at top, metadata below
- Slightly lighter surface than benefits grid cards — distinguish sections visually
- Hover: subtle border glow (`rgba(0,47,167,0.3)`) — the blue glow is appropriate for student page (per STYLE.md: blue glow + glass for students)

### `BenefitCard` (low complexity)
Enhanced benefit card with visual analogy support.
- Props: `benefit: { icon, title, description, visualSrc?, visualAlt? }`
- Two-column interior: text left, visual right
- If `visualSrc` is provided: renders image with `opacity: 0.9`
- If not: falls back to current numbered icon layout
- Preserves the existing animation hook pattern (`ref` + GSAP `fromTo`)

### `HeroLayout` refactor (medium complexity)
The hero section needs to become a 2-column layout to accommodate the pylon.
- Left column: text content (existing `data-reveal` elements)
- Right column: `InteractivePylon3D` with constrained sizing
- On mobile: stack vertically (pylon above text, smaller)
- The refactor is mostly layout — existing animations remain unchanged

---

## 9. Priority Order

Build these in order for maximum energy and conversion impact:

1. **Hero 2-column layout + InteractivePylon3D** — the first thing a visitor sees. Adding a physics-based 3D element transforms the hero from interesting to compelling. The pylon component already exists.
2. **Benefits visual analogies** — the "Why Join" section is the second thing students evaluate. Replace the numbered icons with actual visual evidence. Benefit impact: from "another club with bullet points" to "this is real and specific."
3. **"What You'll Build" project gallery** — replace the tag cloud with real project screenshots. Shows proof without requiring copy changes.
4. **Timeline detail upgrade** — add time estimates and sub-bullets per step, increase dot size with glow. Low effort, meaningfully clearer.
5. **CTA copy update** — replace generic subtext with specific numbers. Zero effort, immediate improvement.
6. **Social proof addition** — add a short testimonial from a real member between the timeline and CTA (currently missing). One quote, one name, one role. Single column, large type, light section.
