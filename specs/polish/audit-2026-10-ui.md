# Polish audit: interiors and UI surfaces (2026-10-07, partial)

Read-only audit of main `e6964304` against `specs/polish/README.md` and `specs/polish/gui-sheet.md`.

**How far it got.** David paused all browsers at 12:05 (lock `coordinator-pause`) before this audit got the browser lock: other audits held it from 10:44 onward. So no new screenshots were taken. This list comes from two sources:
- a code read of every surface named in the brief;
- the merged passes' own evidence from 2026-10-03. The crops in `specs/evidence/audit-2026-10/ui/` are taken from those images, not from a new run. The files behind each cropped item haven't changed on main since then (checked with `git log`).

The browser half is queued below. Its capture script is `specs/evidence/audit-2026-10/ui/shoot.cjs`.

**Settled items not raised again:**
- the 37 gui-sheet questions;
- the interiors questions (painted windows, no windows in the house, sounds);
- the HUD calls;
- rows 264–299;
- the shop counter, museum donation and HQ trophy case, which are another pass's.

**Already fixed, so not raised:** these were checked and are clean on main:
- emoji in toasts and the emote menu;
- the rune overlay's dark glass (overridden at `DefaultIslandWorld.module.css:423`);
- the Plex Mono and 10–11 px text in the combat HUD, the mission board and the path sheet (overridden at `:399–431`);
- the creator's 400 ms name drop;
- the portal pages' forever spinners (portfolio, mentorship, quests, kanban, marketplace, calendar and jobs all have loading, signed-out and error states now).

## Ranked punch list

### 1. The Collection (B) is the one sheet still outside the GUI sheet (M)
- **What I saw.** On the phone companion, Me → Collection opens as a centred card over a grey blurred scrim. The Bag, Mailbox and Showcase all rise as bottom sheets. In the game it is the only menu that:
  - snaps shut instead of scaling out;
  - has its own header, close button and focus-ring colour.

  Its header copy also has two problems:
  - It says "0 in your bag": that's the Bag's word, and the naming pass made Collection mean catches.
  - Signed out, it says "Showing this browser's collection: your account's copy didn't load." That reads as an error to someone who simply isn't signed in.
- **Screenshot.** `specs/evidence/audit-2026-10/ui/01-collection-not-a-bottom-sheet.webp`: Bag, Collection and Mailbox at 390 × 844.
- **Cause.**
  - `components/game/CollectionBook.tsx:50-52` mounts only while open (`open ? <OpenCollectionBook/> : null`), so there's no close motion.
  - `:103-160` hand-builds the overlay: an inline `backdropFilter: blur(3px)` scrim, inline `--app-*` styles, its own `<header>` and close `<button>`, and its own `:focus-visible` colour.
  - `:164` and `:166` hold the copy.
- **Smallest fix.**
  - Wrap the body in `<Sheet open onClose keys title="Collection" size="md">` from `components/gui`, like `BagSheet` (`Bag.tsx:99`). The motion, bottom-sheet layout, Escape, focus and opening key then come from the shared frame. Keep the body and the `collectionScope` path, so the applicant island looks unchanged.
  - Change the copy: "· {total} caught", and for a 401 use `SignInText` with "Sign in to keep your collection on your account".
- **Size.** M.

### 2. The Bag and the storage chest spin forever on a server error (S)
- **What I saw (code).** If `/api/collections/bag` answers 500, 502 or 429, nothing is stored. The Bag stays on "Opening your bag…" and the chest on "Opening the chest…", with no error and no retry.
- **Screenshot.** Queued (Q3).
- **Cause.** `lib/game/bagStore.ts:76-80` sets a view only for `ok`, 401, 503 and 404, or for a network throw. Any other status falls through. `Bag.tsx:116` and `ChestSheet.tsx:68` render `<Loading>` while `view` is null.
- **Smallest fix.** Add an `error` field to the store and set it for any other status. Render `<ErrorNote onRetry={loadBag}>Your bag didn't load.</ErrorNote>` in `Pockets` and in the chest.
- **Size.** S.

### 3. Keepers and residents show their name twice while they talk (S)
- **What I saw.** When Wren, Sable, Odile or Toren speaks:
  - the bubble carries a coral name tag;
  - the nameplate ("Wren / HQ lead") stays up directly under the bubble, over the keeper's head.

  So the same name appears twice, stacked, and the plate covers the face.
