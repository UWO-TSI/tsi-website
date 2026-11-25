# Launch blockers for December 20: instructions

Each of these stops the public opening by itself. Owner in brackets.

## 1. Publish Google sign-in [David, about 15 minutes, then Google's review]

**Status (2026-11-14):** published. Project `claude-490322` (the client Supabase prod uses), app name Tethos Island, home, privacy and terms links on play.tethos.ca, authorized domains tethos.ca and the Supabase one, no extra scopes, status In production. `/terms` and `/privacy` are live. Still open (David): a sign-in test from a Google account that was never a test user; info@tethos.ca added as project Owner and set as the support email.

Today the OAuth app is in Testing mode: only listed test users can sign in, and sessions expire after 7 days.

1. Open console.cloud.google.com and pick the project that holds the Tethos sign-in client.
2. Go to Google Auth Platform (older consoles: APIs and Services, OAuth consent screen).
3. Branding: app name "Tethos Island", support email info@tethos.ca, home page https://play.tethos.ca, privacy policy https://play.tethos.ca/privacy, terms https://play.tethos.ca/terms, authorized domain tethos.ca. The two legal pages must be live first.
4. Data access: keep only `openid`, `email` and `profile`. These are non-sensitive, so no security review is needed.
5. Audience: press "Publish app" and confirm. Sign-in works for everyone right away.
6. If the console asks for brand verification (it does when a logo is set), submit it. It checks that tethos.ca is yours through Search Console and usually takes a few days. Do this by December 1. Until it passes, sign-in still works but shows no logo.
7. Check: sign in with a Google account that was never a test user, in a private window.

Note: the recruitment Sheets delivery uses the same Google project with Drive and Sheets scopes for David's own account. If publishing asks for verification of those scopes, move them to a separate internal OAuth client instead of verifying.

## 2. Verify tethos.ca in Resend [David for DNS, coordinator for the check]

**Status (2026-11-14):** tethos.ca **verified** in Resend (us-east-1). DNS live on both Namecheap nameservers: `resend._domainkey` TXT, `send` and `rsend` CNAMEs, root SPF `v=spf1 include:_spf.google.com ~all`, `_dmarc` (p=none, reports to info@tethos.ca), Workspace DKIM `google._domainkey`, and the MX typo fixed (alt3). Resend's receiving MX not added (it would take over info@tethos.ca). Coordinator checks: the production `RESEND_API_KEY` is a send-only key on the account that holds the verified domain (two sends from noreply@tethos.ca to Resend's test inbox accepted). Its stored value ends in a newline; harmless today, tidy it when the key is next rotated. **Paid tier on hold (David, 2026-11-19): "keep free for now, we will get pro when we get there".** Upgrade when email sign-ups near 100 a day. The coordinator watches the daily count and flags it at about 70.

**Supabase Auth now sends through Resend SMTP** (2026-11-14, David's yes via strat): smtp.resend.com:465, sender `Tethos <noreply@tethos.ca>`, auth email rate limit 30 an hour (was 2 on Supabase's mailer; previously no custom SMTP, so rollback is clearing the SMTP fields). Checked with a throwaway prod account: the recovery email was accepted, the account deleted and verified gone, no orphan profile. An inbox test went to David's Gmail and uwo Outlook; placement is his to report. Paid tier: moved up to before November 21 (David's yes via strat, 11-14), because in-app browser visitors can only sign up by emailed code. Resend Pro is $20 a month for 50,000 emails with no daily cap; David buys it in the Resend dashboard after confirming. Then raise the Supabase auth email limit from 30 to about 300 an hour. Watch: the free tier's 100 emails a day and the 30-an-hour auth limit will cap email pre-registrations if a post takes off after November 21; Google sign-in isn't limited. The finalround follow-up and `RECRUITMENT_EMAILS_ENABLED` stay off.

Without this no launch email, no "email me the link" on phones.

1. resend.com, Domains, Add domain. Enter `tethos.ca` (region: US East).
2. Resend shows three or four DNS records: an MX and a TXT (SPF) on the `send` subdomain, and a TXT (DKIM) on `resend._domainkey`. They sit on subdomains, so they don't touch the Google Workspace mail records for info@tethos.ca.
3. Namecheap, Domain List, tethos.ca, Advanced DNS. Add each record exactly as shown. In Namecheap the host is only the part before `.tethos.ca` (`send`, `resend._domainkey`).
4. Add a DMARC record if there is none: TXT, host `_dmarc`, value `v=DMARC1; p=none; rua=mailto:info@tethos.ca`.
5. Back in Resend press Verify. It usually passes within an hour.
6. Coordinator: set the from address to `Tethos Island <island@tethos.ca>` with reply-to info@tethos.ca, send a test to a Gmail and an Outlook address, and check both land in the inbox.
7. Start sending small real mail (registration confirmations) from late November so the domain has a sending history before the launch email. Send the launch email in batches, not one blast.
8. Check the Resend plan: the free tier caps at 100 emails a day. Move to the paid tier before launch day (money: David's call).

## 3. Load test and capacity [coordinator lane]

A shard holds 30 players on one Fly machine. Nobody knows what happens at 300.

1. Write a headless bot client that joins a shard, walks and fishes. No rendering, just the Colyseus protocol and the API calls a real player makes.
2. Ramp on staging or a preview: 30, 100, 300, 1,000 bots. Record for each step: join time, server tick time, memory, Supabase connection count and slow queries, API error rate.
3. Confirm new shards open automatically when one fills, and that friends and parties can land in the same shard.
4. Set Fly to scale: machine size and count from the test, and autostart on.
5. Supabase: check the connection pool and compute size against the 1,000 step; resize for launch week if needed (money: David's call).
6. Vercel: check the plan's limits for a traffic spike on the title page and API routes.
7. Add a queue or a "the island is full, try again in a minute" screen so overload fails politely.
8. Decide the number to plan for. Proposal: 500 at once, with headroom tested to 1,000.
9. Rerun the test the week of December 14 on the final build.

## 4. Moderation for public chat [coordinator lane, plus people]

1. Test the report flow end to end with two accounts: report a message, report a player, see it arrive, mute, remove.
2. Add a word filter on chat, island names, letters and guestbooks, and a rate limit on chat.
3. Reports go to a Discord channel or an email the mods actually watch.
4. Name the mods for December 20 to January 5 and a rota. At least two people besides David; ask Alice.
5. Write the one-page rule for mods: what gets a warning, a mute, a ban.
6. Mute and block for players themselves, so nobody has to wait on a mod.

## 5. Also required

- Analytics migration applied before the pre-registration page goes up.
- `/terms` and `/privacy` live before step 1 and before the gem shop. **Done 2026-11-14** (text in `web/content/legal/`).
- **Analytics migration: applied in prod 2026-11-14** (`20261113120000_game_events.sql`).
- Gem shop: under-18 permission step, tackle shop gem roll changed to coins. (No monthly spending limit: David, 2026-11-19, row 342.)
