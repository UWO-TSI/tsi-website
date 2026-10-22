# UI themes: one colour sheet per theme

David, 2026-10-22 (round 3b verdict), verbatim: "i want you to set up the ui so that when i add new ui color schemes, its a easy swap where its just like a css color sheet change with ui change or smth". The themes he means: dark mode and an ACNH-style theme, sold in the shop later (round 3 verdict).

## How it works

- **A theme is one CSS file** in `web/styles/themes/`, setting the `--ui-*` tokens below on `[data-ui-theme="<name>"]`. No library, no dependency.
- **The switch is one attribute:** `<body data-ui-theme="<name>">`. With no attribute, `body` wears `clean` (its file matches `body` too).
- **What follows the theme:** the flat menus, everything inside a `[data-gui-flat]` element (`FlatPanel`, `Sheet variant="flat"`, the flat creator). That is the shop, the bag, the chest, the workbench, the collection, the furniture catalogue, the closet and the creator, the journal, the ruins mission board, the notice board and the mailbox. The flat kit reads the `--ui-*` tokens; the cream kit's pieces inside a flat menu read them through their `--gui-*` names.
- **What stays cream under every theme:** `<html>` wears the cream base (`cream.css` matches `:root`), and the cream kit's `--gui-*` colours are resolved there. So the menus not yet on the flat kit (the wallet, Contribute on its own, settings and the rest), the HUD, the portal, recruitment and the applicant island keep the cream look whatever the theme. Each joins the theme when it moves onto the flat kit.
- **Paper things** (`data-gui-paper`: letters, the notice board's notices, a club goal) stay cream paper in every theme.
- **Not themed:** the 3D world and its lights, item art, the paper textures, the status colours (`--gui-success` and the rest), the rarity palette, the Tethos blue of tags, the white glyph on a round button, and the high-contrast setting (an accessibility override over every theme).

## The tokens

| Token | What it colours |
|---|---|
| `--ui-bg` | the page behind panels (the cream kit's `--gui-page`) |
| `--ui-panel` | the panel itself: the flat sheet, the side of the creator (`--gui-paper`) |
| `--ui-card` | cards, the close button, the spec band, a hovered tile (`--gui-paper-hi`) |
| `--ui-card-dim` | a card for something not found yet, soft fields (`--gui-paper-warm`) |
| `--ui-card-hover` | a white ghost button, hovered |
| `--ui-well` | wells and tracks (`--gui-paper-deep`) |
| `--ui-line` | hairlines and dashed empty slots (`--gui-paper-edge`) |
| `--ui-line-strong` | stronger outlines: fields, tiles (`--gui-paper-line`) |
| `--ui-select` | a chosen thing's fill: a chosen row (`--gui-butter`, the stripes) |
| `--ui-highlight` | the highlighter swipe under a choice (`--gui-highlight`) |
| `--ui-marker` | the marker under the journal's step to do now |
| `--ui-ink` | titles and type (`--gui-ink-strong`), the ring round a picked card |
| `--ui-ink-body` | body text (`--gui-ink`) |
| `--ui-ink-2` | descriptions and spec values (`--gui-ink-2`) |
| `--ui-muted` | captions (`--gui-muted`) |
| `--ui-quiet` | the muted line on a card, kinds, hints (`--gui-taupe`) |
| `--ui-rail` | an idle rail icon (the active one is `--ui-ink`) |
| `--ui-hint` | "Drag to turn" |
| `--ui-accent` | the primary action: the dark pill, the chosen tab (`--gui-sage`, the wood button) |
| `--ui-accent-deep` | the primary action, hovered (`--gui-sage-deep`) |
| `--ui-accent-ink` | text and glyphs on the accent and on ink pills |
| `--ui-pill` | price pills and quiet chips (`--gui-sage-soft`) |
| `--ui-pill-ink` | text on a pill |
| `--ui-disabled` | a button that can't be pressed |
| `--ui-round` | round buttons (white glyphs, so keep it dark enough) |
| `--ui-error` | an error line, the danger button's text |
| `--ui-focus` | the focus ring (`--gui-focus`) |
| `--ui-scrim` | the dim behind a dialog (`--gui-scrim`) |
| `--ui-shade` | shadow tint, as an `r g b` triplet: `rgb(var(--ui-shade) / 0.1)` |
| `--ui-stage` | the studio stage behind an item or the character (a background) |

## Adding a theme

1. Copy `web/styles/themes/clean.css` to `web/styles/themes/<name>.css`. Change its selector to `[data-ui-theme="<name>"]` (only `clean` also matches `body`, and only `cream` matches `:root`) and set the values.
2. In `web/styles/themes/index.ts`, add `import "./<name>.css";` and the name to `UI_THEMES`.
3. Check it: `npx vitest run lib/gui/contrast.test.ts` (the file sets every token, and its text is AA on its panels and cards), then `/dev/flat-ui?uitheme=<name>` and the switch at the bottom right of `/dev/flat-ui`.

Nothing else changes: no component knows the theme's name.

## Where the shop purchase would set it (not built)

- Buying or picking a theme calls `setUiTheme(name)` (`web/styles/themes/index.ts`), and saves the choice with the player's other settings.
- At game boot, the game calls `setUiTheme` with the saved choice, where `DevUiTheme` sits in `DefaultIslandWorld`. To avoid a frame of `clean` before it, the root layout can render the attribute on `<body>` from the saved choice instead.

## Pixel diffs (2026-10-22, `specs/evidence/flat-ui/ui-themes.webp`)

Shot with `specs/evidence/flat-ui/shots-themes.mjs` (headless; `UITHEME=<name>` adds `?uitheme=`) before and after, diffed pixel by pixel with the turning stages' canvases left out:
- **Clean (the default) against today:** 20 screens identical: the shop and an item, the bag (desktop and phone), the chest, the collection, the furniture catalogue, the closet (desktop and phone), the creator, the mission board, the journal (desktop and phone), the mailbox and a letter, the notice board, the wallet, Contribute, the applicant island's collection and creator. At most 10 px off by 1 of 255, as between two shots of today; `/lab/gui` differs only by its animated confetti.
- **Cream against today's cream screens:** the wallet, Contribute, the applicant island's collection and creator and every piece on `/lab/gui`: identical, the same noise floor.

## The dark sample

`dark.css` proves the swap. It is registered (so the dev switch lists it) but dev only: `?uitheme=` and the switch work only in development, and no player-facing switch exists yet, so every player wears `clean`.
