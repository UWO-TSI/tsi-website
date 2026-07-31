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
│   ├── lab/            # Dev-only benches: map editor, item/interior/furniture
│   │                   #   viewers, tuning. 404 in production.
│   └── layout.tsx      # Root layout (fonts, global providers)
├── components/
│   ├── ui/             # Primitives (buttons, cards, indicators)
│   ├── layout/         # Header, footer, navigation
│   ├── sections/       # Marketing page sections
│   ├── game/           # 3D game world (GameWorld.tsx, PlayerAvatar.tsx)
│   │   └── grid/       # Tile-grid terrain renderer (chunked, instanced kits)
│   ├── recruit/        # Recruitment system components
│   └── portal/         # Student portal components
├── lib/
│   ├── game/           # Game logic and shaders. grid.ts is the terrain
│   │                   #   substrate; *.test.ts run under Vitest.
│   └── supabase/       # Supabase clients (client, server, admin) + DB types
├── data/               # Versioned content. island-map.json IS the world map.
├── scripts/            # Asset pipeline + world authoring (Node, run by hand)
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
| 3D Graphics    | Three.js r182, React Three Fiber 9, Drei 10                 |
| Testing        | Vitest 3 (`web/lib/**/*.test.ts`)                           |
| Backend        | Supabase (auth, Postgres, storage)                          |
| Scrolling      | Lenis (smooth scroll, GSAP-integrated)                      |
| Icons          | Lucide React, Heroicons                                     |
| Fonts          | Space Grotesk (body), Test Sogne (headings), IBM Plex Mono (highlights) |

---

## Commands

Run from `web/`:

| Command             | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start dev server (3000, falls back to 3001) |
| `npm run build`     | Create production build                     |
| `npm run start`     | Run production build locally                |
| `npm run lint`      | Check for ESLint errors                     |
| `npm test`          | Run the Vitest suite once                   |
| `npm run test:watch`| Re-run tests on save                        |
| `npx tsc --noEmit`  | Typecheck without emitting                  |

Note: `BAILOUT_TO_CLIENT_SIDE_RENDERING` in SSR output is expected for the game world (it renders client-side by design), not an error.

---

## The game world

The terrain is a discrete tile grid, not a continuous heightfield: 1.0u tiles,
levels in steps of 0.75u, cliffs two levels tall. `web/lib/game/grid.ts` is the
substrate, `web/data/island-map.json` is the map itself, and
`web/components/game/grid/` renders it in 16×16 chunks with instanced kit pieces.

### Dev benches (`/lab`, 404 in production)

| Bench            | What it's for                                                |
| ---------------- | ------------------------------------------------------------ |
| `/lab/map`       | **The terrain drafting tool.** Draw islands, plan layouts.    |
| `/lab/world`     | The game world on its own, without the dashboard around it    |
| `/lab/item`      | Inspect a single GLB: scale, orientation, material count      |
| `/lab/interior`, `/lab/furniture`, `/lab/fishing`, `/lab/icon` | Feature-specific harnesses |
| `/lab/tune`      | One asset at a time on a plain stage, every value on a slider |

**Terrain is drawn, not coded.** `/lab/map` is where the layout of every island
gets planned. It edits the shipped map and exports the whole `island-map.json`
to the clipboard; paste it over `web/data/island-map.json`. Its health panel
checks exactly what `web/lib/game/islandMap.test.ts` asserts, so if the panel
says healthy the paste keeps the suite green.

It is for **blocking out space**, not pixel-perfect work. Every tool answers
*what* (land, sea, raise, lower, flat, surface, ramp) and every shape answers
*where* (free brush, rect, snapped line, flood fill), so a plot is a dragged
rectangle and a path is a snapped run rather than a hand-dabbed blob. Two things
ride along in the exported JSON without touching terrain:

- **Plots** — a dragged marker stores `size: [w, d]`, so "HQ goes here, 7×5" is
  data rather than a note.
Draw the silhouette you want and let the tool legalise it: a face taller than
one cliff piece has nothing to render it, and **terrace them** steps the whole
landform down until every face fits, leaving the peak where you drew it.

- **Labels** — `annotations`, free-text named regions you draw yourself
  (fencing, hedges, "paved later"). Deliberately not surfaces: surfaces are a
  closed enum the renderer switches on, and drafting notes do not belong there.
  The renderer ignores annotations entirely.

Two things that bite:

- `web/scripts/author-elevation.mjs` reads `island-map.json`, mutates it and
  writes it back, so **running it overwrites hand-drawn work**.
- Named drafts in `/lab/map` live in the browser's localStorage. They are
  per-machine; export anything worth keeping into the repo.

`/lab/tune` follows the same shape for art: isolate one asset, put every value
on a slider, and "Copy source" emits the `TUNING_DEFAULTS` literal from
`web/lib/game/tuning.ts` so a session ends in a paste rather than in retyping
numbers off a screenshot.

---

## Contributing

1. Pull latest: `git pull origin main`
2. Branch: `git checkout -b feature/your-feature`
3. Before committing, from `web/`: `npx tsc --noEmit && npm run lint && npm test`
4. Open a PR with screenshots/GIFs for UI changes

Lint has a known baseline of pre-existing errors; the bar is not increasing it,
not reaching zero. `specs/qa.md` records the current numbers.

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
| Terrain looks wrong after a script run | `author-elevation.mjs` overwrote hand edits. Re-import your draft in `/lab/map`. |
| `/lab/*` 404s                      | Expected in production; the benches are dev-only            |

---

## Deployment

Pushes to `main` deploy automatically via **Vercel**.

---

## Questions?

Reach out in the TSI Slack or open an issue in this repo.
