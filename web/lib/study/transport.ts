/**
 * Study transport: the only thing useStudySession talks to. The default goes
 * to /api/study/*; tests and the dev demo pass an in-memory one.
 */
import { apiCall } from "@/lib/apiClient";
import type { ChatView } from "./chat";
import type { Settings } from "./rules";
import type { MyStats, StudyState, topStudiers } from "./service";

export type Board = { week_start: string; top: ReturnType<typeof topStudiers> };

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

/** Failures throw ApiError (lib/apiClient) with the route's wording. */
const call = <T>(path: string, key: string, body?: unknown) => apiCall<T>(`/api/study/${path}`, key, body);

export const httpStudyTransport: StudyTransport = {
  state: () => call("state", "study"),
  sit: (table_id, seat) => call("sit", "study", { table_id, seat }),
  start: (s) => call("start", "study", s),
  heartbeat: () => call("heartbeat", "study", {}),
  takeBreak: () => call("break", "study", {}),
  resume: () => call("resume", "study", {}),
  end: () => call("end", "study", {}),
  lock: (table_id, is_private, allowed) => call("lock", "study", { table_id, is_private, allowed }),
  stats: () => call("stats", "stats"),
  setBoardOptIn: (board_opt_in) => call("stats", "stats", { board_opt_in }),
  board: () => call("board", "board"),
  chat: () => call("chat", "messages"),
  sendChat: (body) => call("chat", "messages", { body }),
  reportChat: (id, reason) => call(`chat/${id}/report`, "messages", { reason: reason ?? "" }),
};
