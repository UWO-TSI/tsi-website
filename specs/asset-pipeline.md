# The asset pipeline: the fixed frames

Ledger row 339 (David, 2026-11-18): every asset that needs iteration runs through `/delegate`, with Opus as director and QA. The loop runs until Opus is satisfied, capped at 100 rounds. Then, on how: "be more specific on what you will do, like which specific angle shots will you produce for the sheet so that its consistent, like have a frame for it so we gen consistent result". Row 340, the same day: "each model and object need a blue print, not only the hero shot but also exploaded view, and docuemtn the dimentions the colors the moving parts the materials the texture the animation and effects" (§1.5).

This file is that frame. Every asset of a kind gets the same shots, the same framing, the same prompt skeleton, the same sheet layout and the same blueprint. The only thing that changes between two rods is the description. Layout pictures: `specs/asset-pipeline/frame-*.webp`.

## 1. Models

### 1.1 Rules for every generated shot

| Rule | Value |
|---|---|
| Image model | GPT-Image-2.5 Sunburst (`gpt-image-2.5-sunburst`) or GPT-Image-2.6 Sunburst (`gpt-image-2.6-sunburst`), David's two (2026-11-18). One model for every shot of an asset, recorded in the manifest; never mix the two inside one sheet. Default 2.5 Sunburst: it is the one the public API runs with the key (§5). 2.6 is only reachable through the signed-in ElevenLabs MCP. The same model draws the VFX sprite sheets (§3). Quality `high`, resolution `2K`. |
| Reference images | The family's collage (§1.7) for the hero. Every later shot also gets the approved hero and, once it exists, the approved front (or profile). |
| Background | Flat pure white `#FFFFFF`. No floor, no ground shadow, no gradient, no text, no labels, no frame lines, no other objects, no hands. |
| Light | Soft and even from the upper front-left, the same in every shot. A glowing part glows on the object only. |
| Projection | Orthographic (no perspective) for every view except the hero and the close-ups. The camera is level and exactly on the view's axis. |
| Fill | The object is centred and spans 80% of the canvas along its longest on-screen side, leaving a 10% margin. Nothing is cropped. |
| State | Rest state. A rod is unextended with its line wound, and a door is closed. A character stands in an A-pose: arms 30 degrees out, palms in, feet under the hips, face neutral, looking ahead. |
| Takes | 1 per shot. If Opus rejects it (§1.6), one more take, up to 3. After 3 failed takes, stop that shot and show David. Every take spends credits; a take is never re-called to retry a failure. |

### 1.2 The shots, by family

The axes are the game's: front faces the camera at the start, right is the object's own right, and up is up.

**A. Props, furniture, buildings, creatures that stand** (canvas 1:1)

| # | File | View |
|---|---|---|
| 1 | `hero` | Three-quarter front-right: the camera 45 degrees to the object's right of front and 25 degrees above. Gentle perspective. This is the look David approves first. |
| 2 | `front` | Orthographic, straight on from the front. |
| 3 | `right` | Orthographic, from the object's right. |
| 4 | `back` | Orthographic, from behind. |
| 5 | `left` | Orthographic, from the object's left. Only when the left is not a mirror of the right; otherwise the sheet shows `right` mirrored and says so. |
| 6 | `top` | Orthographic, straight down. The object's front faces the bottom edge of the canvas. |
| 7 | `bottom` | Orthographic, straight up. The front faces the top edge. Skipped for buildings and anything that sits flat on the ground. |
| 8-10 | `detail-1` to `detail-3` | Close-ups of the three details named in the brief, each straight on, filling 80%. |
| 11 | `exploded` | The hero's camera. The object taken apart: every separate part pulled straight out along the direction it fits on, with even gaps, each part still facing the way it does when assembled, nothing overlapping. A building comes apart in storeys and roof, with its door and windows pulled out in front. |

**B. Long items: rods, tools, weapons, fish** (canvas 16:9 for the long views, the long axis horizontal)

