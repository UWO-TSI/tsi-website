import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRequestError, npcChatTransport } from "./chatClient";

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;

describe("NPC chat transport", () => {
  it("passes cancellation and exact message content through to the request", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ reply: "Welcome!" })));
    const requestSignal = signal();
    expect(await npcChatTransport.send("mayor", "Hello\nthere", requestSignal)).toBe("Welcome!");
    expect(fetch).toHaveBeenCalledWith("/api/npc/chat", expect.objectContaining({
      signal: requestSignal, body: '{"npc_id":"mayor","message":"Hello\\nthere"}',
    }));
  });

  it.each([401, 404, 429, 400, 503])("distinguishes status %s without treating it as an empty reply", async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Check the message" }), { status }));
    await expect(npcChatTransport.send("mayor", "Hello", signal())).rejects.toMatchObject({ status, retryable: status === 503 });
  });

  it.each([{}, { reply: "" }, { reply: "  " }, { reply: 3 }])("rejects malformed success data: %s", async (body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(npcChatTransport.send("mayor", "Hello", signal())).rejects.toMatchObject({ status: 502, retryable: true });
  });

  it("keeps transport cancellation distinct from server rejection", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValue(aborted);
    await expect(npcChatTransport.send("mayor", "Hello", signal())).rejects.toBe(aborted);
  });

  it("validates history rows before they reach the conversation renderer", async () => {
    const good = { id: "turn-1", user_message: "Hi", npc_response: "Hello", created_at: "2026-09-07", flagged: false };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ turns: [good, null, { id: "broken" }] })));
    expect(await npcChatTransport.history("npc?&=id", signal())).toEqual([good]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/npc/conversations?npc_id=npc%3F%26%3Did&limit=10");
  });

  it("does not report unavailable history as an empty conversation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}"));
    await expect(npcChatTransport.history("mayor", signal())).rejects.toBeInstanceOf(ChatRequestError);
  });

  it("accepts a bodyless report acknowledgement", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(npcChatTransport.flag("turn-1", signal())).resolves.toBeUndefined();
  });
});
