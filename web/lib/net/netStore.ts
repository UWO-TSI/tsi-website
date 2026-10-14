"use client";

/**
 * The network store (specs/multiplayer.md §5.1, §2.1, §3, §4.7): one NetSource per page, whichever component mounts it.
 *
 * - **Which source:** the Colyseus room when `NEXT_PUBLIC_REALTIME_URL` is set; in development the `?bots=N` loopback
 *   (loopback.ts, lazy-loaded so no production bundle carries the bots); otherwise none, and multiplayer is off.
 * - **One per page:** a module singleton kept on `globalThis`, so Strict Mode's double mount and Fast Refresh find the
 *   same store rather than opening a second connection.
 * - **Acquire and release:** `useNetSource` acquires while `ready` and releases on unmount; the last release leaves
 *   after LEAVE_DELAY_MS, so a remount or a scene change inside it never drops the connection.
 * - **The area is the store's:** it joins with the current one, follows changes, and re-sends the latest after a
 *   reconnect or a rejoin, an area changed while connecting included. NetWorld never sends `area` itself. So is
 *   "show class on my nameplate" (hudPrefs): in the join, then `s {showClass}` on change.
 * - **React reads** `useNetStatus()` and `useRoster()` through useSyncExternalStore: they re-render only when the status
 *   or the roster changes, never per frame.
 *
 * The Colyseus store (§2.1, §3): the SDK is imported on the first connect. `client.http.options.credentials = "omit"`
 * right after `new Client(...)` (the room never allows credentials). The token is the Supabase session's access token
 * (refreshed when it expires within a minute), or `dev:<name>` with `?mp=dev&as=Name` outside production. Then
 * `joinOrCreate("island", { v, area, mobile, showClass })`. The status is `joined` once the room's epoch has arrived.
 * Schema callbacks feed the remote registry (players, by their motion `t` and their card and slow fields) and the
 * roster; `e` events go to the remote they name; pongs feed the clock (clock.ts). Refusals and closes go through the
 * contract's joinRefusal: 401/4101 refresh the token and retry once, 4107 and dropped connections back off
 * (2/4/8/16/30 s; the SDK's own reconnect gets the server's 20 s grace first), 4010 rejoins after a random 0–3 s, and the
 * rest stay off with a reason (`rejoin()` is "Play here" after 4104). `pagehide` leaves; a hidden tab stays connected.
 */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useShowClass } from "@/lib/game/hudPrefs";
import { setWorldClockOffset } from "@/lib/game/worldClock";
import { parseClockOverride } from "@/lib/game/islandTime";
import {
  AREAS, CHAT, DEV_TOKEN_PREFIX, MSG, NET_PLAYER_FIELDS, PROTOCOL, RECONNECT_GRACE_S, REJOIN_BACKOFF_S, RESTART_JITTER_MS, ROOM_NAME, decodeEvent, isPrivateArea,
  joinRefusal, parseChatLine, parseFollowAnswer, parseFriends, parsePong, parseSys, type Area, type FollowRefusal, type NetPlayer, type PosePacket, type RosterEntry,
  type SeatReservation, type SlowState, type SysMessage,
} from "./protocol";
import { chatStore, type ChatStore } from "./chat";
import { friendsStore, type FriendsStore } from "./friends";
import { toRemotePlayer, type FollowResult, type KickReason, type NetSource, type NetStatus } from "./types";
import { RemoteBuffer, Remotes, parseNetsim, type Netsim } from "./interp";
import { NetClock } from "./clock";

const DEV = process.env.NODE_ENV !== "production";
/** The last release leaves after this long (ms): Strict Mode's remount and a door's scene swap re-acquire inside it. */
export const LEAVE_DELAY_MS = 2000;
/**
 * The SDK's own reconnect tries: as many as its backoff (100 × 2^n ms, 5 s at most) fits in the room's reconnection
 * grace for a desktop (RECONNECT_GRACE_S), after which a fresh join takes over.
 */
