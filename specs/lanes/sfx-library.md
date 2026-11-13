# Lane: sfx-library (the SFX library: sound effects and ambience)

Worktree `.claude/worktrees/sfx-library`, branch `game/sfx-library`, cut from origin/main 16e7152df. Agent type `uwotsi-lane`. Dev port 3496.

**Read first:** `specs/lanes/README.md`, `specs/lane-rules.md`, `web/public/audio/CREDITS.md`, `web/public/audio/sfx/SOURCES.md` and `MANIFEST.md` (today's sounds, where each plays, the missing list), `web/lib/game/audio.ts`, `art/audio/synth_*.py`. The VFX library (`specs/fx-library.md` on game/rod-gear) is the model: a standard set of types, each with parameters, a preview, and a template future work copies.

## Round 2: David's SFX Library 1 review (2026-11-13, verbatim; https://claude.ai/artifact/ACLhH8idW4KJzayiDgpoE9)

Each card's mark and note. A letter is the candidate he picked (a, b, c as the page labelled them).

Approved: none.
- sfx-amb-birds-dawn (approve): "b"
- sfx-amb-birds-day (redo): "c, remove the static background sound isolate the bird sound effect"
- sfx-amb-cave (approve): "c"
- sfx-amb-crickets (redo): "b, remove the static background sound isolate the sound effect"
- sfx-amb-fire (approve): "b"
- sfx-amb-night (approve): "b"
- sfx-amb-rain (redo): "b, make it light"
- sfx-amb-river (approve): "c"
- sfx-amb-sea (redo): "a, but should have wave crashing with that ambient sound, like swells in and out more to mimic it, look at b and c"
- sfx-amb-shore (redo): "b for deep ocean, c for beach, but make it lighter"
- sfx-amb-town (approve): "a, but we will not use this for our town plaza, just keep it in your back pocket if we need it"
- sfx-amb-wind (approve): "b but make it very light"
- sfx-bag-thunk (redo): "a but make a wind up sound effect before the thud"
- sfx-bite (approve): "a"
- sfx-buy (approve): "a, but edit so theres more before the ching, more ka"
- sfx-cast (redo): "i want the woosh of a but the line creek of c"
- sfx-catch (redo): "the splash part learn from c but the chine use a"
- sfx-coin-out (redo): "i dont like any"
- sfx-coin (approve): "both, a is the rewards sound, b is more realist like coin rattling, b is not for rewards, for when coins are visualized and stuff"
- sfx-craft-done (approve): "should have hammer sound like tik tik tik and on the third tik a chime, the tik is light"
- sfx-dig (redo): "redo in a style but with the sound of b, keep a as well i want variety"
- sfx-donate (approve): "a"
- sfx-equip (redo): "a redo to be softer and less crinkly and neutral"
- sfx-error (approve): "a"
- sfx-fish-escape (redo): "the splash needs to be a plop and sad splash and the aw sound needs to be redone so theres a slight gap between spash and aw"
- sfx-footstep-grass (redo): "should be a but more bassy earthy feel and overall more rounded so its easy on the ears. and it should also be able to match speed, so faster the sound goes faster"
- sfx-footstep-sand (redo): "needs to be softer and pleasing to the ear, i want you to redo the sound effect make it more quiet, test the db of all ambient wlaking and they should be the same after"
- sfx-footstep-stone (redo): "it should be a rounded light sound on like boot i added reference you can use"
- sfx-footstep-water (redo): "ours is not accurate at all, use b as reference, they shouldnt be all the same tone, mix it up feel the splash linger between each step"
- sfx-footstep-wood (redo): "b, but more deepness to it and overall rounded"
- sfx-forage (redo): "use the leaf sound effect for the rustle and the A. for the pop"
- sfx-gem (redo): "this should be more epic cuz its gems, i dont like any"
- sfx-item-get (redo): "a but should be more poppy sound like a minecraft pop sound effect"
- sfx-jump (redo): "the whoosh up is too harsh, redo to be smoother more satisfying for the ear"
- sfx-land (redo): "a but should be lighter and more soft and rounder"
- sfx-level-up (redo): "a but more epic"
- sfx-place (redo): "a is good but make the tone a proper note"
- sfx-quest-complete (redo): "a make the chime ding sound louder and appegio"
- sfx-reel (redo): "in the style of a make it sound like b but less harsh on the ear"
- sfx-reward-fly (approve): "a"
- sfx-rustle (redo): "the rustling sound doesnt sound right, i need it redone or look online for refrernce or find like pre exisitng, i downloaded a reference to use its in my downloads"
- sfx-sell (redo): "make the hua befroe the ding longer and ring out, make ding ring out too naturally for a lil bit"
- sfx-sit (approve): "b"
- sfx-splash (redo): "downloaded 3 seperate splash sound effects, for you to either reference or use straight up"
- sfx-stamp (redo): "should be a lighter version of b and a confrim happy chime"
- sfx-task-complete (approve): "a"
- sfx-ui-close (approve): "a"
- sfx-ui-confirm (approve): "a"
- sfx-ui-open (approve): "a"
- sfx-ui-tab (approve): "a"
- sfx-ui-tap (approve): "i like b and c, c for more muted items"
- sfx-ui-toggle (approve): "a"
- sfx-upgrade (redo): "a but should me a lil more epic and sustained and longer and spaced out"
- sfx-voice-blip (redo): "i dont like any of these, use the davidliu.work sound for the head character in my project folder"

**Main moved:** merge `origin/main` first (the site revamp, 59 commits; no conflicts expected in sound files).

Build (coordinator):
1. **Lock the picks.** Every "approve" with a letter is final: set it as that slot's sound in `web/data/sfx-library.json`. Where he approved with a change ("buy: a, more ka before the ching"; "wind: b, very light"; "craft-done: tik tik tik, a chime on the third, the tik light"), make the change. `sfx-amb-town` stays in the library but is not the plaza's sound. `sfx-coin` keeps both: a is the reward sound, b (a coin rattle) is for coins shown moving, never a reward. `sfx-ui-tap`: b for normal taps, c for muted items.
2. **Redo each "redo" exactly as noted**, one new candidate (two where his note asks to keep variety, as `sfx-dig` does: keep a, add a new one in a's style with b's sound).
3. **His references.** `specs/references/sfx/` (untracked, never commit them): three splashes (`universfield-water-splash-*`), the stone footstep (`freesound_community-walking-96582`), leaves (`dragon-studio-dry-leaves-rustling-482874`, `musicholder-walking-on-leaves-260279`). They are Pixabay files (Pixabay Content License, not CC0): you may use them "straight up" only edited or layered into our own sound, and each use gets a SOURCES.md line naming the file, the site and the licence. Otherwise synthesise toward them.
4. **The voice blip** comes from David's own site: the floating head's synthesized animalese blips in `~/Developer/dahan8473.github.io/talk/talk.js` (`sound.blip`, the `VOWEL` formant table, no files). Port that sound as the dialogue voice blip (read the code; it is his, so no licence line beyond "ours, from davidliu.work").
5. **Footsteps as a set:** grass, sand, stone, water and wood at the same loudness (measure each, LUFS or RMS, and list the numbers), rounded and soft, never harsh. Steps follow walking speed: expose a rate so faster walking plays faster steps, and show it on the page (a slow and a fast walk). Water steps vary in tone, with the splash lingering between steps (his b).
6. **Ambience loops without the static bed:** birds-day and crickets isolated from the hiss; rain light; sea with waves that swell in and out and crash (learning from b and c); shore as two, b for deep ocean and c for the beach, both lighter.
7. Note anything you can't make sound right on the questions card (gem and coin-out, where he liked none: two fresh directions each).
8. **The page, "SFX Library 2":** one card per redone or changed sound, each with its new candidate(s) and the old pick to compare, the footstep set with its loudness numbers, plus a questions card. Approved untouched sounds are not re-shown; list them in one card.

Evidence `sfx2-*` in `specs/evidence/sfx-library/r2/`.

**Gates:** the library manifest test, tsc, eslint on touched files. No perf:check (audio only). Headless only, never play sound on David's machine.

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
