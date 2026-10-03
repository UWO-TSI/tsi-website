import { act, createElement } from "react";
import { reconciler } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AREAS, EV, PROTOCOL, RESTART_JITTER_MS, parseJoinOptions, type Area, type NetPlayer, type RosterEntry } from "./protocol";
import { createRemoteSample, type NetSource, type NetStatus } from "./types";
import {
  LEAVE_DELAY_MS, RECONNECT_TRIES, botsFromSearch, devNameFromSearch, loopbackStore, netMode, refCounted, resetNetStore, roomStore, useNetSource, useNetStatus,
  useRoster, type SdkCallbacks, type SdkModule, type SdkRoom,
} from "./netStore";
import { BURST_GAP_MS } from "./clock";
import { createLoopback } from "./loopback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Render on R3F's reconciler (no DOM), as lib/game/ruinsHand.test.tsx does. */
function mount(el: ReturnType<typeof createElement>) {
  const errors: unknown[] = [], err = (e: unknown) => { errors.push(e); };
  const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
  const root = create({}, 1, null, false, null, "", err, err, err, null);
  return {
    errors,
    render: (next: ReturnType<typeof createElement>) => act(async () => { reconciler.updateContainer(next, root, null, null); }),
    first: () => act(async () => { reconciler.updateContainer(el, root, null, null); }),
    unmount: () => act(async () => { reconciler.updateContainer(null, root, null, null); }),
  };
}
const withSearch = (search: string) => { (globalThis as { window?: unknown }).window = { location: { search } }; };

afterEach(() => {
  resetNetStore();
  delete (globalThis as { window?: unknown }).window;
  vi.useRealTimers();
});

describe("which source a page gets", () => {
  it("?bots=N in development gives the loopback; production and plain pages get nothing", () => {
    expect(netMode("?bots=12", true)).toEqual({ kind: "bots", bots: 12, seed: 1 });
    expect(netMode("?bots=12&seed=4", true)).toEqual({ kind: "bots", bots: 12, seed: 4 });
    expect(netMode("?bots=12", false)).toBeNull();
    expect(netMode("", true)).toBeNull();
    expect(botsFromSearch("?bots=65")).toBeNull();
  });
});

describe("acquire and release", () => {
  it("starts once, survives Strict Mode's remount and a scene swap, stops LEAVE_DELAY_MS after the last release", () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const life = refCounted(() => log.push("start"), () => log.push("stop"));
    life.acquire(); life.release(); life.acquire(); // Strict Mode: mount, unmount, mount
    expect(log).toEqual(["start"]);
    life.acquire(); // a second user
    life.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
    expect(log).toEqual(["start"]);
    life.release(); // the last
    vi.advanceTimersByTime(LEAVE_DELAY_MS - 1);
    expect(log).toEqual(["start"]);
    life.acquire(); // back inside the delay (a door's scene swap)
    vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
    expect(log).toEqual(["start"]);
    life.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);
    expect(log).toEqual(["start", "stop"]);
    life.release(); // an extra release changes nothing
    expect(life.refs).toBe(0);
    life.acquire();
    expect(log).toEqual(["start", "stop", "start"]);
  });
  it("the loopback store joins with the latest area and follows it", () => {
    vi.useFakeTimers();
    const lb = createLoopback({ bots: 3, timer: false, clock: () => 0 }), store = loopbackStore(lb);
    store.setArea("cafe");
    store.acquire();
    const me = () => lb.roster().find(e => e.uid === "local");
    expect(me()?.area).toBe(AREAS.indexOf("cafe"));
    store.setArea("hq");
    expect(me()?.area).toBe(AREAS.indexOf("hq"));
    store.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);
    expect(lb.status()).toEqual({ kind: "off" });
    expect(me()).toBeUndefined();
  });
});

