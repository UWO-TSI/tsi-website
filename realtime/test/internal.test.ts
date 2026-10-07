// The /internal signature (src/internal.ts) on its own, and against the web app's signer
// (web/lib/server/realtimeNotify.ts): what one signs, the other accepts.
import { describe, expect, it } from "vitest";
import { createInternalAuth, INTERNAL_HEADERS, signInternal } from "../src/internal";
import { notifyRealtime, REALTIME_HEADERS, signRealtime } from "../../web/lib/server/realtimeNotify";

const SECRET = "a-shared-secret-of-at-least-32-chars!";
const NONCE = "0123456789abcdef0123";

describe("createInternalAuth", () => {
  it("accepts a fresh, correctly signed request once", () => {
    let t = 1_791_000_000_000;
    const check = createInternalAuth({ secret: SECRET, now: () => t });
    const body = '{"member_id":"x"}', time = String(t);
    const h = { time, nonce: NONCE, signature: signInternal(SECRET, time, NONCE, body) };
    expect(check(h, body)).toBe("ok");
    expect(check(h, body)).toBe("replay");
    expect(check({ ...h, signature: h.signature.toUpperCase() }, body)).toBe("replay"); // same nonce
    // The nonce is forgotten only once its time is out of the window anyway.
    t += 60_001;
    expect(check(h, body)).toBe("stale");
  });

  it("refuses a bad signature, a changed body, a stale or future time, malformed headers", () => {
    const t = 1_791_000_000_000;
    const check = createInternalAuth({ secret: SECRET, now: () => t });
    const body = "{}", time = String(t);
    const sig = signInternal(SECRET, time, NONCE, body);
    expect(check({ time, nonce: NONCE, signature: "0".repeat(64) }, body)).toBe("bad_signature");
    expect(check({ time, nonce: NONCE, signature: signInternal("another-secret-another-secret-xx", time, NONCE, body) }, body)).toBe("bad_signature");
    expect(check({ time, nonce: NONCE, signature: sig }, "{ }")).toBe("bad_signature");
    expect(check({ time: String(t - 30_001), nonce: NONCE, signature: signInternal(SECRET, String(t - 30_001), NONCE, body) }, body)).toBe("stale");
    expect(check({ time: String(t + 30_001), nonce: NONCE, signature: signInternal(SECRET, String(t + 30_001), NONCE, body) }, body)).toBe("stale");
    for (const h of [
      { time: null, nonce: NONCE, signature: sig }, { time: "soon", nonce: NONCE, signature: sig }, { time, nonce: "short", signature: sig },
      { time, nonce: "has spaces in it ok", signature: sig }, { time, nonce: NONCE, signature: sig.slice(1) }, { time, nonce: NONCE, signature: null },
    ]) expect(check(h, body), JSON.stringify(h)).toBe("malformed");
    // None of those burned the nonce.
    expect(check({ time, nonce: NONCE, signature: sig }, body)).toBe("ok");
  });
});

describe("the web app's signer", () => {
  it("signs exactly what the server checks", async () => {
    expect(REALTIME_HEADERS).toEqual(INTERNAL_HEADERS);
    expect(signRealtime(SECRET, "1791000000000", NONCE, "{}")).toBe(signInternal(SECRET, "1791000000000", NONCE, "{}"));
    const check = createInternalAuth({ secret: SECRET });
    const verdicts: string[] = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      const h = init!.headers as Record<string, string>;
      verdicts.push(check({ time: h[INTERNAL_HEADERS.time], nonce: h[INTERNAL_HEADERS.nonce], signature: h[INTERNAL_HEADERS.signature] }, String(init!.body)));
      return new Response("{}", { status: verdicts.at(-1) === "ok" ? 200 : 401 });
    };
    const env = { REALTIME_INTERNAL_URL: "https://rt.example", REALTIME_INTERNAL_SECRET: SECRET };
    expect(await notifyRealtime("/internal/sanction", { member_id: "11111111-2222-4333-8444-555555555555", removed_until: null }, { env, fetch })).toBe("applied");
    expect(await notifyRealtime("/internal/block", { blocker_id: "a", blocked_id: "b", blocked: true }, { env, fetch })).toBe("applied");
    const wrong = { ...env, REALTIME_INTERNAL_SECRET: "a-different-secret-of-32-characters" };
    const warn = console.warn;
    console.warn = () => {};
    expect(await notifyRealtime("/internal/block", { blocker_id: "a", blocked_id: "b", blocked: true }, { env: wrong, fetch })).toBe("failed");
    console.warn = warn;
    expect(verdicts).toEqual(["ok", "ok", "bad_signature"]);
  });
});
