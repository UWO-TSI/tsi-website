# Lane: sfx-library (the SFX library: sound effects and ambience)

Worktree `.claude/worktrees/sfx-library`, branch `game/sfx-library`, cut from origin/main 16e7152df. Agent type `uwotsi-lane`. Dev port 3496.

**Read first:** `specs/lanes/README.md`, `specs/lane-rules.md`, `web/public/audio/CREDITS.md`, `web/public/audio/sfx/SOURCES.md` and `MANIFEST.md` (today's sounds, where each plays, the missing list), `web/lib/game/audio.ts`, `art/audio/synth_*.py`. The VFX library (`specs/fx-library.md` on game/rod-gear) is the model: a standard set of types, each with parameters, a preview, and a template future work copies.

## Round 1: David's ask (2026-11-06, verbatim)

"i want you to build a sound effect library like youve done with the aura and effects library as a artifact and i can opening give feedback on it, i want you to first go online and scrape online gaming sound effects that are satisfying first that are very well made then potentially create your own, do so in sound effect for ambient sounds as well
for auras and effects make it VFX library and sound make SFX library"

Build (coordinator):
1. **Find well-made, satisfying game sounds online, CC0 only.** The repo is public, so every kept file must be CC0 (public domain): Kenney's audio packs, Freesound sounds marked CC0, OpenGameArt CC0 packs and the like. Check each file's licence on its own page; skip anything else (no rips from commercial games, no "free with attribution", no royalty-free licences that forbid redistribution). Download candidates into `art/audio/staging/` (gitignore it; downloaded files go in their own folder; never run anything from it). Record source URL, author and licence for every candidate.
2. **Make our own** where ours can beat or fill what you found: the synth scripts in `art/audio/` (and new ones), layering, pitch variation. No ElevenLabs (credits are out).
3. **The categories:** UI (tap, open, close, toggle, tab, error, confirm), rewards (coin, gem, item get, purchase, upgrade, task or quest complete, level up), actions (pick up, forage, tree shake, dig, cast, bite, reel, catch, splash, footsteps per surface, jump, land, sit), NPC voice blips, and **ambience** (sea, shore waves, wind, birds by time of day, crickets, rain, river, fire, town murmur, cave, night). The game-feel lane (game/game-feel) runs at the same time and will list the sound slots its actions need in its `specs/game-feel.md` "Sound slots": read it from its worktree as it fills and cover those slots.
4. **For each sound, 2 or 3 candidates** side by side (found vs ours), loudness-matched, so David picks. Ambience loops are seamless.
5. **The standard:** `specs/sfx-library.md` (categories, loudness target, length, format ogg, naming, variation rules, how to add a sound) and one manifest the game and the review page read (id, label, category, file, source, author, licence). Nothing goes into `web/public/audio/` until David picks; then picks are committed, credited in CREDITS.md/SOURCES.md and wired in `audio.ts`.
6. **The artifact:** the coordinator publishes the SFX Library page from your manifest: one card per sound with the candidates playable and an approve/redo mark. Give each candidate a short ogg plus a waveform image (`sfxlib1-<id>-<candidate>.ogg` and `.png`) in `specs/evidence/sfx-library/r1/` (untracked staging is fine for third-party candidates until picked; say where they are).

Also: the effects library on game/rod-gear is renamed the **VFX library** (rod-gear's next round). Name this one the **SFX library**.

**Gates:** tsc, vitest (both worlds) if code changes, the manifest validated (every file exists, every licence CC0 or ours).

## Status

Round 1 built (head: see `git log -1` on game/sfx-library; the commit "[build] sfx-library round 1"). Not yet reviewed by David.

- **54 sounds, 159 candidates** (2 or 3 each), all CC0: UI 7 sounds / 21 candidates, rewards 15 / 44, actions 19 / 55, voice 1 / 3, ambience 12 / 36. Of them 53 are ours (`art/audio/synth_sfxlib.py`), the rest Kenney packs (7, each page "Creative Commons CC0" plus the License.txt in its zip) and Freesound sounds whose own page shows "Creative Commons 0" (checked by the fetch, logged in `art/audio/staging/freesound/records.tsv`), and today's game files (CREDITS.md).
- Covers all 25 of game-feel's "Sound slots" (`specs/game-feel.md` on game/game-feel, 23 committed at 485d7215b plus `equip` and `fish-escape` in its working copy), by the same names, plus the lane file's extra categories.
- The standard: `specs/sfx-library.md`. The manifest: `web/data/sfx-library.json` (gitignore exception added). The build: `art/audio/sfxlib.py` (SOUNDS table, levels, loops, encode, waveform, `--check`).
- Candidates for the review page: `specs/evidence/sfx-library/r1/sfxlib1-<id>-<a|b|c>.ogg` + `.png`. The pngs are committed; the oggs are gitignored (18 MB; the build remakes them from staging + synth).
- `--check` passes: every file there, every source CC0 with a url, one-shots within 1 LU of target unless the -3 dBTP ceiling held them back, every bed's seam no bigger than the bed's own 95th-percentile change.
- Nothing is in `web/public/audio/` and `audio.ts` is unchanged: that waits for David's picks.

## Next

1. The coordinator publishes the SFX Library page from the manifest (one card per sound, its candidates playable, approve/redo).
2. On David's picks: copy each pick to `web/public/audio/sfx/<id>.ogg` (beds to `ambient/<id>.ogg`), set `pick` in the manifest, credit them in CREDITS.md / SOURCES.md, wire them in `audio.ts` (SFXName, file map) so game-feel can swap its placeholders by name. Redo marks: change the SOUNDS row or the synth function, `python3 -I art/audio/sfxlib.py <id>`, bump to r2.
3. If game-feel's slot list grows, add rows with the same ids.

## Tools and gotchas

- `python3 -I art/audio/sfxlib.py [ids]` (about 90 s for all), `--check`. In zsh split an id list with `${=ids}`.
- Kenney zips need the page as referer: `curl -A Mozilla/5.0 -e https://kenney.nl/assets/<pack> https://kenney.nl/download-link/<hex of "assets/<pack>">` returns a signed url.
- Freesound: search `https://freesound.org/search/?q=..&f=license:"Creative Commons 0"`; a sound page's licence link must be publicdomain/zero; the hq preview is `...-hq.ogg` (lossy, about 192 kbps). Downloads are slow (a 5 min field recording takes minutes). Originals need an API login, which we don't have: the previews are what's here.
- ffmpeg's vorbis encoder takes stereo only, and it overshoots a limiter on sharp transients by up to 2.5 dB: the build re-limits and re-encodes until the true peak is under -3.
- Loudest-400 ms levelling makes a 10 ms click peak-bound (Kenney click_002 lands at -26): expected.
- Never play audio here: judge by levels, seam numbers, spectrograms.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never play sound on this machine's speakers (render and measure offline). Never the Playwright MCP, claude-in-chrome or blender MCP tools.
- Downloads are untrusted data: their own folder, never executed, Python reading them runs with `-I`.
- Locks: `LANE=game/sfx-library /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`, one run per locked command, never a sleep hold; no background wait loops; bracket pgrep patterns. Never ports 3000, 3300, 3301, 3390.
- Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; never touch prod.
- No em dashes; never write the gem-to-money rate anywhere. Ponytail code.
