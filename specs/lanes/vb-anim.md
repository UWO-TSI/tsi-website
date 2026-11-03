# Lane: vb-anim (beach volleyball character animations)

Worktree `.claude/worktrees/vb-anim`, branch `game/vb-anim`, cut from `game/volleyball` 33c25639. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (§3 controls, §5 contacts, the two views), `specs/design-bible.md` (Models: made properly, never half done), `art/characters/base/README.md` (Bones, Clips), `art/characters/base/build_clips.py` (lines 80-235: the pose kit; 3073-3200: bake, ground, check; the `-- staff` export near the end, which this lane copies). CODEMAP: Character, avatar; Art pipeline; big files `Character.tsx`, `PlayerAvatar.tsx`.

## The task

Proper volleyball clips keyed on the game's own rig (22 `mixamorig:` bones, v8 head), in their own GLB that only a match loads:

- `art/characters/volleyball/build_vb_clips.py`: reproducible headless build. It runs `build_clips.py -- head v8 lib` for the pose kit (Pose, body, hand, arm, plant, keys, bake, check), keys the clips and exports the rig and its actions only (like `-- staff`) to `web/public/assets/characters/v6/base/vb_clips.glb`. `-- evidence` renders the contact sheets.
- `web/lib/game/volleyball/clips.ts`: the contract (name, duration, loop, contact time, takeoff, apex and landing times, the hand's place at contact, the shuffle's stride).
- Clips: vb_ready, vb_shuffle (+ vb_shuffle_left, mirrored), vb_serve_toss, vb_serve_hit, vb_bump, vb_set, vb_jump_set, vb_spike_jump, vb_spike_hit, vb_block, vb_dive, vb_slide_dive, vb_celebrate_point, vb_celebrate_win, vb_spectate.
- The engine plays them through the usual `motion.play` / `motion.pose` once `<Character clips={VB_CLIPS_URL}>` has loaded them; `lib/game/character/clips.ts` knows their names, loop flags and fades.

## Round 2: animation feel (coordinator, 2026-11-01 night)

David's marks on the animations page (https://claude.ai/artifact/8EEip8ZMwLPfu6xFxEKMbc, collection approvals), verbatim:
- Approved: vb_block, vb_bump, vb_celebrate_point, vb_celebrate_win, vb_jump_set, vb_ready, vb_serve_hit, vb_serve_stand, vb_serve_toss, vb_set, vb_shuffle, vb_slide_dive, vb_spectate, vb_spike_hit, vb_spike_jump.
- vb_dive (redo): "needs to be redone to be more dramatic"
- anim-note (redo): "yeah i know and im thinking if it makes sense to increase the body head ratio so the body is bigger for these animations. i want the animatinos to be more dramatic and animated. movement should not feel so linear and you can feel each step and stride if that makes sense"

Build:
1. **vb_dive redone, dramatic:** a real launch (anticipation crouch, full stretch in the air, arms reaching), a hard landing with a slide and a beat of hold before getting up. You own `vb_clips.glb`; the volleyball lane is adding dive VFX and a flash frame in parallel and won't touch the clip. Keep the clip's name and length contract in `clips.ts` unless the VFX timing needs a new contact time (then say so).
2. **Movement with weight:** the everyday walk, run and dash (and their starts and stops) stop feeling linear: a stride you can feel, foot plants, body bob and hip sway, ease in and out on start and stop, a little overshoot on stopping. Find the current locomotion clips and the movement lab (`/lab/move`, CODEMAP) first. Same rig, same clip names, so everything that plays them keeps working.
3. **More drama across the set, gently:** push the approved volleyball clips' key poses a little further (anticipation, follow-through, arcs) only where it reads better in the strips; show before and after for each one you touch, and leave any you can't improve.
4. **The head to body question (a preview, not a change):** render the same character in three proportions side by side, still and mid-spike: today, a slightly bigger body (torso and limbs about +10%), and a slightly smaller head (about -10%). A shot only, through a bone scale in the preview: don't change the rig, the outfits or the creator. The coordinator's advice to David: get the drama from the animation first, because a proportion change ripples into every outfit, hair, accessory fit, LOD and the character budget.

