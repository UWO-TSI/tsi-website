import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackLink, Fold, Folds, QuietButton, Section } from ".";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

// The cream menus' pieces (specs/polish/flat-ui.md round 2, step 7).
describe("a row that opens in place", () => {
  it("is a button that says whether it's open, and shows its body only when open", () => {
    const closed = html(h(Folds, { label: "Chapters", children: h(Fold, { title: "Settle in", line: "Chapter 1", onToggle: () => {}, children: "the steps" }) }));
    expect(closed).toMatch(/^<ul[^>]*aria-label="Chapters"/);
    expect(closed).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(closed).not.toContain("the steps");
    const open = html(h(Fold, { title: "Settle in", open: true, onToggle: () => {}, children: "the steps" }));
    expect(open).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(open).toContain("the steps");
    expect(open).toMatch(/<li[^>]*data-open="true"/);
  });
  it("is a plain row when it can't open (a locked chapter)", () => {
    const out = html(h(Fold, { title: "Reopen the cafe", state: "locked", children: "hidden" }));
    expect(out).not.toContain("<button");
    expect(out).toContain('data-state="locked"');
    expect(out).not.toContain("hidden");
  });
});

describe("sections and quiet buttons", () => {
  it("heads a section with its title and names it", () => {
    expect(html(h(Section, { title: "Up next", children: "x" }))).toMatch(/^<section[^>]*aria-label="Up next"[^>]*><header[^>]*><h3[^>]*>Up next<\/h3>/);
  });
  it("makes second actions plain buttons, and Back a button that says where it goes", () => {
    expect(html(h(QuietButton, { children: "Skip chapter" }))).toMatch(/^<button type="button"[^>]*>Skip chapter<\/button>$/);
    expect(html(h(BackLink, { onClick: () => {}, children: "All mail" }))).toMatch(/<button type="button"[^>]*>.*All mail<\/button>$/);
  });
});