export const RECONNECT_TRIES = (() => {
  let n = 0, total = 0;
  while (total < RECONNECT_GRACE_S.desktop * 1000) total += Math.min(5000, Math.max(100, 100 * 2 ** ++n));
  return n;
})();

/** A source with its lifetime: what `useNetSource` drives. */
export interface NetStore {
  readonly source: NetSource;
  acquire(): void;
  release(): void;
  /** The scene you're in; the store sends it when it changes (and after any rejoin). */
  setArea(area: Area): void;
  /** "Show class on my nameplate" (hudPrefs). */
  setShowClass?(on: boolean): void;
  /** Join again after a refusal that keeps you off ("Play here" after 4104). */
  rejoin?(): void;
}

/** At most this many bots. */
export const MAX_BOTS = 64;
/** `?bots=N` (and `?seed=`): the loopback's options, or null without a valid count. */
export function botsFromSearch(search: string): { bots: number; seed: number } | null {
  const q = new URLSearchParams(search), raw = q.get("bots"), n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0 || n > MAX_BOTS) return null;
  const seed = Number(q.get("seed") ?? 1);
  return { bots: n, seed: Number.isInteger(seed) ? seed : 1 };
}
/** `?mp=dev&as=Name`: a dev token's name (the server's DEV_AUTH), or null. */
export function devNameFromSearch(search: string): string | null {
  const q = new URLSearchParams(search), name = q.get("as");
  return q.get("mp") === "dev" && name && /^[A-Za-z0-9_-]{1,24}$/.test(name) ? name : null;
}

/** Where a page's multiplayer comes from: the dev loopback, the room, or nothing. */
export type NetMode = { kind: "bots"; bots: number; seed: number } | { kind: "room"; url: string; devName: string | null } | null;
export function netMode(search: string, dev = DEV, url = process.env.NEXT_PUBLIC_REALTIME_URL): NetMode {
  const bots = dev ? botsFromSearch(search) : null;
  if (bots) return { kind: "bots", ...bots };
  if (url) return { kind: "room", url, devName: dev ? devNameFromSearch(search) : null };
  return null;
}

/**
 * Acquire and release with a count and a delayed stop: `start` on the first acquire, `stop` LEAVE_DELAY_MS after the
 * last release unless something acquires again first.
 */
export function refCounted(start: () => void, stop: () => void, delay = LEAVE_DELAY_MS) {
  let refs = 0, running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    acquire() {
      refs++;
      if (timer) { clearTimeout(timer); timer = null; }
      if (!running) { running = true; start(); }
    },
    release() {
      if (refs === 0) return;
      if (--refs > 0) return;
      timer = setTimeout(() => {
        timer = null;
        if (refs === 0 && running) { running = false; stop(); }
      }, delay);
    },
    get refs() { return refs; },
    get running() { return running; },
  };
}

/** The loopback as a store: started on the first acquire with the latest area, stopped after the last release. */
export function loopbackStore(lb: { start(area: Area): void; stop(): void; setArea(area: Area): void } & NetSource): NetStore {
  let area: Area = "village", started = false;
  const life = refCounted(() => { started = true; lb.start(area); }, () => { started = false; lb.stop(); });
  return {
    source: lb,
    acquire: life.acquire,
    release: life.release,
    setArea(next) {
      area = next;
      if (started) lb.setArea(next);
    },
    rejoin() { if (life.running && lb.status().kind !== "joined") lb.start(area); },
  };
}

// ── The Colyseus room ─────────────────────────────────────────────

