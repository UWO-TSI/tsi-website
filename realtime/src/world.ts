// What every island room in this process shares (specs/multiplayer.md §2.3, §6, M2):
// the chat log writer, each player's blocks as they join, and sanctions. A T1/T2 mute or
// removal arrives through POST /internal/sanction (src/internal.ts) and reaches the
// player's sessions at once; a 60 s poll of the connected players' sanctions is the
// safety net. Either way the latest word is also held for a while over the player card,
// so a removed player can't slip back in on a card cached before the removal.
import type { Identity } from "./auth/verify";
import type { PlayerCard } from "./auth/card";
import { createChatLog, type ChatLog, type WriteChat } from "./chatLog";

/** A sanction change: a field that's present replaces the old value (ISO time, or null for none). */
export type SanctionPatch = { muted_until?: string | null; removed_until?: string | null };
/** A player's blocks: whom they blocked, and who blocked them. */
export type Blocks = { blocks: string[]; blockedBy: string[] };
export type SanctionRow = { member_id: string; muted_until: string | null; removed_until: string | null };

/** What a room offers the world. */
export interface WorldRoom {
  /** Apply a sanction to this member's sessions here (a removal closes them with 4102). Returns how many. */
  applySanction(uid: string, patch: SanctionPatch): number;
  /** A block between two players changed. Returns the sessions touched. */
  applyBlock(blocker: string, blocked: string, on: boolean): number;
  /** The member ids with a session here. */
  memberIds(): string[];
}

export type WorldSources = {
  writeChat: WriteChat;
  loadBlocks: (uid: string, signal: AbortSignal) => Promise<Blocks>;
  pollSanctions: (uids: string[], signal: AbortSignal) => Promise<SanctionRow[]>;
};

export type WorldOptions = WorldSources & {
  log: (event: string, fields: Record<string, unknown>) => void;
  now?: () => number;
  /** The safety-net poll's period. */
  pollMs?: number;
  /** A read of blocks or sanctions that takes longer fails. */
  timeoutMs?: number;
  /** How long a sanction's latest word outranks the player card (the card cache's 60 s, twice). */
  holdMs?: number;
  chatFlushMs?: number;
  chatQueueMax?: number;
};

export type World = {
  readonly chatLog: ChatLog;
  register(room: WorldRoom): void;
  unregister(room: WorldRoom): void;
  /** A joining player's blocks (refuse the join if this throws: the database is down). */
  loadBlocks(identity: Identity): Promise<Blocks>;
  /** The card with any sanction news newer than it laid over. */
  overlayCard(uid: string, card: PlayerCard): PlayerCard;
  /** A sanction from the admin routes or the poll: held over cards and applied to every session. */
  sanction(uid: string, patch: SanctionPatch): number;
  block(blocker: string, blocked: string, on: boolean): number;
  /** One pass of the safety net. */
  poll(): Promise<void>;
  start(): void;
  stop(): Promise<void>;
};

/** At most this many ids per poll call (realtime_sanctions_poll reads 2000). */
const POLL_CHUNK = 2000;

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(ac.signal),
      new Promise<never>((_, reject) => {
        t = setTimeout(() => {
          ac.abort();
          reject(new Error("timeout"));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

export function createWorld(o: WorldOptions): World {
  const now = o.now ?? Date.now;
  const pollMs = o.pollMs ?? 60_000;
  const timeoutMs = o.timeoutMs ?? 3000;
  const holdMs = o.holdMs ?? 120_000;
  const rooms = new Set<WorldRoom>();
  /** uid → the latest sanction news and when it came. */
  const held = new Map<string, { patch: SanctionPatch; at: number }>();
  const chatLog = createChatLog({ write: o.writeChat, log: o.log, flushMs: o.chatFlushMs, max: o.chatQueueMax, now });
  let timer: NodeJS.Timeout | null = null;
  let polling = false;

  function hold(uid: string, patch: SanctionPatch, at: number) {
    const prev = held.get(uid);
    held.set(uid, { patch: { ...(prev && at - prev.at < holdMs ? prev.patch : {}), ...patch }, at });
    if (held.size > 1000) for (const [k, v] of held) if (at - v.at >= holdMs) held.delete(k);
  }

  function apply(uid: string, patch: SanctionPatch): number {
    let n = 0;
    for (const r of rooms) n += r.applySanction(uid, patch);
    return n;
  }

  const world: World = {
    chatLog,
    register: (room) => void rooms.add(room),
    unregister: (room) => void rooms.delete(room),

    async loadBlocks(identity) {
      const b = await withTimeout(timeoutMs, (signal) => o.loadBlocks(identity.uid, signal));
      return { blocks: [...new Set(b.blocks)], blockedBy: [...new Set(b.blockedBy)] };
    },

    overlayCard(uid, card) {
      const h = held.get(uid);
      if (!h || now() - h.at >= holdMs) return card;
      return { ...card, ...h.patch };
    },

    sanction(uid, patch) {
      hold(uid, patch, now());
      return apply(uid, patch);
    },

    block(blocker, blocked, on) {
      let n = 0;
      for (const r of rooms) n += r.applyBlock(blocker, blocked, on);
      return n;
    },

    async poll() {
      if (polling) return;
      polling = true;
      const started = now();
      try {
        const ids = [...new Set([...rooms].flatMap((r) => r.memberIds()))];
        for (let i = 0; i < ids.length; i += POLL_CHUNK) {
          const rows = await withTimeout(timeoutMs, (signal) => o.pollSanctions(ids.slice(i, i + POLL_CHUNK), signal));
          for (const row of rows) {
            // News that came while this poll was out is newer than what it read.
            if ((held.get(row.member_id)?.at ?? -Infinity) > started) continue;
            world.sanction(row.member_id, { muted_until: row.muted_until, removed_until: row.removed_until });
          }
        }
      } catch (e) {
        o.log("sanctions_poll_failed", { message: e instanceof Error ? e.message : String(e) });
      } finally {
        polling = false;
      }
    },

    start() {
      chatLog.start();
      if (timer) return;
      timer = setInterval(() => void world.poll(), pollMs);
      timer.unref();
    },

    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await chatLog.stop();
    },
  };
  return world;
}
