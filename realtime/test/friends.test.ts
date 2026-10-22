// v1 friends on the island room (specs/v1-drop.md §3, PROTOCOL 2): your friends' presence anywhere in the process
// (`friends`), joining a friend's shard through a reserved seat (`follow`), even a soft-locked one, and friendships and
// blocks changed live through /internal. Real @colyseus/sdk clients, dev tokens, in-memory cards and friend lists.
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Client, type Room as SdkRoom } from "@colyseus/sdk";
import * as N from "@net/protocol";
import { createApp } from "../src/app.config";
import { devCard } from "../src/auth/card";
import { devUid } from "../src/auth/verify";
import { parseEnv } from "../src/env";
import { INTERNAL_HEADERS, signInternal } from "../src/internal";
import { createWorld, type Blocks } from "../src/world";

const PORT = 2597;
const WS = `ws://127.0.0.1:${PORT}`;
const HTTP = `http://127.0.0.1:${PORT}`;
const SECRET = "test-internal-secret-0123456789abcdefghij";

const logs: { event: string; fields: Record<string, unknown> }[] = [];
/** Friend pairs by dev name; a name in `friendsDown` makes its read fail. */
const pairs: [string, string][] = [];
const friendsDown = new Set<string>();
const blockRows = new Map<string, Blocks>();
const rooms: SdkRoom[] = [];
let colyseus: ColyseusTestServer;

const nameOf = (uid: string) => ["alice", "bob", "carol", "dave", "erin"].find((n) => devUid(n) === uid) ?? "?";
const world = createWorld({
  writeChat: async () => {},
  loadBlocks: async (uid) => blockRows.get(nameOf(uid)) ?? { blocks: [], blockedBy: [] },
  loadFriends: async (uid) => {
    const me = nameOf(uid);
    if (friendsDown.has(me)) throw new Error("fetch failed");
    return pairs.filter((p) => p.includes(me)).map(([a, b]) => devUid(a === me ? b : a));
  },
  pollSanctions: async () => [],
  log: (event, fields) => logs.push({ event, fields }),
});

beforeAll(async () => {
  colyseus = await boot(
    createApp({
      env: parseEnv({ NODE_ENV: "test", DEV_AUTH: "1", REALTIME_INTERNAL_SECRET: SECRET }),
      world,
      kickForMovement: true,
      graceS: { desktop: 1, phone: 5 },
      log: (event, fields) => logs.push({ event, fields }),
      loadCard: async (identity) => ({ ...devCard(identity), badge: "member" }),
    }),
    PORT,
  );
});

afterEach(async () => {
  for (const r of rooms.splice(0)) r.reconnection.enabled = false;
  await colyseus.cleanup();
  pairs.length = 0;
  friendsDown.clear();
  blockRows.clear();
  logs.length = 0;
});

afterAll(async () => {
  await colyseus?.shutdown();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, what = "condition", ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(10);
  }
}

type P = { name: string; uid: string; client: Client; room: SdkRoom; friends: N.FriendPresence[][]; answers: N.FollowAnswer[]; sys: N.SysMessage[]; code: number };
const OPTS = (o: Partial<N.JoinOptions> = {}) => ({ v: N.PROTOCOL, area: 0, mobile: false, showClass: true, ...o });
function wire(p: P, room: SdkRoom) {
  p.room = room;
  rooms.push(room);
  room.reconnection.minUptime = 0;
  room.onMessage(N.MSG.friends, (m) => {
    const list = N.parseFriends(m);
    if (!list) throw new Error(`bad friends ${JSON.stringify(m)}`);
    p.friends.push(list);
  });
  room.onMessage(N.MSG.follow, (m) => {
    const a = N.parseFollowAnswer(m);
    if (!a) throw new Error(`bad follow ${JSON.stringify(m)}`);
    p.answers.push(a);
  });
  room.onMessage(N.MSG.line, () => {});
  room.onMessage(N.MSG.sys, (m) => p.sys.push(N.parseSys(m)!));
  room.onMessage(N.MSG.pong, () => {});
  room.onLeave((code) => (p.code = code));
}
/** Join the fullest open shard, or a given room by id. */
async function join(name: string, roomId?: string, o: Partial<N.JoinOptions> = {}): Promise<P> {
  const client = new Client(WS);
  client.auth.token = `dev:${name}`;
  const p = { name, uid: devUid(name), client, friends: [], answers: [], sys: [], code: 0 } as unknown as P;
  wire(p, roomId ? await client.joinById(roomId, OPTS(o)) : await client.joinOrCreate(N.ROOM_NAME, OPTS(o)));
  await p.room.waitForInitialState();
  return p;
}
const latest = (p: P) => p.friends.at(-1) ?? null;
const shardOf = (p: P) => (p.room.state as unknown as { shard: number }).shard;
/** A second shard: a room of its own. */
const secondShard = async () => (await colyseus.createRoom(N.ROOM_NAME, {})).roomId;
const serverRoom = (id: string) => colyseus.getRoomById(id) as unknown as { lock(): Promise<void>; locked: boolean; clients: { length: number } };

