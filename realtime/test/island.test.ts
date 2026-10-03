// specs/multiplayer.md §7 realtime/test/island.test.ts: the island room end to end, with
// real @colyseus/sdk clients against a booted server (dev tokens, in-memory cards).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Client, type Room as SdkRoom } from "@colyseus/sdk";
import * as N from "@net/protocol";
import { createApp } from "../src/app.config";
import { CardError, devCard, type PlayerCard } from "../src/auth/card";
import { parseEnv } from "../src/env";
import { Player, RosterEntry, schemaFields } from "../src/rooms/state";
import { honestTraces } from "./helpers/traces";

const PORT = 2593;
const URL = `ws://127.0.0.1:${PORT}`;
const GRACE_S = 1;

const logs: { event: string; fields: Record<string, unknown> }[] = [];
/** Per dev name: card fields to override, or the error loading it throws. */
const cards = new Map<string, Partial<PlayerCard> | Error>();
const rooms: SdkRoom[] = [];
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createApp({
      env: parseEnv({ NODE_ENV: "test", DEV_AUTH: "1" }),
      kickForMovement: true,
      graceS: { desktop: GRACE_S, phone: GRACE_S * 2 },
      log: (event, fields) => logs.push({ event, fields }),
      loadCard: async (identity) => {
        const o = cards.get(identity.devName ?? "");
        if (o instanceof Error) throw o;
        return { ...devCard(identity), ...o };
      },
    }),
    PORT,
  );
});

afterEach(async () => {
  for (const r of rooms.splice(0)) r.reconnection.enabled = false;
  await colyseus.cleanup();
  cards.clear();
  logs.length = 0;
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
    await sleep(15);
  }
}

function client(token?: string, headers?: Record<string, string>): Client {
  const c = new Client(URL, headers ? { headers } : undefined);
  if (token) c.auth.token = token;
  return c;
}

const OPTS = (o: Partial<N.JoinOptions> = {}) => ({ v: N.PROTOCOL, area: 0, mobile: false, showClass: true, ...o });

async function join(name: string, o: Partial<N.JoinOptions> = {}, token = `dev:${name}`): Promise<SdkRoom> {
  const room = await client(token).joinOrCreate(N.ROOM_NAME, OPTS(o));
  rooms.push(room);
  room.reconnection.minUptime = 0;
  await room.waitForInitialState();
  return room;
}

/** The close code a join refusal arrives with (HTTP status or 41xx). */
async function refusal(p: Promise<unknown>): Promise<number> {
  try {
    const room = (await p) as SdkRoom;
    rooms.push(room);
  } catch (e) {
    return (e as { code: number }).code;
  }
  return 0;
}

type AnyState = { epoch: number; shard: number; players: N.NetMap<N.NetPlayer>; roster: N.NetMap<N.RosterEntry> };
/** The decoded state. `players` is view-tagged: it only appears once the view holds someone. */
const EMPTY: N.NetMap<never> = { get: () => undefined, forEach: () => {}, size: 0 };
const st = (r: SdkRoom): AnyState => {
  const s = r.state as unknown as Partial<AnyState>;
  return { epoch: s.epoch ?? 0, shard: s.shard ?? 0, players: s.players ?? EMPTY, roster: s.roster ?? EMPTY };
};
const sees = (viewer: SdkRoom, other: SdkRoom) => st(viewer).players.get(other.sessionId) !== undefined;
const now = (r: SdkRoom) => Date.now() - st(r).epoch;

function pose(t: number, x: number, z: number, o: Partial<N.Pose> = {}): N.PosePacket {
  return N.encodePose({ ...N.createPose(), t, x, z, ...o }, []);
}

/** The server-side room instance behind an SDK room. */
const serverRoom = (r: SdkRoom) => colyseus.getRoomById(r.roomId) as unknown as Record<string, any>;
/** A network drop: the server's socket dies without a close frame (1006 on both ends). */
const dropSocket = (r: SdkRoom) => serverRoom(r).clients.get(r.sessionId).ref.terminate();

// ── tests ───────────────────────────────────────────────────────────

describe("the schema is the contract", () => {
  it("Player and RosterEntry fields equal NET_PLAYER_FIELDS and NET_ROSTER_FIELDS, in order", () => {
    expect(schemaFields(Player as never)).toEqual(N.NET_PLAYER_FIELDS.map(([n, t]) => [n, t]));
    expect(schemaFields(RosterEntry as never)).toEqual(N.NET_ROSTER_FIELDS.map(([n, t]) => [n, t]));
    expect(schemaFields(Player as never).some(([n]) => n === "tier")).toBe(false);
  });
});