- **Screenshot.** `specs/evidence/audit-2026-10/ui/02-keeper-name-twice.webp`. Odile at +3.70 s shows the plate alone once the bubble goes, which is the right state.
- **Cause.**
  - `components/game/Keeper.tsx:109`: the plate bit is set by `near || bubble || engaged`.
  - `components/game/NPC.tsx:350`: the plate bit doesn't exclude `bubble`.
  - The bubble already prints `persona.display_name` (`Keeper.tsx:174`, `NPC.tsx:462`).
- **Smallest fix.** Drop the plate while the bubble is up: `(!bubble && (near || engaged) ? 4 : 0)` in Keeper. Add `!bubble` to the plate term in NPC.
- **Size.** S.

### 4. Four overlays vanish instead of closing (S)
- **What I saw (code).** "Transitions never pop", but these overlays unmount the frame they close in, so the Sheet's `usePresence` exit never runs:
  - Your path (P);
  - the closet and the fitting room;
  - the Oracle's family reveal card;
  - the daily gift card ("Thanks!" / "Later").
- **Screenshot.** Queued (Q2, close strips).
- **Cause.**
  - `DefaultIslandWorld.tsx:1105`: the wardrobe is mounted only for `closet` or `fitting`, and `WardrobeSheet.tsx:21` does `if (!open) return null`.
  - `DefaultIslandWorld.tsx:1109`: `sheet === "path" && pathView && <PathSheet>`. `IslandSheet` defaults `open = true`.
  - `DefaultIslandWorld.tsx:1111`: `reveal && … <FamilyReveal>`.
  - `DailyGift.tsx:58`: `return null` on `done`.
- **Smallest fix.**
  - Path: mount `PathSheet` always and pass `open={sheet === "path" && !!pathView}` through to `IslandSheet`.
  - Wardrobe: give it `open` and route it to the creator's root the same way.
  - Reveal and gift: keep them mounted for a `data-leaving` frame with the existing `talkOut`-style keyframe, or wrap them in `usePresence`.
- **Size.** S each.

### 5. Every room's subtitle is the village's (S)
- **What I saw (code, and visible under the titles in the interiors evidence).** The HQ, Oracle temple, museum, your house and the ruins all say "A little space to make our own." under their name. Only the café has its own line. The HUD pass logged this as menus.md copy, but it's still on main.
- **Screenshot.** Queued (Q1). In the existing evidence the line is covered by the evidence label.
- **Cause.** `DefaultIslandWorld.tsx:1018`.
- **Smallest fix.** Give each room its own line in the same ternary as the title (`:1017`), for example:
  - HQ: "The club's front desk. Notices, goals and your plot."
  - Temple: "Quiet. The crystal is listening."
  - Museum: "Everything the island has found."
  - House: "Yours to decorate."
  - Ruins: "Stay close to the light."

  David to OK the wording.
- **Size.** S.

### 6. Your house sits small in a black void (M)
- **What I saw.** The house is a 6 × 6 room shot with the camera built for the 12-cell HQ. It fills about 40 % of the frame, ringed by near-black. The other rooms fill the frame. At night the void merges with the room's own shadow.
- **Screenshot.** `specs/evidence/audit-2026-10/ui/03-house-small-in-void.webp`.
- **Cause.**
  - `components/game/home/HomeInterior.tsx:119` puts the camera at `(spawnX, 8.4, -8.3)`.
  - `interiorShared.tsx:66-74` follows at a fixed 8.4 up and 7.2 back for every room.
- **Smallest fix.** Pass a per-room camera distance into the walker: about 0.7 × for the 6 × 6 house. Give the house's backdrop the island's warm dusk tone, as the other rooms' backdrops do, instead of the clear colour.
- **Size.** M.

### 7. The Oracle keeper's portrait is a CSS circle (M)
- **What I saw (code).** The quiz sheet's keeper line shows Sable as a radial-gradient disc: a skin-coloured circle on purple. That is a primitive placeholder, which the README bars.
- **Screenshot.** Queued (Q2, the Oracle quiz).
- **Cause.**
  - `components/game/oracle/OracleQuizSheet.tsx:107` renders `<span className={styles.keeperFace}>`.
  - `DefaultIslandWorld.module.css:142` styles it.
- **Smallest fix.** Use a head-and-shoulders render of Sable's look: `/lab/icon` already renders item icons, and the same path can bake a portrait PNG. Or drop the face and lead with the Dialogue name tag, as the talk box does.
- **Size.** M.

### 8. Tools links to a "Coming soon" page (S)
- **What I saw (code).** The Tools hub lists "ASCII converter". The page is a banner plus an `Empty` titled "Coming soon".
- **Screenshot.** Queued (Q4).
- **Cause.**
  - `app/student/dashboard/tools/page.tsx:9-11` lists the tile.
  - `tools/ascii/page.tsx:51` is the placeholder.
