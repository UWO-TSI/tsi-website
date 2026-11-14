# Pre-registration and the December 20 public opening

Brief for the coordinator. From David, 2026-11-14 (strategy session): the game opens to the public worldwide on **December 20, 2026**. Until then the title page is closed and becomes a pre-registration page. Marketing (daily clips on Instagram, X and TikTok) sends everyone to it.

David's words: "we are going to close off the game title page and make it a prereister page you can pre make account kinda thing and we keep emails, make pre registration on phone but make them play on laptop, and if they tri=y to login and play on phone it will tell users to play on laptop".

## What to build

### 1. The pre-registration page (replaces the title menu until opening)

- Same URL, play.tethos.ca. The title scene stays as the backdrop; the menu ("Let's Play", Settings, Exit) is replaced by the pre-registration panel.
- Must work well on a phone. Most visitors arrive from TikTok and Instagram in an in-app browser. Check the title scene's cost there; fall back to a still or a short loop if it is slow.
- The panel shows: the opening date with a real countdown to it, the pre-registration reward, a count of people registered, and the form.
- **The form:** birth year, then "Continue with Google" or email. One optional unchecked box: "Send me news about Tethos Island". Under the button: "By pre-registering you agree to the Terms and Privacy Policy" with links.
- **Age rule:** under 13 by birth year is turned away with a plain message and no account is made. Store only two flags, 13 or older and under 18. Don't store the year. Don't let a blocked visitor simply retry with another year in the same session.
- **After registering:** a confirmation screen with their reward locked in, the opening date, "we'll email you when it opens, play on a laptop or desktop", and share buttons. On a laptop, the same.
- It reuses the existing account system: a pre-registered account is a normal `public` profile with a pre-registration time, the news consent and the source it came from.
- Signed-in visitors who already registered see the confirmation screen, not the form.

### 2. Who can still get in before opening

- Club members (`membership = member`) and accounts on a tester list pass the gate and reach the game, for the member beta in early December and for recording clips.
- Everyone else sees the pre-registration page. Game routes redirect to it.

### 3. Phones after opening

- A public account that signs in on a phone sees one screen: play on a laptop or desktop, with a button that emails them the link. No companion for public accounts for now.
- Members keep the companion as it is.

### 4. The reward

- Granted once per account on first entry to the island, only to accounts with a pre-registration time before opening.
- The item is David's pick (pending). Proposed: a rod skin and a title that are never sold or given again.
- Honest scarcity only (row 326): the countdown is the real opening time and the reward really ends then.

### 5. Footer on the title screen

- Small links at the bottom of the pre-registration page and of the title screen after opening: Terms, Privacy, Contact (info@tethos.ca), "Tethos Association".
- Pages `/terms` and `/privacy` on the play host, plain readable text, from `specs/legal/terms.md` and `specs/legal/privacy.md` once David approves them. The gem shop links to the Terms too.

### 6. Source tracking

- Each platform's bio link carries a source (`?src=tt`, `ig`, `x`, and one per campaign later). Save it on the account at registration.
- Analytics events: page seen, form started, registered, by source. This needs the analytics lane's `game_events` migration applied first.

### 7. Opening day

- A switch (date-based, with a manual override) flips the page back to the title menu on December 20.
- One launch email to every pre-registered address: it's open, here is the link, open it on a laptop. Unsubscribe link in every email. Send in batches.

## Blockers before December 20 (not marketing work, but the launch fails without them)

- **Google sign-in is in Testing mode.** Public users can't sign in until the OAuth app is published (flagged since September).
- **tethos.ca is not verified in Resend.** No launch email until it is.
- **Load.** A shard holds 30 players on one realtime server. Decide the shard count and run a load test before opening.
- **Analytics** migration applied, so the first wave is measured.
- **Gem shop** only goes live with the Terms page up, the spending limit and the under-18 permission step in place, and the tackle shop's gem roll changed to coins (already flagged).
- **Moderation:** public chat with strangers needs the report flow checked end to end and someone reading reports during winter break.

## Friends clips

David: "playing with friends just use bots with real game handel for now". For recording, test accounts with real-looking island names stand in for friends. They are for capture only and never count toward the registered total.
