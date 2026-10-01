# Polish: HUD frame and first login

Audit: `audit-ui-flows.md` items 2–4, 9–10, 12 and its spec A. Paths under `web/`; DIW = `components/game/DefaultIslandWorld.tsx`. The standard is in `README.md`.

## Problems
- **Overlap:**
  - Toasts (96px, `ToastHub.module.css:1`) sit on the E prompt (78–122px, DIW.css:44).
  - The portal menu button (`MemberDashboardShell.tsx:57`) covers the "Tethos Island" title.
  - The sound bell (`AudioController.tsx:38`) overlaps the options panel.
  - The mute button and the navy `QuestChecklist` bubble share the bottom-right corner.
- **Two notification systems:** the dark `actionNote` pill (DIW.css:91), whose timers are never cleared (DIW:563, 567, 571, 597), and the cream toasts.
- **Missing:**
  - no coin readout;
  - no XP display (level only, as 9px in the dark nameplate, `PlayerAvatar.tsx:420-434`);
  - no clock or weather;
  - no unread-mail badge, though `unreadLetters` arrives;
  - the minimap can't be reopened once closed, and "M to hide" ignores remaps (`MiniMap.tsx:61`).
- **"View options" is a dev tool shipped to members**, open on desktop: pixel filter, time override, "Return to clearing", "includes development overhead" (DIW:687-718).
- **The old portal `QuestChecklist`** (bounty, leaderboard, "riverbank") shows beside the chapter objective.
- **Loading:**
  - three different loading looks;
  - the world pops in while shaders compile (`WarmupProbe` is only used on the applicant island, `ApplicantWorld.tsx:88`);
  - door fades run on fixed timers (DIW:601-620) and the scene title swaps abruptly.
- **First login doesn't match row 211:**
  - The middleware sends new members to the dark portal profile wizard first (`lib/supabase/middleware.ts:120`).
  - Then the creator.
  - Then the default spawn, with no boat arrival and no HQ greeting.

  The daily gift exists only on the portal Wallet page (`EconomySheets.tsx:254-275`).
- **The forage/net prompt label** is read at render (DIW:723), so it likely goes stale from node to node.

## Deliverable, in order (a commit each)
1. **Corner layout.**
   - Hide the portal menu button on the island.
   - One toast lane above the prompt (`--game-toast-bottom: 132px`, as on the applicant island).
   - Fold `actionNote` into the toasts with icons.
   - Hide `QuestChecklist` on the island.
   - Move the sound bell and mute button out of the options panel's way.
   - Check every corner at 1440×900, 1280×720, a 760px-tall screen and a phone.
2. **A cream top cluster** in the UI kit:
   - coins (🪙 TC);
   - level with an XP bar that fills and pings on gain;
   - world clock and weather icon (from `worldClock`/`worldFx`);
   - a mail badge that opens the letters.

   Numbers count up, not jump. Never show a conversion rate.
3. **Minimap:** a button to reopen it; key labels from the bindings (`keyName`) everywhere on the HUD.
4. **Options:**
   - Move pixel filter, graphics and performance into the in-game Settings sheet.
   - Make the time override and "Return to clearing" dev-only.
   - Remove the "View options" panel for members.
5. **Loading and transitions:**
   - One cream "Preparing" screen that waits for `WarmupProbe` (shader warm-up) before revealing the world.
   - Door fades wait until the next scene is ready (drei `useProgress`), with the scene title cross-fading.
   - Enter and exit sounds on doors (`enter.ogg`/`exit.ogg` exist and never play).
6. **First login per row 211:**
   - Skip the portal profile wizard for game players (the creator asks for the name).
   - creator → arrival at the wharf → the HQ lead's greeting in a dialogue box (the recruit kit's `NPCDialogue`) → the chapter 1 objective appears.

   The boat arrival itself is `arrival-wharf.md`; until it lands, arrive with a short dock fade. Propose the HQ lead's name, look and lines in the questions file (resident roster, row 217).
7. **Daily gift:** a cream pop-up on the first visit of the day (the existing server claim), with a small reward animation and sound.
8. **Fix the stale forage/net prompt label** (DIW:723).

## Evidence
`specs/evidence/polish-hud/`:
- every corner at the four sizes, before and after;
- the top cluster;
- the loading screen;
- the first-login sequence as a frame strip;
- the daily gift.
