# UWOTSI

A modern, animation-heavy web experience built with Next.js 16, React 19, and Three.js.

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
web/
├── app/          # Routes and layouts (App Router)
├── components/   # Shared UI components
├── styles/       # Design tokens and global CSS
└── public/       # Static assets (images, models)
```

All frontend work happens inside `web/`.

## Tech Stack

| Category       | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Framework      | Next.js 16, React 19, TypeScript 5                          |
| Styling        | Tailwind CSS 4, custom tokens (`styles/tokens.css`)         |
| Animation      | GSAP 3 (+ ScrollTrigger), Framer Motion 12                  |
| 3D Graphics    | Three.js, React Three Fiber, Drei                           |
| Scrolling      | Lenis (smooth scroll, GSAP-integrated)                      |
| Icons          | Lucide React, Heroicons                                     |
| Fonts          | Inter (body), Space Grotesk (headings) via `next/font`      |

## Scripts

Run from `web/`:

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start dev server               |
| `npm run build`   | Production build               |
| `npm run start`   | Start production server        |
| `npm run lint`    | Run ESLint                     |

## Development Notes

- **Animations**: GSAP + ScrollTrigger power cursor, scroll, and section animations. Check the console for GSAP errors if animations misbehave.
- **Layout**: Hero and pathway card sections use precise layout math—make small, incremental changes rather than rewriting transforms.
- **Tokens**: Update colors and typography in `web/styles/tokens.css` instead of hardcoding values.

## Deployment

Deploy as a standard Next.js app:

- **Vercel** (recommended)
- Any Node.js host running `npm run build` → `npm run start`

Configure environment variables in your hosting provider as needed.

## Contributing

1. Create a feature branch
2. Run `npm run lint` from `web/` (no errors)
3. Open a PR with description and screenshots/GIFs for UI changes

Place new components under `web/components/`.
