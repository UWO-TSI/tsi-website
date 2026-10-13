# v1 drop: "Arrival"

> Planned with David 2026-10-13. The first release members play. It is **mainly performance and art/aesthetics**: a calm, beautiful, smooth village with a real community.
> Read with:
> - `specs/lore.md` (story canon);
> - `specs/terrain-v2.md` (the world);
> - `specs/multiplayer.md` (presence and chat);
> - `specs/perf/budget.md` (budgets).

## The roadmap

| Drop | Focus |
|---|---|
| **v1 Arrival** | The village: community, calm games (fishing, foraging, bugs, museum, stargazing, bottles), the opening, UI/UX, art and performance |
| v2 | The café and study tables open. The mountain opens after the v1 rockslide cleanup, leading to the Oracle Temple |
| v3 | Combat: the classes and ruins (classes v2 is built behind its flag) |
| v4 | Personal islands: home island and visits |

## 1. Opening: the arrival (lore: "you wake almost drowning")
One continuous sequence after the title screen. It plays once on first login, and can be skipped after its first play.
1. **The water.** Black, then underwater light and a muffled heartbeat. You gasp at the surface. A weathered hand (the fisherman) grabs your wrist.
2. **Aboard.** You're slumped in the fisherman's boat and Root, the mascot sudo, watches you from the bow. **Everything is blurred and washed out**, because your memories are gone.
3. **The reflection is the creator.** You lean over the side. Your reflection ripples on the water, and "who am I?" is the creator. The water is the mirror: every choice you make sharpens the reflection, and the world's blur clears as you finish.
4. **The crossing.** Cinematic shots on the shared world clock and sky:
   - a wide drone shot of the island coming out of the veil mist;
   - a low shot over the bow with Root;
   - a close-up of your character, still dripping;
   - the wake behind the boat;
   - the village lights or the morning glow on the wharf, depending on real time.
5. **The wharf.** The fisherman helps you onto the dock and says his first line, and your first quest starts from him.

Rules:
- The player's substrate is never named.
- No codex dump: the lore arrives sideways.
- Every shot is skippable, and nothing pops (loads wait).
- The shots reuse the boat-trip system (`boatTrip`) and the title screen's staged-shot tools.

## 2. The world
- **Map:** the terrain v2 world. The village (main street, wharf entrance, plaza, resident houses) is open.
- **Natural barriers, no invisible walls and no UI signs:**
  - the north island's bridge isn't built (stacked planks, survey stakes);
  - the forest is too dense;
  - fallen stones and roots block the ruins;
  - a rockslide covers the mountain trail, and the community clears it (see 3).
- **Café:** built but closed. Its lights are warm, there's an "Opening soon" chalkboard, and Rosa sweeps out front. Study tables wait for v2.
- **Hidden until their drop:** the home island boat (v4), combat, ruins, classes and the tool-wheel weapons (v3).

## 3. Community
| Feature | Notes |
|---|---|
| Chat box and speech bubbles | The backend is live (world chat, filter, block, report). Build the UI |
| Name tags | Just the name: small, clean text with a soft shadow, no plate. A member dot. Shown only when close |
| Emote wheel | Hold a key or tap: wave, cheer, clap, sit, laugh, shrug, bow, sleep, plus the dances |
| Dances | 4–6 looping dance clips. Moving cancels |
| Group dance sync | 2+ dancers near each other snap to one shared beat (on the world clock) |
| People list and **friends** | Friends list, where your friends are on the island, join a friend's shard |
| Gifting | Hand a fish, flower or shell to a player, with a give-and-receive animation and a note |
| Postcards | Photo-mode snaps sent to a friend's mailbox |
| Photo mode | Hide the HUD, frames and filters, save and share (TSI socials) |
| Nightly campfire | A beach fire at real night where players and residents sit together |
| Rockslide cleanup | The v1 community goal. Everyone hauls rocks over about a week, with shared progress on the notice board. It opens the mountain and launches v2 |
| Fishing buddies | Fish near someone for a calm "good company" boost and a shared catch log |
| Kites | On windy days, kites on the beach riding the shared wind |
| Traditions calendar | What happens depends on the day and real traditions: kites on windy days, lanterns on festival nights, seasonal events. The calendar is admin-editable (principle 8) |

Later: interactive emotes (high-five, hug), campfire stories, lantern night, the café debates (v2).

## 4. Calm activities
- **Already in:** fishing, foraging, bugs, digging, the museum, crafting and the glider.
- **Message in a bottle.** Write a short note and throw it to sea; someone else finds it washed up later. It's filtered, reportable, and only readable after moderation rules pass.
- **Stargazing.** A grassy hilltop clearing with a blanket and an old brass telescope, open at real night only.
  - Lie down and the camera tilts up. Constellations named for the Keepers' questions fade in.
  - Several people can lie side by side.
  - Shooting stars fall at shared world-clock times, so everyone there sees the same one; it comes with a "make a wish" emote.
  - The telescope zooms on one star with a single Keeper line.

## 5. Lore in v1
- **The Keepers:** every resident orbits one question, and all their lines and routines grow from it (lore rule). The cast and the questions are set with David.
- **The fisherman** is the mentor who pulled you out. His question is David's call.
- **Root** rides the fisherman's boat and hangs around the wharf. There's no pet system yet.
- **The museum plaque** carries David's own note to members. **Only David writes it.**

## 6. UI/UX
- Clean and intuitive: the minimal HUD, contextual prompts, smooth sheet motion, onboarding that teaches by doing.
- Audit every screen on the v2 world at 1440×900, 1280×720 and phone size.
- Better interactions: hover and press feedback, focus, Escape, sounds once the source is picked.

## 7. Art and aesthetics
- Village main street art pass, lighting, weather and the sky dome on the v2 world.
- Characters: the rounder head with the flat face area, David's 21 recolorable hairs and 19 faces, the Li'l Lads creator.
- Matte everywhere (row 264), no primitive placeholders.

## 8. Performance (David: "mainly performance")
- **Target: school laptops.**
  - 60 FPS on any Apple-silicon Mac;
  - 30+ FPS on Lite for older Intel/Windows laptops with integrated graphics;
  - 24 players nearby.
- **Gates:** `specs/perf/budget.md` and `npm run perf:check` on every visual change, with the cost reported to David.
- **Known fixes** (`specs/perf/effects-cost.md`):
  - held items and weapons merged into one mesh each, with shadows only near the camera;
  - the fishing rig not mounted on other players until casts are networked;
  - the glider leaf as one mesh;
  - the v2 world's draws batched (697, 50% over the village);
  - the flowing grass thinned with distance on Lite.

## 9. Shipping v1
v1 ships when the checklist is green, with no fixed date (David).

Checklist:
- [ ] every section above built and seen in-game;
- [ ] perf targets met on an M1 and on an Intel laptop;
- [ ] two-account multiplayer test on a preview;
- [ ] moderation tools working;
- [ ] the plaque text from David;
- [ ] David plays it through;
- [ ] then open the member world in production.

## Open decisions (David)
- The museum plaque text.
- The fisherman's question and which alum he carries.
- The Keeper cast and their questions.
- The dance list and style.
- The traditions calendar's first list of days.
- The music and sound source (Suno and SFX).
- Whether v1 launches at a real TSI gathering.
