// specs/multiplayer.md §6 and M2 end to end: world chat through the island room with real
// @colyseus/sdk clients (dev tokens, in-memory cards), blocks, the batched log, live
// sanctions over the signed /internal endpoints, and the 60 s poll.
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Client, type Room as SdkRoom } from "@colyseus/sdk";
import * as N from "@net/protocol";
import { createApp } from "../src/app.config";
import { devCard, type PlayerCard } from "../src/auth/card";
import { devUid } from "../src/auth/verify";
import type { ChatLogRow } from "../src/chatLog";
import { parseEnv } from "../src/env";
import { INTERNAL_HEADERS, signInternal } from "../src/internal";
import { createWorld, type Blocks, type SanctionRow } from "../src/world";

const PORT = 2595;
const WS = `ws://127.0.0.1:${PORT}`;
const HTTP = `http://127.0.0.1:${PORT}`;
const SECRET = "test-internal-secret-0123456789abcdefghij";
const DAY = 86_400_000;

const logs: { event: string; fields: Record<string, unknown> }[] = [];
/** Card fields per dev name, over a 30-day-old member's. */
const cards = new Map<string, Partial<PlayerCard>>();
/** Blocks per dev name, as world_blocks would give them; an Error is the database failing. */
const blockRows = new Map<string, Blocks | Error>();
const written: ChatLogRow[] = [];
let dbDown = false;
let pollAnswer: (uids: string[]) => Promise<SanctionRow[]> = async () => [];
const rooms: SdkRoom[] = [];
let colyseus: ColyseusTestServer;

const world = createWorld({
  writeChat: async (rows) => {
    if (dbDown) throw new Error("fetch failed");
    written.push(...rows);
  },
  loadBlocks: async (uid) => {
    const name = [...blockRows.keys()].find((n) => devUid(n) === uid);
    const b = name ? blockRows.get(name) : undefined;
    if (b instanceof Error) throw b;
    return b ?? { blocks: [], blockedBy: [] };
  },
  pollSanctions: (uids) => pollAnswer(uids),
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
      loadCard: async (identity) => ({
        ...devCard(identity),
        badge: "member",
        created_at: new Date(Date.now() - 30 * DAY).toISOString(),
        ...cards.get(identity.devName ?? ""),
      }),
    }),
    PORT,
  );
});

afterEach(async () => {
  for (const r of rooms.splice(0)) r.reconnection.enabled = false;
  await colyseus.cleanup();
  cards.clear();
  blockRows.clear();
  // Drain what this test's lines left in the shared log (stop also ends any backoff).
  dbDown = false;
  await world.chatLog.stop();
  written.length = 0;
  logs.length = 0;
  pollAnswer = async () => [];
});

afterAll(async () => {
  await colyseus?.shutdown();
});

// ── helpers ─────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, what = "condition", ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(10);
  }
}

type Player = { room: SdkRoom; uid: string; lines: N.ChatLine[]; sys: N.SysMessage[]; events: N.NetEvent[]; code: number };
const OPTS = (o: Partial<N.JoinOptions> = {}) => ({ v: N.PROTOCOL, area: 0, mobile: false, showClass: true, ...o });

async function join(name: string, o: Partial<N.JoinOptions> = {}): Promise<Player> {
  const c = new Client(WS);
  c.auth.token = `dev:${name}`;
  const room = await c.joinOrCreate(N.ROOM_NAME, OPTS(o));
  rooms.push(room);
  room.reconnection.minUptime = 0;
  const p: Player = { room, uid: devUid(name), lines: [], sys: [], events: [], code: 0 };
  room.onMessage(N.MSG.line, (m) => {
    const line = N.parseChatLine(m);
    if (!line) throw new Error(`bad line ${JSON.stringify(m)}`);
    p.lines.push(line);
  });
  room.onMessage(N.MSG.sys, (m) => p.sys.push(N.parseSys(m)!));
  room.onMessage(N.MSG.event, (m) => p.events.push(N.decodeEvent(m)!));
  room.onMessage(N.MSG.pong, () => {});
  room.onLeave((code) => (p.code = code));
  await room.waitForInitialState();
  return p;
}

/** A join's refusal code (or 0 when it got in). */
async function refusal(name: string): Promise<number> {
  const c = new Client(WS);
  c.auth.token = `dev:${name}`;
  try {
    rooms.push(await c.joinOrCreate(N.ROOM_NAME, OPTS()));
  } catch (e) {
    return (e as { code: number }).code;
  }
  return 0;
}

