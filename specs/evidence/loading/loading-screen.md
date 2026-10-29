# The loading screen (after sign-in)

David, 2026-10-28, of round 2's island look: "this one is good". The logo and boat looks were not picked and are gone,
with the `?loading=` switch and the boat still. The village is retired, so the backdrop is rebuilt on the new world.

**What it is** (`web/components/game/IslandLoading.tsx`): a still of the title's staged shot (`components/title/shots.ts`,
the HQ in three-quarter view across the plaza, its flags, a lamp and a planter in front), full bleed and drifting in
very slowly (40 s), in the phase the island opens in (`loadingStill` in `lib/game/loadProgress.ts`; `?time=` outside
production). Over it one flat card, the kit's `ProgressCard` (`components/gui/flat/ProgressCard.tsx`, in `/lab/gui`):
the Tethos mark, "Tethos Island", the stage ("Rowing out…", "Sweeping the plaza…", "Lighting the lamps…") and the real
progress as a thin ink line (the code, the world, the files, the shader warm-up; never backwards; moved by transform, so
it keeps going while the main thread compiles). `--ui-*` tokens only, no hex. Reduced motion stills everything.

**The stills** (`web/public/assets/loading/island-{dawn,day,evening,night}.webp`, 25 to 31 KB each; the old village one was
38 KB): `specs/perf/loading-stills.mjs still` frames of the title camera on the new world (`TIME=<phase>`, empty shot =
the staged one, 1920 x 1080, no UI), point-resized to the title's 0.65 pixel scale (1248 x 702) and `cwebp -q 78 -m 6`.
Only the current phase's still is fetched, and the title prefetches it first (`components/title/preloadGame.ts`).

**Evidence** (`r2/`): `strip-day.webp`, `strip-evening.webp` (dev server, 12 Mbps line, `?arrival=1&time=<phase>`, from
the first paint to the island: `loading-stills.mjs strip <phase>`); `before-after.webp` (round 2's village backdrop and
cream card beside the new one); `before-village-1280.png` (the before at full size). No village house in any frame: the
one house behind the flags is the new world's chalet, as in the title.