- **Smallest fix.** Remove the tile until the tool exists, and leave the route in place.
- **Size.** S.

### 9. The leaderboard's Weekly and Monthly tabs are fake (S)
- **What I saw (code).** Both tabs show all-time totals with the note "Weekly and monthly totals are coming soon."
- **Screenshot.** Queued (Q4).
- **Cause.** `app/student/dashboard/leaderboard/page.tsx:13-14` defines the tabs and `:154-156` holds the note.
- **Smallest fix.** Drop the two tabs, and the note with them, until the periods exist.
- **Size.** S.

### 10. The study table's start card and timer bypass the kit (M)
- **What I saw (code).**
  - The seated "Start studying" card is a bare `role="dialog"` div. It has no focus move, no open or close motion, and isn't part of the dialog system. Escape does nothing while you're seated: the world rightly won't leave the room, but the card doesn't take it either.
  - The timer's buttons are the companion's raw `card.btn` and `card.ghost` classes, not the kit's `Button`.
- **Screenshot.** Queued (Q2, `?cafe=inside&study=setup` and `?study=focus`).
- **Cause.**
  - `components/game/study/StudyHud.tsx:104` is the start card.
  - `:117-121` is the timer.
  - `study.module.css:28-29` styles them.
- **Smallest fix.** Render the setup in `<Sheet modal={false} size="sm" title="Start studying" onClose={study.end}>`, which makes Escape mean "Leave seat". Swap the timer's buttons for `Button variant="secondary"` and `Button`.
- **Size.** M.

### 11. /student/election is the old terminal (M, David's call)
- **What I saw (code).** The member election page is the navy terminal look:
  - ASCII "TETHOS" art;
  - `$ tethos --election --init` boot lines;
  - `font-mono` everywhere.

  It's reachable by URL, and the middleware gates it.
- **Screenshot.** Queued (Q4).
- **Cause.** `app/student/election/page.tsx:14-36` (ASCII art and boot script) and `:184-260` (mono layout).
- **Smallest fix.** Retire the route if the W26 election is over (likely), or restyle it as a `Banner` plus `Card` ballot. This needs David: it isn't under `/student/dashboard/**`, so the GUI pass skipped it.
- **Size.** M (restyle) or S (retire).

### 12. The class gauges are 9–10 px system monospace (S)
- **What I saw (code).** The classes v2 gauge row uses 10 px text and 9 px keycaps in "IBM Plex Mono". next/font loads that face under a hashed family name, so the literal name falls back to Menlo. The rest of the combat HUD was moved to Nunito at 12 px, but this row wasn't.
- **Screenshot.** Queued (Q2, `?ruins=1` with `/lab/classes`).
- **Cause.** `components/game/combat/ClassGauges.module.css:2,4`.
- **Smallest fix.** Use `font: 800 var(--gui-text-xs) var(--gui-font)` for both. Behaviour is unchanged, as the gui-sheet rules require.
- **Size.** S.

### 13. The daily gift takes focus while you play (S, verify)
- **What I saw (code).** When the gift card appears it focuses "Open it" (`DailyGift.tsx:35`). It isn't modal (`aria-modal="false"`), so you keep moving. A Space pressed to jump may press the focused button and open the gift. Escape only works with focus inside the card.
- **Screenshot.** Queued (Q2, gift on arrival).
- **Cause.** `components/game/DailyGift.tsx:35,59-60`.
- **Smallest fix.** Don't auto-focus. Let E or a click open it, and Escape choose "Later" through `useWorldDialog(open, later, [], true)`, as the talk box does.
- **Size.** S.