const say = (p: Player, text: unknown) => p.room.send(N.MSG.chat, { text });
const texts = (p: Player) => p.lines.map((l) => l.text);
const lastRefusal = (p: Player) => {
  const s = p.sys.filter((m) => m.kind === "refused").at(-1);
  return s && s.kind === "refused" ? s.reason : null;
};
const players = (p: Player) => (p.room.state as unknown as { players?: N.NetMap<N.NetPlayer> }).players;
const now = (p: Player) => Date.now() - ((p.room.state as unknown as { epoch: number }).epoch ?? 0);

async function signed(path: string, body: unknown, o: { time?: number; nonce?: string; signature?: string; raw?: string } = {}) {
  const text = o.raw ?? JSON.stringify(body);
  const time = String(o.time ?? Date.now());
  const nonce = o.nonce ?? randomBytes(16).toString("hex");
  const res = await fetch(`${HTTP}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [INTERNAL_HEADERS.time]: time,
      [INTERNAL_HEADERS.nonce]: nonce,
      [INTERNAL_HEADERS.signature]: o.signature ?? signInternal(SECRET, time, nonce, text),
    },
    body: text,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, nonce, time };
}

// ── delivery ────────────────────────────────────────────────────────

describe("world chat", () => {
  it("a line goes to the whole shard, the sender included, every area and private ones too, with its area", async () => {
    const alice = await join("alice");
    const carol = await join("carol");
    const bob = await join("bob", { area: N.AREAS.indexOf("cafe") });
    const dave = await join("dave", { area: N.AREAS.indexOf("ruins") });
    const before = now(alice);
    say(alice, "  hello   island  ");
    await until(() => [alice, bob, carol, dave].every((p) => p.lines.length === 1), "the line everywhere");
    const line = alice.lines[0];
    for (const p of [bob, carol, dave]) expect(p.lines[0]).toEqual(line);
    expect(line).toMatchObject({ uid: alice.uid, name: "alice", area: 0, text: "hello island" });
    expect(line.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(line.t).toBeGreaterThanOrEqual(before - 5);
    expect(line.t).toBeLessThanOrEqual(now(alice) + 5);
    // The sid is the one alice's avatar carries for players who see her (the bubble's).
    await until(() => players(carol)?.get(alice.room.sessionId) !== undefined, "carol sees alice");
    expect(line.sid).toBe(players(carol)!.get(alice.room.sessionId)!.sid);
    // Each line carries the area it was said in.
    await sleep(N.CHAT.gapMs);
    say(bob, "from the cafe");
    await until(() => alice.lines.length === 2, "bob's line");
    expect(alice.lines[1]).toMatchObject({ name: "bob", area: N.AREAS.indexOf("cafe") });
  });

  it("a refused line gets its notice, to the sender only", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    say(alice, "what the f*ck");
    await until(() => alice.sys.length === 1, "the notice");
    expect(alice.sys[0]).toEqual({ kind: "refused", reason: "filtered", text: "Please keep chat friendly." });
    await sleep(150);
    expect(bob.sys).toEqual([]);
    expect(bob.lines).toEqual([]);
    expect(alice.lines).toEqual([]);
  });

  it("every refusal reaches the wire with its reason", async () => {
    const soon = new Date(Date.now() + 3 * DAY).toISOString();
    cards.set("mia", { muted_until: soon });
    cards.set("nora", { badge: null, created_at: new Date(Date.now() - 3_600_000).toISOString() });
    cards.set("uri", { created_at: new Date(Date.now() - 2 * DAY).toISOString() });
    const [mia, fay, rex, ella, lou, nora, uri, fil] = await Promise.all(["mia", "fay", "rex", "ella", "lou", "nora", "uri", "fil"].map((n) => join(n)));
    say(mia, "hi");
    say(fay, "one"); say(fay, "two");
    say(rex, "same"); say(ella, "   ​ ");
    say(lou, "x".repeat(N.CHAT.maxLength + 1));
    say(nora, "hi"); say(nora, "again");
    say(uri, "join discord.gg/abc");
    say(fil, "you b!tch");
    await until(() => [mia, fay, ella, lou, nora, uri, fil].every((p) => p.sys.length >= 1), "the notices");
    expect(lastRefusal(mia)).toBe("muted");
    expect(mia.sys[0].text).toMatch(/^You can't chat until /);
    expect(lastRefusal(fay)).toBe("fast");
    expect(lastRefusal(ella)).toBe("empty");
    expect(lastRefusal(lou)).toBe("long");
    expect(lastRefusal(nora)).toBe("slow");
    expect(lastRefusal(uri)).toBe("url");
    expect(lastRefusal(fil)).toBe("filtered");
    await sleep(N.CHAT.gapMs);
    say(rex, "SAME");
    await until(() => rex.sys.length === 1, "the repeat");
    expect(lastRefusal(rex)).toBe("repeat");
    // What went out: one line each from fay, rex and nora, seen by everyone.
    expect(texts(mia).sort()).toEqual(["hi", "one", "same"].sort());
  });

  it("a flood is dropped past the raw limit without a disconnect; malformed chat is dropped", async () => {
    const alice = await join("alice");
    for (let i = 0; i < 10; i++) say(alice, `spam ${i}`);
    for (const bad of [5, null, ["hi"]]) say(alice, bad);
    alice.room.send(N.MSG.chat, "hi");
    alice.room.send(N.MSG.chat, {});
    await sleep(400);
    expect(alice.lines.length + alice.sys.length).toBeLessThanOrEqual(3);
    expect(texts(alice)).toEqual(["spam 0"]);
    expect(alice.code).toBe(0);
  });

  it("an unknown message type still closes the client with 4002", async () => {
    const alice = await join("alice");
    say(alice, "chat is known");
    await until(() => alice.lines.length === 1, "chat");
    alice.room.send("whisper", { text: "psst" });
    await until(() => alice.code !== 0, "the close");
    expect(alice.code).toBe(N.COLYSEUS_CLOSE.withError);
  });
});

// ── blocks ──────────────────────────────────────────────────────────

describe("blocks", () => {
  it("loaded at join: no lines between the pair either way, and no emotes; others hear both; movement still flows", async () => {
    // Only alice's side is in the rows: one direction is enough for both.
    blockRows.set("alice", { blocks: [devUid("bob")], blockedBy: [] });
    const alice = await join("alice");
    const bob = await join("bob");
    const carol = await join("carol");
    say(alice, "from alice");
    say(bob, "from bob");
    await until(() => carol.lines.length === 2, "carol hears both");
    await sleep(150);
    expect(texts(alice)).toEqual(["from alice"]);
    expect(texts(bob)).toEqual(["from bob"]);

    await until(() => players(bob)?.get(alice.room.sessionId) !== undefined && players(carol)?.get(alice.room.sessionId) !== undefined, "views");
    await until(() => players(alice)?.get(bob.room.sessionId) !== undefined, "alice sees bob");
    const t = now(alice);
    alice.room.send(N.MSG.pose, N.encodePose({ ...N.createPose(), t, ev: [N.EV.play, "Wave", 0, N.EV.jump, 0, 0] }, []));
    bob.room.send(N.MSG.pose, N.encodePose({ ...N.createPose(), t, ev: [N.EV.play, "Dance", 0] }, []));
    await until(() => carol.events.length === 3, "carol sees all three");
    await sleep(150);
    expect(bob.events.map((e) => N.EV_KINDS[e.kind])).toEqual(["jump"]); // the jump, not the wave
    expect(alice.events).toEqual([]); // not bob's dance
  });

  it("the other direction loaded alone works the same", async () => {
    blockRows.set("bob", { blocks: [], blockedBy: [devUid("alice")] });
    const alice = await join("alice");
    const bob = await join("bob");
    say(bob, "hello?");
    say(alice, "hi");
    await sleep(300);
    expect(texts(alice)).toEqual(["hi"]);
    expect(texts(bob)).toEqual(["hello?"]);
  });

  it("a block or unblock through /internal/block applies at once", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    const r = await signed("/internal/block", { blocker_id: alice.uid, blocked_id: bob.uid, blocked: true });
    expect(r).toMatchObject({ status: 200, body: { ok: true, sessions: 2 } });
    say(bob, "can you hear me");
    await sleep(250);
    expect(alice.lines).toEqual([]);
    const off = await signed("/internal/block", { blocker_id: alice.uid, blocked_id: bob.uid, blocked: false });
    expect(off.status).toBe(200);
    await sleep(N.CHAT.gapMs);
    say(bob, "now?");
    await until(() => alice.lines.length === 1, "heard again");
    expect(texts(alice)).toEqual(["now?"]);
  });

  it("blocks that can't be read refuse the join as busy (4107), like a slow card", async () => {
    blockRows.set("alice", new Error("db down"));
    expect(await refusal("alice")).toBe(N.CLOSE.busy);
  });
});

// ── the log ─────────────────────────────────────────────────────────

describe("the chat log", () => {
  it("queues each sent line with member ids and world names; refused lines aren't logged", async () => {
    const alice = await join("alice", { area: N.AREAS.indexOf("cafe") });
    say(alice, "a line for the log");
    await until(() => alice.lines.length === 1, "sent");
    say(alice, "fuck");
    await until(() => alice.sys.length === 1, "refused");
    await world.chatLog.flush();
    expect(written).toEqual([
      {
        id: alice.lines[0].id,
        shard: (alice.room.state as unknown as { shard: number }).shard,
        room_id: alice.room.roomId,
        area: "cafe",
        member_id: alice.uid,
        world_name: "alice",
        body: "a line for the log",
        created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      },
    ]);
  });

  it("with the database down the island keeps talking, and the lines go once it's back", async () => {
    dbDown = true;
    const alice = await join("alice");
    const bob = await join("bob");
    say(alice, "first");
    await until(() => bob.lines.length === 1, "first");
    await world.chatLog.flush(); // fails, backs off
    expect(written).toEqual([]);
    await sleep(N.CHAT.gapMs);
    say(alice, "second");
    await until(() => bob.lines.length === 2, "still talking");
    expect(world.chatLog.size).toBe(2);
    dbDown = false;
    await sleep(4100); // past the first backoff
    await world.chatLog.flush();
    expect(written.map((r) => r.body)).toEqual(["first", "second"]);
    expect(logs.some((l) => l.event === "chat_log_failed")).toBe(true);
  }, 20_000);
});

// ── sanctions ───────────────────────────────────────────────────────

describe("sanctions", () => {
  it("a mute through /internal/sanction stops the next line; lifting it lets the player talk again", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    const until1 = new Date(Date.now() + 7 * DAY).toISOString();
    const r = await signed("/internal/sanction", { member_id: alice.uid, muted_until: until1 });
    expect(r).toMatchObject({ status: 200, body: { ok: true, sessions: 1 } });
    say(alice, "hello?");
    await until(() => alice.sys.length === 1, "the refusal");
    expect(lastRefusal(alice)).toBe("muted");
    expect(bob.lines).toEqual([]);
    await signed("/internal/sanction", { member_id: alice.uid, muted_until: null });
    say(alice, "hello again");
    await until(() => bob.lines.length === 1, "heard");
  });

  it("a removal closes the player with 4102 within 2 s and refuses their rejoin; a restore lets them back", async () => {
    const rita = await join("rita");
    const bob = await join("bob");
    const t = Date.now();
    const r = await signed("/internal/sanction", { member_id: rita.uid, removed_until: new Date(Date.now() + DAY).toISOString() });
    expect(r.body).toMatchObject({ ok: true, sessions: 1 });
    await until(() => rita.code !== 0, "the kick", 2000);
    expect(Date.now() - t).toBeLessThan(2000);
    expect(rita.code).toBe(N.CLOSE.removed);
    await until(() => (bob.room.state as unknown as { roster: N.NetMap<N.RosterEntry> }).roster.get(rita.room.sessionId) === undefined, "gone");
    // Her card (cached or not) says nothing yet: the removal itself refuses her.
    expect(await refusal("rita")).toBe(N.CLOSE.removed);
    await signed("/internal/sanction", { member_id: rita.uid, removed_until: null });
    expect(await refusal("rita")).toBe(0);
  });

  it("a removal ends a dropped player's reconnection grace", async () => {
    const rita = await join("rita2", { mobile: true });
    const bob = await join("bob");
    rita.room.reconnection.enabled = false;
    (colyseus.getRoomById(rita.room.roomId) as unknown as { clients: { getById(id: string): { ref: { terminate(): void } } } }).clients.getById(rita.room.sessionId).ref.terminate();
    const roster = () => (bob.room.state as unknown as { roster: N.NetMap<N.RosterEntry> }).roster;
    await until(() => ((roster().get(rita.room.sessionId)?.flags ?? 0) & N.FLAG.away) !== 0, "away");
    await signed("/internal/sanction", { member_id: rita.uid, removed_until: new Date(Date.now() + DAY).toISOString() });
    await until(() => roster().get(rita.room.sessionId) === undefined, "gone at once", 2000);
  });

  it("the poll applies sanctions to connected players: a mute, then a removal", async () => {
    const alice = await join("alice");
    const seen: string[][] = [];
    pollAnswer = async (uids) => {
      seen.push(uids);
      return uids.map((u) => ({ member_id: u, muted_until: new Date(Date.now() + DAY).toISOString(), removed_until: null }));
    };
    await world.poll();
    expect(seen).toEqual([[alice.uid]]);
    say(alice, "hi");
    await until(() => alice.sys.length === 1, "muted by the poll");
    expect(lastRefusal(alice)).toBe("muted");
    pollAnswer = async (uids) => uids.map((u) => ({ member_id: u, muted_until: null, removed_until: new Date(Date.now() + DAY).toISOString() }));
    await world.poll();
    await until(() => alice.code !== 0, "removed by the poll");
    expect(alice.code).toBe(N.CLOSE.removed);
    // Lift it for the tests after (the world remembers for two minutes).
    world.sanction(alice.uid, { removed_until: null, muted_until: null });
  });

  it("a poll that read before a fresher notification doesn't undo it; a failed poll changes nothing", async () => {
    const alice = await join("pia");
    let answer!: (rows: SanctionRow[]) => void;
    pollAnswer = () => new Promise((res) => (answer = res));
    const polling = world.poll();
    await sleep(20);
    await signed("/internal/sanction", { member_id: alice.uid, muted_until: new Date(Date.now() + DAY).toISOString() });
    answer([{ member_id: alice.uid, muted_until: null, removed_until: null }]); // read before the mute
    await polling;
    say(alice, "still muted?");
    await until(() => alice.sys.length === 1, "refused");
    expect(lastRefusal(alice)).toBe("muted");

    pollAnswer = async () => {
      throw new Error("db down");
    };
    await world.poll();
    expect(logs.some((l) => l.event === "sanctions_poll_failed")).toBe(true);
    expect(alice.code).toBe(0);
    world.sanction(alice.uid, { muted_until: null });
  });
});

// ── the signed endpoints ────────────────────────────────────────────

describe("/internal signatures", () => {
  const body = () => ({ member_id: devUid("nobody"), muted_until: null });

  it("a good signature is applied", async () => {
    expect(await signed("/internal/sanction", body())).toMatchObject({ status: 200, body: { ok: true, sessions: 0 } });
  });

  it("refuses a bad signature, a wrong secret, a changed body, a stale or future time, a replay and malformed headers", async () => {
    const text = JSON.stringify(body());
    expect((await signed("/internal/sanction", body(), { signature: "0".repeat(64) })).status).toBe(401);
    const time = String(Date.now()), nonce = randomBytes(16).toString("hex");
    expect((await signed("/internal/sanction", body(), { time: Number(time), nonce, signature: signInternal("another-secret-0123456789abcdefghijk", time, nonce, text) })).status).toBe(401);
    const forChanged = signInternal(SECRET, time, nonce, text);
    expect((await signed("/internal/sanction", { ...body(), muted_until: "2030-01-01T00:00:00Z" }, { time: Number(time), nonce, signature: forChanged })).status).toBe(401);
    expect((await signed("/internal/sanction", body(), { time: Date.now() - 60_000 })).body).toEqual({ ok: false, error: "stale" });
    expect((await signed("/internal/sanction", body(), { time: Date.now() + 60_000 })).body).toEqual({ ok: false, error: "stale" });
    const first = await signed("/internal/sanction", body());
    expect(first.status).toBe(200);
    const again = await signed("/internal/sanction", body(), { time: Number(first.time), nonce: first.nonce });
    expect(again).toMatchObject({ status: 409, body: { ok: false, error: "replay" } });
    expect((await signed("/internal/sanction", body(), { nonce: "short" })).body).toEqual({ ok: false, error: "malformed" });
    const res = await fetch(`${HTTP}/internal/sanction`, { method: "POST", headers: { "content-type": "application/json" }, body: text });
    expect(res.status).toBe(401);
    expect(logs.filter((l) => l.event === "internal_refused").length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(logs)).not.toContain(SECRET);
  });

  it("refuses a body that isn't a sanction or a block, or too big", async () => {
    expect((await signed("/internal/sanction", { member_id: "not-a-uuid", muted_until: null })).status).toBe(400);
    expect((await signed("/internal/sanction", { member_id: devUid("x") })).status).toBe(400);
    expect((await signed("/internal/sanction", { member_id: devUid("x"), muted_until: "soon" })).status).toBe(400);
    expect((await signed("/internal/sanction", null, { raw: "{not json" })).status).toBe(400);
    expect((await signed("/internal/block", { blocker_id: devUid("a"), blocked_id: devUid("b") })).status).toBe(400);
    expect((await signed("/internal/sanction", null, { raw: JSON.stringify({ member_id: devUid("x"), muted_until: null, pad: "x".repeat(3000) }) })).status).toBe(413);
  });

  it("are off without the secret", async () => {
    const { internalEndpoints } = await import("../src/internal");
    const off = internalEndpoints({ world, log: () => {} });
    const res = (await off.sanction({ request: new Request("http://x/internal/sanction", { method: "POST", body: "{}" }) } as never)) as Response;
    expect(res.status).toBe(503);
  });
});
