/**
 * The live check (specs/multiplayer.md §1.2, M1): clients through the real netStore, sender and interp against a
 * running realtime server with DEV_AUTH=1. Skipped unless LIVE_REALTIME names it:
 *
 *   npm --prefix ../realtime run dev        # :2567, realtime/.env.development holding DEV_AUTH=1
 *   LIVE_REALTIME=ws://localhost:2567 npx vitest run lib/net/live.test.ts
 *
 * Node's fetch sends no Origin, so the server skips its origin check (the 403 case sets one on purpose).
 */
import { afterAll, describe, expect, it } from "vitest";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { AREAS, CLOSE, type RosterEntry } from "./protocol";
import { createRemoteSample, type RemoteSample } from "./types";
import { roomStore, type RoomStore, type SdkModule } from "./netStore";
import { createSender } from "./sender";
import { registerLocalAvatar, unregisterLocalAvatar } from "./localAvatar";
import type { RemoteBuffer } from "./interp";

const URL = process.env.LIVE_REALTIME;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(cond: () => boolean, what: string, ms = 5000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}
const stores: RoomStore[] = [];
function client(name: string, o: Partial<Parameters<typeof roomStore>[0]> = {}) {
  const s = roomStore({ url: URL!, devName: name, ...o });
  stores.push(s);
  return s;
}
const joined = (s: RoomStore) => s.source.status().kind === "joined";
const remoteNamed = (s: RoomStore, name: string): RemoteBuffer | undefined => {
  for (let i = 0; i < s.source.remotes.size; i++) if (s.source.remotes.at(i).player.name === name) return s.source.remotes.at(i);
  return undefined;
};
/** The SDK, changed on its way to the store (a wrong version, a foreign origin). */
const wrapped = (change: { options?: (o: Record<string, unknown>) => Record<string, unknown>; headers?: Record<string, string> }) => async () => {
  const sdk = (await import("@colyseus/sdk")) as unknown as SdkModule & { Client: new (url: string, opts?: unknown) => SdkModule["Client"]["prototype"] };
  const Base = sdk.Client as unknown as new (url: string, opts?: unknown) => { joinOrCreate(n: string, o: unknown): Promise<unknown> };
  class Client extends Base {
    constructor(url: string) { super(url, change.headers ? { headers: change.headers } : undefined); }
    joinOrCreate(n: string, o: unknown) { return super.joinOrCreate(n, change.options ? change.options(o as Record<string, unknown>) : o); }
  }
  return { ...sdk, Client } as unknown as SdkModule;
};

afterAll(async () => {
  for (const s of stores) s.source.leave();
  await sleep(200);
});

