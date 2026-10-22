import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import { ConfirmDialog, GuiVariantContext, ListRow, Sheet, TabPanel, Tabs } from ".";
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
  it("draws text tabs as flat words", () => {
    const words = sheet(h(Tabs, { label: "Settings", value: "a", onChange: () => {}, tabs: TABS }), "flat");
    expect(words).toMatch(/<div[^>]*data-flat=""[^>]*><div[^>]*role="tablist"/);
    expect(words).toContain("Graphics");
    // Cream tabs with icons keep their labels in the pill row.
    expect(sheet(h(Tabs, { label: "Settings", value: "a", onChange: () => {}, tabs: ICON_TABS }))).not.toMatch(/data-flat/);
  });
  it("asks its questions in the same look", () => {
    const flat = html(h(GuiVariantContext.Provider, { value: "flat", children: h(ConfirmDialog, { open: true, title: "Drop it?", onConfirm: () => {}, onCancel: () => {} }) }));
    expect(flat).toMatch(/data-variant="flat"/);
    expect(html(h(ConfirmDialog, { open: true, title: "Drop it?", onConfirm: () => {}, onCancel: () => {} }))).not.toMatch(/data-variant="flat"/);
  });
  it("reaches a menu frame opened inside (Contribute from the journal), so no cream sheet sits in a flat one", () => {
    const inner = h(ProgressionPanel, { open: true, onClose: () => {}, title: "Contribute", children: "x" });
    expect(sheet(inner, "flat").match(/<section[^>]*data-variant="flat"/g)).toHaveLength(2);
    expect(sheet(inner).match(/<section[^>]*data-variant="flat"/g)).toBeNull();
  });
  it("is what a flat panel holds, too", () => {
    const out = html(h(FlatPanel, { open: true, onClose: () => {}, title: "Bag", children: h(Tabs, { label: "Bag", value: "a", onChange: () => {}, tabs: TABS }) }));
    expect(out).toMatch(/<section[^>]*data-gui-flat=""/);
    expect(out).toMatch(/<div[^>]*data-flat=""/);
  });
});

describe("a tab's content", () => {
  it("is a tab panel that plays its entrance when the tab changes", () => {
    expect(html(h(TabPanel, { id: "quests", children: "body" }))).toMatch(/^<div role="tabpanel" class="[^"]*">body<\/div>$/);
  });
});