In every view the grip (a fish's head) is on the left and the tip (the tail) is on the right. The long views were 3:1 until David's mark on Asset Frames 1 ("why is the frames so horizontally long"). At 80% fill the item's length sets its size, so a 16:9 frame draws it just as big.

| # | File | View |
|---|---|---|
| 1 | `hero` | Canvas 1:1. Three-quarter: the item lies on a diagonal from lower left to upper right at 30 degrees, the camera 25 degrees above. Gentle perspective. |
| 2 | `profile` | Canvas 16:9. Orthographic side view of the side with the most detail (a rod's reel side, a fish's left side). |
| 3 | `profile-other` | Canvas 16:9. Orthographic, the opposite side. Only when it differs. |
| 4 | `top` | Canvas 16:9. Orthographic, straight down. |
| 5 | `bottom` | Canvas 16:9. Orthographic, straight up. |
| 6 | `end-grip` | Canvas 1:1. Orthographic, looking along the long axis at the grip (head) end. |
| 7 | `end-tip` | Canvas 1:1. Orthographic, looking at the tip (tail) end. |
| 8-10 | `detail-1` to `detail-3` | Canvas 1:1 close-ups of the three named details (for a rod, say the reel, the grip and the tip ornament). |
| 11 | `exploded` | Canvas 16:9. The profile view, orthographic. The parts slid apart along the long axis with even gaps; parts that sit on the side (a reel, fins) pulled straight out above or below their seat. |

**C. Characters** (canvas 1:1)

| # | File | View |
|---|---|---|
| 1 | `hero` | Three-quarter front-right, 15 degrees above. A relaxed standing pose. Gentle perspective. |
| 2 | `front` | Orthographic A-pose, from the front. |
| 3 | `right` | Orthographic A-pose, from the character's right. |
| 4 | `back` | Orthographic A-pose, from behind. |
| 5 | `left` | Only when the character is asymmetric (a bag strap, a one-sided hairstyle). |
| 6 | `face-front` | Close-up of the head and shoulders, straight on. |
| 7 | `face-right` | Close-up of the head and shoulders from the right. |
| 8 | `hands` | Both hands at rest, palm and back, side by side. |
| 9 | `feet` | Both feet (or shoes), front and side, side by side. |
| 10 | `exploded` | Canvas 16:9. Orthographic, from the front, in the A-pose. The body in the centre, split at the R15 joints with even gaps: head, upper and lower torso, upper and lower arms, hands, upper and lower legs, feet. Hair, headwear, each piece of clothing and each accessory lifted off and set beside the body at the height where it is worn. |

Humanoid mobs (anything that stands on two legs with arms) use this list.

**D. Creatures and mobs that aren't humanoid: animals, slimes, flyers** (canvas 1:1; David on Asset Frames 1: "add a character sheet for mobs")

| # | File | View |
|---|---|---|
| 1 | `hero` | Three-quarter front-right, 25 degrees up, in its natural idle: standing on all fours, sitting, or hovering with wings spread. Gentle perspective. |
| 2 | `front` | Orthographic, from the front, in the same idle pose (wings spread, tail out). |
| 3 | `right` | Orthographic, from its right. |
| 4 | `back` | Orthographic, from behind. |
| 5 | `top` | Orthographic, straight down, head toward the bottom edge. A low or flying creature reads from above in play. |
| 6 | `face-front` | Close-up of the face, straight on. |
| 7 | `face-right` | Close-up of the face from the right. |
| 8, 9 | `detail-1`, `detail-2` | The two parts named in the brief (a tail, wings, a shell, a weapon). |
| 10 | `exploded` | The hero's camera. The parts pulled away from the body with even gaps (head, legs, tail, wings, shell, horns), each still facing the way it does when attached. |

### 1.3 The prompt skeleton

Every shot's prompt is these five blocks in this order. Only `[ASSET]` and `[VIEW]` change between shots, and `[ASSET]` stays word for word the same across all the shots of one asset.

```
[STYLE]  the family's style sheet, the "for the image model" paragraph, verbatim
[ASSET]  <name>, <rarity>: David's description, verbatim
[VIEW]   the view's line from §1.2
[FRAME]  A single object on a pure white background (#FFFFFF). No floor, no shadow, no text, no labels, no other
         objects. <Orthographic projection, camera exactly level and on axis, no perspective. | Gentle perspective.>
         The object is centred and fills 80% of the image along its longest side; nothing is cropped. Soft, even studio
         light from the upper front-left.
[MATCH]  (every shot after the hero) Exactly the same object as the reference image: the same parts, colours,
         materials, proportions and number of pieces. Change only the camera angle.
```

For `exploded`, `[MATCH]` reads instead: "Exactly the same object as the reference image, taken apart: the same parts, colours, materials and proportions, every part shown once. Change only the spacing between the parts. No lines, arrows, numbers or labels." The numbers are added by script on the blueprint (§1.5).

### 1.4 The model sheet (composed by script, not generated)

A script (`art/pipeline/sheet.py`, written on the first run) puts the approved shots on one 4096 x 2304 white sheet:
- **Header:** the name, the family, the rarity, the target size in game units, the triangle budget, the date, the image model and the ElevenLabs flow id.
- **One scale:** the script measures each orthographic silhouette against the white and scales the views so the shared sides agree:
  - front height = right height = back height;
  - front width = top width;
  - right width = top depth.
  It draws a shared baseline, the centre lines, a 1-game-unit scale bar and the target-size line.
- **Consistency check:** a shared side that differs by more than 5% between two views is drawn in red with its percentage. That view is regenerated before modelling.
- **Layouts:**
  - Family A: front, right, back and left on row 1; top, bottom and the hero on row 2; the three details on row 3.
  - Family B: row 1 is profile, profile-other and top (16:9); row 2 is bottom (16:9), the hero and both end views (1:1); row 3 is the three details.
  - Family C: front, right, back and left on row 1, with a head-height ruler (how many heads tall) and lines at the chin, shoulders, waist, hips and knees; the hero, both face close-ups, the hands and the feet on row 2.
  - Family D: front, right, back and top on row 1, with the 2 m player's silhouette beside the front view for scale; the hero, both face close-ups and the two details on row 2.
- **Files:**
  - the shots: `art/pipeline/concepts/<family>/<asset>/<view>.png`;
  - the sheet: `<asset>-sheet.png`, and its second page, the blueprint: `<asset>-blueprint.png` (§1.5);
  - `<asset>.json`: each shot's prompt, model, take number, credits and flow id;
  - `<asset>.blueprint.json`: the blueprint's record (§1.5).
  - Full-size PNGs stay out of git. The sheet and the blueprint are committed as webp, with the blueprint's JSON.

### 1.5 The blueprint

Row 340 (David, 2026-11-18): "each model and object need a blue print, not only the hero shot but also exploaded view, and docuemtn the dimentions the colors the moving parts the materials the texture the animation and effects". Every model gets a blueprint as its sheet's second page: the exploded view with every part numbered, and a record of the seven things David named. The worker builds from the blueprint, and Opus checks the model against it number by number. Layout: `frame-blueprint.webp`.

**The record:** `<asset>.blueprint.json`, written by Opus once the shots pass §1.6. One entry per part, numbered in the order the exploded view reads (left to right, top to bottom).

| What | Recorded | Where it comes from |
|---|---|---|
| Dimensions | The whole asset's length, width and height in metres at game scale (the player is 2 m). Each part's size. The pivot: where it meets the ground or the hand. The front direction. | The family style sheet's size range for the rarity, then measured off the orthographic shots at the sheet's one scale (§1.4). |
| Colours | One hex per part, and the palette: every colour once, with the parts that use it. | Sampled from the front (or profile) shot at each part, then snapped to the family style sheet's palette, within its colour count. |
| Materials | One per part, from the game's presets: wood, stone, metal, paint, glass, cloth, leather or velvet (`P_Wood` and so on, `web/lib/game/modelMaterials.ts`). Characters use their `Character*` materials. A glowing part also records its emissive colour and strength. | Opus, from the description and the shots. |
| Textures | `none` (flat colour with the shared top-light gradient) unless a texture shows in play. When one does: what it paints (grain, weave, a face, a label), its size in pixels within the family budget, and its file. | Opus. The default is none: textures only where they show (lane rules). |
| Moving parts | For each part that moves: the pivot point in metres, the axis, the range (degrees or metres), the rest position, and what drives it: an animation clip, the rig or game code (a fishing line). In the GLB a moving part is its own node with its origin on the pivot, or a bone. | Opus, from the description. |
| Animation | Each clip the asset needs: name, length in seconds, loop or once, which parts move and how far, and its reference (an ElevenLabs video or David's Studio clip, §4). A prop that never moves says `none`. | Opus. References per §4. |
| Effects | Each effect: name; socket, an empty named `FX_<Name>` in the GLB at the point the effect attaches; trigger (always, while held, on use, on a catch, at night); colours; loop or once, and its length; its VFX sheet (§3). | Opus, from the rarity and the description. Effects are never drawn in the shots or built into the mesh: the model carries only the sockets and a glowing part's emissive colour (auras are rarity effects, rod style sheet). |

Each part also records `explode`, the direction and distance it moved in the exploded shot, so the worker's exploded render can match it; and `callout`, where its number points on the exploded shot (x and y as fractions of the image), placed by Opus.

**The page:** `art/pipeline/sheet.py` draws it at 4096 x 2304, laid out as in `frame-blueprint.webp`:
- **Header:** the model sheet's header, then the palette strip: every swatch with its hex and its part numbers.
- **Left:** the exploded shot, with a numbered circle and a leader line on every part.
- **Top right:** the parts table: number, part, size, colour swatch and hex, material, texture, and whether it moves.
- **Middle right:** the dimensions, drawn on the front (or profile) silhouette: overall length, width and height, the pivot marked, and the 2 m player beside it at the same scale.
- **Bottom:** three panels:
  - moving parts: pivot, axis, range, driven by;
  - animation: clip, length, loop or once, what moves;
  - effects: socket, trigger, colours, length, sheet.

**By family:**
- **A:** the usual moving parts are hinges, lids, drawers and wheels. A building lists its doors, the windows that light at night (emissive), and sockets for smoke or lamps.
- **B:** a rod's moving parts are the reel handle and the tip; the line and bobber are game code, recorded as such. A fish lists its tail, fins and jaw, and the body bend it swims with.
- **C:** the parts are the R15 body parts plus hair, clothing and accessories. The moving parts are the rig (the 23-bone advanced R15, `TREE` in `art/characters/r15/build_body.py`), the face (blink, mouth) and any extra bones for hair or cloth (`Hair_*`, `Cloth_*`). Clips: Idle, Walk, Run and the character's own.
- **D:** the parts are the creature's body pieces. The moving parts are its bones, part by part. Clips: its idle, its movement and the actions in its mob spec.

**Approval:** the sheet and the blueprint go to David on one review page before the worker starts. His marks change the blueprint; shots are only regenerated when he says so.

### 1.6 What Opus checks on each shot, before the sheet

1. The background is white, and there is no text, floor or shadow.
2. Orthographic views are orthographic: parallel edges stay parallel and nothing shrinks with distance.
3. The view is the one asked for, on axis and level.
4. The object is centred, not cropped, and close to 80% fill.
5. It is the same object as the hero: the same parts, colours and proportions, and the same number of pieces.
6. The exploded shot shows every part from the other shots exactly once, apart and not overlapping, with no lines, arrows or numbers.

A shot that fails gets another take (up to 3, §1.1).

### 1.7 From the sheet and the blueprint to the model

1. The brief to the `/delegate` worker names the sheet, the blueprint and its JSON, and the triangle budget.
2. The worker models in headless Blender, with the orthographic views set up as blueprint planes at the blueprint's size:
   - front (or profile) on the XZ plane;
   - right on YZ;
   - top on XY.
   `art/pipeline/blueprint.py` on `game/tool-pipeline` already crops the views, sets the scale and measures the silhouettes; reuse it.
3. The model follows the blueprint exactly:
   - one node per part, named as in the blueprint;
   - materials named by preset (`P_Wood`), with each part's hex as its colour;
   - each moving part its own node with its origin on the pivot, or a bone;
   - an `FX_<Name>` empty at every effect socket;
   - the clips named and timed as in the blueprint.
4. The worker renders the model from exactly the sheet's angles, at the same 1:1 or 16:9 framing, and once more exploded: each part moved by its `explode`, from the exploded shot's camera.
5. `art/pipeline/check_blueprint.py` (headless Blender, written on the first run) checks the GLB against the blueprint and prints a pass or a fail per line:
   - the overall size within 3% on each axis, each part within 5%;
   - the same parts, by name and count;
   - each part's colour hex exact, its preset, and no texture beyond the ones recorded;
   - each moving part's origin within 1 cm of its pivot, turning on the recorded axis;
   - every `FX_` socket present, within 1 cm of its point;
   - every clip present, its length within 0.05 s, looping as recorded;
   - the triangle, material and texture budget.
6. Opus sets each render beside its shot, reads the check, and lists the differences as numbered fixes. The loop repeats until every check passes and Opus is satisfied, at most 100 rounds.
7. Then the GLB is packed (`pack-glbs.mjs`), and the final renders beside the sheet and the blueprint go to David as a review page.

The family collage and style sheet come from the existing models:
- `art/pipeline/{rod,fish,gear}-style.md`, `collage.py` and `profile.py` are on `game/tool-pipeline`;
- a new family gets its own style sheet before its first generation.

## 2. Sound effects

- **The style sheet first:** `art/audio/sfx-style.md`, written once and given verbatim with every prompt. It sets the character (soft, wooden, toy-like, warm, never harsh or realistic-gritty), the loudness, the length rules and the words that work.
- **Generation:**
  - ElevenLabs sound effects;
  - 4 takes per sound;
  - prompt = style sheet + the sound's line from the sound list + its length.
- **Lengths** (the API makes 0.5 to 30 s, so shorter sounds are generated at 0.5 s and trimmed):
  - UI 0.1 to 0.6 s;
  - actions 0.3 to 2 s;
  - stingers up to 4 s;
  - ambient beds are 30 s seamless loops (`loop: true`).
- **Processing (the worker):**
  1. trim the silence;
  2. 10 ms fades;
  3. normalise to -16 LUFS (ambient -24);
  4. mono for one-shots, stereo for ambient;
  5. 48 kHz OGG into `web/public/audio/sfx/`;
  6. log the source in `SOURCES.md`.
- **QA:** Opus judges each take against the style sheet and its neighbours in the same set. One review page per batch: every take playable, one pick per sound.

## 3. VFX

- **The frame:**
  - one sprite sheet per effect, a 4 x 4 grid (16 frames) of 512 px cells, in the game's style;
  - a black background for additive effects (glows, sparks, splashes of light), transparent for the others;
  - one fixed camera through every frame: front-on, or top-down for ground effects;
  - the effect centred in every cell, at the same scale, with nothing crossing a cell edge;
  - the frames read left to right, top to bottom;
  - the last frame leads back into the first when the effect loops.
- **Use:** the sheet is the reference David rebuilds in Roblox Studio. The brain also cuts it into a looping preview and a frame strip on the review page so the motion can be judged before the Studio work.

## 4. Animation, cutscenes, character motion

- **The frame:**
  - an ElevenLabs video reference, 5 to 8 s;
  - a fixed camera on a plain light-grey background;
  - the character in the game's proportions (2 m, the body David approved), filling 70% of the height;
  - two takes of the same motion, one from the front and one from the side;
  - for a cutscene, one reference per shot of the storyboard, with the shot's camera named in the prompt.
- **Use:** David remakes the motion in Roblox Studio. The `.rbxmx` export goes in `art/characters/r15/studio/`, and `roblox-anim.mjs` converts it.

## 5. Calling ElevenLabs

The key is in the keychain as `elevenlabs-api-key` (David, 2026-11-18). Read it into a variable, pass it as the `xi-api-key` header, and never print it. The public API needs no MCP sign-in:
- **Images:** `POST /v1/flows/image` with:
  - `model_id`, `prompt`, `aspect_ratio` (`1:1` or `16:9`), `resolution` (`2K`) and `quality` (`high`);
  - `images`: up to 10 references (`inline_base64`, or a `generation` reference to an earlier result).
  Poll `GET /v1/flows/image/{generation_id}` for the result.
- **Video references:** `POST /v1/flows/video`, polled the same way.
- **Sound effects:** `POST /v1/sound-generation` with `text`, `duration_seconds` (0.5 to 30), `loop` and `prompt_influence` (default 0.3), on `eleven_text_to_sound_v2`.

The hosted MCP (`/v1/mcp`) takes only the OAuth sign-in, not the key. `/v1/user/subscription` hangs with this key, so the credit balance is read in the ElevenLabs dashboard.