describe.skipIf(!URL)("live: two clients through netStore against the realtime server", () => {
  it("Alice walks a circle and waves; Bob draws her through the ring, on her path, at her pace", async () => {
    const alice = client("LiveAlice"), bob = client("LiveBob");
    for (const s of [alice, bob]) { s.setArea("village"); s.acquire(); }
    await until(() => joined(alice) && joined(bob), "both joined");
    await sleep(400); // the clock's first pongs
    expect(Math.abs(alice.source.now() - bob.source.now())).toBeLessThan(50); // one room timeline

    const motion = { current: { speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null } as CharacterMotion };
    const reg = registerLocalAvatar(motion);
    reg.held = { id: "rod", kind: "rod", key: "rod_flimsy", name: "Rod", icon: "" };
    const sender = createSender(alice.source);
    const player = { x: 4 + 3, y: 0, z: -6 }, speed = 5, out = createRemoteSample();
    const drawn: { now: number; x: number; z: number; snapped: boolean; s: RemoteSample["events"][number][] }[] = [];
    let last = performance.now(), angle = 0, waved = false;
    const startT = performance.now();
    while (performance.now() - startT < 5000) {
      await sleep(16);
      const now = performance.now(), dt = now - last;
      last = now;
      angle += (speed / 3) * (dt / 1000);
      player.x = 4 + 3 * Math.cos(angle);
      player.z = -6 + 3 * Math.sin(angle);
      motion.current.yaw = Math.atan2(-Math.sin(angle), Math.cos(angle));
      motion.current.speed = speed;
      if (!waved && now - startT > 2500) { motion.current.play = "Wave"; waved = true; }
      else if (motion.current.play) motion.current.play = null; // Character takes it
      sender.tick(player, dt);
      const a = remoteNamed(bob, "LiveAlice");
      if (a) {
        a.sample(bob.source.now(), out);
        drawn.push({ now: bob.source.now(), x: out.x, z: out.z, snapped: out.snapped, s: out.events.slice(0, out.eventCount).map(e => ({ ...e })) });
      }
    }
    sender.dispose();
    unregisterLocalAvatar(reg);

    const a = remoteNamed(bob, "LiveAlice")!;
    expect(a).toBeDefined();
    expect(a.player.held).toBe("rod:rod_flimsy");
    expect(a.player.area).toBe("village");
    // On her circle, once past the first second (the ring filling), and moving at her pace.
    const steady = drawn.filter(d => d.now - drawn[0].now > 1000);
    expect(steady.length).toBeGreaterThan(150);
    for (const d of steady) expect(Math.abs(Math.hypot(d.x - 4, d.z + 6) - 3)).toBeLessThan(0.08);
    let dist = 0;
    for (let i = 1; i < steady.length; i++) dist += Math.hypot(steady[i].x - steady[i - 1].x, steady[i].z - steady[i - 1].z);
    const pace = dist / ((steady[steady.length - 1].now - steady[0].now) / 1000);
    expect(pace).toBeGreaterThan(speed * 0.9);
    expect(pace).toBeLessThan(speed * 1.1);
    expect(drawn.filter(d => d.snapped).length).toBe(1); // her first frame only
    expect(a.renderLag).toBeGreaterThan(100);
    expect(a.renderLag).toBeLessThan(500);
    expect(drawn.flatMap(d => d.s).some(e => e.kind === "play" && e.value === "Wave")).toBe(true);
    console.info(`[live] Bob drew Alice ${steady.length} frames at ${pace.toFixed(2)} u/s (she walked ${speed}), render lag ${a.renderLag.toFixed(0)} ms`);
  }, 20_000);

  it("an area change hides them from each other; the roster keeps both, with their areas", async () => {
    const alice = stores[0], bob = stores[1];
    // Bob says where he is (his own sender would): a sample in the village.
    bob.source.sendPose([1, Math.round(bob.source.now()), 300, 0, -600, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await until(() => !!remoteNamed(alice, "LiveBob"), "Alice sees Bob");
    bob.setArea("cafe");
    await until(() => !remoteNamed(alice, "LiveBob") && !remoteNamed(bob, "LiveAlice"), "views split");
    const areaOf = (s: RoomStore, name: string) => s.source.roster().find((e: RosterEntry) => e.name === name)?.area;
    await until(() => areaOf(alice, "LiveBob") === AREAS.indexOf("cafe"), "the roster moves Bob");
    expect(areaOf(alice, "LiveAlice")).toBe(AREAS.indexOf("village"));
    bob.setArea("village");
    bob.source.sendPose([2, Math.round(bob.source.now()), 300, 0, -600, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await until(() => !!remoteNamed(alice, "LiveBob") && !!remoteNamed(bob, "LiveAlice"), "views back");
    bob.setArea("ruins"); // private: nobody, but still in the roster
    await until(() => !remoteNamed(alice, "LiveBob"), "private hides");
    await until(() => areaOf(alice, "LiveBob") === AREAS.indexOf("ruins"), "the roster says the ruins");
  }, 20_000);

  it("refusals land as the contract says: version, replaced (and Play here), auth after one retry, origin", async () => {
    const old = client("LiveOld", { loadSdk: wrapped({ options: o => ({ ...o, v: 99 }) }) });
    old.acquire();
    await until(() => old.source.status().kind === "kicked", "version refusal");
    expect(old.source.status()).toEqual({ kind: "kicked", reason: "version" });

    const one = client("LiveCarol"), two = client("LiveCarol");
    one.acquire();
    await until(() => joined(one), "Carol joins");
    two.acquire();
    await until(() => one.source.status().kind === "kicked" && joined(two), "the newer tab replaces the older");
    expect(one.source.status()).toEqual({ kind: "kicked", reason: "replaced" });
    one.rejoin();
    await until(() => joined(one) && two.source.status().kind === "kicked", "Play here takes it back");
    expect(two.source.status()).toEqual({ kind: "kicked", reason: "replaced" });

    let tokens = 0;
    const bad = client("x", { devName: null, token: async () => { tokens++; return "not-a-token"; } });
    bad.acquire();
    await until(() => bad.source.status().kind === "kicked", "auth refusal");
    expect(bad.source.status()).toEqual({ kind: "kicked", reason: "auth" });
    expect(tokens).toBe(2); // the one retry with a fresh token

    const foreign = client("LiveEve", { loadSdk: wrapped({ headers: { origin: "https://evil.example" } }) });
    foreign.acquire();
    await until(() => foreign.source.status().kind === "kicked", "origin refusal");
    expect(foreign.source.status()).toEqual({ kind: "kicked", reason: "origin" });
    expect(CLOSE.replaced).toBe(4104);
  }, 20_000);
});
