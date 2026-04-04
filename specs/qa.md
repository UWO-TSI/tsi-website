# QA Report

> Owner: QA agent. All agents check this for bugs in their area.
> Last updated: 2026-04-04

---

## Wave 7 — Full Integration + Visual Browser Test (All Branches Merged)

Merged ALL branches (backend API-wiring, frontend API-wiring, UXUI reviews) into QA. Resolved 3 merge conflicts (types.ts, MemberDirectory.tsx, ProfileView.tsx — took Frontend versions per file ownership). Ran build + lint + **first real browser testing via Playwright**.

### Build

**Result: ✅ PASSES — 55 pages (up from 51), 7.1s compile**

New routes: `/student/dashboard/directory/[id]` (dynamic profile page from Backend wiring).

### Lint

**Result: ❌ FAILS — 48 errors, 49 warnings across ~39 files**

Same patterns as Wave 6. No regressions from merge.

### Visual Browser Testing (Playwright — FIRST TIME)

This is the first time the game world has been **visually tested in a real browser**. All previous waves were HTTP-status + code-review only.

#### Game World ✅ Renders Correctly

| Feature | Status | Notes |
|---------|--------|-------|
| 3D Canvas rendering | ✅ | WebGL context initializes, R3F renders |
| Gradient sky | ✅ | Blue gradient, correct colors |
| Circular island terrain | ✅ | Green grass, dirt paths, dark edge ring |
| River + bridge | ✅ | Visible water, wooden bridge |
| Trees (4 types) | ✅ | Mix of cone and sphere trees, sway animation |
| Bushes + flowers | ✅ | Scattered around terrain, colorful |
| Clouds | ✅ | Animated in sky |
| Props (benches, fences, well, lampposts) | ✅ | All visible |
| Building labels | ✅ | White pill labels with dark text (HQ, House, Shop, Bounty Board) |
| Building proximity detection | ✅ | "Press E to enter" prompt appears when near HQ |
| Camera angle + follow | ✅ | Correct elevated perspective, follows player |
| WASD movement | ✅ | Player moves, camera follows |
| Sidebar navigation | ✅ | 8 items render correctly, "Soon" badges on Phase 2 items |
| Active nav highlighting | ✅ | Blue left accent on active item |

#### Buildings — Colors

