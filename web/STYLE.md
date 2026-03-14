# TETHOS — Aesthetic & Design Taste Guide

> **This document teaches judgment. `DESIGN_SYSTEM.md` teaches specification.**
> Any developer or AI reading this should be able to answer "would Tethos do this?" for any design choice — without asking the designer.
>
> **Last updated:** March 2026

---

## 1. The Aesthetic Identity — The North Star

**"Surgical precision with unexpected warmth — a dark, intelligent system that occasionally lets light in."**

Tethos is not a startup landing page. It's not a dark-mode portfolio. It's not a creative agency site. It occupies a specific and intentional space: a place where technical rigor and human craft coexist under pressure.

### The Three Creative Tensions

Every design decision lives inside one of these three tensions. When you feel lost, return here.

| Tension | Dark Side | Light Side | Why it matters |
|---------|-----------|------------|----------------|
| **Dark but not cold** | Deep `#0F0F10` backgrounds | Blue glow + yellow accent bring life | Pure dark = generic tech. The warmth is the differentiator. |
| **Technical but human** | IBM Plex Mono, ASCII art, dev naming | Genuine storytelling, candid photography, warm light sections | Pure technical = alienating. The human moments make the technical feel intentional, not defensive. |
| **Restrained but expressive** | Minimal decoration, flat surfaces | When motion appears, it's intentional and surprising | Pure restraint = forgettable. Pure expression = chaos. The rarity of expressive moments is what makes them land. |

These tensions explain why Tethos avoids common traps:
- All-dark with no warmth → cold and generic (see: every dark-mode SaaS template)
- All-expressive with constant animation → creative agency cliché with no signal-to-noise
- All-restrained with no motion → forgettable, indistinguishable from a brochure

---

## 2. The "These People Get It" Standard

The primary impression goal is not wow-factor. It's not credibility. It's this specific feeling: *"these people get it."* Taste and intelligence, not effort.

This distinction matters because effort and taste produce different outputs.

### Signals Taste ✓

- Typography decisions that look deliberate at first glance — you know someone made a choice, not took a default
- Spacing that feels generous but not wasteful — sections breathe without feeling empty
- Motion that appears where the eye naturally wants something to happen — not where a developer thought it would be cool
- Dark sections and light sections with a clear reason for each transition — you can feel the logic even if you can't articulate it
- Negative space that feels designed, not forgotten
- A single unexpected visual element per page that makes a designer pause

### Signals Effort But Not Taste ✗

- Gradient backgrounds added for the sake of color — Tethos uses flat dark with targeted glow, not gradients as wallpaper
- Animations on every element — motion budget is finite; spending it everywhere devalues it everywhere
- Cards that look like Tailwind UI examples — generic rounding, generic shadow, generic padding
- IBM Plex Mono used decoratively everywhere — when you overuse the hacker aesthetic, it stops being a signature and becomes a crutch
- Blue glow as a fill tool — glow is a highlight, not a color palette. It should mark what matters, not everything.
- Section padding so tight it looks anxious — if it looks cramped, it is cramped

### The Calibration Test

Before shipping any section, ask: *"If I showed this to the designer who made lusion.co or linear.app, would they see a decision or a default?"* If you can't answer confidently, there's probably a default hiding somewhere.

---

## 3. Visual Cohesion Rules — The DNA

What must be consistent for a page to feel like Tethos rather than a collection of sections.

### Per-Page Requirements

- **Dark background (`#0F0F10`) as the baseline** — light is the exception, not the default. Every page starts dark.
- **Exactly one primary accent active per section** — blue glow OR yellow highlight. Never both competing in the same section.
- **Every section has a clear typographic anchor** — one dominant text element sets the visual gravity. If you can't identify it instantly, the section lacks hierarchy.
- **Minimum one intentional moment of negative space per section** — designed emptiness, not forgotten padding.

### Page-to-Page Transition Rules

- Each page starts with a dark hero — even pages with light sections. The hero anchors the brand before context-switching.
- The navbar theme auto-switch is the connective tissue between sections — don't fight it with conflicting background colors near section boundaries.
- Section endings should feel resolved, not cut off. Use a fade, a subtle divider, or deliberate termination (a strong final line, a CTA). Avoid sections that just stop.
- When transitioning from dark to light: the transition should feel intentional — use a gradient edge, a full-bleed image, or a deliberate break. Not a hard cut.

### Coherence Checklist

