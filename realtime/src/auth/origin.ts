// Which web pages may talk to the server (specs/multiplayer.md §1.4). Enforced three
// times: CORS on the matchmaking POST, `beforeUpgrade` on the WebSocket handshake,
// and onAuth on every join. A request without an Origin header is not a browser
// (browsers always send one on a cross-origin POST and on a WebSocket upgrade);
// such clients can claim any origin they like, so it isn't refused here: the token
// is what they still need.

export type OriginPolicy = {
  allows(origin: string | null | undefined): boolean;
};

export function createOriginPolicy(opts: { origins: string[]; patterns: string[] }): OriginPolicy {
  const exact = new Set(opts.origins.map((o) => o.replace(/\/+$/, "").toLowerCase()));
  const patterns = opts.patterns.map((p) => new RegExp(p));
  return {
    allows(origin) {
      if (origin === undefined || origin === null || origin === "") return true;
      const o = origin.toLowerCase();
      if (exact.has(o)) return true;
      return patterns.some((re) => re.test(o));
    },
  };
}

/**
 * Headers merged over Colyseus' defaults on every HTTP response. The allowed origin is
 * echoed; others get no Allow-Origin at all, so the browser blocks the response.
 * Credentials are never allowed: auth is a bearer token, never a cookie.
 */
export const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};

export function corsHeaders(policy: OriginPolicy, origin: string | null): Record<string, string> {
  return origin && policy.allows(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}
