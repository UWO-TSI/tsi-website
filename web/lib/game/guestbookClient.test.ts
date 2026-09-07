import { afterEach, describe, expect, it, vi } from "vitest";
import { guestbookSignError, GuestbookRequestError, guestbookTransport } from "./guestbookClient";
const saved = { id: "entry", message: "Hello", created_at: "2026-09-07T12:00:00Z" };
afterEach(() => vi.unstubAllGlobals());
function response(body: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher); return fetcher;
}

describe("guestbook transport", () => {
  it("validates and deduplicates entries with safe display metadata", async () => {
    response({ entries: [{ ...saved, display_name: "Ada", tier: 2 }, { ...saved }, { ...saved, id: "b", tier: 99, display_name: {} }, { id: "bad", created_at: "broken" }] });
    await expect(guestbookTransport.list(new AbortController().signal)).resolves.toEqual([{ ...saved, display_name: "Ada", tier: 2 }, { ...saved, id: "b", display_name: "Anonymous", tier: 5 }]);
  });
  it("rejects malformed list payloads instead of showing an empty wall", async () => {
    response({ entries: {} }); await expect(guestbookTransport.list(new AbortController().signal)).rejects.toThrow("Invalid guestbook response");
  });
  it("sends only the message with its cancellation signal and checks acknowledgement", async () => {
    const fetcher = response({ entry: saved }); const signal = new AbortController().signal;
    await expect(guestbookTransport.sign("Hello", signal)).resolves.toEqual(saved);
    expect(fetcher).toHaveBeenCalledWith("/api/guestbook", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: '{"message":"Hello"}' });
  });
  it("does not claim a save when the acknowledgement is missing", async () => {
    response({}); await expect(guestbookTransport.sign("Hello", new AbortController().signal)).rejects.toThrow("acknowledgement missing");
  });
  it.each([401, 429, 500])("preserves HTTP %s status", async (status) => {
    response({ error: "server detail" }, status);
    await expect(guestbookTransport.sign("Hello", new AbortController().signal)).rejects.toMatchObject({ status });
  });
  it("uses a plain validation message for rejected content", async () => {
    response({ error: "Please keep messages respectful." }, 400);
    await expect(guestbookTransport.sign("Hello", new AbortController().signal)).rejects.toThrow("Please keep messages respectful.");
  });
  it("propagates cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")));
    await expect(guestbookTransport.list(new AbortController().signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("safe signing feedback", () => {
  it("distinguishes rejected requests from an unconfirmed save", () => {
    expect(guestbookSignError(new GuestbookRequestError("", 401))).toMatch(/sign in/);
    expect(guestbookSignError(new GuestbookRequestError("", 429))).toMatch(/limit reached/);
    expect(guestbookSignError(new GuestbookRequestError("Please edit", 400))).toBe("Please edit");
    for (const error of [new Error("network"), new GuestbookRequestError("server", 500), new DOMException("timeout", "AbortError")]) expect(guestbookSignError(error)).toMatch(/Refresh the wall before trying again/);
  });
});
