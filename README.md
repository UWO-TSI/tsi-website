# tsi-website

The web home of Tethos (TSI) at Western. One Next.js app, three product surfaces:

1. **Marketing site** (`web/app/(site)/`): public landing pages at tethos.ca
2. **Recruitment system** (`web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`): exec hiring portal, live in production
3. **Student portal** (`web/app/student/dashboard/`, `web/components/game/`): a 2.5D game world for active TSI members: 2D sprite characters in a 3D map, bounty board, marketplace, leaderboards

If you're an agent or contributor, start with `CLAUDE.md`. It's the entry point that explains roles, file ownership, and which parts of the repo are off limits. `AGENT_LOG.md` tracks the current sprint.

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (check with `node -v`)
- **npm** 10+ (check with `npm -v`)

### Setup

```bash
git clone https://github.com/UWO-TSI/tsi-website.git
cd tsi-website/web

# .npmrc is configured for legacy peer deps; the flag makes it explicit
npm install --legacy-peer-deps

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If 3000 is taken, the dev server falls back to 3001. The app hot-reloads on save.

Supabase env vars are optional in dev: middleware handles a missing `.env.local` gracefully, so the marketing site and game world run without one.

---

## Project Structure

```
web/
├── app/
│   ├── (site)/         # Marketing pages (stable, don't touch unless tasked)
│   ├── student/
│   │   ├── apply/      # Recruitment portal (live in prod, don't touch unless tasked)
│   │   └── dashboard/  # Student portal pages (active development)
│   └── layout.tsx      # Root layout (fonts, global providers)
├── components/
│   ├── ui/             # Primitives (buttons, cards, indicators)
│   ├── layout/         # Header, footer, navigation
│   ├── sections/       # Marketing page sections
│   ├── game/           # 3D game world (GameWorld.tsx, PlayerAvatar.tsx)
│   ├── recruit/        # Recruitment system components
│   └── portal/         # Student portal components
├── lib/supabase/       # Supabase clients (client, server, admin) + DB types
├── supabase/           # Migrations (never edit applied ones, add new)
├── styles/             # Global CSS and design tokens (tokens.css, game-tokens.css)
└── public/             # Static assets (images, 3D models, fonts)

specs/                  # Design specs and UX backlog (index in specs/ux-status.md)
```

---

## Tech Stack

| Category       | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Framework      | Next.js 16, React 19, TypeScript 5                          |
| Styling        | Tailwind CSS 4, custom tokens (`styles/tokens.css`)         |
| Animation      | GSAP 3 (+ ScrollTrigger), Framer Motion 12                  |
| 3D Graphics    | Three.js, React Three Fiber, Drei                           |
| Backend        | Supabase (auth, Postgres, storage)                          |
| Scrolling      | Lenis (smooth scroll, GSAP-integrated)                      |
| Icons          | Lucide React, Heroicons                                     |
| Fonts          | Space Grotesk (body), Test Sogne (headings), IBM Plex Mono (highlights) |

---

## Commands

Run from `web/`:

| Command           | What it does                           |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Start dev server (3000, falls back to 3001) |
| `npm run build`   | Create production build                |
| `npm run start`   | Run production build locally           |
| `npm run lint`    | Check for ESLint errors                |

Note: `BAILOUT_TO_CLIENT_SIDE_RENDERING` in SSR output is expected for the game world (it renders client-side by design), not an error.

---

## Contributing

1. Pull latest: `git pull origin main`
2. Branch: `git checkout -b feature/your-feature`
3. Lint before committing: `npm run lint`
4. Open a PR with screenshots/GIFs for UI changes

Agents follow the `[build]` / `[qa]` / `[review]` commit prefixes defined in `AGENT_LOG.md`. Human contributors use conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`).

Off-limits without an explicit task: marketing site pages, the recruitment system, and applied migrations. See `CLAUDE.md` for the full list.

---

## Troubleshooting

| Issue                              | Fix                                                        |
| ---------------------------------- | ---------------------------------------------------------- |
| `npm install` fails                | Use `--legacy-peer-deps`; if it still fails, delete `node_modules` and `package-lock.json`, reinstall |
| Animations not working             | Check console for GSAP errors; ensure ScrollTrigger is imported |
| Styles not updating                | Hard refresh (`Cmd+Shift+R`) or restart dev server         |
| Port 3000 already in use           | Dev server falls back to 3001 automatically                |

---

## Deployment

Pushes to `main` deploy automatically via **Vercel**.

---

## Questions?

Reach out in the TSI Slack or open an issue in this repo.
