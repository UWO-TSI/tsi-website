# Lane: body-r15 (a new body on Roblox's joint system, and animations from Roblox Studio)

Worktree `.claude/worktrees/body-r15`, branch `game/body-r15`, cut from `feat/game-default-island` at the commit that adds this file. Agent type `uwotsi-lane`. Dev port 3484. Blender headless only, under the blender lock.

## David's asks (2026-11-14, verbatim; ledger rows 336 to 338)

- "i need you to redesign the character body, Redo body rigging system, proper joints match Roblox joint system, and from that i then wanna know if its possible to use roblox editor for animation movements and animations to then transfer over to my game sinnce roblox studio already have all the systems done so tis easier for you to develop ebtter animations and cutscenes and you can jsut copy it over"
- On the body's look: "move towards roblox like but i dont want rectangles i want smoothed out body parts and make them snatched like the modern roblox body"

## What we know (coordinator's research)

- **Roblox's joint system (R15):**
  - 15 joints: Root, Waist, Neck, and on each side Shoulder, Elbow, Wrist, Hip, Knee, Ankle. They are Motor6Ds between 15 parts:
    - the trunk and head: HumanoidRootPart, LowerTorso, UpperTorso, Head;
    - each arm: Left/Right UpperArm, LowerArm, Hand;
    - each leg: Left/Right UpperLeg, LowerLeg, Foot.
  - Roblox's newer 22-joint standard (`HumanoidRigDescription`) adds Spine, Chest, HeadBase, clavicles and toe bases. R15 is its subset.
  - David asked for "the Roblox joint system": build R15. Mention the 22 only if you find it buys something concrete, as a question.
- **Roblox's official reference rigs:**
  - `github.com/Roblox/avatar` (e.g. `Legacy/rigs/R15_Block.fbx`) is an official technical template, already OK'd and used for the head fit (`art/characters/skull/skull.json`, `art/characters/base/head_shape.py`).
  - Use it for joint names, the parent tree, the pivot positions as proportions, the rest pose and the attachment names (`RightGripAttachment`, `LeftGripAttachment`, `BodyBackAttachment`, `HairAttachment`, `HatAttachment`, `FaceFrontAttachment`, `NeckAttachment`, and so on).
  - It is a measuring template only. Never ship its meshes.
- **Studio has no animation export:**
  - Its Animation Editor saves a `KeyframeSequence` (Keyframes by time; under each, nested `Pose`s named by part, each a `CFrame` with easing style and direction).
  - Right-click it, then "Save to File", gives `.rbxmx` (XML) or `.rbxm` (binary).
  - Newer animations may be curve animations (`CurveAnimation` with float curves per channel).
  - A `Pose.CFrame` is the joint's Motor6D `Transform`: the part's offset from its rest, in the joint's frame (C0 and C1).
  - Roblox is Y-up and characters face -Z. Units are studs.
- **Today's rig:**
  - 22 `mixamorig:` bones, built in `art/characters/base/build_v6.py` (`BONES` about line 1044, weights after it; README section "Bones").
  - Clips: `web/public/assets/characters/v6/base/{v7_clips,v7_verbs,v8_clips,v8_staff,vb_clips}.glb`.
  - Runtime: `web/components/game/character/Character.tsx` (`Puppet` class, lines 235 to 631; see `CODEMAP.md`), `web/lib/game/character/{clips,rig}.ts` and their tests.
  - The head: v9/v10 (`specs/characters/head-roblox.md`, `head-v10.md`). David's 21 hairs attach the Roblox way (row 309). The faces are rows 302 and 306.
  - Outfits, hair and accessories: `art/characters/{outfits,hair,accessories}`. LODs: `art/characters/{lod1,lod2}`.

## Build, in order

1. **The skeleton.**
   - R15 exactly: Roblox's 15 joints and part names, its parent tree, pivots placed as on the reference rig (scaled to our body) and its rest pose.
   - Sockets become Roblox attachments, with Roblox's names (the hand grips replace `Socket_R_Hand` and `Socket_L_Hand`, `BodyBackAttachment` replaces `Socket_Back`, hair and hat at Roblox's points as today).
   - Built by script in Blender (a new `art/characters/r15/` beside `base/`) so a new body reruns it.
2. **The body.** One smooth, continuous skinned body: no blocks, no seams at the joints.
   - Roblox-like proportions: longer arms and legs than today's 3 heads tall.
   - "Snatched": a defined waist and clean shoulders and hips, like the modern Roblox bodies.
   - Our head, faces and David's hairs stay as they are.
   - Matte, our palette, the poly budget of today's body or less.
   - Weights so every R15 joint bends cleanly: elbows and knees keep their volume, and the waist twists without collapsing.
   - **References:** David is asked to send the modern Roblox bodies he means (catalog pages or screenshots, as with row 301). Until they arrive, model two or three variants from his words alone, so he can point at one: say slim, athletic, and between. Note on the evidence that they're from his words only. When his references arrive (the coordinator relays them), they win.
