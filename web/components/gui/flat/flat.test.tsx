import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardGrid, DetailView, FlatPanel, HairlineRow, IconRail, ItemCard, PayRow, Purse, SpecBand, badgeText, priced, railStep, type RailItem } from ".";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const RAIL: RailItem[] = [
  { id: "tools", label: "Tools", icon: "T" },
  { id: "clothes", label: "Clothes", icon: "C", badge: 3 },
  { id: "locked", label: "Locked", icon: "L", disabled: true },
  { id: "home", label: "Home", icon: "H", badge: 0 },
];

describe("IconRail (the flat UI kit, specs/polish/flat-ui.md)", () => {
  it("marks only the chosen icon, by its label", () => {
    const out = html(h(IconRail, { items: RAIL, value: "clothes", onChange: () => {}, label: "Shelves" }));
    expect(out.match(/aria-current="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-label="Clothes" title="Clothes"[^>]*aria-current="true"/);
    expect(out).toMatch(/<nav[^>]*aria-label="Shelves"/);
  });
  it("shows a count badge, and none at zero", () => {
    const out = html(h(IconRail, { items: RAIL, value: "tools", onChange: () => {}, label: "Shelves" }));
    expect(out.match(/>3<\/span>/g)).toHaveLength(1);
    expect(out).not.toMatch(/>0<\/span>/);
    expect(badgeText(0)).toBeNull();
    expect(badgeText(undefined)).toBeNull();
    expect(badgeText(7)).toBe("7");
    expect(badgeText(140)).toBe("99+");
  });
  it("is a tab list for a flat sheet's tabs", () => {
    const out = html(h(IconRail, { items: RAIL, value: "home", onChange: () => {}, label: "Pages", tabs: true, orientation: "horizontal" }));
    expect(out).toMatch(/role="tablist"/);
    expect(out).toMatch(/data-orientation="horizontal"/);
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-label="Home"[^>]*role="tab" aria-selected="true" tabindex="0"/);
    expect(out).not.toMatch(/aria-current/);
  });
  it("steps with the arrow keys, wrapping and skipping disabled icons", () => {
    expect(railStep(RAIL, "tools", 1)).toBe("clothes");
    expect(railStep(RAIL, "clothes", 1)).toBe("home");
    expect(railStep(RAIL, "home", 1)).toBe("tools");
    expect(railStep(RAIL, "tools", -1)).toBe("home");
    expect(railStep(RAIL, "gone", 1)).toBe("tools");
    expect(railStep([{ id: "a", label: "A", icon: null, disabled: true }], "a", 1)).toBe("a");
  });
});

describe("ItemCard", () => {
  const card = (props: Partial<Parameters<typeof ItemCard>[0]> = {}) => html(h(ItemCard, { picture: "/x.webp", name: "Cedar rod", line: "A tool", pill: "120", onClick: () => {}, ...props }));
  it("draws the picture, name, line, pill and the arrow", () => {
    const out = card({ tag: "staff pick" });
    expect(out).toMatch(/^<button type="button"/);
    expect(out).toContain("<canvas");
    expect(out).toContain("Cedar rod");
    expect(out).toContain("A tool");
    expect(out).toContain("staff pick");
    expect(out).toContain("lucide-arrow-up-right");
  });
  it("covers a sold-out card and an owned one with the word", () => {
    expect(card({ cover: "sold-out" })).toMatch(/data-cover="sold-out"[\s\S]*>Sold out<\/span><\/button>$/);
    expect(card({ cover: "owned" })).toMatch(/data-cover="owned"[\s\S]*>Owned<\/span><\/button>$/);
    expect(card()).not.toMatch(/data-cover|Sold out|Owned/);
  });
  it("shows something not found yet as a silhouette, with no word over it", () => {
    const out = card({ cover: "not-found", name: "???" });
    expect(out).toContain('data-cover="not-found"');
    expect(out).not.toMatch(/Sold out|Owned/);
  });
  it("is a picture, not a button, without a click", () => {
    const out = card({ onClick: undefined, label: "Dace" });
    expect(out).toMatch(/^<div[^>]*role="img"[^>]*aria-label="Dace"/);
  });
  it("says when it is picked, and its size", () => {
    expect(card({ selected: true, size: "sm" })).toMatch(/data-selected="true" data-size="sm"[^>]*aria-pressed="true"/);
    expect(card()).not.toMatch(/aria-pressed|data-size/);
  });
  it("prices a card, or says the price is to come", () => {
    const out = card({ pill: undefined, price: { amount: 1200, currency: "coins" } });
    expect(out).toContain("1,200");
    expect(out).toContain("/coin");
    expect(card({ pill: undefined, price: { amount: null, currency: "gems" } })).toMatch(/>Price to come<\/span>/);
    expect(card({ pill: undefined, price: { amount: 0, currency: "gems" } })).toMatch(/>Price to come<\/span>/);
  });
  it("takes a node for a picture (an icon that isn't an image)", () => {
    expect(card({ picture: h("i", { id: "glyph" }) })).toContain('<i id="glyph"></i>');
  });
});

describe("the panel, the grid, the detail and the rows", () => {
  it("frames the content with the purse, the title and a close", () => {
    const out = html(h(FlatPanel, { open: true, onClose: () => {}, title: "Bag", purse: h(Purse, { coins: 1200, gems: null }), rail: h("nav", null), testId: "bag", children: "inside" }));
    expect(out).toContain("data-gui-dialog");
    expect(out).toContain('data-rail=""');
    expect(out).toMatch(/<h2[^>]*>Bag<\/h2>/);
    expect(out).toContain('aria-label="Close"');
    expect(out).toContain("1,200");
    expect(out).toContain("…");
    expect(out).toContain("inside");
  });
  it("has no rail column when there is no rail, and is gone while closed", () => {
    expect(html(h(FlatPanel, { open: true, onClose: () => {}, title: "Bag", children: "x" }))).not.toContain("data-rail");
    expect(html(h(FlatPanel, { open: false, onClose: () => {}, title: "Bag", children: "x" }))).toBe("");
  });
  it("titles a grid only when it has a title", () => {
    expect(html(h(CardGrid, { title: "Tools", children: "c" }))).toMatch(/^<h3[^>]*>Tools<\/h3><div/);
    expect(html(h(CardGrid, { min: 160, children: "c" }))).toMatch(/^<div[^>]*style="--card-min:160px"/);
    expect(html(h(CardGrid, { min: 180, phoneMin: 150, children: "c" }))).toMatch(/style="--card-min:180px;--card-min-phone:150px"/);
  });
  it("lays out a detail: back, steps, info and the spec band", () => {
    const out = html(h(DetailView, { stage: h("canvas"), onBack: () => {}, steps: { prev: { label: "Previous: A", onClick: () => {} }, next: { label: "Next: B", onClick: () => {} } },
      info: h("p", null, "info"), specs: [["Kind", "Tools"], ["Stock", "3 left"]], testId: "d" }));
    expect(out).toContain("All");
    expect(out).toContain('aria-label="Previous: A"');
    expect(out).toContain('aria-label="Next: B"');
    expect(out).toContain("Drag to turn");
    expect(out).toMatch(/<dt>Kind<\/dt><dd>Tools<\/dd>/);
    expect(html(h(DetailView, { stage: null, onBack: () => {}, info: null, hint: null }))).not.toMatch(/Drag to turn|<dl|Previous/);
  });
  it("turns the action off while the price is to come", () => {
    const action = { label: "Redeem", onClick: () => {} };
    const off = html(h(PayRow, { price: { amount: null, currency: "gems" }, action }));
    expect(off).toContain("Price to come");
    expect(off).toMatch(/<button type="button" disabled=""[^>]*>Redeem<\/button>/);
    const on = html(h(PayRow, { price: { amount: 500, currency: "gems" }, was: "600", action }));
    expect(on).toMatch(/>600<\/span>500/);
    expect(on).not.toContain("disabled");
    expect(html(h(PayRow, { price: { amount: 500, currency: "gems" }, action: { ...action, disabled: true } }))).toContain('disabled=""');
    // No price at all (the workbench's Craft): no price shown, the action as given.
    expect(html(h(PayRow, { action }))).toMatch(/^<div[^>]*><button type="button"[^>]*>Redeem<\/button><\/div>$/);
    expect(priced({ amount: 3, currency: "coins" })).toBe(true);
    expect(priced({ amount: 0, currency: "coins" })).toBe(false);
    expect(priced(null)).toBe(false);
    const detail = html(h(DetailView, { stage: null, onBack: () => {}, info: h("p", null, "head"), pay: { price: { amount: null, currency: "gems" }, action }, fine: "Pick it up at HQ." }));
    expect(detail).toMatch(/head<\/p><div[^>]*>.*Price to come.*disabled=""[^>]*>Redeem<\/button><\/div><p[^>]*>Pick it up at HQ.<\/p>/);
  });
  it("draws a spec band and a hairline row", () => {
    expect(html(h(SpecBand, { specs: [["Switch", "Yellow"]] }))).toMatch(/^<dl[^>]*><div><dt>Switch<\/dt><dd>Yellow<\/dd><\/div><\/dl>$/);
    const row = html(h(HairlineRow, { title: "Dace", detail: "Common fish", end: h("button", null, "Sell") }));
    expect(row).toMatch(/<b>Dace<\/b><span[^>]*>Common fish<\/span><\/span><button>Sell<\/button>/);
    expect(row).not.toContain("<canvas");
  });
});
