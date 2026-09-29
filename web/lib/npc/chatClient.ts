export interface ChatTurn {
  id: string;
  user_message: string;
  npc_response: string;
  flagged: boolean;
  created_at: string;
  isFresh?: boolean;
}

export class ChatRequestError extends Error {
  constructor(message: string, public status: number, public retryable = false) { super(message); }
}

export interface NPCChatTransport {
  history(npcId: string, signal: AbortSignal): Promise<ChatTurn[]>;
  send(npcId: string, message: string, signal: AbortSignal): Promise<string>;
  flag(turnId: string, signal: AbortSignal): Promise<void>;
}

async function responseBody(response: Response) {
  const body = await response.json().catch(() => null);
  if (response.status === 401) throw new ChatRequestError("Please sign in to chat.", 401);
  if (response.status === 404) throw new ChatRequestError("This conversation is no longer available.", 404);
  if (response.status === 429) throw new ChatRequestError("You're sending messages too fast. Try again in a few minutes.", 429);
  if (response.status === 400) throw new ChatRequestError(typeof body?.error === "string" ? body.error : "Check your message and try again.", 400);
  if (!response.ok) throw new ChatRequestError("Couldn't reach the server. Try again.", response.status, true);
  return body;
}

export const npcChatTransport: NPCChatTransport = {
  async history(npcId, signal) {
    const body = await responseBody(await fetch(`/api/npc/conversations?npc_id=${encodeURIComponent(npcId)}&limit=10`, { signal }));
    if (!Array.isArray(body?.turns)) throw new ChatRequestError("Couldn't load earlier messages.", 502, true);
    return body.turns.filter((turn: Partial<ChatTurn> | null) => turn && typeof turn.id === "string" && typeof turn.user_message === "string" && typeof turn.npc_response === "string" && typeof turn.created_at === "string")
      .map((turn: ChatTurn) => ({ id: turn.id, user_message: turn.user_message, npc_response: turn.npc_response, created_at: turn.created_at, flagged: turn.flagged === true }));
  },
  async send(npcId, message, signal) {
    const body = await responseBody(await fetch("/api/npc/chat", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npc_id: npcId, message }),
    }));
    if (typeof body?.reply !== "string" || !body.reply.trim()) throw new ChatRequestError("The reply didn't arrive. Your message is still here.", 502, true);
    return body.reply;
  },
  async flag(turnId, signal) {
    const response = await fetch(`/api/npc/conversations/${encodeURIComponent(turnId)}/flag`, { method: "POST", signal });
    if (!response.ok) throw new ChatRequestError("Couldn't report message.", response.status);
  },
};
