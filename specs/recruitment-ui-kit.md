# Tethos recruitment village UI

Updated 2026-09-16. Local implementation, not deployed.

## Direction and references

David supplied the [Animal Crossing UI Kit](https://www.figma.com/design/N9SYeD88gDR4PH1gjGFpwQ/Animal-Crossing-UI-Kit--Community-?node-id=7-54) and three ZIP exports in Downloads, plus Spritesheets.png. Inspected dialogue, buttons, tutorial panels, palette, style guide, inventory and overview PNGs. The base ZIP and (2) contain the same 29 files; (1) contains nine overview images. These are raster references, not editable components. Spritesheets.png is a large item/icon atlas, not a UI component source. Figma design-context access was denied for lack of edit access; research used the supplied exports. No claim of Figma node-level implementation verification.

Keep irregular paper shapes, pinned notices, floating dialogue, pill actions, round keyboard hints and restrained shadows. Build responsive HTML/CSS with real labels and accessible interactions, rather than flattening the reference PNGs into controls. Do not import the large inventory atlas or unrelated game items into recruitment.

David liked the first showroom and requested a subtle Tethos identity pass. Current palette derives from web/styles/tokens.css: brand blue #1d9bf0, gold #ffd166, light #f1ffff and navy #0d1b2a. Warm paper #fffbe7 and wood retain the cozy setting. Use existing Test Sohne for forms/headings/controls; rounded Nunito remains only in dialogue. Nunito variable font is self-hosted from the official Google Fonts repository with its OFL license beside it. No new npm dependency.

## Components and behavior

`web/components/recruit/ui/index.tsx` exports VillagePanel, VillageButton, Keycap, NPCDialogue, TutorialChecklist, WantedPosting, SaveStatus, VillageField, VillageTextArea and ApplicationSheet. Styles are scoped in village-ui.module.css. Posting state distinguishes unfinished role content, applicant draft, future dates, closed role and confirmed submission. Saved drafts never imply completion.

`/student/apply/ui-preview` is development-only. It shows the kit and actual ApplicationForm in preview mode; no draft writes, uploads or submission. Example posting states are explicitly labeled. The user can open roles, type, review and close. Preview answers reset on close. It is a component showroom, not the final island layout.

R4 A confirms mobile direct forms without a canvas. R5 A confirms one scrollable application plus review. Later refinement expands desktop ApplicationSheet from approximately 85% to 96vw by 94dvh. Header/close and footer remain visible while content scrolls. Width of reading content remains bounded. Phone styles use the available screen. Shared game/menu views remain separate.

Actual applicant role overlay reuses ApplicationForm with layout=sheet. X/Escape awaits its draft flush; blocked/unsafe close retains the form and explains the problem. Local-only save is labeled. Help uses the existing recruitment contact team@tethos.ca pending David's answer. No messages are sent by testing.

Microinteractions: short sheet entrance, button lift/press, field focus ring, restrained validation feedback, save-status transitions and confirmed success celebration. Reduced-motion preference disables spatial animation and celebration. Never use animation to imply a server save occurred.

## Verification and release boundaries

Initial branded showroom: TypeScript and focused lint passed. Dia visual inspection confirmed the branded board and near-fullscreen real form; preview answer/review/close and focus restoration were exercised. Final combined checks are recorded in director-developer-round.md after implementation.

Real authenticated submission/readback, cross-device draft recovery, real upload, Google workbook creation/write/readback and concurrency load remain separate acceptance gates. Mocks prove failure branches, not production connectivity. Current Google invalid_grant and unapplied delivery migration/scheduler remain release blockers. Deploy server route before migration. No roles or dates activated, no production mutations, no push or deployment.
