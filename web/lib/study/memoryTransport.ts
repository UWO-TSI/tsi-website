/**
 * In-memory StudyTransport over the real service (tests, dev demo). `clock`
 * lets a demo fast-forward time.
 */
import { memoryStudyStore } from "./memoryStore";
import * as C from "./chat";
import * as S from "./service";
import { StudyRequestError, type StudyTransport } from "./transport";

export function memoryStudyTransport(me: string, clock: () => Date = () => new Date(), m = memoryStudyStore()) {
  const unwrap = async <T>(p: Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code: string }>): Promise<T> => {
    const r = await p;
    if (!r.ok) throw new StudyRequestError(r.error, r.status, r.code);
    return r.data;
  };
  const transport: StudyTransport = {
    state: () => unwrap(S.getState(m.store, me, clock())),
    sit: (t, seat) => unwrap(S.sit(m.store, me, { table_id: t, seat }, clock())),
    start: (s) => unwrap(S.startSession(m.store, me, s, clock())),
    heartbeat: () => unwrap(S.beat(m.store, me, clock())),
    takeBreak: () => unwrap(S.breakNow(m.store, me, clock())),
    resume: () => unwrap(S.resumeNow(m.store, me, clock())),
    end: () => unwrap(S.endNow(m.store, me, clock())),
    lock: (t, p, allowed) => unwrap(S.lock(m.store, me, { table_id: t, is_private: p, allowed }, clock())),
    stats: () => unwrap(S.myStats(m.store, me, clock())),
    setBoardOptIn: async (on) => {
      await m.store.setBoardOptIn(me, on);
      return unwrap(S.myStats(m.store, me, clock()));
    },
    board: () => unwrap(S.board(m.store, clock())),
    chat: () => unwrap(C.readChat(m.store, me, clock())),
    sendChat: (body) => unwrap(C.postChat(m.store, me, body, clock())),
    reportChat: (id, reason) => unwrap(C.reportChat(m.store, me, id, reason ?? "", clock())),
  };
  return { transport, mem: m };
}
