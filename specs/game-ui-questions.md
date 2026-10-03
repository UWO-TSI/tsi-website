# Game UI: questions for David (specs/game-ui.md)

Milestone 1 is built on `game/game-ui`. Each question has the assumption I took, so nothing waited on an answer.

## The wheel
1. **Slot order.** Rod, net, shovel, the leaf glider (if you own it), weapons, then pins, slot 1 at the top and clockwise. The ruins wheel is weapons only.
   - *Assumed:* this order. The tools sit together where the thumb lands first.
2. **Weapons on the village wheel.** They appear once the ruins gate is open: your default weapon first, then the best of each other type, in whatever room is left (8 slots, minus tools and pins).
   - Picking a weapon on the wheel makes it your default on the server (the one on your back).
   - "The ones you set" (choosing which sword of two sits there) has no screen yet. It comes with the bag's item details in milestone 2.
3. **The ruins wheel.** Your default first, then the best of each type, then the rest of what you own and the starters, up to 8. R swaps back to the weapon you had before.
4. **Slow motion while it's open:** the world and the ruins' fight run at 0.3 speed.
   - *Assumed:* also in the ruins, as a breather. ACNH pauses outright. Say if a fight should keep full speed.
5. **The glider on the wheel.** Holding it shows the furled leaf in your hand. Gliding works whether you hold it or not, as before.
   - Should gliding need the leaf in hand?

## Held items and left click
6. **Hold poses.**
   - The rod over the right shoulder.
   - The net in the right hand, head up and forward.
   - The shovel in the right hand, blade down in front.
   - The leaf held up beside the head.
   - A snack in both hands in front.
   - Items are put away while you sit, glide, slide, roll or climb.
   - A weapon held in the village sits in the hand at its rest grip, and left click is a practice swing.
7. **Tool tiers.** Tier 1 of each tool is everyone's, as the flimsy rod always was, so nobody loses bug catching or digging.
   - The shop's Basic rod, Bug net and Shovel (100 coins) now duplicate that free tier 1.
   - *Proposed:* retire those three rows.
8. **What net and shovel tiers do.** Today they do nothing, and the server only checks that you own the one in your hand.
   - *Proposed nets:* each tier widens the catch reach a little and lets you creep closer before a bug notices.
   - *Proposed shovels:* each tier digs faster and adds a small rare bonus on rocks.
   - Tools never break.
9. **Eating.** Fruit only. Two bites, then the next one comes out if you have more.
   - *Assumed:* eating has no effect and no reward (principle 3).
   - ACNH fruit gives strength to break rocks. Do you want an effect?
10. **What you can pin.** Up to two things you can hold: fruit, shells, rocks and ore, mushrooms, the branch.
    - For now you pin them from the Collection book's "On your tool wheel" strip. The bag takes this over in milestone 2.
    - Fish and bugs can't be pinned until you decide on holding a catch up (polish README, waiting item 5).
11. **Left click outside mouse-look.**
    - With the Mouse look setting off, a click uses the held item too.
    - With mouse-look on but the mouse not captured, the first click only captures; it never casts.
    - On touch, tap the prompt ("Tap · Cast").

## The clean HUD (row 283)
12. **The pause view.** The full HUD shows whenever the mouse isn't captured: after Esc, with a sheet open, while holding right click, or with the Mouse look setting off. Players in cursor mode therefore always see it.
    - *Assumed:* that's fine. They chose the cursor.
    - Touch always shows the full HUD.
    - H (remappable) shows it while held, and Settings has "Show full HUD".
13. **The minimap** starts closed and opens on M. The chapter objective slides in when it changes, and the place name as a scene comes in.
14. **The coin.**
    - The shop, the HUD's coin chip and the daily gift now show a rendered gold coin, with a gem for Gems.
    - Text elsewhere still uses the 🪙 symbol: study, contributions, the portal.
    - The coin's name and symbol are still yours to decide (polish README, waiting item 3).

## Keys
15. **The Z X C V preset** (Settings, Ability keys).
    - In the ruins, Z and V go to abilities. The scroll wheel still zooms and the arrows still turn.
    - Outside macOS, C crouches, so the preset is refused until crouch moves elsewhere.

## Icons
16. **Our rendering choices.**
    - Fish stand head up, as you ruled on 2026-07-24.
    - The guardian drops share the crafted weapons' icons until their own models exist.
    - The six retired outfit rows show the nearest character part.
    - Dyes show as a bottle in the dye's colour.
    - The 25 species without an icon, and the branch, are rendered from models I built in the weapons' style (build_items.py), as are the coin, gem, recipe card, bobber, merch, wraps and buckler.

## For the shared GUI sheet (from your Animal Crossing kit)
17. Please include these, which the wheel already uses:
    - **The wheel slot:** a cream circle #fffae6, butter yellow #ffeea0 when chosen, a teal check #04afa6 on what's in hand, grey #80807c when disabled.
    - **The teal name pill** #73c7ba, with cream text and a tail.
    - **The cream keycap pill** with a round brown keycap #725c4e.
    - For the bag (milestone 2): a cream icon tile with a rarity edge and a stack count.

