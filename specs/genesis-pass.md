# GENESIS pass (genesis.tethos.ca)

A phone-first web app for GENESIS 2027, the March showcase. Started 2026-11-18 with David. This is the plan. The look comes
from David's design (not yet sent), so pages are built plain until then.

## Why

At GENESIS 2026 guests carried a paper passport and booths stamped it. People wanted to read up on the projects
afterwards and had nothing to go back to. The pass replaces the booklet with something they keep.

## What a guest does (David, 2026-11-18)

1. **Front desk.** The guest taps the welcome sticker at the front desk with their phone. genesis.tethos.ca opens on a
   short setup:
   - their name, which goes on their pass card
   - an optional character
   - "save your pass" with an email or Google, now or later
   That's their pass. Each arrival tap also counts the guest in, which gives GENESIS a real attendance number.
2. **Booths.** Each of the five booths gives out its own sticker with an NFC tag. Tapping it opens that project's page and
   stamps it into the pass. The sticker keeps working afterwards, so tapping it at home opens the project again.
3. **Photobooth.** The booth prints the photo on a receipt printer with a QR code. Scanning it with the phone's camera opens
   the photo in colour and saves it to the pass, ready to download or share.
4. **The pass.** Holds the map, schedule, sponsors, the stamps and the photos. More content can be added (see below).
5. **Revisit.** The pass, the project pages and the photos stay up after GENESIS. A guest who saved their pass with an email
   or Google opens it on any device, any time.

No sign-in is needed to tap, collect or browse at the event. A guest who skips saving keeps the pass on that phone.

## The five projects (2026-27, from `web/lib/site/projects.ts`)

| Booth | Nonprofit | What the team built |
|---|---|---|
| bgc | Boys and Girls Club London | The MAP Program app: registration, each student's action plan, tutoring bookings, progress |
| ark-aid | Ark Aid Mission | A kitchen dashboard: meals produced, people served, ingredients, inventory, logging |
| grand-theatre | Grand Theatre | A carbon and energy dashboard that replaces an emissions spreadsheet |
| brain-tumour | Brain Tumour Foundation of Canada | A support hub for the Brain Tumour Walk: registration, donations, volunteers |
| growing-chefs | Growing Chefs! | A dietary restriction system: what a child can't eat and what to substitute |

Each project page has a description, the team, screenshots or a demo video, and a link to the product where it can be
shown. Claude drafts all five from what's known; David edits.

## Pages

