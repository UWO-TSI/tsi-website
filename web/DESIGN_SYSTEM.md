# TETHOS — Design System & Implementation Guide

> **The single source of truth for all visual, interaction, and content decisions across tethos.ca.**
> Any AI coding agent (Claude Code, Cursor, Copilot) should be able to implement any page faithfully using only this file + the codebase.
>
> **Last updated:** March 2026
> **Repository:** github.com/UWO-TSI/tsi-website (`/web` for all frontend code)
> **Deployment:** Vercel, auto-deploys on push to `main`

---

## 1. Brand Identity

### 1.1 What Tethos Is

Tethos (TSI) is a student-run tech collective at Western University that builds production-grade software for nonprofits, offers scoped project services to companies, partners with sponsors to fund social impact, and enables students to start chapters. The website is the organization's public face, with dedicated pages for four distinct audiences.

**Tagline:** "Technology That Moves People Forward"

### 1.2 Brand Personality

```
Professional    → Clean layouts, restrained color, sharp typography
Purpose-driven  → Bold declarative headlines, impact metrics, real outcomes
Technical       → ASCII art motif, monospace accents, dev-inspired naming (Init, Nodes, Logs)
Human           → Candid team photography, warm light sections, conversational subtext
Ambitious       → 3D globe hero, cinematic scroll, global framing
```

### 1.3 Voice & Tone

Headlines are bold, declarative, and short. Body copy is clear, confident, and warm — it speaks like a smart peer, not a brochure. Tone shifts by audience:

```
Nonprofits  → Reassuring, outcome-focused. "We ship what we promise."
Companies   → Direct, capability-focused. "Scoped. Delivered. Done."
Sponsors    → Polished, ROI-aware. "Fund tech that compounds."
Students    → Energetic, inviting, creative. "Start building. Start here."
```

### 1.4 Design Differentiator — ASCII Art

ASCII art is Tethos's signature visual identity, bridging code with illustration. A custom image-to-ASCII generator app exists for creating these assets.

**Where ASCII art appears:**
- Genesis event poster and materials (primary visual)
- `<LoadingScreen>` — ASCII character dissolve animation on page load
- `<AsciiReveal>` — typewriter scramble effect on text elements
- `<AsciiDivider>` — decorative section separators
- `<AsciiDitherShader>` — shader-based dithering on 3D/image elements
- Project card hover reveals (image → ASCII dissolve transition)
- Background textures at very low opacity (~0.05) for section depth

**Where ASCII art does NOT appear:**
- Never replaces critical UI (buttons, nav, form labels)
- Never makes text unreadable — ASCII textures stay in the background layer
- Never overused — one ASCII element per viewport maximum

---

## 2. Tech Stack

```
Category          Technology
─────────────────────────────────────────────────────────
Framework         Next.js 16 (App Router), React 19, TypeScript 5
Styling           Tailwind CSS 4, CSS custom properties (tokens.css)
Animation         GSAP 3 + ScrollTrigger (scroll-driven)
                  Framer Motion 12 (component enter/exit)
3D Graphics       Three.js, React Three Fiber, Drei, three-globe
Smooth Scrolling  Lenis (GSAP-integrated)
Icons             Lucide React, Heroicons
Fonts             Test Söhne (primary), IBM Plex Mono (monospace)
```

---

## 3. Color System

All colors are defined as CSS custom properties in `web/styles/tokens.css`.

### 3.1 Core Backgrounds & Surfaces

```css
--color-bg-main:      #0f0f10    /* Page background — the default */
--color-bg-alt:       #111113    /* Alternating sections, card surfaces */
--color-bg-navy:      #0d1b2a    /* Accent sections, deep overlays */
--color-surface:      #111827    /* Card/panel backgrounds */
--color-surface-soft: #18181b    /* Subtle elevated surfaces */
```

### 3.2 Brand Colors

```css
--color-brand-blue:   #002fa7    /* ★ Signature accent — "the glow" */
--color-brand-yellow: #ffd166    /* Warm accent, highlights, badges */
--color-brand-light:  #f1ffff    /* Light mode background, warm sections */
```

### 3.3 Accent Colors

```css
--color-accent-cyan:  #22d3ee    /* Data visualization, student page energy */
```

> **Removed:** `--color-accent-purple: #a855f7` — experimental, no longer part of the system.

### 3.4 Text Hierarchy

```css
--color-text-main:    #f1ffff    /* Primary text on dark */
--color-text-soft:    #e5e7eb    /* Secondary text, body paragraphs */
--color-text-muted:   #9ca3af    /* Tertiary text, captions */
--color-text-subtle:  #6b7280    /* Lowest-priority text, timestamps */
```

On light (`#F1FFFF`) backgrounds, invert:
```
Primary text:    #0f0f10
Secondary text:  #27272a
Muted text:      #3f3f46
```

### 3.5 Gray Scale

```css
--gray-50:  #f9fafb    --gray-400: #a1a1aa    --gray-800: #27272a
--gray-100: #f4f4f5    --gray-500: #71717a    --gray-900: #18181b
--gray-200: #e4e4e7    --gray-600: #52525b
--gray-300: #d4d4d8    --gray-700: #3f3f46
```

### 3.6 Semantic Colors

```css
--color-success: #22c55e    /* Positive states, impact metrics */
--color-warning: #facc15    /* Pending states, caution */
--color-error:   #ef4444    /* Error states, destructive actions */
```

