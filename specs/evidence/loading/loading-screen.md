# The new loading screen (step 5), for David's review

David, 2026-10-26: "logging in there should be a new improved prettier loading screen for after signing in".

**Shots:** `screen-sequence-1280.png` (1280 x 800 on a 12 Mbps line, Let's Play onward: top left at once, top right
after 5 s, then the island in, near the end), `screen-1920.png` (1920 x 1080, cropped to the middle).

**What it is**, all from the game's own pieces, nothing fetched:

- The cream kit: the GUI sheet's paper, grain, sage-teal, wood and Nunito (`styles/game-tokens.css`).
- **Our island on a sea chart:** the island map's own drawing (the minimap's plot of the real world: sand, grass,
  paths, the wharf, the landmarks), on a paper plate tilted a degree. Until the world's map is in (about a second) the
  plate holds the arrival's golden veil mist; it lifts as the island comes in.
- **Bram's boat rowing to the dock:** a small rowboat with two passengers rides a sea line toward the wharf post; its
  wake fills behind it. Where it is is the real progress, never backwards (`lib/game/loadProgress.ts`): the island's
  code running (10%), its world in (15%), the models and textures (55%, of at least the 336 a first load asks for), the
  warm-up frames while every shader compiles (20%). The percent sits under it.
- The stage line under the title as before: "Rowing out…", "Unpacking the village…", "Lighting the lamps…".
- The boat and its wake move with transforms, so they keep gliding on the compositor while the main thread is busy;
  reduced motion stills the bobbing and the transitions.

**Options for David** (not built): the chart could show the whole island's outline instead of the open village area
the minimap shows (it would reveal the parts not yet open); the passengers could be drawn from the player's own look
once it is known.
