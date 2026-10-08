# Group A browser checks (audit-2026-10-ui items 1, 4, 13), before and after

Headless Chromium, `--mute-audio`, SwiftShader, 1280 × 720 (phone scenes 390 × 844), dev server on 3154 with the Supabase env blanked. Script: `shoot.cjs`. Before = main `f3759b84`'s files; after = this branch.

**How the close is measured.** From just before Escape (or Continue), the script samples the dialog every animation frame: whether it's there, its `data-state` and its opacity. Under SwiftShader the island renders at a few frames a second, so a screenshot lands about 200 ms or more after the key. In the island, that's past a 160–260 ms close, so the trace is the evidence there. On the phone pages the frames are fast, and the strips show the close itself.

| Surface | Before | After |
|---|---|---|
| Collection (B), island | Gone on the first sampled frame, no `closing` state. Focus starts on a hand-made div. | `data-state="closing"` at 28 ms, opacity 0.71 at the next frame, then gone. Focus starts on the sheet; Tab reaches Close with a ring; focus goes back after the close. |
| Collection, 390 wide | Centred card; gone at once. | Bottom sheet; `closing` at 175–195 ms, gone at 360 ms. |
| Collection, phone companion | Gone at 5 ms. Copy: "0 in your bag" and, with a 401, "Showing this browser's collection: your account's copy didn't load." | `closing` from 7 ms, opacity 0.99 → 0.87 → 0.61, gone at 292 ms, matching the Bag (gone at 302 ms). Copy: "0 caught" and "**Sign in** to keep your collection on your account." |
| Your path (P) | `open` at 7 ms, gone at 41 ms with no `closing` frame. | `closing` at 29 ms, opacity 0.07 before it goes at 290 ms. |
| Closet | Gone at 99–156 ms with no `closing` frame. | `closing` at 103–116 ms, gone at 251–266 ms. Focus goes back to the page. |
| Oracle reveal card (Continue) | Gone, no `closing` frame. | `closing` at 547 ms (one slow frame), gone by 1356 ms. |
| Daily gift, on show | Focus jumps to "Open it". | Focus stays on the page. |
| Daily gift, Space (jump) | Pressed the focused button: the gift opened. | Phase stays `offer`; the player jumps. |
| Daily gift, Escape after a click in the world | Nothing: the card stays, and nothing is put off. | "Later": `closing`, then gone, and `tsi.gift.later` = `2026-10-08`. |
| Daily gift, E | Nothing. | Opens it (phase `opened`). |

Raw per-frame samples are in the run logs; `shoot.cjs` writes them to `$SHOTS/<tag>/log.jsonl`.