describe("views: areas and privacy", () => {
  it("two players in the same area see each other; nobody sees themselves", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    expect(bob.roomId).toBe(alice.roomId);
    await until(() => sees(alice, bob) && sees(bob, alice), "mutual view");
    expect(sees(alice, alice)).toBe(false);
    const a = st(bob).players.get(alice.sessionId)!;
    expect(a.uid).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.name).toBe("alice");
    expect(a.flags & N.FLAG.showClass).toBe(N.FLAG.showClass);
  });

  it("different areas don't, the roster has everyone, and a door moves the views", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    const carol = await join("carol", { area: N.AREAS.indexOf("cafe") });
    await until(() => sees(alice, bob), "alice sees bob");
    await sleep(150);
    expect(sees(alice, carol)).toBe(false);
    expect(sees(carol, alice)).toBe(false);
    await until(() => st(alice).roster.size === 3, "roster of 3");
    expect(st(alice).roster.get(carol.sessionId)?.area).toBe(N.AREAS.indexOf("cafe"));

    bob.send(N.MSG.slow, { area: N.AREAS.indexOf("cafe") });
    await until(() => sees(carol, bob) && sees(bob, carol) && !sees(alice, bob) && !sees(bob, alice), "bob through the café door");
    expect(st(alice).roster.get(bob.sessionId)?.area).toBe(N.AREAS.indexOf("cafe"));
  });

  it("private areas are hidden and blind, but stay in the roster", async () => {
    const alice = await join("alice");
    const dave = await join("dave", { area: N.AREAS.indexOf("ruins") });
    await until(() => st(alice).roster.size === 2, "roster");
    await sleep(600);
    expect(sees(alice, dave)).toBe(false);
    expect(sees(dave, alice)).toBe(false);
    expect(st(alice).roster.get(dave.sessionId)?.area).toBe(N.AREAS.indexOf("ruins"));
  });

  it("a player who leaves drops out of every view and the roster", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(alice, bob), "view");
    await bob.leave();
    await until(() => !sees(alice, bob) && st(alice).roster.get(bob.sessionId) === undefined, "bob gone");
  });
});

describe("pose relay", () => {
  it("relays a pose dequantized, and its events to the same area only", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    const carol = await join("carol", { area: N.AREAS.indexOf("cafe") });
    await until(() => sees(bob, alice), "view");
    const bobEvents: N.NetEvent[] = [];
    const carolEvents: unknown[] = [];
    bob.onMessage(N.MSG.event, (m) => bobEvents.push(N.decodeEvent(m)!));
    carol.onMessage(N.MSG.event, (m) => carolEvents.push(m));

    const t = now(alice) + 100;
    const sent = {
      ...N.createPose(),
      seq: 7, t, x: 1.23, y: 0.5, z: -4.56, vx: 3.21, vy: -1.5, vz: 0.25, yaw: 1.0,
      move: N.MOVE_CLIPS.indexOf("Air"), air: 0.5, leaf: 0.4, lift: 0.12,
      ev: [N.EV.jump, 0, 12, N.EV.play, "Wave", 0],
    };
    alice.send(N.MSG.pose, N.encodePose(sent, []));
    await until(() => st(bob).players.get(alice.sessionId)?.x === 123, "alice's pose at bob");
    const p = st(bob).players.get(alice.sessionId)!;
    expect(N.dequantPos(p.x)).toBeCloseTo(1.23, 5);
    expect(N.dequantPos(p.y)).toBeCloseTo(0.5, 5);
    expect(N.dequantPos(p.z)).toBeCloseTo(-4.56, 5);
    expect(N.dequantVel(p.vx)).toBeCloseTo(3.21, 5);
    expect(N.dequantVel(p.vy)).toBeCloseTo(-1.5, 5);
    expect(N.dequantYaw(p.yaw)).toBeCloseTo(1.0, 3);
    expect(p.move).toBe(N.MOVE_CLIPS.indexOf("Air"));
    expect(N.dequantAir(p.air)).toBeCloseTo(0.5, 2);
    expect(N.dequantLeaf(p.leaf)).toBeCloseTo(0.4, 2);
    expect(N.dequantLift(p.lift)).toBeCloseTo(0.12, 5);
    expect(p.t).toBe(Math.round(t));

    await until(() => bobEvents.length === 2, "two events at bob");
    expect(bobEvents[0]).toEqual({ sid: p.sid, t: Math.round(t) - 12, kind: N.EV.jump, value: 0 });
    expect(bobEvents[1]).toEqual({ sid: p.sid, t: Math.round(t), kind: N.EV.play, value: "Wave" });
    await sleep(200);
    expect(carolEvents).toEqual([]);
  });

  it("bumps tp with a flagged sample so receivers snap", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    const t = now(alice);
    alice.send(N.MSG.pose, pose(t, 0, 0));
    await until(() => st(bob).players.get(alice.sessionId)?.t === Math.round(t), "first pose");
    const tp0 = st(bob).players.get(alice.sessionId)!.tp;
    alice.send(N.MSG.pose, pose(t + 100, 20, 20, { flags: N.PACKET_FLAG.teleport }));
    await until(() => st(bob).players.get(alice.sessionId)?.x === 2000, "the snap");
    expect(st(bob).players.get(alice.sessionId)!.tp).toBe(N.nextTp(tp0));
  });

  it("refuses a speed hack without relaying it, and closes with 4103 at 10 strikes", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    let code = 0;
    alice.onLeave((c) => (code = c));
    const t = now(alice);
    alice.send(N.MSG.pose, pose(t, 0, 0));
    await until(() => st(bob).players.get(alice.sessionId)?.t === Math.round(t), "baseline");
    let furthest = 0;
    const watch = setInterval(() => (furthest = Math.max(furthest, st(bob).players.get(alice.sessionId)?.x ?? 0)), 5);
    // 100 u/s: 5 u every 50 ms.
    for (let i = 1; i <= 12; i++) {
      alice.send(N.MSG.pose, pose(t + i * 50, Math.min(39, i * 5), 0));
      await sleep(10);
    }
    await until(() => code !== 0, "the kick");
    expect(code).toBe(N.CLOSE.kicked);
    expect(logs.some((l) => l.event === "kick" && l.fields.why === "speed")).toBe(true);
    await until(() => st(bob).roster.get(alice.sessionId) === undefined, "alice gone");
    clearInterval(watch);
    // Nothing past the baseline was ever relayed.
    expect(furthest).toBe(0);
  });

  it("honest movement from the real sim is applied without a strike", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    const tr = honestTraces()["dash chain"].slice(0, 25);
    const t0 = now(alice), start = Date.now();
    for (const s of tr) {
      const at = s.t - tr[0].t;
      await sleep(Math.max(0, at - (Date.now() - start)));
      alice.send(N.MSG.pose, pose(t0 + at, s.x, s.z, { y: s.y, flags: s.teleport ? N.PACKET_FLAG.teleport : 0 }));
    }
    const last = tr[tr.length - 1];
    await until(() => st(bob).players.get(alice.sessionId)?.x === N.quantPos(last.x), "the last sample");
    const session = (serverRoom(alice).sessions as Map<string, { track: { strikes: number } }>).get(alice.sessionId)!;
    expect(session.track.strikes).toBe(0);
  });
});