### 3.7 Glass & Overlay Tokens

```css
--glass-bg-hero:       rgba(15, 15, 16, 0.55)
--glass-bg-pill:       rgba(15, 15, 16, 0.78)
--glass-border-soft:   rgba(241, 255, 255, 0.12)
--glass-border-strong: rgba(255, 255, 255, 0.18)
```

### 3.8 Glow Tokens

```css
--glow-blue: rgba(0, 47, 167, 0.5)
--glow-cyan: rgba(34, 211, 238, 0.5)
--glow-gold: rgba(255, 209, 102, 0.25)
```

### 3.9 The Blue Glow — Signature Effect

`#002FA7` is Tethos's visual signature, inspired by Dia browser's ambient glow language. It should feel like light emanating from within the interface.

**Ambient applications (backgrounds, borders, card edges):**
```css
/* Ambient border on dark cards */
border: 1px solid rgba(0, 47, 167, 0.15);
/* Intensifies on hover */
border-color: rgba(0, 47, 167, 0.4);

/* Background radial for hero/key sections */
background: radial-gradient(ellipse at center, rgba(0, 47, 167, 0.08) 0%, transparent 70%);
```

**Interactive applications (buttons, links, hover states):**
```css
/* Button hover glow */
box-shadow: 0 0 20px rgba(0, 47, 167, 0.4);

/* Focus ring (accessibility) */
outline: 2px solid #002fa7;
outline-offset: 2px;
```

**Utility classes to implement:**
```css
.glow-blue        { box-shadow: 0 0 20px var(--glow-blue); }
.glow-blue-sm     { box-shadow: 0 0 10px rgba(0, 47, 167, 0.25); }
.glow-blue-lg     { box-shadow: 0 0 40px rgba(0, 47, 167, 0.3); }
.border-glow      { border: 1px solid rgba(0, 47, 167, 0.15); }
.border-glow-hover:hover { border-color: rgba(0, 47, 167, 0.4); }
.bg-glow          { background: radial-gradient(ellipse at center, rgba(0, 47, 167, 0.08) 0%, transparent 70%); }
```

**Constraints:**
- Blue glow is a **dark-mode-only** effect. On light backgrounds, use `#002FA7` flat (no glow/shadow).
- Never apply glow to readable body text.
- Never stack multiple glow effects in the same viewport.
- `#002FA7` on dark meets AA contrast only for large text (18px+). For small blue text on dark, use a lighter variant like `#4A7AFF`.

---

## 4. Typography

### 4.1 Font Stack

```
Primary:   "Test Söhne" (loaded via @font-face in globals.css as "Test Sogne")
           Weights: 400 (Buch), 700 (Kräftig)
           Files: /font/sohne-font-family/TestSohne-*.otf

Monospace: "IBM Plex Mono" (loaded via --font-highlight in globals.css)
           Fallbacks: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas
```

> **Removed:** Milker (decorative, no longer needed), Space Grotesk (was a fallback, now unnecessary).
> **Action:** Remove the Milker `@font-face` declaration from `globals.css` and delete `/font/milker/`.

**CSS variable mapping:**
```css
/* globals.css */
font-family: "Test Sogne", var(--font-body);     /* body default */
--font-highlight: "IBM Plex Mono", ui-monospace, ...; /* mono */
```

**Usage rules:**
- Test Söhne for ALL UI: headings, body, buttons, nav, labels
- IBM Plex Mono for TECHNICAL elements only: stat counters, code blocks, ASCII art, inline code, timestamps, the footer tagline "Built by students, designed with taste."

### 4.2 Type Scale

Defined in `tokens.css`. All sizes use rem with 16px base.

```css
--font-size-hero:    4rem      /* 64px — homepage hero headline */
--font-size-h1:      3rem      /* 48px — subpage hero headlines */
--font-size-h2:      2.25rem   /* 36px — section titles */
--font-size-h3:      1.875rem  /* 30px — card titles, major labels */
--font-size-h4:      1.5rem    /* 24px — subsection heads */
--font-size-body-lg: 1.125rem  /* 18px — lead paragraphs, intro text */
--font-size-body:    1rem      /* 16px — default body text */
--font-size-body-sm: 0.875rem  /* 14px — captions, metadata */
--font-size-label:   0.75rem   /* 12px — timestamps, fine print */
```

### 4.3 Line Heights

```css
--lh-tight:   1.1    /* Headlines, display text */
--lh-snug:    1.25   /* Subheadings, card titles */
--lh-normal:  1.5    /* Body text default */
--lh-relaxed: 1.6    /* Long-form reading */
```

### 4.4 Typography Rules

- Headlines at `--font-size-hero` use `-0.02em` letter-spacing
- Monospace uses `0.02em` letter-spacing for readability
- Responsive scaling via `clamp()`:
  ```css
  .display-hero { font-size: clamp(2.5rem, 5vw, 4rem); }
  .display-h1   { font-size: clamp(2rem, 4vw, 3rem); }
  ```
- Italic Test Söhne: used sparingly for emphasis or the "overflow" colored text effect (see TextRevealSection)

---

## 5. Spacing & Layout

### 5.1 Spacing Scale

Defined in `tokens.css`. Based on a 4px unit.

```css
--space-1:   0.25rem   /*  4px */
--space-2:   0.5rem    /*  8px */
--space-3:   0.75rem   /* 12px */
--space-4:   1rem      /* 16px */
--space-6:   1.5rem    /* 24px */
--space-8:   2rem      /* 32px */
--space-12:  3rem      /* 48px */
--space-16:  4rem      /* 64px */
--space-24:  6rem      /* 96px */
```

