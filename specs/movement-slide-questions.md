# Slide and momentum tech: questions for David (row 274)

Each has the assumption I built on, so nothing waits on the answer. Play it in `/lab/move` ("Slide lane" button; the Slide and Momentum groups have presets, and Speed has slow motion) and in the village.

## 1. Ctrl+Space on a Mac (the slide-jump)
macOS has a system shortcut on Ctrl+Space ("Select the previous input source", Keyboard → Keyboard Shortcuts → Input Sources). Where it is on, macOS takes Ctrl+Space before the browser sees it, so Space pressed while holding Ctrl to slide never reaches the game. It is **off on this Mac mini** (checked), and on by default on many Macs.
**Built:** a jump within 0.12 s of letting go of the slide (or within coyote time of sliding off an edge) is still a slide-jump, so "let go and jump" works everywhere.
**Options:** keep Ctrl (assumed, as you asked; players with the shortcut turn it off or remap); make C the Mac default too; or keep Ctrl and show a one-time tip on a Mac.
Other Ctrl combos on a Mac that a page can't stop: Ctrl+arrow keys (Mission Control and Spaces; only matters if you bind arrows to walk) and Ctrl+click (a right-click). Ctrl+W/A/S/D/Q/Shift do nothing in Safari, Chrome or Firefox on a Mac.

## 2. Windows and Linux
**Built:** C by default. Settings offers "Play fullscreen with Ctrl" where the browser can lock the keyboard (Chrome, Edge; not Firefox or Safari): fullscreen plus `navigator.keyboard.lock`, and crouch moves to Ctrl. Leaving fullscreen falls back to C. Hold Esc to leave fullscreen.

## 3. The ruins' dodge
Q is also the arena's dodge. **Built:** the ruins keep the dodge's old shape (its burst eases to 0.55, a slow bleed, no grace), so dodges and the balance pass are unchanged; the slide works there (no i-frames in it). Should the ruins' dash carry momentum like the village's?

## 4. The air dash carries a lot now
With the momentum model the air dash keeps 16.2 u/s for the rest of the flight, so a long jump plus the air dash reaches about 9 tiles (before: about 6.5). The lab's 7-tile gap is "only a slide-jump clears it" **without** the air dash; with it, several moves clear it. **Assumed:** keep it (it is your model). If it is too much, an air dash could keep less (a separate `airDashExit`).

## 5. Bunny-hop without Shift
Your note says a landing into a hop keeps momentum ("jump held or buffered"). **Built:** holding Space now hops on landing when you carry more than 1.12 × walking speed, even without Shift. At a walk it still lands and stays down, as before.

## 6. Numbers to feel
- **Slide:** friction 3.5 u/s². A sprint slides 1.32 s over 12.8 tiles (spec: 1 to 1.5 s). A dash-slide starts at 16.2 and lasts about 2.5 s (33 tiles), which is long. Presets: Slick (default), Short, Long.
- **Slide-jump:** 0.55 high, 0.26 s to the apex (0.48 s in the air): lower and longer than the jump (0.95). A sprint's slide-jump flies about 5.9 tiles, a dash-slide's about 7.9 (the long jump: 4.2, a dash-jump: 5.4). Too floaty?
- **Momentum:** a 0.12 s grace, then 18 u/s² back to a run (16.2 to a sprint in 0.22 s, to a walk in 0.48 s). Presets: Kept (default), Forgiving, Strict, Before (fade).
- **Ceiling:** 18 on flat ground; downhill it rises by 10 × the slope's sine (a two-cell ramp: 24). Every link adds at most 0.4.

## 7. The dash into a slide
**Built:** the dash plays its 0.2 s burst, then slides at the speed it keeps (16.2). Holding the slide before pressing Q does the same. The other way would cut the dash short into a slide at the burst's speed, up to 18.

## 8. Crouch in the café
The café is walk only (row 269). **Built:** crouching still works there (sneak did), and a slide can't start (no running). Should crouch be off indoors too?

## 9. Sounds (nothing generated; re-pitched from the existing files)
| Event | File (rate, gain) |
|---|---|
| Slide start (and from a landing) | `footstep` (0.6, 0.85), a scrape |
| Dash into a slide | `blip4` (0.8, 0.6) + the scrape |
| Slide-jump | `jump` (0.92) |
| Stand up out of the slide | `footstep` (1.1, 0.55) |
| A slide into something | `footstep` + `exit` (1.4, 0.45) as a thud |
| Crouch-walk steps | the ground's footstep at half gain |

**Missing (to source):** a slide scrape loop per ground (grass, sand, soil, snow, wood), a slide stop, a soft cloth whoosh for the slide-jump, a bump thud, a crouch cloth rustle. Short mono files at the manifest's -16 LUFS.

## 10. The slide's look
The slide pose leans back onto the trailing (right) hand with the left leg out front; the engine leans it into the steer (up to 14°) and lies it back up to 7° deeper at speed. From the follow camera the big head hides much of the body, so the read leans on the drop in height, the trail and the arm out. Lead with the right leg instead, or a lower, flatter pose?
