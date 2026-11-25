import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonClass, ConfirmDialog, Dialogue, Field, Keycap, Sheet, TextArea } from ".";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

// One look (ledger row 334): the kit's own button, fields, keycap and dialogue, and one sheet with no look to pick.
describe("the kit's own pieces", () => {
  it("a sheet has one look: no variant or tone to pick", () => {
    const out = html(h(Sheet, { open: true, onClose: () => {}, title: "Settings", children: "x" }));
    expect(out).toMatch(/<section[^>]*role="dialog"/);
    expect(out).not.toMatch(/data-variant|data-tone|data-gui-flat|data-flat/);
  });
  it("a button says its variant and size, primary by default, with its key", () => {
    expect(html(h(Button, { children: "Buy" }))).toMatch(new RegExp(`^<button type="button" class="${buttonClass}" data-variant="primary">Buy</button>$`));
    const out = html(h(Button, { variant: "quiet", size: "sm", leadingKey: "E", children: "Talk" }));
    expect(out).toMatch(/data-variant="quiet" data-size="sm"><kbd aria-hidden="true"[^>]*>E<\/kbd>Talk/);
  });
  it("a field ties its label, hint and error to the box", () => {
    const out = html(h(Field, { id: "n", label: "Name", hint: "Letters only", error: "Taken", required: true }));
    expect(out).toMatch(/<label for="n">Name<span[^>]*>Required<\/span><\/label>/);
    expect(out).toMatch(/<input[^>]*id="n" aria-invalid="true" aria-describedby="n-hint n-error"/);
    expect(html(h(TextArea, { id: "t", label: "Note" }))).toMatch(/<textarea[^>]*rows="5" id="t"/);
  });
  it("a keycap is a kbd; the dialogue names its speaker and its way on", () => {
    expect(html(h(Keycap, { children: "Esc" }))).toMatch(/^<kbd class="[^"]+">Esc<\/kbd>$/);
    const out = html(h(Dialogue, { speaker: "Bram", onContinue: () => {}, continueLabel: "Next", children: "Hi" }));
    expect(out).toMatch(/<section[^>]*aria-labelledby="([^"]+)"><h2 id="\1"[^>]*>Bram<\/h2>/);
    expect(out).toMatch(/<button type="button"[^>]*>Next<span aria-hidden="true">▾<\/span><\/button>/);
  });
  it("a confirm dialog's safe answer comes first, its main one is danger when asked", () => {
    const out = html(h(ConfirmDialog, { open: true, title: "Drop it?", danger: true, onConfirm: () => {}, onCancel: () => {} }));
    expect(out).toMatch(/data-variant="quiet" data-size="sm">Not now<\/button><button[^>]*data-variant="danger" data-size="sm">Yes<\/button>/);
  });
});
