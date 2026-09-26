# Audio pass

Owner: one agent. Decisions: rows 106, 112–114 (ACNH-style acoustic, 12 two-hour blocks, Suno tracks from David), 125 (generated SFX), 169 (study chime), 99 (seasonal), 84 (real time).

1. Sound on: `AudioManager.enable()` on the first user gesture on the member island, interiors, the ruins and the study companion; a Sound section in the settings sheet (master, music, ambience, SFX volumes, mute), persisted with the existing settings store.
2. Hourly music player: 12 blocks keyed to real Toronto time (02–04, 04–06, … ), seasonal variant slot, crossfade at block boundaries, interior and cafe overrides; loads `/assets/audio/music/{block}.mp3` when present and falls back to the existing tracks until David's Suno tracks arrive (a README in that folder names the 12 expected files and loudness target).
3. Ambience beds by time, weather and season using existing CC0 audio; SFX for the peaceful loop, crafting and combat mapped from existing files, with a manifest listing the ones still to generate.
4. Evidence: a short screen recording or logged playback timeline showing block selection at several forced times, the settings sheet, the chime at block end. Tests for block selection across midnight and DST, crossfade scheduling, settings persistence.
