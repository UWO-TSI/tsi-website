/**
 * World chat's records (specs/multiplayer.md §6, migration 20261003190000_world_chat): the logged lines the realtime
 * server writes, the reports members make and the blocks they keep. The routes reach them through this interface
 * (supabaseStore in production, memoryStore in tests). Member ids and world names only, never real names.
 */
import { DomainError } from "@/lib/result";

export type WorldErrorCode = "unavailable" | "failed";
export class WorldError extends DomainError<WorldErrorCode> {}

/** A logged chat line (world_chat_messages). */
export interface WorldLine {
  id: string;
  shard: number;
  room_id: string;
  area: string;
  member_id: string | null;
  world_name: string;
  body: string;
  created_at: string;
  hidden: boolean;
}

/** A line as a report keeps it (its context, oldest first). */
export type ContextLine = Pick<WorldLine, "id" | "member_id" | "world_name" | "area" | "body" | "created_at">;

export interface NewReport {
  reporter_id: string;
  target_id: string;
  line_id: string | null;
  room_id: string | null;
  shard: number | null;
  reason: string;
  context: ContextLine[];
}

export interface BlockRow {
  member_id: string;
  /** Their world name, or null before they've chosen one. */
  world_name: string | null;
  created_at: string;
}

export interface WorldStore {
  line(id: string): Promise<WorldLine | null>;
  /** A room's lines, newest first, at most `limit`, optionally only those said at or before `upTo`. */
  roomLines(roomId: string, limit: number, upTo?: string): Promise<WorldLine[]>;
  /** A member's latest line anywhere. */
  latestLineOf(memberId: string): Promise<WorldLine | null>;
  memberExists(memberId: string): Promise<boolean>;
  reportsSince(reporterId: string, since: Date): Promise<number>;
  /** `duplicate`: this reporter already reported this line (the existing report's id). */
  insertReport(r: NewReport): Promise<{ id: string; duplicate: boolean }>;
  markReported(lineId: string): Promise<void>;
  /** The members this one blocked, newest first. */
  blocks(memberId: string): Promise<BlockRow[]>;
  /** not_found: no such member. */
  addBlock(blocker: string, blocked: string): Promise<"added" | "exists" | "not_found">;
  removeBlock(blocker: string, blocked: string): Promise<void>;
}
