# Polish: sound (waits for David's sound source)

Every area lacks sound. The whole SFX set is 10 files (`web/lib/game/audio.ts:69-80`, `web/public/audio/sfx/`):
- blip1–5, click, confirm, enter, exit, footstep.

Dialogue blips and the door sounds stand in for effects: the bobber plop, nibble, reel, the dash, the glide, splash, a missed fish, a fleeing bug. `MANIFEST.md` points to a `TreeShakeFX.tsx` that doesn't exist.

Ambience: four time-of-day loops (`audio.ts:61-67`). There are no weather or season beds, no interior room tone, no shore or river sound, and the outdoor loop keeps playing indoors. Music uses two applicant tracks whose licence is unverified (`lib/game/musicSchedule.ts:41`). `cafe.mp3` doesn't exist.

## The decision (David)
- **CC0 packs:** free; a consistent set picked to the cozy acoustic direction (row 112).
- **Generation per sound:** row 125's plan, using ElevenLabs or Higgsfield, which needs a paid plan.

Music stays his Suno tracks (rows 106, 112–113).

## Once decided
1. **One manifest** of every event the game needs, gathered from the questions files of combat, movement feel, fishing, foraging, interiors and the arrival. Each entry gets a prompt or source file, loudness and variation count.
2. **Normalise and wire them**, with variation (pitch and volume jitter, 2–4 takes for frequent sounds), per-surface footsteps, and positional sound for world sources.
3. **Ambience beds:** weather, season, interiors (HQ clock, Oracle candles, aquarium bubbles, café murmur), shore and river by distance.
4. **Mixing:** music ducks under dialogue and reveals; interiors cross-fade from outdoors.
5. **Licence check** on every track, written into the manifest.
