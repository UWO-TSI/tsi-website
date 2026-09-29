import type { StudySession } from "./rules";
import { DomainError } from "@/lib/result";

export type TableKind = "window" | "two" | "four" | "couch" | "outdoor";
export interface StudyTable {
  id: string;
  slug: string;
  label: string;
  location: string; // "cafe" | "outdoor-plaza" ... (island agent maps to anchors)
  anchor: string; // world anchor key for the seat props
  kind: TableKind;
  seats: number;
  host_id: string | null;
  is_private: boolean;
  allowed: string[]; // members the host let in while locked
  position: number;
}

export type StudyErrorCode = "unavailable" | "seat_taken" | "already_seated" | "insufficient" | "failed";
export class StudyError extends DomainError<StudyErrorCode> {}

export interface WeekStat {
  member_id: string;
  minutes: number;
  longest_block: number;
  sessions: number;
}

export interface ChatMessage {
  id: string;
  table_id: string;
  member_id: string | null;
  body: string;
  created_at: string;
  reported: boolean;
  reported_by: string | null;
}

export interface StudyStore {
  listTables(): Promise<StudyTable[]>;
  updateTable(id: string, patch: Partial<Pick<StudyTable, "host_id" | "is_private" | "allowed">>): Promise<void>;
  activeSessions(tableId?: string): Promise<StudySession[]>;
  memberActive(memberId: string): Promise<StudySession | null>;
  memberUnsettled(memberId: string): Promise<StudySession[]>;
  /** Unique (table, seat) and (member) among active sessions; throws seat_taken / already_seated. */
  insertSession(s: StudySession): Promise<void>;
  /** Optimistic: only writes if the stored version equals s.version; bumps it. */
  updateSession(s: StudySession): Promise<boolean>;
  getSession(id: string): Promise<StudySession | null>;
  /** Service-role, idempotent: pays minutes + bonus once per session. */
  settle(sessionId: string, memberId: string): Promise<{ coins: number; replayed: boolean }>;
  names(ids: string[]): Promise<Map<string, string>>;
  /** Stored character looks (`profiles.avatar_config.look`); missing ones fall back to a default on the client. */
  looks?(ids: string[]): Promise<Map<string, unknown>>;
  weekStats(weekStart: string): Promise<WeekStat[]>;
  boardOptIns(): Promise<Set<string>>;
  setBoardOptIn(memberId: string, optIn: boolean): Promise<void>;
  insertChat(tableId: string, memberId: string, body: string): Promise<ChatMessage>;
  /** Visible (not hidden) messages at a table since `since`, oldest first, max `limit`. */
  listChat(tableId: string, since: Date, limit: number): Promise<ChatMessage[]>;
  countChatSince(memberId: string, since: Date): Promise<number>;
  /** Flags a message for T1/T2; returns false if it isn't at that table. */
  reportChat(messageId: string, tableId: string, reporterId: string, reason: string): Promise<boolean>;
}
