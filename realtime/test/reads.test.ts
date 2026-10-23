// The world's Supabase reads (src/read.ts): each attempt logged as db_read, blocks retried once before a join is
// refused, and a friends list that couldn't be read at join read again 5 s later.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorld, type Blocks, type WorldRoom } from "../src/world";

const ME = { uid: "11111111-2222-4333-8444-555555555555", dev: false };
const FRIEND = "aaaaaaaa-2222-4333-8444-555555555555";

function setup(loadBlocks: () => Promise<Blocks>, loadFriends: () => Promise<string[]>) {
  const logs: Record<string, unknown>[] = [];
  const world = createWorld({
    writeChat: async () => {},
    loadBlocks,
    loadFriends,
    pollSanctions: async () => [],
    log: (event, f) => logs.push({ event, ...f }),
  });
  return { world, logs };
}

/** Fails `n` times, then answers. */
const failing = <T>(n: number, value: T) => {
  let calls = 0;
  return vi.fn(async () => {
    if (calls++ < n) throw new Error("fetch failed");
    return value;
  });
};

describe("world reads", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("blocks that fail once are read again 200 to 600 ms later", async () => {
    const loadBlocks = failing(1, { blocks: [FRIEND], blockedBy: [] });
    const { world, logs } = setup(loadBlocks, async () => []);
    const p = world.loadBlocks(ME);
    await vi.advanceTimersByTimeAsync(199);
    expect(loadBlocks).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(401);
    expect(await p).toEqual({ blocks: [FRIEND], blockedBy: [] });
    expect(logs).toMatchObject([
      { event: "db_read", read: "blocks", uid: ME.uid, attempt: 0, ok: false, reason: "fetch failed" },
      { event: "db_read", read: "blocks", uid: ME.uid, attempt: 1, ok: true },
    ]);
  });

  it("blocks that fail twice refuse the join", async () => {
    const loadBlocks = failing(2, { blocks: [], blockedBy: [] });
    const { world } = setup(loadBlocks, async () => []);
    const p = world.loadBlocks(ME).catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toBe("fetch failed");
    expect(loadBlocks).toHaveBeenCalledTimes(2);
  });

  it("a friends read that fails at join lists none, then fills the list 5 s later", async () => {
    const loadFriends = failing(1, [FRIEND]);
    const { world, logs } = setup(async () => ({ blocks: [], blockedBy: [] }), loadFriends);
    const room = { applyFriend: vi.fn(() => 1), refreshFriends: vi.fn() };
    world.register(room as unknown as WorldRoom);
    expect(await world.loadFriends(ME)).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(loadFriends).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadFriends).toHaveBeenCalledTimes(2);
    expect(room.applyFriend).toHaveBeenCalledWith(ME.uid, FRIEND, true);
    expect(room.refreshFriends).toHaveBeenCalledWith(ME.uid);
    expect(logs).toMatchObject([
      { read: "friends", attempt: 0, ok: false },
      { read: "friends", attempt: 0, ok: true },
    ]);
  });

  it("a friends reload that fails too is logged and leaves the list alone", async () => {
    const loadFriends = failing(2, [FRIEND]);
    const { world, logs } = setup(async () => ({ blocks: [], blockedBy: [] }), loadFriends);
    const room = { applyFriend: vi.fn(() => 1), refreshFriends: vi.fn() };
    world.register(room as unknown as WorldRoom);
    expect(await world.loadFriends(ME)).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(loadFriends).toHaveBeenCalledTimes(2);
    expect(room.applyFriend).not.toHaveBeenCalled();
    expect(room.refreshFriends).not.toHaveBeenCalled();
    expect(logs.filter((l) => l.ok === false)).toHaveLength(2);
  });
});