async function signed(path: string, body: unknown) {
  const text = JSON.stringify(body), time = String(Date.now()), nonce = randomBytes(16).toString("hex");
  const res = await fetch(`${HTTP}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", [INTERNAL_HEADERS.time]: time, [INTERNAL_HEADERS.nonce]: nonce, [INTERNAL_HEADERS.signature]: signInternal(SECRET, time, nonce, text) },
    body: text,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("friends' presence", () => {
  it("lists your friends who are on the island, in any shard, with where they are; it follows them coming, moving and going", async () => {
    pairs.push(["alice", "bob"], ["alice", "carol"]);
    const alice = await join("alice");
    await until(() => latest(alice) !== null, "alice's first list");
    expect(latest(alice)).toEqual([]);
    const other = await secondShard();
    const bob = await join("bob", other, { area: N.AREAS.indexOf("cafe") });
    await until(() => latest(alice)?.length === 1, "bob comes online");
    expect(latest(alice)).toEqual([{ uid: bob.uid, shard: shardOf(bob), area: N.AREAS.indexOf("cafe") }]);
    expect(shardOf(bob)).not.toBe(shardOf(alice));
    // Bob sees alice too (friendship goes both ways), and dave, no friend of hers, isn't listed.
    await until(() => latest(bob)?.length === 1, "bob's list");
    expect(latest(bob)).toEqual([{ uid: alice.uid, shard: shardOf(alice), area: 0 }]);
    const dave = await join("dave");
    await sleep(150);
    expect(latest(alice)!.map((f) => f.uid)).toEqual([bob.uid]);
    void dave;
    // Bob walks into the village: alice hears it.
    bob.room.send(N.MSG.slow, { area: 0 });
    await until(() => latest(alice)?.[0]?.area === 0, "bob's new area");
    // Bob leaves: gone from the list.
    await bob.room.leave();
    await until(() => latest(alice)?.length === 0, "bob goes");
  });

  it("never includes someone who blocked you, and a friend list that can't be read still lets you in", async () => {
    pairs.push(["alice", "bob"], ["alice", "carol"]);
    blockRows.set("alice", { blocks: [], blockedBy: [devUid("carol")] });
    blockRows.set("carol", { blocks: [devUid("alice")], blockedBy: [] });
    friendsDown.add("erin");
    const bob = await join("bob");
    const carol = await join("carol");
    const alice = await join("alice");
    await until(() => latest(alice)?.length === 1, "alice's list");
    expect(latest(alice)!.map((f) => f.uid)).toEqual([bob.uid]);
    void carol;
    const erin = await join("erin");
    await until(() => latest(erin) !== null, "erin's list");
    expect(latest(erin)).toEqual([]);
    expect(logs.some((l) => l.event === "friends_load_failed")).toBe(true);
  });

  it("a friendship made or ended through /internal/friend shows at once, both ways; a block ends it too", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => latest(alice) !== null && latest(bob) !== null, "first lists");
    expect((await signed("/internal/friend", { a_id: alice.uid, b_id: bob.uid, friends: true })).status).toBe(200);
    await until(() => latest(alice)?.length === 1 && latest(bob)?.length === 1, "friends now");
    expect((await signed("/internal/friend", { a_id: bob.uid, b_id: alice.uid, friends: false })).body).toMatchObject({ ok: true });
    await until(() => latest(alice)?.length === 0 && latest(bob)?.length === 0, "not any more");
    await signed("/internal/friend", { a_id: alice.uid, b_id: bob.uid, friends: true });
    await until(() => latest(alice)?.length === 1, "friends again");
    await signed("/internal/block", { blocker_id: bob.uid, blocked_id: alice.uid, blocked: true });
    await until(() => latest(alice)?.length === 0 && latest(bob)?.length === 0, "the block ends it");
  });
});

describe("join a friend's shard (follow)", () => {
  it("hands you a reserved seat in their shard, even a soft-locked one, and you land with them", async () => {
    pairs.push(["alice", "bob"]);
    const alice = await join("alice");
    const other = await secondShard();
    const bob = await join("bob", other);
    await serverRoom(other).lock();
    expect(serverRoom(other).locked).toBe(true);
    alice.room.send(N.MSG.follow, { uid: bob.uid });
    await until(() => alice.answers.length === 1, "the answer");
    const a = alice.answers[0];
    expect("seat" in a && a.seat.roomId).toBe(other);
    if (!("seat" in a)) throw new Error("no seat");
    const old = alice.room;
    await old.leave();
    wire(alice, await alice.client.consumeSeatReservation(a.seat as never));
    await alice.room.waitForInitialState();
    expect(alice.room.roomId).toBe(other);
    expect(shardOf(alice)).toBe(shardOf(bob));
    // Same shard, same area: they see each other, and the move kept her card and friends.
    await until(() => (bob.room.state as unknown as { players?: N.NetMap<N.NetPlayer> }).players?.get(alice.room.sessionId) !== undefined, "bob sees alice");
    expect((bob.room.state as unknown as { players: N.NetMap<N.NetPlayer> }).players.get(alice.room.sessionId)!.name).toBe("alice");
    await until(() => latest(alice)?.[0]?.shard === shardOf(bob), "her list after the move");
    alice.room.send(N.MSG.follow, { uid: bob.uid });
    await until(() => alice.answers.length === 2, "the second answer");
    expect(alice.answers[1]).toEqual({ uid: bob.uid, refused: "here" });
  });

  it("a mute that lands mid-session goes with the player into a friend's shard", async () => {
    pairs.push(["alice", "bob"]);
    const alice = await join("alice");
    const bob = await join("bob", await secondShard());
    const r = await signed("/internal/sanction", { member_id: alice.uid, muted_until: new Date(Date.now() + 86_400_000).toISOString() });
    expect(r).toMatchObject({ status: 200, body: { ok: true, sessions: 1 } });
    alice.room.send(N.MSG.follow, { uid: bob.uid });
    await until(() => alice.answers.length === 1, "the answer");
    const a = alice.answers[0];
    if (!("seat" in a)) throw new Error("no seat");
    await alice.room.leave();
    wire(alice, await alice.client.consumeSeatReservation(a.seat as never));
    await alice.room.waitForInitialState();
    alice.room.send(N.MSG.chat, { text: "hello?" });
    await until(() => alice.sys.some((m) => m.kind === "refused"), "the refusal");
    expect(alice.sys.find((m) => m.kind === "refused")).toMatchObject({ reason: "muted" });
  });

  it("says why not: not a friend, offline (a block is never said), full; and at most one ask per 3 s", async () => {
    pairs.push(["alice", "bob"], ["alice", "carol"]);
    blockRows.set("alice", { blocks: [], blockedBy: [devUid("carol")] });
    blockRows.set("carol", { blocks: [devUid("alice")], blockedBy: [] });
    const alice = await join("alice");
    const dave = await join("dave");
    const carol = await join("carol", await secondShard());
    alice.room.send(N.MSG.follow, { uid: dave.uid });
    await until(() => alice.answers.length === 1, "dave");
    expect(alice.answers[0]).toEqual({ uid: dave.uid, refused: "not_friend" });
    await sleep(N.RATE_LIMITS.follow.everyMs + 50);
    alice.room.send(N.MSG.follow, { uid: carol.uid });
    await until(() => alice.answers.length === 2, "carol");
    expect(alice.answers[1]).toEqual({ uid: carol.uid, refused: "offline" });
    await sleep(N.RATE_LIMITS.follow.everyMs + 50);
    alice.room.send(N.MSG.follow, { uid: devUid("bob") });
    alice.room.send(N.MSG.follow, { uid: devUid("bob") }); // too soon: dropped
    await until(() => alice.answers.length === 3, "bob offline");
    expect(alice.answers[2]).toEqual({ uid: devUid("bob"), refused: "offline" });
    await sleep(200);
    expect(alice.answers).toHaveLength(3);
    // A full shard: at its hard cap no seat can be made.
    const other = await secondShard();
    const bob = await join("bob", other);
    (colyseus.getRoomById(other) as unknown as { maxClients: number }).maxClients = 1;
    await sleep(N.RATE_LIMITS.follow.everyMs + 50);
    alice.room.send(N.MSG.follow, { uid: bob.uid });
    await until(() => alice.answers.length === 4, "full");
    expect(alice.answers[3]).toEqual({ uid: bob.uid, refused: "full" });
    // Malformed asks are dropped without an answer.
    await sleep(N.RATE_LIMITS.follow.everyMs + 50);
    alice.room.send(N.MSG.follow, { uid: "bob" });
    await sleep(200);
    expect(alice.answers).toHaveLength(4);
    expect(alice.code).toBe(0);
  });
});
