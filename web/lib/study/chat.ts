/**
 * Table text chat (row 77): seated members only, 200 characters, the shared
 * profanity filter, rate-limited, reportable. Muting during focus is a
 * client default (useStudySession); the server doesn't block posting.
 */
import { containsProfanity } from "@/lib/moderation/profanity";
import type { Result } from "@/lib/result";
import type { StudyStore } from "./store";

export const CHAT_MAX_LEN = 200;
export const CHAT_PER_MINUTE = 6;
export const CHAT_PER_HOUR = 60;
export const CHAT_WINDOW_MS = 2 * 60 * 60_000; // show the last two hours
export const CHAT_LIMIT = 50;


export interface ChatView {
  id: string;
  name: string;
  body: string;
  created_at: string;
  mine: boolean;
}

async function seatedTable(store: StudyStore, me: string): Promise<string | null> {
  return (await store.memberActive(me))?.table_id ?? null;
}

export async function readChat(store: StudyStore, me: string, now: Date): Promise<Result<ChatView[]>> {
  const table = await seatedTable(store, me);
  if (!table) return { ok: false, status: 409, code: "not_seated", error: "Sit at a table to see its chat." };
  const rows = (await store.listChat(table, new Date(now.getTime() - CHAT_WINDOW_MS), CHAT_LIMIT)).filter((m) => m.reported_by !== me);
  const names = await store.names([...new Set(rows.map((r) => r.member_id).filter((x): x is string => !!x))]);
  return { ok: true, data: rows.map((r) => ({ id: r.id, name: r.member_id ? (names.get(r.member_id) ?? "Member") : "A former member", body: r.body, created_at: r.created_at, mine: r.member_id === me })) };
}

export async function postChat(store: StudyStore, me: string, raw: unknown, now: Date): Promise<Result<ChatView[]>> {
  const body = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!body) return { ok: false, status: 400, code: "empty", error: "Write something first." };
  if (body.length > CHAT_MAX_LEN) return { ok: false, status: 400, code: "too_long", error: `Keep it under ${CHAT_MAX_LEN} characters.` };
  if (containsProfanity(body)) return { ok: false, status: 400, code: "profanity", error: "Please keep table chat friendly." };
  const table = await seatedTable(store, me);
  if (!table) return { ok: false, status: 409, code: "not_seated", error: "Sit at a table to chat." };
  const [minute, hour] = await Promise.all([store.countChatSince(me, new Date(now.getTime() - 60_000)), store.countChatSince(me, new Date(now.getTime() - 3_600_000))]);
  if (minute >= CHAT_PER_MINUTE || hour >= CHAT_PER_HOUR) return { ok: false, status: 429, code: "rate_limited", error: "Slow down a little." };
  await store.insertChat(table, me, body);
  return readChat(store, me, now);
}

export async function reportChat(store: StudyStore, me: string, messageId: string, reason: string, now: Date): Promise<Result<ChatView[]>> {
  const table = await seatedTable(store, me);
  if (!table) return { ok: false, status: 409, code: "not_seated", error: "Sit at a table to report its chat." };
  if (!(await store.reportChat(messageId, table, me, reason.slice(0, 200)))) return { ok: false, status: 404, code: "not_found", error: "Message not found." };
  return readChat(store, me, now);
}
