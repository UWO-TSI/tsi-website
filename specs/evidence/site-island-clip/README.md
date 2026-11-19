# The home page's island clip

`web/public/videos/island-clip.mp4`, scrubbed by `components/site/home/IslandScrub.tsx`.
The clip walks down the wharf, fishes from the beach, then talks to Bram. It was recorded from `/lab/island` on 2026-11-14.

1. Start a dev server with Supabase blanked:
   `cd web && NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3123`
2. Record a take: `PORT=3123 node island-film.mjs <out>`.
   - It runs headless Playwright and opens no window.
   - It writes frames with their times, plus `beats.json`.
3. Pick the cuts from a contact sheet, set `SEGS` in `island-cut.py`, then run `python3 island-cut.py <out> island-clip.mp4`.
   - Output is 1600x900 with a keyframe every 8 frames, so it scrubs.
4. If the scene timings move, update `CUES` in `IslandScrub.tsx`.
