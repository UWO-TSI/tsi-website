# Game UI: tool wheel, held items and the backpack (rows 279–281)

David, 2026-10-02: "I want game ui development, including hotbar, backpack logic, and you suggest some things to include. ask me questions so you understand what i want."

His picks:
- **Selection:** an ACNH tool wheel (hold Tab, flick, release), not a hotbar.
- **In hand:** the held item shows in the character's hand (supersedes row 136).
- **Backpack:** limited and upgradable (about 20 slots, up to about 40), with a storage chest at home.
- **Ruins:** the wheel picks the weapon or tool you hold; abilities stay on 1–4, with Z X C V as a preset.
- **Wheel contents:** tools, weapons and up to 2 pinned items.
- **Durability:** tools never break; only weapons keep durability.
- **Backpack features:** all four (item details; drag, sort and lock; pickup feel; real icons).
- **Full backpack:** you can't pick up (ACNH).

## Where it stands (survey 2026-10-02)
- **Two stores, no capacity:**
  - `member_inventory` holds gear and wearables (`qty`, `slot`, `equipped`, slots rod/net/shovel/outfit/hair/accessory; `20260926150600_economy.sql:133-162`).
  - `member_collections` holds catches and materials (a count each, no cap; `023_member_collections.sql:12`).
  - Weapons sit in `member_weapons`.
- **Tools pick themselves:** `bestOwnedRod` (`lib/game/rods.ts:36`, client and server). Nets and shovels have tiers nobody reads. The glider is on when owned.
- **Held items:** nothing in the hand except the glider leaf (`character/Character.tsx:302-314`) and weapons (`PlayerAvatar.tsx:607-614`). `ToolFlourish.tsx` only runs on the applicant island.
- **Ruins weapons:** R cycles every owned weapon plus 5 starters (`lib/game/combat/actions.ts:187-189`, `runtime.ts:95, 110-114`). The DB's equipped weapon is unused.
- **The in-game "bag" is the collection book.** I and B both open it (`DefaultIslandWorld.tsx:729, 827-828`). The real items list (`InventoryBody`, `EconomySheets.tsx:202`) is only on the phone companion and the portal.
- **Icons:**
  - 120 PNGs in `public/assets/acnh/icons/`;
  - 25 roster species and `wood_branch` have none;
  - every shop item, weapon and the glider shows emoji (`sprite_url` null);
  - weapons and the leaf have only GLBs.
- **Mouse-look camera** (row 278, on main): left click does nothing outside combat; the ruins show a crosshair; Tab is free.

## Deliverable

### Milestone 1: the wheel and the hand
1. **The tool wheel:**
   - Hold Tab (remappable): the wheel opens around the screen centre, and the mouse capture is held so flicking picks a slot. Release to equip. A quick tap swaps to the last item.
   - **Contents:** 8 slots — rod, net, shovel, glider, your weapons (the best of each type, or the ones you set), and up to 2 pins from the backpack. The centre puts things away (empty hands).
   - **Touch and pad:** touch gets a wheel button; a gamepad later uses the stick.
   - **Look:** cream kit; each slot is the item's real icon with its name on hover. The world dims slightly behind it, with a soft open sound and slow-motion while open.
2. **Held items:** whatever is selected is in the hand.
   - Rod, net, shovel, weapons and the leaf already have models. A pinned item (a fruit, a snack) is held in front.
   - Proper hold poses on the v6 rig (`art/characters/base/build_clips.py`): rod over the shoulder, net and shovel held, a two-handed hold for big items.
   - Swaps animate: the old item away, the new one out.
   - **Use with left click:** the rod casts (today's E flow moves to the held rod), the net swings, the shovel digs, a weapon attacks, food is eaten.
   - E stays interact (talk, doors, seats). Prompts change to say what left click will do with the held item ("Click: cast").
   - The held tool decides the action instead of auto-picking. `bestOwnedRod` stays only to pick the default wheel rod; the server checks the held tool's tier, not the best owned.
3. **Ruins:**
   - The wheel picks the weapon (it replaces R swap; R stays a quick swap to the previous weapon).
   - Abilities stay on 1–4, with a Z X C V preset in Settings.
   - The weapons on the wheel are the member's owned weapons plus the starters (the DB `equipped` weapon becomes the default).
4. **Real icons for every item:**
   - A reproducible renderer makes a matte, lit, consistent icon for every item from its 3D model: shop items, tools, weapons, the glider, furniture, outfits and accessories. The 25 species and `wood_branch` without icons get theirs from their models or are painted in the same style.
   - Icons are written to `public/assets/icons/` and wired to `sprite_url` and the roster.
   - No emoji anywhere in the wheel, backpack, shop, collection or toasts.

### Milestone 2: the backpack
5. **Capacity (server-authoritative):**
   - The backpack has slots: 20 at the start, upgrades to 30 and 40 (crafted or bought; propose recipes and prices in the questions file).
   - **What takes slots:** catches, materials, fruit, shells and consumables. Gear (tools, weapons, glider) lives on the wheel and the gear list and takes no slots. Wearables live in the wardrobe; furniture goes to home storage.
   - **Stacks:** materials and fruit stack to 30 (ACNH-like); fish, bugs and sea creatures each take a slot. Propose the exact rules.
   - **Full backpack:** the catch, harvest and craft routes refuse new items, with a "Your backpack is full" note; the item stays in the world (the fish swims away, the fruit stays on the tree).
   - **Existing members** over capacity keep everything; they just can't pick up until they're under.
   - A new migration (timestamp after the latest on main); never edit applied ones.
6. **Home storage chest:**
   - A chest in the home (and maybe the HQ) with a large capacity.
   - A two-pane transfer UI: drag, shift-click, "store all materials".
7. **Backpack UI** (B opens the backpack; the collection book moves to its own key, per the menus naming pass):
   - **Grid:** the slot grid with real icons, stack counts and rarity edges, and a capacity readout.
   - **Item details:** rarity, size, sell price in coins (never a conversion rate), museum-donated mark, which recipes use it, and Pin to wheel.
   - **Arranging:** drag between slots, to the wheel pins and to the chest; auto-sort (by type, then rarity); lock favourites so selling skips them.
   - **Pickup feel:** a picked-up item's icon flies into the backpack button, which bounces. A "New" badge stays until you look. Gentle sounds from the existing set.
   - **Selling:** sell and drop from the details panel, or sell many at the shop counter (forage spec).

## Rules
- **The server owns ownership and capacity.** The client never decides what you have.
- **Multiplayer-forward:** the held item is player state, drawn on that player's avatar.
- **Never reveal the TC ≈ CAD (or Gem ≈ CAD) rate.**
- **Mouse-look:** opening the backpack or chest releases the capture; the wheel holds it for flicking.

## Evidence
`specs/evidence/game-ui/`:
- the wheel open and choosing;
- each held item idle and in use;
- the icon sheet (every item);
- the backpack filling to full and refusing a pickup;
- the chest transfer;
- details, sort and lock;
- the pickup fly-in.
