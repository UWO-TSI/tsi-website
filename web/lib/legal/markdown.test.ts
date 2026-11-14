import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inline, markdownToHtml } from "./markdown";

describe("legal markdown", () => {
  it("renders headings, lists, tables, bold, links and emails", () => {
    expect(markdownToHtml("## 1. Who\n\n- one\n- **two**")).toBe("<h2>1. Who</h2>\n<ul><li>one</li><li><strong>two</strong></li></ul>");
    expect(markdownToHtml("| A | B |\n|---|---|\n| x | y |")).toBe("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>x</td><td>y</td></tr></tbody></table>");
    expect(markdownToHtml("**Group**\n- a")).toBe("<p><strong>Group</strong></p>\n<ul><li>a</li></ul>");
    expect(markdownToHtml("Tethos\nLondon")).toBe("<p>Tethos<br>London</p>");
    expect(inline("Write to info@tethos.ca.")).toBe('Write to <a href="mailto:info@tethos.ca">info@tethos.ca</a>.');
    expect(inline("<script>")).toBe("&lt;script&gt;");
  });

  it("leaves no Markdown behind in the real pages", () => {
    for (const page of ["terms", "privacy"]) {
      const html = markdownToHtml(readFileSync(join(__dirname, "../../content/legal", `${page}.md`), "utf8"));
      expect(html).toMatch(/^<h1>/);
      expect(html).not.toMatch(/\*\*|^#|\n- |\|---/m);
    }
  });
});
