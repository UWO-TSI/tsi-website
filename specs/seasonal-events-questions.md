# seasonal-events: open questions for David


## 2026-09-29 (build agent, game/seasonal)

Built: the four events as seasonal club goals with an `event` on each goal (migration `20260929120000_seasonal_events`), the event layer on the island, the tourney board, rewards on completion and the editor fields. Evidence: `specs/evidence/seasonal/V-*.webp` (the spec said `evidence/events/`; the coordinator asked for `seasonal/`, kept the V- prefix). Each assumption below is what shipped; say the word and it changes.

1. **Tourney shape.** The tourney runs for the goal's whole window (seeded Sep 1 to Oct 1, Toronto). Two boards, fish and sea creatures (the roster categories that have sizes); biggest catch in cm wins, the earlier catch breaks a tie. "The week's winners" on the plaza trophy is read as the current leaders (the #1 of each board). Alternative: weekly rounds inside September, or one board per species.
2. **Tourney prizes.** None beyond the board and the trophy (principle 3). Privacy: the top half is named, everyone else sees only their own row and unnamed neighbours, and other members' ids never leave the server (entries are readable only by their owner).
3. **Decorations vs completion.** Decorations are up for the whole window whether or not the club fills the goal; completing it gives every active member the reward items once. Members who join after the completion don't get that year's items. Returning members who already own an item don't get a second copy next year (admins can pick new items per year).
4. **Rewards chosen** (all existing models, off sale, granted only): fall, Tourney cup (silver trophy); winter, Festive fir and Cocoa set; GENESIS, Showcase banner; spring, Flower crown (the crafted accessory) and Picnic blanket. Rewards are cosmetics only: the grant skips tools, recipe cards and merch even if an admin lists them. Should event items also be sold during their window (row 96's "market with limited-time cosmetics")?
5. **Limited-time catches.** Yellow Perch, Sturgeon and Giant Trevally: modelled fish that were in the reel pool but not the roster. They now bite only during the fall tourney and join the journal and aquarium (43 fish). OK, or different species / some for other events?
6. **GENESIS dates and posters.** Seeded Mar 20 to Mar 27 (2026's showcase was Mar 24); admins set the real week each year. Posters are text cards titled from the editor's "Project posters" list, empty until someone adds this year's projects, so the stage shows one "Project showcase" card. Which projects go up, and do you want real poster images instead?
7. **Winter window.** Dec 1 to Jan 1 at Toronto midnight. Because the season blend runs Dec 14 to 28, the first half of the festival has no snow yet. Run it into early January instead?
8. **Spring window.** Apr 1 to May 1.
9. **Cocoa.** A cocoa cart beside the café (it works while the café is still boarded up); E gives a line, no reward. The café interior isn't dressed.
10. **Assets (asks, not blockers).** The stage is the wooden bridge deck with banners and lamps; the picnic blanket is the blue beach towel. A real stage and a gingham blanket would read better if you have packs for them.
11. **Monument.** The plaza monument keeps showing the story goals; seasonal goals show on the notice board and journal only (and only while they run or once completed). No confetti ceremony for seasonal goals: the completion letter and the rewards.
12. **Catch trust.** Catches and sizes are still client-rolled (bounded by the hourly caps). If the tourney attracts forged sizes, server-issued catch tokens are the upgrade.

## Answered (David, 2026-09-30)

- **Q4, event items in the shop:** rewards only, not sold during the window. Kept as built.
- **Q7, winter window:** Dec 1 through Jan 7, New Year's week included. Seeded as Dec 1 00:00 to Jan 8 00:00 Toronto (the window's end is exclusive, like the others); the editor shows it as such for admins to retune. Tests and evidence moved with it (`V-06b` Jan 1 00:30 still up, `V-06d` Jan 7 23:30 up, `V-06e` Jan 8 00:30 down).
- **Fish follow their listed months** (hardening question 1): the server roll only draws in-season fish; the three limited-time fish follow the tourney's window instead of their "Sep" months, so an admin moving the tourney moves them too.

## Merge with server-rolled catches (2026-09-30)

`game/hardening` made catches server-authoritative. On top of it: the limited-time fish are only in the server's roll while their event runs (and with no club goals at all they stay shut), and the tourney entry is written by the server's land step (`seasonal_land` wraps `collections_land` in one transaction; a limited-time fish landed after its window closes lands nothing). Nothing the client reports reaches the board. Only reeled catches enter the tourney; hand-gathered shore crabs don't (it's a fishing tourney). Species outside the roster land with no size, so they can't enter either, same as the weekly trophy case.
