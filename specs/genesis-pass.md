# GENESIS pass (genesis.tethos.ca)

A phone-first web app for GENESIS 2027, the March showcase. Started 2026-11-18 with David. This is the plan. The look comes
from David's design (not yet sent), so pages are built plain until then.

## Why

At GENESIS 2026 guests carried a paper passport and booths stamped it. People wanted to read up on the projects
afterwards and had nothing to go back to. The pass replaces the booklet with something they keep.

## What a guest does

1. **Taps a booth's sticker.** Each of the five booths hands out a sticker with an NFC tag inside. Tapping it with a phone
   opens that project's page on genesis.tethos.ca and stamps the project into the guest's pass, with the stamp shown landing.
   The sticker keeps working afterwards, so tapping it at home opens the project again.
2. **Gets a photobooth print.** The booth prints the photo on a receipt printer with a QR code. Scanning it with the phone's
   camera opens the photo in colour and saves it to the pass, ready to download or share.
3. **Opens their pass.** It holds the five stamps, their photos, the schedule and map, the vote, the sponsors, and a way to
   reach any team.
4. **Makes it theirs (optional, any time).** They pick a name (it goes on their pass card), optionally a character, and add
   an email or Google sign-in. From then on they can open the pass on any device, any time.

No sign-in is ever needed to tap, collect or vote at the event.

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
| `genesis.tethos.ca/` | The pass: card with the guest's name, 5 stamp slots, photos, links to the rest |
| `/p/<booth>` | A project page; opening it stamps the project (the sticker's link) |
| `/ph/<id>` | A photobooth photo; opening it saves the photo to the pass |
| `/schedule` | The run of show and the venue map |
| `/vote` | The people's choice vote: one per pass, open only during GENESIS |
| `/sponsors` | Who made GENESIS possible, with links |
| `/p/<booth>/contact` | Talk to a team: a message to the team, kept and emailed to them |
| `/me` | Name, optional character, sign-in (email or Google), sign out |
| `/booth` | The photobooth app (staff only) |

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

### Accounts: low friction, then their own
- **First visit.** It creates a Supabase anonymous user: a real account with no email. A first-party cookie carries the
  session, and stamps and photos are saved against that user on the server.
  - Saving only on the phone isn't enough: iPhone Safari wipes a site's stored data after 7 days without a visit, so a
    phone-only pass would be gone before most people look back.
- **Claiming.** Adds an email (a one-time code) or Google to the same user, plus a name and optional character.
- **Existing accounts.** The existing sign-up trigger already makes non-members `public`, tier 5: no event check-ins, no
  member features. A guest who signs in to an account they already have gets their guest stamps and photos moved into it.
- **Settings (David, Supabase dashboard):** turn on anonymous sign-ins, with a CAPTCHA (Cloudflare Turnstile) so nobody
  can farm accounts.
- **Character:** optional. If the account already has a play.tethos.ca character, the pass shows it. Otherwise the guest can
  skip it (open: whether to offer a small set of presets).

### Data (one new migration, applied to prod per `specs/launch-runbook.md`)
- **`genesis_stamps`:** user, booth, when. Unique per user and booth.
- **`genesis_photos`:** short id, storage path, taken at, who saved it.
- **`genesis_votes`:** user, booth. One per user.
- **`genesis_messages`:** the talk-to-a-team messages: user (or the email they gave), booth, message, when.
- **Storage:** a `genesis-photos` bucket.
- **Content in code:** the five projects, the schedule, the map and the sponsors live in `web/lib/genesis/*.ts` (they change
  rarely). Move them to tables only if the teams end up editing them in the admin.

### Talk to a team
- The message is saved and emailed to the team's contact through the club's existing mailer (Resend, as the sponsor form
  does).
- A guest without an account gives an email with the message.
- The team's email never shows on the page.

### Vote
- One vote per pass, counted on the server.
- Open during a window set in code; closed before and after.
- The tally is in the club admin, with an optional stage screen showing the live count.

### Admin (tethos.ca/admin)
- **GENESIS section in the club admin:** stamps per booth, photos taken and saved, the vote tally, team messages.
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

## NFC stickers
- **Tags:** NTAG213 (or 215) inside a printed sticker of David's design. One web address per booth, the same on every
  sticker for that booth. Written with an NFC writing app (NFC Tools), then locked so nobody can rewrite them.
- **Phone support:** iPhones from the XS on, and Android phones with NFC on, open the link with no app.
  - The phone has to be unlocked.
  - Older iPhones need the NFC reader from Control Center.
- **Fallback:** a small printed QR code and the short address on every sticker, for phones without NFC.
- **Quantity:** about attendance × 5. GENESIS 2026 drew 350+, so about 1,750 to 2,000 stickers.
- **Order by mid-February** (2 to 4 weeks lead time) and test a sample on iPhone and Android first.

## Build order
1. **Foundations:**
   - Host, layout, anonymous accounts, stamps.
   - The five project pages (drafted content).
   - A sticker test: encode a tag and tap it on an iPhone and an Android.
2. **The pass:** pass home with the stamps, claiming (name, email or Google, the merge), photo pages and saving.
3. **The booth:** the booth app, the receipt layout and dithering, a print test on the real printer, the offline queue.
4. **The rest:** schedule and map, vote, sponsors, talk to a team, the admin section.
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
- Supabase: anonymous sign-ins and Turnstile turned on.
- The play.tethos.ca session's OK on the host rewrite.
- The vote's window and whether results go on a stage screen.
