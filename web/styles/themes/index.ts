/**
 * The UI themes (specs/polish/ui-themes.md): one CSS file of --ui-* values each, worn by <body data-ui-theme="name">.
 * To add one: its file here, then its import and its name below.
 */
import "./clean.css";
import "./cream.css";
import "./dark.css";

export const UI_THEMES = ["clean", "cream", "dark"] as const;
export type UiTheme = (typeof UI_THEMES)[number];

/** Wears a theme from now on (the shop's purchase, the dev switch). Not <html>: that holds the cream base. */
export function setUiTheme(theme: UiTheme) {
  document.body.dataset.uiTheme = theme;
}
