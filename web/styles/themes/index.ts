/**
 * The UI themes, or packs (specs/polish/ui-themes.md, ledger rows 334 and 335): one CSS file each that sets every --ui-*
 * token, colours and shapes, under its own [data-ui-theme="<name>"]. Clean is the base, on :root. <body data-ui-theme>
 * wears another. To add a pack: its file here, then its import and its name below. Components never name one.
 */
import "./clean.css";
import "./dark.css";
import "./vintage.css";

import { useSyncExternalStore } from "react";

export const UI_THEMES = ["clean", "dark", "vintage"] as const;
export type UiTheme = (typeof UI_THEMES)[number];

/** Wears a pack from now on (later the shop's purchase; today the dev switch). */
export function setUiTheme(theme: UiTheme) {
  document.body.dataset.uiTheme = theme;
}

/** The viewer's system light or dark as a pack, for an admin page that follows the OS (the game analytics page). */
export function useSchemeTheme(): UiTheme {
  return useSyncExternalStore((on) => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false) ? "dark" : "clean";
}