/** The parts of @colyseus/sdk the store uses (tests give it a fake). */
export interface SdkRoom {
  readonly sessionId: string;
  readonly roomId: string;
  readonly state: unknown;
  reconnection: { enabled: boolean; maxRetries: number };
  send(type: string, payload?: unknown): void;
  leave(consented?: boolean): Promise<number>;
  onMessage(type: string, cb: (payload: unknown) => void): () => void;
  onDrop(cb: (code: number, reason?: string) => void): unknown;
  onReconnect(cb: () => void): unknown;
  onLeave(cb: (code: number, reason?: string) => void): unknown;
  onError(cb: (code: number, message?: string) => void): unknown;
}
export interface SdkClient {
  http: { options: { credentials?: RequestCredentials } };
  auth: { token: string | undefined };
  joinOrCreate(name: string, options: unknown): Promise<SdkRoom>;
  /** A seat the server reserved (v1: a friend's shard). */
  consumeSeatReservation(seat: SeatReservation): Promise<SdkRoom>;
}
/** The schema's callbacks (Callbacks.get(room)). */
export interface SdkCallbacks {
  listen(property: string, cb: (value: never, previous: never) => void): () => void;
  onAdd(collection: string, cb: (value: never, key: string) => void): () => void;
  onRemove(collection: string, cb: (value: never, key: string) => void): () => void;
  onChange(instance: object, cb: () => void): () => void;
}
export interface SdkModule {
  Client: new (url: string) => SdkClient;
  Callbacks: { get(room: SdkRoom): SdkCallbacks };
}

/** The room's state as reflection decodes it (protocol.ts IslandState, read without @colyseus/schema). */
interface StateLike {
  epoch?: number;
  shard?: number;
  roster?: { forEach(fn: (e: RosterEntry, key: string) => void): void };
}

export interface RoomStoreOptions {
  url: string;
  devName: string | null;
  netsim?: Netsim | null;
  /** The SDK, imported on the first connect. */
  loadSdk?: () => Promise<SdkModule>;
  /** Your access token (`refresh`: get a fresh one), null when signed out. */
  token?: (refresh: boolean) => Promise<string | null>;
  /** Wall clock (ms since the epoch, sub-millisecond). */
  wall?: () => number;
  later?: (fn: () => void, ms: number) => () => void;
  random?: () => number;
  applyWorld?: (offsetMs: number) => void;
  previewActive?: () => boolean;
  /** Listen on the window; returns the unlisten. */
  listen?: (type: string, fn: (e: Event) => void) => () => void;
  /** Where `line`s and refusals go (the page's chat store by default). */
  chat?: ChatStore;
  /** Where the friends' presence goes (the page's friends store by default). */
  friends?: FriendsStore;
}
/** How long a `follow` waits for the room's answer before giving up (busy). */
export const FOLLOW_WAIT_MS = 8000;

/** The room's NetSource, with the sender's hints (sender.ts SenderHints), the last restart notice and the chat. */
export interface RoomSource extends NetSource {
  readonly remotes: Remotes;
  readonly joinSeq: number;
  readonly areaSeq: number;
  readonly epoch: number;
  /** The last `sys` that isn't a chat refusal (a restart's notice), for the HUD. Refusals go to the chat store. */
  readonly sys: Exclude<SysMessage, { kind: "refused" }> | null;
  /** Your room's id (a report's context), null while not in one. */
  readonly roomId: string | null;
  readonly chat: ChatStore;
  /** Say a line (trimmed, at most CHAT.maxLength): false when there's nothing to say or no room to say it in. */
  sendChat(text: string): boolean;
  /** The "…" over you while you write (`s {typing}`). */
  sendTyping(on: boolean): void;
  /** Join a friend's shard: the room reserves a seat there, and the store moves you into it. */
  follow(uid: string): Promise<FollowResult>;
}

/** The slow and card fields of a schema player: a change among them replaces the remote's `player`. */
const CARD_FIELDS = NET_PLAYER_FIELDS.map(([f]) => f).filter(f => !["sid", "uid", "t", "x", "y", "z", "vx", "vy", "vz", "yaw", "move", "air", "leaf", "lift", "tp"].includes(f)) as (keyof NetPlayer)[];

/** Your access token from the Supabase browser session, refreshed when it expires within a minute (or when asked). */
async function supabaseToken(refresh: boolean): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const auth = createClient().auth;
    let session = (await auth.getSession()).data.session;
    if (session && (refresh || (session.expires_at ?? 0) * 1000 - Date.now() < 60_000)) session = (await auth.refreshSession()).data.session;
    return session?.access_token ?? null;
  } catch {
    return null; // no Supabase here (blank env): solo
  }
}
const wallClock = () => (typeof performance !== "undefined" && performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now());
const windowListen = (type: string, fn: (e: Event) => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(type, fn);
  return () => window.removeEventListener(type, fn);
};

