# Decisions waiting on David (2026-10-03)

Consolidated from every `*questions*.md` file, with a recommended option each. Answered items move to the ledger (`specs/game-world-development-plan.md`).

## Blocking work now

**1. Where do game sounds come from?** The sound pass is queued on this. The whole effects set is 10 files, and the class kits alone want about 230 cues.
A) Generate every sound with Higgsfield (row 125's plan), CC0 only as fallback. B) Generate with ElevenLabs (needs its Pro plan). C) CC0 packs re-pitched (free, today's stand-ins). D) CC0 for footsteps and UI, generated sounds for class, ability, ambience and signature cues.
**Rec: D.** The class sheet says Higgsfield audio is already available, and CC0 covers plain foley for free.
Source: polish/README Waiting #1; classes/design-sheet §5 Q1; classes/wave0-questions #17.

**2. Which placeholder residents go live?** Production has only Toren and Mayor Eliza. The other keepers exist as proposals in code.
A) All 11 proposed now (Wren HQ lead, Toren, Odile, Bram, Sable, Pim, Rosa at the café, plus Eliza, Juniper, Marlo, Nell), swapped out when your list arrives. B) The 7 service posts now (Eliza stays); Juniper, Marlo and Nell wait. C) Nothing new until your list.
**Rec: B.** Posts must be staffed for services to work. Villagers are the slots meant to nod to real members (rows 121, 217). This includes your review of Rosa's look, Wren's greeting and 3 lines per resident.
Source: polish/living-village-questions §1; hud-first-login-questions §4; cafe-polish-questions §1; interiors-questions §1; polish/README Waiting #2.

**3. What are the two currencies called?** The HUD shows play coins as "TC" with a coin emoji. TC already means the Gem currency in the database and CLAUDE.md. The queued menus copy waits on this.
A) "Coins" and "Gems" with the painted icons, no "TC", no emoji. B) Keep "TC" for coins. C) You pick names.
**Rec: A.** It removes the clash and follows the no-emoji direction (row 281).
Source: polish/README Waiting #3; hud-first-login-questions §1; game-ui-questions #14; rows 14, 281.

**4. What happens to the old portal shops?** The sidebar has a Gem Shop page, and there is an unlinked Marketplace page, both beside the in-game Shop. The portal-bugs pass is fixing the Marketplace right now.
A) Retire both and keep merch only in the in-game Shop (move open orders first). B) Retire the sidebar Shop, keep the Marketplace for campus-pickup orders. C) Keep and fix all three.
**Rec: A.** Rows 47 and 186 already put merch redemption in the game shop, which leaves one surface to keep correct.
Source: cleanup-and-game-security-questions #4; polish/portal-bugs #1.

**5. Are the first rod, net and shovel free or sold?** Everyone already owns tier 1 free, yet the shop still lists the three at 100 coins.
A) Free for all, delete the three shop rows. B) Sell at 100 coins (rows 94, 127) and give none. C) Free rod, 100-coin net and shovel.
**Rec: A.** Row 155 says fishing, bugs and fruit work from the first minute, and the shop then starts at the mid rod (400).
Source: game-ui-questions #7.

**6. Does the character draw a fishing line and hold the fish up?** The fishing pass builds both behind flags.
A) Both. B) Line only. C) Hold-up only. D) Neither.
**Rec: A.** Row 279 already shows the rod in hand, so a line follows, and the hold-up is the cozy catch beat.
Source: polish/fishing.md deliverables 4-5; polish/README Waiting #5.

**7. How loud is the catch reveal?** The fishing spec wants a cozy card with no rays. The GUI sheet kept the gacha rays.
A) Cozy cream card for every catch. B) Rays and confetti for rare and above, plain card otherwise. C) Rays on every first catch (as built).
**Rec: B.** Row G1 wants gacha feel on rare finds, and row 196 wants a calm card for the rest.
Source: gui-sheet-questions #7; polish/fishing.md deliverable 5.

**8. Do fish shadows show in the water?** Rows 151 and 195 said no for v1, and the polish plan reopened it.
A) No shadows (leaping fish only). B) A shadow near the bobber only as the bite cue. C) Ambient shadows everywhere.
**Rec: A.** Row 195 wants no marked spots, and visible shadows are marked spots.
Source: polish/README Waiting #5; polish/audit-activities "Need David's call".

## Before the classes launch (Wave 5)

