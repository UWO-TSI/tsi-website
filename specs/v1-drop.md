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

## 1. Opening: the arrival (decided with David 2026-10-13)
One continuous sequence after the title screen. It plays once on first login and is skippable.
1. **Underwater, 4–6 s.** Black, then dim blue water with light shafts above, a muffled heartbeat and bubbles. You drift up and gasp at the surface. A weathered hand grabs your wrist: **Bram**, the wharf resident, becomes the fisherman Keeper (lore: the one who pulls you out).
2. **Aboard Bram's small wooden fishing boat** (the one moored at the wharf: one-person cabin, nets, lantern). The world is **heavily blurred and washed out**, because your memories are gone. No Root in v1; sudo pets come later.
3. **The reflection is the creator** (David's sketch: `references/ui/creator/2026-10-13-reflection-creator-sketch.png`).
   - Layout:
     - the left two-thirds is the scene: the boat's edge on a diagonal, the back of your head leaning over it, your reflection in the water below with natural ripples;
     - the options panel sits right of the scene;
     - the category rail runs down the far right edge;
     - a "Yes" pill sits on the water at the bottom.
   - The reflection is always clearly readable. Each change sends a ripple or wave across the water that rewrites that feature.
   - **Every choice sharpens the reflection and the world a little; fully clear on "Yes".**
   - Polish it with the GUI kit, reusing the Li'l Lads creator's panels and data, but keep the layout and the water reflection central.
4. **The crossing, about 25 s, always golden hour** (warm sunrise light and soft mist, whatever the real time). Five shots:
   - a wide drone shot of the island coming out of the veil mist;
   - a low bow shot;
   - a close-up of you, dripping;
   - the wake;
   - the wharf coming up.
   
   You step into real island time on the dock.
5. **The tutorial (approved).** Walk-along, learn by doing, minimal: players figure it out.
   - **No movement UI anywhere.** The controls list lives only in Settings, with rebinding.
   - If a player stalls for about 10 s, Bram says a gentle hint in a speech bubble.
   - The Tab wheel and the bag each get a one-time keycap glyph at the moment they're needed.
   - The steps:
     1. **Dock:** Bram helps you up. "Easy now. Walk with me." You follow him up the pier. If you stall: "Use W A S D to walk."
     2. **Crate** on the pier: you jump it. If you stall: "Space to hop over."
     3. **Fishing spot:** he hands you his old rod. "Try the water." The 'Tab' keycap pulses once. You open the wheel, pick the rod, cast and catch a fish.
     4. **Bag:** the fish flies in and 'B' pulses once. "Keep what you find. The museum likes fish." You open the bag once.
     5. **Main street:** you walk **physically to the front of each building** with Bram, and he says one line there:
        - Museum: "Bring them what you find."
        - Shop: "Sell, buy, trade a story."
        - HQ: "Notices, mail, club news."
        - Café: "Opening soon. Rosa's still sweeping."
     6. **Plaza:** "The island will show you the rest." Reward: Bram's old rod and a few coins.
   - The lines are drafts for David's review.
6. **Moves:**
   - At the start: walk, run, jump, crouch and slide, plus sit and the emote wheel.
   - **Dash (Q) and the glider are taught later by Keepers** through small quests.

Lore rules: the player's substrate is never named, there are no codex dumps, nothing pops (loads wait), and every shot is skippable. Shots reuse `boatTrip` and the title screen's staged-shot tools.

## 2. The world
- **Map:** the terrain v2 world. The village (main street, wharf entrance, plaza, resident houses) is open.
- **Natural barriers, no invisible walls and no UI signs:**
  - the north island's bridge isn't built (stacked planks, survey stakes);
  - the forest is too dense;
  - fallen stones and roots block the ruins;
  - a rockslide covers the mountain trail, and the community clears it (see 3).
- **Café:** built but closed. Its lights are warm, there's an "Opening soon" chalkboard, and Rosa sweeps out front. Study tables wait for v2.
- **Hidden until their drop:** the home island boat (v4), combat, ruins, classes and the tool-wheel weapons (v3).

## 3. Community (decided with David 2026-10-13)
**Name tags.** Shown only over other players and residents, within about 8 steps; your own name is hidden. Small clean text with a soft shadow, no plate. Members get a tiny dot, and residents use a warmer colour.

**Chat.**
- Enter (or a small chat icon on touch) opens a slim cream bar at bottom-left. Enter sends, Esc closes, and the world ignores your movement keys while you type.
- Messages show as a speech bubble over the speaker for about 6 s (visible within about 20 steps), plus the last 4–5 lines fading at bottom-left. Enter shows the full scrollable log.
- While a bubble shows, the speaker's mouth moves with small gestures and a little hop now and then. A "…" bubble shows while someone types.
- The backend (filter, mute, block, report) is live. The client must register the `line` message and keep `sys` refusals separate from restart notices.

**Emote wheel.**
- Hold G and release to pick. Tap G repeats the last emote. On phones it's an emote button. Rebindable.
- Main ring: wave, cheer, clap, laugh, sit, sleep, bow, shrug.
- The centre button flips the ring to the **8 dances**, all cozy and silly: happy bounce, little spin, shuffle, sway, wiggle, goofy flail, robot, sprinkler. Moving cancels a dance.

**Group dance sync.** 2+ dancers within about 6 steps snap to one shared beat on the world clock, each keeping their own move. Music-note particles rise and a soft beat plays nearby.

**Emotes that react to places:**
- sleep on the stargazing hill at night starts stargazing;
- sit at the campfire warms your hands, and people sit together in a ring;
- sit at the dock edge dangles your feet over the water;
- sleep on a bench is a nap with drifting z's;
- wave at the sea while Bram's boat is out and he waves back;
- cheer when someone nearby lands a rare fish and residents cheer too;
- bow to Odile at the museum and she bows back.

**The campfire dance (the signature community moment).**
- At the beach fire, which is lit every real night, dancing turns into **our own joyful "liberation" stomp dance** circling the fire, for up to 8 dancers.
- Each dancer adds a drum layer, up to 6 unique layers from CC0 drum loops, and **6 dancers play the full drum song**.
- Every dancer makes the fire bigger and brighter.
- No One Piece name or music (copyright); the energy is ours.

**Friends.**
- Add a friend by clicking a player nearby (a card with Add friend / Wave / Gift) or by **friend code**.
- Friends get their location on the island, **Join** (moves you into their shard), an online toast, and a friend marker by their name tag and on the minimap.
- A **shard** is one copy of the island, holding about 30–40 people. Join keeps friends in the same copy.

**Friend perks.** Rewards are cosmetic or coins, never XP.
- **Fishing together:** fishing within a few steps of a friend gives you both a slightly better rare chance and a shared catch log.
- **Friendship hearts:** fishing, dancing, stargazing and gifting together raise a friendship level. Milestones unlock cosmetics: matching bracelets, duo photo frames, a shared bench nameplate.
- **Shaking a tree together** gives you each an extra fruit.

**Gifting.**
- Walk up to someone, choose Gift, pick an item from your bag and add an optional note. You hold it out, they accept, and they play a thank-you animation. A declined or missed gift waits in their mailbox.
- Giftable: **clothes and cosmetics** (never Gem-priced items), **crafted items**, and **progression items** (exact list to confirm).
- About 10 gifts a day; coin value can't be moved.

**Postcards.** In photo mode, after a snap you can send it as a postcard to a friend's mailbox with a short message, or save it to your device to post anywhere.

**Still open in this section:** photo mode details, the rockslide cleanup, kites, traditions, the people list.

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

## 8b. Look references (David, 2026-10-13, `references/look/2026-10-13/`)
These are style targets: we rebuild the look in our own art and copy no assets.
- **Wharf** (`wharf-creatures-of-the-deep-ref.png`): wooden plank piers on posts with ropes and rails, lantern poles, small moored boats, turquoise water, white foam rings where the posts meet the water.
- **Water** (`water-foam-shallows-ref.png`): shallow water shows the sand beneath. It grades from sand to teal to deep blue as the land drops underwater, with soft white foam outlining every shore and rock, and sparkles.
- **Title** (`title-piece-by-piece-ref.png`): a lush, close, depth-of-field scene; the logo top-left; a cream menu card with a dashed border and a pill highlight on the selected item; a small input hint bottom-right.
- **Grass** (`grass-shader-ref.png`): wind; blade-card texture shapes; a colour gradient plus noise; bending under characters; trails; receiving lights and shadows; perspective correction from above; distance fading.

## 8c. The water and look pass (approved 2026-10-13; ref `water-clarity-palette-ref.png`)
1. **Depth water.** Colour comes from the water depth, taken from the known seabed height (no extra pass): sand-tinted teal over the shallows to deep navy. Shallows are see-through to the seabed, which gets sand, boulders, seagrass and coral-like plants (instanced).
2. **Foam and ripples.**
   - A shore foam band pulsing toward the beach.
   - Foam rings wherever something meets the water: posts, rocks, moored boats, wading players.
   - Ripple rings from fish jumps, bobbers, steps in the shallows and waterfalls.
3. **Surface.** Big slow swells, a fresnel sky reflection, optics-driven sparkles (row 238), horizon haze.
4. **Land to match.** The new grass (`grass-shader-ref.png`), chunky faceted rock props on coasts and cliff edges, a warmer key light with a cooler fill, AO in crevices, soft glow on foam and waterfalls.
5. **Glass water**, High only: a refraction wobble at about 0.3 ms.
6. **Decorative fish** glide in the shallows as scenery. They can't be caught and don't mark fishing spots.
7. **The pixel filter stays the default look** (David).

## 9. Shipping v1
**Launch: Halloween, Oct 31** (David, 2026-10-13: "Rush v1 for Halloween"). Halloween is the launch event, running Oct 25 to Nov 1. **New-world checkpoint Oct 24:** if the terrain v2 village isn't wired and smooth by then, launch on the current village and swap to the new world in November.

**Must ship Oct 31:**
- performance pass;
- the opening and tutorial;
- slim name tags and chat;
- the emote wheel, 8 dances and group sync;
- the campfire drum dance;
- friends, friend codes and join;
- photo mode, saving to device;
- the Halloween event (pumpkin lanterns, costume closet, trick-or-treat at resident doors, spooky fog nights);
- natural barriers, the café closed, the home island and combat hidden;
- moderation ready;
- Supabase Pro (David pays; done 2026-10-14);
- the member world opens.

**v1.1 (November):**
- gifting, postcards by mail, friendship hearts;
- friend perks for fishing and trees;
- stargazing, message in a bottle;
- the rockslide cleanup, kites;
- the other place-aware emotes;
- the Keeper questions rewrite and the museum plaque;
- Lunar New Year, exam calm.

**Also decided:**
- Giftable items: clothes and cosmetics (not Gem-priced), crafted items, tools, materials, recipe cards and quest items, with a daily limit.
- Photo mode: P key or a camera icon.
- The rockslide: carry rocks to a shared bar, celebrate when it fills, and open the trail at v2.
- Kites: a limited event item that appears in the emote bar while it's in your inventory. It can't be traded or sold; the shop sells it later.
- Bottles: one a day, found only on the beach or fished up.
- Stargazing: a hill by the village, with 8 constellations named for the Keepers' questions.

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
