# Arrival, wharf and home pier: questions for David

Spec: `specs/polish/arrival-wharf.md`. Each question has the default that is built (or assumed); say if you want the other.

## 1. Sounds still missing
Only the existing files are wired: footsteps on the boards as you walk the pier, and a footstep as you land in the boat or back on the pier. Nothing else plays: no dialogue blip or door sound stands in for an effect. These are missing, with where each would play:

| Sound | When | Default source |
|---|---|---|
| Outboard motor | catches as the boat casts off, a low purr idling, opening up as it heads out, throttling back coming in | CC0 pack (row 125), or generated |
| Wind | over the sea while sailing, stronger with speed; under the veil | CC0 |
| Water lapping | against the hull and the piles at the wharf, positional | CC0 |
| Bow splash | each bow spray burst at speed | CC0 |
| Hull creak | stepping aboard and ashore (the boat dips) | CC0 |
| Hull bump | the boat meeting the fenders as it comes alongside | CC0 |
| Rope | the lines coming off the cleat and post, and going back over | CC0 |
| Horn | one short toot as the boat leaves (and maybe as it comes in) | CC0 |

**Default:** wait for your sound source decision (`specs/polish/sound.md`), then wire these in the sound pass.

## 2. Who skippers the boat?
**Built:** you ride alone on the bench facing the bow; the boat is the island's little ferry and runs itself. Sailing yourself waits (row 267).
**Option:** Bram, the proposed wharf keeper (row 217), at the tiller by the motor, once the resident roster is approved (he is in the dev fallback only).

## 3. The move target's look (row 273)
**Built:** the pack's painted ground marker (`marker` in `art/fx/build_pack.py`, the same one the combat aim uses), lit like the ground, lying on the slope, landing soft, breathing while you walk, pressing down when you arrive.
**Option:** a softer marker painted just for walking (a ring of round dabs round a dot), so walking and aiming don't share a mark.

## 4. Is the move target still reachable?
Yes: tap-to-walk is a touch screen's (tablets, and phones if they ever get the island) and the applicant island's desktop clicks. With mouse-look a desktop click never walks, so desktop members won't see it. **Default:** keep it.

## 5. How long the trip is
**Built:** about 8.5 s out (walk to the boat, step aboard, cast off, swing round, out to sea), the veil while the next island loads, about 7 s in (coming in, alongside, ashore, up the pier). One press (Space, Enter, E or Esc, or a tap) skips the rest under a quick veil.
**Option:** shorter after the first few trips.

## 6. What skips it
**Built:** Space, Enter, E, Esc, a tap on a touch screen, or the Skip pill. A mouse click on the island doesn't skip (it is how you take mouse-look). **Default:** keep.

## 7. The pier's height
**Built:** the deck rides a hand's width over the water, like a floating dock on its guide piles, because the walk height on the wharf is level 0, like the beach and the bridges (the water is 0.078 below every bank). **Option:** a higher deck with a step up from the sand, which means a deck height in the walk support (`lib/game/defaultIsland.ts`) and the bridges to match.

## 8. The boat
**Built:** the dump's small motor boat (`props/boat.glb`), its lantern lit at dusk and through the night (it glows; it casts no light). The flag carries the dump's logo; it streams down the wind and flutters.
**Options:** a warm light from the lantern onto the pier at night (one more point light); the Tethos mark painted on the flag.

## 9. Others' trips (multiplayer)
The trip is the traveller's state (`lib/game/boatTrip.ts`: who, from, to, leg, phase, when it began, where they stood, a skip), plain data. The boat's course, its wake and the rider's place are functions of the trip and the world clock, so any client draws the same boat with the traveller's own avatar aboard; only the traveller's client steps it on (a test round-trips it through JSON).
**Assumed for when Colyseus lands (`specs/multiplayer.md`; to settle with the client agent):**
- On the wire, one slow-state field on the player, `trip` (the trip as JSON, about 150 bytes): sent when it starts, when the in leg starts (the next island has loaded) and on a skip, and cleared when it is over. It is a protocol bump. While it is set, others draw the rider from it, not from the pose stream.
- The area changes under the veil: a traveller going home stays in `village` (and in others' views) until the boat has sailed out into the haze, then moves to `home` (private). Coming back, they enter `village` as the boat comes in from the sea. Others see the boat leave and dock; nobody sees the private side.
- M4's "Take the boat to Alex's island" is the same trip with a host on it (`to: "home"` and the host's uid). Every home island has its pier at HOME_PIER, so the course doesn't change.

## 10. The buoys
**Built:** two of the dump's buoys flank the boat's lane off the tip, bobbing on the swell. **Option:** none, or more of them with the buoy rope between.

## 11. The first login's arrival copy
**Built:** the veil's card says "Sailing in to Tethos Island" (seen only if the island was already up when the arrival starts; otherwise the loading screen covers it). The loading screen's "Rowing out…" line is the HUD pass's and predates the motor boat. **Default:** leave it.

## 12. Where `?home=1` starts
**Built:** a boat trip home ends at the pier's land end (HOME_DOCK). The dev start `?home=1` still uses HOME_SPAWN on the path just inland. **Default:** leave the dev start.
