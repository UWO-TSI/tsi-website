# Head v10: our head, rounder; detail by situation; the hair colour wheel

Ledger row 311 (specs/playtest-round1.md, "Head, detail tiers and hair colour"). Branch `game/head-v10`. Evidence:
`specs/evidence/head-v10/`.

**What David said (2026-10-14, after trying the 21 in the creator):**
- "hair dips weird, weird spots of scalp is showing, headshape overall a little weird, face doesnt have to be flat, a
  little to rectangley".
- "the hair color needs more choices like color wheel picker, doesnt need to reset all hair color option cuz it lags
  whenever changing hair color, also some hair color is glitching and being weird".
- "high def when close up like for photo mode or clicking into profile, a medium when close in in combat and a low when
  zoomed out".
- He chose "Keep tuning our head" over the full Roblox classic head. He gated the wheel with "Unlock by buying a dye".

## 1. The v10 head (`art/characters/base/head_shape.py`, `JAW`)

One round solid on the classic head's own axis (`_inside`, `skull_radius`):

| Zone | v9 | v10 |
|---|---|---|
| Above the classic centre (crown, back, sides, forehead, the face down to the eyes) | the classic head; v8's flat face plate blended in front | the classic head, the face included: its round plan |
| Below the centre (cheeks, jaw, chin) | v8's rounded box: square jaw corners, flat chin | an ellipse-like jaw (`q` 2.4 at the sides, `q_front` 4.0 under the face) into our chin: `depth` 0.235 m below the classic centre, `front` 0.04 m lower in front |

- Width, crown and chin height stay ours: the chibi proportions are unchanged.
- The eyes, mouth and blush are the same atlas and anchors. The face chart is re-solved on the new surface (eye lat
  -5.1, lon 28.8; mouth lat -37.9).
- The head mesh keeps v7's topology at 744 triangles (`skull/build_head.py`), so the base GLB, the under-caps and the
  budgets are unchanged in kind.
- Where v10 differs from Roblox's head:
  - the jaw is up to 2.3 cm inside its straight sides at the cheeks and nape;
  - the chin is up to 4.7 cm out under its underside in front;
  - elsewhere the difference is 0.
- The thin pink arc above the default eyes is F1.1's eyelid crease (`v7/build_face.py` `f11_deco`, `C_CREASE`), part
  of the eye cell. It is not a brow, and the engine draws no brow layer.

