# Evidence: audio pass (2026-09-26)

Screenshot (headed Chromium, `shots.mjs`, `/lab/island?time=day`, signed out,
seeded look to skip the character creator):
- `A1-settings-sheet-sound-section` — the new Sound section in the settings
  sheet: Mute, Master/Music/Ambience/Sound effects sliders at their defaults
  (70/55/60/80), reached via `Settings · text, contrast, keys` in the always-
  visible options panel. The bottom-right widget already reads "Audio" (not
  the pulsing enable-bell) because opening the panel was itself the first
  gesture — `AudioController`'s auto-unlock fired, confirming item 1 works
  end to end on the member island, not just in unit tests. The dev server
  log for this run also shows real requests for the new cascading candidates
  (`GET /audio/ambient/day-autumn.ogg 404`, `GET /assets/audio/music/18-autumn.mp3 404`,
  `GET /assets/audio/music/18.mp3 404`) — real Toronto time was ~18:xx and
  season was autumn when this ran, both resolved correctly before falling
  through to the existing tracks.

Playback timeline (`playback-timeline.ts`, run with `npx vite-node -c
vitest.config.ts ../specs/evidence/audio/playback-timeline.ts` from `web/`;
output saved as `playback-timeline.log`): the real `musicBlockAt`/
`buildMusicSrcList` from `web/lib/game/musicSchedule.ts` at ten forced
instants — midnight rollover (23:59 → 00:01 EST), the DST spring-forward
jump (01:59 EST → 03:01 EDT, confirming the block computation follows the
real clock across the skipped hour), a seasonal-variant request that falls
through block → fallback track, and the cafe/interior overrides. Matches
`musicSchedule.test.ts` and `audio.music.test.ts`, run separately as real
unit tests (`npx vitest run lib/game/musicSchedule.test.ts
lib/game/audio.music.test.ts` from `web/`).

Full existing + new suite: `npx vitest run lib/game/ lib/study/` from
`web/` — 76 files, 562 tests, all green (12 pre-existing `audio.test.ts`
tests updated only for the new `music` volume field, same assertions
otherwise). `npx tsc --noEmit -p tsconfig.json` — clean.