describe("useNetSource, useNetStatus, useRoster", () => {
  let seen: { source: NetSource | null; status: NetStatus; roster: readonly RosterEntry[] }[] = [];
  function World({ ready, area = "village" }: { ready: boolean; area?: Area }) {
    const source = useNetSource({ area, ready }), status = useNetStatus(), roster = useRoster();
    seen.push({ source, status, roster });
    return null;
  }
  const last = () => seen[seen.length - 1];

  it("is null and creates nothing without ?bots (or a server)", async () => {
    withSearch("");
    seen = [];
    const m = mount(createElement(World, { ready: true }));
    await m.first();
    expect(last().source).toBeNull();
    expect(last().status).toEqual({ kind: "off" });
    expect(last().roster).toEqual([]);
    await m.unmount();
    expect(m.errors).toEqual([]);
  });

  it("with ?bots=N: the loopback once its code loads, joined while ready, following the area, off after the delay", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    withSearch("?bots=5");
    seen = [];
    const m = mount(createElement(World, { ready: false }));
    await m.first();
    await act(async () => { await vi.dynamicImportSettled(); });
    const source = last().source!;
    expect(source).not.toBeNull();
    expect(last().status).toEqual({ kind: "off" }); // not acquired until ready
    await m.render(createElement(World, { ready: true }));
    expect(last().status).toEqual({ kind: "joined", shard: 1 });
    expect(last().roster.find(e => e.uid === "local")?.area).toBe(AREAS.indexOf("village"));
    await m.render(createElement(World, { ready: true, area: "museum" }));
    expect(last().roster.find(e => e.uid === "local")?.area).toBe(AREAS.indexOf("museum"));
    // Nothing re-renders while bots move: the status and roster snapshots stay the same objects.
    const renders = seen.length;
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(seen.length).toBe(renders);
    await m.unmount();
    expect(source.status()).toEqual({ kind: "joined", shard: 1 });
    await act(async () => { vi.advanceTimersByTime(LEAVE_DELAY_MS); });
    expect(source.status()).toEqual({ kind: "off" });
    expect(m.errors).toEqual([]);
  });

  it("a second mount on the same page gets the same source", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    withSearch("?bots=2");
    seen = [];
    const a = mount(createElement(World, { ready: true }));
    await a.first();
    await act(async () => { await vi.dynamicImportSettled(); });
    const one = last().source;
    const b = mount(createElement(World, { ready: true }));
    await b.first();
    expect(last().source).toBe(one); // already loaded: no null first render
    await a.unmount();
    await b.unmount();
  });
});

// ── The Colyseus store, on a fake SDK ─────────────────────────────

type Fn = (...a: never[]) => void;
/** A schema map stand-in: entries by key, with forEach and size. */
class FakeMap<T> extends Map<string, T> {}
/** Callbacks.get(room) on the fake: listen / onAdd / onRemove / onChange over plain objects. */
class FakeCallbacks {
  props = new Map<string, Set<Fn>>();
  adds = new Map<string, Set<Fn>>();
  removes = new Map<string, Set<Fn>>();
  changes = new Map<object, Set<Fn>>();
  constructor(private readonly state: Record<string, unknown>) {}
  private on<K>(map: Map<K, Set<Fn>>, k: K, fn: Fn) {
    const set = map.get(k) ?? new Set();
    map.set(k, set);
    set.add(fn);
    return () => { set.delete(fn); };
  }
  listen(prop: string, cb: Fn) { const off = this.on(this.props, prop, cb); if (this.state[prop] !== undefined) (cb as (v: unknown) => void)(this.state[prop]); return off; }
  onAdd(coll: string, cb: Fn) { const off = this.on(this.adds, coll, cb); (this.state[coll] as FakeMap<unknown> | undefined)?.forEach((v, k) => (cb as (v: unknown, k: string) => void)(v, k)); return off; }
  onRemove(coll: string, cb: Fn) { return this.on(this.removes, coll, cb); }
  onChange(instance: object, cb: Fn) { return this.on(this.changes, instance, cb); }
  // The server's patches, as triggerChanges delivers them.
  set(prop: string, v: unknown) { this.state[prop] = v; for (const f of this.props.get(prop) ?? []) (f as (v: unknown) => void)(v); }
  add<T extends object>(coll: string, key: string, v: T) {
    const m = (this.state[coll] ??= new FakeMap<T>()) as FakeMap<T>;
    m.set(key, v);
    for (const f of this.adds.get(coll) ?? []) (f as (v: T, k: string) => void)(v, key);
  }
  patch<T extends object>(v: T, fields: Partial<T>) { Object.assign(v, fields); for (const f of this.changes.get(v) ?? []) (f as () => void)(); }
  remove(coll: string, key: string) {
    const m = this.state[coll] as FakeMap<object>, v = m.get(key)!;
    m.delete(key);
    for (const f of this.removes.get(coll) ?? []) (f as (v: object, k: string) => void)(v, key);
  }
}
class FakeRoom {
  sessionId = "me";
  state: Record<string, unknown> = {};
  cb = new FakeCallbacks(this.state);
  reconnection = { enabled: true, maxRetries: 15 };
  sent: [string, unknown][] = [];
  msg = new Map<string, (p: unknown) => void>();
  drops: ((code: number) => void)[] = [];
  reconnects: (() => void)[] = [];
  leaves: ((code: number) => void)[] = [];
  send(type: string, payload?: unknown) { this.sent.push([type, JSON.parse(JSON.stringify(payload ?? null))]); }
  leave() { this.close(4000); return Promise.resolve(4000); }
  onMessage(type: string, cb: (p: unknown) => void) { this.msg.set(type, cb); return () => {}; }
  onDrop(cb: (code: number) => void) { this.drops.push(cb); }
  onReconnect(cb: () => void) { this.reconnects.push(cb); }
  onLeave(cb: (code: number) => void) { this.leaves.push(cb); }
  onError() {}
  // What the SDK does: a drop goes to onDrop, then its own reconnect unless disabled (then straight to onLeave).
  drop(code: number) { for (const f of this.drops) f(code); if (!this.reconnection.enabled) this.close(code); }
  reconnected() { for (const f of this.reconnects) f(); }
  close(code: number) { const ls = this.leaves; this.leaves = []; for (const f of ls) f(code); }
  sentOf(type: string) { return this.sent.filter(([t]) => t === type).map(([, p]) => p); }
}

