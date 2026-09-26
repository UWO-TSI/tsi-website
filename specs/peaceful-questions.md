# Peaceful loop: open questions for David


## From the island agent (2026-09-24)

1. **Node rolls use a local member id.** Hourly forage/bug rolls are seeded by `tsi.member.local.v1` (random per browser) because the island has no member id on the client. Should the world read the signed-in member id instead so rolls match across devices?
2. **Rods 4 and 5 are "crafted" with no craft UI yet.** Tier comes from owned gear (`rod_cedar`, `rod_glass` from the shop) or `?rod=` in dev. Legendary fish need tier 4+. Is it OK for crafting to stay out of scope for now?
3. **Bugs flee at walking speed.** Walking is 7.4 u/s. Anything over 2.4 u/s inside the flee radius scares the bug, so you have to sneak (hold C, 2.2 u/s) to get close. Too strict?
4. **Museum shows 6 cases per wing** (donated first, then empty). The wing sign shows the full count (e.g. Aquarium 2/52). Should the rooms grow as donations come in, or are 6 cases plus the journal enough for launch?
5. **Fish in the aquarium are icon sprites** (the roster has no fish models). Shells and bugs with models use the GLB. Should we wait for fish models, or are icons OK?
6. **Wardrobe has no 3D mesh swap yet.** The sheet saves the outfit locally (`tsi.wardrobe.v1`) and draws a 2D portrait on the ACNH card. The in-world sprite stays the same until the Blender character set is ready. The fitting room lets you try everything on, with a note that buying outfits comes with the shop update. Should outfits be sold in the shop, or should everyone start with every outfit, like the furniture starters?
7. **Starter room now includes a closet** (`closet`, 2×1, the ACNH Japanese chest). Existing saved homes won't get one automatically; players can place one from Decorate. Should we add it to existing homes?
8. **Buying a room needs sign-in.** On `/lab/island` the remote store returns 401, so the door says "Sign in to add a room." I couldn't screenshot a successful purchase without an authenticated session.
