import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas, prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import type { IncomingMessage } from "http";
import nextConfig from "@/next.config";

// Runs next.config's redirects and beforeFiles rewrites through Next's own matcher, the way the router
// does: first matching redirect wins; otherwise the first matching rewrite; otherwise the page itself.
async function route(href: string): Promise<string> {
  const url = new URL(href);
  const req = { headers: { host: url.host } } as unknown as IncomingMessage;
  const query = Object.fromEntries(url.searchParams);
  const resolve = (source: string, destination: string, has: Parameters<typeof matchHas>[2]) => {
    const params = getPathMatch(source, { removeUnnamedParams: true, strict: true })(url.pathname);
    const hasParams = params && matchHas(req, query, has);
    if (!params || !hasParams) return null;
    const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination, params: { ...params, ...hasParams }, query });
    const search = new URLSearchParams(parsedDestination.query as Record<string, string>).toString();
    return `${parsedDestination.hostname ? `https://${parsedDestination.hostname}` : url.origin}${parsedDestination.pathname}${search ? `?${search}` : ""}${parsedDestination.hash ?? ""}`;
  };
  for (const r of await nextConfig.redirects!()) {
    const to = resolve(r.source, r.destination, r.has);
    if (to) return `redirect ${to}`;
  }
  const rewrites = await nextConfig.rewrites!();
  for (const r of Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles) {
    const to = resolve(r.source, r.destination, r.has);
    if (to) return `page ${new URL(to).pathname}`;
  }
  return `page ${url.pathname}`;
}

describe("www.tethos.ca and play.tethos.ca", () => {
  it.each([
    // The site sends the portal to play, keeping the query.
    ["https://www.tethos.ca/student", "redirect https://play.tethos.ca/"],
    ["https://www.tethos.ca/student?next=%2Fstudent%2Fcompanion%2Fstudy", "redirect https://play.tethos.ca/?next=%2Fstudent%2Fcompanion%2Fstudy"],
    ["https://tethos.ca/student/dashboard", "redirect https://play.tethos.ca/student/dashboard"],
    ["https://www.tethos.ca/student/dashboard/bounty", "redirect https://play.tethos.ca/student/dashboard/bounty"],
    ["https://www.tethos.ca/student/go?next=%2Fstudent%2Fcompanion", "redirect https://play.tethos.ca/student/go?next=%2Fstudent%2Fcompanion"],
    ["https://www.tethos.ca/student/companion/study", "redirect https://play.tethos.ca/student/companion/study"],
    ["https://www.tethos.ca/student/auth/callback?code=abc", "redirect https://play.tethos.ca/student/auth/callback?code=abc"],
    ["https://www.tethos.ca/student/login", "redirect https://www.tethos.ca/student"],
    ["https://www.tethos.ca/student/signup", "redirect https://www.tethos.ca/student?view=signup"],
    // Recruitment, admin, the site and the API stay on www.
    ["https://www.tethos.ca/student/apply", "page /student/apply"],
    ["https://www.tethos.ca/student/apply/portal", "page /student/apply/portal"],
    ["https://www.tethos.ca/admin/recruit", "page /admin/recruit"],
    ["https://www.tethos.ca/", "page /"],
    ["https://www.tethos.ca/genesis", "page /genesis"],
    ["https://www.tethos.ca/api/positions", "page /api/positions"],
    // Play: the title screen at /, the portal in place, the site's pages sent back to www.
    ["https://play.tethos.ca/", "page /student"],
    ["https://play.tethos.ca/?view=signup", "page /student"],
    ["https://play.tethos.ca/student", "redirect https://play.tethos.ca/"],
    ["https://play.tethos.ca/student?next=%2Fstudent%2Fcompanion", "redirect https://play.tethos.ca/?next=%2Fstudent%2Fcompanion"],
    ["https://play.tethos.ca/student/signup", "redirect https://play.tethos.ca/student?view=signup"],
    ["https://play.tethos.ca/student/dashboard", "page /student/dashboard"],
    ["https://play.tethos.ca/student/go", "page /student/go"],
    ["https://play.tethos.ca/student/apply/portal", "redirect https://www.tethos.ca/student/apply/portal"],
    ["https://play.tethos.ca/genesis", "redirect https://www.tethos.ca/genesis"],
    ["https://play.tethos.ca/admin/recruit", "redirect https://www.tethos.ca/admin/recruit"],
    ["https://play.tethos.ca/api/auth/callback?code=abc&next=%2Fstudent%2Fgo", "page /api/auth/callback"],
    ["https://play.tethos.ca/fonts/nunito/Nunito-Variable.ttf", "page /fonts/nunito/Nunito-Variable.ttf"],
    // Previews and local dev serve everything in place; play.localhost gets the title at /.
    ["https://uwotsi-abc.vercel.app/student", "page /student"],
    ["https://uwotsi-abc.vercel.app/student/dashboard", "page /student/dashboard"],
    ["http://localhost:3000/", "page /"],
    ["http://play.localhost:3000/", "page /student"],
    ["http://localhost:3000/student/dashboard", "page /student/dashboard"],
  ])("%s → %s", async (href, expected) => {
    expect(await route(href)).toBe(expected);
  });
});
