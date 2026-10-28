# Remodel round 2 (David's review of round 1, 2026-10-27)

Each `<name>-before.webp` / `<name>-after.webp`: the game's own frame in the new world (left, where there is one), then
the Blender views of the old model and ours under the same camera and light (`art/remodel/review.py`). New world only
(`NEXT_PUBLIC_GAME_WORLD=new`); the village keeps the dump's models.

| Name | Note | Triangles before -> after |
|---|---|---|
| market-barrel | Rounder: a sine belly from ends at 0.8 of it, twenty staves in softer tones, four hoops riding the curve. | 1196 -> 924 (round 1: 616) |
| gather-rocks | Like the old: lumpy boulders broken by flat faces, steep shoulders, a small granite texture (128 px, ours, numpy noise), the top lighter and the foot darker. | 214, 198, 146 -> 192, 168, 120 |
| flyers | The world's butterflies and dragonflies, cheaper than round 1. The old ones stay in every close-up. | 770 to 824 (butterflies), 778 and 360 (dragonflies) -> 116 and 128 each (round 1: 350, 287) |
| crawlers | Ladybug, cicada, grasshopper, mantis in the world, cheaper than round 1. The old ones stay in every close-up. | 504, 732, 608, 1006 -> 230, 176, 182, 202 (round 1: 484, 340, 364, 392) |
| bug-world-and-closeup | Left: our cheap butterfly flying in the world. Right: the old models, which the trophy case and the icons (collection book, catch card) still draw. | |
| fish-icons | The 81 fish icons re-rendered from the tweaked fish (`scripts/render-icons.mjs`, new world). The icon renderer is matte and already drops normal maps, so the change is small: softer, smoother shading. One shared set, the village's too (coordinator's call). | |

Close-up paths: `components/game/TrophyCase.tsx` draws `Critters.SPECIES` (the dump's paths); `lib/icons/manifest.ts`
renders bug icons from `/assets/acnh/critters/`. The world paths go through `worldModel`: `lib/game/ambientFauna.ts`
FLYERS and `components/game/peaceful/VillageLife.tsx` MODEL_OF / FLOCK_OF.
