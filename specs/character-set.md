# Character set spec (unified Blender characters)

Owner: character agent. Decisions come from `game-world-development-plan.md` rows 105–146 (David, 2026-09-23). Do not reinterpret them; if something is missing, write the question in `specs/character-set-questions.md` and continue with what is decided.

## Style target

Primary reference (David's image #18): a low-poly, fully faceted, flat-shaded child-like character, about 3 heads tall, in a blue hood-and-dress, walking with a bouncy waddle. Every polygon is visible (hood, hair chunks, cheeks). Face is painted: almond eyes with dark irises, thin brows, a small pale nose highlight, tiny mouth; skin a warm tan. Chunky hands without fingers, short legs, white socks and yellow shoes. Secondary reference (#16): smooth ACNH-style Blender model with a big bun and huge round eyes; use only for proportion feel, not shading or eyes. A DS-era parts-picker screen (#15) and painted Villager concept art (#17) were also supplied for creator UI and pose energy. David will drop the images into `specs/references/characters/`.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Characters | 3D low-poly on a unified rig; 2D sprites retired | 105 |
| Proportions | ACNH-style, big head, ~3 heads tall | 108 |
| Face | Mii-inspired simplicity; painted almond eyes, brows, nose highlight; face texture with swappable eye/brow/mouth variants | 109, 132 |
| Shading | Fully faceted flat shading everywhere, face included; export flat normals | 131 |
| Poly budget | 600–1000 tris base body; ≤1500 with hair and outfit | 133 |
| Outfits | Separate top + bottom meshes, plus one-piece specials (hooded dress, robe) | 134 |
| Hair | 12–16 faceted styles incl. buns, braids, hats-with-hair; palette tinted | 135 |
| Props | None visible for peaceful tools; combat weapons visible everywhere once equipped, via hand sockets | 136, 140 |
| Materials | Flat solid-colour palette per part; face texture only; one decal slot on tops | 137 |
| Rig | Mixamo-compatible humanoid (~22 bones, standard names); hand-keyed signature clips | 138 |
| Motion | Bouncy toy walk: head bob, arm swing, slight waddle; run = fast scamper with lean | 139 |
| Clips at launch | idle, walk, run; sit, study, sleep; fish, forage, dig, net; wave, cheer, laugh, sad, dance | 111 |
| Creator parts | skin tone, hair style+colour, top+bottom+colour, accessories | 110 |
| Palettes | 12 skin, 12 hair, 16 outfit colours, one shared palette file | 143 |
| Expressions | neutral, happy, surprised, sad, angry, sleepy (face atlas frames) | 144 |
| Grounding | blob shadow on Light, cast shadows on High; no outline | 145 |
| Creator UI | ACNH creator layout in the Tethos palette (reference image supplied) | 141 |
| Creator entry | first member login and the applicant portal; carried over on hire | 142 |
| Residents | 8–12 fictional TSI-inspired humans on the same rig; authored text dialogue with portrait expressions | 85, 121–123 |

## STOP: v2 rejected 2026-09-23, research step before v3

David's verdict on v2: the feeling is off because the features are overcomplicated; it must look simple and cute, otherwise it reads uncanny. For v3: big wide eyes in the lower half of the face; forehead with hair and bangs; a chubby, cute head shape that is not a sphere; a smooth face (no triangles on the face; facets stay on hood, hair, clothes); stronger per-plane gradient (vertex-lit); shoes are a fifth outfit slot; brows tint with hair colour. Rule (David, 2026-09-24): never source references yourself. Model only from David's supplied images in `specs/references/characters/david/`.

### David's feature sheets (supplied 2026-09-24; files to be dropped into `specs/references/characters/david/`)

Described so an agent without the images can still work. Every feature below is a flat, painted, 2D-illustration style: solid dark shapes, no rendered lashes, no realistic anatomy.

1. **Doll eye sheet (2BF Studio, ~9 rows × 5 pairs).** The vocabulary for eyes. Each eye is a solid dark round or oval blob with at most one small white highlight, drawn on skin with no eye-white. Variants: plain dots; round blobs with a short curved upper lid line; round blobs with three tiny lash ticks on the outer top; half-moon (flat top, round bottom) blobs; small ovals; sleepy arcs; "> <" closed; "U" and "n" happy/closed arcs; ring eyes (thick circle with a hollow centre); square-ish blobs with a flat lower edge and a small lid line. Brows on this sheet are short thin flat dashes or absent. The read is toy/doll: eyes are the biggest feature and sit low and wide.
2. **Four-style flat eye sheet (sunshine_YB).** Dark grey rounded blobs with a thin grey brow above each. (a) round blob with a black lash flick at the outer top and a faint pink lower-lid line; (b) rounded square blob with a thick black arc over the top; (c) narrow tilted almond with a lash flick, slightly sleepy; (d) round blob under a thick black upper arc, wide awake. Eyes are set wide apart, brows short and soft.
3. **Chibi mouth sheet (monan, "Q版嘴巴", 7 rows × 3).** Tiny mouths in one thin dark-red line weight with pale pink fills: a flat "H" bracket, a small "3", a simple lower-lip line, an open pink smile with a white tooth line, a small triangle open mouth, a tiny pink dot, a small oval, a "人" shape, a wavy line, a rounded open shout, a gentle curve, a wavy smile, a smirk, a tongue-out, a cat "w", a "1" flat, a wide open grin, an open laugh. Mouths are 1/6 to 1/4 of face width, low on the face.
4. **Mouth grid sheet (9 rows × 7).** The same idea with more open-mouth fills: pink half-ovals with a white tooth line, small closed curves, tiny dots and triangles, a few teeth-showing smiles, all with a faint pink blush shadow under the mouth. Line weight thin and dark red.
5. **Half-lidded eye sheet (ジト目, 12 numbered variants).** Deadpan/sleepy eyes: a straight or slightly curved heavy upper lid line with a half-visible round or rectangular pupil below it, small cheek hatching. Use for the sleepy and unimpressed expressions only, not the default eye.
6. **Fluffy chibi hair silhouettes (yooshkaa, 6).** Lavender-white hair shapes drawn as one soft, spiky-edged mass around an empty face oval: swept side bangs, centre-parted fluffy bangs, thick straight bangs with side locks, wolf-cut fluff, long curtain bangs, flat bob with bangs. Shows hair as a single blobby silhouette with 4–6 pointed tufts, bangs covering the upper forehead.
7. **Sketched hairstyle sheet (15).** Line sketches on a head-guide circle: side-swept bangs with long straight hair, centre part, curtain bangs, wavy shoulder length, bob with full bangs, short pixie, side ponytail, low pony, layered fringe. Reference for how bangs sit on the forehead guide line (bangs start at the crown and end at eyebrow height).
8. **3D chibi hair set (35 styles, black, on blank faces).** A game-asset style hair library: bobs with straight bangs, side-swept short, spiky short, twin buns, single bun with ribbon, high pony, low pigtails, bowl cut, long straight with bangs, wolf cut, undercut, wavy long, braided crown, red bow accessory. This is the target for our 12–16 faceted hair styles: one solid mass with a few chunky tufts, bangs always covering the upper forehead.
9. **Bangs sheet (MONIGO-09, 30 on identical heads).** Fringe variations only: straight cut, see-through wispy, side-swept left/right, curtain, centre-split, spiky tufts, single long strand, hime side-locks, short choppy, swept back. Reference for the bangs slot.
10. **ACNH hairstyles (7 renders).** Top bun with bangs, bowl bob, side-part swept, twin braids with bangs, flipped bob with bangs, short side part, textured short. Shows how a solid hair mass reads on a big-head 3D character with big low eyes, small nose dot and a small mouth.

Face rule for v3 (from the sheets and David's words): big, wide, solid dark eyes with one highlight, sitting in the lower half of the face, wide apart; short soft brows; no nose or a single pale dot; tiny painted mouth from sheets 3/4; bangs always visible on the forehead; the head a chubby rounded shape, not a sphere; the face smooth (no facets), facets only on hair, hood and clothes. Hair is two parts: **front (bangs)** and **back**, chosen independently (row 191). Default face: soft short brows, **no nose**, blush/moles/freckles as optional extras in a features slot. **David's picks (row 192).** Labelled sheets with cell codes are in `specs/references/characters/david/LABELLED-*.png`; open and Read them.
- Eyes (creator set): all four styles on `LABELLED-eyes-four-styles.png` (F1.1–F2.2); on `LABELLED-eyes-doll-sheet.png` (6 pairs per row): E1.1, E1.2, E1.4, E1.6, E5.4, E5.5, E5.6, E6.1, E8.1, E8.4. Less-detailed eyes are preferred. Default eye: F1.1.
- Mouths (creator set): `LABELLED-mouths-chibi.png` M1.1, M1.2, M2.1, M2.2, M3.1, M3.2, M3.3, M4.2, M4.3, M5.2, M5.3, M6.1, M6.3; plus every cell of `LABELLED-mouths-grid.png` (G). Default mouth: M1.1 (the small flat bracket), expressions from the rest.
- Hair: two separate parts, **bangs** and **back**. Bangs reference: `LABELLED-bangs-sheet.png` (N, all). Hair library target: `LABELLED-hair-3d-set.png` (B, all) split into bangs/back parts; silhouettes: `LABELLED-hair-fluffy.png` (S, all). `LABELLED-hair-acnh.png` (A) is NOT a hair reference; it is the reference for how the wardrobe/creator displays the character (three-quarter bust, plain patterned backdrop).
- Face: soft short brows (tint with hair colour), no nose, optional blush/moles/freckles in a features slot.

## Deliverable 3 (now): outfits, accessories and the full clip set on the locked v6 base

v6 is locked (row 233). Build on `build_v6.py`, `head_shape.py` and the hair library; never modify the v6 body shape. Everything regenerable from scripts; separate GLBs per part that bind to the shared skeleton by bone name, like the hair GLBs.

Outfits (rows 110, 134, 137, 143): flat palette materials from `art/characters/palette.json`, one decal UV slot on every top, smooth-by-angle surfacing like v6, each piece ≤ 300 tris.
- Tops (8): the base tee, a hoodie (hood down, hides nothing), a cardigan, a striped long-sleeve, a collared shirt, a sweater vest over tee, a TSI crewneck (decal slot carries the TSI mark placeholder), a raincoat top.
- Bottoms (6): the base shorts, long trousers, a pleated skirt, overall shorts, jogger pants, a long skirt.
- One-pieces (4): the #18 hooded rain-cape dress (hood up variant hides back hair per row 191), a simple sundress, a robe, a jumpsuit.
- Shoes (6, their own slot): the #18 yellow slip-ons, sneakers, boots, sandals, loafers, rain boots.
- Accessories (8): round glasses, square glasses, beanie, sun hat, cap (hats hide back hair), a backpack, a shoulder bag, a scarf. Bags are worn, not held (row 136).
- Hats/hoods: set a `hidesBackHair` flag in the catalogue.

Clips (rows 111, 139, 49–53): keep Idle and Walk; add Run, Sit, Study (sitting, writing), Sleep (lying), Fish (cast + hold), Forage (crouch pick), Dig, Net (swing), Wave, Cheer, Laugh, Sad, Dance, plus combat: AttackMelee, AttackBow, AttackCast, DodgeRoll, Hit, Defeat, Trace (incantation stance, one hand forward). Bouncy toy feel per row 139; loops seamless; one-shots end on a neutral pose. Export every clip in `v6_clips.glb` on the base body, and verify each clip name and length with `web/scripts/character-inspect.mjs`.

Catalogue: `art/characters/character_catalog.json` listing every part (id, slot, GLB path, tris, palette slots, decal slot, hidesBackHair) and every clip (name, length, loop). The creator and wardrobe read this file.

Evidence: `outfits_sheet.png` (every top/bottom/one-piece/shoe on the base, front and 3/4), `accessories_sheet.png`, `clips_contact.png` (3 frames per clip), `dressed_examples.png` (6 complete mixed looks). Read each image before reporting. Log questions to `character-set-questions.md`, keep going.

## v4 verdict (2026-09-24) and v5 brief: the naked body base, measured from #18

David on v4: surfacing is right, but "face and head shape needs to be closer to reference, head is bigger, body proportions different. The outfit is accessory, not actual body. We are making the body base for now." So v5 is the base body only: no hood, no dress, no shoes (shoes are a slot), a plain body in skin tone with a simple neutral undergarment colour zone, plus the bangs/back hair and face. Do it by measurement, not by eye:
1. Open `specs/references/characters/david/character-ref-18.png`, measure in pixels: total height (crown of hood to sole), hood/head height and width, face oval height and width and its position inside the head, eye size and spacing and their vertical position on the face, shoulder width, torso length to the hem, leg length, hand size. Write the ratios to `art/characters/base/ref18_measurements.json`. The hood adds bulk; estimate the bare head as the hood minus one thin shell (~5% each side) and note the assumption.
2. Rebuild the base body so it matches those ratios: head height share of total, head width vs shoulder width, face oval share of head, eyes at the reference's vertical position (lower half), leg/torso split. Chubby cheeks and a soft chin as in #18; smooth everywhere.
3. Render v5 at the reference camera and produce `v5_vs_ref18.png` with the two images scaled to the same total height and a horizontal guide line at eye height, chin, hem and sole across both, so mismatches are visible. Iterate until the guide lines land within ~3% of height. Also `v5_front.png`, `v5_face_variants.png`, `v5_contact.png`.
Keep the face system, picked eye/mouth sets, brows-under-bangs, no nose, and the two-part hair.

## v3 verdict (2026-09-24) and v4 brief

v3 rejected: "the reference has less shape and defined triangles; v3 is full of triangles, which I don't like the style of." Look at reference #18 closely: the hood shows maybe six big planes, the dress is a soft bell with a handful of large facets, the hair is a few chunky masses; nothing is a dense mesh of small triangles. v4 keeps v3's head shape, face system, proportions and the two-part hair, but changes the surfacing everywhere:
- Smooth shading by angle (auto-smooth ~40–60°) so surfaces read soft; only large, deliberate planes stay hard-edged.
- Reduce the visible triangle density: fewer, bigger faces on hood, dress, hair; avoid triangulated fans on curved surfaces; the render must not show a "triangle skin".
- Hair: a few chunky masses with a handful of sharp tufts (S and B sheets), smooth across each mass.
- Keep 1297 tris or fewer; count is not the problem, visible facet noise is.
- F eyes: no highlight. Brows partly under the bangs. Back hair hidden under hoods/hats.
Renders as before, plus a side-by-side of v4 next to the #18 reference crop at the same angle, and Read it yourself: if you can count more than ~10 visible planes on the hood, it is still wrong.

## Deliverable 1, v3 (superseded): simple-cute head and face system on the #18 body

Goal: the head that David will say "yes" to. Build in this order and stop for review after step 3.

1. **Head shape.** Chubby, wide, rounded-cheek head, not a sphere: think a squashed egg with full cheeks and a soft flat chin, slightly wider than tall, forehead tall enough that bangs sit on it. Smooth shading on the face (no visible facets on the face); facets allowed on hair and hood. Same 3-head proportion and #18 body as v2 (keep `ref_girl.blend` body, cape, legs, socks, shoes; shoes become their own mesh so they can be an outfit slot).
2. **Face system.** Painted face atlas with swappable layers: eyes (default F1.1 from `LABELLED-eyes-four-styles.png`, then the picked E cells), mouth (default M1.1), soft short brows tinted with hair colour, no nose, optional blush ovals. Eyes are big, wide apart, in the lower half of the face; mouth small and low. Build the atlas from simple vector-like shapes drawn in the build script (PIL), not by tracing the sheets pixel by pixel. Provide a `face_variants.json` listing eye/mouth ids to atlas coordinates so the engine can swap them.
3. **Hair, two parts.** One default **bangs** mesh (a straight-cut fringe with side locks, from the N sheet family) and one default **back** mesh (a bob, from the B sheet family), as separate objects parented to the head bone, faceted, palette-tinted. Bangs must visibly cover the upper forehead.
4. Renders: `v3_face_34.png` at the #18 camera, a front view, and a 4×3 grid of the default head wearing 6 picked eye styles × 2 mouths (`v3_face_variants.png`), plus the walk contact sheet. Read each before reporting and compare to the sheets and to David's words: simple, cute, not uncanny.

Acceptance: David's verdict. Keep everything regenerable from `build_v3.py`.

## Deliverable 1, v2 (superseded): recreate reference #18 as the base

David reviewed v1 (2026-09-23): "everything is wrong, it doesn't have the proportions, just try your best to recreate this reference as body base and then we'll work off from reference." So v2 is a faithful recreation of the #18 character (our own mesh, same look), dressed as in the image. The modular base/outfit split is derived from it afterwards, not the other way round. Ignore the v1 bald tee-and-shorts body.

### Reference #18, described for modelling (the image is a 3/4 front view, slightly below eye level, character mid-stride)

Overall
- Total height ≈ 2.3 head-heights where "head" = the hooded head. The hooded head is ~45% of total height and wider than the body. Silhouette: a big teardrop head sitting on a bell-shaped hooded dress, short bare legs, chunky shoes. Read: a toddler in a rain-cape.
- Faceting: large, irregular triangles, roughly 8–14 visible planes across the hood in one view. Not a subdivided sphere; planes are sized like a hand-decimated model (~300–500 tris for head+hood). Edges are hard (flat normals) but each face shows a soft light-to-shade gradient (vertex-lit look), so lighting is flat-shaded with a warm key from upper left.

Head and hood
- The hood is one shell with the head: a rounded teardrop that is widest just above the eye line, tapering to a soft point at the top back; the front rim frames the face like a horseshoe from the crown down to below the chin. Hood colour: light sky blue (#7FBFEA-ish) with a slightly deeper blue in shadow planes.
- Inside the hood opening, the face is a flatter oval of warm light tan skin (#E8B58A-ish). Under the hood rim at the top of the face, dark brown (#6B3A22) hair bangs show as 3–4 angular chunks pointing down at different lengths, with a side part.
- Eyes: large almond shapes (each about a quarter of face width), set wide, slightly tilted down toward the nose. Dark brown iris fills most of the eye with a black pupil; a thin lighter rim; a small white catchlight upper-left. Thin dark brown brows, gently arched, sitting close above each eye. Eyes and brows are a painted texture on the face.
- Nose: a small geometric bump at the centre of the face, lighter than the skin (a paler cream plane), reading as a highlight; modelled, not painted.
- Mouth: a tiny short dark line below the nose. Cheeks: faint warm blush. No ears visible (hood covers them).
- The chin is soft but present: the face oval has a slightly flattened bottom sitting on the hood's neck.

Body
- A hooded cape-dress in the same blue: bell shape from the shoulders down to just above the knees, flaring out; the bottom hem is a slightly wavy polygon edge. Under the hem a hint of a pink/magenta underskirt shows (#E27AB0-ish).
- Sleeves are part of the cape: wide, tapering to the wrist. Hands are simple tan mittens (no fingers), one hanging at the side, the other holding a bag in the reference (omit the bag; keep the hand pose relaxed).
- Legs: short, skin-coloured, stubby, no knees. White ankle socks with a slightly rolled top. Shoes: chunky rounded yellow (#F0D24A) slip-ons, sole slightly darker.

Pose and motion
- Mid-stride: one leg forward, the other back, a slight lean, hood swaying. The walk should read as a bouncy toddler waddle (decision 139).

### Acceptance for v2
- One dressed character mesh matching the description: head+hood, face, bangs, cape-dress, sleeves, hands, legs, socks, shoes. ≤ 1200 tris total, flat normals, big irregular facets.
- Colours as above from `palette.json` (add the needed blues, pink, yellow if missing).
- Rig (Mixamo names, ~22 bones, sockets) and clips `Idle` and `Walk` as before; the cape hem and hood should move a little with the walk (weight the hem to hips/legs, hood to head).
- Deliverables: `art/characters/base/ref_girl.blend`, `ref_girl.glb`, `ref_girl_contact.png` (row 1: 8 idle angles incl. a 3/4 front matching the reference camera; row 2: 8 walk frames), `ref_girl.mp4` if ffmpeg exists, README section "v2 reference girl" with tri count and what differs from the reference.
- Self-review against the description before reporting: compare your 3/4 render to each bullet above and list mismatches in the README. Iterate at least twice on head/hood shape and eye size, which were the biggest v1 failures.

After David approves v2, deliverable 2 derives the modular base (naked base body under the outfit, hood-dress as a one-piece outfit, bangs as a hair style) from this mesh.

## Pipeline

- Blender 5.2 at `/Applications/Blender.app/Contents/MacOS/Blender`, headless `-b -P script.py` for repeatable builds. Keep the build script in `art/characters/base/build_base_body.py` so the model is regenerable; hand tweaks go through the script, not saved-only state. The live Blender MCP (`mcp__blender__*`, socket 9876) may be used for inspection and screenshots; a GUI instance may already be open.
- Higgsfield (`higgsfield` CLI) is available for reference or face-texture concept images only if the account plan allows (`z_image` runs on free; Nano Banana needs Basic). Do not spend credits without noting it in the README.
- Never generate a likeness of a real person.

## Out of scope for deliverable 1

Outfits, hair styles, accessories, residents, the creator UI, combat weapons, the applicant portal swap. Those are deliverables 2–5 after review.
