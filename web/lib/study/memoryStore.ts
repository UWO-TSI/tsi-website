/** In-memory StudyStore mirroring 20260926150500_study.sql (unique seats/members, optimistic versions, idempotent study_settle). */
import { weekStart } from "@/lib/collections/logic";
import { coinsFor, type StudySession } from "./rules";
import { StudyError, type ChatMessage, type StudyStore, type StudyTable, type WeekStat } from "./store";
import { DEFAULT_TABLES } from "./tables";

export function memoryStudyStore(tables: StudyTable[] = DEFAULT_TABLES) {
  const t = structuredClone(tables);
  const sessions: StudySession[] = [];
  const coins = new Map<string, number>();
  const names = new Map<string, string>();
  const optIns = new Set<string>();
  const chat: ChatMessage[] = [];
  let chatSeq = 0;
  let chatClock = Date.now();
  const clone = (s: StudySession) => ({ ...s });
  const store: StudyStore = {
    async listTables() {
      return t.map((x) => ({ ...x, allowed: [...x.allowed] }));
    },
    async updateTable(id, patch) {
      Object.assign(t.find((x) => x.id === id)!, patch);
    },
    async activeSessions(tableId) {
      return sessions.filter((s) => !s.ended_at && (!tableId || s.table_id === tableId)).map(clone);
    },
    async memberActive(m) {
      const s = sessions.find((x) => x.member_id === m && !x.ended_at);
      return s ? clone(s) : null;
    },
    async memberUnsettled(m) {
      return sessions.filter((x) => x.member_id === m && x.ended_at && !x.settled_at).map(clone);
    },
    async insertSession(s) {
      if (sessions.some((x) => !x.ended_at && x.member_id === s.member_id)) throw new StudyError("already_seated");
      if (sessions.some((x) => !x.ended_at && x.table_id === s.table_id && x.seat === s.seat)) throw new StudyError("seat_taken");
      sessions.push(clone(s));
    },
    async updateSession(s) {
      const i = sessions.findIndex((x) => x.id === s.id);
      if (i < 0 || sessions[i].version !== s.version) return false;
      sessions[i] = { ...s, version: s.version + 1 };
      return true;
    },
    async getSession(id) {
      const s = sessions.find((x) => x.id === id);
      return s ? clone(s) : null;
    },
    async settle(id, m) {
      const s = sessions.find((x) => x.id === id && x.member_id === m);
      if (!s || !s.ended_at) throw new StudyError("failed", "not ended");
      if (s.settled_at) return { coins: s.coins_paid ?? 0, replayed: true };
      const paid = coinsFor(s);
      s.coins_paid = paid;
      s.settled_at = new Date().toISOString();
      coins.set(m, (coins.get(m) ?? 0) + paid);
      return { coins: paid, replayed: false };
    },
    async names(ids) {
      return new Map(ids.map((id) => [id, names.get(id) ?? "Member"]));
    },
    async weekStats(week) {
      const out = new Map<string, WeekStat>();
      for (const s of sessions) {
        if (!s.ended_at || weekStart(new Date(s.ended_at)) !== week) continue;
        const w = out.get(s.member_id) ?? { member_id: s.member_id, minutes: 0, longest_block: 0, sessions: 0 };
        w.minutes += s.minutes_completed;
        w.longest_block = Math.max(w.longest_block, s.longest_block);
        w.sessions += 1;
        out.set(s.member_id, w);
      }
      return [...out.values()];
    },
    async boardOptIns() {
      return new Set(optIns);
    },
    async setBoardOptIn(m, on) {
      if (on) optIns.add(m);
      else optIns.delete(m);
    },
    async insertChat(tableId, m, body) {
      const msg: ChatMessage = { id: `00000000-0000-4000-8000-${String(++chatSeq).padStart(12, "0")}`, table_id: tableId, member_id: m, body, created_at: new Date(chatClock).toISOString(), reported: false, reported_by: null };
      chat.push(msg);
      return { ...msg };
    },
    async listChat(tableId, since, limit) {
      return chat.filter((c) => c.table_id === tableId && Date.parse(c.created_at) >= since.getTime()).slice(-limit).map((c) => ({ ...c }));
    },
    async countChatSince(m, since) {
      return chat.filter((c) => c.member_id === m && Date.parse(c.created_at) >= since.getTime()).length;
    },
    async reportChat(id, tableId, reporter) {
      const c = chat.find((x) => x.id === id && x.table_id === tableId);
      if (!c) return false;
      c.reported = true;
      c.reported_by = reporter;
      return true;
    },
  };
  return { store, chat, setChatClock: (t: number) => (chatClock = t), sessions, tables: t, coinsOf: (m: string) => coins.get(m) ?? 0, name: (id: string, n: string) => names.set(id, n) };
}