**9. How do new members earn XP before level 10?** Found while checking the code, so it is the highest-impact item here. Kills and missions are refused below level 10 (the ruins gate), and peaceful play pays no XP. The only source is in-person event check-ins, 2,000 XP each, about 6 events to level 10, and the QR check-in page isn't built yet. Most members, and all public accounts, would never reach the ruins.
A) Keep it: events only. B) Open the outskirts (zone 1) to everyone from the start, so kills and missions there carry you to level 10. Level 10, the Oracle and a subclass then gate only the inner temple, the guardian and the class kit. C) Small XP for chapters and first-time milestones, capped near level 5. D) A short scripted trial that grants the first levels.
**Rec: B.** Row 11 promises in-game grinding, row 29 keeps combat optional, and row 75 gives public accounts combat.
Source: phase1-staging-questions #4; combat-questions #1; combat-content-questions Part A #6.

**10. When does classes v2 go live relative to the world opening?** The backfill is already settled: existing members keep their subclass at mastery 1, get one free repick and a letter (sheet §1.11).
A) Open the world first and turn classes v2 on before anyone reaches level 10, so there is nothing to backfill. B) Hold the opening until classes v2 is on, after your playtest and the all-16 balance pass.
**Rec: A.** The ruins need level 10, so members never meet the old kits, and the world opens sooner.
Source: classes/wave0-questions #9; design-sheet §4 Wave 5; STATE.md.

**11. Should signature weapons wear out?** As built, every landed basic hit costs 1 durability. A tier-1 signature weapon has 90, and a broken one does half damage, abilities and ults included. A Marksman at full Focus (8 shots a second) wears a bow out in well under half a minute of hits.
A) Keep per-hit wear. B) Wear only when you are defeated (-10%, row 229), never per hit. C) No wear on signature weapons; common weapons still wear. D) Per-hit wear with about 10x the durability.
**Rec: B.** Row 229 names defeat as the cost, and per-hit wear punishes fast classes most.
Source: classes/warden-questions #25; combat-questions #4.

**12. Which class cosmetics go on sale?** 40 are seeded and inactive. Nameplate frames are drawn nowhere yet, and some Gem-priced "animated" skins are colour-only so far.
A) All 40 as priced in the sheet. B) Weapon skins and auras now; frames and animated Gem skins only once they show in game. C) Coin items first, Gem items later.
**Rec: B.** Gems are club currency, so nothing priced in Gems should ship unfinished.
Source: classes/warden-questions #27; vanguard-questions #23; ranger-questions #20; design-sheet §1.10.

**13. What do the guardian and the Elder Thorn Crab drop?** The guardian drops a 20% Epic or 4% Legendary signature weapon, at most once every 20 hours. That is about 5 or 25 daily kills on average. The crab's 8% chance at a generic tier-2 weapon is near useless now that signature weapons rule.
A) Keep as built. B) The crab drops a crab-themed cosmetic instead. C) B plus a bad-luck guarantee on the guardian after a set number of kills.
**Rec: C.** Unlucky players otherwise wait months for tier 5, and row 30 already likes guarantees.
Source: mobs-z1-questions #1; combat-content-questions Part A #2; design-sheet §1.5.

**14. Your locked numbers vs the balance band.** Mastery 20 comes out x1.30 over mastery 1 (the band says 1.2). The cause is the Illusionist's 4 clones and the Transmuter's 0.75 s shifts. The Juggernaut's 2%-of-max-HP hit kills the guardian in about 2.9 minutes (the band says 4 to 6).
A) Keep your numbers and widen the band (mastery 20 to x1.3, Juggernaut as boss killer). B) Trim the two kits' mastery scaling to x1.2, keep the 2%. C) Trim both (Juggernaut to 1%).
**Rec: A.** The sheet lets locked class sections override its systems rules, and mastery 20 is about 22 hours of play.
Source: classes/arcane-questions #22; vanguard-questions #6; design-sheet "Build overrides".

**15. Which flash-frame look for every ultimate?**
A) Ink silhouettes in the ult's colour (built). B) Inverted black and white. C) Plain white flash.
**Rec: A.** It reads as an anime impact frame and has no brightness spike, so Reduce flashing stays gentle.
Source: design-sheet §5 Q2; classes/wave0-questions #3.

