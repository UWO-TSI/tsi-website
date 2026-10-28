# Spec index

Paths are relative to `specs/` (current locations; a folder regroup is proposed, not done). Status: live = current source of truth, reference = context, still accurate enough. If a spec conflicts with the first two, the first two win. Open-question sidecars (`*-questions.md`, 40+) record agent assumptions; read only when auditing. `evidence/` holds SQL smoke notes, balance rows and screenshots (not specs). `references/` holds David's art references.

## Overrides everything, then process
`game-world-development-plan.md` | Decision ledger; overrides every other spec | live
`development-roadmap.md` | Build order and milestone sequence | live
`known-defects-2026-07.md` | Measured foundational defects, re-measure before acting | reference
`david-decisions.md` | Open decisions waiting on David (Oct 3) | reference
`lane-rules.md` | Rules for every coordinator lane | live
`terrain-law.md` | ACNH grid law for terrain, water, cliffs, placement | live
`design-bible.md` | The one canon for UI, art and models (UI and Models set 2026-10-28; Art in progress) | canon
`design-principles.md` | Project vision and design principles, partly superseded | reference
`launch/v1-launch.md` | v1 launch run sheet: freeze Oct 24, launch Oct 31 (row 317) | live
`v1-drop.md` | v1 Arrival (Halloween) plan, scope, lane split | live

## Lanes and process (stay in place)
`lanes/coordinator.md` | Coordinator handoff state | live
`lanes/flat-ui.md` | Flat UI lane brief | live
`lanes/hq-interior.md` | HQ interior lane brief | live
`lanes/README.md` | Lane handoff index | live
`lanes/wardrobe-b2.md` | Wardrobe batch 2 lane brief | live
`lanes/wardrobe-followup.md` | Wardrobe follow-up lane brief (visor logo, merch catalogue rows) | live

## World, terrain, lore
`island-core.md` | Milestone 1 island core, look transfer | reference
`island-painter.md` | Hand-painted village map tool and data | live
`lore.md` | Tethos Island lore canon | live
`seasonal-events.md` | Four repeating club-goal seasonal events | reference
`seasonal-palettes.md` | Monthly palette and content cadence | reference
`terrain-blending.md` | Natural terrain blending inside the grid | reference
`terrain-v2.md` | World island terrain v2 | live
`world-editor.md` | 3D smooth terrain editor | live

## Look and rendering
`acnh-system-reference.md` | ACNH rules behind the target look | reference
`look-development.md` | Sunny-not-flat look spec, sections 5 to 9 | live
`look/applied.md` | Open-air sun applied, row 236 | reference
`look/baseline.md` | Look baseline and flatness diagnosis | reference
`look/presets.md` | Look lab and first three directions | reference

## Characters and wardrobe
`avatar-fit.md` | Face, hair, accessories sit on head | reference
`avatar-v7.md` | Hand-modeled head, sculpted hair, painted face | reference
`avatar-v8.md` | Organic matte hair and accessories, rows 264 to 266 | reference
`character-art-pass-2.md` | Crafted items become wearable parts | reference
`character-in-engine.md` | Characters in engine, outfits and clips | reference
`character-set.md` | Unified Blender characters on one rig | reference
`characters/head-fit.md` | v8 head, shared skull, hair fit standard | live
`characters/head-roblox.md` | v9 head, hairstyles attached Roblox-style | live
`characters/head-v10.md` | v10 rounder head, detail by situation | live

## Movement and camera
`camera-orbit.md` | Orbit camera, row 277 | live
`glider.md` | Leaf glider, first movement unlock | reference
`movement-feel.md` | Movement feel details, row 273 | live
`movement-slide.md` | Slide and momentum tech, row 274 | live
`movement.md` | Momentum hops, climb, Q dash, rows 243-244 | reference

## Classes
`classes/brief.md` | 16 classes brief | reference
`classes/design-sheet.md` | The 16 subclasses design sheet, rows 286-290 | live
`classes/launch-cleanup.md` | Classes v2 wave 5 cleanup list | reference
`classes/playtest.md` | Class playtest harness | reference
`ux-classes.md` | Class visual identity sheet | reference

## Combat
`combat-content.md` | Combat content, kits and mobs | reference
`combat-foundation.md` | Combat milestone 2, one encounter four approaches | reference
`combat-polish.md` | Combat polish, row 268 | reference

## Arrival, onboarding, progression
`hq-onboarding.md` | HQ onboarding after Bram's tour, row 312 | live
`launch-routing.md` | New island becomes the member game route | reference
`oracle-identity.md` | Oracle quiz, family, display names | reference
`polish/arrival-wharf.md` | Arrival, wharf and home island polish | reference
`polish/hud-first-login.md` | HUD frame and first login | reference
`progression-systems.md` | Main quest, club goals, journal, letters | reference
`ux-oracle-v2.md` | Oracle quiz as card-game NPC encounter | reference

## Interiors and study
`cafe-polish.md` | Cafe polish, rows 268-269 | reference
`homes.md` | Personal island, starter house, decorating | reference
`interiors/hq.md` | HQ interior | live
`interiors/shop.md` | Shop interior, row 313 | live
`polish/interiors.md` | Interiors polish plan | reference
`study-world.md` | Study seats and outdoor tables in world | reference
`study.md` | Cafe tables, Pomodoro sessions, coins | reference
`ux-interiors.md` | Building interiors, Animal Crossing style | reference