/** The store on a fake SDK, a hand-driven wall clock and timers. */
function roomRig(o: { joins?: (FakeRoom | { code: unknown })[]; token?: (refresh: boolean) => Promise<string | null>; devName?: string | null } = {}) {
  let wall = 1_791_000_000_000;
  const timers: { at: number; fn: () => void }[] = [], clients: { options: unknown; credentials: unknown; token: unknown }[] = [], rooms: FakeRoom[] = [];
  const windowFns = new Map<string, (e: Event) => void>(), applied: number[] = [], tokens: boolean[] = [];
  const joins = [...(o.joins ?? [])];
  const sdk: SdkModule = {
    Client: class {
      http = { options: {} as { credentials?: RequestCredentials } };
      auth = { token: undefined as string | undefined };
      constructor(readonly url: string) {}
      async joinOrCreate(_name: string, options: unknown) {
        clients.push({ options, credentials: this.http.options.credentials, token: this.auth.token });
        const next = joins.shift() ?? new FakeRoom();
        if (!(next instanceof FakeRoom)) throw Object.assign(new Error("refused"), next);
        rooms.push(next);
        return next as unknown as SdkRoom;
      }
    } as unknown as SdkModule["Client"],
    Callbacks: { get: (room: SdkRoom) => (room as unknown as FakeRoom).cb as unknown as SdkCallbacks },
  };
  const store = roomStore({
    url: "ws://localhost:2567", devName: o.devName ?? null,
    loadSdk: async () => sdk,
    token: async refresh => { tokens.push(refresh); return o.token ? o.token(refresh) : "jwt"; },
    wall: () => wall,
    later: (fn, ms) => { const t = { at: wall + ms, fn }; timers.push(t); return () => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); }; },
    random: () => 0.5,
    applyWorld: ms => applied.push(ms),
    previewActive: () => false,
    listen: (type, fn) => { windowFns.set(type, fn); return () => windowFns.delete(type); },
  });
  const settle = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
  /** Advance the wall clock, firing due timers (and answering pings: the server is 300 ms ahead, 20 ms away). */
  const advance = async (ms: number) => {
    const end = wall + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a.at - b.at)[0];
      if (!next || next.at > end) break;
      wall = next.at;
      timers.splice(timers.indexOf(next), 1);
      next.fn();
      await settle();
    }
    wall = end;
    await settle();
  };
  const pong = (room: FakeRoom) => {
    for (const p of room.sentOf("ping")) room.msg.get("pong")?.([(p as number[])[0], (p as number[])[0] + 20 + 300]);
  };
  /** Join the latest room: the state's epoch arrives, a pong comes back. */
  const join = async (room = rooms[rooms.length - 1]) => {
    room.cb.set("shard", 1);
    room.cb.set("epoch", wall - 60_000);
    await settle();
    pong(room);
    return room;
  };
  return { store, src: store.source, clients, rooms, timers, windowFns, applied, tokens, settle, advance, join, pong, wall: () => wall };
}
const player = (sid: number, over: Partial<NetPlayer> = {}): NetPlayer => ({
  sid, uid: `u-${sid}`, name: `Pebble ${sid}`, badge: 1, look: "", level: 3, family: 0, kit: "", mastery: 0, aura: "", frame: 0,
  area: 0, flags: 0, held: "", weapon: "", pose: "", seat: "", study: 0, studyEnds: 0,
  t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, move: 0, air: 0, leaf: 0, lift: 0, tp: 0, ...over,
});

