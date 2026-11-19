# Lane: sfx-library (the SFX library: sound effects and ambience)

Worktree `.claude/worktrees/sfx-library`, branch `game/sfx-library`, cut from origin/main 16e7152df. Agent type `uwotsi-lane`. Dev port 3496.

**Read first:** `specs/lanes/README.md`, `specs/lane-rules.md`, `web/public/audio/CREDITS.md`, `web/public/audio/sfx/SOURCES.md` and `MANIFEST.md` (today's sounds, where each plays, the missing list), `web/lib/game/audio.ts`, `art/audio/synth_*.py`. The VFX library (`specs/fx-library.md` on game/rod-gear) is the model: a standard set of types, each with parameters, a preview, and a template future work copies.

## Round 3: David's marks on SFX Library 2 (2026-11-19, verbatim; https://claude.ai/artifact/5zmkmULjVWmwPaaXThGUzi)

Approved with no note: sfx2-footsteps.
- sfx2-footstep-grass (approve): "sounds good, a is walking, d is running, c will be the grass sound going through bushes, what about dashing and sliding t horugh grass?"
- sfx2-footstep-wood (approve): "a is walk b is run"
- sfx2-footstep-stone (redo): "a deeper version of c and d"
- sfx2-footstep-sand (redo): "a and b is good but i think a lighter softer version of c would be better"
- sfx2-footstep-water (redo): "make the woosh sound effect from a and b quieter and softer"
- sfx2-coin-out (approve): "i like a and b"
- sfx2-gem (approve): "a"
- sfx2-sell (approve): "a"
- sfx2-bag-thunk (approve): "a"
- sfx2-upgrade (approve): "a"
- sfx2-stamp (approve): "a"
- sfx2-quest-complete (approve): "a"
- sfx2-item-get (approve): "b"
- sfx2-level-up (approve): "a"
- sfx2-land (approve): "a"
- sfx2-rustle (approve): "use all 3 for different cases a is shaking tree, b is like walking through a bush, c is like shaking a bush"
- sfx2-splash (approve): "B"
- sfx2-place (approve): "a"
- sfx2-forage (redo): "redo based on the rustle sounds i approved"
- sfx2-dig (approve): "digging should be a mixure of these 3 sound effects"
- sfx2-cast (approve): "a"
- sfx2-fish-escape (redo): "a, but make the aww like closer to the plop sound"
- sfx2-equip (approve): "a"
- sfx2-reel (redo): "a but softer and lighter"
- sfx2-catch (approve): "a"
- sfx2-jump (redo): "too loud too aggressive"
- sfx2-voice-blip (redo): "a but do some new talking optiosn like look at tomodachi life and animal crossing"
- sfx2-amb-sea (approve): "a"
- sfx2-amb-shore (approve): "a"
- sfx2-amb-shore-deep (redo): "deep ocean should have this like deep feeling and hum to it like a datacenter hum deep and there soundingfdar away"
- sfx2-amb-birds-day (approve): "a"
- sfx2-amb-crickets (approve): "a"
- sfx2-amb-rain (approve): "a"
- sfx2-buy (approve): "a"
- sfx2-craft-done (approve): "a"
- sfx2-amb-wind (approve): "a"
- sfx2-approved (approve): "im mainly worried about hwo loud everything will be, so i want everything to be very soft and in the background when playingthe game and simply layered ambient sounds"
- sfx2-questions (approve): "1. synthesis it in teh game like the site, make the tone of it different for different people, i want it to mimic more human speaking tone, and have male and femail tonation and stuff / 2idk / 3 its good / 4 its good"

Picks to lock, each from David's mark:
- **Footsteps:**
  - grass: a is walking, d is running, c is going through bushes;
  - wood: a is walk, b is run.
- **Coins and items:** coin out a and b; gem a; sell a; bag thunk a; upgrade a; stamp a; quest complete a; item get b; level up a; buy a; craft done a.
- **Movement and placing:** land a; place a; equip a.
- **Rustle:** a is shaking a tree, b is walking through a bush, c is shaking a bush.
- **Fishing:** splash B; cast a; catch a.
- **Dig:** a mixture of its three takes.
- **Ambient:** open sea a; shore a; birds day a; crickets a; rain a; wind a.

The 19 untouched round 1 picks stay as they are.

Build:
1. **Lock the picks** as Next 2 describes: files, credits, `audio.ts`.
   - Dig picks one of its three takes per dig, at random.
   - The rustle's three takes are wired to their three cases.
   - Grass and wood footsteps follow the walk and run picks, speed-matched.
2. **The mix (sfx2-approved):** everything very soft and in the background, with ambient as quiet layered beds.
   - Lower the game's SFX bus and the UI sounds under the world sounds.
   - Layer the ambient beds quietly.
   - Show the loudness before and after on the page.
3. **Redo from existing takes**, processed by you:
   - **Stone:** a deeper version of c and d.
   - **Sand:** a lighter, softer version of c; a and b stay.
   - **Shallow water:** the whoosh in a and b quieter and softer.
   - **Reel:** a, softer and lighter.
   - **Jump:** quieter and less aggressive.
   - **Fish escape:** a, with the "aw" moved closer to the plop.
   - **Forage:** rebuilt from the approved rustle takes.
4. **New sounds through the asset pipeline** (row 339, `specs/asset-pipeline.md` §2). The coordinator writes `art/audio/sfx-style.md` and runs the ElevenLabs generation; you process the takes.
   - **Deep ocean:** a deep, far-away hum, like a datacenter heard from a distance.
   - **Grass:** dashing through grass and sliding through grass (David asked).
5. **Talk blips, synthesised live in the game** like davidliu.work (answer 1):
   - each character gets its own voice: pitch, timbre and speed;
   - the intonation follows human speech;
   - male and female ranges;
   - new options in the spirit of Tomodachi Life and Animal Crossing babble.
   Put three or four presets on the page to pick from.

Page "SFX Library 3": only the redone and new sounds, plus the mix card.

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

Round 2 built (head: see `git log -1` on game/sfx-library, "[build] sfx-library round 2"), origin/main merged first. Not yet reviewed by David.

- **Picks locked** in `web/data/sfx-library.json` (`pick`, plus `uses` where a sound has two jobs): 22 approvals. Untouched (19, not re-shown): ui-tap b (c for muted items), ui-open a, ui-close a, ui-toggle a, ui-tab a, ui-confirm a, error a, coin a (b the rattle for coins shown moving, never a reward), task-complete a, reward-fly a, donate a, sit b, bite a, amb-birds-dawn b, amb-river c, amb-fire b, amb-town a (back pocket, not the plaza), amb-cave c, amb-night b. Approved with a change, the change is the pick and is shown again: buy d (more "ka"), craft-done d (tik tik tik, chime on the third), amb-wind d (b very light).
- **Redone** (33 sounds, 40 new candidates, keys continuing after round 1's): each per David's note; see the manifest's `mark`, `note`, `compare` and the round-2 candidates. New sound `amb-shore-deep` (shore b as deep ocean); `amb-shore` is now the beach (c).
- **Footsteps as a set:** every slow walk at -26.0 to -26.2 LUFS integrated (grass -26.0, wood -26.2, stone ref -26.2, stone ours -26.0, sand -26.0, water -26.1; RMS -24.3 to -26.9 dB). Each has a fast-walk alt (`-fast`). The rate rule is `footstepRate()` in `web/lib/game/audio.ts` (tested), not yet called by the game.
- **Voice blip:** ported from davidliu.work `talk/talk.js` `sound.blip` (square, VOWEL formants, Q 4 band-passes, the site's 45 ms typing and 50 ms gap), rendered as a line.
- David's references used edited only (Pixabay Content License, credited per candidate): the three universfield splashes (splash d, e, f), the stone walk (footstep-stone c), the dry leaves (rustle d, e; forage d). `walking-on-leaves` unused.
- Nothing in `web/public/audio/` yet: copying, CREDITS/SOURCES lines and `audio.ts` wiring wait for the round-2 picks, in one batch.
- Evidence: `specs/evidence/sfx-library/r2/sfx2-<id>-<key>.png` committed, `.ogg` gitignored (the build remakes them); round 1's compare files stay in `r1/`.

## Next

1. The coordinator publishes "SFX Library 2" from the manifest: a card per sound with a round-2 candidate (its new candidates, its `compare` keys from r1 to play beside them, his r1 note), the footstep set card (slow and fast walks, the loudness numbers above), one card listing the 19 untouched approvals, and a questions card (gem and coin-out: two fresh directions each; is the voice blip baked as files or synthesized live in audio.ts; "light rain" is quieter and thinner, not sparser).
2. On David's round-2 picks, in one batch: copy each pick to `web/public/audio/sfx/<id>.ogg` (beds to `ambient/<id>.ogg`; not amb-town), credit in CREDITS.md / SOURCES.md (Pixabay files: file, site, licence), wire one-shots in `audio.ts` (SFXName, file map) so game-feel swaps placeholders by name, and have game-feel call `footstepRate` for steps.
3. Redo marks: add `R(...)` candidates in `NEW` (sfxlib.py) with `round=3`, bump `ROUND`, `python3 -I art/audio/sfxlib.py <ids>`.

## Tools and gotchas

- `python3 -I art/audio/sfxlib.py [ids]` (about 25 s for round 2's), `--check`. In zsh split an id list with `${=ids}`. It builds only the current ROUND's candidates; earlier rounds keep their files and numbers from the manifest, so never delete `r1/` oggs before David's last compare.
- Round 2 sources: `ref:<file>` (David's references, untracked), `edit:<name>` (EDITS in sfxlib.py: cuts, `denoise` spectral gate, filters, layering), candidate `fx` (denoise, keep a band, hp, lp), `target` (a lighter bed), `walk=True` (four steps laid as slow and fast walks), `run=n` (a coin run).
- This worktree's `web/node_modules` is a symlink to the club worktree's (same lockfile); delete it before any `npm install`.
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
