# tethos.ca redesign

The build spec for the marketing site redesign, decided with David on 2026-11-11. Branch `site/revamp`, worktree `.claude/worktrees/site-revamp`. Reviewed section by section on the Vercel preview; nothing merges to `main` until David approves.

Decision history and reasoning: ClaudeBrain `Sessions/2026-11-11-tethos-site-revamp-onboarding.md`. References: ClaudeBrain `Design Styles/` (contentarchitecture.dev flow, terminal-industries.com, modus.fantik.studio, morethanequal.com, foundry.basement.studio).

## Scope and ownership

- Full redo of the marketing pages: `/`, `/npo`, `/genesis`. The recruitment portal (`/student/apply/**`, admin) and the game (play.tethos.ca) keep working unchanged.
- This work owns the marketing nav, the footer, `next.config.ts` redirects and `middleware.ts` where the site needs them. The host split in `web/lib/hosts.ts` must keep working.
- Retire: the old home sections in `web/components/sections/`, unused `web/components/ui/` pieces, `/npo/impact`, `/npo/people`, `/npo/program`, `/npo/voices`, `/npo/apply`, `/under-construction` (redirect each to its closest new page).

## Structure

Tethos is the umbrella (ethical, purposeful tech). Branches are what you do (TSI builds software for nonprofits; Prism, a possible Waterloo branch, would make tech art for the community). Chapters are where (Western, UBC) and stay sections, never subdomains.

- One template, one config per site. The config holds the name, mission line, accent, the sections that are on, and the content. The host picks the config, the same way play.tethos.ca works.
- Now: tethos.ca is the umbrella site, mostly TSI's work. TSI is named in the mission section. Branch subdomains (tsi.tethos.ca and others) switch on only when a second branch exists.
- GENESIS, play.tethos.ca and the frame are Tethos-wide. Branches keep Tethos colours plus one accent; TSI is light blue.
- The ring-of-six-people mark is shared by Tethos and its branches.

## Look

- Colours: near-black `#0f0f10` and Tethos light `#F1FFFF` grounds alternating by section. One signal colour, light blue `#1d9bf0`; on light grounds it becomes main blue `#002FA7`. `/genesis` is very dark throughout with an aura glow.
- Type: Söhne for UI and headlines, Söhne Mono for labels, numbers and glyph art. The Test Söhne files hold only 68 characters (letters, digits, `.,-` and a few more); missing characters fall back per character through `unicode-range` to Inter Tight (text) and Geist Mono (mono). Cuts map to their real weights: Leicht 300, Buch 400, Kräftig 500, Halbfett 600, Dreiviertelfett 700. woff2 files: `web/public/font/sohne-woff2/`.
- Kept from the old site: custom cursor (now the upright person from the logo), noise grain, the dot nav, the globe (arcs and chapter nodes recoloured to light blue).
- Loader: the six-person mark assembles person by person on black, then lifts away. Under a second, first visit only.
- Motion rule (David): scroll effects that drive animation and content, never "meaningless scrolling". Every pinned stretch must reveal something or move a scene; keep pins short.
- Copy rule (David): plain lines a person would say out loud, no slogan cadence, no em dashes. An abstract line gets a concrete line under it. Never invent numbers.

## Frame

- Nav (Modus pill as the reference): logo; Nonprofits `/npo`, GENESIS `/genesis` (lands at the top), Students `/student/apply`, Contact (team@tethos.ca), Student portal (play.tethos.ca); one primary button; a marquee strip with the dates. Sheet menu on phones; breakpoint near 800px so the longest label fits. Fix the reference's weak spots: readable link contrast, and a tone switch over light sections.
- Seasonal nav button: while any role in the recruitment `positions` table is open, the student application ("Join"); otherwise from Aug 10 to Aug 31, "Apply for the program" (`/npo`); otherwise "Sponsor GENESIS" (`/genesis`).
- Glyph wipes at every dark/light seam.
- Footer (minimal, light ground): logo; Nonprofits, GENESIS, Contact; a small "Start a branch: team@tethos.ca"; Instagram @uwotsi, GitHub UWO-TSI; © Tethos Association.