### 5.2 Border Radii

```css
--radius-sm:   0.5rem    /*  8px — buttons, small cards */
--radius-md:   1rem      /* 16px — standard cards */
--radius-lg:   1.5rem    /* 24px — large cards, sections */
--radius-xl:   2rem      /* 32px — hero elements */
--radius-pill: 9999px    /* pill buttons, nav bar */
```

> **Note:** Glass cards use `border-radius: 22px` (between md and lg). This is the glassmorphism-specific radius.

### 5.3 Shadows

```css
--shadow-soft:   0 12px 30px rgba(0, 0, 0, 0.35)
--shadow-strong: 0 18px 45px rgba(0, 0, 0, 0.6)
--shadow-glass:  0 18px 45px rgba(0, 0, 0, 0.18),
                 inset 0 1px 0 rgba(255, 255, 255, 0.6),
                 inset 0 -1px 0 rgba(0, 0, 0, 0.18),
                 inset 0 0 30px rgba(255, 255, 255, 0.06)
```

### 5.4 Grid System

```
Max content width:  1280px
Columns:            12-column grid
Gutter:             24px (desktop), 16px (mobile)
Page padding:       64px sides (desktop), 24px (tablet), 16px (mobile)
```

### 5.5 Breakpoints (Tailwind defaults)

```
sm:   640px     Mobile landscape
md:   768px     Tablet portrait
lg:   1024px    Tablet landscape / small desktop
xl:   1280px    Standard desktop
2xl:  1536px    Large desktop
```

---

## 6. Motion System

All animation presets are defined in `web/lib/motion.ts`. The site uses a dual animation engine: GSAP + ScrollTrigger for scroll-driven cinematics, Framer Motion for component enter/exit.

### 6.1 GSAP Easing Presets

```typescript
EASE_CINEMATIC = "power3.inOut"   // Primary — most transitions
EASE_SMOOTH    = "power2.out"     // Subtle reveals
EASE_ENTER     = "power3.out"     // Elements appearing
EASE_EXIT      = "power2.inOut"   // Elements disappearing
EASE_LINEAR    = "none"           // Scrub-linked scroll animations
```

### 6.2 Duration Presets (seconds)

```typescript
DURATION_MICRO     = 0.2    // Hover, tap feedback
DURATION_NORMAL    = 0.6    // Standard element transitions
DURATION_SECTION   = 0.9    // Section-level scroll reveals
DURATION_PAGE      = 1.2    // Loading, route changes
DURATION_CINEMATIC = 1.8    // Slow cinematic reveals
```

### 6.3 Framer Motion Spring Presets

```typescript
SPRING_SMOOTH     = { stiffness: 120, damping: 20, mass: 0.8 }   // No bounce, cinematic
SPRING_RESPONSIVE = { stiffness: 300, damping: 30, mass: 0.5 }   // Quick, subtle settle
SPRING_HEAVY      = { stiffness: 80,  damping: 25, mass: 1.2 }   // Large elements, slow
```

### 6.4 Framer Motion Transition Presets

```typescript
TRANSITION_FADE      = { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }     // Smooth
TRANSITION_REVEAL    = { duration: 0.9, ease: [0.16, 1, 0.3, 1] }         // Expo out
TRANSITION_CINEMATIC = { duration: 1.8, ease: [0.76, 0, 0.24, 1] }        // Slow in-out
```

### 6.5 Stagger Presets

```typescript
STAGGER_FAST   = 0.06s   // Rapid sequence (dropdown links)
STAGGER_NORMAL = 0.12s   // Standard stagger (card grids)
STAGGER_SLOW   = 0.2s    // Dramatic reveal (hero elements)
```

### 6.6 Reusable Animation Variants

```typescript
fadeUpVariants   → { opacity: 0, y: 30 } → { opacity: 1, y: 0 }    // Scroll entrance
fadeInVariants   → { opacity: 0 } → { opacity: 1 }                   // Simple fade
scaleUpVariants  → { opacity: 0, scale: 0.9 } → { opacity: 1, scale: 1 } // Card entrance
```

### 6.7 ScrollTrigger Defaults

```typescript
SCRUB_DEFAULT = 1      // Standard scroll-linked smoothing
SCRUB_TIGHT   = 0.3    // Immediate response (hero parallax)
```

### 6.8 Smooth Scrolling (Lenis)

The entire site is wrapped in `<SmoothScroll>` which integrates Lenis with GSAP ScrollTrigger. Settings: cubic ease-out, duration 0.8, synced to GSAP ticker for frame-perfect scroll-linked animations.

### 6.9 Motion Intensity by Audience

Motion level scales with audience context. This is a design decision, not a technical constraint.

```
Students    → Cinematic:   Parallax, scroll-driven reveals, ASCII transitions,
                           3D card tilt, breathing animations, AsciiReveal scrambles
Nonprofits  → Purposeful:  Fade-ups, count-up stats, smooth section transitions,
                           staggered card entrances
Companies   → Confident:   Clean slide-ins, subtle hover lifts, micro-interactions,
                           no scroll pinning beyond hero
Sponsors    → Restrained:  Gentle fades, minimal movement, professional stillness,
                           no scroll pinning, no ASCII effects
```

### 6.10 Reduced Motion

