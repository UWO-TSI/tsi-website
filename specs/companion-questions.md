# companion: open questions for David

Kept building on each; assumption stated, flag if wrong.

1. **"Journal" in the Me tab.** companion.md says "journal (collections journal sheet)" — I read that as the ACNH critterpedia (`components/game/CollectionBook.tsx`, fish/bugs/flowers/etc.), not the quests/chapters journal (`components/progression/JournalSheet.tsx`). Assumption: collections journal is correct; quests/chapters stay reachable only from the full 3D world for now.

2. **Desktop gate.** Used `useCoarsePointer()` (touch vs. mouse), not a width breakpoint, so a touch tablet in landscape still gets the phone shell and a mouse-driven narrow window gets the desktop notice. Assumption: "desktop" means input type, not viewport size.

3. **Sign-in gate is one gate, not per-tab.** Checked once via `/api/identity/me` at the shell level; Study/Club/Me all sit behind it. companion.md deliverable 1 reads as one gate for the whole shell.

4. **Club tab has two sub-tabs (Bounties, Calendar & events), not three.** There's no standalone "events" page in `web/app/student/dashboard/` — the calendar page already lists/filters events. Assumption: calendar covers "events" from the spec's "bounties, events and calendar."

5. **`?mobile=1` (dev only) is a new addition, not in the spec.** Headless/desktop browsers always report a fine pointer, so there was no way to reach the phone shell for QA/evidence without it (mirrors the existing `?demo=` convention on the study page, same `NODE_ENV !== "production"` gate). Flag if you'd rather this not exist in the tree at all.

6. **The 3D table scene only shows once seated** (`study.table` is only populated by an active session), matching decision 119's "the cafe table you sit at" — before sitting, the Study tab is 2D only (table picker). Not shown while choosing a seat.

7. **`/student/login?next=...` doesn't actually honor `next=` yet.** Pre-existing gap — the login page always redirects to `/student/apply/portal` after sign-in. I mirrored the existing convention from `/student/companion/study` (same `?next=` link) rather than fixing global login redirect behavior, which is outside this brief's scope and touches a shared file.

8. **`ClubTab` forces `data-theme="light"` on the embedded dashboard pages.** `BountyPage`/`CalendarPage` read `--color-text-main` etc. from `tokens.css`, which default to the dark palette unless an ancestor sets `data-theme`. Without this override their text is near-invisible on the companion's cream card. This is a CSS attribute on my wrapper only — no edits to the reused pages themselves.

9. **Evidence gap: no live 3D screenshot.** This sandbox's headless Chromium reports no WebGL support (`getContext('webgl2'|'webgl')` returns null), so the Study tab evidence shows the WebGL fallback card, not the actual table/character render. The fallback path itself is now real evidence that it works; the happy-path 3D render is unverified by screenshot (code reuses `Character`/`TableFurniture` verbatim from the already-shipped cafe, and `localSeats()` has a unit test for its placement math).

## Coordinator rulings (2026-09-27)
All companion assumptions accepted ("journal" = collections). The live 3D table view needs a real-phone/headed check (fallback card verified only): added to the launch QA list.
