# Schedule confirmed September 17, 2026

> September 17 production correction: David requested opening immediately. All four new roles opened at 12:17:10 Toronto (16:17:10Z), with the September 23 11:59 PM Toronto deadline unchanged. PM/VP Marketing are archived. Laptop entry defaults to the applicant world; mobile/reduced-motion and `?view=form` retain direct forms. This supersedes the earlier opening schedule and optional desktop-world entry.

All four roles: September 17 at 3:00 PM through September 23 at 11:59 PM, Toronto time (EDT). UTC opens 2026-09-17T19:00:00.000Z, closes 2026-09-24T03:59:00.000Z. Supersedes historical unset-date notes below. Local drafts updated; production activation remains pending the release checks.

# Director and developer recruitment

Updated 2026-09-16. Requested by David. Branch: `feat/director-developer-recruitment`.

## Latest applicant-world revision: planning interview (2026-09-16)

David paused the broader member-game interview for urgent recruitment preparation. Preserve the current local implementation and delivery work; do not restart. He explicitly requests sub-agent help for character/model and UI/UX work. Initial read-only inspection is complete. The component kit and application reliability refinements are now being implemented locally; see `specs/recruitment-ui-kit.md`.

### Confirmed follow-up R1–R5

- R1: The member/main world is testing-only, not a public destination. After account creation/login, ordinary applicants enter the application game portal. Do not offer the main world via Explore Tethos. This supersedes the prior role-first/optional-village entry ruling for the desktop applicant journey. Keep application tracking and authorized recruitment-admin tools available; those are not the member game. R4 A confirms direct mobile forms without the game canvas.
- R2: David delegates character selection: use a downloaded online character that is simple, cheap to render and easy to integrate with proper existing animations. No bespoke character modeling or creator flow is required. Applicant-only exterior/interior override preserves member visuals.
- R3: Combine sunny seaside village styling with cozy late-afternoon/evening styling, driven by real-life time. Proposed clock default is campus time (America/Toronto), not yet explicitly selected. Night lighting must keep HQ/path/interaction targets readable.

R4 A: direct mobile forms. R5 A: one scrollable application plus review. Board proposal follows the explicit brief: four readable physical postings, selected by click into the role overlay; retain keyboard access through E. Tutorial/glow completion follows actual stages and submitted roles, not simulated progress.

Access-audit finding: changing navigation alone cannot enforce testing-only member access. `/student/dashboard` currently lacks a tester allowlist, and middleware has fail-open cases. Legacy `/student/go`, login/election and callback paths can reach it. Require a server-side member-route test gate plus redirect corrections, while preserving `/admin/recruit` and its authorization. Exact tester allowlist/production policy still needs confirmation; no env or permission mutation has been performed.

New explicit requirements:

- Replace the applicant sprite with a simple properly animated 3D character. This is an applicant-route override, not an instruction to change the separate member-game character vision. Both exterior and HQ currently have separate sprite renderers and need a consistent applicant override.
- Small island with HQ as the central destination; full viewport, close player-follow camera, existing cozy/pixel/material/light/audio treatment. The supplied two-panel sketch establishes the route, not its perspective, black borders, geometry or final art.
- Minimal WASD/E instruction and a top-right tutorial checklist. Faint HQ glow and a restrained directional arrow guide the first walk. Inside, guide the player toward the wall bulletin board.
- Four visible role postings. A selected posting opens a large scrollable application overlay, initially about 85% of the viewport, then refined by David to nearly full-screen (96vw by 94dvh). Reuse actual role questions, validation, resume, drafts, review and submission behavior.
- X saves and closes; closing restores the board/player state. Confetti and a faint green glow/check on that specific posting follow confirmed submission. A saved draft is not a completed application. All four roles may be shown, but unfinished/closed roles remain non-submittable.

The initial entry conflict is resolved by R1 above: the public world is the applicant island and the member world is testing-only. R4–R5 are confirmed above. No premature activation/deployment; login/member-access rerouting is still pending.

Code-inspection findings to fix in the authorized implementation (not runtime-verified this turn):

