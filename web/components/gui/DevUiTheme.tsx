"use client";

import { useEffect } from "react";
import { setUiTheme, UI_THEMES, type UiTheme } from "@/styles/themes";

/** Dev: `?uitheme=<name>` wears that UI theme (specs/polish/ui-themes.md). Nothing in production. */
export function DevUiTheme() {
  useEffect(() => {
    const theme = new URLSearchParams(location.search).get("uitheme") as UiTheme | null;
    if (process.env.NODE_ENV !== "production" && theme && UI_THEMES.includes(theme)) setUiTheme(theme);
  }, []);
  return null;
}