```css
/* globals.css — already partially implemented */
@media (prefers-reduced-motion: reduce) {
  .glass-nav-bar, .glass-nav-bar::after, .glass-nav-dropdown,
  .glass-nav-mobile, .glass-nav-link::after, .glass-nav-dropdown-link {
    transition: none !important;
    animation: none !important;
  }
}
```

> **TODO:** Extend reduced-motion handling globally — disable GSAP ScrollTrigger pinning/scrubbing, Lenis smooth scroll, globe rotation, ASCII dissolve, and count-up animations when `prefers-reduced-motion: reduce` is active. Show static fallbacks.

---

## 7. Component Library

### 7.1 Glassmorphism System

Glassmorphism is a core design language across Tethos, used on the navbar, cards, and interactive panels.

**Glass Card** (`globals.css .glass-card`):
```
Background:       rgba(255, 255, 255, 0.12)
Backdrop-filter:  blur(26px) saturate(1.35)
Border-radius:    22px
Border:           1px solid rgba(255, 255, 255, 0.28)
Shadow:           var(--shadow-glass)
Pseudo-elements:  ::before = top specular highlight (2px gradient)
                  ::after = left vertical edge light (1px gradient)
```

**Glass Navbar** (`globals.css .glass-nav-bar`):
```
Background:       rgba(167, 167, 167, 0.20)
Backdrop-filter:  blur(32px) saturate(1.4)
Border:           1px solid rgba(255, 255, 255, 0.10)
Pseudo-elements:  ::before = top specular line
                  ::after = liquid shimmer sweep on hover (glassShimmer keyframes)
Light variant:    .glass-nav-bar--light (reduced opacity, dark borders)
```

**Implementation note:** The glass effects rely on pseudo-elements (`::before`, `::after`). When building new glass components, always include the specular highlight (top edge) and consider the edge light (left edge) for depth.

### 7.2 Navigation — Adaptive Navbar

> **Decision:** Consolidate `GlassNavbar`, `CompanyNavbar`, `NPONavbar`, `SponsorNavbar`, and generic `Navbar` into **one adaptive navbar component** that changes behavior per route.

**Target architecture:**
```
<AdaptiveNavbar route={currentRoute}>
  ├── Shared: glass pill design, logo, contact CTA, responsive hamburger
  ├── Theme: auto-switches via IntersectionObserver + [data-navbar-theme]
  ├── Links: show all four audience links on homepage,
  │          highlight current section on audience pages
  ├── Mega menu: grid dropdown with sub-links per audience
  └── Config: behavior/style overrides per route
```

**Navbar specs (current GlassNavbar behavior to preserve):**
```
Position:     Fixed, top 0, right-aligned 593px-wide glass pill
Behavior:     Auto-hides on scroll down, reappears on scroll up
Theme:        Dark text on light sections, light text on dark sections
              (detected via IntersectionObserver on [data-navbar-theme] attributes)
Hover:        Expands glass dropdown panel with GSAP staggered column fade-in
Desktop:      4 nav columns (Nonprofits / Companies / Sponsors / Students) + Contact CTA
              Extra utility links: Log in, LinkedIn, Instagram, Bug
Mobile:       Hamburger → full-screen glass overlay (.glass-nav-mobile)
```

**Nav link animation** (already in globals.css):
```css
.glass-nav-link::after → underline grows from center on hover (0.3s cubic-bezier)
.glass-nav-dropdown-link → translateX(4px) on hover (0.25s)
```

### 7.3 Custom Cursor

> **Decision: Deferred.** The custom cursor remains active on all pages for now. Do not modify or remove cursor-related code until this decision is revisited.

**Current implementation** (`CustomCursor.tsx`):
```
- Hides system cursor via `cursor: none !important` on body and all interactives
- Center dot follows mouse instantly
- Four bracket corners follow with elastic delay (elastic.out(1, 0.6))
- Hover over buttons/links: corners snap to wrap the element's bounding box
- Click: scale down on press, bounce back on release
- mix-blend-mode: difference
- Auto-disabled on mobile/touch devices
```

**If removed:** Delete `cursor: none !important` rules from `globals.css`, remove `<CustomCursor>` from all layouts, and remove the component file. No other changes needed.

**If made opt-in:** Add a `showCursor` prop to layouts, default `false`. Enable only on pages where it adds to the experience (e.g., Students).

### 7.4 Loading Screen

`<LoadingScreen>` — appears on every page load.

```
Background:   White (#FFFFFF)
Branding:     "TETHOS" in top-left
Quote:        Random from /quotes.txt
Progress:     Animated bar + percentage counter, bottom-left
Exit:         ASCII character dissolve animation (characters wave in → dissolve out)
              Hard cut to page content on complete
```

### 7.5 Buttons

**Primary (Dark BG):**
```
Background:     var(--color-brand-blue)
Text:           #FFFFFF, --font-size-body, weight 500
Padding:        12px 24px
Border-radius:  var(--radius-sm) (8px)
Hover:          glow-blue + scale(1.02)
Active:         scale(0.98), glow-blue-sm
Transition:     DURATION_MICRO (0.2s)
```

**Primary (Light BG):**
```
Background:     var(--color-bg-main)
Text:           var(--color-brand-light)
Hover:          background var(--color-bg-alt), subtle shadow
```

**Secondary / Ghost:**
```
Background:     transparent
Border:         1px solid var(--gray-700)
Hover:          border-color var(--color-brand-blue), text blue, glow-blue-sm
```

