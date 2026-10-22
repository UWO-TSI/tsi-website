"use client";

/**
 * Which look the GUI pieces wear (specs/polish/flat-ui.md step 7): the cream paper kit by default, or the flat UI inside
 * a flat sheet or panel (the game's menus). A flat `Sheet` and every `FlatPanel` set it for what they hold, so `Tabs`,
 * a `ConfirmDialog` and a `ProgressionPanel` opened inside follow. A paper thing inside (a letter, a notice) is
 * `data-gui-paper`: the cream tokens again (styles/game-tokens.css).
 */
import { createContext, useContext } from "react";

export type GuiVariant = "cream" | "flat";
export const GuiVariantContext = createContext<GuiVariant>("cream");
/** The look the pieces here wear. */
export const useGuiVariant = (): GuiVariant => useContext(GuiVariantContext);