**16. Approve the class icon style?** All 16 classes use hand-drawn icons on a cream disc, not the Higgsfield set the sheet planned.
A) Approve for all. B) Regenerate everything with Higgsfield. C) Keep class and passive icons, regenerate ability icons.
**Rec: A.** It's done, fits the cream kit and costs no generation.
Source: classes/arcane-questions #25; vanguard-questions #22; design-sheet art list.

**17. Should the Assassin's Vault and blinks put you behind the target for sure?** As built, the landing depends on dash travel, and enemies get a 0.45 to 0.8 s turn-around hold after a blink.
A) Keep. B) Snap you to the target's back, keep the holds. C) Snap and drop the holds.
**Rec: B.** Your design says "land at its back", and the holds keep the crit window readable.
Source: classes/vanguard-questions #10-11.

**18. Summoner taming: fixed order or your choice?** As built, there is one ritual circle in the outer wild's west, and beasts are tamed in the order owl, toad, serpent, rabbits.
A) Fixed order, one circle. B) Any order, one circle. C) Any order, several circles.
**Rec: B.** Players chase the beast they want, with no new places to build.
Source: classes/warden-questions #3.

## Before the member world opens

**19. Which old portal rewards still pay Gems or XP?** Finishing the onboarding wizard pays 100 Gems once to any signed-in account. The unlinked Quests page promises XP and Gems its route doesn't pay. Gems redeem for real merch.
A) No Gems from either: the wizard stays for profile info without a bonus, the Quests page is retired (chapter 1 already pays 100 coins). B) Wizard bonus for members only; Quests page retired. C) Leave both.
**Rec: A.** Row 14 says Gems come only from club contributions or admin grants, and row 259 already removes dead surfaces.
Source: polish/portal-bugs "Don't decide" #30; gui-sheet-questions #30; hud-first-login-questions §3.

**20. Which club tools can public accounts use?** 273 of 316 accounts are public. Today any signed-in account can browse the directory, request a mentor, post a job and submit a bounty.
A) Member-only: directory, mentorship, job posting, bounties; event RSVP and the game stay open. B) Same, and RSVP member-only too. C) Leave all open.
**Rec: A.** Row 75 says public game access grants no protected club data, and the directory is member profiles.
Source: launch-readiness-fixes-questions #7.

**21. What merch is really on the shelf?** The seeded placeholders are a TSI sticker pack at 150 Gems (100 in stock) and a TSI tote at 600 Gems (30). Redemption reserves stock and means campus pickup.
A) Hide the merch corner until an admin enters the real lineup and stock. B) Ship the two seeded items. C) You send the real list and prices now.
**Rec: A.** Gems are real value, so the corner shouldn't promise stock that doesn't exist.
Source: economy-questions #6; rows 47, 186.

**22. Approve the launch prices and payouts?** Beyond the anchors you set (rows 126, 127, 225), everything is a placeholder in admin tables. That covers shop and sell prices, 50 coins per event, chapter rewards 100 and 300, club-goal weights and caps, the 1,500-coin bigger pocket and 300-coin recipe cards.
A) Approve, retune after two weeks of real play. B) Review one price-and-payout sheet first. C) Hold the opening until reviewed.
**Rec: A.** Every number is an editable row, and real play beats guessing.
Source: economy-questions #6; progression-questions #2; polish-ownership-questions #3; game-ui-questions #23.

**23. Do hired applicants become members automatically?** Releasing an accepted verdict doesn't touch membership. A T1/T2 must press mark-member.
A) Auto-mark on release. B) Keep manual. C) Auto-mark exec roles only.
**Rec: A.** Otherwise every round leaves new execs on the public tier until someone remembers.
Source: launch-readiness-fixes-questions #3; admin-pass-questions #10.

**24. How do members reach the club portal from the island?** The menu button is hidden on the island, so bounties, jobs, directory and portal settings have no link.
A) Add a "Club portal" link in Settings; stations remain the main path. B) Only through HQ objects and the phone companion. C) Settings link plus the wizard re-offered once.
**Rec: A.** It's cheap, and a club member should never be unable to find bounties.
Source: hud-first-login-questions §3.

**25. Does the world open on v7 hair if your hair references aren't in?** The v8 branch holds a WIP hair pass you called ugly. It also holds finished hair accessories (not on sale yet) and a remodelled beanie and backpack.
A) Open on v7 hair; v8 hair and accessories ship later as one update. B) Open on v7 plus the remodelled beanie and backpack only. C) Hold the opening for the hair rework.
**Rec: A.** v7 is the hair you approved, and the accessories depend on the new hair.
Source: avatar-v8-questions #1, #8 (branch game/avatar-v8, not merged); STATE.md.

