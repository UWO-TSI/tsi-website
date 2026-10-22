import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuiVariantContext } from "@/components/gui/variant";
import { CATEGORIES } from "@/lib/game/character/creatorCategories";
import { CategoryRail } from "./CreatorControls";
import CharacterCreator from "./CharacterCreator";
import { DEFAULT_LOOK } from "@/lib/game/character/look";

const rail = (variant: "flat" | "cream") => renderToStaticMarkup(h(GuiVariantContext.Provider, { value: variant },
  h(CategoryRail, { cats: CATEGORIES, cat: CATEGORIES[1], onOpen: () => {} })));

describe("the creator's rail (round 3: the flat creator wears the kit's icon rail)", () => {
  it("is the kit's rail in the flat look, keeping the tabs' ids, their panel and data-cat", () => {
    const out = rail("flat");
    expect(out).toMatch(/<div[^>]*aria-label="Categories" role="tablist"/);
    expect(out.match(/role="tab"/g)).toHaveLength(CATEGORIES.length);
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-label="Hair"[^>]*role="tab" aria-selected="true" tabindex="0" data-tab="hair" data-cat="hair" id="creator-tab-hair" aria-controls="creator-panel"/);
  });
  it("stays the cream tiles everywhere else (the applicant island, the reflection)", () => {
    const out = rail("cream");
    expect(out).toMatch(/<nav[^>]*role="tablist"/);
    expect(out).not.toContain("data-tab");
    expect(out).toMatch(/data-cat="hair" id="creator-tab-hair" aria-selected="true"/);
  });
});

describe("the creator's two looks", () => {
  const creator = (flat: boolean) => renderToStaticMarkup(h(CharacterCreator, { initial: DEFAULT_LOOK, mode: "wardrobe", title: "Your closet", onDone: () => {}, onClose: () => {}, flat }));
  it("flat: the title and the close across the top, the main action first, no cream heading", () => {
    const out = creator(true);
    expect(out).toMatch(/data-flat="true" data-gui-flat=""/);
    expect(out).toMatch(/<header[^>]*><span><\/span><h1 id="creator-title"[^>]*>Your closet<\/h1><button[^>]*aria-label="Close"/);
    expect(out.match(/aria-label="Close"/g)).toHaveLength(1);
    expect(out).toMatch(/data-swap="a"/);
    expect(out).toMatch(/aria-label="Turn left"/);
    expect(out).toContain(">Wear this</button>");
  });
  it("cream (no flag): as before, the heading on the portrait and the close on the panel", () => {
    const out = creator(false);
    expect(out).not.toMatch(/data-flat|data-gui-flat|data-swap|data-tab/);
    expect(out).toMatch(/<h1 id="creator-title"[^>]*>Your closet<\/h1><div/);
    expect(out.match(/aria-label="Close"/g)).toHaveLength(1);
  });
});