## Status

Head: the commit that adds this file's update (see `git log`). Round 2 is built and waiting for review. Round 1's 17 clips are on main; David approved 15 of them (above) and asked for the dive redo and more drama.

**Round 2 (ids an2-*, evidence in `specs/evidence/vb-anim/an2/`):**
- **vb_dive redone** (`build_vb_clips.py` dive_keys): a sat-back gather with the arms flung back (0.11 s), an explosive push off the left leg (takeoff 0.24 s), a flat full stretch in the air above the sand (both arms long, legs together, toes pointed; contact 0.35 s), a hard belly landing (0.48 s) that whips the heels up and slides the body on 0.12 m along the sand, a beat lying still with a breath out, then the push up, a knee and up (1.4 s). Contract times unchanged; the hand at contact is higher (contactPoint y 0.378 to 0.513), so match.ts `HAND.dig` follows it (generated).
- **Approved clips pushed gently** (anticipation and follow-through only): vb_bump (sits deeper, drives up through the legs, platform follows through higher), vb_set (lower load, longer rise onto the toes), vb_spike_jump (deeper gather, arms higher behind), vb_spike_hit and vb_serve_hit (more arch on the whip, folded further through), vb_celebrate_point (deeper coil, bigger yank, higher knee). vb_spectate changes with them (it plays the bump and set). Left as they were: vb_ready, vb_shuffle(_left), vb_block, vb_jump_set, vb_serve_toss, vb_serve_stand, vb_slide_dive, vb_celebrate_win. The pushes are small by design; David decides if they read better.
- **Walk and Run rebuilt as IK gaits** (`build_clips.py` gait, WALK, RUN; the v6 Walk action is retired): heel strike with the toes up, the planted foot treading back with the stride, heel peel and toe push-off, the swing lifting the knee; the hips drop fast into each step and rise slower (Hermite curves, no linear sines), sway over the planted foot, drop on the swinging side and turn with the leg; the head rides a beat behind, the arms swing with drag. The run has a flight phase, a deeper stance, the heel kicked up behind and pumping bent arms. **Dash** pushed (deeper gather, longer lunge, a rock back past upright and a small tip forward before home). SlideIn, SlideInDash and SlideUp rebaked with them (they start or end on the run and the dash). Same names and lengths; Walk and Run contacts re-measured (catalogue).
- **Starts and stops with weight**: `leanStep` (juice.ts, tested) tips the body into a start and, on a stop, runs it on over the feet then rocks it back past upright (an underdamped spring on the ground speed's change); PlayerAvatar adds it to the body's pitch on the ground; `lean` in MOVE_JUICE and the /lab/move Juice panel.
- **The clip base is swapped, not re-exported**: `build_clips.py -- head v8 loco` bakes those six clips and swaps them into `art/characters/base/v8_clips.glb` with `web/scripts/swap-glb-clips.mjs` (raw JSON and BIN: meshes, cut marks and every other byte kept), then `hidden_cut.py -- bodycut` re-marked the skin under each garment over the new poses (v8_clips and lod1/base/skin), then `sync-character-assets.mjs`.
- **Head to body preview** (a shot only): `/lab/avatar ... &bones=Hips:1.1,Head:0.909` (body +10%) or `&bones=Head:0.9` (head -10%) scales bones in the bench and lifts the soles back to the ground; `an2-40-proportions.webp`.
- **Lab**: `/lab/avatar?sheet=vb` also takes base clips (`&ids=Walk,Run,Dash`) and `&view=play` (3/4 behind from the play camera's tilt). `strips.mjs` takes EXTRA, TAG, ZOOM, LOOK. `startstop.mjs` shoots /lab/move's start and stop strips (LEAN=0 for the lean off).

**Gates (round 2):** tsc clean; vitest 3735 passed, 1 failed (`shoreField.test.ts` village: a 5 s timeout under load; it passes alone); eslint clean on the changed files. perf:check SCENES=v2 (one run, SKIP_BUILD after a measurement build of 13dc7bb4): draw calls 365 / 288 and triangles flat (-0.6%, -0.9%), frame times +42% / +45% over the baseline with the machine loaded (load average 11, spread 31%, other lanes benching); clip files: v8_clips.glb 1.66 to 1.67 MB, vb_clips.glb 463 to 462 KB.

**Round 1** (approved except the dive): 17 clips in `web/public/assets/characters/v6/base/vb_clips.glb` and the contract `web/lib/game/volleyball/clips.ts` (generated with it), sheets `specs/evidence/vb-anim/<clip>.webp`, strips `specs/evidence/vb-anim/game/`.

**The rig's limits** (the reason for some pose choices): the head is 42% of the height and the arms are 0.165 m to the wrist, so hands can't go above the head. Raised arms go out to the side, beyond the hair (a bob covers the sides down to the shoulders), and the body and head lean away from the hitting arm. Standing reach is about 0.85 game units above the soles; match.ts `HAND` assumes 1.5 to 1.75. Legs are 0.244 m hip to ankle: an IK stride is at most about 0.2 (walk) and 0.32 (run, crouched 6 cm) before the leg straightens.

## David's decisions (newest first)

- 2026-10-30, the phase 1 dive: "needs animation redo for dive, i need you to open blender for character movement and do it properly, redo everything properly dont half ass this".
- 2026-10-30, the rally: "none of these have proper animation, movement".
- 2026-10-30, receiving: "currently theres no character rigging animation for these actions... jumping is higher and slowmo".
- Non-players: "if youre not playing it will have default playing animation to save performance" (vb_spectate).

## Next

1. David's review of round 2 (an2-* in `specs/evidence/vb-anim/an2/`): the dive, the pushes, the walk, run, dash and the lean, and the proportions question. Apply his notes in `build_vb_clips.py` / `build_clips.py` and rebuild (vb: the GLB and clips.ts move together; loco: `-- head v8 loco`, then `hidden_cut.py -- bodycut`, then `sync-character-assets.mjs`).
2. If David wants a proportion change, it is its own lane: the rig, every outfit's fit and drape, hair, accessories, LODs and the character budget move with it.

## Tools and gotchas

- Locks: `LANE=game/vb-anim /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender|heavy|devserver <cmd>`; exit 75 means retry. Swap is near full: hold one lock at a time.
- Blender: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/characters/volleyball/build_vb_clips.py [-- evidence]`.
- Rig axes (Blender): up +Z, the character faces -Y, its left is +X. 1 rig m = 1.3 game units (CHARACTER_SCALE).
- Rebuild: `LANE=game/vb-anim .../withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/characters/volleyball/build_vb_clips.py [-- evidence [a,b]] [quick] [noexport]` (about 3.5 min with all the evidence). It prints the QA per clip (head, min_z, pop_deg, fast frames, seam, foot_slide_mm).
- In-game strips: a dev server on 3473 (Supabase blanked), then `PORT=3473 node specs/evidence/vb-anim/strips.mjs <out> [clips] [34|back]`, all inside one devserver lock (start, shoot and kill in one script).
- Pops are measured as a bone's direction change between frames; twist about a round limb's own axis doesn't show.
- Planted and free keys meet without a blend where they agree (the dive's load, LAND): a blend between an IK-planted leg and a free leg pops.
- Never ports 3000, 3300, 3301.
- Gait review renders: `build_vb_clips.py -- loco evidence Walk,Run,Dash [quick] [close]` (base clips through the vb sheet code, never exported there); `-- only a,b` bakes a few clips without export; `VB_EVIDENCE=<dir>` writes sheets elsewhere.
- Locomotion rebuild order: `build_clips.py -- head v8 loco` (about 1 min), `hidden_cut.py -- bodycut` (about 7 min), `cd web && node scripts/sync-character-assets.mjs`. A full `build_clips.py -- head v8` re-export would drop the hidden-cut marks; don't.
- QA numbers (round 2): dive pop 65 deg (the forearm in the arm fling), run 49 deg (the knee in the swing), dash 69 (old dash 86); walk's planted foot moves 11.1 mm a frame (its treadmill: 0.2 m in 0.6 s).
- The /lab/move camera is a follow orbit: `tsi.camera.v1` in localStorage ({yaw, pitch, autoFollow}) holds it for evidence.
