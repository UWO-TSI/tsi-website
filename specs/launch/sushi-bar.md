# The sushi bar

David planned it on 2026-10-26 (https://claude.ai/artifact/QddVeVSPgcEZRZEBgYJAjm, collection `sections`). He marked every section "Nice to have" for Oct 31, so it doesn't block the launch. References: `specs/references/terrain/sushi-bar-2026-10-26/` and `fish-shop-2026-10-26/fish-bar-shark-shack.jpg`.

## His answers, verbatim

- **The idea.** Picks: "Open bar on the sand", "Evening and night", "Nice to have".
  - Feel: "hangout spot, place to sit with friends, show piece but i think it lacks core purpose".
  - What's wrong: "the meaning behind this build, the purpose".
  - Notes: "i want it to seem open, but you have to press e to enter, but instead of like a normal black screen go into door, it is a camera angle switch transition that turns first person at the bar and you can order food and i need to think of what to do with this".
- **Where and how big.**
  - Where: "on the beachon stilts on the water more left side of the beach".
  - Size: "it looks good rn, 6 stools, you need to enter like a building but make it an illusion to be open kinda thing by changing to first person and seeking the food infront of you".
  - Outside: "sign, todays menu, lanterns, entrance".
  - Notes: "I want it to be a nice first person mukbang experience kinda thing with friends. food gives you temp buffs for fishing, only 6 spots, can stay however long, the food model will look rly good".
- **Inside.**
  - Layout: "just a good vibe, looks nice with good view in the back, rn the angle doesnt see the view, i want this to be first person, it should have decore lights speaker, and like eating experience, should feel cozy".
  - Decor: "sake, paper lanters, drape, posters, fishtank on the side, feel super cozy".
  - View: "and npc making food for you infront".
- **What you do there.**
  - Sit: "first person, menu on table. click through, friends sit beside you, order food, watch it be make, nmore of a chill kinda experience thing".
  - Order: "eat sushi get buffs, if you get a super rare fish you can bring it in to be cooked into big dish taht does some crazy buffs. good for repeated legendary fish they wanna use instead of sell."
  - Social: "photos and vibes, sometimes side quest for special fish for money and food".
  - Notes: "chef will give orders for you to fish, this will serve as one of the places giving out fishing mission".
- **The chefs.**
  - Who: "black guy called bancha as sushi chef, and dave a diver guy as server" (refs `staff-chef-ref.jpg`, `staff-server-ref.jpg`).
  - Talk: "they just focus on making food sometimes talks but not much".
- **Music, lights and mood.**
  - Day and night: "day is closed and give out fishing quests, eveing open, dinner, night more bar vibes music changes to more bar fitting".
  - Music: "japanese jazzy nujabes, ill generate some songs with suno u give me prompt".

## The build, in two phases

**Phase A, the place.** Nice to have for Oct 31; a lane builds it now.
1. **Where:**
   - On stilts over the water, toward the left side of the beach. The coordinator reads "left" as the map's left (west); David confirms at review.
   - A short boardwalk from the sand to the entrance.
   - Outside, a sign, a "today's menu" board, lanterns and the entrance.
2. **Hours:**
   - By day it's closed: shutters down, and the chef stands outside (his quests come in Phase B).
   - In the evening it opens for dinner; at night it feels more like a bar.
   - The music follows: evening dinner jazz, night bar jazz.
3. **Entering:** E at the entrance starts a smooth camera move, never a black screen, into first person at a free stool.
   - Six seats, claimed over the network so friends sit side by side.
   - You stay as long as you like; E leaves.
   - In first person your own avatar is hidden. You look across the counter at the chef working, with the sea through the window behind him.
4. **Inside:** sake, paper lanterns, drapes, posters and the fish tank on the side, lit cozy and warm.
5. **The staff:**
   - **A sushi chef:** a Black man, cool and focused, who rarely talks.
   - **A server:** a cheerful diver type.

   Both are our own designs in the spirit of David's references, not copies of Dave the Diver's Bancho and Dave. Their names are David's call: the chef "Bancha" as he wrote it, and a name for the server that isn't "Dave".
6. **Music:** the bar's evening and night slots play David's Suno tracks when he sends them, and the existing tracks until then.

**Phase B, the purpose.** After launch, since it touches the economy and needs server work.
- A menu on the table to click through; ordering; watching the food being made; good-looking food models.
- Food gives temporary fishing buffs.
- A super-rare or legendary fish can be cooked into a big dish with big buffs: a use for repeat legendaries besides selling.
- The chef gives fishing orders, so the bar becomes one of the places that hand out fishing missions, plus side quests for special fish that pay money and food.
- TODO (David, round 3, on the closed bar: "taklking to him gives you fishing quests"): by day the chef stands outside (sushiBar.ts CHEF_OUTSIDE); talking to him there is where his fishing quests start.
- Photos.
