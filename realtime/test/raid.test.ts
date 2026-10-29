// A divine catch's raid (src/rooms/raid.ts, protocol.ts note 11): the stamina math, the caps on reported wear, the
// signed credits, and end to end with real clients: one opens, others across the shard join, the fish is landed and
// every helper gets a credit.
import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Client, type Room as SdkRoom } from "@colyseus/sdk";
import * as N from "@net/protocol";
import { createApp } from "../src/app.config";
import { devCard } from "../src/auth/card";
import { devUid } from "../src/auth/verify";
import { parseEnv } from "../src/env";
import { creditFor, hitRaid, joinRaid, openRaid, raidView, tickRaid } from "../src/rooms/raid";

const SECRET = "raid-test-secret-0123456789abcdefghij";
const ROLL = "11111111-2222-4333-8444-555555555555";
const OPEN = { op: "open", fish: "fish_test_divine", roll: ROLL, x: 3, z: -4 } as const;

/** `n` helpers each reeling with the fish in the bar `inside` of the time, for `seconds`; the fish's result. */
function simulate(n: number, inside: number, seconds: number) {
  let now = 0;
  const raid = openRaid(OPEN, { key: "k0", uid: "u0" }, 0, now);
  for (let i = 1; i < n; i++) joinRaid(raid, `k${i}`, `u${i}`, now);
  while (now < seconds * 1000 && !raid.result) {
    now += N.RAID.hitEveryMs;
    for (let i = 0; i < n; i++) hitRaid(raid, `k${i}`, N.RAID.wear * inside * N.RAID.hitEveryMs / 1000, now);
    tickRaid(raid, now);
  }
  return raid;
}

describe("the raid's rules", () => {
  it("one angler alone can't land it; a few can, before it escapes", () => {
    expect(simulate(1, 0.6, 200).result).toBe("escaped");
    expect(simulate(2, 0.6, 200).result).not.toBe("landed");
    const four = simulate(4, 0.6, 200);
    expect(four.result).toBe("landed");
  });

  it("takes reported wear only up to what a reel could deal", () => {
    const raid = openRaid(OPEN, { key: "a", uid: "ua" }, 0, 0);
    expect(hitRaid(raid, "a", 1, 250)).toBeCloseTo(N.RAID.wear * 0.25 * 1.25);
    expect(hitRaid(raid, "a", 1, 250)).toBe(0); // no time since the last report
    expect(hitRaid(raid, "stranger", 1, 5000)).toBe(0); // not a helper
    expect(raid.stamina).toBeGreaterThan(0.99);
  });

  it("escapes at its time", () => {
    const raid = openRaid(OPEN, { key: "a", uid: "ua" }, 0, 0);
    tickRaid(raid, N.RAID.lengthMs);
    expect(raid.result).toBe("escaped");
    expect(creditFor(raid, "a", SECRET, N.RAID.lengthMs)).toBeUndefined();
  });

  it("credits each helper who dealt wear, signed with the shared secret", () => {
    const raid = simulate(4, 0.8, 200);
    joinRaid(raid, "late", "ulate", 0); // joined after it was landed: no credit
    const token = creditFor(raid, "k2", SECRET, 1000)!;
    const [payload, sig] = token.split(".");
    expect(sig).toBe(createHmac("sha256", SECRET).update(payload).digest("hex"));
    const credit = JSON.parse(Buffer.from(payload, "base64url").toString()) as N.RaidCredit;
    expect(credit).toEqual({ m: "u2", f: OPEN.fish, r: ROLL, o: "u0", i: raid.id, e: 1000 + N.RAID.creditTtlMs });
    expect(creditFor(raid, "late", SECRET, 1000)).toBeUndefined();
    expect(N.parseRaidView(raidView(raid, "k2", 0, token))).toMatchObject({ result: "landed", credit: token, joined: true, helpers: 4 });
  });
});

// ── End to end ──────────────────────────────────────────────────────

const PORT = 2599;
const rooms: SdkRoom[] = [];
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(createApp({
    env: parseEnv({ NODE_ENV: "test", DEV_AUTH: "1", REALTIME_INTERNAL_SECRET: SECRET }),
    kickForMovement: true, log: () => {}, loadCard: async (identity) => devCard(identity),
  }), PORT);
});
afterEach(async () => {
  for (const r of rooms.splice(0)) r.reconnection.enabled = false;
  await colyseus.cleanup();
});
afterAll(async () => { await colyseus?.shutdown(); });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, what: string, ms = 6000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(15);
  }
}
async function join(name: string) {
  const c = new Client(`ws://127.0.0.1:${PORT}`);
  c.auth.token = `dev:${name}`;
  const room = await c.joinOrCreate(N.ROOM_NAME, { v: N.PROTOCOL, area: 0, mobile: false, showClass: true });
  rooms.push(room);
  const views: N.RaidView[] = [];
  room.onMessage(N.MSG.raid, (m: unknown) => { const v = N.parseRaidView(m); if (v) views.push(v); });
  await room.waitForInitialState();
  return { room, views, last: () => views[views.length - 1] };
}

describe("a raid across the shard", () => {
  it("tells every joiner there's none, then lets anyone join the one opened, and credits everyone who helped", async () => {
    const names = ["Opener", "Far", "Near", "Watcher"];
    const players = await Promise.all(names.map(join));
    await until(() => players.every((p) => p.views.length > 0), "the first raid view");
    expect(players.every((p) => p.views[0].id === "")).toBe(true);

    const [opener, ...rest] = players;
    opener.room.send(N.MSG.raid, OPEN);
    await until(() => players.every((p) => p.last().id !== ""), "the raid reaching everyone");
    const id = opener.last().id;
    expect(opener.last().joined).toBe(true);
    expect(rest[0].last().joined).toBe(false);

    // Two join from wherever they are; the watcher doesn't. A second open while it runs is ignored.
    for (const p of rest.slice(0, 2)) p.room.send(N.MSG.raid, { op: "join", id });
    rest[2].room.send(N.MSG.raid, OPEN);
    await until(() => opener.last().helpers === 3, "three helpers");
    expect(opener.last().id).toBe(id);

    // Everyone reels flat out; it lands, and each helper (not the watcher) gets a credit for their own uid.
    const helping = [opener, rest[0], rest[1]], deadline = Date.now() + 90_000;
    while (!opener.last().result) {
      for (const p of helping) p.room.send(N.MSG.raid, { op: "hit", id, dealt: N.RAID.wear * N.RAID.hitEveryMs / 1000 });
      await sleep(N.RAID.hitEveryMs);
      if (Date.now() > deadline) throw new Error("never landed");
    }
    await until(() => helping.every((p) => p.last().result === "landed") && rest[2].last().result === "landed", "the landing everywhere");
    helping.forEach((p, i) => {
      const token = p.last().credit!;
      const credit = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as N.RaidCredit;
      expect(credit.m).toBe(devUid(names[i]));
      expect(credit.o).toBe(devUid("Opener"));
    });
    expect(rest[2].last().credit).toBeUndefined();
  }, 120_000);
});