Before a page ships, verify:
- [ ] Does the accent color usage feel consistent and singular per section?
- [ ] Can you identify the typographic anchor in every section without effort?
- [ ] Does the page feel like it has the same author throughout?
- [ ] Is there negative space in every section, not just between sections?

---

## 4. Motion Philosophy — The Intent Behind Every Animation

This is the most consequential section. Motion is where Tethos currently diverges from its potential. The gap between "motion that feels off" and "motion that feels considered" is almost always intent.

### The Core Rule

**Motion earns its place by serving exactly one of three purposes:**

1. **Narrative** — it tells a story, creates arc, reveals meaning over time
   - *Examples:* `TextRevealSection` scroll-pinning, `HomeHero` parallax depth
   - *Characteristic:* scroll-driven, cinematic duration, irreversible (you can't un-see it)

2. **Response** — it acknowledges a user action, confirming the interface is alive
   - *Examples:* button hover state, card tilt on cursor proximity, link underline
   - *Characteristic:* triggered, brief, snappy, invisible until activated

3. **Guidance** — it directs attention to where the user should look or go next
   - *Examples:* scroll indicator pulse, staggered section reveals, focus ring animation
   - *Characteristic:* subtle, purposeful, one direction at a time

**If an animation doesn't serve one of these three purposes, remove it.**

This is not a suggestion. Ambient motion that doesn't respond to scroll or interaction is visual noise. It signals that animation was added because it could be, not because it should be.

### The Motion Budget

| Type | Allocation | Rationale |
|------|-----------|-----------|
| **Narrative** | One per page | Cinematic moments are singular — more than one dilutes all of them |
| **Response** | Unlimited | They're invisible until triggered; no budget needed |
| **Guidance** | 1–2 per section | Direction can only point one way at a time |
| **Ambient** | Zero | No auto-playing animations that don't respond to scroll or interaction |

### Motion Intensity by Audience

| Audience | Intensity | Why |
|----------|-----------|-----|
| **Students** | High — full cinematic suite | They're the core community; they came to be impressed |
| **NPOs** | Medium — purposeful reveals | They need trust more than wonder; motion should feel confident, not showy |
| **Companies** | Low — confident, mostly still | Stillness signals confidence. Kinetic pages feel nervous. |
| **Sponsors** | Minimal — professional gravity | Premium = restraint. Every animation has to earn its right to exist. |

### Motion Specification

- **Duration:** Entrance animations: 0.6–0.9s. Micro-interactions: 0.15–0.25s. Scroll-driven: as long as the section demands.
- **Easing:** `ease-out` for entrances (fast start, slow settle). `ease-in-out` for transitions. Never `linear` for UI motion.
- **Spring physics:** High damping, minimal bounce. Jiggle is not on-brand. If it wiggles, the damping is too low.
- **Stagger:** Always stagger adjacent elements. Simultaneous reveals read as a glitch, not a design choice. 0.08–0.12s between items.

### Anti-Patterns in Motion

| Anti-pattern | Why it fails | What to do instead |
|---|---|---|
| Parallax for its own sake | Creates depth without narrative meaning | Only use parallax when it serves the scroll story |
| Auto-playing on load without scroll trigger | User didn't ask for it; it interrupts rather than invites | Make it scroll-triggered or interaction-triggered |
| Spring bounce / jiggle | Feels playful when Tethos should feel intelligent | High-damping springs only; test on the actual component |
| Simultaneous reveals on adjacent elements | Reads as glitch, not choreography | Always stagger (0.08–0.12s between items) |
| Fade-in on every section | When everything fades in, nothing feels revealed | Reserve fade-in for content that benefits from dramatic entrance |
| Motion on error/empty states | Animating failure feels disrespectful | Static, clear, calm |

### When Stillness IS the Statement

- **Company page:** Sections should feel solid and grounded. A still section reads as confident, not unfinished.
- **Forms:** No animation except focus states. Motion in forms creates anxiety.
- **Error states:** Never animate these. Stillness is clarity.
- **Data/stats sections:** Counters can animate in once; after that, still. Numbers that keep animating feel unreliable.

---

## 5. Design Decision Frameworks

When you're choosing between two approaches and there's no obvious answer, these rules decide.

### Typography Choices

**Between two font sizes:** Choose the larger one if it's a heading, the smaller one if you're tempted to add emphasis elsewhere to compensate.

**Weight:** Only two weights for UI text — regular and bold/semibold. No medium. No light for body text. Medium weights are a compromise that satisfies no one.

**When to use IBM Plex Mono:**
- ✓ Timestamps and dates
- ✓ Statistics and metrics (the number itself, not the label)
- ✓ ASCII art and code elements
- ✓ Dev-inspired labels (section counters like `01 /`, `Init`, `Nodes`)
- ✗ Never for decoration alone — using monospace without semantic reason is a cliché

**Letter spacing:**
- Display headings: `-0.02em` (tight, intentional)
- Body text: normal (0)
- Uppercase labels: `0.08–0.12em` (wide tracking, capitals need air)
- Never apply wide tracking to mixed-case text

### Color Choices

**Between blue and yellow:**
- Blue (`#002FA7` — International Klein Blue): trust, capability, depth, focus
- Yellow: celebration, achievement, warmth, urgency
- Never use both in the same component. They're for different emotional registers.

**Opacity on glows:**
- Border glows: max `0.4` opacity
- Background glows: max `0.15` opacity
- Above these thresholds → aggressive, overwhelming. Below → present but not demanding.

**When to use a light section:**
- Only for moments that need human warmth and contrast: testimonials, long-form editorial text, form sections
- Light sections should feel like a breath, not a palette reset

**Gradient rules:**
- Never use gradient as a section background
- Gradients are for: glow effects, image overlays, edge fades on scroll containers, text gradients (sparingly)
- Flat dark (`#0F0F10`) + targeted light/glow > any gradient background

**Blue:** Always `#002FA7` (International Klein Blue). This specific blue is intentional — it has a name, a history, and a character. Generic blue (`#0066FF`, `#3B82F6`, `#0000FF`) is not Tethos blue.

### Spacing Choices

**If it looks tight, it is tight.** Add space. When in doubt, the problem is not enough space.

**Section padding minimum:** `py-24` (96px). Below this, sections feel cramped at an Awwwards standard. For hero sections, `py-32` or more.

**Card internal padding:** `p-8` minimum, `p-10` preferred for the premium register.

**Negative space:** Intentional empty areas inside sections are a design choice, not waste. A section that's 60% content and 40% breathing room is often better than one that's 90% content.

### Component Choices

**Card vs. section block:**
- Cards → items within a set (team members, project cases, service tiers)
- Section blocks → standalone content (a single statement, a form, a cinematic moment)

**Glass vs. solid surface:**
- Glass → interactive elements, overlays, floating elements, navigation
- Solid → grounded content sections, anything that needs to feel stable and heavy
- Glass on light background: never. Glass only works against dark.

**Border radius:**
- Max `24px` for content cards. Above this feels toy-like.
- UI primitives (buttons, inputs): `8–12px`
- 3D-adjacent or featured elements can go lower (more angular = more technical)

**CTA hierarchy:** Primary/secondary hierarchy must always be clear. Two CTAs with equal visual weight is not neutrality — it's paralysis for the user.

### What Would Push Tethos to Awwwards Caliber

- **One unexpected visual element per page** that makes a designer stop and look — the fanned card arc is an example of this done right. It shouldn't be predictable.
- **Typography that doesn't behave how you'd expect** — character-by-character scroll reveals, ASCII scrambles, text that tracks cursor position
- **An interaction that rewards curiosity** — the globe showing project nodes on hover, a stat that expands when clicked, easter eggs for the technical eye
- **Transitions between pages or sections that feel choreographed**, not just faded

---

## 6. Anti-Pattern Catalogue

Explicit list of things that feel off-brand, with the reason why. If you're about to implement one of these, stop and reconsider.

| Anti-pattern | Why it's wrong | Right alternative |
|---|---|---|
| **Gradient backgrounds** | Generic; every template uses them | Flat `#0F0F10` + targeted glow |
| **Too many animated elements on load** | Signals over-engineering; motion should feel earned | Scroll-triggered reveals, one narrative motion per page |
| **Decorative borders/dividers everywhere** | Clutters the negative space that makes sections breathe | Use spacing to separate sections; add dividers only when deliberate |
| **Zinc/gray tones for accent** | Tethos accents are blue or yellow — neutral accents have no character | Use `#002FA7` or the yellow; gray is for text and surfaces only |
| **3D effects on text** | 3D is reserved for actual 3D objects (pylon, globe) | Typography is flat; add motion through position/opacity, not depth |
| **Blue glow on text** | Glow is for surfaces and borders, not readable content | Glow behind/around containers; text color alone for text |
| **Full-saturation generic blue** | Off-brand; loses the intentionality of IKB | Always `#002FA7` (International Klein Blue) |
| **Alternative sans-serif fonts** | Font mixing breaks the technical/refined voice | Only Test Söhne + IBM Plex Mono; no Google Fonts alternates for headings |
| **Border radius above 24px on content cards** | Feels toy-like, friendly-SaaS, not craft-forward | Max `24px` on cards; prefer `16px` for most contexts |
| **Multiple CTAs with equal visual weight** | User paralysis; hierarchy is absent | Primary action is always visually dominant; secondary is clearly subordinate |
| **Spring bounce / jiggle** | Playful energy doesn't match Tethos's intelligence register | High-damping springs; test the actual bounce before shipping |
| **IBM Plex Mono for decorative headlines** | Overusing the hacker aesthetic makes it meaningless | Mono for semantic uses (timestamps, stats, code) only |
| **Glass morphism on light backgrounds** | Glass backdrop-blur requires dark background to read | Glass is dark-background only |
| **Animations on forms** | Creates anxiety during user input | Static form fields; animate only focus rings |

---

## 7. Audience Aesthetic Adaptation

The Tethos DNA is constant. How it expresses by audience adjusts the intensity, not the identity.

| Element | Students | NPOs | Companies | Sponsors |
|---------|----------|------|-----------|---------|
| **Hero motion** | Cinematic + scroll-pinned | Purposeful + fade-in | Confident entry, minimal | Static or barely-there |
| **Accent use** | Blue glow + yellow highlights | Blue only | Blue only | Neutral surfaces + blue accent |
| **Copy tone** | Exciting, insider, peer-to-peer | Warm, trustworthy, outcome-focused | Direct, authoritative, no fluff | Premium, exclusive, ROI-aware |
| **Card style** | Full glass, 3D tilt | Glass, no tilt | Solid surface, subtle border | Minimal, text-heavy, no glass |
| **ASCII elements** | Yes — signature moments | Subtle or none | None | None |
| **Negative space** | Generous | Generous | Very generous (stillness = confidence) | Extreme (premium = emptiness) |
| **Section pacing** | Fast-moving, high density of moments | Measured, breathing | Deliberate, each section lands | Slow, weighted, each word earns space |

**The key insight:** Students need to feel the energy. Companies need to feel the competence. These require opposite motion intensities while using the same design system.

---

## 8. Taste References & Calibration

Sites that represent the right direction for specific elements. Use these to calibrate, not to copy.

### Linear.app
**Extract:** Type hierarchy, spacing confidence, and dark mode done right.
- Watch how section headers feel authoritative with minimal decoration
- Note the density of information that still feels spacious — it's the consistent internal padding
- Their use of subtle borders as separators (not dividers) is exactly right for Tethos's section rhythm

### Lusion.co
**Extract:** Creative agency motion at the Awwwards level.
- Every animation has narrative intent — nothing auto-plays without purpose
- The scroll choreography feels authored, like a director made choices
- Note how stillness in their sections makes the motion moments hit harder

### Stripe.com
**Extract:** Section transitions and light/dark balance.
- Watch how they move from dark hero to light content sections — the transitions feel logical
- Their card surfaces (solid, not glass) read as trustworthy — relevant for company/sponsor pages
- Typography scale confidence: they commit to large headings without apology

### Vercel.com
**Extract:** How to feel technical without feeling cold.
- ASCII-adjacent aesthetics (monospace, grid structures) that stay readable
- The balance between showcasing capability and feeling approachable
- Note how their dark backgrounds still have warmth through careful highlight usage

### The Calibration Question

When you're unsure if something is right, ask: *"Would this feel at home on one of these four sites?"*

If yes and it serves the Tethos tensions (dark but not cold, technical but human, restrained but expressive) → ship it.

If it would fit on a generic dark-mode template but not on these specific references → it probably needs rework.

---

## 9. Cross-Pathway Consistency — The Shared Frame

Each audience pathway (Students, NPOs, Companies, Sponsors) has a distinct tone and motion intensity, but they all live inside the same visual frame. Consistency in structural elements is what makes the site feel like one product rather than four separate sites.

### The Immovable Elements

These elements must be visually identical across every pathway — same dimensions, same positioning, same behavior:

| Element | Spec | Why it's immovable |
|---|---|---|
| **GlassNavbar pill** | 593×48px, `border-radius: 15px`, glass morphism | It's the brand's single most repeated element — any variation breaks the frame |
| **Navbar theme switching** | `data-navbar-theme="dark"/"light"` drives text color — always automatic | Manual overrides create inconsistency at section boundaries |
| **Footer structure** | 4-column grid (brand, pathways, resources, connect), static, no animations | The footer is a resolution — every page ends the same way |
| **Logo position** | Top-left inside the navbar pill, consistent padding | |
| **CTA button** | Right side of navbar, always inverse of current navbar theme | |

### Pathway-Specific Navbars (CompanyNavbar, NPONavbar)

Some pathways use a secondary, page-internal nav (currently Company and NPO) instead of the global `GlassNavbar`. These must follow a strict template:

- **Fixed header, 96px tall**
- **Dark background (`#0F0F10` at 80% opacity) + backdrop blur** — same dark anchoring as the global navbar
- **Left:** Tethos logo
- **Center:** scroll-to-section buttons (small `text-xs`, muted by default, brightens on hover)
- **Right:** pathway label in muted text
- **No dropdowns** — these navbars are for same-page navigation only
- **Scroll behavior:** `behavior: "auto"` (not smooth) to avoid breaking GSAP ScrollTrigger. Do not change this.

When adding a new pathway that needs an internal nav, copy this template exactly — don't invent a new navbar shape.

### Page Structure Template

Every pathway page must open and close the same way, regardless of what's in the middle:

```
[GlassNavbar or pathway navbar]
[Dark hero section — establishes brand before any context-switching]
  ... pathway-specific sections ...
[Footer — always the same Footer component, no pathway variants]
```

The hero must be dark even if the page has light sections. The footer must be the shared `Footer` component — no pathway-specific footers.

### Section Boundary Rules

When building new sections for any pathway, these rules apply universally:

- **Section endings feel resolved** — don't let a section just stop. Use a fade edge, a CTA, a divider, or a strong terminal line.
- **Background transitions are intentional** — dark-to-light requires a visual signal (gradient edge, full-bleed break). Hard cuts between dark and light sections are a mistake.
- **`data-navbar-theme`** must be set correctly on every section that crosses a background threshold. This is how the navbar knows to flip its text color. Missing this breaks the connective tissue.
- **Consistent top/bottom section padding** — `py-24` minimum everywhere. Don't mix section paddings within a page (e.g., `py-16` on one section and `py-32` on the next creates uneven rhythm).

### Typography Anchors Across Pathways

Every section on every page has one dominant text element. While the content differs by pathway, the typographic behavior is consistent:

- Display heading: Test Söhne, same weight and letter-spacing conventions (`-0.02em`)
- Section labels/counters: IBM Plex Mono, `text-xs`, uppercase, wide tracking — same across all pathways
- Body text: Space Grotesk, same sizing and line-height
- The *tone* of the copy changes; the *typographic system* does not

---

## 10. Sacred Components — Refine, Don't Rebuild

These components are working. They represent the design at its best. Any changes should be small, targeted, and backward-compatible. Do not propose a rebuild. Do not "clean them up." Read this section before touching any of them.

---

### GlobeVisualizer — The Centerpiece

**File:** `web/components/ui/GlobeVisualizer.tsx`

**What makes it right:**
- White globe with hex-grid country polygons and elevation-based altitude — looks like a technical instrument, not a game
- Animated dashed arcs (yellow-green `#9cff00`) connecting chapters to partners — the arcs tell the story of a network
- Chapter nodes pulse continuously (scale `1 + sin(t*2.5) * 0.15`) — alive without being distracting
- Hover reveals a detail card with project metadata — rewards curiosity, doesn't demand attention
- Auto-rotates at 0.6 speed, pauses when a node is hovered — responsive to the user without being jumpy
- White globe material with emissive blue tint (`#d4e0ff`) — subtle glow that ties it to the brand palette

**Safe edits:**
- Node colors and sizes (chapter blue, partner gray)
- Glow intensity on chapter nodes
- Arc color and dash pattern
- Hover card content and layout
- Auto-rotate speed
- Lighting intensity

**Do not touch:**
- `latLngToVector3` and arc altitude calculations (spherical math — fragile)
- The hex polygon geometry setup
- The buffer read logic that drives pixel-to-ASCII (in AsciiGlobe)
- The SSR guard (`useState` + `useEffect` wrapper) — the 3D context needs client-side initialization

**The AsciiGlobe** (`web/components/ui/AsciiGlobe.tsx`) is a separate, lighter component — a Three.js canvas that renders the Earth as ASCII characters using pixel brightness mapping. It's used in the HomeHero. Same rule applies: adjust charset, rotation speed, font sizing, colors. Don't touch the buffer read logic.

---

### HomeHero — The Opening Statement

**File:** `web/components/sections/HomeHero.tsx`

**What makes it right:**
- A 6-step scroll-driven narrative: heading fades down → globe pins → text reveals sequentially → scroll indicator fades
- The heading is `position: fixed`, floating above the layout — it lands before the user even begins scrolling
- The globe pins at center for 100% of viewport height, allowing the two text overlays to reveal during the pin
- Top-left text and bottom-right text reveal at different scroll positions (0 and 0.5 of the pin) — creates a conversation, not a dump
- The rotate prompt hides after first pointer interaction — attentive to the user, not persistent

**Safe edits:**
- Text content in the heading, top-left overlay, bottom-right overlay
- Positional offsets (`top: 8%`, `left: 4vw`, etc.)
- Animation timings and opacity curves
- Scroll indicator appearance and fade behavior

**Do not touch:**
- The pin setup (`pin: true`, `anticipatePin: 1`, `scrub: true`) — this is the architecture of the scroll narrative. Changing it means re-choreographing the whole section.
- The `clipPath: inset(-100% 0 0 0)` on the globe container — this clamps top overflow and is load-bearing
- The 65vh spacer before the globe — it controls when the pin begins. Removing it breaks the entry.

**The heading is `position: fixed`, not `sticky` or `absolute`.** This is intentional — it makes the heading feel like it exists above the page, not in it. Don't convert it to a layout element.

---

### PathwayCards — The Fanned Hand

**File:** `web/components/sections/PathwayCards.tsx`

**What makes it right:**
- Four cards arranged in a circular arc (not a row, not a grid) — immediately unexpected
- Each card breathes at idle: 2% scale pulse with random delay — alive, not static
- On hover: card lifts 20px, rotation smooths to 90% of its arc angle, 3D tilt tracks the mouse
- A shine overlay (radial gradient) follows mouse position on hover — luxury feel
- Blue glow behind the hovered card (`rgba(0,47,167,0.4)`) — the brand blue doing its job
- Click feedback: scale down → bounce → settle — confirms the interaction without being flashy
- GSAP scroll trigger reveals the title first, then cards stagger in — the choreography is visible

**What needs work (small edits, not rebuild):**
- The arc geometry constants (`BEND`, `CARD_SPACING`, `VERTICAL_OFFSET`) may need tuning for different viewport sizes
- Card content (title, subtitle, href) lives in the `cards` array at the top of the file — straightforward to update
- The hover tilt angles (±15°) and hover scale (1.08) can be adjusted for feel

**Safe edits:**
- `BEND`, `CARD_SPACING`, `VERTICAL_OFFSET` constants (arc shape)
- Card dimensions (350×490px)
- Hover scale, lift distance, tilt range
- Breathing speed and magnitude (3.5s duration, 2% scale)
- Glow color and opacity
- Card text content and routes
- Stagger timing on scroll reveal

**Do not touch:**
- The circular arc math (radius calculated from sagitta, then vertical/rotation per card) — this is the geometry of the fanned hand. Changing it without understanding the math produces broken layouts.
- The Framer Motion + GSAP coexistence — they handle different layers (component physics vs. scroll reveal). Don't consolidate them.
- The `__FORCE_REVEAL__` scroll behavior in the navbar — it's connected to how these cards interact with the page scroll position

**The fanned card arc is the one element on the home page most likely to appear on Awwwards.** It is deliberately unexpected. Don't flatten it into a carousel or a grid because it's simpler. The complexity is the point.

---

| `DESIGN_SYSTEM.md` answers | `STYLE.md` answers |
|---|---|
| What is the color token for the background? | When should I use a light section vs. dark? |
| What are the animation presets? | Which animation type belongs here? |
| What components exist? | Which component is right for this content? |
| What are the font definitions? | When is IBM Plex Mono appropriate here? |
| What are the spacing tokens? | Is this section breathing enough? |

Read `DESIGN_SYSTEM.md` to know what's available. Read `STYLE.md` to know what to choose.
