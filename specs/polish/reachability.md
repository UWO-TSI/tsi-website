# Polish: reachability, resident talk and the companion

Audit: `audit-ui-flows.md` items 2, 6 and its spec C. Paths under `web/`. The standard is in `README.md`. The shop door is in `forage-craft-museum.md`, and the conversion-rate leak is already fixed (`4c3e5179`).

## Problems
- **Resident talk is absent.** The "!" bubble implies "click to talk" (`components/game/NPC.tsx:305`), but clicking only makes them hop (DIW:281). `NPCChatOverlay` is mounted nowhere. Row 123 asks for authored dialogue boxes.
- **No wallet in the game.** "Open wallet" (K) is listed in Settings but nothing listens (`lib/identity/settings.ts:10`).
- **Sign-in:**
  - `/student/login` is email and password only (row 224 says Google only) and ignores `?next=`.
  - In-game "Sign in…" messages have no link.
  - The phone's sign-in link loses its destination (companion question 7).
- **Companion:**
  - Emoji tab icons (🏳 for Club), system-ui font.
  - The embedded bounty page hardcodes white text, and its filter chips clip ("Cor", evidence `P-iphone-club-bounties`).
  - "Journal" opens the collection.
  - No coins, quests or settings.

## Deliverable, in order (a commit each)
1. **Talking to residents:**
   - Walk up and press E (or tap) to talk: the resident stops, turns, plays a talk clip with the painted mouth moving.
   - A cream dialogue box (the recruit kit's `NPCDialogue`) with their name, typed-out lines, a blip voice and a continue cue.
   - Lines are authored data per resident (row 123), editable by admins (principle 8). Propose two or three lines per resident in the questions file. No AI chat in this pass.
2. **A wallet sheet on K:** the TC balance, recent earnings and spends, the daily gift state. Never a conversion rate.
3. **Sign-in:**
   - Google sign-in on `/student/login` (row 224) and `?next=` honoured.
   - In-game "Sign in" messages link to it with the current place as `next`.
   - Keep email login only if the existing accounts need it; check the auth setup and say what you found.
4. **Companion:**
   - Real icons and the kit's font.
   - A coin chip.
   - Embedded pages readable on light backgrounds.
   - Scrollable filter chips.
   - Names matching the game (Journal, Collection, Bag).
   - A max height for the showcase sheet.

## Evidence
`specs/evidence/polish-reach/`: a resident conversation frame strip, the wallet sheet, the login page, the companion tabs on an iPhone-size viewport before and after.