describe("rate limits", () => {
  it("drops pings over 2 a second", async () => {
    const alice = await join("alice");
    const pongs: N.Pong[] = [];
    alice.onMessage(N.MSG.pong, (m) => pongs.push(N.parsePong(m)!));
    const sent = Date.now();
    for (let i = 0; i < 5; i++) alice.send(N.MSG.ping, [sent + i]);
    await sleep(400);
    expect(pongs.map((p) => p.client)).toEqual([sent, sent + 1]);
    expect(Math.abs(pongs[0].server - Date.now())).toBeLessThan(1000);
  });

  it("drops slow-state messages over 5 a second", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    for (let i = 1; i <= 8; i++) alice.send(N.MSG.slow, { held: `rod:k${i}` });
    await until(() => st(bob).players.get(alice.sessionId)?.held === "rod:k5", "the fifth");
    await sleep(200);
    expect(st(bob).players.get(alice.sessionId)?.held).toBe("rod:k5");
  });

  it("relays one emote a second, and a fourth door in a second is dropped", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    const got: N.NetEvent[] = [];
    bob.onMessage(N.MSG.event, (m) => got.push(N.decodeEvent(m)!));
    const t = now(alice);
    for (let i = 0; i < 3; i++) alice.send(N.MSG.pose, pose(t + i * 40, 0, 0, { ev: [N.EV.play, "Wave", 0] }));
    await sleep(300);
    expect(got.filter((e) => e.value === "Wave")).toHaveLength(1);

    const cafe = N.AREAS.indexOf("cafe"), hq = N.AREAS.indexOf("hq");
    for (const area of [cafe, 0, cafe, hq]) alice.send(N.MSG.slow, { area });
    await sleep(300);
    expect(st(bob).roster.get(alice.sessionId)?.area).toBe(cafe);
  });
});