### 14. The people counter is 11 px (S)
- **What I saw (code).** The count badge on the People button is 11 px, under the sheet's 12 px floor. It's the only HUD text that is.
- **Screenshot.** Queued (Q2; signed out, net is off so the button doesn't show).
- **Cause.** `components/game/net/net.module.css:49`.
- **Smallest fix.** Pass `badge={n}` to the `IconButton` (`NetHud.tsx:82`). The `badge` prop already renders the kit's `Counter` (`components/gui/index.tsx:81`). Drop the custom `.count`.
- **Size.** S.

### 15. Leaving a room holds about 2.5 s of plain black (verify)
- **What I saw.** The HQ Escape strip goes black at +0.69 s and the island appears at +3.26 s. For that time there's no stage line or spinner, just black. That was SwiftShader in dev, so a real GPU will be much shorter. The fade correctly waits for the island, but a long wait needs a sign of life.
- **Screenshot.** `specs/evidence/polish-interiors/14-transition-escape-hq.webp` (the interiors pass's own strip).
- **Cause.** `DefaultIslandWorld.module.css:74`, `.fade`: a flat `#14100c` with no content.
- **Smallest fix.** If the fade holds past about 600 ms, fade in the loading screen's track and stage text ("Lighting the lamps…") inside it.
- **Size.** S, once a real-GPU timing confirms it's needed.

### 16. The wharf shack is still flat planes (L, known)
- **What I saw.** This was already logged in the interiors questions (§7). It's lab-only (`/lab/interior?room=wharf`) and not reachable in the game. It's listed so it isn't forgotten.
- **Screenshot.** Queued (Q1).
- **Cause.** `components/game/WharfShackInterior.tsx`.
- **Smallest fix.** Build the shell with `art/interiors/build_interiors.py` and the café kit, as the other rooms were, once David says the shack ships.
- **Size.** L.

## Fix groups (no shared files)

| Group | Items | Files |
|---|---|---|
| **A: Dialog frames and close motion** | 1, 4, 5, 13 | `components/game/CollectionBook.tsx`, `components/game/DefaultIslandWorld.tsx`, `components/game/peaceful/WardrobeSheet.tsx`, `components/game/oracle/PathSheet.tsx`, `components/game/oracle/OracleSheetEmbed.tsx`, `components/game/DailyGift.tsx`, `components/game/DailyGift.module.css` |
| **B: Residents and rooms** | 3, 6, 7, 15 (16 if David says so) | `components/game/Keeper.tsx`, `components/game/NPC.tsx`, `components/game/home/HomeInterior.tsx`, `components/game/interiorShared.tsx`, `components/game/oracle/OracleQuizSheet.tsx`, `components/game/DefaultIslandWorld.module.css` (`.keeperFace`, `.fade`) |
| **C: Stores, study and HUD bits** | 2, 10, 12, 14 | `lib/game/bagStore.ts`, `components/game/Bag.tsx`, `components/game/ChestSheet.tsx`, `components/game/study/StudyHud.tsx`, `components/game/study/study.module.css`, `components/game/combat/ClassGauges.module.css`, `components/game/net/net.module.css`, `components/game/net/NetHud.tsx` |
| **D: Portal pages** | 8, 9, 11 | `app/student/dashboard/tools/page.tsx`, `app/student/dashboard/tools/ascii/page.tsx`, `app/student/dashboard/leaderboard/page.tsx`, `app/student/election/page.tsx` |

Group A owns `DefaultIslandWorld.tsx`. Group B owns `DefaultIslandWorld.module.css`.

## Queued for when the browser pause lifts

Run `specs/evidence/audit-2026-10/ui/shoot.cjs` (Playwright, `--mute-audio`, SwiftShader, 1280 × 720). It logs:
- console errors and failed requests per scene;
- an Escape test with a 60 ms close frame;
- the focus target and ring after Tab;
- a contrast scan (AA and the 12 px floor);
- an overflow scan.

It writes outside the repo. Convert the shots to WebP into this folder.

| Queue | Surfaces |
|---|---|
| Q1: Interiors | HQ, temple, house, café, museum (day and night), wharf shack (`/lab/interior?room=wharf`); scale, keepers, doors, the leave transition on a real GPU (item 15) |
| Q2: Game sheets | Bag, wallet, journal, collection, settings (every tab), letters, notice, chest, closet and fitting, Oracle quiz and path, missions, posters, showcase, café goal, tool wheel (hold Tab), emote menu, talk box (walk to a resident, E), creator (`?welcome=1`), study setup and timer, daily gift; each with Escape, Tab focus and a close strip |
| Q3: Failure states | Bag and chest with `/api/collections/bag` routed to 500 (item 2); letters, wallet and journal offline |
| Q4: Portal | Every `/student/dashboard/**` page signed out at 1280 × 720 and 390 × 844, plus `/student/election` |
| Q5: Phone | `/student/companion?mobile=1`, every tab, every Me tile, `/student/companion/study?demo=focus` and `?demo=setup`, the island at 390 wide with a mouse |

The people list can't be seen signed out: net is off, so the button never shows. It needs the local realtime server, or a check in `/lab/gui`.

## Evidence
`specs/evidence/audit-2026-10/ui/`:
- `01-collection-not-a-bottom-sheet.webp`;
- `02-keeper-name-twice.webp`;
- `03-house-small-in-void.webp`;
- `shoot.cjs`.

The three images are crops of `gui-sheet/08-companion.webp` and `polish-interiors/00-rooms-day-night.webp` and `07-keepers-greeting.webp`, all from 2026-10-03.
