# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `web/` directory:

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Run production build locally
npm run lint     # Run ESLint
```

> After CSS changes, do a hard refresh (`Cmd+Shift+R`) — hot reload may not pick up token changes.

## Architecture

This is a Next.js 16 / React 19 website for Tethos (UWO-TSI), a student-run tech collective at Western University. All frontend code lives in `web/`.

**App Router structure (`web/app/`):**
- `(site)/` — homepage
- `company/`, `npo/`, `student/`, `sponsor/` — four audience pathways, each with their own navbar variants
- `api/an-token/` — Anthropic SDK token endpoint (uses `AN_API_KEY` env var)
- `(dev)/` — development-only demo pages (`globe-demo`, `globe-test`, `pylon-demo`, `navbar-test`); still accessible as routes but logically separated

**Component layers:**
- `components/ui/` — primitives: `AsciiGlobe`, `GlobeVisualizer`, `InteractivePylon3D`, `CustomCursor`, `Button`, etc.
- `components/layout/` — `GlassNavbar` (primary nav), pathway-specific navbars, `Footer`
- `components/sections/` — page sections (`HomeHero`, `PathwayCards`, `ImpactStats`, `TextRevealSection`, etc.)
- `components/SmoothScroll.tsx` — Lenis smooth scroll provider (wrap pages that need it)

**Styling:**
- Tailwind CSS 4 for layout/spacing
- `styles/tokens.css` defines all design tokens (`--color-*`, `--font-*`, `--space-*`, `--radius-*`) — use these, never hardcode hex values
- Glass morphism via CSS variables (`--glass-bg`, `--glass-border`)
- Custom cursor enabled globally in `globals.css`

**Animation conventions:**
- **Scroll-driven:** GSAP + ScrollTrigger — utilities in `app/lib/gsap/`
- **Component-level:** Framer Motion — presets in `lib/motion.ts`
- Both systems coexist; don't mix them for the same animation

**3D graphics:**
- Three.js via React Three Fiber + Drei
- Rapier physics (`@react-three/rapier`)
- `.glb` files handled by custom webpack rule in `next.config.ts`
- meshline JSX elements require `// @ts-expect-error` (type declarations are limited)

**Fonts:**
- `Test Söhne` — headings (custom, loaded via `@font-face` in layout)
- `Space Grotesk` — body (`@next/font/google`)
- `IBM Plex Mono` — monospace/accent (`@next/font/google`)

**Design system:** Full technical specification in `web/DESIGN_SYSTEM.md`. Aesthetic philosophy, motion doctrine, and design judgment in `web/STYLE.md` — read this when making any visual or motion decision.

## Environment Variables

Required in `web/.env.local`:
```
AN_API_KEY=       # Anthropic SDK
GEMINI_API_KEY=   # Google Gemini
STITCH_API_KEY=   # CMS/database
```

## Key Config

- **Turbopack** enabled in `next.config.ts` (faster local dev)
- **TypeScript strict mode** on; path alias `@/*` resolves to `web/`
- **ESLint** extends Next.js core web vitals + TypeScript configs
- Deployed to Vercel on push to `main`
