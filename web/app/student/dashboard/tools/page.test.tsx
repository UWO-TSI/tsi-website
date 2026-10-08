import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ToolsPage from "./page";

describe("the Tools hub", () => {
  it("has no tile for the ASCII converter while it is a Coming soon page", () => {
    const html = renderToStaticMarkup(createElement(ToolsPage));
    expect(html).not.toContain("ASCII converter");
    expect(html).not.toContain("/student/dashboard/tools/ascii");
    expect(html).toContain("/student/dashboard/tools/rag");
  });
});
