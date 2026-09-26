# NPO Page — Design Bible

> **Audience:** Nonprofit executive directors, program managers, communications leads
> **Motion budget:** Medium — purposeful reveals, confident, no ambient noise
> **Emotional target:** Trust, competence, warmth. An NPO director should finish scrolling and think: *"these students are serious, this is real, I can hand my organization's technology over to them."*

---

## 1. Audience & Emotional Target

### Who Is Here
A director who runs a 5–50 person nonprofit. They're not technical. They've been burned before — by volunteer devs who disappeared, by agencies that were too expensive, by students who built something unusable. They're skeptical. They're busy. They landed here from a referral or a search and they need to be convinced quickly that Tethos is different.

### What They Need to Feel
- **Competence:** real process, real deliverables, real track record
- **Warmth:** this isn't a cold agency; these are humans who care about mission
- **Safety:** structured, accountable, documented — they can rely on this
- **Proof:** "I can see what you've built for others like me"

### What Will Kill the Sale
- Generic student-project energy
- Anything that feels unfinished or placeholder
- Motion that feels self-indulgent (they're not here to be impressed by animation)
- Copy that talks about Tethos instead of talking about the NPO's outcomes

---

## 2. Current State

### What Exists
- **NPOHero** (`app/npo/sections/NPOHero.tsx`) — dark-to-light background transition on scroll, pinned with fade-out. Hero copy is solid. The scroll transition is unique and working. ✓
- **NPOAbout** (`app/npo/sections/NPOAbout.tsx`) — exists, needs review
- **NPOTimeline** (`app/npo/sections/NPOTimeline.tsx`) — alternating left-right layout, vertical line that draws as you scroll, 5 phases with durations. Good bones. ✓
- **NPODeliverables** (`app/npo/sections/NPODeliverables.tsx`) — exists, needs review
- **Impact** (`app/npo/impact/Impact.tsx`) — exists, needs review
- **DocumentaryEmbed** (`app/npo/sections/DocumentaryEmbed.tsx`) — exists. Currently unstyled or minimally styled.
- **Testimonial** (`app/npo/testimonial/testimonial.tsx`) — exists, needs review
- **NPOCTA** (`app/npo/sections/NPOCTA.tsx`) — exists

### Critical Gaps
1. **No human photography anywhere.** The page is text-only. An NPO director cannot see themselves (or their community) in this experience. This is the biggest trust-killer.
2. **Timeline is pure text.** The alternating layout exists but phases have no visual artifacts. Nothing shows *what the work looks like* at each stage.
3. **No proof of work.** No past project screenshots, no case study links, no "we built this for X and it did Y."
4. **DocumentaryEmbed is unstyled.** A documentary is the most powerful trust asset on this page and it's sitting in an unstyled box.
5. **No impact map / network visualization.** The globe story from the homepage has no continuation here.

---

## 3. Page Vision

### The Cinematic Concept
The NPO page tells a story of transformation: *your organization has a problem → we have a proven process → here's what we've built → here's who trusts us.*

The scroll journey moves from **dark (serious, trustworthy)** through **light (warm, human, aspirational)** and back to **dark (committed, close the loop)**. The dark-to-light transition in the hero is the right instinct — preserve and extend it throughout the page.

The page should feel like reading a well-designed annual report: deliberate pacing, evidence-forward, with moments of humanity (photographs, testimonials, a real documentary) that make the technical rigorous feel warm.

### The Narrative Arc
1. **Hero:** We do serious work. Here's the gravity of what we're offering.
2. **About:** We understand nonprofits specifically. We know your world.
3. **Process Timeline:** Here's how it works, phase by phase. You'll never be lost.
4. **Deliverables:** Here's what you'll own at the end.
5. **Impact:** Numbers that prove this works.
6. **Documentary:** See it with your own eyes.
7. **Testimonials:** Hear from people like you.
8. **CTA:** Apply. The door is open.

---

## 4. Section-by-Section Breakdown

### 4.1 NPOHero
**Current:** Dark bg → white bg transition on scroll. Pinned. Fade-out content. Heading: "Software That Empowers Nonprofits." Working well.

**Vision:**
- Keep the dark-to-light scroll transition — it's distinctive and signals progression
- Add a **background visual element** that activates during the dark phase: a subtle, low-opacity globe visualization in the upper-right corner (simplified GlobeVisualizer variant — see Section 8). This connects the hero to the homepage globe story and implies "network" before the NPO has read a word.
- The globe should fade out as the background transitions to white — it belongs to the dark, technical register
- Add a **secondary label** above the headline: `Cohort 2026 · Applications Open` in IBM Plex Mono, small, muted — creates urgency and specificity
- Hero copy to anchor: two CTAs currently exist — "Apply for 2026 Cohort" (primary) and "Download Program Package" (secondary). Hierarchy is correct. Keep.

**Animation:** Current entrance (opacity 0 → 1, y 20 → 0, 0.9s, `EASE_ENTER`, delay 0.2s) is correct. Keep. The pin + scrub fade is the narrative motion for this section.

**`data-navbar-theme`:** Hero needs `data-navbar-theme="dark"` at start, switching to `"light"` as background becomes white. This is load-bearing for the navbar flip.

---

### 4.2 NPOAbout
**Current:** Unknown — needs review.

**Vision:**
- 2-column layout: left = large statement text, right = a **candid photography block** (3 photos in a staggered mosaic — students working, whiteboarding with an NPO client, a product demo moment)
- The statement text should read like a direct address: "We're not a consultancy. We're a collective of students who believe nonprofits deserve the same software as Fortune 500 companies."
- Below the statement: 3 key differentiators in a horizontal strip, each with a mono label and 1-line value prop:
  - `COMMITMENT` — 8 months, not 8 weeks
  - `OWNERSHIP` — you own the code, no vendor lock-in
  - `COST` — pro-bono. $0.
- Background: light (white or `#F8F8F8`) — this is the first warm section after the dark hero

**Animation:** Section slides up from 30px on scroll trigger. Differentiator strip staggers in at `STAGGER_NORMAL` (0.12s between items). Photos mosaic: the three images reveal with a clip-path wipe, staggered at `STAGGER_SLOW` (0.2s). `DURATION_SECTION` (0.9s) throughout.

**Asset:** 3 candid photos needed. See Section 6.

---

### 4.3 NPOTimeline — The Signature Moment
**Current:** Alternating left-right layout, vertical line that draws on scroll, 5 phases with duration labels. Good bones. Text-only.

**Vision — This is the most important section on the page:**
Transform the timeline from a text list into a **visual process narrative**. Each phase should reveal a small **visual artifact** alongside the text:

| Phase | Artifact |
|---|---|
| 01 Application | A form / intake card mockup (screenshot or illustration) |
| 02 Discovery | A whiteboard photo or affinity mapping image |
| 03 Design | A wireframe or Figma frame screenshot |
| 04 Development | A code snippet or GitHub PR screenshot |
| 05 Handoff | A deployed product mockup / browser screenshot |

These artifacts sit on the opposite side of each timeline text block. They appear as the user scrolls to each phase — not simultaneously, but sequentially as the timeline line draws itself. The line draw + artifact reveal = evidence that real work happens at each stage.

**Artifact treatment:** Each artifact is a screenshot framed in a subtle rounded rectangle (border-radius `12px`, border `1px solid #2A2A2C`). No glass. No glow. Solid surface. The technical/professional register is right for NPO trust.

**Animation:**
- Vertical center line: `scaleY: 0 → 1`, `scrub: 1`, trigger from `"top 60%"` to `"bottom 40%"` — keep existing
- Timeline items: `opacity: 0, x: ±30 → x: 0`, `DURATION_SECTION`, `EASE_ENTER`, trigger at `"top 80%"` — keep existing
- Artifacts: reveal with `opacity: 0, scale: 0.96 → 1`, `DURATION_SECTION`, `EASE_ENTER`, triggered simultaneously with their paired text block
- Duration labels: use IBM Plex Mono, muted, `text-xs` — keep existing semantic role

**Asset:** Artifact screenshots / illustrations needed. See Section 6.

---

### 4.4 NPODeliverables
**Current:** Unknown — needs review.

**Vision:**
- A clean grid of what the NPO receives at the end of the engagement:
  - Deployed web/mobile application
  - Full source code (GitHub repository handoff)
  - Documentation & training materials
  - 90-day post-launch support window
- Each deliverable: an icon (simple, line-weight consistent — not emoji, not colorful), a label, and a one-line description
- Background: dark (`#0F0F10`) — transitioning back from the light about section
- 4-column grid on desktop, 2-column on mobile

**Animation:** Cards stagger in, `opacity: 0, y: 24 → y: 0`, `STAGGER_NORMAL`, `EASE_ENTER`, scroll trigger at `"top 85%"`.

---

### 4.5 Impact
**Current:** Exists but needs review.

**Vision:**
- 4 stat counters: nonprofits served, developers deployed, projects completed, lives impacted
- Use the animated counter pattern from `sponsor/page.tsx` (GSAP `obj.value` tween to target, formatted with `toLocaleString()`)
- Background: dark, matches deliverables section
- Each stat: large Test Söhne number, IBM Plex Mono label below, no decoration beyond that
- Below the counters: **one sentence of context** — e.g., "Across 12 university chapters since 2022." This grounds the numbers.

**Animation:** Counters animate in once on scroll enter (`EASE_SMOOTH`, `DURATION_CINEMATIC` 1.8s, staggered at `STAGGER_SLOW`). After initial animation: still. Numbers don't re-animate.

---

### 4.6 DocumentaryEmbed — Hidden Asset
**Current:** Exists but unstyled.

**Vision — This section is currently wasted:**
The documentary is the most emotionally powerful trust asset on this page. An NPO director watching students talk about why they do this work, or seeing a past client describe what the software changed — nothing else on this page comes close to that conversion power.

**Treatment:**
- Full-width embed, max-width `1200px`, aspect ratio `16/9`
- A **cinematic reveal**: the video embed starts below the fold, and as the user scrolls to it, it scales up from `scale: 0.9` to `scale: 1.0` while fading in — `DURATION_CINEMATIC`, `EASE_SMOOTH`. Creates the feeling of a theater curtain opening.
- Above the embed: a section label (`IBM Plex Mono`, `text-xs`, `tracking-[0.3em]`, muted) — `The Documentary` — and a headline: "Watch What We Built."
- Below the embed: a caption with the documentary title, year, and runtime

**Background:** Dark. The video deserves a dark frame — it's cinematic.

**Animation:** Scale + fade reveal as described. No other animation in this section.

---

### 4.7 Testimonial
**Current:** Exists but needs review.

**Vision:**
- 2 testimonials, large-format — not small cards
- Each testimonial: full-width or two-column split
- Quote text in large Test Söhne (not Plex Mono — this is human speech, not data)
- Attribution below: name, title, organization, and ideally a small headshot
- Background: **light section** — this is the moment of human warmth right before the CTA. The light register is correct.
- No borders on the quote containers. The whitespace is the container.

**Animation:** Each quote block fades up at `DURATION_SECTION`, `EASE_ENTER` on scroll trigger. No stagger between them — quotes are weighted, not rapid-fire.

**Asset:** Real testimonials with headshots needed. See Section 6.

---

### 4.8 NPOCTA
**Current:** Exists.

**Vision:**
- Return to dark background — the page closes where it opened
- Headline: large, direct — "Apply for the 2026 Cohort."
- Subtext: deadline, cohort size, what happens after applying — specifics create trust
- Two CTAs: "Apply Now" (primary, blue) + "Download Program Package" (secondary)
- Extreme negative space — large `py-40` minimum. The CTA section should feel like a landing, not a cramped footer.

**Animation:** Fade up on scroll trigger, `DURATION_SECTION`, `EASE_ENTER`. Single animation for the whole CTA block — not staggered. It's a resolution, not a reveal sequence.

---

## 5. Animation Choreography

### Global Rules
- All animations are scroll-triggered. Nothing auto-plays on load except the hero entrance.
- No ambient animation. No auto-rotating elements. No persistent loops.
- The only scrub-linked (continuous scroll-driven) animations are: the hero background transition and the timeline line draw.

### Hero (NPOHero)
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Content block | `opacity: 0, y: 20` | `opacity: 1, y: 0` | `DURATION_SECTION` (0.9s) | `EASE_ENTER` | Load, delay 0.2s |
| Background color | `#0F0F10` | `#FFFFFF` | — | Scrub (1) | Scroll, start: top, end: +=80% |
| Text color | `rgb(241,255,255)` | `rgb(15,15,16)` | — | Scrub (1) | Same trigger |
| Content opacity | 1 | 0 | — | Scrub (1) | Pin trigger: 0→100% of pin |
| Globe element | `opacity: 0.15` | `opacity: 0` | — | Scrub (1) | Same as bg, synchronized |
| Scroll hint | `opacity: 1` | `opacity: 0` | — | Scrub (2) | top → top+200px |

### NPOTimeline
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Section title | `opacity: 0, y: 20` | `opacity: 1, y: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 85%"` |
| Vertical line | `scaleY: 0` | `scaleY: 1` | — | `"none"` (scrub 1) | `"top 60%"` to `"bottom 40%"` |
| Timeline items | `opacity: 0, x: ±30` | `opacity: 1, x: 0` | `DURATION_SECTION` | `EASE_ENTER` | `"top 80%"`, delay `i * 0.08` |
| Artifacts | `opacity: 0, scale: 0.96` | `opacity: 1, scale: 1` | `DURATION_SECTION` | `EASE_ENTER` | Same trigger as paired text |

### DocumentaryEmbed
| Element | From | To | Duration | Easing | Trigger |
|---|---|---|---|---|---|
| Video embed | `opacity: 0, scale: 0.9` | `opacity: 1, scale: 1` | `DURATION_CINEMATIC` (1.8s) | `EASE_SMOOTH` | `"top 75%"` |

### All Other Sections (default reveal)
- `opacity: 0, y: 30 → opacity: 1, y: 0`
- `DURATION_SECTION` (0.9s), `EASE_ENTER`
- Scroll trigger: `"top 80%"`, `toggleActions: "play none none none"`
- Staggered groups: `STAGGER_NORMAL` (0.12s)

---

## 6. Assets Required

### Photography (Highest Priority)
- `npo-hero-globe-bg.png` — not needed if using GlobeVisualizer component
- `npo-about-students-1.jpg` — students working in a meeting/whiteboard session (candid, warm light)
- `npo-about-students-2.jpg` — student presenting to an NPO client (candid)
- `npo-about-product-demo.jpg` — laptop screen showing a deployed product in a real office (candid)
- `testimonial-headshot-1.jpg` — 80×80px, real testimonial author
- `testimonial-headshot-2.jpg` — 80×80px, real testimonial author

### Timeline Artifacts (Medium Priority)
- `artifact-application.png` — screenshot or mockup of the application/intake form
- `artifact-discovery.png` — whiteboard/affinity map photograph or screenshot
- `artifact-design.png` — wireframe or Figma frame screenshot
- `artifact-development.png` — code editor / GitHub PR screenshot
- `artifact-handoff.png` — deployed product screenshot in a browser mockup

### Documentary
- Real documentary embed URL (currently unknown — placeholder in component)
- Documentary metadata: title, year, runtime

### Copy
- 2 real testimonial quotes with author name, title, organization
- Cohort application deadline and cohort size
- Real impact statistics (currently placeholder in `sponsor/page.tsx`)

---

## 7. Existing Components to Reuse

| Component | Path | How to Use |
|---|---|---|
| `GlobeVisualizer` | `components/ui/GlobeVisualizer.tsx` | Hero background: simplified impact map. Render with reduced node count, no connection arcs, smaller viewport footprint. Wrap in low-opacity container (`opacity: 0.12–0.18`). |
| `ScrollRevealTimeline` | `components/sections/ScrollRevealTimeline.tsx` | Reference pattern for timeline line draw — NPOTimeline already implements this directly, use for comparison |
| `ImpactStats` | `components/sections/ImpactStats.tsx` | Reference the counter animation pattern; NPO Impact section should replicate the counter tween logic |
| `TextRevealSection` | `components/sections/TextRevealSection.tsx` | Consider for the NPOAbout statement text if character-level reveal is desired |
| `EASE_ENTER`, `EASE_SMOOTH`, `EASE_CINEMATIC` | `lib/motion.ts` | Use for all animations per the choreography table above |
| `DURATION_SECTION`, `DURATION_CINEMATIC` | `lib/motion.ts` | 0.9s for section reveals, 1.8s for documentary cinematic reveal |
| `STAGGER_NORMAL`, `STAGGER_SLOW` | `lib/motion.ts` | 0.12s for cards, 0.2s for photos |
| `ScrollIndicator` | `components/ui/ScrollIndicator.tsx` | Already used in NPOHero |

---

## 8. New Components to Build

### `NPOImpactGlobe` (medium complexity)
A simplified variant of `GlobeVisualizer` for the hero background.
- Props: `opacity: number`, `nodeCount: number`, `autoRotateSpeed: number`
- Display only: no hover interaction, no detail cards
- Show 8–12 nodes (representing past project cities) without arc connections
- Smaller canvas: 400×400px, positioned in upper-right of hero
- White globe, same hex-grid material as main globe
- Chapter nodes pulse subtly (existing pulse logic from GlobeVisualizer applies)
- Fade to 0 as hero background transitions to white (controlled by parent scroll trigger)
- Do not modify `GlobeVisualizer.tsx` directly — create a new simplified component

### `TimelineArtifact` (low complexity)
A wrapper for phase artifacts in NPOTimeline.
- Props: `src: string`, `alt: string`, `phase: string`
- A screenshot in a rounded border container, possibly with a small phase label badge
- Solid surface, no glass

### Updated `DocumentaryEmbed` (low complexity)
The existing component just needs styling:
- Aspect ratio enforcement
- Border radius, subtle border
- Section label + headline above
- Caption metadata below
- Scale-in animation on scroll

---

## 9. Priority Order

Build these in order for maximum trust impact:

1. **Timeline artifacts** — Transform the process section from text to evidence. This is the highest-leverage trust builder. The bones are there; add the visuals.
2. **DocumentaryEmbed styling** — The documentary is already embedded; it just needs to be presented properly. High impact, low effort.
3. **Testimonial section** — Once real quotes and headshots are available, this section can be built quickly and closes the loop on trust.
4. **NPOAbout photography** — Adds the human dimension. Needs photo assets first.
5. **NPOImpactGlobe** — Hero visual texture. Nice to have, not blocking trust signals. Build after content sections are solid.
6. **Impact stats verification** — Replace placeholder numbers with real data before any public launch.
