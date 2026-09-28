# Avatar fit: questions and assumptions (build agent, 2026-09-28)

Questions never blocked the work; each lists the assumption taken. Visual calls are David's.

1. **Brows: fully visible, or partly under the bangs?** The spec asks for brows "fully visible below the bang line
   (row 209)"; row 209 itself says brows sit partly under the bangs. Assumption: the default brows sit just above
   F1.1's crease (0.063 m of arc above the eye centre) and are fully visible under the default straight bangs;
   long bangs (straight long, centre split, wavy) still cover them, which keeps row 209 for those styles.
2. **Eye size follows reference 18, so the eyes are ~20% smaller than v6 showed.** v6 drew the iris 0.086 m wide
   and stretched it further toward the sides; reference 18 measures 0.068 m. Assumption: match the reference (the
   spec asks to re-measure scale on it). If David wants the bigger v6 eyes back, it is one constant (`K_EYE` in
   `build_v6.py`, 1.2 now, 1.5 before) and the chart keeps them undistorted.
3. **F1.1 detail.** The iris now tucks under a thick lid with a small outer wing and a pink crease, no highlight
   (row 209), flat colour. A darker upper band or a pupil would read better at village distance but adds detail
   David said he does not want; not added.
4. **Triangle counts.** Closed hair and hats cost more than the old sheets: bangs 102–194 tris (were 25–55), backs
   354–586 (92–236), hats 690–1094 (a hat replaces the back hair and carries its own tuck). About a third of each is
   hidden inside the head. A full look is now ~2,000–2,300 tris against row 133's ≤1,500 target; the island scene
   is ~163k tris, so 12 characters add ~5k. Assumption: acceptable; say if the cap matters and hair can drop to 30°
   columns with thicker hair instead.
5. **Engine material.** The character body material is now double-sided (hoods, capes, sleeves show their insides),
   with the shadow pass unchanged (back faces only, as before). Hair and hats are closed solids either way.
6. **Hat ribbons** on the sun hat and straw hat are now a colour band on the crown instead of a raised strip.
7. **Swept-back bangs** now read as a rolled lift at the hairline (the crown is the back cap's), since two pieces
   cannot both own the crown without a ledge. The braided crown's plait now sits behind the bang roots.
8. **Hairline seam.** Every back cap's front edge runs just under the bangs and rises through them behind the
   hairline, so there is no line across the forehead. With see-through or parted bangs (wispy, curtain, centre
   split) the forehead shows between strands up to the cap's hairline, as on the N sheet.
