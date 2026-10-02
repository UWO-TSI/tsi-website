# Movement feel: questions for David (milestone 1)

Each question has the assumption I built on, so nothing waits on the answer. Play it in `/lab/move` (the Juice panel tunes or turns off every effect; Speed has slow motion) and in the village.

## 1. Sounds (the pack is the coordinator's to source; nothing generated)
Wired from the 10 existing files, re-pitched per ground with `playSFX(name, { rate, gain })`, under the Sound settings:

| Event | File (rate) today |
|---|---|
| Footstep: grass, soil | `footstep` (1, 0.92) |
| Footstep: sand, wet sand, snow | `footstep` (0.8, 0.72, 0.66): duller, lower |
| Footstep: stone and brick | `blip3` (the old brick tap) |
| Footstep: wood (bridges, decks) | `blip4` (the old bridge knock) |
| Jump, bunny-hop | `jump` (= `blip2`) |
| Land: tap / normal / heavy | `footstep` (1.2 quiet) / `footstep` (0.95) / `footstep` (0.7) + `exit` (1.5, quiet) as a thud |
| Dash | `blip4` (1; 1.2 in the air): the combat dodge shares it |
| Skid, bonk | `footstep` (0.85, 1) |
| Splash / respawn / mantle / glider open | `blip5` / `blip3` / `blip1` / `blip2` |

**Missing (to source):** soft grass steps (2–3 variants), sand steps, wet-sand steps, snow crunch, stone or brick tap, wooden plank knock, a light jump whoosh (cloth, no voice), landing thumps in three weights, a dash whoosh (ground) and an air whoosh, a soft wind chime for "dash ready", a skid scrape, a small splash and a bigger one, a leaf rustle for the glider opening, a hand grab for the mantle. Short mono one-shots at the manifest's -16 LUFS.

## 2. The dash cooldown readout (you asked for a proposal)
**Built:** "wind at the heels". While the dash recharges, a wisp of wind (the pack's swirl) circles the ankles, fainter at first and fuller as it fills; when the dash is back it lifts away in two little curls with a glint. Nothing shows while it is ready, and nothing while an air dash is spent: the wisp starts when you land. It is lit and drifts like the rest of the world's particles, and it is gone in 0.3 s at the default 0.5 s cooldown (the ruins' dodge cooldown is longer, so there it reads as a gauge).
**Alternatives if it doesn't read:** (a) a glint that runs along the shoes when it's back; (b) the old ring, but painted from the pack (the target marker style) at the feet. Juice panel "cooldown" 0 turns it off.

## 3. Afterimages
**Built:** two, pale and cool (no class colour), the pose you dashed from and one 0.07 s in, each gone in 0.18 s. Matte, not glowing. Should they take your class colour or the outfit's main colour instead?

## 4. Landing weights
**Built:** by the drop from the arc's top: under 0.45 u a tap (a few motes, a light squash), to 1.8 u normal (a low ring of dust along the ground; a short Land pose when slow), from 1.8 u heavy (a bigger ring, a rising plume, a 0.1 u camera dip, and the LandHeavy pose: one hand to the ground). A run off a cliff still rolls (the sim's rule), with the heavy ring and a dust trail. A plain jump on flat ground is "normal". Thresholds are in `lib/game/movement/juice.ts` (`LAND`).

## 5. The jump's anticipation
**Built:** visual only. The sim leaves the ground on the press (no input delay); the drawn body holds a crouch on the ground for 0.06 s and then springs after it, with a crouch-and-swing Jump clip. If it ever feels late, Juice "anticipation" scales it (0 = off). The bunny-hop chain skips the hold (it squashes and springs straight off the landing).

## 6. Built ground and footprints
**Built:** footsteps on stone, brick and wood throw nothing (only the sound), as the spec says; a landing or dash there raises a faint pale dust (half strength). Say if those should be silent too. Footprints on sand and snow are milestone 2.

## 7. The combat aim marker
**Built:** the pack's painted ring with three notches, cream, turning slowly and breathing. It stays unlit (a readout, readable at night in the ruins) while every movement particle is lit by the sun and sky. Should it be lit too?

## 8. Residents
The pack and the system take any avatar's events (multiplayer-forward); only your avatar throws them today. Should residents kick up footstep dust too (they already count foot contacts)? Assumed yes for milestone 2, quieter.

# Milestone 2: questions for David

## 9. The feet still slide at full speed (stride matching)
Measured on the rig: at normal speed a planted foot moves 0.64 u/s in the Walk clip, 2.12 in Run and 0.44 in the crouch walk. Walking is 7.4 u/s, so planting the feet would take about 23 steps a second, which reads as a blur.
**Built:** the cadence follows speed in proportion (down to a slow amble), walk, run and crouch-walk hand over on the same foot, and the run holds down to 1.15× walking pace so it never flickers between the two.
**Options:** keep it (assumed: the island's quick walk is the feel you tuned); slow the walk toward 4 to 5 u/s; or new walk and run clips with longer strides (the chibi's legs limit how long).

## 10. Footprints
**Built:** on sand and wet sand, for you and the residents, from each step; 7 s on sand, 11 in wet sand. Snow prints are the living village's (every walker, 14 s). Not from landings or slides (slides leave scuffs). Should landings print too?

## 11. Residents' dust
**Built:** residents' steps throw the ground's dust at 0.6 of yours, with no sound (a crowd of them would clatter).

## 12. Body lean and the head looking along the travel
From deliverable 4 ("a lean into acceleration and turns, and the head looks along the travel"): not in milestone 2's list, so not built. Want it next?

## 13. Sounds still missing (milestone 2)
A skid scrape, a splash in three sizes, a roll's soft thump, the glider's leaf rustle and a wind loop, a hand grab on a ledge. Wired meanwhile from the set: skid `footstep` 0.7 plus 1.15 quiet; mantle `blip1` plus `footstep` 1.3; splash `blip5` at 1.25, 1, 0.8 by size; roll `footstep` 0.8 and 0.9; glide set-down `footstep` 1.05.

## 14. The afterimage
**Fixed:** it no longer films over you dashing away from the camera. A held weapon or the leaf can still sit behind a fading afterimage for a tenth of a second (they are drawn with the world); say if you see it.
