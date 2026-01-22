# UWOTSI

A modern, animation-heavy web experience built with Next.js 16, React 19, and Three.js.

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (check with `node -v`)
- **npm** 10+ (check with `npm -v`)

### Setup

```bash
# 1. Clone the repo (if you haven't already)
git clone https://github.com/UWO-TSI/tsi-website.git
cd tsi-website

# 2. Install dependencies
cd web
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app hot-reloads on save.

---

## Project Structure

```
web/
├── app/            # Routes and layouts (Next.js App Router)
│   ├── layout.tsx  # Root layout (fonts, global providers)
│   ├── page.tsx    # Homepage
│   └── [route]/    # Additional pages
├── components/     # Reusable UI components
│   ├── ui/         # Primitives (buttons, cards, indicators)
│   ├── layout/     # Header, footer, navigation
│   └── sections/   # Page sections (hero, features, etc.)
├── styles/         # Global CSS and design tokens
│   └── tokens.css  # Colors, spacing, typography variables
└── public/         # Static assets (images, 3D models, fonts)
```

> **All frontend work happens inside `web/`.**

---

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

---

## Common Tasks

### Running the App

| Command           | What it does                           |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Start dev server at localhost:3000     |
| `npm run build`   | Create production build                |
| `npm run start`   | Run production build locally           |
| `npm run lint`    | Check for ESLint errors                |

### Where to Find Things

| If you need to...                  | Look here                              |
| ---------------------------------- | -------------------------------------- |
| Add a new page                     | `app/[your-route]/page.tsx`            |
| Create a reusable component        | `components/ui/`                       |
| Edit global colors/fonts           | `styles/tokens.css`                    |
| Add static images or assets        | `public/`                              |
| Modify the header/footer           | `components/layout/`                   |
| Update homepage sections           | `components/sections/`                 |

---

## Development Guidelines

### Styling

- Use **Tailwind classes** for layout and spacing
- Use **CSS variables** from `tokens.css` for colors and typography
- Avoid hardcoded hex values — add new colors to the design tokens

### Animations

- **GSAP + ScrollTrigger** powers scroll-based animations
- **Framer Motion** handles component enter/exit animations
- Check the browser console for GSAP errors if animations break
- Make small, incremental changes to animation code

### Components

- Place new components in `components/ui/` (primitives) or `components/sections/` (page blocks)
- Use TypeScript interfaces for props
- Keep components focused — split large components into smaller pieces

---

## Troubleshooting

| Issue                              | Fix                                                        |
| ---------------------------------- | ---------------------------------------------------------- |
| `npm install` fails                | Delete `node_modules` and `package-lock.json`, reinstall   |
| Animations not working             | Check console for GSAP errors; ensure ScrollTrigger is imported |
| Styles not updating                | Hard refresh (`Cmd+Shift+R`) or restart dev server         |
| Port 3000 already in use           | Kill the process or use `npm run dev -- -p 3001`           |

---

## Git Workflow

1. **Pull latest changes**: `git pull origin main`
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make changes and lint**: `npm run lint`
4. **Commit with a clear message**: `git commit -m "feat: add new hero section"`
5. **Push and open a PR**: Include screenshots/GIFs for UI changes

### Commit Prefixes

| Prefix     | Use for                        |
| ---------- | ------------------------------ |
| `feat:`    | New features                   |
| `fix:`     | Bug fixes                      |
| `docs:`    | Documentation changes          |
| `style:`   | Formatting, styling tweaks     |
| `refactor:`| Code restructuring             |

---

## Deployment

The app deploys automatically via **Vercel** on pushes to `main`.

For manual deployment to other hosts:

```bash
npm run build
npm run start
```

---

## Questions?

Reach out to the team in the TSI Slack or open an issue in this repo.