**26. What music plays at opening if the Suno tracks aren't in?** The fallback is two applicant-island tracks whose licence for game use is unverified.
A) Keep them. B) Ambience beds only until Suno. C) Keep them only after you confirm the licence.
**Rec: C.** Exposure is wider than on the applicant island. Fall back to B if you can't confirm.
Source: audio-pass-questions #1; rows 106, 114.

**27. Island-name rules and renaming.** Names are 3 to 16 characters, unique, with reserved words blocked, first name free, then one change per 30 days. Nothing lets you rename after the creator.
A) Keep the rules, add a "Your island name" row in Settings. B) Free renames. C) Lock names after the creator.
**Rec: A.** It matches row 222's unique names and fixes the dead end.
Source: oracle-questions #4; gui-sheet-questions #12.

**28. Which tier names do members and admins see?** Three sets exist in the code.
A) Founder / President / Lead / Member / Public. B) Admin / Exec / Member / General / Public. C) President / Executives / Members / General / Public.
**Rec: A.** It matches the CLAUDE.md roles and the member/public split.
Source: polish/portal-bugs #31; gui-sheet-questions #31.

## Look and feel, any time

**29. Sign off the GUI sheet look?** The agent kept sage as the main action colour, with the kit's teal for checks and name pills. It uses one Nunito face (row 124 said Plex Mono numerals) and the Oracle in lavender. It also wrote new portal strings for you to check.
A) Approve as built. B) Use the kit's teal for main actions. C) Keep Plex Mono for numerals.
**Rec: A.** Sage matches the island HUD, and cream text on teal fails contrast.
Source: gui-sheet-questions #1-4, #33-37.

**30. Where does the crosshair aim in the ruins?** Ground-targeted skills (totems, traps, fireballs) land only 2.5 to 4 units ahead.
A) Keep. B) Move the crosshair above screen centre. C) A combat camera that looks further ahead, with a smaller HUD.
**Rec: B.** It's cheap and keeps the cozy camera.
Source: camera-orbit-questions #5.

**31. Minimap: always on or on demand?** Row 158 says always on. The clean HUD starts it closed until M.
A) Always on, small. B) Appears when you enter an area, and on M. C) Closed until M (built).
**Rec: B.** It honors both rows.
Source: game-ui-questions #13; camera-orbit-questions #6; rows 158, 283.

**32. What do interior windows show?**
A) A painted outside view; the house has no windows (built). B) Painted view; the house gets a placeable window. C) The real island (a few ms a frame).
**Rec: B.** It's cheap and fits decorating (row 117).
Source: interiors-questions §2a, §2c.

**33. Should doors open?** Residents currently vanish at the door.
A) Doors stay shut. B) Doors swing open for residents and you (ACNH). C) Only at residents' homes.
**Rec: B.** It matches the "every small thing is a feature" standard (row 273).
Source: living-village-questions §2.5.

**34. Name on the café sign?** It reads "CAFÉ".
A) CAFÉ. B) "Rosa's". C) A Tethos-style name you pick.
**Rec: B**, once Rosa is approved (row 269 asks for a named owner).
Source: cafe-polish-questions §4.

**35. How many fish leap from the sea?** About one every few seconds somewhere on screen at the wharf.
A) Keep. B) Halve. C) Remove.
**Rec: B.** It's calmer and still lively.
Source: living-village-questions §3.4.

**36. How does the fishing tourney rank?** Biggest catch in cm wins, so the Whale Shark (800 cm) and Great White lead the board.
A) Biggest cm (built). B) Size relative to each species' maximum, like the weekly trophy case. C) A board per rarity.
**Rec: B.** It's fair to ordinary fish and consistent with the trophy case.
Source: crafting-questions #18; seasonal-events-questions #1.

**37. Should members get a time-of-day override or the overview camera?** Both are dev-only now.
A) Stay dev-only. B) Members get a private time preview. C) Both.
**Rec: A.** Everyone sees the same real sun (rows 238, 239).
Source: polish/README Waiting #3; hud-first-login-questions §2.

## Still pending from you (uploads and inputs)