1. ApplicationForm delays both local and remote draft saving by 800 ms and cancels the timer on unmount; rapid close can lose recent typing. Save-and-close needs an explicit durable path, with accurate local-only versus account-synced status on failure.
2. Local draft cache uses position ID without account identity; scope by user and role, with deliberate handling of legacy drafts.
3. Every submission 409 clears drafts, although closed/unavailable roles also return 409. Preserve work on failed submissions and distinguish confirmed duplicates.
4. In-flight autosaves need ordering/fencing around successful submission so late saves cannot recreate cleared drafts.
5. SuccessScreen computes unconfirmed +7/+14-day review/decision dates. Remove invented dates.
6. Body-level confetti may be behind the native dialog; verify and render inside its top layer.
7. Refresh submitted-role state on identity changes. Drive physical posting indicators from confirmed per-user submissions.

Reusable: ApplicantIsland/ApplicantWorld already provide world/HQ transitions, shared game systems, modal pause/focus and role selection. The current form dialog caps at 720px, board mesh has a single handler, welcome modal gates entry, objective is top-left and physical postings are static. Change these targeted pieces instead of rebuilding the flow. Form layout (existing steps versus one scrollable form) and board interaction details need a focused follow-up after R1–R3.

Completion evidence for the revision: matched exterior/interior/overlay views in Dia; idle/walk/run transitions and grounded character in both spaces; keyboard walkthrough; immediate-close draft recovery and account isolation; real successful submission status without premature activation; responsive direct forms without canvas; truthful dates; member-route regression review. Prior tests are historical baselines, not verification of new changes. Real Google create/write/readback still needs OAuth reconnection and isolated validation; preserve route-before-migration release order.

### Selected implementation candidate after R2

Use Quaternius Ultimate Modular Men's `Casual_Hoodie.gltf` as the applicant-character candidate. The asset agent inspected a creator-linked download outside the repo: about 3.10 MB self-contained glTF JSON with a 1.015 MB embedded buffer, one skin, four meshes/ten material primitives, no textures or required extensions, and 24 embedded clips including Idle, Walk, Run, Interact and Wave. Creator license is CC0. This avoids custom modeling/retargeting and fits casual campus clothing better than the blocky fallback. Actual in-scene animation, grounding, pixel-filter appearance and runtime cost still require verification; no asset is integrated yet.

### Character shortlist from requested read-only asset review

No locally usable animated human was found among 261 GLBs inspected by the character agent. Candidate sources:

