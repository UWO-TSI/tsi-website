"use client";

/**
 * Which look the GUI pieces wear (specs/polish/flat-ui.md step 7): the cream paper kit by default, or the flat UI inside
 * a flat sheet or panel (the game's menus). A flat `Sheet` and every `FlatPanel` set it for what they hold, so `Tabs`,
 * `ListRow`, `List` and `ItemTile` follow; `Paper` sets it back for a paper thing inside (a letter, a notice).
 */
import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";

export type GuiVariant = "cream" | "flat";
export const GuiVariantContext = createContext<GuiVariant>("cream");
/** The look the pieces here wear. */
export const useGuiVariant = (): GuiVariant => useContext(GuiVariantContext);

/**
 * A paper thing inside a flat panel (a letter, a notice board card; David: mail and the notice board keep their paper):
 * the cream tokens again (styles/game-tokens.css, [data-gui-paper]) and the cream pieces inside.
 */
export function Paper({ as: Tag = "div", children, ...rest }: HTMLAttributes<HTMLElement> & { as?: "div" | "li" | "article" | "section" | "span"; children: ReactNode }) {
  return <GuiVariantContext.Provider value="cream"><Tag {...rest} data-gui-paper="">{children}</Tag></GuiVariantContext.Provider>;
}
