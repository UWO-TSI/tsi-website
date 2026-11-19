"use client";
/** Client only: styles/themes/index.ts is loaded by the root layout (a Server Component), so the hook lives here. */
import { useSyncExternalStore } from "react";
import type { UiTheme } from ".";

/** The viewer's system light or dark as a pack, for an admin page that follows the OS (the game analytics page). */
export function useSchemeTheme(): UiTheme {
  return useSyncExternalStore((on) => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false) ? "dark" : "clean";
}