/** The Colyseus room as a store (see the header). */
export interface RoomStore extends NetStore {
  readonly source: RoomSource;
  setShowClass(on: boolean): void;
  rejoin(): void;
}
export function roomStore(o: RoomStoreOptions): RoomStore {
  const loadSdk = o.loadSdk ?? (() => import("@colyseus/sdk") as unknown as Promise<SdkModule>);
  const token = o.token ?? (o.devName ? async () => `${DEV_TOKEN_PREFIX}${o.devName}` : supabaseToken);
  const wall = o.wall ?? wallClock;
  const later = o.later ?? ((fn: () => void, ms: number) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); });
  const random = o.random ?? Math.random;
  const listen = o.listen ?? windowListen;
  const chat = o.chat ?? chatStore();
  const friends = o.friends ?? friendsStore();
  /** The `follow` waiting for its answer, by uid. */
  const asking = new Map<string, { done: (r: FollowResult) => void; cancel: () => void; area: Area }>();
  const remotes = new Remotes();
  const listeners = new Set<() => void>();
  let status: NetStatus = { kind: "off" };
  let roster: readonly RosterEntry[] = [];
  let area: Area = "village", serverArea: Area | null = null;
  let showClass = true, serverShowClass: boolean | null = null;
  let room: SdkRoom | null = null, connecting = false, wanted = false, ownLeave = false, pageGone = false;
  let attempt = 0, tokenRetried = false, refresh = false, cancelRetry: (() => void) | null = null;
  let joinSeq = 0, areaSeq = 0, epoch = 0, shard = 0;
  /** The connection the callbacks belong to: callbacks from an old one are ignored. */
  let generation = 0;
  const players = new Map<string, { entry: RemoteBuffer; p: NetPlayer; lastT: number; card: Partial<NetPlayer>; shown: boolean; off: () => void }>();
  const rosterWatch = new Map<string, () => void>();
  const clock = new NetClock({
    wall,
    ping: clientMs => room?.send(MSG.ping, [clientMs]),
    applyWorld: o.applyWorld ?? setWorldClockOffset,
    previewActive: o.previewActive ?? (() => DEV && typeof window !== "undefined" && parseClockOverride(new URLSearchParams(window.location.search)) !== null),
    later,
  });
  let lastSys: Exclude<SysMessage, { kind: "refused" }> | null = null;

  const emit = () => { for (const l of listeners) l(); };
  const setStatus = (next: NetStatus) => { status = next; emit(); };
  const roomNow = () => clock.serverNow() - epoch;

  function rebuildRoster(state: StateLike) {
    const list: RosterEntry[] = [];
    state.roster?.forEach((e, key) => {
      list.push({ uid: e.uid, name: e.name, badge: e.badge, area: e.area, flags: e.flags });
      // Your own entry (keyed by your session): your lines are yours in the chat.
      if (key === room?.sessionId) chat.setSelf(e.uid);
    });
    roster = list;
    emit();
  }

  function joinedIfReady(state: StateLike) {
    if (!room || status.kind === "joined" || !(state.epoch && state.epoch > 0)) return;
    epoch = state.epoch;
    shard = state.shard ?? 0;
    attempt = 0;
    tokenRetried = false;
    joinSeq++;
    setStatus({ kind: "joined", shard });
    // The area may have changed while the join was in flight: send the latest.
    sendArea();
    sendShowClass();
  }
  function sendArea() {
    if (!room || status.kind !== "joined" || area === serverArea) return;
    room.send(MSG.slow, { area: AREAS.indexOf(area) } satisfies SlowState);
    serverArea = area;
    areaSeq++;
    if (isPrivateArea(area)) remotes.clear();
  }
  function sendShowClass() {
    if (!room || status.kind !== "joined" || showClass === serverShowClass) return;
    room.send(MSG.slow, { showClass } satisfies SlowState);
    serverShowClass = showClass;
  }

  function onPlayer(cb: SdkCallbacks, gen: number, state: StateLike, p: NetPlayer, key: string) {
    if (gen !== generation) return;
    players.get(key)?.off();
    const at = () => state.epoch || epoch;
    const entry = new RemoteBuffer(p.sid, toRemotePlayer(p, at()), o.netsim ?? null);
    const card: Partial<NetPlayer> = {};
    for (const f of CARD_FIELDS) (card as Record<string, unknown>)[f] = p[f];
    const rec = { entry, p, lastT: p.t, card, shown: false, off: () => {} };
    players.set(key, rec);
    // Someone who never sent a pose has no place yet: they join the view with their first sample.
    if (p.t > 0) { entry.pushWire(p, roomNow()); remotes.add(entry); rec.shown = true; }
    rec.off = cb.onChange(p, () => {
      if (gen !== generation || players.get(key) !== rec) return;
      const now = roomNow();
      if (p.t !== rec.lastT) {
        rec.lastT = p.t;
        entry.pushWire(p, now);
        if (!rec.shown) { remotes.add(entry); rec.shown = true; }
      }
      let changed = false;
      for (const f of CARD_FIELDS) if (rec.card[f] !== p[f]) { (rec.card as Record<string, unknown>)[f] = p[f]; changed = true; }
      if (changed) {
        entry.setPlayer(toRemotePlayer(p, at()), now);
        if (rec.shown) remotes.changed(entry);
      }
    });
  }
  function offPlayer(gen: number, key: string) {
    if (gen !== generation) return;
    const rec = players.get(key);
    if (!rec) return;
    players.delete(key);
    rec.off();
    if (rec.shown) remotes.remove(rec.entry.sid);
  }

  function attach(r: SdkRoom, sdk: SdkModule, joinedArea: Area, joinedShowClass: boolean) {
    const gen = ++generation;
    room = r;
    serverArea = joinedArea;
    serverShowClass = joinedShowClass;
    r.reconnection.maxRetries = RECONNECT_TRIES;
    const state = r.state as StateLike, cb = sdk.Callbacks.get(r);
    cb.listen("epoch", () => { if (gen === generation) joinedIfReady(state); });
    cb.onAdd("players", (p: NetPlayer, key) => onPlayer(cb, gen, state, p, key));
    cb.onRemove("players", (_p: NetPlayer, key) => offPlayer(gen, key));
    cb.onAdd("roster", (e: RosterEntry, key) => {
      if (gen !== generation) return;
      rosterWatch.get(key)?.();
      rosterWatch.set(key, cb.onChange(e, () => { if (gen === generation) rebuildRoster(state); }));
      rebuildRoster(state);
    });
    cb.onRemove("roster", (_e: RosterEntry, key) => {
      if (gen !== generation) return;
      rosterWatch.get(key)?.();
      rosterWatch.delete(key);
      rebuildRoster(state);
    });
    const scratch = { sid: 0, t: 0, kind: 0, value: 0 as number | string };
    r.onMessage(MSG.event, msg => {
      const e = decodeEvent(msg, scratch);
      if (e) remotes.get(e.sid)?.pushEvent(e.t, e.kind, e.value, roomNow());
    });
    r.onMessage(MSG.pong, msg => { const p = parsePong(msg); if (p) clock.onPong(p); });
    // v1 friends: who's on the island (the first list after this join is quiet), and the answer to a `follow`.
    friends.connected();
    r.onMessage(MSG.friends, msg => { const list = parseFriends(msg); if (list && gen === generation) friends.setOnline(list); });
    r.onMessage(MSG.follow, msg => {
      const a = parseFollowAnswer(msg);
      if (!a || gen !== generation) return;
      const wait = asking.get(a.uid);
      if (!wait) return;
      asking.delete(a.uid);
      wait.cancel();
      if ("refused" in a) wait.done({ ok: false, reason: a.refused });
      else void move(sdk, a.seat, wait.area).then(ok => wait.done(ok ? { ok: true } : { ok: false, reason: "busy" }));
    });
    // A chat line (yours too: your copy is the acceptance) and a refused one go to the chat; a restart's notice stays here.
    r.onMessage(MSG.line, msg => { const l = parseChatLine(msg); if (l) chat.receive(l); });
    r.onMessage(MSG.sys, msg => {
      const m = parseSys(msg);
      if (m?.kind === "refused") chat.refused(m.reason, m.text);
      else if (m) lastSys = m;
    });
    r.onDrop(code => {
      if (gen !== generation) return;
      // A restart (4010): the SDK would try the old process; rejoin after jitter instead (joinRefusal "restart").
      if (code === 4010) { r.reconnection.enabled = false; return; }
      setStatus({ kind: "reconnecting" });
    });
    r.onReconnect(() => {
      if (gen !== generation) return;
      setStatus({ kind: "joined", shard });
      sendArea();
      sendShowClass();
    });
    r.onLeave(code => { if (gen === generation) closed(code); });
    r.onError(() => {});
    clock.start();
    joinedIfReady(state);
  }

  /** Drop the room's state: views, roster, clock, friends' presence. */
  function detach() {
    generation++;
    room = null;
    clock.stop();
    friends.offline();
    for (const rec of players.values()) rec.off();
    for (const off of rosterWatch.values()) off();
    players.clear();
    rosterWatch.clear();
    remotes.clear();
    serverArea = null;
    serverShowClass = null;
  }

  function closed(code: number) {
    const mine = ownLeave;
    ownLeave = false;
    detach();
    refused(code, mine);
  }

  function refused(code: number, mine: boolean) {
    const r = joinRefusal(code, mine);
    if (!wanted || pageGone) { setStatus({ kind: "off" }); return; }
    switch (r.retry) {
      case "never":
        setStatus(r.kind === "left" ? { kind: "off" } : { kind: "kicked", reason: r.kind as KickReason });
        return;
      case "token-once":
        if (tokenRetried) { setStatus({ kind: "kicked", reason: "auth" }); return; }
        tokenRetried = true;
        refresh = true;
        retryIn(0);
        return;
      case "jitter":
        retryIn(random() * RESTART_JITTER_MS);
        return;
      case "backoff":
        retryIn(REJOIN_BACKOFF_S[Math.min(attempt++, REJOIN_BACKOFF_S.length - 1)] * 1000);
        return;
    }
  }
  function retryIn(ms: number) {
    cancelRetry?.();
    setStatus({ kind: "offline", retryAt: Date.now() + ms });
    cancelRetry = later(() => { cancelRetry = null; void connect(); }, ms);
  }

  /**
   * Into a friend's shard (v1): leave this room (its close is ignored: a new generation) and take the reserved seat with
   * a fresh client. A seat that can't be taken falls back to the usual refusal handling (backoff, then a fresh join).
   */
  async function move(sdk: SdkModule, seat: SeatReservation, seatArea: Area): Promise<boolean> {
    const old = room;
    if (!old || connecting) return false;
    detach();
    connecting = true;
    setStatus({ kind: "connecting" });
    void old.leave();
    try {
      const t = await token(false);
      if (!t || !wanted || pageGone) { connecting = false; setStatus({ kind: "off" }); return false; }
      const client = new sdk.Client(o.url);
      client.http.options.credentials = "omit";
      client.auth.token = t;
      const joinedShowClass = showClass;
      const r = await client.consumeSeatReservation(seat);
      connecting = false;
      if (!wanted || pageGone) { void r.leave(); setStatus({ kind: "off" }); return false; }
      // The seat was made with the area you were in when you asked (the server's copy of your options): a later door
      // goes out once joined; the class setting rides the seat too.
      attach(r, sdk, seatArea, joinedShowClass);
      return true;
    } catch (e) {
      connecting = false;
      const code = (e as { code?: unknown }).code;
      refused(typeof code === "number" ? code : 0, false);
      return false;
    }
  }

  async function connect(): Promise<void> {
    if (room || connecting || !wanted || pageGone) return;
    connecting = true;
    setStatus({ kind: "connecting" });
    try {
      const sdk = await loadSdk();
      const t = await token(refresh);
      refresh = false;
      if (!wanted || pageGone) { connecting = false; setStatus({ kind: "off" }); return; }
      if (!t) { connecting = false; setStatus({ kind: "off" }); return; } // signed out: solo (row 224)
      const client = new sdk.Client(o.url);
      client.http.options.credentials = "omit";
      client.auth.token = t;
      const joinedArea = area, joinedShowClass = showClass;
      const r = await client.joinOrCreate(ROOM_NAME, { v: PROTOCOL, area: AREAS.indexOf(joinedArea), mobile: false, showClass: joinedShowClass });
      connecting = false;
      if (!wanted || pageGone) { void r.leave(); setStatus({ kind: "off" }); return; }
      attach(r, sdk, joinedArea, joinedShowClass);
    } catch (e) {
      connecting = false;
      const code = (e as { code?: unknown }).code;
      refused(typeof code === "number" ? code : 0, false);
    }
  }

  function leaveRoom() {
    cancelRetry?.();
    cancelRetry = null;
    if (room) {
      ownLeave = true;
      void room.leave();
    } else if (status.kind !== "off") setStatus({ kind: "off" });
  }

  const life = refCounted(() => { wanted = true; void connect(); }, () => { wanted = false; leaveRoom(); });
  listen("pagehide", () => { pageGone = true; leaveRoom(); });
  listen("pageshow", e => {
    if (!(e as PageTransitionEvent).persisted) return;
    pageGone = false;
    if (wanted) void connect();
  });

  const source: RoomSource = {
    remotes,
    get joinSeq() { return joinSeq; },
    get areaSeq() { return areaSeq; },
    get epoch() { return epoch; },
    status: () => status,
    roster: () => roster,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    now: () => (epoch ? roomNow() : 0),
    sendPose(packet: PosePacket) {
      // Nobody sees a private area; and t waits for the server's clock.
      if (room && status.kind === "joined" && clock.synced && !isPrivateArea(area)) room.send(MSG.pose, packet);
    },
    sendSlow(patch: SlowState) {
      if (room && status.kind === "joined") room.send(MSG.slow, patch);
    },
    leave() { wanted = false; leaveRoom(); },
    get sys() { return lastSys; },
    get roomId() { return room?.roomId ?? null; },
    chat,
    sendChat(text: string) {
      const t = text.trim().slice(0, CHAT.maxLength);
      if (!t || !room || status.kind !== "joined") return false;
      room.send(MSG.chat, { text: t });
      chat.sent(t);
      return true;
    },
    sendTyping(on: boolean) {
      if (room && status.kind === "joined") room.send(MSG.slow, { typing: on } satisfies SlowState);
    },
    follow(uid: string) {
      return new Promise<FollowResult>(done => {
        if (!room || status.kind !== "joined") { done({ ok: false, reason: "busy" as FollowRefusal }); return; }
        asking.get(uid)?.done({ ok: false, reason: "busy" });
        const cancel = later(() => { if (asking.get(uid)?.done === done) { asking.delete(uid); done({ ok: false, reason: "busy" }); } }, FOLLOW_WAIT_MS);
        asking.set(uid, { done, cancel, area });
        room.send(MSG.follow, { uid });
      });
    },
  };
  return {
    source,
    acquire: life.acquire,
    release: life.release,
    setArea(next) { area = next; sendArea(); },
    setShowClass(on) { showClass = on; sendShowClass(); },
    rejoin() {
      if (!wanted || room || connecting) return;
      cancelRetry?.();
      cancelRetry = null;
      attempt = 0;
      tokenRetried = false;
      pageGone = false;
      void connect();
    },
  };
}