**Contact CTA (Nav):**
```
Background:     var(--color-brand-light) (#F1FFFF)
Text:           var(--color-bg-main)
Border-radius:  var(--radius-pill)
Icon:           @ symbol image, inline
Shape:          pill
```

### 7.6 Cards

**Standard Card (Dark):**
```
Background:     var(--color-bg-alt)
Border:         1px solid rgba(0, 47, 167, 0.1)
Border-radius:  var(--radius-md) (16px)
Padding:        var(--space-6) (24px)
Hover:          border-color rgba(0, 47, 167, 0.35), glow-blue-sm, translateY(-2px)
Transition:     DURATION_NORMAL (0.6s) with EASE_SMOOTH
Variant:        fadeUpVariants or scaleUpVariants for entrance
```

**Glass Card (Pathway cards, featured elements):**
```
Uses .glass-card from globals.css (see Section 7.1)
240×360px default size (configurable)
3D mouse-tracking tilt via Framer Motion springs (SPRING_RESPONSIVE)
Breathing animation on idle (subtle scale pulse, random offset per card)
Click: tactile spring feedback (scale 0.92 → 1.05 → 1.0)
```

**Audience Cards ("Who are you?" section):**
```
PathwayCards component — fanned arc formation on desktop
Uses sagitta formula for curvature, tangent angles for rotation
Scroll-pinned with GSAP, cards appear one by one
Mobile: stacked vertical layout
Each card links to its audience pathway
```

### 7.7 Stats / Impact Metrics

`<ImpactStats>` component:
```
4 metrics: 20+ Projects / 150+ Students / 1,500+ Community / 200K+ Value
Layout:     Horizontal row, evenly spaced
Number:     --font-size-h1, #FFFFFF, bold — counts up from 0 via GSAP tween
Label:      IBM Plex Mono, --color-text-muted
Trigger:    ScrollTrigger, staggered entry (STAGGER_NORMAL)
```

### 7.8 Partner Logo Strip

`<SponsorStrip>` component:
```
Layout:    Horizontal infinite scroll
Speed:     Slow, ambient (~30s full cycle)
Logos:     Grayscale, 0.5 opacity at rest
Gap:       var(--space-12) between logos
Duplicate set for seamless loop
```

### 7.9 Footer

```
Background:    var(--color-bg-main)
Padding:       var(--space-16) vertical
Layout:        4-column grid → Logo+tagline | Pathways | Resources | Connect
Tagline:       "Technology that moves people forward. Student-built, real-world impact."
Links:         --font-size-body-sm, --color-text-muted, hover: --color-text-main
Divider:       1px solid var(--gray-800) above copyright
Copyright:     IBM Plex Mono --font-size-label, --color-text-subtle
Closing text:  "Built by students, designed with taste." — IBM Plex Mono
```

---

## 8. Page Architecture

### 8.1 Route Map

```
web/app/
├── (site)/                    Homepage route group
│   ├── layout.tsx            Navbar + CustomCursor + LoadingScreen + Footer
│   └── page.tsx              Homepage
│
├── company/                   Companies audience
│   ├── layout.tsx            → Will use AdaptiveNavbar (company config)
│   ├── page.tsx              Company landing
│   ├── build/                BuildSection, CompanyTimeline
│   ├── programs/             ProgramsSection
│   ├── alumni/               AlumniSection
│   ├── work/                 WorkSection, Testimonials (×3 variants)
│   ├── talent/               TalentSection
│   ├── team/                 TeamSection
│   ├── faqs/                 FAQSection
│   └── get-started/          GetStartedSection
│
├── npo/                       Nonprofits audience
│   ├── layout.tsx            → Will use AdaptiveNavbar (npo config)
│   ├── page.tsx              NPO landing
│   ├── sections/             NPOHero, NPOAbout, NPOTimeline, NPODeliverables, NPOCTA
│   ├── impact/               Impact showcase
│   ├── about/                About program + form
│   ├── testimonial/          Testimonials
│   ├── CTA/                  Call to action
│   ├── FAQ/                  FAQs
│   └── team/                 Team display
│
├── student/                   Students audience
│   ├── layout.tsx            → Will use AdaptiveNavbar (student config)
│   └── page.tsx              Student landing (Benefits, Timeline, CTA)
│
├── sponsor/                   Sponsors audience
│   ├── layout.tsx            → Will use AdaptiveNavbar (sponsor config)
│   ├── page.tsx              Sponsor landing
│   └── SponsorNavbar.tsx     → To be deprecated (merged into AdaptiveNavbar)
│
├── contact/                   Contact form
├── about/                     About Tethos
└── projects/                  Project showcase
```

### 8.2 Homepage Structure

```
Section 1: HomeHero
├── Fixed heading: "Technology That Moves People Forwards." + subtitle
├── Scroll: heading slides down and fades out
├── 3D globe (GlobeVisualizer) appears, draggable to rotate
├── Globe pinned by ScrollTrigger
├── Left overlay: "Technology has no borders. Neither does impact."
├── Right overlay: "Projects on this map is driven by purpose. Built by students."
└── ScrollIndicator: animated mouse icon + "Scroll to explore"

Section 2: TextRevealSection (Light — #F5FAFF)
├── Triggers navbar switch to dark text mode via data-navbar-theme="light"
├── Per-character color reveal on scroll: gray (#d9d9d9) → dark (#0F0F10)
├── Three team photos fade in with staggered timing (right side)
└── Test Söhne, responsive clamp() sizing

Section 3: ImpactStats
├── 4 animated counters (GSAP tween, ScrollTrigger)
└── Dark background

Section 4: SponsorStrip
├── "Trusted by organizations nationwide"
└── Infinite horizontal logo scroll

Section 5: PathwayCards
├── "Who are you?" heading
├── 4 glass cards in fanned arc (desktop) / stacked (mobile)
├── 3D mouse tilt, breathing animation, click spring feedback
├── Scroll-pinned, cards appear sequentially
└── "Not sure? Start with the card that feels closest to you"

Section 6: Footer
```