## Found along the way (not changed here)
18. **Black fish in the game.** The old dump's fish (barreleye, blowfish, snakehead) render black in the game too, because their vertex colours are masks. The icon stage ignores those colours; FishCatchFX doesn't (fishing pass).
19. **Trophies on their backs.** The HHA trophies lie on their backs when placed at home: the homes catalogue has no rotation for them. Their icons stand them up.
20. **Prompt behind the bar.** In the full HUD at desktop widths, the interaction prompt sits behind the two-row controls bar.
21. **Emote menu.** It still uses emoji. It wasn't on this spec's list.
22. **Sphere fruit.** Fruit on the trees and bushes is still sphere primitives. The new fruit models could replace them (living village or forage pass).

## Milestone 2 proposals (for your OK before I start)
23. **Backpack upgrades:** 20 → 30 → 40 slots.
    - **30:** a "Roomier pocket" at the shop for 1,500 coins, or crafted from bagworm ×4 and branch ×6.
    - **40:** crafted only, from bagworm ×6, gold nugget ×1 and windflower ×2 (learned from the bottle).
24. **Stacks.**
    - Materials (branch, stone, clay, ore, crystal) and fruit stack to 30.
    - Flowers, shells and mushrooms stack to 10.
    - Each fish, sea creature and bug takes its own slot (ACNH).
    - A pinned item is just bag stock.

## Milestone 2 (built)
Built on `game/backpack` with proposals 23 and 24 as the defaults. Each question has the assumption I took.

25. **Crafting with a full bag.** Crafted things never take a slot (gear, wearables and furniture, row 280), and a craft only takes ingredients out of the bag.
    - *Assumed:* crafting is never refused for a full bag, so the craft route has nothing to refuse.
    - A crafted snack would need the same check as a catch. None exists yet.
26. **A full bag and fishing.** Every fish takes its own slot, so a full bag has no room for any fish.
    - *Assumed:* the cast is refused (nothing bites) and the note shows over the water. The land checks again in case the bag filled up during the reel; the roll then waits up to three minutes for room.
    - The alternative is ACNH's: let the fish bite, then let it swim away.
27. **Over capacity.** A member who had more than 20 slots before the cap keeps everything.
    - *Assumed:* they can't pick anything up, not even onto a partial stack, until they're back at the size or under. The bag shows it as "over by 3".
28. **The pockets.**
    - *Roomier pocket* (30 slots): 1,500 coins at the shop, or crafted from bagworm ×4 and branch ×6. The recipe is a starter, so everyone knows it.
    - *Roomiest pocket* (40 slots): crafted only, from bagworm ×6, a gold nugget and windflower ×2. The bottle teaches it; like every bottle-only recipe, an epic catch can teach it too.
    - The bigger pocket counts; nothing forces 30 before 40.
    - Their icons are the shoulder bag and the backpack accessories in their own colours.
29. **The storage chest.** It has 200 slots with the same stacks. Every wooden chest in your house opens the one chest.
    - Every member got a wooden chest in the starter pack. The starter room now has it beside the bed; members who already saved a room place theirs from Decorate.
    - *Assumed:* not at HQ (the spec said "maybe").
30. **Locks.** Selling and dropping skip a locked item, and "Store all materials" leaves it in the bag. Moving it by hand still works.
    - The lock is the server's, so it holds on every device. The shop's sell list shows it as "Locked in your bag".
31. **Drop.** A dropped item is gone for good: nothing lies on the ground afterwards, because the island has no layer for dropped items.
    - It asks first. Should fish and bugs say "Release" instead?
32. **Selling anywhere.** The bag's details sell at the shop's prices wherever you are (the spec's "sell and drop from the details panel"). ACNH only sells at the shop.
    - *Assumed:* keep it.
33. **Combat rewards.** Mission and boss materials still land in the bag when it's full, and can push it over.
    - *Assumed:* left as they are (the combat agents' code). Should they go to the chest when the bag is full?
34. **This device's.** The grid's arrangement (drag, sort) and the New marks are kept on the device, like the wheel's pins. Ownership and the locks are the server's.
    - Sort goes by type (fish, sea creatures, bugs, fruit, flowers, shells and mushrooms, materials), then rarity (rarest first), then name.
    - The New marks clear when you close the bag.
35. **Pickup feel.** The icon flies from the middle of the screen (you) into the Bag button.
    - In the clean HUD the button slides in for the flight and the bounce, then slides away. Its count stays until you look.
    - Sounds come from the existing set: a soft blip as it lands, the low "exit" when it doesn't fit.
36. **Signed out.** The bag shows this browser's record at 20 slots, read-only. With no server there's no cap.
37. **The Collection book's pin strip moved to the bag**, which now holds the wheel's pins (drag an item onto one) and Pin to wheel in an item's details.
38. **"Size" in the details** is your biggest one for species with sizes. For the rest it's how many share a slot.
