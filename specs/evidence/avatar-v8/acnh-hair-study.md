# ACNH hair study (avatar v8, 2026-10-01)

Study only. David: "Study them, don't ship them." The models stay in `~/Downloads/Assets/Model`. Every shipped hair stays our own model in our pipeline.

- Sheet: `acnh-hair-study.webp` (12 of the 48 `PlayerHair*` models: front, 3/4 and back, with no head, so the front view looks into the face window; plus PlayerHair00's textures).
- Renderer: `acnh_study.py`. Blender 5 has no COLLADA importer, so it reads the `.dae` itself and renders headless.

## What each one reads as, and why

| Model | Reads as | What does it |
|---|---|---|
| 05 | rounded bob | One smooth dome. A blunt fringe slab with a slight bevel. A straight hem that turns under. No lock grooves in the geometry. |
| 11 | hime bob | A smooth shell. A dead-straight fringe and hem. The sides fall as two flat panels. Only the texture draws strands. |
| 10 | long, centre part | A smooth mass parted by one crease. The lower third breaks into 5–6 soft wavy tips. |
| 09 | short, jagged | A smooth top. The fringe cut into 5 big pointed tips, the hem into about 10 small ones (a sawtooth). |
| 22 | fluffy short | A smooth dome. Many small flicks (about 16) poke out at the hem and over the ears, a few stand on the crown. The silhouette carries all the fluff. |
| 36 | afro | About 12 large round lobes scallop the outline. A dense curly noise texture. No straight strands anywhere. |
| 14 | short curls | Stacked curl rolls lying flat. The same curly texture. Dark. |
| 34 | box braids | A smooth mass with braid ridges lying flat over it. About 8 short hanging braids of 3–4 bead-like lobes each. |
| 04 | twin braids | A smooth mass and two braids of 3–4 lobes. The braids are separate from the mass. |
| 29 | side pony | A smooth helmet, a ribbon-like tail swinging from one side, and a small tie bump. |
| 35, 45 | twin buns, top bun | Smooth spheres sitting on a smooth dome. |

## The rules behind them

1. **One smooth mass, not locks.**
   - The head is covered by a single sculpted shell.
   - Locks are implied by the texture and by the outline.
   - The top of every straight style is a clean dome with no grooves.
2. **Only the outline breaks up.**
   - Clumps appear where the hair ends: the fringe edge, the hem, flicks over the ears, one or two on the crown.
   - They are sharp triangular points of fairly even size: 5–9 on a fringe, 10–16 round a hem.
   - A blunt style (05, 11) has none.
3. **Partings are a crease plus the texture direction**, not a gap between pieces.
4. **Curly and braided styles change the unit.**
   - The afro is built from about a dozen big round lobes with its own curly texture.
   - Braids are chains of 3–4 bead lobes.
   - Both sit on a smooth base mass.
5. **The texture does the strands and the depth.**
   - Albedo: near white with fine grey strand lines (0.86–1.0), tinted by the hair colour.
   - `Mix` red: baked shading (0.44–0.89), the main depth cue.
   - `Mix` green: the darker inner layer under fringe tips.
   - `Mix` blue: a highlight band. We skip it; we stay matte (row 264).
   - A normal map adds strand grooves.
6. **Budget.**
   - 432–2,000 triangles per style (median 1,540, over all 48). The fringe and back are one mesh, and 10 of the 48 sit at 1,990–2,000, an apparent cap.
   - One material.

## Against our v7 locks (and the v8 first pass)

| | Ours | ACNH |
|---|---|---|
| Structure | 6–23 separate swept locks per piece, laid side by side with grooves everywhere (v7: 12 mm deep) | One shell |
| Toy look | Comes from repeated ridges over the whole surface | Smooth top; the structure shows only at the edge |
| Tips | Every lock is a tapered tube, so tips read as round fingers | The cut edge itself is jagged: a flat sawtooth on the shell's rim |
| Strands | v8's first pass painted strands, but on top of the lock geometry, so the eye still reads tubes | Painted strands on a smooth mass |
| Triangles | The bangs/back split (≤ 1,200 each, about 1,900 together) | About the same as one ACNH style |

**Implication for the rework** (after David's game references land; nothing started):
- A back piece would be a sculpted shell with a cut, jagged rim and a few flicks.
- A bangs piece would be a fringe slab with a sawtooth edge.
- Strands and depth would be painted (the strand texture plus a baked shading map), not modeled.