// ── The page's one store ──────────────────────────────────────────

interface Holder { store: NetStore | null; loading: Promise<NetStore | null> | null; decided: boolean; listeners: Set<() => void> }
const KEY = "__tsiNetStore";
function holder(): Holder {
  const g = globalThis as unknown as Record<string, Holder | undefined>;
  return (g[KEY] ??= { store: null, loading: null, decided: false, listeners: new Set() });
}
const search = () => (typeof window === "undefined" ? "" : window.location.search);
function setStore(store: NetStore | null) {
  const h = holder();
  h.store = store;
  h.decided = true;
  h.loading = null;
  for (const l of h.listeners) l();
}

/** The store if it is ready now: the room's at once, null while the loopback loads or with multiplayer off. */
function peekStore(): NetStore | null {
  const h = holder();
  if (h.store || h.decided || h.loading || typeof window === "undefined") return h.store;
  const m = netMode(search());
  if (!m) setStore(null);
  else if (m.kind === "room") setStore(roomStore({ url: m.url, devName: m.devName, netsim: DEV ? parseNetsim(search()) : null }));
  return h.store;
}
/** The store, loading the loopback's code first when the page asks for bots. */
function loadStore(): Promise<NetStore | null> {
  const h = holder();
  if (h.store || h.decided) return Promise.resolve(h.store);
  if (h.loading) return h.loading;
  const m = netMode(search());
  if (m?.kind !== "bots") return Promise.resolve(peekStore());
  h.loading = import("./loopback").then(({ createLoopback }) => {
    // `?botchat=S`: bots in view chat every S seconds or so (bubbles, the "…" and the talking without a server);
    // `?botfire=1`: the first bots dance round the campfire and sit by it.
    const q = new URLSearchParams(search()), chatEvery = Number(q.get("botchat")) || 0, fire = DEV && q.get("botfire") === "1";
    const lb = createLoopback({ bots: m.bots, seed: m.seed, netsim: DEV ? parseNetsim(search()) : null, chatEvery, fire });
    const store = loopbackStore(lb);
    setStore(store);
    return store;
  }, () => { setStore(null); return null; });
  return h.loading;
}

