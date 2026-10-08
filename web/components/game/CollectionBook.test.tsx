import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CollectionBook, { collectionNote } from "./CollectionBook";

const html = (props: Partial<Parameters<typeof CollectionBook>[0]> = {}) =>
  renderToStaticMarkup(createElement(CollectionBook, { open: true, onClose: () => {}, ...props }));

describe("the Collection (audit-2026-10-ui item 1)", () => {
  it("opens in the GUI sheet's one dialog frame", () => {
    const out = html();
    expect(out).toContain("data-gui-dialog");
    expect(out).toContain('data-testid="collection-sheet"');
    expect(out).toMatch(/<h2[^>]*>Collection<\/h2>/);
  });
  it("counts catches, not the Bag's items", () => {
    const out = html();
    expect(out).toMatch(/· 0 caught/);
    expect(out).not.toMatch(/in your bag/);
  });
  it("asks a signed-out visitor to sign in instead of reporting an error", () => {
    expect(collectionNote(undefined, "signed-out")).toBe("Sign in to keep your collection on your account.");
    expect(collectionNote(undefined, "local")).not.toMatch(/sign in/i);
    expect(collectionNote(undefined, "synced")).toBeNull();
    expect(collectionNote("applicant", "local")).toBe("Saved on this device · Just for fun");
  });
  it("keeps the applicant island's own frame", () => {
    const out = html({ collectionScope: "applicant" });
    expect(out).not.toContain("data-gui-dialog");
    expect(out).toContain("Saved on this device · Just for fun");
  });
  it("is gone while closed", () => {
    expect(html({ open: false })).toBe("");
  });
});