## Home `/`

1. Hero (dark): "Most tech is built to make money. We build it for purpose." Under it: "Tethos is a student-run nonprofit. We build pro bono technology for nonprofits and the communities they serve." Three buttons: nonprofits, sponsors, students. The globe on the right.
2. Dive: the panel slides off, the globe takes the screen, the camera pushes in and twists, a circle opens from the centre into section 3 (contentarchitecture.dev's MainHeroStage math, see the flow note). Keep the pin short.
3. Mission and numbers (light): one statement naming TSI (Western and UBC). Numbers: $500K+ value created, 100+ student developers, 150+ members, 20+ projects, 2 chapters.
4. "Who are you?" (dark): three flat cards side by side: nonprofits `/npo`, sponsors `/genesis`, students `/student/apply`.
5. Dates (light): a rolling date pinned on the left, rows on the right (Terminal Industries steps scene as the reference): Aug 10 nonprofit applications open; Sep student hiring round 1 (project managers and VP roles); Sep round 2 (developers and directors, applicant portal opens with each round); Mar GENESIS; May leadership hiring for next year.
6. GENESIS (dark): the GENESIS hand (`GENESIS.jpg`, a hand holding a glowing orb) baked to a brightness grid and drawn as a glyph field in the letters of "GENESIS"; a numbered list of what sponsors get; link to `/genesis`.
7. Team (light): large club photos (the full-size team photo `DSC08218`, `flag_signing.webp`, picks from Drive GENESIS 2026 and Cotty '26), then a desktop window that rises in with a looping capture of Tethos Island.
8. Closing dive (dark): the globe returns, a disc opens with "build with us", linking to `/student/apply`.
9. Footer.

On hold: the project showcase (no pictures yet).

## `/npo`

1. Hero (dark): what the program is; apply button (form opens Aug 10).
2. Timeline (light): applications Aug 10 to 31, partners selected in September, kickoff in October, build October to March, demo at GENESIS in March, handoff in April. An 8-month program.
3. What you get (dark): numbered deliverables (production software, source code and docs, design files, training, a support window, an impact report).
4. Cost (light): a ticket reading "$0" with what's included.
5. FAQ (dark): ownership, time from their side (2 to 3 hours a week), eligibility, stacks, cost, after support.
6. Apply (light): a built-in form. Saves to a new table, shows in admin, syncs to a Google Sheet ("NPO applications", TSI 26/27 Drive folder). No email until tethos.ca is verified in Resend. Outside Aug 10 to 31 the form shows when it opens.

## `/genesis` (very dark, aura glow)

1. Hero: the GENESIS hand, "March", 2026 numbers: 260+ attendees, 7 project demos, 6 sponsors (the $12k raised stays private).
2. This year's projects: BGC (MAP Program App), ArkAid (Kitchen Dashboard), Grand Theatre (Carbon and Energy Dashboard), Brain Tumour Foundation of Canada (Walk Support Hub), Growing Chefs! (Dietary Restriction System), as rows with partner logos from `web/public/logos/partners/`. The documentary slots in when it's ready.
3. Where your sponsorship goes: sponsor, students, projects, nonprofits, GENESIS, with arrows and people.
4. "Fund technology that matters": the tier table (Catalyst, Platinum, Gold, Silver; no prices) and the package download. It should feel like the end.
5. "Thank you for making this happen": logos of Plan Catalyst, McGregor Allsop, Entrepreneurship at Western, uBit Foundation, Plaza Sushi, Frank and Furters.
6. Sponsor contact: Judy Gao (jgao537@uwo.ca) and Sierra Lin (slin542@uwo.ca).

## Later

The project showcase on home, the documentary, the new sponsor package (Judy's draft is in Drive), branch subdomains.