| Pending | Unblocks |
|---|---|
| Hair game references (row 272), into references/characters/david/games (the folder doesn't exist yet) | The v8 hair rework, then one merge with hair accessories, the remodelled beanie and backpack, and their shop rows (item 25) |
| Founders' and honorary people's first names, traits and one quirk each (row 217) | The real roster, dialogue review, resident quest chains (row 92), quest-taught top-tier recipes, admin gift and quest editors (item 2) |
| Suno tracks: 12 hourly blocks, café, interiors, plus a ruins track (none planned today), and your Suno licence tier (rows 106, 112-114) | Real music; retires the unverified fallback (item 26) |
| Sunny-look screenshots (row 235); the look folder holds only its README | Per-reference tuning of the Open-air sun day look |
| The island painted in the map lab (rows 241, 246, 247), including lamps (row 163), villager houses, Bram's wharf home, a pond table | Night lamp pools, resident homes, size-dependent systems. Painter feel defaults (coast within half a cell of your squares, 17 degree slopes) change in one constant |
| Class playtest notes from the class picker | Wave 5 (items 10-14). Feel calls to check while playing: Elementalist 0.4 s combo wait, free staff click, glider in the ruins for the air-jump class, Marksman Focus ramp |
| GENESIS 2027 project list or poster images | The March stage posters (one placeholder card today) |
| Optional: four family sigils (oracle-questions #9; code-drawn today), a leaf reference for the glider, a stage and gingham blanket for events | Nicer Oracle banners, glider look, event dressing |
| Actions only you can do: the Supabase Pro payment step (Free plan has no backups); a Higgsfield plan or Gemini top-up for the 20 sky panoramas (row 157) and sound (item 1); read the Oracle's 64-question bank before launch (oracle-questions #1); join the smoke flows that need a T1/T2 session (runbook §6 flows 2 and 7) | Opening the world safely |

Already given: the café reference (row 270) and the face, hair and eye sheets (rows 190-192). Hands-on verdicts are also waiting on movement feel milestone 2, the slide lane, the orbit camera, the GUI sheet showroom and the world refinement look.

## Already settled (dropped)

- Daily login gift despite principle 3 (hud §6, economy #10): rows 200, 225.
- No daily study-coin cap; study pay rates (study #4): rows 126, 226.
- No level-10 family trial; chapter 4 reads the subclass choice (progression #4, hardening #8): row 207.
- Dawn and evening windows, year-round fireflies (island-core #1, #9, #11): rows 173, 188, 189.
- Island size, painting by you, terrain tools (island-core #3, island-painter, terrain-blending): rows 156, 174, 241, 246, 247, 262, 263.
- Fish in season, every reel fish on the roster, recipe drops 2/5/15% (hardening #1, #4; crafting #11, #13-17): rows 255, 258, 260, 261.
- Event items are rewards only; winter lights Dec 1 to Jan 7 (seasonal #4, #7): rows 256, 257.
- Hair join limit and accessory budget (avatar-v7 #1, #3): row 265. Matte hair, no gloss band (avatar-v7 #6, look-dev #11): rows 237, 264.
- Sun path, afternoon fill, optics-based sparkle, Neutral tone map (sun-path, water-glints, look-dev): rows 236-239, 253. Overcast is the fog and rain state: row 152. Pixel finish on by default with an off toggle: Confirmed direction.
- Slide keys, jump height, slide friction, momentum persists (movement-slide #1-2, #6): rows 274-276. Ruins dash bleeds momentum: design-sheet §1.1.
- Orbit camera, mouse-look, auto-follow, tilt band (camera-orbit #1-4, #7-13): rows 277, 278, 282.
- Tool wheel, held items, backpack 20 to 40 slots, chest (game-ui #1-6, #9-11, #23-38): rows 279-281. Fruit has no effect: principle 3.
- Selling happens at the shop, so the bag's sell-anywhere is a builder fix (game-ui #32): rows 91, 200.
- Café: 20 seats, ambient patrons, walk-only, named owner (cafe-polish #2, #3, #5): rows 269-271.
- Clean HUD shows coins, XP, clock, mail, with no Gems or date (hud §1): row 283. Pixel finish lives in Settings (hud §2): Confirmed direction.
- Shop gets a real interior, and keepers stay at their posts (README Waiting #4, interiors §1a): rows 26, 122; principle 2.
- Resident talk is authored text boxes; the old NPC chat overlay goes (gui-sheet #14): row 123. Admins dress residents (living-village §1d): principle 8.
- Portal Light/Dark toggle gone (gui-sheet #5): row 285.
- Oracle quiz, no trial, the 16-type map, 250 coins and 7 days to redo (oracle, class files): rows 19, 205-207, 287; design-sheet MBTI table.
- Kit shape, stat directions, ruins-only class movement, Priest drawing 60-150%, Z X C V and F, flash limiter, existing-member backfill, "start Wave 0 early": rows 286-294; design-sheet §1.2, §1.6, §1.11, §1.13 and locked sections. Cosmetic prices and the Gem rule: row 290, §1.10.
- Public accounts at T5, membership sort, W26 sign-ups stay members, invite rotation (phase1-staging #1-3, launch-readiness #1-2): rows 75, 224; done 2026-09-29.
- Study table lock, 5-minute grace, table chat (study #1-7): rows 73, 168-170.
- Hourly Suno music, per-sound SFX plan (audio-pass): rows 106, 112-114, 125. Sound settings per device: coordinator ruling.
- Combat starting numbers (XP curve, 6,000/h kill cap, defeat durability, energy regen, mission cooldowns) were coordinator-accepted and tune after the playtest (combat-questions #1-11).
- Everything else in the 53 files (about 790 numbered lines) is a built default, a coordinator-accepted detail or a fix, and none needs you.

Sources are under `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/restart-art-cohesion/specs/`. `avatar-v8-questions.md` is under `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/avatar-v8/specs/` because that branch is unmerged.

## Added 2026-10-03: from the portal-bugs pass

**38. The event editor's "XP reward" and "Gem reward" fields.** They claim to pay at check-in, but the triggers pay the global settings (2,000 XP and 50 coins for any in-person event). Paying Gems for attendance would also break principle 3.
A) Drop both fields; every in-person event pays the global amounts. B) Keep XP per event (the triggers read it), drop Gems. C) Keep both.
**Rec: B.** Bigger events can be worth more XP, and Gems stay contribution-only.

**39. A time window on check-in?** A photographed QR works at any time today.
A) The event's start minus 30 min to its end plus 2 h. B) No window. C) A window plus a code that rotates every few minutes on the door screen.
**Rec: A.** It's cheap, and it stops check-ins from home after the event.

**40. Public (T5) accounts at events.** Check-in refuses them, so they earn no XP or coins for attending. This ties into #9 and #20.
A) Keep members only. B) Public accounts check in for coins only. C) Same rewards for everyone.
**Rec: B.** It rewards showing up without opening club data.

## Added 2026-10-03: from the classes launch measurement (`specs/evidence/classes/K5-balance.md`, `specs/classes/launch-questions.md`)

**11, measured.** Per-hit wear halves all damage for the 12 swing and shot kits once a tier-1 weapon breaks: about 90 hits, roughly a minute into the sanctum. With no wear, their sanctum DPS rises 11–57%. Both live options (B: wear only on defeat; C: signature weapons never wear) remove per-hit wear, which the numbers say is the urgent part.

**41. The launch letter's copy.** It's drafted in `specs/classes/launch-questions.md`.
A) Send as drafted. B) Edit it first.
**Rec: A**, after you read it.

**42. The guardian's pace.** It falls in about 3.1 min at mastery 1, against a 4–6 min target.
A) Armour 4, health 3000, its hits ×0.75 (about 4.4 min at mastery 1, 3.8 at mastery 20, untuned kits). B) Keep it fast. C) Decide after your own playtest.
**Rec: A**, with your playtest as the check.

**43. Tanks and the army ults.**
A) Restate the tank rule as "mitigates the most", since tanks don't take the least damage. Keep the Necromancer's and Summoner's ults adding 20–25% (the band says 8–15%), because their armies are the fantasy. Widen the ult charge range to 0.75 so the Elementalist fills in about 61 s. B) Trim the army ults to the band. C) Leave all of it for the playtest.
**Rec: A.**

**44. Proposed tuning (waiting on your playtest notes, not merged).**
- Titan's slam, shockwave and fissure doubled (its ult adds about 12% instead of 6.5%).
- Guardian armour 10% → 30% at mastery 1 (45% at mastery 20), so it rarely falls.
- Druid Vine Snare 0.85 → 1.05 and Wild Ground 0.22 → 0.3.
- Illusionist ult charge 0.8 → 0.82, and the Joker's shatter 8 → 10.

A) Merge after your notes. B) Merge now. C) Drop it.
**Rec: A.**