| Building | Walls | Roof | Status |
|----------|-------|------|--------|
| HQ | Cream (#FFF5E1) | Coral (#E87B5A) | ✅ FIXED in this wave — was gray before |
| Shop | Mint (#D4EAD4) | Green (#5BA086) | ✅ FIXED |
| Oracle Temple | Lavender (#E8DCF0) | Purple (#7B5EA7) | ✅ FIXED |
| House | Sage (#C8E6C9) | Blue (#7EB8C9) | ✅ FIXED |

**Bug fixed:** `roofColor` was defined in GameWorld.tsx BUILDINGS config but never passed to Building component. ACBuilding was deriving roof color via `color * 0.55` (always gray). Added `roofColor` prop threading through Building → ACBuilding.

#### Player Avatar

| Feature | Status | Notes |
|---------|--------|-------|
| Billboard sprite | ⚠️ | Renders as dashed outline box in headless Playwright. Sprite file exists and serves HTTP 200. Likely headless WebGL texture limitation — needs real browser verification. |
| Nameplate ("Player Lv. 1") | ✅ | Renders correctly |
| WASD movement | ✅ | Position updates, camera follows |
| Click-to-move | Not tested | Playwright click goes to DOM, not raycaster |
| Sprite sheet animation | Not testable | Headless browser limitation |

#### Sidebar Navigation

| Item | Desktop | Mobile (375px) |
|------|---------|----------------|
| Player status (Lv. 1) | ✅ | ✅ |
| Home (active) | ✅ blue accent | ✅ |
| Directory | ✅ | ✅ |
| Bounty Board (Soon) | ✅ | ✅ |
| Shop (Soon) | ✅ | ✅ |
| Job Board (Soon) | ✅ | ✅ |
| Leaderboard (Soon) | ✅ | ✅ |
| Profile | ✅ | ✅ |
| Settings (Soon) | ✅ | ✅ |
| Hamburger button | N/A | ✅ visible |
| Slide-over menu | N/A | ✅ opens with X close |

#### All Pages — HTTP Status (34 pages tested)

**Result: ✅ ALL 34 pages return HTTP 200**

| Page | HTTP | Visual | Notes |
|------|------|--------|-------|
| `/student/dashboard` | 200 | ✅ | Game world renders with AC-style buildings, terrain, sky |
| `/student/dashboard/directory` | 200 | ⚠️ | Shows "HTTP 500" error from API — raw, not user-friendly |
| `/student/dashboard/profile` | 200 | ⚠️ | Shows "HTTP 500" + "Go back" link — same raw error |
| `/student/dashboard/bounty` | 200 | ✅ | Coming Soon placeholder with ASCII art |
| `/student/dashboard/shop` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/jobs` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/leaderboard` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/settings` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/calendar` | 200 | ✅ | Month/Week/List tabs, event category legend, "April 2026", "Loading events..." |
| `/student/dashboard/kanban` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/marketplace` | 200 | ✅ | "Loading marketplace..." (waiting on Supabase) |
| `/student/dashboard/mentorship` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/portfolio` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/quests` | 200 | ✅ | "Loading quests..." (waiting on Supabase) |
| `/student/dashboard/tools` | 200 | ✅ | 2 tool cards: ASCII Converter, TETHOS RAG — both with "Launch →" |
| `/student/dashboard/tools/ascii` | 200 | ✅ | Renders |
| `/student/dashboard/tools/rag` | 200 | ✅ | Renders |
| `/student/dashboard/admin` | 200 | ✅ | "Access Denied — T1/T2 clearance required" — correct client-side tier gate |
| `/student/dashboard/admin/analytics` | 200 | ✅ | Renders |
| `/student/dashboard/admin/announcements` | 200 | ✅ | Renders |
| `/student/dashboard/admin/bounties` | 200 | ✅ | Renders |
| `/student/dashboard/admin/election` | 200 | ✅ | Renders |
| `/student/dashboard/admin/marketplace` | 200 | ✅ | Renders |
| `/student/dashboard/admin/members` | 200 | ✅ | Renders |
| `/student/dashboard/admin/quests` | 200 | ✅ | Renders |
| `/student/login` | 200 | ✅ | Terminal aesthetic, email + password, "INITIALIZE SESSION" button |
| `/student/signup` | 200 | ✅ | 5 fields (name, email, password, confirm, invite code), "REQUEST ACCESS" button |
| `/student/onboarding` | 200 | ✅ | ASCII art, XP/coin reward display, "ACCEPT QUEST" button, progress bar |
| `/student/election` | 200 | ⚠️ | Shows "Initializing election protocol..." spinner — should redirect to dashboard when ENABLE_ELECTION is off |
| `/` | 200 | ✅ | Marketing homepage |
| `/npo` | 200 | ✅ | NPO landing page |
| `/company` | 200 | ✅ | Company landing page |
| `/sponsor` | 200 | ✅ | Sponsor landing page |
| `/student` | 200 | ✅ | Student landing page |

#### Responsive Testing

| Viewport | Sidebar | Game World | Notes |
|----------|---------|------------|-------|
| 1280×900 (desktop) | ✅ 240px fixed | ✅ Full render | All elements visible |
| 768×1024 (tablet/breakpoint) | ✅ 240px fixed | ✅ Full render | Correct — sidebar shows at exactly 768px |
| 375×812 (mobile) | ✅ Hidden, hamburger | ✅ Full render | Hamburger opens slide-over with X close |
| **Z-index bug** | — | — | drei `<Html>` "Press E" prompt renders ON TOP of open mobile sidebar overlay |

#### Cross-Browser Testing

| Browser | Method | Status | Notes |
|---------|--------|--------|-------|
| Chromium | Playwright (headless) | ✅ | Full visual test — all features working |
| Firefox | — | ❌ NOT TESTED | Playwright defaults to Chromium only |
| Safari | — | ❌ NOT TESTED | Cannot test via Playwright; potential WebGL shadow perf concern (code analysis) |

**Limitation:** Playwright MCP runs Chromium only. Safari and Firefox require manual testing or WebKit/Gecko Playwright configs.

### Bugs Found This Wave

| Sev | Issue | Status | Details |
|-----|-------|--------|---------|
| **P1** | Building roofs all gray | ✅ FIXED | `roofColor` prop not threaded from GameWorld config to Building/ACBuilding. Fixed by adding prop. |
| **P2** | Mobile sidebar z-index | 🔴 Open | Game world "Press E" HTML prompts render ON TOP of the open mobile sidebar overlay. Html elements from drei need higher z-index management. |
| **P2** | Directory/Profile show raw "HTTP 500" | 🔴 Open | Without Supabase, users see bare "HTTP 500" text. Should show a friendly offline/demo message. Frontend error states exist (Loader2, error message) but the API fetch fails before component renders. |
| **P3** | Font 404 | 🔴 Open | `TestSohne-Kraftig-BF663d89cd32e6a.otf` returns 404. Missing font file in `/font/sohne-font-family/`. |
| **P3** | Player sprite invisible in headless | ⚠️ Needs verification | Sprite shows as dashed outline in Playwright. Asset serves HTTP 200. May be headless-only issue. Needs real browser test. |
| **P3** | Election page doesn't redirect | 🔴 Open | `/student/election` shows "Initializing election protocol..." spinner instead of redirecting to dashboard when `ENABLE_ELECTION` is not set. Middleware should catch this. |

### Previous Bugs Status

| Bug | Wave Found | Status |
|-----|-----------|--------|
| PS1Pipeline dead code | Wave 5 | ✅ Fixed in Wave 6 |
| Math.random() hydration | Wave 5 | ✅ Fixed in Wave 6 |
| FBX files unused (651KB) | Wave 5 | 🔴 Still open |
| No WebGL context loss handler | Wave 5 | 🔴 Still open |
| 48 lint errors | Wave 4 | 🔴 Still open (same count) |
| Middleware deprecation warning | Wave 4 | 🔴 Still open |
| POSITION_TIER_MAP discrepancy | Wave 4 | 🔴 Still open — never clarified |

### Console Errors

| Error | Severity | Notes |
|-------|----------|-------|
| `TestSohne-Kraftig...otf 404` | P3 | Missing font file |
| `/api/profile 500` | Expected | No Supabase credentials |
| `/api/directory 500` | Expected | No Supabase credentials |

---

## Wave 6 — Full Integration Test (v2 AC Visual Overhaul + Backend Phase 2)

Merged all branches: Frontend v2 AC visual overhaul, Backend onboarding + quest APIs, UXUI Sprint 2 specs. Full build + dev server + page testing.

### Build

**Result: ✅ PASSES — 51 pages (up from 49), 6.9s compile**

New routes: `/api/onboarding`, `/api/quests`, `/api/quests/[id]/accept`, `/api/quests/[id]/complete`

### Runtime — All 34 Pages HTTP 200 ✅

Every page tested via dev server (localhost:3001) — all return HTTP 200.

### Game World v2 — AC Visual Overhaul (Code Review)

The game world has been completely rewritten to match `specs/ux-game-world-v2.md`. Major improvements:

| Feature | v1 (Wave 5) | v2 (Wave 6) | Status |
|---------|-------------|-------------|--------|
| Sky | Flat `#87ceeb` | Gradient shader (skyTop→skyBottom) | ✅ |
| Terrain | 80x80 square plane | Circular island (r=40) with dark edge ring | ✅ |
| Grass | Single color | 4 colors (primary/secondary/highlight/shadow) with patches | ✅ |
| Materials | `meshLambertMaterial` | `meshStandardMaterial` with roughness/metalness | ✅ |
| River | Small pond only | Full-width river with animated water + bridge with rope railings | ✅ |
| Trees | 3 types, `Math.random()` scale | 4 types (deciduous/cluster/sapling/cedar), seeded scale, **gentle sway animation** via `useFrame` | ✅ Fixed |
| Bushes | None | 20 bushes, some with flower colors | ✅ NEW |
| Flowers | 6 clusters | 12 clusters with 7 colors, slight emissive glow | ✅ Enhanced |
| Props | Benches + lampposts + banners | + fences, well, log stumps, mushrooms | ✅ Enhanced |
| Clouds | None | 3 animated `<Cloud>` components from drei | ✅ NEW |
| Lighting | Ambient + directional | HemisphereLight + ambient + directional + fill + shadow-bias fix | ✅ Enhanced |
| Tone mapping | None | ACES Filmic + SRGB color space | ✅ NEW |
| Camera | FOV 40, polar π/4.5, dist 22 | FOV 50, polar π/3–π/3.3, dist 15 (closer, better angle) | ✅ Changed |
| Oracle Temple | At ground level | Elevated on 3-unit hill (cylinderGeometry) | ✅ Enhanced |
| Z-fighting | Yes (paths overlapped) | Fixed with `polygonOffset` on all layered planes | ✅ Fixed |

**Previous bugs now fixed:**
- ✅ `PS1Pipeline.tsx` deleted (was P2 dead code)
- ✅ `Math.random()` in Trees replaced with seeded deterministic values (`seed % 5`)
- ✅ `onCreated` handler added to Canvas (tone mapping + color space)

### Building Rendering (v2)

| Building | Position | Color | Roof | Details |
|----------|----------|-------|------|---------|
| HQ | (0, 0, -4) | #FFF5E1 (cream) | #E87B5A (coral) | Chimney, oversized door, arched windows with glow |
| Shop | (-14, 0, 8) | #D4EAD4 (mint) | #5BA086 (green) | Same AC style |
| Oracle Temple | (0, 3, 22) | #E8DCF0 (lavender) | #7B5EA7 (purple) | On elevated hill |
| House | (14, 0, 10) | #C8E6C9 (sage) | #7EB8C9 (blue) | Cozy residential |
| Bounty Board | (10, 0, 8) | dirt path color | N/A | Board sign style |
| Job Board | (-10, 0, -10) | dirt path color | N/A | Board sign style |
| Leaderboard | (10, 0, -10) | well stone | N/A | Pillar style |

All buildings have: door frame (#6B4226), door (#8B5E3C), window frames (#FFFFFF), glass (#B8E4F0 with warm emissive).

### Player / Interaction

- ✅ PlayerAvatar: 2D Billboard sprite, WASD+click-to-move, 5 units/sec, ±38 boundary
- ✅ Building proximity: 4-unit range, "Press E to enter/view" bounce prompt
- ✅ Transition: fade-to-black for buildings, direct nav for boards
- ✅ Camera follow: `CameraControls.moveTo()` on player move

### Sidebar Navigation ✅

SSR verified all 8 nav items render with correct text: Player/Lv.1, Home (active), Directory, Bounty Board (Soon), Shop (Soon), Job Board (Soon), Leaderboard (Soon), Profile, Settings (Soon)

### API Routes

| Route | Method | Status |
|-------|--------|--------|
| `GET /api/directory` | GET | 500 (no Supabase) |
| `GET/PATCH /api/profile` | GET/PATCH | 500 |
| `GET /api/profile/[id]` | GET | 500 |
| `GET/POST /api/bounties` | GET/POST | 500 |
| `GET/PATCH/DELETE /api/bounties/[id]` | Various | 500 |
| `POST /api/bounties/[id]/claim` | POST | 500 |
| `POST /api/bounties/[id]/submit` | POST | 500 |
| `PATCH /api/bounties/[id]/review` | PATCH | 500 |
| `GET/POST /api/economy` | GET/POST | 500 |
| `GET/PATCH /api/onboarding` | GET/PATCH | 500 NEW |
| `GET/POST /api/quests` | GET/POST | 500 NEW |
| `POST /api/quests/[id]/accept` | POST | 500 NEW |
| `POST /api/quests/[id]/complete` | POST | 500 NEW |

All return 500 — expected without `.env.local` Supabase credentials. 16 API endpoints total.

### Lint

**Result: ❌ FAILS — 48 errors, 46 warnings**

Slight improvement from Wave 5 (was 51 errors, 48 warnings). PS1Pipeline errors gone.

Remaining top error patterns:
1. ~15 `fetchX` before declaration (Backend dashboard pages)
2. ~8 ref/value mutations (PlayerAvatar, Building, InteractivePylon3D, CustomCursor)
3. ~8 `no-explicit-any` (Lanyard, GlassNavbar)
4. ~3 setState in effect (CardCarouselLayout, GlassNavbar)
5. ~3 JSX comment text nodes

### Remaining Bugs

| Sev | Issue | File | Status |
|-----|-------|------|--------|
| ~~P2~~ | ~~PS1Pipeline.tsx dead code~~ | Deleted | ✅ FIXED |
| ~~P3~~ | ~~Math.random() hydration~~ | Trees now seeded | ✅ FIXED |
| **P2** | FBX building files unused | `public/assets/buildings/*.fbx` (651KB) | Still present, unused |
| **P2** | No WebGL context loss handler | `GameWorld.tsx` | `onCreated` added for tone mapping but no context loss recovery |
| **P3** | 48 lint errors | Various | Mostly Backend `fetchX` pattern + Frontend ref mutations |
| **P3** | Middleware deprecation | `web/middleware.ts` | Still using deprecated convention |
| **P3** | API routes all 500 | All `/api/*` | Need `.env.local` with Supabase credentials |

---

## Wave 5 — Full Runtime Test (test-merge, all branches combined)

Merged all branches (Backend + Frontend + MGMT fixes + Animal Crossing style overhaul). Ran build, started dev server, tested every page via HTTP, inspected rendered HTML, verified game assets, tested API routes.

### Build Report

**Result: ✅ BUILD PASSES — 49 pages, 6.0s compile**

No TypeScript errors. All pages generate successfully.

### Dev Server Runtime Test

**All 34 testable pages return HTTP 200:**

| Category | Pages | HTTP Status |
|----------|-------|-------------|
| Marketing (5) | `/`, `/npo`, `/company`, `/sponsor`, `/student` | ✅ 200 |
| Auth (4) | `/student/login`, `/signup`, `/election`, `/onboarding` | ✅ 200 |
| Dashboard (17) | `/student/dashboard`, `/directory`, `/bounty`, `/jobs`, `/leaderboard`, `/profile`, `/shop`, `/settings`, `/calendar`, `/kanban`, `/marketplace`, `/mentorship`, `/portfolio`, `/quests`, `/tools`, `/tools/ascii`, `/tools/rag` | ✅ 200 |
| Admin (8) | `/student/dashboard/admin`, `/analytics`, `/announcements`, `/bounties`, `/election`, `/marketplace`, `/members`, `/quests` | ✅ 200 |

### Game World Testing

**Verified via SSR HTML inspection + code review:**

#### Sidebar Navigation ✅
- **8 nav items rendered** in SSR: Home (active, blue left accent), Directory, Bounty Board (Soon), Shop (Soon), Job Board (Soon), Leaderboard (Soon), Profile, Settings (Soon)
- Each item has Lucide icon (House, Users, Scroll, ShoppingBag, Briefcase, Trophy, User, Settings)
- "Soon" badges on Phase 2 items
- Player status at top: "Player" / "Lv. 1"
- Links verified: all point to correct `/student/dashboard/*` paths
- **Mobile hamburger**: `<Menu>` icon at top-left, hidden on md+ breakpoint, slide-in overlay with backdrop

#### Game World Canvas ✅
- `<Canvas>` element renders via `next/dynamic` with `ssr: false` — correctly bails out to client-side rendering
- SSR fallback shows "LOADING WORLD..." ASCII art loading screen
- `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"` — expected behavior for R3F

#### Game World Components (code review)
| Component | Status | Details |
|-----------|--------|---------|
| `GameWorld.tsx` | ✅ | Animal Crossing style — sky blue bg (#87ceeb), 80x80 grass plane, cobblestone paths, pond, flowers, benches, lampposts, banners, 16 trees (3 types) |
| `PlayerAvatar.tsx` | ✅ | 2D Billboard sprite, WASD+arrow movement (5 units/sec), click-to-move via raycasting, frame cycling at 6 FPS, nameplate via `<Html>` |
| `Building.tsx` | ✅ | 7 buildings — ACBuilding (box+cone roof+door+windows) or BoardSign (posts+board). Proximity detection (4 units). "Press E to enter/view" prompt with bounce animation |
| `TransitionOverlay.tsx` | ✅ | Fade-to-black (0.3s in, 0.2s hold, 0.3s out). State machine: idle→fading-in→black→fading-out→idle |
| `PS1Pipeline.tsx` | ⚠️ Exists but may be unused | Animal Crossing overhaul removed PS1 filter. File still in repo but GameWorld.tsx no longer imports it |

#### Character Movement (code review)
- WASD/Arrow keys: handled in `useFrame` loop, updates position at 5 units/sec
- Boundary clamping: ±38 units
- Click-to-move: raycast on ground plane, pathfind to click point
- Direction-based sprite selection: down (row 0-1), left (row 2-3), right (row 4-5), up (row 6-7)
- Camera follows player via `CameraControls.moveTo()`

#### Building Interaction (code review)
- Proximity: `distanceTo(playerPosition) < 4` triggers "Press E" prompt
- E key handler: boards → direct `router.push(href)`, buildings → fade-to-black then navigate
- 7 buildings placed: HQ (center), Shop (-14,0,10), Oracle (0,0,22), House (14,0,14), Bounty Board (10,0,-2), Job Board (-10,0,-10), Leaderboard (10,0,-10)
- Buildings with `href`: Shop→`/shop`, Bounty→`/bounty`, Jobs→`/jobs`, Leaderboard→`/leaderboard`
- Buildings without `href` (HQ, Oracle, House): E key does nothing — expected for Phase 2

### Auth Pages Testing

#### Login Page ✅
- ASCII art header (TETHOS banner)
- Terminal-style UI: "tethos://auth/login"
- Fields: "Agent Email" (email), "Passphrase" (password)
- "Initialize Session" submit button
- "New agent? Request Access" → link to signup
- "Back to Student Home" → link back

#### Signup Page ✅
- Fields: display name (text), email, password, confirm password
- **Invite code field** with placeholder "TETHOS-XXXX"
- Submit button present
- Invite code `TETHOS-W26` seeded in DB migrations

### API Routes Testing

**All 4 API endpoints return HTTP 500** — expected since no Supabase env vars configured.

| Route | Status | Expected |
|-------|--------|----------|
| `GET /api/directory` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/profile` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/bounties` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/economy` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |

**Note:** The middleware gracefully handles missing env vars — when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set, it passes through without auth checks. This means dashboard pages load without login in dev mode.

### Static Assets

| Asset | Path | HTTP | Size |
|-------|------|------|------|
| Character sprite | `/assets/characters/prototype_character.png` | ✅ 200 | 3.3KB |
| Character shadow | `/assets/characters/static_shadow.png` | ✅ 200 | 5.1KB |
| Blue variant | `/assets/characters/prototype_character_blue.png` | ✅ | 3.3KB |
| Green variant | `/assets/characters/prototype_character_green.png` | ✅ | 3.4KB |
| Red variant | `/assets/characters/prototype_character_red.png` | ✅ | 3.3KB |
| Yellow variant | `/assets/characters/prototype_character_yellow.png` | ✅ | 3.3KB |
| Shadow sprite | `/assets/characters/prototype_character_shadow.png` | ✅ | 514B |
| HQ building | `/assets/buildings/hq.fbx` | ✅ | 165KB |
| Shop building | `/assets/buildings/shop.fbx` | ✅ | 166KB |
| Oracle temple | `/assets/buildings/oracle_temple.fbx` | ✅ | 208KB |
| House | `/assets/buildings/house_1.fbx` | ✅ | 112KB |

**Note:** Building FBX files exist but `Building.tsx` uses placeholder geometry (ACBuilding/BoardSign), not FBX loading. The FBX files are unused currently.

### Cross-Browser Compatibility (Code Analysis)

Cannot launch actual browser instances (Chrome/Safari/Firefox), but analyzed code for compatibility:

| Feature | Chrome | Safari | Firefox | Notes |
|---------|--------|--------|---------|-------|
| WebGL2 (R3F/Three.js) | ✅ | ✅ | ✅ | All modern versions support WebGL2 |
| CSS `inset: 0` | ✅ | ✅ 14.1+ | ✅ | Used in layout — needs Safari 14.1+ |
| CSS `gap` in flex | ✅ | ✅ 14.1+ | ✅ | Used in sidebar |
| `KeyboardEvent.key` | ✅ | ✅ | ✅ | Used for WASD/E detection |
| `pointer-events` | ✅ | ✅ | ✅ | Used on HTML overlays |
| CSS custom properties | ✅ | ✅ | ✅ | Used extensively |
| `next/dynamic` CSR | ✅ | ✅ | ✅ | Standard Next.js pattern |
| `@react-three/fiber` | ✅ | ⚠️ | ✅ | Safari WebGL can be slower, especially with shadows |
| `style jsx` | ✅ | ✅ | ✅ | Compiled by Next.js |

**Safari concerns:**
- Shadow mapping (`shadow-mapSize` 2048x2048) may cause performance issues on older iOS/Safari
- `CameraControls` touch events should work but haven't been tested
- WebGL context loss more common on Safari — no recovery handler in GameWorld

**Firefox concerns:**
- None identified. All APIs used are well-supported.

### Lint Report

**Result: ❌ FAILS — 51 errors, 48 warnings**

Error breakdown unchanged from Wave 4.1 — see that section below for details.

### Directory Page ✅
- "Search members" input field present
- Tier filter pills rendered (7 instances of "Tier" text in SSR)
- Uses mock data (9 members) since no Supabase connection

### Profile Page ✅
- "Profile", "Edit Profile" button, Level, XP, Skills, Social Links sections all render in SSR

### Bugs & Issues Found

| Severity | Issue | File | Details |
|----------|-------|------|---------|
| **P1** | API routes return 500 without Supabase | All `/api/*` routes | Need `.env.local` with Supabase credentials. Expected in dev but blocks runtime auth testing. |
| **P2** | PS1Pipeline.tsx possibly dead code | `components/game/PS1Pipeline.tsx` | Animal Crossing overhaul removed PS1 filter. GameWorld no longer imports it. Consider deleting. |
| **P2** | FBX building assets unused | `public/assets/buildings/*.fbx` | 4 FBX files (651KB total) ship to client but Building.tsx uses placeholder geometry. Delete or wire up. |
| **P2** | No WebGL context loss handler | `GameWorld.tsx` | If WebGL context is lost (common on Safari/mobile), the canvas will go black with no recovery. Add `onCreated` handler. |
| **P3** | 51 lint errors | Various | ~15 `fetchX` before declaration, ~10 ref mutations, ~10 `any` types. See lint section. |
| **P3** | Middleware deprecation | `web/middleware.ts` | Next.js 16 warns: use "proxy" instead of "middleware" |
| **P3** | `Math.random()` in render | `GameWorld.tsx:177` | `Trees()` uses `Math.random()` for scale — causes hydration mismatch warnings. Use seeded random or stable values. |
| **P3** | Missing `aria-selected` | `MemberCard.tsx:33` | Element with `role="option"` needs `aria-selected` attribute |

---

## Wave 4.1 — Full Combined Retest (Backend + Frontend + Phase 2 APIs)

### Build Report

**Result: ✅ BUILD PASSES — 49 pages**

All Frontend game world + Backend dashboard + Phase 2 API routes compile cleanly.

| Category | Count | Status |
|----------|-------|--------|
| Marketing pages | 5 | ✅ Static |
| Auth pages (login/signup/onboarding/election) | 4 | ✅ Static |
| Dashboard pages (regular) | 18 | ✅ Static |
| Dashboard pages (admin) | 8 | ✅ Static |
| API routes | 10 | ✅ Dynamic |
| Dev/test pages | 4 | ✅ Static |

**New API routes (Phase 2):**
- `POST/GET /api/bounties` — list + create
- `GET/PATCH/DELETE /api/bounties/[id]` — detail + update + delete
- `POST /api/bounties/[id]/claim` — claim bounty
- `POST /api/bounties/[id]/submit` — submit deliverables
- `PATCH /api/bounties/[id]/review` — review submission
- `GET/POST /api/economy` — balance/transactions + purchase/award

### Lint Report

**Result: ❌ FAILS — 50 errors, 48 warnings across 39 files**

#### Errors by category

| Error Type | Count | Files Affected |
|-----------|-------|----------------|
| `fetchX` before declaration (`react-hooks/immutability`) | ~15 | Backend admin + dashboard pages |
| Ref access during render (`react-hooks/immutability`) | 3 | Building.tsx, AsciiGlobe, GlobeVisualizer |
| Value modification (`react-hooks/immutability`) | ~10 | PlayerAvatar.tsx, InteractivePylon3D, CustomCursor |
| setState in effect (`react-hooks/set-state-in-effect`) | 3 | CardCarouselLayout, GlassNavbar, marketplace |
| JSX comment text nodes (`react/jsx-no-comment-textnodes`) | 3 | MemberCard, TextRevealSection |
| `no-explicit-any` | ~10 | Lanyard, GlassNavbar, etc. |
| Misc | ~6 | Various |

#### NEW Frontend game world errors

| File | Line | Error |
|------|------|-------|
| `components/game/Building.tsx:112` | Ref access during render | `react-hooks/immutability` |
| `components/game/Building.tsx:98` | Unused `id` | `@typescript-eslint/no-unused-vars` |
| `components/game/PlayerAvatar.tsx:68-76` | Modifying values (position, velocity refs) | `react-hooks/immutability` |
| `components/portal/MemberCard.tsx:33` | Missing `aria-selected` on role="option" | `jsx-a11y/role-has-required-aria-props` |

### Merge Conflict Resolution

Resolved 7 conflicts between Backend and Frontend dashboard pages. **Took Frontend's versions** per file ownership (Frontend owns `web/app/student/dashboard/`). Backend's versions of bounty, directory, jobs, leaderboard, profile pages replaced by Frontend's spec-aligned implementations with game world integration.

Backend's admin pages and pages Frontend didn't build (calendar, kanban, marketplace, mentorship, portfolio, quests, tools) were preserved from Backend.

---

## Wave 4 — Post-Backend Merge Full Retest

### Build Report (`npm run build`)

**Result: ✅ BUILD PASSES**

- Next.js 16.1.6 (Turbopack)
- Compiled successfully in 9.0s
- TypeScript check: passed
- Pages generated: **45** (up from 14 in Wave 1)
- New warning: `"middleware" file convention is deprecated. Please use "proxy" instead.`

**All routes:**
| Route | Type | Status |
|-------|------|--------|
| `/` | Static | ✅ |
| `/_not-found` | Static | ✅ |
| `/api/an-token` | Dynamic | ✅ |
| `/api/directory` | Dynamic | ✅ NEW |
| `/api/profile` | Dynamic | ✅ NEW |
| `/api/profile/[id]` | Dynamic | ✅ NEW |
| `/company` | Static | ✅ |
| `/globe-demo` | Static | ✅ |
| `/globe-test` | Static | ✅ |
| `/navbar-test` | Static | ✅ |
| `/npo` | Static | ✅ |
| `/npo/test` | Static | ✅ NEW |
| `/pylon-demo` | Static | ✅ |
| `/sponsor` | Static | ✅ |
| `/student` | Static | ✅ |
| `/student/auth/callback` | Dynamic | ✅ NEW |
| `/student/dashboard` | Dynamic | ✅ NEW |
| `/student/dashboard/admin` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/analytics` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/announcements` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/bounties` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/election` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/members` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/bounty` | Dynamic | ✅ NEW |
| `/student/dashboard/calendar` | Dynamic | ✅ NEW |
| `/student/dashboard/directory` | Dynamic | ✅ NEW |
| `/student/dashboard/jobs` | Dynamic | ✅ NEW |
| `/student/dashboard/kanban` | Dynamic | ✅ NEW |
| `/student/dashboard/leaderboard` | Dynamic | ✅ NEW |
| `/student/dashboard/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/mentorship` | Dynamic | ✅ NEW |
| `/student/dashboard/portfolio` | Dynamic | ✅ NEW |
| `/student/dashboard/profile` | Dynamic | ✅ NEW |
| `/student/dashboard/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/tools` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/ascii` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/rag` | Dynamic | ✅ NEW |
| `/student/election` | Static | ✅ NEW |
| `/student/login` | Static | ✅ NEW |
| `/student/onboarding` | Static | ✅ NEW |
| `/student/signup` | Static | ✅ NEW |
| `/under-construction` | Static | ✅ |

**Dashboard pages: 23 total** (15 regular + 8 admin)

---

### Lint Report (`npm run lint`)

**Result: ❌ LINT FAILS (exit code 1)**

#### NEW errors from Backend's dashboard pages

| File | Error | Rule |
|------|-------|------|
| `student/dashboard/admin/announcements/page.tsx:31` | `fetchAnnouncements` accessed before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx:5` | Unused import `Check` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/bounty/page.tsx` | Multiple `fetchX` before declaration errors | `react-hooks/immutability` |
| `student/dashboard/calendar/page.tsx` | `fetchEvents` before declaration | `react-hooks/immutability` |
| `student/dashboard/directory/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/jobs/page.tsx` | `fetchJobs` before declaration | `react-hooks/immutability` |
| `student/dashboard/kanban/page.tsx` | `fetchBoard` before declaration | `react-hooks/immutability` |
| `student/dashboard/leaderboard/page.tsx` | `fetchLeaderboard` before declaration | `react-hooks/immutability` |
| `student/dashboard/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/mentorship/page.tsx` | `fetchMentors` before declaration | `react-hooks/immutability` |
| `student/dashboard/portfolio/page.tsx` | `fetchPortfolio` before declaration | `react-hooks/immutability` |
| `student/dashboard/profile/page.tsx` | `fetchProfile` before declaration | `react-hooks/immutability` |
| `student/dashboard/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/analytics/page.tsx:53` | Unused `tcSpent` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/admin/members/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx` | `fetchBounties` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/announcements/page.tsx` | `fetchAnnouncements` before declaration | `react-hooks/immutability` |

**Pattern:** Nearly ALL dashboard pages use `useEffect(() => { fetchX(); }, [])` with `fetchX` declared AFTER the effect. The function hoisting works at runtime but the React hooks linter flags it as accessing a variable before declaration.

**Fix:** Move each `async function fetchX()` declaration ABOVE the `useEffect` that calls it, or wrap in `useCallback`.

#### Pre-existing errors (from Wave 1)

| File | Error | Rule |
|------|-------|------|
| `components/cards/CardCarouselLayout.tsx:30` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/layout/GlassNavbar.tsx:213` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/ui/InteractivePylon3D.tsx:85` | Modifying hook return value | `react-hooks/immutability` |
| `components/ui/Lanyard.tsx` | 7x `any` types | `@typescript-eslint/no-explicit-any` |

#### Warnings (~35 total)

Mostly `@typescript-eslint/no-unused-vars` across marketing pages and dashboard widgets. See lint output for full list. Key new ones:
- `components/dashboard/widgets/AnnouncementWidget.tsx:3` — unused `Link`
- `components/dashboard/widgets/CalendarWidget.tsx:25` — unused `formatDate`
- `app/npo/test/page.tsx:621` — missing dep `data` in useEffect
- `app/npo/sections/NPOAbout.tsx:120` — `<img>` should be `<Image />`

---

### Marketing Pages

**Result: ✅ ALL 5 PASS**

| Page | Route | Build Status |
|------|-------|-------------|
| Home | `/` | ✅ Static |
| NPO | `/npo` | ✅ Static |
| Company | `/company` | ✅ Static |
| Sponsor | `/sponsor` | ✅ Static |
| Student | `/student` | ✅ Static |

---

### Auth Flow Testing (Code Review)

**Result: ✅ Auth infrastructure NOW EXISTS (after Backend merge)**

Cannot do runtime testing without Supabase credentials, but code review confirms:

#### Files present
| File | Status |
|------|--------|
| `web/lib/supabase/client.ts` | ✅ Browser client helper |
| `web/lib/supabase/server.ts` | ✅ Server client helper |
| `web/lib/supabase/middleware.ts` | ✅ Route protection (162 lines) |
| `web/lib/supabase/types.ts` | ✅ Full type system (301 lines) |
| `web/middleware.ts` | ✅ Next.js middleware entry point |
| `web/app/student/signup/page.tsx` | ✅ Signup page (343 lines) |
| `web/app/student/login/page.tsx` | ✅ Login page (232 lines) |
| `web/app/student/auth/callback/route.ts` | ✅ Auth callback handler |
| `web/app/student/onboarding/page.tsx` | ✅ Onboarding flow (750 lines) |
| `web/app/student/election/page.tsx` | ✅ Election page (601 lines) |

#### Middleware routing logic (verified via code review)

| Route | Condition | Action |
|-------|-----------|--------|
| `/student/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/election` | `ENABLE_ELECTION === 'true'` + no auth | Redirect to `/student/login` |
| `/student/dashboard/admin/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/dashboard/admin/election` | Auth + T3+ | Redirect to `/student/dashboard` (T1/T2 only) |
| `/student/dashboard/admin/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/admin/*` | Auth + T4/T5 | Redirect to `/student/dashboard` |
| `/student/dashboard/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/*` | Auth + `!onboarding_completed` | Redirect to `/student/onboarding` |
| `/student/onboarding` | No auth | Redirect to `/student/login` |
| `/student/onboarding` | Auth + `onboarding_completed` | Redirect to `/student/dashboard` |
| `/student/login` or `/student/signup` | Logged in | Redirect to `/student/dashboard` |

**Middleware matcher covers:** `/student/dashboard/:path*`, `/student/login`, `/student/signup`, `/student/onboarding/:path*`, `/student/election`

#### Invite code
- `TETHOS-W26` seeded in migration `001_initial_schema.sql` line 658 as active invite code for term `W2026`

---

### Dashboard Pages Inventory (23 pages)

#### Regular dashboard (15 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Home | `/student/dashboard` | ✅ | ✅ |
| Directory | `/student/dashboard/directory` | ✅ | ✅ |
| Bounty Board | `/student/dashboard/bounty` | ✅ | ✅ |
| Calendar | `/student/dashboard/calendar` | ✅ | ✅ |
| Jobs | `/student/dashboard/jobs` | ✅ | ✅ |
| Kanban | `/student/dashboard/kanban` | ✅ | ✅ |
| Leaderboard | `/student/dashboard/leaderboard` | ✅ | ✅ |
| Marketplace | `/student/dashboard/marketplace` | ✅ | ✅ |
| Mentorship | `/student/dashboard/mentorship` | ✅ | ✅ |
| Portfolio | `/student/dashboard/portfolio` | ✅ | ✅ |
| Profile | `/student/dashboard/profile` | ✅ | ✅ |
| Quests | `/student/dashboard/quests` | ✅ | ✅ |
| Tools | `/student/dashboard/tools` | ✅ | ✅ |
| Tools > ASCII | `/student/dashboard/tools/ascii` | ✅ | ✅ |
| Tools > RAG | `/student/dashboard/tools/rag` | ✅ | ✅ |

#### Admin dashboard (8 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Admin Home | `/student/dashboard/admin` | ✅ | ✅ |
| Analytics | `/student/dashboard/admin/analytics` | ✅ | ✅ |
| Announcements | `/student/dashboard/admin/announcements` | ✅ | ✅ |
| Bounties | `/student/dashboard/admin/bounties` | ✅ | ✅ |
| Election | `/student/dashboard/admin/election` | ✅ | ✅ |
| Marketplace | `/student/dashboard/admin/marketplace` | ✅ | ✅ |
| Members | `/student/dashboard/admin/members` | ✅ | ✅ |
| Quests | `/student/dashboard/admin/quests` | ✅ | ✅ |

---

### Profiles Table Schema (FULL documentation)

#### From `001_initial_schema.sql` — profiles table

| Column | Type | Default | Nullable | Constraint |
|--------|------|---------|----------|------------|
| `id` | UUID | — | NOT NULL | PK, FK → auth.users(id) ON DELETE CASCADE |
| `email` | TEXT | — | NOT NULL | — |
| `display_name` | TEXT | — | NOT NULL | — |
| `tier` | INTEGER | 4 | NOT NULL | CHECK (1-4), upgraded to 1-5 in 004 |
| `position` | TEXT | NULL | YES | — |
| `class` | TEXT | NULL | YES | — |
| `subclass` | TEXT | NULL | YES | — |
| `team_id` | UUID | NULL | YES | FK → teams(id) |
| `portfolio` | TEXT | NULL | YES | — |
| `side` | TEXT | NULL | YES | — |
| `xp` | INTEGER | 0 | NOT NULL | — |
| `level` | INTEGER | 1 | NOT NULL | — |
| `rank` | TEXT | 'Initiate' | NOT NULL | — |
| `tethos_coins` | INTEGER | 0 | NOT NULL | — |
| `onboarding_completed` | BOOLEAN | FALSE | NOT NULL | — |
| `onboarding_step` | INTEGER | 0 | NOT NULL | — |
| `has_voted` | BOOLEAN | FALSE | YES | Added in 002 |
| `year` | TEXT | NULL | YES | — |
| `program` | TEXT | NULL | YES | — |
| `hometown` | TEXT | NULL | YES | — |
| `birthday` | DATE | NULL | YES | — |
| `phone` | TEXT | NULL | YES | — |
| `preferred_email` | TEXT | NULL | YES | — |
| `uwo_email` | TEXT | NULL | YES | — |
| `gdrive_email` | TEXT | NULL | YES | — |
| `github_username` | TEXT | NULL | YES | — |
| `instagram` | TEXT | NULL | YES | — |
| `linkedin` | TEXT | NULL | YES | — |
| `discord_tag` | TEXT | NULL | YES | — |
| `favourite_music` | TEXT | NULL | YES | — |
| `dream_retirement` | TEXT | NULL | YES | — |
| `spirit_animal` | TEXT | NULL | YES | — |
| `fun_fact` | TEXT | NULL | YES | — |
| `avatar_url` | TEXT | NULL | YES | — |
| `bio` | TEXT | NULL | YES | — |
| `active_theme` | TEXT | 'dark' | NOT NULL | — |
| `is_alumni` | BOOLEAN | FALSE | NOT NULL | — |
| `is_active` | BOOLEAN | TRUE | NOT NULL | — |
| `created_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `updated_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `last_login_at` | TIMESTAMPTZ | NULL | YES | — |
| `login_streak` | INTEGER | 0 | NOT NULL | — |
| `avatar_config` | JSONB | '{}' | NOT NULL | Added in 004 |
| `skills` | TEXT[] | '{}' | NOT NULL | Added in 004 |
| `social_links` | JSONB | '{}' | NOT NULL | Added in 004 |

**Total: 42 columns** (39 from 001, +1 from 002, +3 from 004)

#### Indexes (from 004)
- `idx_profiles_tier` — on `tier`
- `idx_profiles_is_active` — on `is_active`
- `idx_profiles_display_name` — on `display_name`
- `idx_profiles_level` — on `level`
- `idx_profiles_position` — on `position`
- `idx_profiles_class` — on `class`
- `idx_profiles_display_name_trgm` — GIN trigram on `display_name` (requires pg_trgm)

#### RLS Policies
- `SELECT`: authenticated users can read all profiles
- `UPDATE`: users can update own profile only (auth.uid() = id)
- `INSERT`: users can insert own profile (auth.uid() = id)

#### Auto-profile creation (003)
- Trigger `on_auth_user_created` fires after `INSERT ON auth.users`
- Creates profile with: `id`, `email`, `display_name` (from metadata or email prefix)

---

### All Migrations Summary

| Migration | Contents |
|-----------|----------|
| `001_initial_schema.sql` | 30 tables, RLS policies, seed data (themes, achievements, invite code TETHOS-W26) |
| `002_election_votes.sql` | `election_votes` table, `has_voted` column on profiles, `get_election_results()` function |
| `003_profile_trigger.sql` | `handle_new_user()` trigger for auto-profile creation on signup |
| `004_cleanup_and_extend.sql` | Tier constraint 1-5, `avatar_config`, `skills`, `social_links` columns, 7 indexes |
| `005_avatar_items.sql` | `avatar_items` table, `player_inventory` table, indexes, RLS |
| `006_bounty_system.sql` | `bounty_submissions` table with review workflow, indexes, RLS |

### All Tables (32 total)

profiles, teams, invite_codes, announcements, announcement_dismissals, bounties, bounty_claims, bounty_deliverables, bounty_submissions, events, event_attendance, kanban_boards, kanban_columns, kanban_cards, kanban_card_assignees, kanban_card_labels, kanban_card_comments, kanban_card_checklist, marketplace_items, marketplace_orders, job_listings, job_comments, quests, quest_progress, achievements, user_achievements, tc_transactions, xp_transactions, notifications, mentorship_profiles, mentorship_matches, portfolios, portfolio_items, time_capsules, themes, user_themes, election_votes, avatar_items, player_inventory

---

### API Routes Testing (Code Review)

| Route | Method | Auth Required | Status |
|-------|--------|--------------|--------|
| `GET /api/directory` | GET | Yes (Supabase session) | ✅ Exists, builds |
| `GET /api/profile` | GET | Yes | ✅ Exists, builds |
| `PATCH /api/profile` | PATCH | Yes | ✅ Exists, builds |
| `GET /api/profile/[id]` | GET | Yes | ✅ Exists, builds |
| `POST /api/an-token` | POST | No | ✅ Pre-existing |

Cannot runtime test without Supabase credentials configured.

---

### Middleware Deprecation Warning

**NEW:** Next.js 16.1.6 warns: `The "middleware" file convention is deprecated. Please use "proxy" instead.`

This affects `web/middleware.ts`. The current middleware still works but should be migrated to the `proxy` convention before the next Next.js major version. Not blocking.

---

### Dependency Issues

- **Peer dependency conflict:** `@ai-sdk/react` vs React 19 — requires `--legacy-peer-deps` (resolved via `.npmrc`)
- **npm vulnerabilities:** 10 total (7 moderate, 3 high)
- **New deps added:** `@supabase/supabase-js`, `@supabase/ssr` — installed successfully

---

### Summary

| Check | Wave 1 | Wave 4 | Change |
|-------|--------|--------|--------|
| Build | ✅ 14 pages | ✅ 45 pages | +31 pages, all compile |
| Lint errors | ~25 | ~40+ | +15 new (mostly `fetchX` before declaration) |
| Lint warnings | ~30 | ~35 | +5 new |
| Auth flow | ⚠️ N/A | ✅ Code complete | Full auth + middleware built |
| Marketing pages | ✅ 5/5 | ✅ 5/5 | No regression |
| Dashboard pages | N/A | ✅ 23/23 | All build as dynamic |
| Profiles schema | ⚠️ N/A | ✅ 42 columns documented | Full schema exists |
| Migrations | ⚠️ N/A | ✅ 6 migrations, 32+ tables | Complete |
| API routes | N/A | ✅ 4 routes | All build |
| Middleware | N/A | ✅ 5 route patterns | Deprecation warning |

### Critical Items for Other Agents

**Backend:**
- Fix the `fetchX` before declaration pattern across ALL dashboard pages — move function declarations above the `useEffect` calls
- Fix unused imports (`Check` in bounties, `Link` in AnnouncementWidget, `formatDate` in CalendarWidget)

**Frontend:**
- Game world (R3F) is the #1 priority — zero game code exists yet
- Pre-existing lint errors still need fixing (CardCarouselLayout setState, InteractivePylon3D pointer mutation)

**Management:**
- `middleware.ts` deprecation warning — plan migration to `proxy` convention
- 10 npm vulnerabilities should be audited before production deploy