## Peaceful life and NPCs
`companion.md` | Phone companion lightweight mobile shell | reference
`crafting.md` | Workshop, recipes, materials | reference
`llm-npc-system.md` | LLM-driven NPC design | reference
`peaceful-loop.md` | Fishing, bugs, foraging, journal, museum | reference
`polish/fishing.md` | Fishing polish | reference
`polish/forage-craft-museum.md` | Foraging, crafting, museum, shop polish | reference
`polish/living-village.md` | Living village polish | reference
`polish/reachability.md` | Reachability, resident talk, companion | reference

## Multiplayer
`multiplayer.md` | Multiplayer, rows 296-299 | live

## Game UI and polish
`game-ui.md` | Tool wheel, held items, backpack, rows 279-281 | live
`polish/flat-ui.md` | Flat UI: shop style across menus | live
`polish/ui-themes.md` | UI themes: one colour sheet per theme, how to add one | live
`polish/gui-sheet.md` | Own GUI sheet from AC UI kit, row 285 | reference
`polish/menus.md` | Menus and sheets polish | reference
`polish/README.md` | Polish plan index, rows 268, 273 | reference
`polish/world-refinement.md` | Birds, trees, flowers, HUD stack, row 284 | reference

## Economy
`economy.md` | Wallet, shop, selling, coin sources | reference

## Performance
`perf/2026-10-baseline.md` | October 2026 performance baseline | reference
`perf/2026-10-results.md` | October performance pass results | reference
`perf/2026-10-v1-results.md` | v1 performance pass results | reference
`perf/budget.md` | Performance budget | live
`perf/effects-cost.md` | Cost of each character effect | live
`perf/README.md` | Performance process | live

## Art direction, assets, audio, merch
`art-direction-oct17.md` | Art direction from Oct 17 reviews, row 314 | live
`asset-needs.md` | What is still programmer art | reference
`asset-stack.md` | Confirmed asset stack and architecture | reference
`audio-pass.md` | Audio pass | reference
`merch/genesis-sticker.md` | GENESIS sticker merch | reference
`merch/tsi-keycap-keychain.md` | TSI keycap keychain merch | reference
`merch/tsi-lanyard.md` | TSI lanyard merch | reference
`polish/sound.md` | Sound polish, waits on sound source | reference
`props-and-enemies-art.md` | Original low-poly props and enemies | reference
`sky-art-prompts.md` | Sky art prompt kit v2 | reference
`sky-prompts.md` | Sky panorama generation prompts | reference

## Ops, launch, QA, security
`admin-pass.md` | Admin tooling content control | reference
`api.md` | API contracts | reference
`cleanup-and-game-security.md` | Game-side security cleanup | reference
`hardening-questions.md` | Hardening open points | reference
`launch-batch.md` | Beta-day DB and smoke checklist | reference
`launch-readiness-fixes.md` | Launch-readiness fixes from Phase 1 | reference
`launch-runbook.md` | Production schema and deploy runbook | reference
`phase1-staging.md` | Staging database and signed-in end-to-end | reference
`playtest-round1.md` | David playtest round 1, row 309 | reference
`polish-ownership.md` | Ownership and cleanup follow-ups | reference
`polish/audit-2026-10-ui.md` | UI and interiors audit, Oct 7 | reference
`polish/audit-2026-10-world.md` | Outdoor world audit, Oct 7 | reference
`polish/portal-bugs.md` | Portal data bugs from GUI pass | reference

## Recruitment portal and site
`applicant-lighting-2026-09-16.md` | Applicant island lighting research | reference
`recruitment-ui-kit.md` | Recruitment village UI kit | reference
`tokens.md` | Design tokens for game and portal | reference
`ux-asset-map.md` | GLB model mapping for game world | reference
`ux-bounty.md` | Bounty board | reference
`ux-dashboard.md` | Student dashboard layout | reference
`ux-directory.md` | Member directory and profiles | reference
`ux-game-world-v2.md` | Animal Crossing visual guide v2 | reference
`ux-jobs.md` | Job board | reference
`ux-leaderboard.md` | Leaderboard | reference
`ux-mobile.md` | Mobile and responsive, landscape-first | reference
`ux-onboarding.md` | Onboarding flow | reference
`ux-settings.md` | Settings page | reference
`ux-shop.md` | Shop catalog | reference
`ux-status.md` | UX design-debt backlog | reference

## Superseded (to archive)
ac-research.md, applicant-surfaces-and-lounge-2026-09-17.md, asset-flags.md, asset-research-prompt.md, clubhouse-refinement-2026-09-17.md, collab-design-track.md, cozy-lighting-and-adaptive-ui-2026-09-17.md, director-developer-round.md, economy-v2-currencies.md, game-default-island-checkpoint.md, geo-master-plan-v2.md, hq-interior-polish-2026-09-17.md, interiors-program-v1.md, investigation-2026-07-26-foundations.md, investigation-2026-07-26-systems.md, lighting-research.md, migration-status.md, park-bench-asset.md, park-clock-asset.md, phase0-plan.md, polish/audit-activities.md, polish/audit-spaces-life.md, polish/audit-ui-flows.md, ponytail-audit-2026-09-30.md, ponytail-audit.md, proxy-migration-plan.md, qa.md, recruitment-deployment-readiness-2026-09-17.md, research-ac-style-threejs.md, roadmap-game-world.md, rulings-2026-07-24-launch.md, shop-sign-asset.md, sprint-2026-05-game-look-feel.md, sprint-2026-06-admin-tooling.md, sprint-2026-06-llm-npc.md, sprint-2026-06-tier-1-followups.md, sprint-2026-07-community-loops.md, sprint-2026-07-refinement.md, sprint-2026-08-action-controls.md, sprint-2026-08-launch-track.md, sprint-2026-08-visual-overhaul.md, streetlamp-asset.md, ux-recruitment-plan.md, ux.md, wood-bench-asset.md
