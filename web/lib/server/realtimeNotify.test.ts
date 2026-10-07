import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { REALTIME_HEADERS, notifyRealtime, signRealtime } from "./realtimeNotify";

const ENV = { REALTIME_INTERNAL_URL: "https://rt.example", REALTIME_INTERNAL_SECRET: "s".repeat(40) };
const M = "00000000-0000-4000-8000-0000000000aa";

describe("notifyRealtime", () => {
  it("is skipped, silently, without the URL or the secret", async () => {
    const fetch = vi.fn();
    for (const env of [{}, { REALTIME_INTERNAL_URL: ENV.REALTIME_INTERNAL_URL }, { REALTIME_INTERNAL_SECRET: ENV.REALTIME_INTERNAL_SECRET }]) {
      expect(await notifyRealtime("/internal/sanction", { member_id: M, muted_until: null }, { env, fetch })).toBe("skipped");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the JSON body signed over time, nonce and body", async () => {
    const calls: [URL | RequestInfo, RequestInit | undefined][] = [];
    const fetch = async (url: URL | RequestInfo, init?: RequestInit) => (calls.push([url, init]), new Response("{}", { status: 200 }));
    const r = await notifyRealtime("/internal/block", { blocker_id: M, blocked_id: M.replace("aa", "bb"), blocked: true }, { env: ENV, fetch, now: () => 1_791_000_000_000 });
    expect(r).toBe("applied");
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://rt.example/internal/block");
    const h = init!.headers as Record<string, string>;
    expect(init!.method).toBe("POST");
    expect(h[REALTIME_HEADERS.time]).toBe("1791000000000");
    expect(h[REALTIME_HEADERS.nonce]).toMatch(/^[0-9a-f]{32}$/);
    const expected = createHmac("sha256", ENV.REALTIME_INTERNAL_SECRET).update(`1791000000000.${h[REALTIME_HEADERS.nonce]}.${init!.body}`).digest("hex");
    expect(h[REALTIME_HEADERS.signature]).toBe(expected);
    expect(signRealtime(ENV.REALTIME_INTERNAL_SECRET, "1791000000000", h[REALTIME_HEADERS.nonce], String(init!.body))).toBe(expected);
    expect(JSON.parse(String(init!.body))).toEqual({ blocker_id: M, blocked_id: M.replace("aa", "bb"), blocked: true });
    // A fresh nonce every time.
    await notifyRealtime("/internal/block", { blocker_id: M, blocked_id: M, blocked: false }, { env: ENV, fetch });
    expect((calls[1][1]!.headers as Record<string, string>)[REALTIME_HEADERS.nonce]).not.toBe(h[REALTIME_HEADERS.nonce]);
  });

  it("fails (never throws) on a refusal, a network error or the timeout, and doesn't log the payload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await notifyRealtime("/internal/sanction", { member_id: M, removed_until: null }, { env: ENV, fetch: async () => new Response("{}", { status: 401 }) })).toBe("failed");
    expect(await notifyRealtime("/internal/sanction", { member_id: M, removed_until: null }, { env: ENV, fetch: async () => { throw new TypeError("fetch failed"); } })).toBe("failed");
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError"))));
    expect(await notifyRealtime("/internal/sanction", { member_id: M, removed_until: null }, { env: ENV, fetch: hang as typeof fetch, timeoutMs: 20 })).toBe("failed");
    expect(warn.mock.calls.flat().join(" ")).not.toContain(M);
    warn.mockRestore();
  });
});
