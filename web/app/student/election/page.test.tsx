import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import ElectionPage from "./page";

describe("/student/election", () => {
  it("opens on the cream GUI sheet, not the terminal", () => {
    const html = renderToStaticMarkup(createElement(ElectionPage));
    expect(html).toContain('class="gui"');
    expect(html).toContain("Loading the ballot");
    expect(html).not.toContain("font-mono");
    expect(html).not.toContain("election protocol");
  });
});