### 8.3 Audience Page Design Direction

**Nonprofits (`/npo`)**
```
Emotion:        Trust, competence, warmth
Hero:           Dark, strong headline. Subtle ASCII background motif.
Structure:      Hero → About → Timeline → Deliverables → Impact → Documentary → Testimonials → CTA
Color emphasis:  Blue glow for CTAs, gold for impact highlights
Motion level:   Purposeful (fade-ups, count-ups, smooth transitions)
```

**Companies (`/company`)**
```
Emotion:        Professionalism, capability, partnership
Hero:           "Build With Us. Hire From Us." with dual CTAs
Structure:      Hero → Build → Programs → Alumni → Work/Testimonials → FAQ → Get Started
Color emphasis:  Blue primary, minimal gold
Motion level:   Confident (slide-ins, subtle hovers, no scroll pinning beyond hero)
```

**Sponsors (`/sponsor`)**
```
Emotion:        Confidence, ROI, prestige
Direction:      ⚠️ PENDING DECISION — white investor-grade vs dark with restraint
Hero:           "Fund Technology That Matters."
Structure:      Hero → Impact Stats → Why Sponsor → Packages → Past Sponsors → Events → Testimonials → CTA
Color emphasis:  Gold for tier badges, blue for interactive
Motion level:   Restrained (gentle fades, professional stillness)
Special:        Genesis event showcase with ASCII art poster
```

**Students (`/student`)**
```
Emotion:        Excitement, belonging, creative energy
Hero:           "Build Real Things. Ship Real Code. Make Real Impact."
Structure:      Hero → 6 Benefits → Project Types (pill tags) → 4-step Timeline → CTA
Color emphasis:  Cyan + orange as secondary accents alongside blue
Motion level:   Cinematic (parallax, AsciiReveal scrambles, AsciiDivider separators,
                scroll-driven reveals, 3D card tilt, breathing animations)
Special:        All animations GSAP-driven with ASCII effects
```

---

## 9. Dark Mode vs. Light Mode

Tethos is **dark-first**. Dark is the default. Light sections create intentional warmth and contrast.

**Dark (default):**
- Homepage (all sections except TextRevealSection)
- All hero sections
- Technical/data-heavy sections
- Project showcases
- Footer (always)

