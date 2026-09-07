import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmoteSharing, shareEmote } from "./emoteSharing";
import { PresenceRequestError } from "./mobilePresence";

const emote = { id: "wave", x: -24, z: 72 };
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("emote sharing", () => {
  it("snapshots each selection and allows immediate subsequent local selections", async () => {
    const first = deferred(); const second = deferred(); const failure = vi.fn();
    const transport = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const sharing = createEmoteSharing(transport, failure);
    const position = { ...emote };
    const a = sharing.send(position); position.x = 3; const b = sharing.send(position);
    expect(transport.mock.calls.map(([payload]) => payload.x)).toEqual([-24, 3]);
    second.resolve(); await b; first.reject(new Error("old failure")); await a;
    expect(failure).not.toHaveBeenCalled(); sharing.dispose();
  });
  it("reports sign-in failure for the current selection", async () => {
    const failure = vi.fn(); const sharing = createEmoteSharing(async () => { throw new PresenceRequestError(401); }, failure);
    await sharing.send(emote);
    expect(failure).toHaveBeenCalledExactlyOnceWith("Your emote played here. Sign in to share it."); sharing.dispose();
  });
  it("bounds stalled transports without automatically sending another emote", async () => {
    vi.useFakeTimers(); const pending = deferred(); const failure = vi.fn();
    const transport = vi.fn(() => pending.promise); const sharing = createEmoteSharing(transport, failure);
    const send = sharing.send(emote); await vi.advanceTimersByTimeAsync(15_000); await send;
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.length).toBe(2);
    expect(failure).toHaveBeenCalledExactlyOnceWith("Your emote played here, but sharing could not be confirmed.");
    pending.resolve(); await Promise.resolve(); expect(failure).toHaveBeenCalledTimes(1); sharing.dispose();
  });
  it("aborts all pending requests and ignores late failures after leaving", async () => {
    const a = deferred(); const b = deferred(); const failure = vi.fn();
    const transport = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const sharing = createEmoteSharing(transport, failure);
    const sends = [sharing.send(emote), sharing.send(emote)]; sharing.dispose();
    expect(transport.mock.calls.every(([, signal]) => signal.aborted)).toBe(true);
    a.reject(new Error("late")); b.resolve(); await Promise.all(sends);
    await sharing.send(emote); expect(transport).toHaveBeenCalledTimes(2); expect(failure).not.toHaveBeenCalled();
  });
  it("posts the selected emote and current location with cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}')); vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal; await shareEmote(emote, signal);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/emotes/log", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emote_type_id: "wave", world_x: -24, world_z: 72 }),
    });
  });
  it.each([new Response('{}', { status: 503 }), new Response('{}'), new Response('null')])("does not treat a missing/failed acknowledgement as success", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(shareEmote(emote, new AbortController().signal)).rejects.toThrow();
  });
});
