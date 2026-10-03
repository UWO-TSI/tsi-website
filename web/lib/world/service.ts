/**
 * Reports and blocks for world chat (specs/multiplayer.md §6, row 298). Members and public accounts alike.
 * - A report names a logged line or a player from the roster, with a reason; it keeps the last REPORT_CONTEXT lines
 *   of that room's chat as context and lands in the T1/T2 queue (/api/admin/moderation, "World chat"). At most
 *   REPORTS_PER_HOUR an hour.
 * - A block is persistent: the realtime server stops chat lines and emotes between the pair, both ways. The routes
 *   tell it at once (lib/server/realtimeNotify).
 */
import { toFailure, type Result } from "@/lib/result";
import type { BlockRow, ContextLine, WorldLine, WorldStore } from "./store";

export const REPORTS_PER_HOUR = 5;
export const REPORT_CONTEXT = 20;
/** The name shown for a member without a world name (never the real one, row 222). */
export const NAME_FALLBACK = "Islander";

const ERR: Record<string, [number, string]> = {
  unavailable: [503, "World chat isn't available right now."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERR, err);

export interface ReportInput {
  line_id?: string;
  member_id?: string;
  /** The reporter's room (a roster report's context); a line report uses the line's. */
  room_id?: string;
  reason: string;
}

const toContext = (l: WorldLine): ContextLine => ({ id: l.id, member_id: l.member_id, world_name: l.world_name, area: l.area, body: l.body, created_at: l.created_at });

/** The room's last lines, oldest first; for a line report, ending at the line if it's older than those. */
async function contextFor(store: WorldStore, roomId: string, line: WorldLine | null): Promise<ContextLine[]> {
  let lines = await store.roomLines(roomId, REPORT_CONTEXT);
  if (line && !lines.some((l) => l.id === line.id)) lines = await store.roomLines(roomId, REPORT_CONTEXT, line.created_at);
  return lines.slice(0, REPORT_CONTEXT).reverse().map(toContext);
}

export async function reportWorld(store: WorldStore, reporter: string, input: ReportInput, now: Date): Promise<Result<{ id: string }>> {
  try {
    if ((await store.reportsSince(reporter, new Date(now.getTime() - 3_600_000))) >= REPORTS_PER_HOUR) {
      return { ok: false, status: 429, code: "rate_limited", error: "You've sent several reports this hour. Try again later." };
    }
    let target: string, line: WorldLine | null = null, roomId: string | null = input.room_id ?? null;
    if (input.line_id) {
      line = await store.line(input.line_id);
      if (!line) return { ok: false, status: 404, code: "not_found", error: "That line isn't on record yet. Try again in a moment." };
      if (!line.member_id) return { ok: false, status: 404, code: "not_found", error: "That player's account is gone." };
      target = line.member_id;
      roomId = line.room_id;
    } else {
      target = input.member_id!;
      if (!(await store.memberExists(target))) return { ok: false, status: 404, code: "not_found", error: "Player not found." };
      roomId ??= (await store.latestLineOf(target))?.room_id ?? null;
    }
    if (target === reporter) return { ok: false, status: 400, code: "invalid", error: "You can't report yourself." };
    const context = roomId ? await contextFor(store, roomId, line) : [];
    const r = await store.insertReport({
      reporter_id: reporter,
      target_id: target,
      line_id: line?.id ?? null,
      room_id: roomId,
      shard: line?.shard ?? null,
      reason: input.reason,
      context,
    });
    if (line && !r.duplicate) await store.markReported(line.id);
    return { ok: true, data: { id: r.id } };
  } catch (err) {
    return fail(err);
  }
}

export interface BlockView { member_id: string; world_name: string; created_at: string }
const view = (b: BlockRow): BlockView => ({ member_id: b.member_id, world_name: b.world_name ?? NAME_FALLBACK, created_at: b.created_at });

export async function listBlocks(store: WorldStore, me: string): Promise<Result<BlockView[]>> {
  try {
    return { ok: true, data: (await store.blocks(me)).map(view) };
  } catch (err) {
    return fail(err);
  }
}

/** Block a player (again is fine); the list after. */
export async function blockPlayer(store: WorldStore, me: string, target: string): Promise<Result<BlockView[]>> {
  if (target === me) return { ok: false, status: 400, code: "invalid", error: "You can't block yourself." };
  try {
    if ((await store.addBlock(me, target)) === "not_found") return { ok: false, status: 404, code: "not_found", error: "Player not found." };
    return listBlocks(store, me);
  } catch (err) {
    return fail(err);
  }
}

/** Unblock a player (not blocked is fine); the list after. */
export async function unblockPlayer(store: WorldStore, me: string, target: string): Promise<Result<BlockView[]>> {
  try {
    await store.removeBlock(me, target);
    return listBlocks(store, me);
  } catch (err) {
    return fail(err);
  }
}
