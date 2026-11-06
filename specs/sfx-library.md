# The SFX library

David, 2026-11-06: "i want you to build a sound effect library like youve done with the aura and effects library as a artifact and i can opening give feedback on it, i want you to first go online and scrape online gaming sound effects that are satisfying first that are very well made then potentially create your own, do so in sound effect for ambient sounds as well ... for auras and effects make it VFX library and sound make SFX library".

Every sound the game plays comes from here: a standard set of sounds, each with an id, a category, a use, and two or three candidates side by side (found online vs made by us), levelled to the same loudness so David picks by ear. The VFX library (`specs/fx-library.md`, game/rod-gear) is the model.

- `web/data/sfx-library.json`: **the manifest** the game and the review page read. Per sound: `id`, `label`, `category`, `use`, `slot` (the game-feel priority, `specs/game-feel.md` "Sound slots"), `pick` (null until David picks), and its `candidates`: `key` (a, b, c), `label`, `file` and `waveform`, `sources` (url, author, licence, origin file), `ours`, `seconds`, `lufs`, `truePeak`, ambience `seam`, and the `recipe` that rebuilds it.
- `art/audio/sfxlib.py`: the build. The SOUNDS table there is the source of truth for every sound and candidate; it cuts, levels, loops and encodes them and writes the manifest. `--check` validates it.
- `art/audio/synth_sfxlib.py`: our own candidates, made from sines and noise (no samples), CC0.
- `art/audio/staging/` (gitignored): the downloads (Kenney packs, Freesound previews and `freesound/records.tsv`, the licence log written when each page was checked). Data only: decoded by ffmpeg, never run.
- Candidates for review: `specs/evidence/sfx-library/r<round>/sfxlib<round>-<id>-<key>.ogg` and `.png` (waveform). The oggs are gitignored until picked; the build remakes them.

## The rules

1. **CC0 only.** The repo is public. A found file is kept only if its own page says CC0 (Creative Commons 0 / public domain): Kenney's packs, Freesound sounds whose page shows "Creative Commons 0", OpenGameArt CC0. Nothing with attribution terms, no royalty-free licences, no rips. Ours are CC0. Every source's url, author and licence is in the manifest, and in `web/public/audio/CREDITS.md` / `sfx/SOURCES.md` once picked.
2. **Loudness.** One-shots are levelled on their loudest 400 ms (K-weighted, like LUFS momentary): UI and voice **-20**, actions **-18**, rewards **-16**. Ambience beds: **-26 LUFS integrated**, so they sit under the music. True peak at most **-3 dBFS** after encoding (a lookahead limiter at -4.2 before it). Very short sounds (a tick) reach the peak ceiling first and land a little under their target; that's expected.
3. **Length.** One-shots as short as the action: a tap 0.03 to 0.07 s, a pop 0.1 to 0.2 s, a jingle 0.7 to 1.1 s, a fanfare 1.5 to 2.5 s (the slot list gives each). Silence is trimmed from the front (2 ms kept, faded in) and the end fades over up to 25 ms (a sound cut short over up to 60 ms).
4. **Ambience loops seamlessly.** A bed is 24 s: made or cut 26 s long, and its last 2 s crossfade (equal power) into its head, so the wrap runs straight on. The build measures each seam (the step at the wrap against the bed's typical step, and the level either side) and `--check` fails a bed that jumps.
5. **Format.** Ogg Vorbis, 48 kHz; one-shots mono content (stored as two equal channels, as ffmpeg's encoder needs), quality 5; beds stereo, quality 4. Names: `<id>.ogg` in `web/public/audio/sfx/` (one-shots) or `web/public/audio/ambient/` (beds) once picked.
6. **Variation.** A sound that repeats (steps, coins, pickups, rustles, "varies" in the slot list) must sound right re-pitched 0.92 to 1.08, which the game does per play. Footsteps have four variants per surface; the review plays them as a walk, and the game picks one per step.
7. **Nothing goes into `web/public/audio/` until David picks.** Then: copy the pick's ogg to its `<id>.ogg`, set `pick` in the manifest, credit it in CREDITS.md / SOURCES.md, and wire it in `web/lib/game/audio.ts` (SFXName and the file map), replacing the placeholder named in its slot.

## The sounds

| Category | Ids |
|---|---|
| UI | `ui-tap`, `ui-open`, `ui-close`, `ui-toggle`, `ui-tab`, `ui-confirm`, `error` |
| Rewards | `coin`, `coin-out`, `gem`, `buy`, `sell`, `bag-thunk`, `upgrade`, `stamp`, `task-complete`, `quest-complete`, `reward-fly`, `item-get`, `level-up`, `craft-done`, `donate` |
| Actions | `land`, `rustle`, `splash`, `place`, `sit`, `forage`, `dig`, `cast`, `bite`, `reel`, `catch`, `fish-escape`, `equip`, `jump`, `footstep-grass`, `footstep-wood`, `footstep-stone`, `footstep-sand`, `footstep-water` |
| Voice | `voice-blip` |
| Ambience | `amb-sea`, `amb-shore`, `amb-wind`, `amb-birds-dawn`, `amb-birds-day`, `amb-crickets`, `amb-rain`, `amb-river`, `amb-fire`, `amb-town`, `amb-cave`, `amb-night` |

The ids are the game-feel lane's slot names (its "Sound slots", priority 1 to 3), so a pick wires by name.

## How to add a sound

1. Add an `S(id, label, category, use, C(...), C(...), slot=...)` row to SOUNDS in `art/audio/sfxlib.py`. A candidate's `src` is `ours:<name>`, `k:<pack>/<file>`, `fs:<id>`, `game:<file>`, or `mix` (layered `parts`) / `seq` (a row of files, `gap` apart), with optional `start` and `dur` (s).
2. A found file: fetch its page headless, confirm "Creative Commons 0" on it, download the preview into `art/audio/staging/freesound/` and log it in `records.tsv` (url, author, title, licence). Kenney: the pack page says CC0; unzip into `art/audio/staging/kenney/<pack>/`.
3. Ours: add a function to `synth_sfxlib.py` and its name to SOUNDS there.
4. `python3 -I art/audio/sfxlib.py <id>` builds it (and keeps the rest of the manifest); `python3 -I art/audio/sfxlib.py --check` must pass.
5. Never play sound on the machine to check: read the levels, the seam numbers and the waveform. David listens on the review page.