describe("sessions", () => {
  it("a second tab replaces the first (4104)", async () => {
    const first = await join("alice");
    let code = 0;
    first.onLeave((c) => (code = c));
    const second = await join("alice");
    await until(() => code !== 0, "the first tab's close");
    expect(code).toBe(N.CLOSE.replaced);
    await until(() => st(second).roster.size === 1, "one alice");
    expect(st(second).roster.get(second.sessionId)).toBeDefined();
  });

  it("a refused join (an old version) leaves the open tab alone", async () => {
    const first = await join("alice");
    let left = false;
    first.onLeave(() => (left = true));
    expect(await refusal(client("dev:alice").joinOrCreate(N.ROOM_NAME, OPTS({ v: N.PROTOCOL + 1 })))).toBe(N.CLOSE.version);
    await sleep(200);
    expect(left).toBe(false);
  });

  it("reconnecting within the grace keeps the player; after it they're removed", async () => {
    const alice = await join("alice");
    const bob = await join("bob");
    await until(() => sees(bob, alice), "view");
    const flagsAt = () => st(bob).roster.get(alice.sessionId)?.flags ?? -1;

    let reconnected = false;
    alice.onReconnect(() => (reconnected = true));
    dropSocket(alice);
    await until(() => (flagsAt() & N.FLAG.away) !== 0, "away while dropped");
    await until(() => reconnected, "the SDK's reconnect");
    await until(() => flagsAt() >= 0 && (flagsAt() & N.FLAG.away) === 0, "back");
    expect(sees(bob, alice)).toBe(true);

    alice.reconnection.enabled = false;
    dropSocket(alice);
    await until(() => (flagsAt() & N.FLAG.away) !== 0, "away again");
    await until(() => st(bob).roster.get(alice.sessionId) === undefined, "removed after the grace", GRACE_S * 1000 + 3000);
  });

  it("locks a shard at 30 players, opens a second one, and unlocks under 26", async () => {
    const first: SdkRoom[] = [];
    for (let i = 1; i <= N.SHARD.lock; i++) first.push(await join(`bot-${String(i).padStart(2, "0")}`));
    const roomId = first[0].roomId;
    expect(first.every((r) => r.roomId === roomId)).toBe(true);
    await until(() => serverRoom(first[0]).locked === true, "locked");
    const extra = await join("bot-31");
    expect(extra.roomId).not.toBe(roomId);
    expect(st(first[0]).shard).toBe(1);
    expect(st(extra).shard).toBe(2);
    for (const r of first.slice(0, N.SHARD.lock - N.SHARD.unlock + 1)) await r.leave();
    await until(() => serverRoom(first[0]).locked === false, "unlocked");
    const next = await join("bot-32");
    expect(next.roomId).toBe(roomId);
  });
});

describe("join refusals", () => {
  it("HTTP 401 without a valid token and 403 from another site", async () => {
    expect(await refusal(client().joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.HTTP_REFUSAL.auth);
    expect(await refusal(client("not-a-jwt").joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.HTTP_REFUSAL.auth);
    expect(await refusal(client("dev:alice", { Origin: "https://evil.example" }).joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.HTTP_REFUSAL.origin);
  });

  it("4102 while removed, 4106 for an old version or malformed options, 4107 when the card is slow, 4101 without a profile", async () => {
    cards.set("rita", { removed_until: new Date(Date.now() + 86_400_000).toISOString() });
    expect(await refusal(client("dev:rita").joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.CLOSE.removed);
    expect(await refusal(client("dev:vic").joinOrCreate(N.ROOM_NAME, OPTS({ v: 999 })))).toBe(N.CLOSE.version);
    expect(await refusal(client("dev:vic").joinOrCreate(N.ROOM_NAME, { v: N.PROTOCOL, area: 99 }))).toBe(N.CLOSE.version);
    cards.set("bo", new CardError("timeout"));
    expect(await refusal(client("dev:bo").joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.CLOSE.busy);
    cards.set("nell", new CardError("no_profile"));
    expect(await refusal(client("dev:nell").joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(N.CLOSE.auth);
    // A removal that has passed lets them back in.
    cards.set("rita", { removed_until: new Date(Date.now() - 1000).toISOString() });
    expect(await refusal(client("dev:rita").joinOrCreate(N.ROOM_NAME, OPTS()))).toBe(0);
  });
});

describe("world clock and restart", () => {
  it("answers ping with the server clock", async () => {
    const alice = await join("alice");
    const before = Date.now();
    const got = new Promise<N.Pong>((resolve) => alice.onMessage(N.MSG.pong, (m) => resolve(N.parsePong(m)!)));
    alice.send(N.MSG.ping, [before]);
    const p = await got;
    expect(p.client).toBe(before);
    expect(p.server).toBeGreaterThanOrEqual(before);
    expect(p.server).toBeLessThanOrEqual(Date.now());
  });

  it("before a shutdown, says restart and closes with 4010", async () => {
    const alice = await join("alice");
    alice.reconnection.enabled = false;
    const sys: unknown[] = [];
    alice.onMessage(N.MSG.sys, (m) => sys.push(m));
    let code = 0;
    alice.onLeave((c) => (code = c));
    serverRoom(alice).onBeforeShutdown();
    await until(() => code !== 0, "the close");
    expect(code).toBe(N.CLOSE.restart);
    expect(N.parseSys(sys[0])?.kind).toBe("restart");
  });
});
