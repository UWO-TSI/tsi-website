/**
 * Dev-only demo plumbing: route this page's /api calls under a prefix to a real
 * service running on an in-memory store, so a view can be played signed out.
 * Used by `?collections=demo`, `?progression=demo`, `?oracle=demo` and
 * /dev/progression. Never installs in production builds.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any; // the request JSON, handed to the service as the route would
export type DemoHandler = (path: string, body: Body, url: URL, method: string) => Promise<Response | null>;

/** A service Result as the route would answer it. */
export function reply(r: { ok: boolean; status?: number; data?: unknown; [k: string]: unknown }, key: string): Response {
  const { ok, status, data, ...rest } = r;
  return new Response(JSON.stringify(ok ? { ok: true, [key]: data } : { ok: false, ...rest }), { status: ok ? 200 : (status ?? 500) });
}

/** Send fetches under `prefix` to `handle`; a null answer falls through to the network. */
export function routeDemoFetch(prefix: string, handle: DemoHandler): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!url.pathname.startsWith(prefix)) return realFetch(input, init);
    const body: Body = init?.body ? JSON.parse(String(init.body)) : {};
    return (await handle(url.pathname, body, url, init?.method ?? "GET")) ?? realFetch(input, init);
  };
}

const installed = new Set<string>();
/** `?<flag>=demo` on this page: build the demo once (`setup` gets the page query) and route `prefix` to it. */
export function installDemoFetch(flag: string, prefix: string, setup: (query: URLSearchParams) => DemoHandler): void {
  if (installed.has(flag) || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const query = new URLSearchParams(window.location.search);
  if (query.get(flag) !== "demo") return;
  installed.add(flag);
  routeDemoFetch(prefix, setup(query));
}