/**
 * The page's NetSource, or null when multiplayer is off (creating nothing). Acquired while `ready` (the world shown,
 * the creator done), released on unmount; `area` is the scene you're in.
 */
export function useNetSource({ area, ready }: { area: Area; ready: boolean }): NetSource | null {
  const [store, setLocal] = useState<NetStore | null>(peekStore);
  const showClass = useShowClass();
  useEffect(() => {
    if (store) return;
    let alive = true;
    void loadStore().then(s => { if (alive && s) setLocal(s); });
    return () => { alive = false; };
  }, [store]);
  // The area and the class setting first, so an acquire that connects joins with them.
  useLayoutEffect(() => { store?.setArea(area); }, [store, area]);
  useLayoutEffect(() => { store?.setShowClass?.(showClass); }, [store, showClass]);
  useLayoutEffect(() => {
    if (!store || !ready) return;
    store.acquire();
    return () => store.release();
  }, [store, ready]);
  return store?.source ?? null;
}

/** "Play here" after another tab took your place (4104), or any refusal that keeps you off: join again. */
export function rejoin(): void {
  holder().store?.rejoin?.();
}

const OFF: NetStatus = { kind: "off" };
const NOBODY: readonly RosterEntry[] = [];
/** Follow whichever store the page has (it may arrive after the first render). */
function subscribeStore(listener: () => void) {
  const h = holder();
  let unsub = h.store?.source.subscribe(listener) ?? null;
  const onStore = () => {
    unsub?.();
    unsub = holder().store?.source.subscribe(listener) ?? null;
    listener();
  };
  h.listeners.add(onStore);
  return () => { h.listeners.delete(onStore); unsub?.(); };
}
/** The connection's status; re-renders only when it changes. */
export function useNetStatus(): NetStatus {
  return useSyncExternalStore(subscribeStore, () => holder().store?.source.status() ?? OFF, () => OFF);
}
/** The whole shard, you included; re-renders only when someone joins, leaves or changes area. */
export function useRoster(): readonly RosterEntry[] {
  return useSyncExternalStore(subscribeStore, () => holder().store?.source.roster() ?? NOBODY, () => NOBODY);
}

/** Tests: forget the page's store. */
export function resetNetStore(): void {
  const h = holder();
  h.store?.source.leave();
  setStore(null);
  h.decided = false;
}
