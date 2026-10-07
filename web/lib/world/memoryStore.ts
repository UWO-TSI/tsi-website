/** World chat's records in memory, for tests: the same rules the migration's tables keep. */
import type { BlockRow, NewReport, WorldLine, WorldStore } from "./store";

export interface MemoryReport extends NewReport { id: string; created_at: string; status: "open" | "actioned" | "dismissed" }

export function memoryWorldStore(now: () => Date = () => new Date()) {
  const lines: (WorldLine & { reported: boolean })[] = [];
  const reports: MemoryReport[] = [];
  const blocks: { blocker: string; blocked: string; created_at: string }[] = [];
  const members = new Map<string, string | null>(); // id → world name
  let n = 0;
  const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

  const store: WorldStore = {
    async line(id) {
      return lines.find((l) => l.id === id) ?? null;
    },
    async roomLines(roomId, limit, upTo) {
      return lines.filter((l) => l.room_id === roomId && (!upTo || l.created_at <= upTo)).sort(byNewest).slice(0, limit);
    },
    async latestLineOf(memberId) {
      return lines.filter((l) => l.member_id === memberId).sort(byNewest)[0] ?? null;
    },
    async memberExists(memberId) {
      return members.has(memberId);
    },
    async reportsSince(reporterId, since) {
      return reports.filter((r) => r.reporter_id === reporterId && r.created_at >= since.toISOString()).length;
    },
    async insertReport(r) {
      if (r.context.length > 20) throw new Error("context check");
      const same = r.line_id ? reports.find((x) => x.reporter_id === r.reporter_id && x.line_id === r.line_id) : undefined;
      if (same) return { id: same.id, duplicate: true };
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      reports.push({ ...r, id, created_at: now().toISOString(), status: "open" });
      return { id, duplicate: false };
    },
    async markReported(lineId) {
      const l = lines.find((x) => x.id === lineId);
      if (l) l.reported = true;
    },
    async blocks(memberId): Promise<BlockRow[]> {
      return blocks.filter((b) => b.blocker === memberId).sort(byNewest).map((b) => ({ member_id: b.blocked, world_name: members.get(b.blocked) ?? null, created_at: b.created_at }));
    },
    async addBlock(blocker, blocked) {
      if (!members.has(blocked)) return "not_found";
      if (blocks.some((b) => b.blocker === blocker && b.blocked === blocked)) return "exists";
      blocks.push({ blocker, blocked, created_at: new Date(now().getTime() + blocks.length).toISOString() });
      return "added";
    },
    async removeBlock(blocker, blocked) {
      const i = blocks.findIndex((b) => b.blocker === blocker && b.blocked === blocked);
      if (i >= 0) blocks.splice(i, 1);
    },
  };
  return {
    store,
    lines,
    reports,
    blocks,
    member(id: string, worldName: string | null = null) {
      members.set(id, worldName);
    },
    say(l: Partial<WorldLine> & Pick<WorldLine, "id" | "member_id" | "body" | "created_at">) {
      lines.push({ shard: 1, room_id: "room-a", area: "village", world_name: members.get(l.member_id ?? "") ?? "Islander", hidden: false, reported: false, ...l });
    },
  };
}
