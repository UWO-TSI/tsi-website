# Class playtest harness (David, 2026-10-02)

David: "let me play test the characters once v1 is done." He plays on localhost:3000 with no Supabase, so the harness runs on the in-memory combat demo (`web/lib/game/combat/demo.ts`). It works today as `/lab/island?combat=demo&classes=v2&subclass=<key>&mastery=N`, with `?ruins=1` starting in the ruins.

## Deliverable: `/lab/classes`, dev-only like every lab page
1. **Picker:** the 16 subclasses in a 4×4 grid by family, each card showing:
   - the class icon, name and family colour;
   - its one-line fantasy;
   - its stat direction;
   - "basic-attack" or "skill" style;
   - whether its kit has landed (a family not yet merged shows "coming").

   Pick a class and a mastery (1, 10 or 20; default 20 so every skill is unlocked), then "Play in the ruins". That opens the island already in the ruins with that kit, the signature weapon in hand, and classes v2 on.
2. **In-game dev panel** (the existing development-only panel, `?combat=demo` only):
   - switch subclass and mastery without reloading;
   - fill the ult meter;
   - god mode (no damage taken);
   - infinite mana/energy;
   - reset cooldowns;
   - slow motion (0.25×, 0.5×);
   - toggle Reduce flashing and Screen shake.
3. **Spawner** at the gate plaza, with a damage-numbers readout and DPS over the last 5 s:
   - a training dummy that never fights back;
   - a dummy with a shell front (for backstab and flank checks);
   - a ranged dummy that fires slow projectiles (for Mirror Ward and the Guardian's parry);
   - a fox pack, a crab, a mushroom, a wisp, a pollen cloud, the Elder Thorn Crab, the Guardian Statue;
   - clear all.
4. **Key card:** a small cream card listing the class's keys (1–5, F ult, its movement passive, how combos or drawing work), so David can learn each kit without reading the spec. It hides with H.
5. **Notes:** a "Note" button that saves a timestamped line plus the current subclass to `localStorage` and lists them on `/lab/classes`, with a copy button. David can jot feedback while playing and paste it to the coordinator.

## Rules
- Dev-only: the lab layout already 404s in production, and nothing here reaches members.
- No game logic changes; it drives the existing kits and demo store.
- Matte cream UI (the GUI sheet's components if they've landed, else the recruit kit).
- Muted test browsers; never `bringToFront()`; one browser at a time via the shared lock.
