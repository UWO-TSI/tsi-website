import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TitleMenu, { TITLE_MENU, menuMove } from "./TitleMenu";

const html = (selected: number) => renderToStaticMarkup(createElement(TitleMenu, { items: TITLE_MENU, selected, onSelected: () => {}, onPick: () => {} }));

describe("the title menu (specs/v1-drop.md §8b, ref title-piece-by-piece-ref.png)", () => {
  it("offers Let's Play, Settings and Exit, in that order", () => {
    expect(TITLE_MENU.map(i => i.label)).toEqual(["Let's Play", "Settings", "Exit"]);
    const out = html(0);
    expect(out.indexOf("Let&#x27;s Play")).toBeLessThan(out.indexOf("Settings"));
    expect(out.indexOf("Settings")).toBeLessThan(out.indexOf("Exit"));
  });

  it("moves with the arrow keys, wrapping at the ends, and jumps with Home and End", () => {
    expect(menuMove(0, "ArrowDown", 3)).toBe(1);
    expect(menuMove(2, "ArrowDown", 3)).toBe(0);
    expect(menuMove(0, "ArrowUp", 3)).toBe(2);
    expect(menuMove(1, "Home", 3)).toBe(0);
    expect(menuMove(0, "End", 3)).toBe(2);
    // W and S for players whose hands are on the movement keys.
    expect(menuMove(0, "s", 3)).toBe(1);
    expect(menuMove(0, "w", 3)).toBe(2);
  });

  it("leaves Enter, Space and everything else to the buttons", () => {
    for (const key of ["Enter", " ", "Escape", "Tab", "a"]) expect(menuMove(1, key, 3)).toBeNull();
  });

  it("keeps one stop in the tab order, on the selected item, and marks it for the pill", () => {
    const out = html(1);
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(out).toMatch(/<button[^>]*tabindex="0"[^>]*data-selected="true"[^>]*>Settings<\/button>|<button[^>]*data-selected="true"[^>]*tabindex="0"[^>]*>Settings<\/button>/);
    expect(out.match(/data-selected/g)).toHaveLength(1);
  });

  it("is a labelled navigation list", () => {
    const out = html(0);
    expect(out).toMatch(/<nav[^>]*aria-label="Main menu"/);
    expect(out.match(/<li>/g)).toHaveLength(3);
  });
});
