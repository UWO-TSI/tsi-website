/**
 * Study transport: the only thing useStudySession talks to. The default goes
 * to /api/study/*; tests and the dev demo pass an in-memory one.
 */
import type { ChatView } from "./chat";
import type { Settings } from "./rules";
import type { MyStats, StudyState, topStudiers } from "./service";

export type Board = { week_start: string; top: ReturnType<typeof topStudiers> };

export class StudyRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export interface StudyTransport {
  state(): Promise<StudyState>;
  sit(tableId: string, seat: number): Promise<StudyState>;
  start(settings: Settings): Promise<StudyState>;
  heartbeat(): Promise<StudyState>;
  takeBreak(): Promise<StudyState>;
  resume(): Promise<StudyState>;
  end(): Promise<StudyState>;
  lock(tableId: string, isPrivate: boolean, allowed?: string[]): Promise<StudyState>;
  stats(): Promise<MyStats>;
  setBoardOptIn(on: boolean): Promise<MyStats>;
  board(): Promise<Board>;
  chat(): Promise<ChatView[]>;
  sendChat(body: string): Promise<ChatView[]>;
  reportChat(id: string, reason?: string): Promise<ChatView[]>;
}

async function call<T>(path: string, key: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(`/api/study/${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? (method === "POST" ? "{}" : undefined) : JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json?.ok) throw new StudyRequestError(typeof json?.error === "string" ? json.error : "Request failed", res.status, typeof json?.code === "string" ? json.code : undefined);
  return json[key] as T;
}

export const httpStudyTransport: StudyTransport = {
  state: () => call("state", "study"),
  sit: (table_id, seat) => call("sit", "study", { table_id, seat }),
  start: (s) => call("start", "study", s),
  heartbeat: () => call("heartbeat", "study", undefined, "POST"),
  takeBreak: () => call("break", "study", undefined, "POST"),
  resume: () => call("resume", "study", undefined, "POST"),
  end: () => call("end", "study", undefined, "POST"),
  lock: (table_id, is_private, allowed) => call("lock", "study", { table_id, is_private, allowed }),
  stats: () => call("stats", "stats"),
  setBoardOptIn: (board_opt_in) => call("stats", "stats", { board_opt_in }),
  board: () => call("board", "board"),
  chat: () => call("chat", "messages"),
  sendChat: (body) => call("chat", "messages", { body }),
  reportChat: (id, reason) => call(`chat/${id}/report`, "messages", { reason: reason ?? "" }),
};