**Light (#F1FFFF or #F5FAFF):**
- TextRevealSection (about/mission, team photos)
- Long-form text where readability is paramount
- Application forms and input-heavy pages
- Testimonial sections that benefit from warmth

**Transitions between modes:**
Sections use `data-navbar-theme="light"` or `data-navbar-theme="dark"` attributes, detected by IntersectionObserver to auto-switch the navbar. For the visual transition itself, use either a gradient fade over ~100px or a hard cut with generous padding on both sides.

---

## 10. 3D Globe — Homepage Only

The 3D globe is the homepage centerpiece. It does NOT appear on any other page.

**Component:** `<GlobeVisualizer>` using `three-globe` + React Three Fiber

```
Visual:       Realistic white/cream earth model
Background:   var(--color-bg-main)
Lighting:     Soft ambient + directional (pearlescent look)
Interaction:  Drag to rotate, scroll advances sections (GSAP ScrollTrigger pinned)

Markers:
  - Large blue (#002FA7) nodes → Tethos home (Western University)
  - Small gray nodes → project delivery locations
  - Dotted lines with animated arrows → blue → gray (shipping a project)
  - Hover on gray node → card with project name and details

Text overlays:
  - Top-left: "Technology has no borders. Neither does impact."
  - Bottom-right: "Projects on this map is driven by purpose. Built by students."

Data files:
  - /data/globe-countries.json (country geometry)
  - /data/globe-nodes.json (node positions)
```

Related components: `<AsciiGlobe>` (ASCII-style fallback/alternative), `<InteractivePylon3D>` (3D pylon model on demo pages).

---

## 11. Genesis Event Sub-Brand

Genesis is Tethos's flagship event — a project showcase of student-built technology for nonprofit partners.

```
Background:        Deep black (#0F0F10)
Primary visual:    Full ASCII art illustration (from custom generator)
Title:             "GENESIS" — --font-size-hero, all caps, letter-spacing 0.1em, #FFFFFF
Subtitle:          "TETHOS FLAGSHIP EVENT" — IBM Plex Mono, --color-text-muted, 0.2em spacing
Date/venue:        IBM Plex Mono --font-size-label, positioned at top corners
Description:       Body text, centered bottom
Color additions:   White particles on black, blue glow for interactives, gold for registration CTAs
```

---

## 12. Accessibility

### 12.1 Standards

WCAG 2.1 AA compliance minimum. All text meets 4.5:1 contrast (body) or 3:1 (large text). All interactive elements have visible focus states (`outline: 2px solid #002fa7; outline-offset: 2px`). Keyboard navigation for all interactive elements.

### 12.2 Key Contrast Checks

```
#f1ffff on #0f0f10     → 18.9:1  ✅ AAA
#e5e7eb on #0f0f10     → 14.8:1  ✅ AAA
#9ca3af on #0f0f10     → 7.5:1   ✅ AAA
#6b7280 on #0f0f10     → 4.9:1   ✅ AA
#002fa7 on #0f0f10     → 3.2:1   ✅ AA large text only
#ffd166 on #0f0f10     → 10.8:1  ✅ AAA
#0f0f10 on #f1ffff     → 18.9:1  ✅ AAA
```

### 12.3 Reduced Motion

Respect `prefers-reduced-motion: reduce`. Disable: GSAP ScrollTrigger pinning/scrubbing, Lenis smooth scroll, globe rotation (show static fallback), ASCII dissolve transitions, count-up animations (show final values), custom cursor effects.

---

## 13. Imagery & Photography

### 13.1 Photography Style by Context

```
Team / about     → Candid, energetic, natural light, slightly warm color grade
Events (Genesis) → Dynamic, conference-style, stage/audience shots
Projects         → Clean UI screenshots on device mockups, dark backgrounds
Client work      → Professional, showing the tool in real use
Sponsors         → Polished, brand-safe, neutral tones
```

### 13.2 Image Treatment

- **Dark sections:** `border-radius: var(--radius-md)` (16px), subtle dark vignette or `mix-blend-mode: luminosity`
- **Light sections:** Rounded corners, soft shadows, may be slightly rotated for editorial composition (see TextRevealSection's 3-photo stack)
- **Full-bleed images:** Used sparingly — only hero backgrounds or major section breaks

### 13.3 ASCII Art Rendering Specs

```
Font:           IBM Plex Mono (--font-highlight)
Color:          --gray-400 on dark backgrounds (or --gray-700 for subtle textures)
Line-height:    1.0 (tight, characters form cohesive image)
Character set:  standard density ramp (" .:-=+*#%@")
Opacity:        0.05 for background textures, 1.0 for featured art (Genesis)
```

---

## 14. File & Component Conventions

### 14.1 Directory Structure

```
web/
├── app/                    Next.js App Router (routes & layouts)
│   └── lib/gsap/          GSAP animation utilities (animations.ts, scrollTrigger.ts)
├── components/
│   ├── layout/            Structural: GlassNavbar, CompanyNavbar, NPONavbar, Footer
│   ├── ui/                Primitives: Button, CustomCursor, LoadingScreen, GlobeVisualizer,
│   │                      AsciiGlobe, InteractivePylon3D, ScrollHint, ScrollIndicator, Lanyard
│   ├── sections/          Page sections: HomeHero, TextRevealSection, ImpactStats,
│   │                      SponsorStrip, PathwayCards, AboutUs, PinnedSection, ScrollFade,
│   │                      ScrollRevealTimeline, UnderConstruction, NPO/*
│   ├── hero/              Hero components: CompanyHero, HeroCTA, HeroHeading, ScrollHint
│   ├── cards/             Card system: CardCarousel, CardGlow, Interactive3DCard,
│   │                      PositionedCard, cardMath.ts, types.ts
│   └── ascii/             ASCII effects: AsciiDitherShader, AsciiDivider, AsciiReveal
├── lib/
│   └── motion.ts          ★ Shared motion presets
├── styles/
│   └── tokens.css         ★ Design tokens
├── data/                  globe-countries.json, globe-nodes.json
└── public/
    ├── images/            Team photos, etc.
    ├── font/              Test Söhne family, IBM Plex Mono
    ├── models/            3D models (pylon.gltf, scene.bin)
    └── quotes.txt         Loading screen quotes
```

### 14.2 Key Source-of-Truth Files

```
DESIGN_SYSTEM.md           ← This file (vision, decisions, rules)
web/styles/tokens.css      ← All color, spacing, typography, shadow tokens
web/lib/motion.ts          ← All animation presets (GSAP + Framer Motion)
web/app/globals.css        ← Font-face, glass effects, global styles
```

---

## 15. Tooling & Workflow

### 15.1 MCP Servers (Connected to IDE)

The project has four MCP asset servers connected for component and pattern sourcing:

```
Server              What it provides                          When to use
──────────────────────────────────────────────────────────────────────────────────
Connected Stitch    Component library, design token sets      When you need a pre-built component
                                                              that aligns with the token system, or
                                                              when syncing design tokens across tools

Nano Banana 2       Animation & micro-interaction primitives  When adding hover effects, transitions,
                                                              or interaction feedback. Cross-reference
                                                              with lib/motion.ts presets — use Tethos
                                                              presets first, Nano Banana for patterns
                                                              not yet in the motion system

UI UX Pro Max       Layout templates & section patterns       When scaffolding a new page section or
                                                              need a proven layout structure (grids,
                                                              hero layouts, card arrangements). Adapt
                                                              to Tethos tokens — never use raw styles

21st.dev            Pre-built UI components (shadcn-style)    When you need a polished primitive
                                                              (modals, dropdowns, tooltips, form
                                                              elements) that would take too long to
                                                              build from scratch. Restyle with Tethos
                                                              tokens + glassmorphism where appropriate
```

**Rules for using MCP assets:**
1. **Always restyle to match Tethos.** Never ship raw MCP component styles — adapt colors, fonts, radii, and spacing to `tokens.css`.
2. **Motion presets from `lib/motion.ts` take priority** over any animation presets from Nano Banana 2. Only pull from Nano Banana when the motion system doesn't cover the interaction pattern.
3. **Check existing components first** (Section 16.2) before sourcing from MCP servers. Don't duplicate what's already built.
4. **Glass effects are custom.** No MCP server provides the Tethos glassmorphism system — always use the `.glass-card` / `.glass-nav-bar` patterns from `globals.css`.

### 15.2 AI Coding Agents

```
Tool                   Access              Best for
──────────────────────────────────────────────────────────────────────────────────
Claude Code            VS Code extension    Codebase-aware edits, multi-file changes,
(VS Code)              Full repo access     refactors, implementing sections that touch
                                            multiple components. Can read DESIGN_SYSTEM.md
                                            directly from repo root.

Cursor                 IDE                  Rapid iteration on single components,
                       Full repo access     Figma-to-code with screenshots, quick fixes.
                                            Add DESIGN_SYSTEM.md to .cursorrules or
                                            reference via @file.

Claude.ai              Browser chat         Design decisions, design system updates,
(this conversation)    No repo access       generating standalone components, strategic
                                            planning, content writing, reviewing approaches
                                            before implementation.
```

**Recommended workflow (evolving):**
1. **Design decisions & system updates** → Claude.ai (this chat). Rich back-and-forth, persistent context about the vision.
2. **Multi-file implementation** → Claude Code in VS Code. Point it at `@DESIGN_SYSTEM.md` for context. Best for building full page sections, refactors (like navbar consolidation), and changes that span components + styles + routes.
3. **Rapid single-component iteration** → Cursor. Good for quick visual iteration on one component with screenshot feedback from Figma.
4. **When stuck** → Come back to Claude.ai to discuss the approach, then implement in Claude Code or Cursor.

### 15.3 Using DESIGN_SYSTEM.md with Agents

**Claude Code (VS Code):**
```
# At the start of a session, reference the design system:
@DESIGN_SYSTEM.md Build the sponsor hero section following the design direction for /sponsor
```

**Cursor:**
Add to `.cursorrules` or project-level instructions:
```
Always read DESIGN_SYSTEM.md before implementing any new component or page section.
Use CSS variables from web/styles/tokens.css — never hardcode colors or spacing.
Import animation presets from web/lib/motion.ts — never hardcode easing or durations.
```

**Both agents:** When creating a new page section, the agent should:
1. Read this design system for the audience-specific direction
2. Check existing components (Section 16.2) for reusable pieces
3. Check MCP servers for primitives not yet built
4. Restyle everything to Tethos tokens
5. Use the correct motion intensity for the target audience page

---

## 16. Implementation Notes for AI Agents

### 16.1 Core Rules

1. **Dark-first.** Default all new components to dark styling. Light only where this document specifies.
2. **Blue glow = ambient + interactive on dark only.** Use `border-glow` / `glow-blue` utilities. Flat `#002FA7` on light.
3. **Test Söhne for all UI. IBM Plex Mono for data/code/ASCII only.**
4. **ASCII art is decoration, never structure.** Background layers, transitions, accents.
5. **Motion scales by audience.** Check which page before adding animations. See Section 6.9.
6. **Globe is homepage-only.** No 3D globe on subpages.
7. **Cards glow on hover** on dark backgrounds. Use the `border-glow-hover` pattern.
8. **Import motion presets from `lib/motion.ts`.** Never hardcode easing or duration values.
9. **Use CSS variables from `tokens.css`.** Never hardcode colors or spacing.
10. **All focus states use blue outline** for accessibility.
11. **GSAP + ScrollTrigger for scroll animations. Framer Motion for mount/unmount only.**

### 16.2 Before Building a New Component

Check if these existing components already solve your need:
```
SmoothScroll                    → Lenis smooth scroll wrapper
GlassNavbar / .glass-card       → Glassmorphism surfaces
Button / ButtonHelperText       → Interactive buttons
CardCarousel / Interactive3DCard → Card presentations
AsciiReveal / AsciiDivider      → ASCII text effects
ImpactStats                     → Animated metric counters
SponsorStrip                    → Logo carousels
HomeHero / CompanyHero / HeroCTA → Hero sections
ScrollFade / ScrollRevealTimeline → Scroll-triggered reveals
PathwayCards                    → Audience selection cards
TextRevealSection               → Scroll-driven character reveal
```

### 16.3 Open Decisions (Flag Before Implementing)

These items are not yet finalized. Ask before building:

```
⚠️  Sponsor page direction    → White investor-grade vs dark restrained (Section 8.3)
                                 This MUST be decided before building the sponsor page.
✅  Custom cursor              → Deferred. Keep current behavior, do not modify (Section 7.3)
⚠️  Navbar consolidation      → Single AdaptiveNavbar replacing 5 navbars (Section 7.2)
                                 Low priority — current navbars work. Tackle after subpages ship.
```

### 16.4 Cleanup Tasks

```
DONE  Remove Milker @font-face from globals.css + delete /font/milker/
DONE  Remove Space Grotesk references (if any remain in layout.tsx)
DONE  Remove --color-accent-purple from tokens.css
TODO  Extend reduced-motion handling globally (Section 6.10)
TODO  Consolidate navbars into AdaptiveNavbar (Section 7.2) — low priority
DEFER Remove cursor: none !important from globals.css — decision pending
```
