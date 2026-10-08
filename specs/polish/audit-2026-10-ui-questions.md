# Questions from the UI audit fixes, group A (2026-10-08)

Fixes for `audit-2026-10-ui.md` items 1, 4, 5 and 13 (branch `game/ui-dialogs`). Each answer below is already in the build as the default; say the word and it changes.

## 1. The rooms' subtitles (item 5)
Each room had the village's "A little space to make our own." under its name. The defaults now (`web/lib/game/roomHeading.ts`):

| Place | Line |
|---|---|
| HQ | Where the club meets. Notices, missions and the trophy case. |
| Oracle temple | Quiet. The crystal is listening. |
| Museum | Everything the island has found. |
| Shop | Buy and sell at the counter. |
| Café | Warm drinks and quiet tables. Find a seat to study. (unchanged) |
| Your house | Yours to decorate. |
| The ruins | Stay close to the light. |
| Tethos Island, Your island | A little space to make our own. (unchanged; an island event still says "… is on.") |

OK these, or send your own?

## 2. The daily gift's keys (item 13)
The card no longer takes focus, so walking and jumping carry on while it shows. Defaults:
- **E opens it** while it's offered, and the "Open it" button shows an E keycap. While the card is up, E opens the gift instead of talking to whoever is in reach. The card shows once a day.
- **Escape is "Later"** (and closes it once opened). The Escape that only ends mouse-look doesn't count.
- Tab still reaches the buttons; Space and Enter work there as on any button.

Keep E, or open it by click only?

## 3. The applicant island's Collection
The applicant island keeps its own Collection card (recruitment is out of scope), but its count line now says "· N caught", not "in your bag", since both islands share the body. OK?