3. **The converter: Roblox animation to our clip.**
   - A script (Node, in `web/scripts/`, or Python in `art/characters/r15/`) reads a `KeyframeSequence` from `.rbxmx`. Add `.rbxm` binary if a maintained parser is cheap to use; otherwise say so. It also reads curve animations if you can, or reports that it can't.
   - It writes a glTF animation clip on our rig: each pose's rotation to the bone of the same joint, the Root's translation scaled by our height against the R15 template's, and easing sampled to keyframes.
   - Unit tests on hand-written `KeyframeSequence` files: a single elbow bend, a nested pose tree, an easing curve and a root move.
4. **A Studio-ready rig.**
   - Export our character (rig and skinned body) in the form Studio's 3D Importer takes (FBX or glTF), so David can animate our actual body in Studio, not only the stock R15 dummy.
   - Write the exact steps for David in `specs/characters/roblox-animation.md`:
     - import;
     - animate in the Animation Editor;
     - Save to File as `.rbxmx`;
     - drop the file in the folder the converter reads (`art/characters/r15/studio/`).
   - Keep the steps short, with no Studio jargon he doesn't need.
5. **Port today's clips.**
   - Retarget the existing clips (idle, walk, run, the verbs, the emotes, volleyball, the staff) from the Mixamo rig to R15, so the game keeps moving on the new body.
   - Same timing; fix by hand where retargeting breaks (the shoulder shrugs that lived on the clavicles have nowhere to go: say where that shows).
6. **The game on the new rig.**
   - `Character.tsx`, `clips.ts`, `rig.ts`, the held items, the weapon sockets, the hair and accessory attach, the LODs and the creator's portrait all run on R15. Tests updated.
   - **Outfits, hair and accessories:** refit what has to move with the new body.
     - If refitting the whole wardrobe is big, refit a representative set first (two tops, two bottoms, a one-piece, three hairs, a hat, glasses, the backpack) and list the rest with an estimate.
     - Stop there and report rather than refitting everything before David has picked a body.

Stop after steps 1 to 4 plus a first pass of 5. Report so David can pick a body before steps 5 and 6 are finished.

## Evidence

All of it is headless. Use the blender lock for renders.

- `br-skeleton`: the R15 skeleton beside the reference rig's joints (front and side), labelled.
- `br-body`: each body variant as a turntable mp4 plus stills (front, side, three quarter), beside today's body, with the head and a hair on.
- `br-bend`: each variant's joints bending (elbow, knee, waist twist, shoulder raise, hip lift), as one clip.
- `br-clips`: idle, walk and run on the new body in game (the new world, desktop).
- `br-convert`:
  - a hand-written `KeyframeSequence` converted and playing on our character;
  - the converter's test output;
  - a frame-by-frame overlay of a converted pose against the expected joint angles.
- `br-studio`: the exported Studio rig file, and the steps page.
- `br-questions`: the 22-joint question if it applies, the clavicle loss, the wardrobe refit size, anything else.

Gates:
- tsc clean;
- vitest (new world, once);
- lint on touched files;
- `perf:check` once at the end on the new world scene (characters changed);
- pack every GLB written into `web/public` (`cd web && node scripts/pack-glbs.mjs <files>`).

## Rules for this lane

- Never fetch art references. Roblox's official reference rig is the one OK'd technical template.
- Never ship a Roblox mesh, texture or animation.
- Never open Roblox Studio, or any window, app or audio on David's screen. Studio is David's to run.
- UI you touch (the creator) is the flat kit only (rows 334 and 335).
- Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`, under `LANE=game/body-r15 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender ...`.

## Status

- Not started.

## Next

1. Read this file, `specs/design-bible.md` (Models), `art/characters/base/README.md` (the rig sections), `specs/characters/head-roblox.md` section 1, then `CODEMAP.md`'s character rows.
2. Steps 1 to 4, then the first pass of step 5.
3. Gates, evidence, update this file, commit and report.

## Tools and gotchas

- New worktree: `node_modules` is cloned (`cp -Rc`), and `web/.env.local` is symlinked to the main checkout's.
- Locks: `LANE=game/body-r15 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`.
- Never use ports 3000, 3300, 3301 or 3390.
- Stale `.next/types` can break tsc: `rm -rf web/.next/types web/.next/dev/types`.
- The R15 reference FBX: fetch it from `github.com/Roblox/avatar` headless into an untracked folder (it's a technical template, already used in `skull.json`). Never commit it.
