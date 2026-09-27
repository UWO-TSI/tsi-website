# Water glints from real optics: questions and assumptions (game/water-glints, 2026-09-27)

Build notes for `specs/look-development.md` §7.4 (row 238). Each item states the assumption taken; none blocked the build.

1. **Where the weather threads in.** The brief said "the existing weather multipliers in `lookPreset.ts`"; they live in `islandLighting.ts` (`WEATHER_MOD`, applied by `withWeather`). Roughness and the sun's visibility on the water are threaded there. `lookPreset.ts` keeps its water gloss multiplier (glare and sparkle brightness) unchanged.

2. **The sun's apparent size.** No sun disc is drawn in the sky. The environment map paints a sun blob with a ~14° core (a 64×32 lighting canvas, blurred again by PMREM), which is a lighting stand-in, not a disc. Assumption: the water has its own `sunSize` = the sun disc's radius as the water mirrors it, 5°. A facet lights while the disc sits in its mirror direction, so the tolerance on the facet's normal is half that (2.5°). The old tight lobe had a ~2.3° half-width; 5° is what gives a handful to a few dozen sparkles in the band with the shipped point layout (the lit count scales with the tolerance squared and does not depend on roughness).

3. **Twinkle speed with a fixed micro-tilt.** As specified, a facet's own tilt never changes; only the drawn waves (swell + ripple texture) turn it through alignment. Those move a facet's normal about 1-2° per second, so for a viewer standing still a sparkle lasts about 1.5 s (median, simulated over 10 s from the north beach at 16:00-17:00, 8-14 lit at once, 3-6 new ones a second); walking changes them much faster. Real glitter flashes in a tenth of a second because capillary ripples are fast. If David wants that, the physical addition is a short, fast capillary wave field (a function of world position and world time, still pure optics, same for every client): the simulation gives flashes of ~0.2 s with the same number lit. Not built, because the brief fixes the tilt; ask after he sees it.

4. **Rain, snow and fog remove the glare sheet too,** not only the sparkles: both are the sun's disc, which is behind cloud. The sky sheen at grazing angles (`fresnel`) stays.

5. **Wind:** roughness ×1.6 (Cox-Munk mean-square slope, a typical calm day vs the 30 km/h windy line), and the sheet's peak ÷1.6² (the same light spread wider). Each facet's own tilt is cut at 1.5 RMS so that no sparkle can reach a sun behind the camera even in wind (worst case 25.8° of tilt against the 29.1° needed at the bottom corner of the screen, portrait included).

6. **Point layout.** Same rule (2 per water cell, 1 per 5 units² of open sea to 90 units, none under the wharf, shuffled for the Light tier's half). The per-point random seed is gone (the tilt is hashed from world position instead), which shifts the LCG stream, so individual points sit in slightly different places than before.

7. **Bench.** `/lab/tune` has no sparkle sprites, so its sparkle rows are gone; it keeps `glare` and the new `roughness`. `sunGlint` and `sunSize` live in `islandLighting.ts` (and the look lab's water gloss scales brightness).

8. **Night.** The moon is the key light at night and the water mirrors it with the same physics; with the fixed moon behind the camera there is no moon lane (expected per the coordinator's row 239 note). The moon-ahead capture shows the model does produce one.

9. **What the evidence shows** (`specs/evidence/water-glints/`, north beach, follow camera): the shipped day sun and 11:00 give no sheet and no sparkles; 15:00 still nothing at this spot (the mirror point falls on the beach); 16:00 the sheet enters at the left edge; 17:00 a glitter band ahead-left with ~15 sparkles inside it; 18:00 a narrow lane to the horizon. Wind: the band spreads and dims to a faint sheen with sparkles scattered wider (physically right; if it reads too faint, the wind glare multiplier can stay above 1/1.6²). Rain: nothing. Night: nothing with the shipped moon; a faint lane with a moon ahead. FPS was not measured (SwiftShader); the only new per-frame cost is two ripple-texture reads per sparkle vertex.

10. **World clock.** `advanceWater`'s time becomes world seconds (up to 86 400). Every phase that meets `sin()` is wrapped to one turn and the ripple scroll is `fract`ed, so GPU fast-math `sin` stays accurate and the scroll stays smooth; checked in the lab at t = 86 000.

## Follow-ups
- Cloud-shadow dimming of the glare and sparkles at a point, once the world clock and cloud offset land (`lib/game/worldClock.ts`, other agent).
- Water time (`uTime`) still comes from `state.clock.elapsedTime` in `GridWorld`; the other agent's world-clock switch makes the waves, and so the sparkles, agree across clients.
- Optional Fresnel on the glare (a low sun reflects several times more than a high one); not added.
