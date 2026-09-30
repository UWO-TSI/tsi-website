# Avatar v7: questions and assumptions (build agent, milestone 1, 2026-09-30)

None of these blocked the work; each one records the assumption I took. Art verdicts are David's. The sheets are in `specs/evidence/avatar-v7/`, starting with `01-styles.webp`, `02-vs-hair-3d-set.webp` and `05-blink-talk.webp`.

1. **Hair volume.** The lock tops over the crown stand about 6 mm above the library's hair volume, with about 7 mm of relief between locks. That keeps the existing hats, flower crown and circlet sitting on the hair. Hair-3d-set is a fuller, softer mass.
   - Assumption: stay near the volume the fit pass settled; judge the styles by their lock shapes.
   - If you want fuller hair, it is one constant (`RELIEF` in `hair_styles.py`), plus refitting the bands.

2. **Straight fringe height.** The bob's fringe ends at lat 10, just above the brows (brow top at lat 3.4). The brows stay fully visible, as avatar-fit asked, and the fringe sits at about v6's height.
   - Assumption: brows visible under the default fringe. The curtain and spiky bangs do touch the brow tips (row 209 allows it on non-default bangs).

3. **Replacing old ids.** Each new style took over the existing ids closest to it (below). Saved looks with those ids now show the lock styles.

   | New style | Took over |
   |---|---|
   | Short | `bangs_spiky` ("Spiky tufts") + `back_short_spiky`, renamed "Short layered" in the creator |
   | Bob | `bangs_straight` + `back_bob` |
   | Long | `bangs_curtain` + `back_long` |

   - Assumption: no new ids were needed. Say if "Short spiky" should come back as its own style.

4. **Sheen.** It's a stylized band that doesn't follow the sun: a lighter streak down each lock's ridge where the hair faces up toward the viewer, in the hair's own colour.
   - Assumption: a clear but soft band (0.7 mix). Hair-3d-set's highlights are whiter and stronger; that's one line in `faceMaterial.ts`.

5. **Talking mouth.** It cycles G5.2, M3.1, G5.1, G1.3 and the look's own mouth, about 9 changes a second.
   - Assumption: stay in the size family of M1.1, David's default. At village distance that reads as a flicker more than a shape. A bigger open mouth such as M2.1 would read from further away, if you want that.

6. **Expressions.** Each is a set of eye and mouth cells plus a brow pose:

   | Expression | Eyes | Mouth | Brows |
   |---|---|---|---|
   | Happy | E8.1 | M2.1 | raised |
   | Surprised | the look's own | M6.1 | high |
   | Sad | half lid | M4.3 | inner ends up |
   | Angry | the look's own | M2.2 | down and in |
   | Sleepy | E1.6 | M3.1 | lowered |

   - Angry used to swap to "> <" (E6.1). Now the brows carry it and the look's eyes stay.
   - Assumption: moving brows (the ACNH way) beat swapping to a different eye style. E6.1 is still one cell away.

7. **Blinks.** Half, closed, half over about 0.15 s, at random 2–6 s intervals. Styles that have no lid to close (E8.1, E6.1) never blink.
   - Assumption: blinks keep running during expressions that leave the eyes open or half-lidded.

8. **Head triangles.** The head is 744 tris (v6's was 396). The 10 deg face columns keep the painted mouth's UV distortion under the fit limit. The two 12-vertex eye loops and the mouth loops account for the rest.
   - A full look (heaviest style, outfit and glasses) stays under about 4,000 tris; a test checks it.
   - Assumption: the head is worth the triangles.

9. **Older library.** The new skin-through check flags 8 older bangs and the undercut (up to 4.9 mm). Their long side locks and shaved rows are large flat rows that sag into the head; six of them did this on the v6 head too.
   - These are FLAGs in `fit-v7.txt`, not gate failures, and they are not fixed in this milestone.
   - Assumption: they are rebuilt as locks with the rest of the library (13 bangs, 9 backs) once you approve milestone 1.

10. **Your Blender window.** Blender crashed once, while writing a `.blend` from the live session (`bpy.data.libraries.write`). I relaunched it with `blender_mcp_autostart.py`. It now holds my working file (`/private/tmp/.../scratchpad/v7_work.blend`) and is safe to close; the review files are under `art/characters/v7/`.

11. **Creator framing.** The creator stage starts at a 3/4 turn and its buttons step 45 deg, so it never shows a straight front. The bench at `/lab/avatar` shows fronts.
    - Assumption: the creator is left as it was; a "face front" button is a small change if you want one.
