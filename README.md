## UWOTSI Monorepo

This repository contains the main UWOTSI web experience, built with **Next.js 14**, **React**, and a modern animation-heavy UI (GSAP, Framer Motion, and Three.js via React Three Fiber).

The actual application code lives in the `web` workspace.

---

## Quick Start

From the repo root:

```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## Project Structure

- **`web/`** – Next.js app (App Router)
  - `app/` – routes and top-level layouts
  - `components/` – shared UI, layout, hero sections, cards, etc.
  - `styles/` – design tokens and global CSS
  - `public/` – static assets (images, models, etc.)

You should assume that any new frontend work happens inside `web/`.

---

## Tech Stack

- **Framework**: Next.js (App Router), React, TypeScript  
- **Styling**: Tailwind CSS + custom CSS tokens  
- **Animation**: GSAP (`gsap` + `ScrollTrigger`), Framer Motion  
- **3D & Interaction**: `three`, `@react-three/fiber`, `@react-three/drei`  
- **Icons**: `lucide-react`

---

## Dependencies (web/)

Install everything from `web/`:

```bash
cd web
npm install
```

Key runtime packages used by the app:

- `framer-motion`
- `gsap`
- `lenis`
- `lucide-react`
- `three`
- `@react-three/fiber`
- `@react-three/drei`

You should **not** need to install these individually; they are already listed in `web/package.json`.

---

## Common Scripts (run from `web/`)

```bash
npm run dev        # Start local dev server (http://localhost:3000)
npm run lint       # Run ESLint
npm run build      # Production build
npm run start      # Start production server (after build)
```

---

## Development Notes

- Custom cursor, scroll, and section animations rely on GSAP + ScrollTrigger; if animations seem off, make sure the browser console is clear of GSAP-related errors.
- Many sections (e.g. hero, pathway cards) use tightly tuned layout math; prefer small, incremental changes to constants rather than rewriting transforms.
- The design system tokens live in `web/styles/tokens.css`; update colors/typography there rather than scattering hardcoded values.

---

## Deployment

The `web` app is a standard Next.js application and can be deployed to:

- **Vercel** (recommended)  
- Any Node.js host that can run `npm run build` followed by `npm run start`

Be sure to configure any required environment variables in your hosting provider.

---

## Contributing

1. Create a new branch for your change.  
2. Run `npm run lint` from `web/` and ensure there are no errors.  
3. Open a PR with a clear description and screenshots/GIFs for UI changes.

If you’re unsure where a component should live, prefer placing it under `web/components/` and we can refactor as the design system evolves.