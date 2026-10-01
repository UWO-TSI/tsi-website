# HUD frame and first login: questions for David

Spec: `hud-first-login.md`. None of these blocked the work; each lists the assumption that shipped on `game/polish-hud`.

## 1. What the top cluster shows
**Assumed:**
- Top right, left to right:
  - play coins as `🪙 1,240 TC`, always visible when signed in;
  - `Lv 7` with an XP bar;
  - a weather icon with the island time and date (`2:05 PM`, `Thu, Oct 1`, Toronto time);
  - mail with an unread badge;
  - sound;
  - settings.
- Gems are not in the cluster. No exchange rate appears anywhere.
- On a phone-sized window the buttons sit beside the title and the chips go on a second row.

**Open:**
- Is "TC" the coin's final name, and 🪙 its symbol?
- Should the cluster show the date at all?
- Should Gems show in the cluster?

## 2. Members' options
**Assumed:**
- The pixel filter ("Pixel finish"), Quality (Auto, Light, High) and Shadows are now in the in-game Settings sheet, under "Look and performance". Settings opens from the gear in the cluster.
- The old "View options" panel is gone for members.
- In development builds a wrench button opens what's left of it:
  - the Walk/Overview camera;
  - the time-of-day override;
  - Return to clearing;
  - frame timing.

**Open:**
- Should members get the Overview camera (the zoomed-out island view)? It's dev-only for now, and the minimap covers finding your way.
- Should members get a time-of-day override? It's dev-only for now; the island follows the real sun.

## 3. Old portal pieces on the island
**Assumed:**
- **Portal profile wizard:** skipped for the island. A new member goes straight to `/student/dashboard`, where the creator asks their island name. Portal pages (`/student/dashboard/bounty`, etc.) still send a member who hasn't finished onboarding to the wizard.
- **`QuestChecklist`:** hidden on the island, but still mounted, so its signals (tree shake, flower, fish) still tick its quests off.
- **Portal menu button:** hidden on the island.

**Open:**
- With the menu button hidden, nothing on the island links to the portal pages (bounties, jobs, directory, portal settings). Should Settings get a "Club portal" link, or should those pages be reached only from the companion and in-world objects?
- Retire the wizard entirely for game players, or keep it for the portal pages as now?

## 4. The HQ lead (resident roster, row 217)
**Proposed:**
- **Name and post:** Wren, HQ lead.
- **Look:**
  - TSI crewneck;
  - tan trousers;
  - brown boots;
  - a sage shoulder bag;
  - chestnut high ponytail with curtain bangs;
  - freckles.
- **Personality:** warm, organised, a little dramatic about paperwork.

The look is in `web/lib/game/welcome.ts` (`HQ_LEAD`).

**Greeting:**
1. "You made it! Welcome to Tethos Island, {name}. I'm Wren. I keep the clubhouse running, more or less."
2. "Everyone who joins gets a plot of their own out past the pier. Yours is waiting. We just need to make it official."
3. "Come up to the clubhouse and claim it. It's the big house at the top of the path. I'll have the paperwork ready!"

**Open:** Wren is a placeholder until your roster list lands (real first names and traits, fictionalised). After the greeting she waits on the wharf until you leave the village scene. Should she then stand at the clubhouse front desk? That's the interiors spec's keeper pattern.

## 5. First-login sequence
**Assumed:**
- **Who gets it:** a signed-in member who hasn't claimed their plot and hasn't been greeted on this device. That includes a hired applicant whose look carried over: they skip the creator but are still greeted.
- **Sequence:**
  1. The creator.
  2. A short dock fade onto the wharf. This stands in for the boat until `arrival-wharf.md`.
  3. Wren's three lines. E, Enter or Space goes on; Escape or Skip ends it (principle 7).
  4. The minimap and the chapter 1 objective slide in, with a chime.
  5. The daily gift.
- The creator now opens over the cream loading screen, so a new member dresses up while the island loads.
- In development, signed-out benches skip the greeting (so other agents' screenshots are unaffected). `?welcome=1` forces it.

**Open:** "Greeted" is remembered per device (localStorage). A member who starts on a second device before claiming the plot is greeted again. Fine, or should it go on the account?

## 6. Daily gift
**Assumed:**
- A cream card under the cluster on the first visit of the day, while today's gift is unclaimed. It uses the existing server claim: 10 coins, 20 on Fridays, once per Toronto day.
- "Open it": the box shakes, bursts into coins, and the coin chip counts the gift in.
- "Later": puts it off until tomorrow's first visit on this device.

**Open:**
- Principle 3 says never to reward online activity, and a daily login gift does. It already existed on the portal Wallet page, so I wired it in as asked. Keep it?
- If you put it off with "Later", there's no in-game way back to it today. Is the next day enough, or should the coin chip open the wallet with the gift button?

## 7. Smaller calls I made
**Toasts:**
- Toasts and the old dark action notes are now one cream lane, 132px above the bottom.
- The notes have emoji icons: ☕ cocoa, 🧺 picnic, 🔒 sealed gate, 🏠 new room, 🏡 plot claimed, 🏛️ donated, 🎉 chapter done.

**Doors:**
- Every door plays `enter.ogg` going in and `exit.ogg` coming out. Boat trips have no sound yet; that's arrival-wharf's.
- The fade now holds until the next scene has loaded and compiled, so a slow first entry stays dark instead of popping.

**Coins:** the coin chip re-reads the wallet after any game write (shop, study, deliveries, missions), in one read per burst.

**Loading:**
- The site-wide dark logo splash (`components/ui/LoadingScreen.tsx`) now skips `/student/dashboard`, as it already did for the applicant pages. The island shows one cream screen from the first byte.
- The track drifts and names the stage: "Rowing out", "Unpacking the village", "Lighting the lamps". drei's percentage restarts with each batch of assets, so a number ran backwards (92% → 0%).

**Narrow windows (phone size with a mouse):**
- The minimap moves up under the Journal button.
- The key hints keep to one scrolling line.
- The prompt and the toast lane own the bottom.

Real phones still go to the companion.

**The minimap** now fills the 180px column it shares with the objective. It was capped 32px narrower than the objective box.

**Ruins:** the E prompt and the toasts stack above the combat HUD instead of under it.

## 8. Found and not fixed
- **Loading-error card:** in two of about a dozen cold dev runs, the old "An island asset could not load" card came up after the world showed, then stayed. Failed-request logging on a later run caught nothing. It may be a dev-server hiccup under load; the card itself predates this work. If it shows in production, it needs the failing URL logged.
- **Applicant portal on a blank Supabase env:** `/student/apply/portal` throws without Supabase env (`createBrowserClient`), before and after this branch. I checked the applicant island with a dummy local URL and `?preview=1`; it plays as before (`12-applicant-island-check.webp`).
- **Island subtitle:** "A little space to make our own." shows in the ruins and inside the clubhouse too. That's copy for `menus.md`.
- **The creator's name bug** (a name typed and confirmed within 400ms is dropped) is still there. It's `menus.md`'s.
