# The loading screen, round 2: three simple looks for David to pick

David, 2026-10-27, on round 1 (the sea chart): "looks ugly i dont want to show our map because it looks bad, i want it
to be simple maybe show our logo loading or the fishing boat thing... maybe like a idle shot of the island... just keep
it simpel for now".

All three: the cream paper and grain, Nunito, no map, nothing fetched. Under each, the real progress as one 2 px
hairline (`lib/game/loadProgress.ts`: the code running, the world in, the models and textures, the shader warm-up;
weighted, never backwards; a `progressbar` for screen readers) and the stage it waits on in small muted type ("Rowing
out…", "Unpacking the village…", "Lighting the lamps…"). The line moves by transform, so it keeps going while the main
thread compiles. Reduced motion stills everything.

| Look | Shot (1280 x 800, at 77%) | What it is |
|---|---|---|
| `logo` | `screen-logo-1280.png` | The site's own Tethos mark (`public/logo-light.svg`, tinted the ink), breathing slowly, "TETHOS ISLAND" under it. Nothing to download. |
| `boat` | `screen-boat-1280.png` | Bram's boat at the wharf at golden hour, as a print on the paper (tilted a touch). 23 KB still. |
| `island` | `screen-island-1280.png` | The HQ at golden hour, full bleed, drifting in very slowly (40 s), the mark and line on a warm haze at the foot. 38 KB still. |

The stills are frames of the title page's own camera on the island (`?time=evening&shot=...`, the title's depth of
field and pixel finish), made by `specs/perf/loading-stills.mjs still` and saved small as `public/assets/loading/*.webp`
(the island at the title's 0.65 pixel scale, drawn pixelated). Boat: `4.5,-15.5,140,2.0,-7,32`; island: the staged
evening shot.

To see one live (dev or preview): `/student/dashboard?arrival=1&loading=logo|boat|island` (logo when absent). Once
David picks, the other two and the `?loading=` switch go.
