import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ user: { profile: null as { tier: number } | null, loading: true } }));
vi.mock("@/components/portal/UserContext", () => ({ useUser: () => ({ ...mock.user, refetch: () => {} }) }));

import AdminPage from "./page";

const html = (user: typeof mock.user) => {
  mock.user = user;
  return renderToStaticMarkup(createElement(AdminPage));
};

describe("the admin hub (#27)", () => {
  it("says it's checking, not Admins only, while the profile loads", () => {
    const loading = html({ profile: null, loading: true });
    expect(loading).not.toContain("Admins only");
    expect(loading).toContain("Checking your access");
  });
  it("then shows the tools to T1/T2 and Admins only to everyone else", () => {
    expect(html({ profile: { tier: 1 }, loading: false })).toContain("Club portal");
    expect(html({ profile: { tier: 4 }, loading: false })).toContain("Admins only");
    expect(html({ profile: null, loading: false })).toContain("Admins only");
  });
});