- [Kenney Blocky Characters 2.0](https://kenney.nl/assets/blocky-characters): CC0; official archive inspection found a 113,596-byte character GLB with 27 embedded clips including idle/walk/sprint/interactions. Simplest integration, but blocky appearance needs approval.
- [Quaternius Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html): creator lists CC0, 11 characters, 24 animations and glTF/FBX/OBJ/Blend. Casual low-poly humans may fit better; actual clip names, size and scene appearance still unverified.
- [Kenney Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists): CC0; official archive has FBX idle/run/jump, no walk. More assembly needed, lower priority for this urgent task.

No asset installed. Choose the visual family with David before integrating a candidate into both applicant exterior and interior. Keep existing movement/collision/camera logic and member sprite defaults.

## Updated portfolio content (David, 2026-09-16)

David supplied External's portfolio overview/responsibilities/qualities, 3–4 openings and four new questions; these now replace its historical question drafts. Internal has 2–3 openings, the supplied qualities and three new questions (social event, participation, short-video link). Marketing questions are empty pending his copy; removed the old creative-video placeholder. Developer is unchanged.

Internal's pasted overview/responsibilities duplicated External. Replaced them with explicitly marked draft Internal-specific copy about socials, member engagement and coordination. David confirmed drafting Internal-specific copy for review; the wording remains marked Draft until reviewed. David also confirmed 250 words per written director answer and a URL field for Internal Q3. Internal Q3 uses a URL input with shared client/server HTTP(S) validation and no word counter. New semantic question IDs prevent old draft answers from being presented against changed prompts.

Updated both direct role pages and the optional HQ posting overlay. Local content only; no production position mutation. TypeScript and focused lint pass; 12 targeted submission/delivery tests pass, including new link validation coverage. ApplicationForm retains its prior set-state-in-effect lint error and prior warnings. Dia verified External/ Internal copy and question display. Existing deployment and auth/Sheets integration gates below remain.

## Current entry decision and implementation (David, 2026-09-16)

David's latest explicit choice supersedes the mandatory desktop game journey below: **show the four roles immediately; make the village optional**. Applying must not require learning controls, finding HQ or walking to a board.

- `/student/apply` now opens the compact four-role directory on desktop and mobile. No game import or WebGL is required on this route. The optional desktop “Explore Tethos” link opens `/student/apply/portal`; game prefetch is disabled.
- Each role opens a direct page with questions available before sign-in. Removed scroll-depth and acknowledgement gates. Sign-in redirects back to that exact role, where an eligible signed-in applicant gets the existing form immediately. Drafts, resume upload, submission validation and duplicate checks remain.
- Optional village replacement implemented using the real member-game rendering/movement/material/audio modules, compact textured map, guide, bridge and furnished HQ. A physical four-posting board opens a focused paused-game role/application overlay. The rejected mini renderer is removed. Member worktree and authored map were not edited; shared game modules/assets in this checkout were upgraded and need member-route regression review. The old HQ building asset is preserved separately from the applicant HQ shell/door.
- Completion checks: desktop/mobile direct entry, correct role links/questions and back navigation, no forced game/read gate, no mobile canvas, focused lint/typecheck/tests/build. Optional gameplay and production integrations retain the limitations below.

### Verification and remaining gaps

- 185 tests in 16 files pass; TypeScript and final webpack production build pass. Focused changed-page lint passes. Full lint: 69 errors / 52 warnings, versus original 74 / 53. Remaining errors are existing debt; full lint is not green.
- Dia visual checks: desktop four-role directory and role details; 390×844 viewport override for mobile (browser zoom reports 433 CSS-pixel width), no horizontal overflow and zero canvas elements. Four draft roles render; submissions are disabled in preview. Default viewport restored after testing.
- Optional world previously exercised in Dia: walking/click movement, guide, bridge/HQ approach, E entry, furnished interior, board approach and four-posting overlay. Fixed focus return to the game, front-facing board/mat, floor texture, visible postings and loading-manager render warnings. No final hardware/FPS acceptance, real-audio listening check or member-game regression review is claimed.
- Authenticated end-to-end submission, resume access and actual Google spreadsheet create/write/readback are still unverified. No production writes, migrations, scheduling, emails, push or deployment. Google refresh still needs reconnection (`invalid_grant`). Dates/final questions are unset.
- Local previews: `/student/apply?preview=1` (default), `/student/apply/portal?preview=1` (optional game). `?view=form` remains compatible. Preview role pages now use the real direct route, not a detour into the world.

## Earlier visual direction and planning (historical)

The following records explain the rejected first pass and art acceptance for the **optional** village. Statements that implementation is paused/not started and that the game is the default describe earlier checkpoints, superseded above.

## Visual direction correction (David, 2026-09-16)

The screenshot of the first applicant-island implementation was explicitly rejected. The present mini scene, outdoor role stalls and surrounding website bars/cards are not an approved design. UI implementation is paused for planning; retain the backend work.

Confirmed replacement brief: use the existing game portal we have been developing on `feat/game-default-island` as the visual and interaction baseline. After applicant login, enter a smaller version of that world. Reuse its player/camera/environment and real enterable TSI HQ. All four application positions belong inside HQ. The experience fills the viewport as a game, without a website header/footer or a role-card section beneath it. Preserve the confirmed direct-form alternative and mobile forms.

Read-only inspection found reusable `GameWorld.tsx` follow-camera/player/interior transitions and `HQInterior.tsx` room, receptionist and interactable-station system in `.claude/worktrees/restart-art-cohesion/web/components/game/`. No replacement code was written after this correction. All three planning answers are now confirmed: one recruitment board with four visible postings inside HQ; explore a compact version of the existing village and interact with a guide; selecting a posting opens a focused application overlay over the paused game. The plan below is ready for review; replacement implementation has not started. Prior implementation checks describe the rejected first pass.

## Outcome and order

1. Prepare Marketing/Internal/External Director and Developer recruitment. David confirmed four separate roles and reuse of existing questions as drafts. Dates remain unset. Never silently activate draft questions or close/archive existing applications.
2. Protect submission integrity and handle 200+ applications. Keep existing Supabase tables, add indexed review ordering and enforce open-position rules at the database boundary. Preserve duplicate protection and drafts.
3. Automatically create a private Google spreadsheet using the configured recruitment OAuth account. Export all submitted fields and answers, keep updates current, and make retries safe. Persist pending work in Postgres; never make Google availability a condition of saving an application.
4. Refine the recruiting path from public navigation through roles, application and confirmation. Remove stale dates from shared recruiting entry points.
5. Latest choice: four roles immediately on desktop and mobile; the village is an optional desktop visit. Use existing art and obvious movement/interactions. Reuse the parked applicant-world work selectively; do not merge the member-game roadmap.

## Completion checks

- Isolated tests for 250+ records, duplicate/retry handling, concurrent submissions, deadlines, auth boundaries and Google failure/recovery.
- Spreadsheet includes essay questions/answers, profile extras, upload references, role, status and reviewer context. Repeated sync updates fixed rows rather than appending duplicates.
- Admin can see pending sync, open the sheet and retry with useful error feedback.
- Typecheck, focused tests/lint and production build. Existing unrelated lint debt is recorded, not expanded.
- Dia desktop/mobile review of navigation; island movement/interaction, loading/error fallback and readable forms. Report measured performance with device/settings, not a blanket claim.
- Preserve old applications, `.env`, applied migrations and saved game-map drafts. David tests before push. No emails to real applicants during QA.

## Current evidence

Read-only production check: 68 applications, 8 positions, database about 18 MB. Application user/position/status indexes and unique(user_id, position_id) exist. Current INSERT policy only checks owner. No pg_cron/pg_net installed. No capacity upgrade indicated by this record count alone; verify query behavior and upload limits.

Current Google sync appends every time, omits essays/meta, caches new sheet IDs only in process memory and silently logs failures. Manual sync repeats all applications and appends duplicates. Replace with a durable fixed-row projection using RAW values and batches. Google limits are 60 reads/writes per minute per user/project; avoid one request per field/application in retry/backfill.

Sources: `STATE.md`, recruitment route handlers, `lib/google-sheets.ts`, parked `feat/apply-world`, Supabase read-only schema/count inspection, https://developers.google.com/workspace/sheets/api/limits.

## Game feel and art acceptance (2026-09-16)

David explicitly says the priority is game feel: the real, cozy, nostalgic experience already being developed. The applicant island must meet that bar before form integration proceeds. Passing tests or loading a few shared GLBs does not establish visual continuity.

### Source authority and conflicts

- September 6 approved direction in `Documents/2026-09-06 Tethos game revamp plan.md` and `Sessions/2026-09-06 Tethos default island first pass.md`: Animal Crossing-inspired environment, 2D characters, deliberately pixelated scenery/characters by default with an off toggle; existing asset library first; use actual shared game components.
- Current member-game `specs/game-world-development-plan.md`: cozy seaside village with arcane elements; stable elevated follow camera with limited zoom. Broader combat/economy features are not added to the applicant island by this aesthetic reference.
- July `specs/lighting-research.md`: warm key/cool fill, readable colored shadows, controlled highlights, stable light, protected stylized colors and subtle atmosphere. The doc itself rejects global wrap-lighting after it flattened shapes. Preserve the tuned result rather than blindly applying every research proposal.
- `specs/acnh-system-reference.md`: authored texture/material response, consistent scale, rounded material boundaries and intentional constrained views. September's naturally blended terrain requirement supersedes any reading that the editing grid should look like exposed square blocks.
- April `specs/ux-interiors.md`: furnished walkable rooms, warm wood/plaster, closer room camera, proximity stations and brief door fades. Current existing HQ art/materials take precedence over its old placeholder-geometry suggestions.
- March `specs/ux-game-world-v2.md` remains a mood/reference source. Its ban on pixelation, ACES recommendation, primitive-model recipes and vertex-color-only terrain are superseded by later choices and repairs. Do not reintroduce them by treating the old file as the newest specification.
- Inspected David's bundled reference images `specs/references/acnh/ref-01.png` and `ref-07.png`: intimate camera framing, coherent object scale, layered planted/wooden/stone edges, small lived-in clusters and restrained water. These support composition decisions; they are not new gameplay requirements.
- The September reference build is a working baseline, not a fully accepted finished visual standard. Its historical logs still flag sparse composition, shoreline defects and unmeasured performance. Fix relevant visible defects rather than inheriting them unquestioningly.

### Required feel

| Aspect | Target and acceptance |
|---|---|
| Camera and scale | Stable player-follow view with limited zoom, using the existing camera/player behavior. Player, guide, trees and HQ read at normal gameplay scale. Smaller island means shorter distances and fewer destinations. No distant overview as the default. |
| Nostalgic rendering | Whole-scene pixel treatment on by default, consistent 2D character animation, existing warm color grade. Keep form text and essential HUD readable. Match the current game graphics settings rather than invent a separate shader aesthetic. |
| Materials and grounding | Use the corrected model/material loader and restored assets, with appropriate color spaces, foliage tint, canopy orientation, building textures and contact shadows. Reuse the real terrain/path/shore materials. No flat replacement path discs or raw GLB clones that skip those corrections. |
| Composition | Arrival path framed by plants/props, HQ as the clear destination, small scenic side loop and a shoreline glimpse. Intentional clusters and usable paths; avoid the rejected bare circular lawn and evenly spaced perimeter trees. |
| Light and water | Warm sunlight balanced by cool ambient fill; soft readable shadows and controlled warm indoor pools. Restrained water movement/highlights. No washed-out grass, featureless uniformly bright surfaces or screen-filling white sparkle noise. First matched review uses existing daylight/golden-hour presets. |
| Movement and interaction | Reuse the established player animation, grounded traversal, camera damping and interaction feedback. Guide has readable idle/turn/dialogue behavior. HQ entry uses a brief soft fade and proper door spawn/return. No billboard/menu opens that pretend to enter the building. |
| Sound and life | Use the existing ambient loops and footstep, door, click/confirm and dialogue-blip assets through the current audio lifecycle/settings. Sound activates through user interaction and stays muteable. Gentle environmental movement supports the scene without competing with the board/form. |
| HQ and form | Warm furnished HQ at a closer interior camera. Four postings are physically associated with the recruitment board. The application overlay has the game UI's visual language with clean readable controls; world movement pauses and focus stays in the form. Closing returns to the same board position with draft intact. |
| Performance | Reduce world footprint, loaded content and unnecessary work while preserving the above identity. Pause/render appropriately behind the form and in hidden tabs. Verify actual frame pacing and loading on recorded hardware; a smaller asset byte count does not establish good game feel. |

### First review deliverable

A complete short playable sequence: login/arrival → walk through a composed village pocket → speak to guide → enter furnished HQ → approach four-posting board. Show arrival, outdoor walking and interior views at matched settings, then test movement, transitions and sound. Only after this sequence meets the intended feel should the existing application backend/form be integrated. No broader member-world rewrite or incidental gameplay features.

### Why the rejected first pass diverged

`ApplicantScene.tsx` used a fixed camera at `[0,30,-34]`, a separate movement implementation, no game PostFX/pixel setting, no scene shadow setup and no audio controller. `IslandProp.tsx` cloned models without the newer `prepareModel`/`applyModelTextures` pipeline. `MiniTerrain`/`MiniOcean` introduced a separate visual treatment. These shortcuts removed the very systems that create continuity with the member portal. Do not use that scene as the replacement's rendering baseline.

## Replacement experience plan

### Confirmed by David

- Use the existing game portal from `feat/game-default-island`: same player presentation, camera/movement feel, art, terrain/water treatment, lighting and building/interior transitions. Reduce the world footprint and available destinations rather than shrinking the player/buildings or creating another visual style.
- Full-viewport applicant game after login. Remove the website navigation/header, bottom role directory and surplus page area from the game route. Reuse minimal game HUD conventions for help/menu and interaction prompts.
- Compact existing village with exploration and one guide. Recruitment is in enterable TSI HQ.
- One recruitment board inside HQ with four visible postings: Marketing Director, Internal Director, External Director, Developer.
- Selecting a posting opens a focused application overlay over the paused game.
- Direct forms remain available, and mobile uses forms without loading WebGL.

### Proposed scene composition and journey

1. Applicant chooses Apply and signs in through the existing authentication flow. A short branded game-loading state leads into the applicant world. Preserve separate member/admin destinations.
2. Arrival is on a small village path/plaza, at normal gameplay camera distance. HQ is visible ahead, with a short clear walk to its entrance. A compact planted loop and shoreline provide room to explore. Familiar assets stay at their existing world scale; avoid the rejected distant overview of an empty circular island.
3. A guide beside arrival offers a brief welcome, movement/interact help and directions to the recruitment board. Speaking to the guide is optional and does not gate applications.
4. Enter HQ through the existing building/interior interaction and transition. Reuse the actual furnished room. Put the recruitment board in a clear sightline from the entrance; show all four role titles on its postings.
5. Interact with the board and select a role. The focused overlay shows its description, questions and the existing application form. Freeze movement and world input while it is open; trap focus in the overlay and keep a clear close/return action. Preserve the draft on close and restore the player at the board when returning.
6. After submission, show confirmation and the role's submitted status. Applicants can return to the board, apply for another role or check their existing application through the game menu.
7. Keep a small, consistently reachable direct-form control using the existing game UI style. It leads to the same roles/form data. Mobile goes through the ordinary role/form flow, with identical drafts, validation and status.

### Implementation and review sequence

1. Compare the current member portal exterior and HQ at matched views. Reuse the specific camera, avatar, terrain/water and interior systems needed for the applicant route; keep the larger member-world worktree unchanged.
2. First visual review: full-screen arrival, short walk, guide and entering the furnished HQ with four postings. Show those views before spending more work on form integration. Match the established portal's style and scale.
3. Connect the board to the existing validated application form, draft/submitted states, auth return path and pause/resume behavior. Retain backend delivery work.
4. Verify the whole route in Dia, keyboard focus/escape, direct forms, mobile without WebGL, returning applicants and four distinct applications. Check actual frame rate and loading on representative hardware. Test data only; no real emails.

### Completion criteria

The applicant can log in, understand the destination immediately, enter HQ, select any of four postings and complete/close/resume an application without leaving or losing their place in the game. The page fills the viewport without website bars, bottom role cards or surplus scrolling. The exterior/interior visibly match the existing game portal. Mobile/direct forms remain usable independently. Production opening still requires dates/final question review, live Google delivery verification and David's testing before push.

## Deployment and connection dependencies

- Local Google OAuth refresh was checked 2026-09-16 and returns `invalid_grant`. Reauthorize the existing recruitment account, then update its refresh token in the deployment configuration. No `.env` file was edited. Google delivery cannot be claimed live until a real create/write/readback succeeds.
- The local configuration has no CRON_SECRET. Use a deployment secret plus the matching Supabase Vault secret, then run `web/supabase/schedule-recruitment-sheet.sql` to retry pending records every minute. pg_cron/pg_net are not currently installed on production. The schedule file is prepared but has not been run; after-response attempts and manual retries work without it, unattended recovery requires it.
- Deploy the new validated server route before applying the delivery migration: the migration removes direct authenticated INSERT privileges. Old client-scoped server inserts would fail after that revoke. Then apply migration, confirm trigger/backfill/permissions, reconnect Google, create sheet, inspect a synthetic record end-to-end, and enable scheduled recovery. Do not insert a test applicant into an open real round or send real emails.
- The managed `Recruitment records` tab uses fixed row addresses. Treat it as an output: use Sheets filter views; do not physically sort/delete/move managed rows or use it to change application status. Review edits belong in the admin board. Existing legacy tabs are not overwritten. Folder sharing is inherited from the configured recruitment destination; no new sharing is granted by this code.
- Sheet resume links point to the authenticated application preview, avoiding expiring public file links. Uploaded portfolio metadata is preserved in dedicated columns. Each essay has its own question/answer columns.
- Storage observed: 95 resume objects = 16,115,295 bytes, 19 portfolio objects = 104,764,255 bytes. New resume cap is 2 MiB at UI/API submission and bucket configuration; existing objects remain intact. New-role creative work uses portfolio links unless David requests uploads. Actual plan/storage allowance and network/load behavior must still be reviewed at launch.

## Confirmed round choices (2026-09-16)

- Four separate applications: Marketing Director, Internal Director, External Director, Developer. No portfolio-ranking application.
- Questions copied into `web/lib/recruitment-round-drafts.json` from prior sources: Marketing uses `_apply-fall-2026-essays.mjs`; Internal and External use `_apply-vp-essays-v2.mjs`; Developer uses the existing `dev-directors` question in `lib/recruitment.ts`. External role wording changes from VP to Director. These are historical draft prompts, including the summer scenarios, not finalized current-round instructions.
- Marketing video and Internal planning-document answers use shareable links; no new large upload requirement.
- The rejected first pass currently routes `/student/apply` directly into the island on desktop. The replacement must put applicant sign-in before world entry. Preserve a direct directory/form route and the mobile/reduced-motion fallback; finalize route wiring with the existing auth destinations.
- Opening and closing dates remain unset. Production activation is still pending final dates and question review.

## Local verification and handoff

- `npm test`: 48 passing tests. Includes API ownership/review-field protection, resume size/type, closed-role/duplicate handling, bounded admin pagination, sheet creation/recovery, RAW fixed-row writes and retry behavior. Google and email are mocked; no real mail was sent.
- `tests/recruitment-delivery.sql` passed on disposable local PostgreSQL database `uwotsi_recruitment_delivery_test` and rolled back its fixtures. Covers 300 applications, unique sheet row assignment, exclusive lease, version-aware acknowledgement, deletion tombstones, changed position data, deadlines/archive and queue permissions. This is a correctness test, not a 300-client HTTP load test.
- TypeScript passed; webpack production build passed. Full lint: 72 errors / 52 warnings versus the pre-existing 74 / 53 baseline. New recruitment modules pass focused lint. Removed only byte-identical generated `.next/dev/types/* 2.ts` copies that caused duplicate declarations.
- Island model/sprite files total 847,341 bytes, excluding JavaScript. The mini loader avoids the member world's automatic asset preloads. Rendering pauses behind a form and in a hidden tab; DPR caps at 1.25. Actual FPS, visual quality, keyboard/touch behavior and authenticated browser submission have not been verified.
- Dia Computer Use was blocked on its current URL and ended the browser session. No substitute browser was used. Browser review remains a required gate.
- Review locally at `/student/apply?preview=1`; direct directory at `/student/apply?view=form&preview=1`. Preview submits nothing. `node scripts/prepare-recruitment-round.mjs` prints four inactive rows; `--write-drafts` inserts missing draft roles without modifying existing ones. Only the read-only default was run.
- Next: David reviews desktop/mobile, confirms dates and final question edits; reconnect Google; verify authenticated submission/file access and real sheet create/write/readback in an isolated test setup; then test and deploy server, apply migration/role configuration and enable the retry schedule. Do not claim production readiness before these checks.

## UI and application safety checkpoint (2026-09-16)

Implemented locally: Tethos-branded village component kit and dev showroom, real form in near-fullscreen sheet, one-scroll plus review, flush-on-close, immediate account/role-scoped draft cache, serialized remote writes, bounded requests, truthful save/error states and recruitment help link. Failed draft loads block editing rather than replacing saved progress with an empty form. Success requires a backend receipt; closed/unconfirmed failures retain answers. Duplicate retries recover saved applications even after closing. Draft API suppresses stale drafts when submission exists; PDF bytes/size and ownership validated. Confetti renders inside the modal and no invented review dates remain.

Final focused verification after combined changes: **44 tests passed** (12 draft coordinator/recovery, eight draft API, 14 submission API, five delivery-data, five Sheets worker). TypeScript `--noEmit --incremental false` passed. Focused ESLint across 13 changed/new TS/TSX files passed with no code warnings; tool printed the existing stale baseline-browser-mapping database notice. `git diff --check` passed. No production build was rerun for this checkpoint.

Dia: inspected branded board and nearly fullscreen actual form; Internal preview profile/year/source/essay/URL entry and review worked; empty required fields show errors; Escape restores posting focus; phone-width DOM/interaction check at433CSSpx had no horizontal overflow and disabled preview submission. Desktop screenshot inspected. Phone-sized screenshot capture returned no data twice, so no mobile visual screenshot acceptance claim. Preview makes no persistence/upload/submission requests. No console errors observed in the tested preview.

These are mocked correctness/failure tests, not authenticated Supabase end-to-end, Google integration or concurrent HTTP load tests. Live saved-record readback, actual uploads, cross-device recovery, main-world access gate, character/island refinement and Google reconnection/readback remain outstanding. Simultaneous cross-tab edits remain last-writer-wins; draft pre/post checks are not an atomic DB fence. Legacy account-unscoped local drafts remain untouched but are not automatically imported. No env changes, real applicant emails, role activation, migration, push or deployment. Keep route-before-migration release order.
