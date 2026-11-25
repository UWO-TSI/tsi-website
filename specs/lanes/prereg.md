# Lane: prereg (the pre-registration page until the December 20 opening)

Worktree `.claude/worktrees/prereg`, branch `game/prereg`, cut from `game/title-r2` (round 8) with `feat/game-default-island` merged in by the coordinator. Agent type `uwotsi-lane`. Dev port 3491.

## Why, and when

- The game opens to the public worldwide on **December 20, 2026**. Until then play.tethos.ca's title becomes a pre-registration page.
- Daily social posts start about **November 21**, and every one of them links here. **The page must be live by November 21**, so report for David's review by about November 18.
- The brief is `specs/launch/preregistration.md`, from David via his strategy session (2026-11-14). Read all of it: it is the spec. The blockers it lists are `specs/launch/blockers-dec20.md`.

David, verbatim: "we are going to close off the game title page and make it a prereister page you can pre make account kinda thing and we keep emails, make pre registration on phone but make them play on laptop, and if they tri=y to login and play on phone it will tell users to play on laptop".

## Ownership

- David tasked this change, so this lane owns the title page's menu area in `web/app/student/page.tsx` and any gate it needs in `web/middleware.ts` or `web/lib/hosts.ts`. Keep those edits small and say what you changed.
- The title-r2 lane owns `web/app/student/TitleSplash.tsx` and the title scene. Its round 9 redoes the splash.
  - Build the panel as its own component, mounted in place of the title menu ("Let's Play", Settings, Exit).
  - Leave TitleSplash and the scene's look alone, so the two branches merge cleanly.

## Build (the brief's sections 1 to 7)

1. **The panel**, phone first. Most visitors arrive from TikTok and Instagram in-app browsers. It shows:
   - the opening date with a real countdown;
   - the reward;
   - the registered count;
   - the form: birth year, then "Continue with Google" or email, one optional unchecked news box, and the Terms and Privacy line with links to `/terms` and `/privacy`, which are live.
   - Check the title scene's cost in an in-app browser on a phone. Fall back to a still or a short loop if it's slow.
2. **The age rule exactly as the brief says:**
   - under 13 is turned away and no account is made;
   - store only the two flags (13 or older, under 18), never the year;
   - no retry with another year in the same session.
3. **Accounts:**
   - a normal `public` profile plus the pre-registration time, the news consent and the source (`?src=`);
   - signed-in visitors who already registered see the confirmation screen.
   - **Email sign-in** uses Supabase Auth. Its built-in mailer allows only a few emails an hour; the coordinator switches Supabase to Resend's SMTP once David verifies tethos.ca. Build for that, and say exactly what the coordinator must set.
4. **The confirmation screen:**
   - the reward locked in;
   - the date;
   - "we'll email you when it opens, play on a laptop or desktop";
   - share buttons.
5. **The gate:**
   - members (`membership = member`) and a tester list pass to the game; everyone else gets the page;
   - game routes redirect to it.
   - The tester list is data (a flag or a table set by an admin), never emails in the repo.
   - Test accounts used for social clips never count toward the registered total.
6. **After opening:** a public account on a phone sees one "play on a laptop or desktop" screen with "email me the link" (Resend, once verified). Members keep the companion.
7. **The reward:**
   - granted once on first entry to the island, only to accounts pre-registered before opening;
   - coins, gems and a limited-edition rare rod.
   - Amounts and the rod are David's to set. Read the amounts from a config row the coordinator sets in prod, not the repo, and use a placeholder rod item until the rod is designed (it goes through the tool pipeline later).
   - Honest scarcity (row 326): the countdown is the real time, and the reward really ends then.
8. **The footer:** Terms, Privacy, Contact (info@tethos.ca) and "Tethos Association", on the page and on the title screen after opening.
9. **Source and analytics:**
   - save `?src=` at registration;
   - log page seen, form started and registered by source. The `game_events` table is applied in prod: `web/lib/analytics/`, `specs/analytics.md`.
   - Visitors who aren't signed in can't write `game_events` rows, so count anonymous page views and form starts in an aggregate-only way with no personal data, and say how.
10. **Opening day:** one switch, date-based with a manual override, flips back to the title menu. The opening time sits in one place; ask David the hour, and default to 12:00 ET.
11. **The launch email:** the batch sender and an unsubscribe link in every email are built and tested to a fake inbox, never sent.

## Rules

- **UI:** the flat kit only (rows 334 and 335, the design bible's UI chapter).
- **The pitch:** "free, in your browser, no download, play with friends". Never name another game on the page.
- **Privacy:** real names never show. The count is a number only.
- **Migrations:** one new migration, timestamped after the newest in `web/supabase/migrations/`, left unapplied (the coordinator applies it).
- Never touch production. No secrets in the repo.
- Headless only, never the Playwright MCP. Use the heavy and devserver locks.
- Ports: never 3000, 3300, 3301 or 3390.

## Evidence and gates

- **Evidence** (`specs/evidence/prereg/`), on a phone at 390 by 844 (also an in-app browser size) and on desktop:
  - the panel and the countdown;
  - the form, the under-13 refusal, Google and email;
  - the confirmation, and already registered;
  - a member passing the gate, and a game route redirecting;
  - the after-opening phone screen;
  - the footer.
  - Clips (mp4) for anything that moves.
- **Gates:**
  - tsc;
  - vitest (new world, once);
  - lint on touched files;
  - the SQL smoke chain with your migration;
  - perf on the title scene on a phone-sized run, if you change what it renders.

## Status

- Not started.

## Next

1. Read this file, `specs/launch/preregistration.md`, `specs/launch/blockers-dec20.md`, the design bible's UI chapter, `web/app/student/page.tsx`, then `CODEMAP.md`'s auth, title and analytics rows.
2. Build it.
3. Update this file, commit and report: what the coordinator must set (the Supabase SMTP, the config row, the tester list, the opening time), the migration, the evidence, and the questions for David.
