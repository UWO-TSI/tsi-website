import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog, GuiVariantContext, ItemTile, List, ListRow, Paper, Sheet, Tabs } from ".";
import { FlatPanel } from "./flat";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const sheet = (children: ReactNode, variant?: "flat" | "cream") => html(h(Sheet, { open: true, onClose: () => {}, title: "Settings", variant, children }));
const TABS = [{ id: "a", label: "Graphics" }, { id: "b", label: "Sound" }];
const ICON_TABS = [{ id: "a", label: "Graphics", icon: h("i", { id: "ga" }) }, { id: "b", label: "Sound", icon: h("i", { id: "sb" }), badge: 2 }];

describe("Sheet's flat variant (specs/polish/flat-ui.md step 7)", () => {
  it("stays cream by default, as the portal and recruitment pages have it", () => {
    const out = sheet(h(ListRow, { title: "Row" }));
    expect(out).not.toMatch(/data-variant="flat"|data-gui-flat|data-flat/);
  });
  it("is flat when asked, and marks its section for the token remap", () => {
    const out = sheet("x", "flat");
    expect(out).toMatch(/<div[^>]*data-variant="flat"/);
    expect(out).toMatch(/<section[^>]*data-variant="flat" data-gui-flat=""/);
  });
  it("turns its list rows into hairline rows and its tiles into white cards", () => {
    const out = sheet(h(List, { children: [h(ListRow, { key: 1, title: "One" }), h(ListRow, { key: 2, title: "Two" })] }), "flat");
    expect(out).toMatch(/<ul[^>]*data-flat=""/);
    expect(out.match(/<div[^>]*data-flat=""[^>]*>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sheet(h(ItemTile, { name: "Dace", icon: "/i.webp" }), "flat")).toMatch(/data-flat=""/);
  });
  it("draws tabs with icons as an icon rail, and text tabs as flat words", () => {
    const rail = sheet(h(Tabs, { label: "Settings", value: "b", onChange: () => {}, tabs: ICON_TABS }), "flat");
    expect(rail).toMatch(/role="tablist"[^>]*data-orientation="horizontal"/);
    expect(rail).toMatch(/aria-label="Sound"[^>]*role="tab" aria-selected="true"/);
    expect(rail).toContain('<i id="ga"></i>');
    expect(rail).toMatch(/>2<\/span>/);
    const words = sheet(h(Tabs, { label: "Settings", value: "a", onChange: () => {}, tabs: TABS }), "flat");
    expect(words).toMatch(/<div[^>]*data-flat=""[^>]*><div[^>]*role="tablist"/);
    expect(words).toContain("Graphics");
    // Cream tabs with icons keep their labels in the pill row.
    expect(sheet(h(Tabs, { label: "Settings", value: "a", onChange: () => {}, tabs: ICON_TABS }))).not.toMatch(/data-orientation/);
  });
  it("keeps a paper thing paper inside it", () => {
    const out = sheet(h(Paper, { as: "article", children: h(ListRow, { title: "A letter" }) }), "flat");
    expect(out).toMatch(/<article data-gui-paper="">/);
    expect(out).toMatch(/<article data-gui-paper=""><div(?![^>]*data-flat)[^>]*>/);
  });
  it("asks its questions in the same look", () => {
    const flat = html(h(GuiVariantContext.Provider, { value: "flat", children: h(ConfirmDialog, { open: true, title: "Drop it?", onConfirm: () => {}, onCancel: () => {} }) }));
    expect(flat).toMatch(/data-variant="flat"/);
    expect(html(h(ConfirmDialog, { open: true, title: "Drop it?", onConfirm: () => {}, onCancel: () => {} }))).not.toMatch(/data-variant="flat"/);
  });
  it("is what a flat panel holds, too", () => {
    const out = html(h(FlatPanel, { open: true, onClose: () => {}, title: "Bag", children: h(ListRow, { title: "Row" }) }));
    expect(out).toMatch(/<section[^>]*data-gui-flat=""/);
    expect(out).toMatch(/<div[^>]*data-flat=""/);
  });
});
