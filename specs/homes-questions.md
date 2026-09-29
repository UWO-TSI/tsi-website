# Homes: open questions for David

Append questions here (date, question, what you assumed meanwhile). The reviewer relays them.

## 2026-09-24 (island agent, homes deliverables 1–5)

1. **House model.** `house-common.glb` in the dump folder is a tent-like shell, not a house, so the home uses the brown chalet (`CHALET_VARIANTS.brown`, same family as the village café/museum placeholders). *Assumed:* fine until the Blender house exists. Should the starter be a tent first, as in ACNH?
2. **Room size.** Rooms are 6×6 cells (ACNH's first upgrade size); every bought room is 6×6, added toward screen-right with a 2-cell doorway. *Assumed:* 4-room cap (spec default), no floors.
3. **Decorate while walking.** The player can walk in decorate mode, but movement pauses while a piece is held so clicks place instead of walk. Esc puts a picked-up piece back; X puts it away (it disappears, since there is no inventory yet). *Assumed:* acceptable until inventory exists.
4. **Catalogue.** 40 pieces: 28 indoor (24 floor/rug from the existing furniture GLBs + a new country bed + 3 new wall items: clock, frame, dried flowers, all imported from the dump with `scripts/prepare-hq-lamp.py`) and 12 outdoor props/plants. Wallpapers: plaster, stripe, log, brick; floors: parquet, tatami, carpet, plain (dump RoomTex albedos). Which pieces are free starters vs shop items is open.
5. **Access.** Home is reached by the boat at the end of the wharf stub; the HQ "claim your plot" route from chapter 1 is not wired (progression owns that trigger). OK to add once the systems agent exposes chapter state?
6. **Shared dev server.** The systems agent runs `next dev -p 3100` in this worktree; I used it for screenshots instead of starting a second server.