describe("the Colyseus store", () => {
  it("joins with the contract's options, credentials omitted, the token as bearer; joined once the epoch arrives", async () => {
    const r = roomRig();
    r.store.setArea("cafe");
    r.store.setShowClass!(false);
    expect(r.src.status()).toEqual({ kind: "off" });
    r.store.acquire();
    expect(r.src.status()).toEqual({ kind: "connecting" });
    await r.settle();
    expect(r.clients).toHaveLength(1);
    expect(r.clients[0]).toEqual({ options: { v: PROTOCOL, area: AREAS.indexOf("cafe"), mobile: false, showClass: false }, credentials: "omit", token: "jwt" });
    expect(parseJoinOptions(r.clients[0].options)).toEqual(r.clients[0].options);
    expect(r.src.status()).toEqual({ kind: "connecting" }); // the state hasn't come yet
    const room = await r.join();
    expect(r.src.status()).toEqual({ kind: "joined", shard: 1 });
    expect(room.reconnection.maxRetries).toBe(RECONNECT_TRIES);
    expect(r.src.joinSeq).toBe(1);
    expect(room.sentOf("s")).toEqual([]); // nothing to resend: the join had it all
  });

  it("dev tokens: dev:<name> from ?mp=dev&as=Name, outside production only", async () => {
    expect(devNameFromSearch("?mp=dev&as=Alice")).toBe("Alice");
    for (const s of ["?as=Alice", "?mp=dev", "?mp=dev&as=a b", "?mp=x&as=Alice"]) expect(devNameFromSearch(s), s).toBeNull();
    expect(netMode("?mp=dev&as=Alice", true, "ws://x")).toEqual({ kind: "room", url: "ws://x", devName: "Alice" });
    expect(netMode("?mp=dev&as=Alice", false, "wss://x")).toEqual({ kind: "room", url: "wss://x", devName: null });
    expect(netMode("?bots=3", true, "ws://x")).toEqual({ kind: "bots", bots: 3, seed: 1 });
    expect(netMode("", true, "")).toBeNull();
  });

  it("signed out is solo: no join at all", async () => {
    const r = roomRig({ token: async () => null });
    r.store.acquire();
    await r.settle();
    expect(r.clients).toHaveLength(0);
    expect(r.src.status()).toEqual({ kind: "off" });
  });

  it("pings at join, sends poses once the clock has the server's time, and gives the world clock the offset", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    const room = r.rooms[0];
    room.cb.set("epoch", r.wall() - 60_000);
    expect(room.sentOf("ping")).toHaveLength(1);
    r.src.sendPose([1, 2, 3]);
    expect(room.sentOf("p")).toEqual([]); // no clock yet
    r.pong(room);
    r.src.sendPose([1, 2, 3]);
    expect(room.sentOf("p")).toEqual([[1, 2, 3]]);
    expect(r.applied).toEqual([320]); // the fake server reads 320 ms ahead when it answers (at once)
    expect(r.src.now()).toBeCloseTo(60_000 + 320, 0);
    await r.advance(BURST_GAP_MS * 4 + 10);
    expect(room.sentOf("ping")).toHaveLength(5);
  });

  it("leaves the world clock to a dev ?at= preview (the page's own check), while room time still follows the server", async () => {
    withSearch("?at=21:30");
    const pings: number[][] = [], applied: number[] = [];
    let wall = 1_791_000_000_000;
    const room = new FakeRoom();
    const store = roomStore({
      url: "ws://x", devName: "Alice", wall: () => wall, later: () => () => {}, applyWorld: ms => applied.push(ms), listen: () => () => {},
      loadSdk: async () => ({
        Client: class { http = { options: {} }; auth = { token: undefined }; async joinOrCreate() { return room; } },
        Callbacks: { get: () => room.cb },
      }) as unknown as SdkModule,
    });
    store.acquire();
    await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
    room.cb.set("epoch", wall - 1000);
    for (const p of room.sentOf("ping")) pings.push(p as number[]);
    wall += 40;
    room.msg.get("pong")?.([pings[0][0], pings[0][0] + 20 + 5000]);
    expect(applied).toEqual([]);
    expect(store.source.now()).toBeCloseTo(1000 + 40 + 5000, 0);
    store.source.leave();
  });

  it("feeds the registry from the schema: a player with motion shows, one without waits for it; card changes, removal, events", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    const room = await r.join();
    const changes: string[] = [];
    r.src.remotes.subscribe((c, e) => changes.push(`${c}:${e.sid}`));
    const a = player(4, { t: 1000, x: 150 }), b = player(5);
    room.cb.add("players", "s-a", a);
    room.cb.add("players", "s-b", b);
    expect(r.src.remotes.size).toBe(1);
    expect(r.src.remotes.get(4)?.samples).toBe(1);
    room.cb.patch(b, { t: 1100, x: 300 });
    expect(r.src.remotes.size).toBe(2);
    room.cb.patch(a, { t: 1100, x: 160 });
    expect(r.src.remotes.get(4)?.samples).toBe(2);
    room.cb.patch(a, { held: "rod:rod_flimsy" });
    expect(r.src.remotes.get(4)?.player.held).toBe("rod:rod_flimsy");
    room.cb.patch(a, { held: "rod:rod_flimsy" }); // no change: no news
    room.msg.get("e")?.([4, 1050, EV.play, "Wave"]);
    room.msg.get("e")?.([77, 1050, EV.play, "Wave"]); // nobody in view: ignored
    const out = createRemoteSample();
    let fired = 0;
    for (let i = 0; i < 100; i++) { await r.advance(16); r.src.remotes.get(4)!.sample(r.src.now(), out); fired += out.eventCount; }
    expect(fired).toBe(1);
    room.cb.remove("players", "s-a");
    expect(r.src.remotes.get(4)).toBeUndefined();
    expect(changes).toEqual(["add:4", "add:5", "change:4", "remove:4"]);
  });

  it("keeps the roster: everyone, you included, a new array only when it changes", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    const room = await r.join();
    let heard = 0;
    r.src.subscribe(() => heard++);
    const me = { uid: "u-me", name: "Me", badge: 1, area: 0, flags: 0 }, other = { uid: "u-2", name: "Juniper", badge: 0, area: 1, flags: 4 };
    room.cb.add("roster", "me", me);
    room.cb.add("roster", "s2", other);
    const list = r.src.roster();
    expect(list).toEqual([me, other]);
    room.cb.patch(other, { area: 0 });
    expect(r.src.roster()).not.toBe(list);
    expect(r.src.roster()[1].area).toBe(0);
    room.cb.remove("roster", "s2");
    expect(r.src.roster()).toEqual([me]);
    expect(heard).toBe(4);
  });

  it("owns the area: sends it when it changes, the latest after a join that raced a change, and drops poses in a private one", async () => {
    const r = roomRig();
    r.store.setArea("village");
    r.store.acquire();
    await r.settle();
    expect((r.clients[0].options as { area: number }).area).toBe(AREAS.indexOf("village"));
    r.store.setArea("hq"); // through a door while the join is in flight (the room's state not here yet)
    const room = await r.join();
    expect(room.sentOf("s")).toEqual([{ area: AREAS.indexOf("hq") }]);
    expect(r.src.areaSeq).toBe(1);
    r.store.setArea("hq");
    r.store.setArea("ruins");
    expect(room.sentOf("s")).toEqual([{ area: AREAS.indexOf("hq") }, { area: AREAS.indexOf("ruins") }]);
    r.src.sendPose([9]);
    expect(room.sentOf("p")).toEqual([]);
    r.store.setShowClass!(false);
    expect(room.sentOf("s").at(-1)).toEqual({ showClass: false });
  });

  it("refusals: 401 refreshes the token and retries once, then stays off; 403, 4102, 4106 stay off with the reason", async () => {
    const twice = roomRig({ joins: [{ code: 401 }, { code: 401 }] });
    twice.store.acquire();
    await twice.settle();
    await twice.advance(0);
    expect(twice.tokens).toEqual([false, true]);
    expect(twice.src.status()).toEqual({ kind: "kicked", reason: "auth" });
    const once = roomRig({ joins: [{ code: 4101 }] });
    once.store.acquire();
    await once.settle();
    await once.advance(0);
    await once.join();
    expect(once.src.status()).toEqual({ kind: "joined", shard: 1 });
    for (const [code, reason] of [[403, "origin"], [4102, "removed"], [4106, "version"]] as const) {
      const r = roomRig({ joins: [{ code }] });
      r.store.acquire();
      await r.settle();
      expect(r.src.status(), `${code}`).toEqual({ kind: "kicked", reason });
      await r.advance(60_000);
      expect(r.clients).toHaveLength(1);
    }
  });

  it("busy (4107) and dropped connections back off 2, 4, 8, 16, 30, 30 s; a join resets it", async () => {
    const r = roomRig({ joins: [{ code: 4107 }, { code: 4002 }, { code: "ECONNREFUSED" }, { code: 503 }, { code: 4107 }, { code: 4107 }] });
    r.store.acquire();
    await r.settle();
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const s = r.src.status();
      expect(s.kind).toBe("offline");
      waits.push(Math.round(((s as { retryAt: number }).retryAt - Date.now()) / 1000));
      await r.advance((s as { retryAt: number }).retryAt - Date.now() + 5);
    }
    expect(waits).toEqual([2, 4, 8, 16, 30, 30]);
    await r.join();
    expect(r.src.status()).toEqual({ kind: "joined", shard: 1 });
  });

  it("closes while joined: 4104 waits for rejoin() (Play here), 4103 stays off, 4010 rejoins after jitter", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    const room = await r.join();
    room.cb.add("players", "s-a", player(4, { t: 10 }));
    room.close(4104);
    expect(r.src.status()).toEqual({ kind: "kicked", reason: "replaced" });
    expect(r.src.remotes.size).toBe(0);
    await r.advance(60_000);
    expect(r.clients).toHaveLength(1);
    r.store.rejoin!();
    await r.settle();
    const second = await r.join();
    expect(r.src.status()).toEqual({ kind: "joined", shard: 1 });
    expect(r.src.joinSeq).toBe(2);
    second.close(4103);
    expect(r.src.status()).toEqual({ kind: "kicked", reason: "kicked" });
    r.store.rejoin!();
    await r.settle();
    const third = await r.join();
    third.drop(4010); // a restart: the SDK's own reconnect is off, the store rejoins within RESTART_JITTER_MS
    expect(third.reconnection.enabled).toBe(false);
    const s = r.src.status() as { kind: string; retryAt: number };
    expect(s.kind).toBe("offline");
    expect(s.retryAt - Date.now()).toBeLessThanOrEqual(RESTART_JITTER_MS);
    await r.advance(RESTART_JITTER_MS);
    expect(r.clients).toHaveLength(4);
  });

  it("a dropped socket: reconnecting while the SDK retries, joined again with the latest area; past the grace, a fresh join", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    const room = await r.join();
    room.drop(1006);
    expect(r.src.status()).toEqual({ kind: "reconnecting" });
    r.store.setArea("museum");
    room.reconnected();
    expect(r.src.status()).toEqual({ kind: "joined", shard: 1 });
    expect(room.sentOf("s")).toEqual([{ area: AREAS.indexOf("museum") }]);
    room.drop(1006);
    room.close(4003); // the SDK gave up
    expect(r.src.status().kind).toBe("offline");
    await r.advance(2100);
    expect(r.clients).toHaveLength(2);
    expect((r.clients[1].options as { area: number }).area).toBe(AREAS.indexOf("museum"));
  });

  it("leaves after the last release (its own leave: no retry), and on pagehide; back from the bfcache it joins again", async () => {
    const r = roomRig();
    r.store.acquire();
    await r.settle();
    await r.join();
    vi.useFakeTimers();
    r.store.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);
    vi.useRealTimers();
    expect(r.src.status()).toEqual({ kind: "off" });
    await r.advance(60_000);
    expect(r.clients).toHaveLength(1);
    r.store.acquire();
    await r.settle();
    await r.join();
    r.windowFns.get("pagehide")!(new Event("pagehide"));
    expect(r.src.status()).toEqual({ kind: "off" });
    r.windowFns.get("pageshow")!(Object.assign(new Event("pageshow"), { persisted: true }));
    await r.settle();
    expect(r.clients).toHaveLength(3);
  });
});
