import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/portal/UserContext", () => ({ useUser: () => ({ profile: null, loading: false, refetch: () => {} }) }));

import LeaderboardPage from "./page";

describe("the leaderboard", () => {
  it("offers no Weekly or Monthly tabs while only all-time totals exist", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardPage));
    expect(html).not.toContain("Weekly");
    expect(html).not.toContain("Monthly");
    expect(html).not.toContain("coming soon");
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("Leaderboard");
  });
});