**Not changed: the crown.** The crown keeps the classic head's flat top and straight sides, because that is what the
hair rests on. On a bald style (#01 sprout, #20 fade) the top still reads as Roblox's. A rounder crown fillet would
need the jaw rule's rest step on the crown as well. That is not done, and David hasn't asked for it.

## 2. Hair on v10 (`art/characters/hair/import_hair.py`)

**The jaw rule replaces the face rule.** It acts only below the classic centre, so above it no hair moves at all.

- In: hair resting on Roblox's head (within `REST_H` 6 mm) follows our rounder jaw inward, fading over `REST_FADE`.
  Fades and nape lines keep hugging the head; hair hanging free stays where Roblox hangs it.
- Out: hair near the chin moves out over it by the difference plus 3 mm, fading over at least twice the move.
  - The largest out-moves are #6 windy bob (4.6 cm) and #17 (3.4 cm).
  - v9's face rule moved #6 by 7.2 cm and moved every fringe and side lock at the face corners.

**Other import steps:**

| Step | What it does | Why |
|---|---|---|
| `lift_shell` | #20's fade (`undercap: false`) sits `SHELL_CLEAR` 5 mm over the head mesh | The head's flat faces stand up to 5 mm proud of the skull and showed through as skin spots |
| Fringe under-cap | Under a fringe the matte under-cap reaches down the forehead to geo lat 16°, within ±70° of the face, where all five samples meet the hair within 8 cm | The skin wedges between fringe locks (the bob's parting) go dark like hair. Adds 4-12 triangles a style. |
| Smooth normals (`kit.weld_normals`) | At each vertex, corners within 75° of each other take their mean; the two sides of a folded card stay apart | Removes the source's stray hard edges |
| `build_lod.py` `card_normals` | Each decimated corner takes the smooth normal of the nearest full corner on the same side of its card, instead of reshade's sharp edges over 40° | LOD 1 and LOD 2 keep Full's smooth shading |

Hard edges (vertex positions whose corner normals differ by 1-60°, `specs/evidence/head-v10/hard_edges.py`):

| Tier | v9 | v10 |
|---|---|---|
| Full | 1,520 | 34 |
| LOD 1 | 4,600 | 86 |
| LOD 2 | 4,299 | 12 |

**Shading maps (`shade_map`):**
- The map is normalised in lightness (CIE L*): each texel's L* against the part's median, over its interquartile
  range (at least 6), squashed by tanh into a gain from x0.61 in the gaps between strands to x1.11 on a highlight.
- The luminance ratio it replaces turned near-black sources' noise and painted highlights into 2-10x streaks that
  clipped bright in light colours.
- Accent masks lose blobs narrower than `2 x speck + 1` px (default 3; #20's fade 24). The visor's logo is kept whole,
  so it stays #E9B530.
- The engine's hair shader no longer divides the vertex colour back out (Character.tsx, program key v3). That division
  blew a tint with a near-zero channel up into the accent mask's noise.

## 3. Face limits for a round face (`fit_check.py`)

A round face turns David's widest and lowest parts further round than v8's flat plate did. The whole set is now held
to what v10 does with them, and the default parts keep the flat face's limit:

| Measure | v8/v9 limit | v10 measured | v10 limit |
|---|---|---|---|
| Stretch (worst painted triangle) | 1.2 | 1.642 | 1.7 |
| Anisotropy | 1.3 | 2.27 | 2.35 |
| Eye reach (azimuth) | 55° | 58.6° | 60° |
| Facing, any eye or mouth pixel | 52° | eyes 62.8°, mouths 58.5° | 64° |
| Facing, the default eyes F1.1 and mouth M1.1 | (52°) | 46.1° and 36.8° | 52° |

- The worst cases are the big jaw-corner triangles under swirl, doll_lash and offset (U 0.04-0.12, down to W 0.88) and
  the drool mouths at W 1.0.
- Renders on v10: `07-extreme-faces-v10.webp`.

`fit_check` PASSes with 1 flag: #20's skin-through at its nape rim, the same flag as v9 (`fit-check.txt`).

## 4. Detail by situation (`web/lib/game/character/lod.ts`)

| Situation | Mesh |
|---|---|
| The creator, the closet, the reflection creator | Full always (`lod={false}`) |
| `close`: photo mode, or a player whose card is open (`detailFocus.ts`, set by `net/cards.ts`) | Full up close; the size rule further out |
| `play`: everything else, combat and you included | LOD 1 at the nearest; LOD 2 when the follow camera's zoom is past `ZOOMED_OUT` 1.3 (15% hysteresis), or past the far line |

Animation rate and the sun shadow still step down by distance and drawn size in every situation.

Measured on the island with 24 bots, characters drawn per frame (median over 2 s, `tiers.json`):

| View | Full | LOD 1 | LOD 2 |
|---|---|---|---|
| Play, zoom 1 | 0 | 21 | 4 |
| Play, zoom 0.6 | 0 | 21 | 3 |
| Zoomed out, 1.6 | 0 | 0 | 25 |
| Photo mode | 10 | 9 | 4 |

The perf probe now also counts `fullMeshes` and `lod2Meshes`.

## 5. The hair colour wheel

- **The look:** `hairColor` ("#RRGGBB", `look.ts`) tints the hair over the palette index `hair`.
  - `parseLook` keeps only a valid hex (upper-cased) and drops anything else. Looks saved before it load unchanged.
  - The profile route validates looks through `parseLook`.
  - Picking a preset clears the custom colour.
- **The control:** `components/game/character/ColourWheel.tsx`, beside the presets, in the studio creator, the closet,
  the fitting room and the reflection creator.
  - A hue and saturation disc, a brightness slider and a hex field.
  - Keyboard: the arrows turn the hue and change the saturation.
  - A drag counts as one change at most every 160 ms (the reflection creator's ripple).
- **The gate (David: "Unlock by buying a dye"):** owning any of the 6 shop dyes unlocks it (`customHairUnlocked`;
  `CUSTOM_HAIR_FREE = false`).
  - Without one, the wheel shows greyed with "Buy any hair dye at the shop to unlock custom colours."
  - The server refuses a custom colour without a dye: `lookRefs` asks for `hair:custom`, which `ownsRef` grants to
    any dye.
  - `ownership.test.ts` covers both cases. No migration: the dyes are existing shop items.
- **No lag:**
  - Only the preview re-tints: one merge per change, deferred by Character.
  - The hair tiles are static WebPs, baked once at build time on the default head in a neutral colour (#8F8379)
    by `app/lab/hairthumbs` and `web/scripts/bake-hair-thumbs.mjs`. That's 21 files, 156 KB.
  - They show 5-26 ms after the Hair tab opens, with nothing baking, and a colour change redraws none of them.

## 6. Re-running

After an attachment or a head change:
1. `skull/skull.py`, then `skull/build_head.py`, then `base/build_clips.py -- head v8`.
2. `accessories/build_accessories.py`, then `build_lod.py <accessory ids>`.
3. `hair/import_hair.py` (it runs build_lod and the sync).
4. `fit_check.py`.
5. With a dev server on PORT: `web/scripts/bake-hair-thumbs.mjs`.

## 7. Cost

`perf:check` (`SCENES=village,cafe`, one run, the machine's load 5.3-6.0; `perf-check.txt`):

| Scene | Tier | Median frame ms | Triangles |
|---|---|---|---|
| village | High | 5.3 (baseline 3.9; head-roblox 4.9) | 554,820 (budget 560,000; head-roblox 592,191) |
| village | Lite | 3.1 (2.3) | 360,088 (head-roblox 381,324) |
| cafe | High | 2.1 (2.1) | 77,834 (head-roblox 86,903) |
| cafe | Lite | 1.8 (1.5) | 75,487 (head-roblox 84,782) |

- LOD 1 in play brings the village back under its triangle budget.
- The frame medians are over the baseline: +36% in the village on both tiers, +20% in the cafe on Lite. They were
  measured on a loaded machine (spread 15-16%) and not repeated, by the rule.

## 8. Known limits

- The crown is the classic head's (section 1).
- David's widest and lowest face parts turn further round the face than on v8 (section 3).
- The jaw rule still moves #6's and #17's locks out over the chin, by 4.6 and 3.4 cm.
- 18 of the 21 attachments are still provisional (head-roblox section 4).
- The hair tiles are neutral-coloured by design; the preview shows the colour.
- #12's source texture paints dark bands on its locks; they stay, at the normalised contrast.