| Address | What it is |
|---|---|
| `genesis.tethos.ca/start` | The front desk sticker's link: setup (name, optional character, save), counts the arrival |
| `genesis.tethos.ca/` | The pass: card with the guest's name, 5 stamp slots, photos, links to the rest |
| `/p/<booth>` | A project page; opening it stamps the project (the booth sticker's link) |
| `/ph/<id>` | A photobooth photo; opening it saves the photo to the pass |
| `/map` | The venue map, with the five booths, the photobooth and the front desk |
| `/schedule` | The run of show |
| `/sponsors` | Who made GENESIS possible, with links |
| `/me` | Name, optional character, save (email or Google), sign out |
| `/booth` | The photobooth app (staff only) |

**More content.** The pass home is a list of sections drawn from one config (`web/lib/genesis/sections.ts`), so a new page
(a vote, talk to a team, a feedback form, a sponsor offer) is one entry and one page. These four came up in planning and
wait for David's go:
- a people's choice vote, one per pass, open only during GENESIS
- talk to a team: a message kept and emailed to the team
- a feedback form
- a sponsor offer

## How it's built

### Where it runs
- **Same app, own host.** genesis.tethos.ca is served by the existing Next.js app (`web/`), the same way play.tethos.ca
  is: a host rewrite in `web/lib/hosts.ts` sends the subdomain to its own route group. That group has a light layout of its
  own, without the site's nav, grain, loader or globe, so phone loads stay small.
- **Why not a separate app:** the shared Supabase auth and the `.tethos.ca` cookie mean a claimed GENESIS account is the
  same account as play.tethos.ca with no extra work.
- **Coordination:** `lib/hosts.ts`, `middleware.ts` and `next.config.ts` belong to the play.tethos.ca session; the host
  rewrite needs their sign-off.
- **Setup:** add `genesis.tethos.ca` to the Vercel project and a CNAME in DNS.

### Short links
- **Stickers:** `https://genesis.tethos.ca/p/ark-aid` (under 40 characters) fits on the smallest NFC tags.
- **Photos:** `https://genesis.tethos.ca/ph/<10-character id>` keeps the printed QR code small and easy to scan.

### Accounts: low friction, then their own (safety review 2026-11-19)
- **A guest pass is not an account.** The front desk tap creates a pass row on the server and gives the phone a long
  random secret in an HttpOnly cookie that belongs to genesis.tethos.ca only. Every read and write goes through
  genesis.tethos.ca's own server routes, which check that secret.
  - A guest can never sign in to anything, reach play.tethos.ca, tethos.ca or the recruitment portal, or read any club data.
  - Nothing about a guest is known until they choose to save.
- **Why not Supabase anonymous sign-ins (the first plan).**
  - Turned on, they let anyone on the internet get a signed-in account with no email.
  - The audit on 2026-11-19 found that any signed-in account can read about 60 tables. Most is harmless game data, but it
    includes all marketplace orders, the internal kanban boards and comments, mentorship profiles and matches, bounty
    submissions, event attendance, job listings and portfolios. (Member emails are safe: column grants block them.)
  - With anonymous sign-ins on, reading all of that would take no email at all.
  - The pass design also avoids the venue Wi-Fi problem: there is no Supabase sign-up limit (30 an hour per IP) to hit at
    the front desk.
- **Saving the pass.**
  - "Save your pass" signs in with an email code or Google on genesis.tethos.ca. That creates (or finds) a normal Tethos
    account, a tier 5 `public` one, exactly what anyone signing up today gets.
  - The pass row is then linked to the account, so the guest can open it on any device.
  - The email sign-in is a code typed on the pass (`/me`), not a link: a link opens in the mail app's own browser,
    which doesn't hold the phone's pass. The sign-in emails carry the code under the link since 2026-11-19.
  - One pass per account (unique `user_id`). Saving on a second phone moves its stamps, arrival and name into the
    account's pass and deletes the phone's copy; that phone then reaches the pass through the sign-in.
  - Done 2026-11-19: `https://genesis.tethos.ca/**` added to the allowed return addresses (Google returns to `/auth`).
- **Name and character.** The name is set at the front desk and stored on the pass. The character is optional: if the saved
  account already has a play.tethos.ca character, the pass shows it.
- **Before GENESIS (a separate fix, game and portal side):** tighten the tables above to members (tier 4 or better) or to
  their own rows. The 291 public accounts that exist today can already read them, and the public game launch (2026-12-20)
  and GENESIS will add many more.
- **Pass secret hygiene.** The secret is never in a URL. The cookie is HttpOnly, Secure, SameSite=Lax, host-only. Losing the
  phone loses an unsaved pass, as with a paper booklet.

### Data (one new migration, applied to prod per `specs/launch-runbook.md`)
All GENESIS tables have RLS on with no policies: only genesis.tethos.ca's server routes (service role) touch them.
- **`genesis_passes`:** id, secret hash, name, character, linked user (null until saved), created at.
- **`genesis_arrivals`:** pass, when. The front desk tap: the attendance count.
- **`genesis_stamps`:** pass, booth, when. Unique per pass and booth.
- **`genesis_photos`:** short id, storage path, taken at, the passes that saved it.
- **`genesis_votes`** (if the vote is picked): user, booth. One per user.
- **`genesis_messages`** (if talk to a team is picked): the messages: user (or the email they gave), booth, message, when.
- **Storage:** a `genesis-photos` bucket.
- **Content in code:** the five projects, the schedule, the map, the sponsors and the pass sections live in `web/lib/genesis/*.ts` (they change
  rarely). Move them to tables only if the teams end up editing them in the admin.

### Registration stays on Luma (David, 2026-11-19)
- Guests keep signing up on Luma, which already handles RSVPs, capacity, waitlists, reminder emails and calendar invites.
  The pass doesn't rebuild any of it.
- **Before GENESIS:** the Luma guest list is exported as a CSV and loaded into the pass database.
- **Front desk:** the guest's email at setup is matched to their registration. The name fills in and the arrival is marked,
  which gives registered versus walk-in counts.
- **Luma Plus (about $59 to $69 a month):** adds webhooks for live registrations, and maybe check-in sync back to Luma. Nice
  to have, not needed.

### Talk to a team (if picked)
- The message is saved and emailed to the team's contact through the club's existing mailer (Resend, as the sponsor form
  does).
- A guest without an account gives an email with the message.
- The team's email never shows on the page.

### Vote (if picked)
- One vote per pass, counted on the server.
- Open during a window set in code; closed before and after.
- The tally is in the club admin, with an optional stage screen showing the live count.

### Admin (tethos.ca/admin)
- **GENESIS section in the club admin:** arrivals, stamps per booth, photos taken and saved, and the vote tally and team
  messages if those are picked.
- **Order:** builds on the club admin portal branch (`site/admin-portal`), which merges first.

## The photobooth (our own)
- **Hardware:** a laptop runs it, a webcam takes the photo, an iPad is the screen guests see, a receipt printer prints.
- **Booth app (`/booth`, staff only):** runs in Chrome on the laptop.
  - Webcam preview, a countdown and the capture.
  - Uploads the full-colour photo and gets its short id.
  - Prints the receipt.
- **iPad:** the laptop's second display through Sidecar, showing a guest-facing page with the preview and countdown. No
  extra code needed.
- **Receipt:**
  - The photo, dithered to black and white for the thermal print.
  - "GENESIS 2027", the QR code and a line: scan for the colour photo.
  - The print and the digital copy differ on purpose: the colour version is the reason to scan.
- **Printing:**
  - First choice: Chrome's print dialog to the receipt printer's macOS driver at 80 mm width.
  - Fallback: a small local helper sending ESC/POS straight to the printer.
  - Decided once the printer model is known.
- **Bad venue internet:** the photo id is made on the laptop, so the receipt prints straight away and the upload retries in
  the background. The QR code works as soon as the upload lands.

### Built (2026-11-20)
- `/booth`: staff only (T1 to T3, signed in on the laptop). Camera picker, mirrored preview, 3-2-1 countdown (Space or a
  click), the colour photo (1600 px JPEG, mirrored as the guest saw it) queued in IndexedDB and uploaded with retries
  every 5 s, so photos survive a dropped connection or a reload. "Full screen" for the iPad view.
- Receipt: 72 mm wide (80 mm paper), Floyd-Steinberg dithered photo, QR to `genesis.tethos.ca/ph/<id>`, the short link
  under it. Prints through Chrome's print dialog; run Chrome with `--kiosk-printing` to print straight to the default
  printer with no dialog. Checked headless with a fake camera; the real printer test waits on the model.
- `/staff`: staff only, live numbers (checked in, passes, saved, photos taken and opened, stamps per booth). Moves into
  the club admin once `site/admin-portal` merges.
- Luma: staff load the CSV export on `/staff` (`genesis_registrations`). A guest who saves with their Luma email is
  matched: the pass takes the registered name if it has none, and `/staff` shows registered and checked in.
- `/map`, `/schedule`, `/sponsors`: read `web/lib/genesis/event.ts`, empty until David sends the details, and say so.

## NFC stickers
- **Tags:** NTAG213 (or 215) inside a printed sticker of David's design. One web address per booth, the same on every
  sticker for that booth. Written with an NFC writing app (NFC Tools), then locked so nobody can rewrite them.
- **Phone support:** iPhones from the XS on, and Android phones with NFC on, open the link with no app.
  - The phone has to be unlocked.
  - Older iPhones need the NFC reader from Control Center.
- **Fallback:** a small printed QR code and the short address on every sticker, for phones without NFC.
- **Quantity:** about attendance × 5 for the booths, plus the front desk stickers. GENESIS 2026 drew 350+, so about
  1,750 to 2,000 booth stickers.
- **Order by mid-February** (2 to 4 weeks lead time) and test a sample on iPhone and Android first.

## Build order
1. **Foundations:**
   - Host, layout, guest passes, the front desk setup, stamps.
   - The five project pages (drafted content).
   - A sticker test: encode a tag and tap it on an iPhone and an Android.
2. **The pass:** pass home with the stamps, claiming (name, email or Google, the merge), photo pages and saving.
3. **The booth:** the booth app, the receipt layout and dithering, a print test on the real printer, the offline queue.
4. **The rest:** map, schedule, sponsors, the admin section (arrivals, stamps per booth, photos), then any extra content
   David picks.
5. **David's design** applied across all of it.
6. **Rehearsal:**
   - Real stickers, the real booth and printer.
   - Phones on the venue's Wi-Fi and on cellular.
   - About 400 guests tapping within an hour.

## Needed from David
- GENESIS 2027 date, venue, run of show, and a floor map.
- The design (Figma).
- Each team's contact email for messages, and the team's consent to show names on the project page.
- The receipt printer model.
- Sticker design and quantity.
- DNS: tethos.ca is at Namecheap: a `genesis` CNAME to `f46899e83441e7c5.vercel-dns-017.com` (the domain was added in Vercel
  on 2026-11-19).
- The Luma guest list CSV, the week of GENESIS.
- The host rewrite: David OK'd it on 2026-11-19.
- Which of the extra content to build (vote, talk to a team, feedback, sponsor offer).
