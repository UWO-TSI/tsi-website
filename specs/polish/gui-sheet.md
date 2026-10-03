# Our own GUI sheet from the Animal Crossing UI kit (row 285)

David, 2026-10-02:

> "anything still with the old terminal glass blue style needs to be replaced. also new gui should reference animal crossing gui sheet i sent you and use that as reference to make our own gui sheet"

Earlier: the cozy cream kit, a minimal HUD that appears when needed, and an ACNH flower tool wheel (row 283). The standard is in `specs/polish/README.md`.

## The reference
- **Source:** the "Animal Crossing UI Kit (Community)" Figma kit David supplied. It's in `~/Downloads/` as three zips named `Animal Crossing UI Kit (Community)*.zip`, plus `~/Downloads/Spritesheets.png`.
- **Prior use:** `specs/recruitment-ui-kit.md` and `web/components/recruit/ui/**` (VillagePanel, VillageButton, Keycap, NPCDialogue, ...) were built from it for the applicant island.
- **Visual language:**
  - irregular paper shapes and pinned notices;
  - floating dialogue;
  - pill actions;
  - round keycaps;
  - restrained shadows;
  - warm paper with sage, wood and Tethos accents.
- **Handling:** extract into a scratch folder, never into the repo. Study it; don't paste its PNGs into the product. Build our own.

## Deliverable
1. **Our GUI sheet.**
   - Tokens: colour, type scale with a 12px minimum, radii, paper textures and edges, shadows, motion.
   - One component library for game, portal and companion, extending the recruit kit rather than duplicating it:
     - panels and sheets with paper edges;
     - pill and icon buttons;
     - keycaps;
     - tabs;
     - list rows and item tiles (using the real item icons);
     - toggles, sliders and fields;
     - toasts;
     - dialogue boxes;
     - banners;
     - badges and counters;
     - progress bars (XP, mastery, ult);
     - tooltips;
     - confirm dialogs;
     - loading and empty states.
   - Paper textures and edge shapes are painted by us (procedural or Blender renders): no downloads, no AI generation.
   - A dev-only showroom at `/lab/gui` shows every component in every state, beside small crops of the AC kit for comparison.
2. **Replace every terminal / glass / navy surface** (the old portal look: dark navy panels, glass blur, mono terminal text, blue glow).
   - **In the game:**
     - the nameplate, emote menu, Oracle reveal card, fish-reveal backdrop, rune overlay, dev panel, any remaining dark HUD pieces;
     - the item emoji left in the emote menu.
   - **In the member portal** (`web/app/student/dashboard/**`, `web/components/portal/**`, `web/components/dashboard/**`, `web/components/economy/**`) and the phone companion (`web/components/companion/**`, `web/components/study/**`):
     - every page and sheet onto the new components;
     - `styles/game-tokens.css` becomes the cream token set, imported once.
   - **Not in scope:**
     - the marketing site (`web/app/(site)/**`, `web/components/sections/**`);
     - the recruitment applicant flow, which already uses the kit (keep it working; adopt shared tokens only where nothing changes visibly).
3. **Menus polish, from `specs/polish/menus.md`:**
   - one dialog system (focus in and out, Escape, the opening key closes, world hotkeys blocked while open);
   - open and close animations with soft sounds from the existing set;
   - the naming pass (Journal / Collection / Bag, "HQ", "TC" with its coin icon);
   - `keyName` everywhere;
   - copy, error and empty states;
   - creator and Oracle fixes;
   - `MissionBoardSheet` subscribing only while open.

   Check that spec against main first: the HUD, game-UI and world-refinement passes already did parts of it.
4. **Accessibility:** contrast AA on every text, visible focus rings, reduced motion respected, and the text-size setting applied to every overlay.

## Rules
- Never reveal the TC ≈ CAD or Gem ≈ CAD rate.
- Don't change game logic; this pass is surfaces and flows.
- The classes v2 HUD (ult slot, mastery bar, class keys) uses the new components, but don't change its behaviour. Family agents are building kits at the same time.

## Evidence
`specs/evidence/gui-sheet/`:
- the showroom;
- every replaced surface, before and after (game, portal pages, companion at phone size);
- open and close frame strips;
- the AC-kit comparison sheet.
