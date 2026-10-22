// The island room (specs/multiplayer.md §3, §4, §6): one per shard, covering the village
// and the interiors. Each client's StateView holds the players it can see (same area,
// not private, in range); the roster lists the whole shard. Movement is the client's
// own, checked here before anyone else sees it. Chat goes to the whole shard, past the
// checks in ./chat and around blocks; sanctions reach a player's sessions through the
// world (../world). Everything on the wire comes from the shared contract
// (web/lib/net/protocol.ts, imported as @net/protocol).
//
// v1 friends (specs/v1-drop.md §3): each player's `friends` list (their friends on the
// island, in any shard, never one who blocked them) is sent at join and whenever one of
// them comes, moves or goes; `follow {uid}` reserves a seat in a friend's shard with
// matchMaker.reserveSeatFor, which a soft-locked shard still takes below SHARD.max (only
// joinById refuses `locked`), carrying the session's own card, blocks and friends, so
// onAuth isn't run again.
import { randomUUID } from "node:crypto";
import { getMessageBytes, matchMaker, Protocol, Room, ServerError, definePlugins, type AuthContext, type Client } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { UniqueSessionPlugin } from "colyseus/plugins/unique-session";
import * as N from "@net/protocol";
import { admit, checkToken, isRemoved, JoinRefused, type AuthServices } from "../auth/authenticate";
import type { PlayerCard } from "../auth/card";
import type { Identity } from "../auth/verify";
import type { Blocks, Presence, SanctionPatch, World, WorldRoom } from "../world";
import { checkChat, createChatMeter, recordChat, type ChatMeter, type ChatSender } from "./chat";
import { limiters, type Limiter, type RateSpec } from "./limits";
import { addStrike, checkPose, newTrack, resetBaseline, SANITY, type MotionTrack } from "./sanity";
import { IslandState, Player, RosterEntry } from "./state";
import { planViews, type Seen, type ViewRules } from "./views";

/** Refusals decided in static onAuth (the matchmake POST) but sent as a close from onJoin. */
type Deferred = "auth" | "removed" | "card" | "version";
const DEFERRED_CLOSE: Record<Deferred, number> = {
  auth: N.CLOSE.auth,
  removed: N.CLOSE.removed,
  card: N.CLOSE.busy,
  version: N.CLOSE.version,
};

/** client.auth: `id` is the verified sub, the key UniqueSessionPlugin and the session index use. */
export type IslandAuth = { id: string; identity: Identity; card?: PlayerCard; blocks?: Blocks; friends?: string[]; refusal?: Deferred };

type LimitKind = "p" | "s" | "area" | "events" | "emotes" | "refresh" | "ping" | "chat" | "follow";
const RATES: Record<LimitKind, RateSpec> = {
  p: N.RATE_LIMITS.p,
  s: N.RATE_LIMITS.s,
  area: N.RATE_LIMITS.area,
  events: N.RATE_LIMITS.events,
  emotes: N.RATE_LIMITS.emotes,
  refresh: { perSecond: 1000 / N.RATE_LIMITS.refresh.everyMs, burst: 1 },
  ping: N.RATE_LIMITS.ping,
  // Raw chat messages, before the CHAT checks (which answer each with a line or a refusal): a flood is dropped unanswered.
  chat: { perSecond: 2, burst: 3 },
  follow: { perSecond: 1000 / N.RATE_LIMITS.follow.everyMs, burst: 1 },
};

/** Per session, kept across a reconnection (Colyseus carries userData over). */
type Session = {
  key: string;
  sid: number;
  uid: string;
  mobile: boolean;
  identity: Identity;
  track: MotionTrack;
  limit: Record<LimitKind, Limiter>;
  /** Decode target, reused. */
  pose: N.Pose;
  view: StateView;
  /** A close we chose (kick, replace, restart): no reconnection grace. */
  final?: number;
  /** The pending reconnection while dropped. */
  grace?: { reject: (reason?: unknown) => void };
  /** In development the kick is only logged, once per crossing. */
  warned: boolean;
  /** Accepted chat lines (the limits), and what the checks know of the sender. */
  chat: ChatMeter;
  sender: ChatSender;
  /** Players this one blocked, and players who blocked this one: no chat lines or emotes between them. */
  blocks: Set<string>;
  blockedBy: Set<string>;
  /** v1: their friends (member ids), and the card they joined with (a follow carries it to the next shard). */
  friends: Set<string>;
  card: PlayerCard;
};

/** Chat lines and emotes don't pass between a blocked pair, whichever of them blocked. */
const blockedPair = (a: Session, b: Session) => a.blocks.has(b.uid) || a.blockedBy.has(b.uid) || b.blocks.has(a.uid) || b.blockedBy.has(a.uid);

const timeOf = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** What the chat checks need from a card. */
const senderOf = (card: PlayerCard): ChatSender => ({
  mutedUntil: timeOf(card.muted_until),
  createdAt: timeOf(card.created_at) ?? 0,
  member: card.badge === "member",
});

const VIEW_RULES: ViewRules = {
  hidden: (a) => N.isPrivateArea(N.AREAS[a] ?? "village"),
  ranged: (a) => N.AREAS[a] === "village",
  radiusIn: N.INTEREST.radiusIn,
  radiusOut: N.INTEREST.radiusOut,
};

export type IslandRoomOptions = {
  services: AuthServices;
  /** The chat log, blocks and sanctions every room shares. */
  world: World;
  /** Production closes with CLOSE.kicked at the strike limit; development only logs (§4.5). */
  kickForMovement: boolean;
  graceS: { desktop: number; phone: number };
  log: (event: string, fields: Record<string, unknown>) => void;
};

const lookJson = (look: PlayerCard["look"]) => {
  if (!look) return "";
  const s = JSON.stringify(look);
  return Buffer.byteLength(s) <= N.LOOK_MAX_BYTES ? s : "";
};

function applyCard(p: Player, card: PlayerCard): void {
  p.name = card.name || N.NAME_FALLBACK;
  p.badge = N.cardBadge(card.badge);
  p.look = lookJson(card.look);
  p.level = card.level;
  p.family = N.cardFamily(card.family);
  p.kit = card.subclass ?? "";
  p.mastery = card.mastery ?? 0;
  p.aura = card.aura ?? "";
  p.frame = N.cardFrame(card.frame);
}

export function createIslandRoom(o: IslandRoomOptions) {
  /** Shard numbers in use in this process (one process holds every room). */
  const shards = new Set<number>();

  /** One session per user, keyed by the verified sub; a refused join never replaces the tab already in. */
  class OneSessionPerUser extends UniqueSessionPlugin {
    protected override async onJoin(client: Client): Promise<void> {
      if ((client.auth as IslandAuth | undefined)?.refusal) return;
      return super.onJoin(client);
    }
  }

  return class IslandRoom extends Room<{ state: IslandState; metadata: { shard: number } }> implements WorldRoom {
    plugins = definePlugins({
      unique: new OneSessionPerUser({
        max: 1,
        onDuplicate: "replace",
        resolveUserId: (c) => (c.auth as IslandAuth | undefined)?.id,
      }),
    });

    private sessions = new Map<string, Session>();
    /** Viewer session → the sessions in its view. */
    private visible = new Map<string, Set<string>>();
    private sids = new Set<number>();
    private capLocked = false;
    private shuttingDown = false;

    /** The matchmake POST, before any seat exists: the page and the token (HTTP 403/401), then the rest. */
    static async onAuth(token: string | undefined, options: unknown, ctx: AuthContext): Promise<IslandAuth> {
      let identity: Identity;
      try {
        identity = await checkToken(o.services, token, ctx.headers.get("origin"));
      } catch (e) {
        if (e instanceof JoinRefused) {
          throw new ServerError(e.refusal === "origin" ? N.HTTP_REFUSAL.origin : N.HTTP_REFUSAL.auth, e.refusal);
        }
        throw e;
      }
      const auth: IslandAuth = { id: identity.uid, identity };
      // A different version closes with CLOSE.version whatever else was sent; so do malformed options.
      if ((options as { v?: unknown } | null | undefined)?.v !== N.PROTOCOL || N.parseJoinOptions(options) === null) {
        auth.refusal = "version";
        return auth;
      }
      // The card and the player's blocks, side by side; without either the join waits for the database (4107). Friends
      // ride along: a list that can't be read is empty, never a refusal.
      const [card, blocks, friends] = await Promise.allSettled([admit(o.services, identity), o.world.loadBlocks(identity), o.world.loadFriends(identity)]);
      if (friends.status === "fulfilled") auth.friends = friends.value;
      if (card.status === "rejected") {
        const e = card.reason;
        if (!(e instanceof JoinRefused)) throw e;
        auth.refusal = e.refusal === "removed" ? "removed" : e.refusal === "card" ? "card" : "auth";
      } else if (blocks.status === "rejected") {
        auth.refusal = "card";
      } else {
        auth.card = card.value;
        auth.blocks = blocks.value;
      }
      return auth;
    }

    onCreate(): void {
      this.maxClients = N.SHARD.max;
      this.patchRate = N.PATCH_RATE_MS;
      this.maxMessagesPerSecond = N.RATE_LIMITS.maxMessagesPerSecond;
      let shard = 1;
      while (shards.has(shard)) shard++;
      shards.add(shard);
      this.metadata = { shard };
      const state = new IslandState();
      state.epoch = Date.now();
      state.shard = shard;
      this.state = state;

      this.onMessage(N.MSG.pose, this.guard(N.MSG.pose, (client: Client, message: unknown) => this.onPose(client, message)));
      this.onMessage(N.MSG.slow, this.guard(N.MSG.slow, (client: Client, message: unknown) => this.onSlow(client, message)));
      this.onMessage(N.MSG.ping, this.guard(N.MSG.ping, (client: Client, message: unknown) => this.onPing(client, message)));
      this.onMessage(N.MSG.refresh, (client: Client) => {
        this.onRefresh(client).catch((e) => this.report(N.MSG.refresh, e));
      });
      this.onMessage(N.MSG.chat, this.guard(N.MSG.chat, (client: Client, message: unknown) => this.onChat(client, message)));
      this.onMessage(N.MSG.follow, (client: Client, message: unknown) => {
        this.onFollow(client, message).catch((e) => this.report(N.MSG.follow, e));
      });
      o.world.register(this);
      this.clock.setInterval(this.guard("views", () => this.rebuildViews()), N.INTEREST.rebuildMs);
    }

    /**
     * Colyseus turns an uncaught exception into a graceful shutdown of the whole server, so
     * handlers and timers report their own. (onUncaughtException would do it, but defined
     * on the class it wraps onJoin before the plugin hooks are installed on the prototype,
     * and the first room would skip UniqueSessionPlugin.)
     */
    private guard<A extends unknown[]>(where: string, fn: (...args: A) => void): (...args: A) => void {
      return (...args: A) => {
        try {
          fn(...args);
        } catch (e) {
          this.report(where, e);
        }
      };
    }

    private report(where: string, e: unknown): void {
      o.log("error", { where, message: e instanceof Error ? e.message : String(e) });
    }

    onJoin(client: Client, options: unknown): void {
      const auth = client.auth as IslandAuth;
      if (auth.refusal) throw new ServerError(DEFERRED_CLOSE[auth.refusal], auth.refusal);
      const join = N.parseJoinOptions(options)!;
      const card = auth.card!;
      // A dropped session of the same user (the tab that lost its connection) ends here.
      for (const s of this.sessions.values()) if (s.uid === auth.id && s.grace) s.grace.reject(new Error("replaced"));

      let sid = 1;
      while (this.sids.has(sid)) sid++;
      this.sids.add(sid);

      const p = new Player();
      p.sid = sid;
      p.uid = auth.id;
      applyCard(p, card);
      p.area = join.area;
      p.flags = (join.mobile ? N.FLAG.mobile : 0) | (join.showClass ? N.FLAG.showClass : 0);
      this.state.players.set(client.sessionId, p);

      const r = new RosterEntry();
      r.uid = auth.id;
      r.name = p.name;
      r.badge = p.badge;
      r.area = p.area;
      r.flags = p.flags;
      this.state.roster.set(client.sessionId, r);

      const view = new StateView();
      client.view = view;
      const session: Session = {
        key: client.sessionId,
        sid,
        uid: auth.id,
        mobile: join.mobile,
        identity: auth.identity,
        track: newTrack(),
        limit: limiters(RATES),
        pose: N.createPose(),
        view,
        warned: false,
        chat: createChatMeter(),
        sender: senderOf(card),
        blocks: new Set(auth.blocks?.blocks ?? []),
        blockedBy: new Set(auth.blocks?.blockedBy ?? []),
        friends: new Set(auth.friends ?? []),
        card,
      };
      client.userData = session;
      this.sessions.set(client.sessionId, session);
      this.visible.set(client.sessionId, new Set());
      this.rebuildViews();
      this.applyShardCap();
      // Their friends hear they're here; their own list once their handlers are in (the next tick).
      o.world.moved(session.uid);
      this.clock.setTimeout(this.guard("friends", () => { if (this.sessions.get(session.key) === session) this.sendFriends(session); }), 0);
    }

    onDrop(client: Client): void {
      const s = this.sessions.get(client.sessionId);
      if (!s || s.final !== undefined || this.shuttingDown) return; // onLeave follows
      this.setFlag(client.sessionId, N.FLAG.away, true);
      const grace = this.allowReconnection(client, s.mobile ? o.graceS.phone : o.graceS.desktop) as unknown;
      if (grace && typeof (grace as { reject?: unknown }).reject === "function") s.grace = grace as Session["grace"];
      else if (grace instanceof Promise) grace.catch(() => {});
    }

    onReconnect(client: Client): void {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      s.grace = undefined;
      resetBaseline(s.track);
      this.setFlag(client.sessionId, N.FLAG.away, false);
    }

    onLeave(client: Client): void {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      this.sessions.delete(s.key);
      this.sids.delete(s.sid);
      this.visible.delete(s.key);
      for (const set of this.visible.values()) set.delete(s.key);
      this.state.players.delete(s.key);
      this.state.roster.delete(s.key);
      s.view.dispose();
      this.applyShardCap();
      o.world.moved(s.uid);
    }

    onDispose(): void {
      shards.delete(this.metadata.shard);
      o.world.unregister(this);
    }

    /** Before a deploy restarts the process: tell everyone, then close with CLOSE.restart (clients rejoin after jitter). */
    override onBeforeShutdown(): void {
      this.shuttingDown = true;
      for (const s of this.sessions.values()) s.final = N.CLOSE.restart;
      this.broadcast(N.MSG.sys, { kind: "restart", text: "The island is restarting. Back in a moment." });
      this.disconnect(N.CLOSE.restart).catch(() => {});
    }

    /** UniqueSessionPlugin replaces an older tab through here: close it with CLOSE.replaced, no grace. */
    override kickClient(sessionId: string, closeCode?: number, reason?: string): void {
      const s = this.sessions.get(sessionId);
      const code = reason === "replaced" ? N.CLOSE.replaced : (closeCode ?? N.CLOSE.replaced);
      if (s) s.final = code;
      // Dropped and inside its grace (a newer tab joined another shard): end the grace now.
      if (s?.grace) s.grace.reject(new Error(reason ?? "kicked"));
      super.kickClient(sessionId, code, reason);
    }

    // ── Messages ────────────────────────────────────────────────────

    private onPose(client: Client, message: unknown): void {
      const s = this.sessions.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!s || !p) return;
      const now = Date.now();
      if (!s.limit.p.take(now)) return;
      const pose = N.decodePose(message, s.pose);
      if (!pose) return this.strike(client, s, "malformed", now);
      const area = N.AREAS[p.area] ?? "village";
      // Nobody sees a private area: nothing there to check or relay.
      if (N.isPrivateArea(area)) return;
      const teleport = N.hasFlag(pose.flags, N.PACKET_FLAG.teleport);
      const verdict = checkPose(s.track, { t: pose.t, x: pose.x, y: pose.y, z: pose.z, teleport }, now - this.state.epoch, N.AREA_BOUNDS[area]);
      if (!verdict.ok) {
        if (!verdict.drop) this.strike(client, s, verdict.violation, now);
        return;
      }
      // The packet's own integers (decodePose checked every range).
      const a = message as number[];
      p.t = a[1];
      p.x = a[2];
      p.y = a[3];
      p.z = a[4];
      p.vx = a[5];
      p.vy = a[6];
      p.vz = a[7];
      p.yaw = a[8];
      p.move = a[9];
      p.air = a[10];
      p.leaf = a[11];
      p.lift = a[12];
      if (teleport) p.tp = N.nextTp(p.tp);
      if (pose.ev.length > 0) this.relayEvents(s, pose, now);
    }

    /** Each event to the clients whose view holds the player, at its own time on the room timeline. */
    private relayEvents(s: Session, pose: N.Pose, now: number): void {
      const out: (number | string)[] = [];
      for (let i = 0; i + 2 < pose.ev.length; i += 3) {
        const kind = pose.ev[i] as number, value = pose.ev[i + 1], dt = pose.ev[i + 2] as number;
        if (!s.limit.events.take(now)) continue;
        if (N.isClipEv(kind) && N.isEmoteClip(value) && !s.limit.emotes.take(now)) continue;
        const e = N.encodeEvent({ sid: s.sid, t: pose.t - dt, kind, value }, out);
        if (!e) continue;
        const emote = N.isClipEv(kind) && N.isEmoteClip(value);
        const bytes = getMessageBytes.raw(Protocol.ROOM_DATA, N.MSG.event, e);
        for (const c of this.clients) {
          if (!this.visible.get(c.sessionId)?.has(s.key)) continue;
          if (emote) {
            const r = this.sessions.get(c.sessionId);
            if (!r || blockedPair(s, r)) continue;
          }
          c.enqueueRaw(bytes);
        }
      }
    }

    private onSlow(client: Client, message: unknown): void {
      const s = this.sessions.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      const r = this.state.roster.get(client.sessionId);
      if (!s || !p || !r) return;
      const now = Date.now();
      if (!s.limit.s.take(now)) return;
      const m = N.parseSlowState(message);
      if (!m) return;
      if (m.area !== undefined && m.area !== p.area) {
        // Over the limit the whole message is dropped (it describes the new area) and strikes.
        if (!s.limit.area.take(now)) return this.strike(client, s, "area", now);
        p.area = m.area;
        r.area = m.area;
        resetBaseline(s.track);
      }
      if (m.held !== undefined) p.held = m.held;
      if (m.weapon !== undefined) {
        p.weapon = m.weapon;
        this.setFlag(s.key, N.FLAG.armed, m.weapon !== "");
      }
      if (m.pose !== undefined) p.pose = m.pose;
      if (m.seat !== undefined) p.seat = m.seat;
      if (m.study !== undefined) p.study = m.study;
      if (m.studyEnds !== undefined) p.studyEnds = m.studyEnds;
      if (m.showClass !== undefined) this.setFlag(s.key, N.FLAG.showClass, m.showClass);
      if (m.afk !== undefined) this.setFlag(s.key, N.FLAG.afk, m.afk);
      // v1: the "…" over someone writing a chat line.
      if (m.typing !== undefined) this.setFlag(s.key, N.FLAG.typing, m.typing);
      if (m.area !== undefined) {
        this.rebuildViews();
        o.world.moved(s.uid);
      }
    }

    private onPing(client: Client, message: unknown): void {
      const s = this.sessions.get(client.sessionId);
      if (!s || !s.limit.ping.take(Date.now())) return;
      const sent = N.parsePing(message);
      if (sent !== null) client.send(N.MSG.pong, [sent, Date.now()]);
    }

    /** After a wardrobe, name or class change: re-read the card (at most once per 10 s). */
    private async onRefresh(client: Client): Promise<void> {
      const s = this.sessions.get(client.sessionId);
      if (!s || !s.limit.refresh.take(Date.now())) return;
      let card: PlayerCard;
      try {
        card = await o.services.loadCard(s.identity, { refresh: true });
      } catch {
        return;
      }
      const p = this.state.players.get(s.key), r = this.state.roster.get(s.key);
      if (!p || !r || this.sessions.get(s.key) !== s) return;
      if (isRemoved(card, Date.now())) return this.close(client, s, N.CLOSE.removed, "removed");
      applyCard(p, card);
      r.name = p.name;
      r.badge = p.badge;
      s.sender = senderOf(card);
      s.card = card;
    }

    /**
     * `chat {text}` (§6): checked (./chat), then one line to everyone in the shard but players in a block with the
     * sender, the sender included, and queued for the log. A refused line gets `sys {kind: "refused"}` back.
     */
    private onChat(client: Client, message: unknown): void {
      const s = this.sessions.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!s || !p || this.shuttingDown) return;
      const now = Date.now();
      if (!s.limit.chat.take(now)) return;
      const m = N.parseChat(message);
      if (!m) return;
      const verdict = checkChat(s.chat, s.sender, m.text, now);
      if (!verdict.ok) {
        client.send(N.MSG.sys, { kind: "refused", reason: verdict.reason, text: verdict.notice } satisfies N.SysMessage);
        return;
      }
      recordChat(s.chat, verdict.text, now);
      // The line is out: the "…" comes down with it (the sender's own clear may be on its way).
      this.setFlag(s.key, N.FLAG.typing, false);
      const line: N.ChatLine = {
        id: randomUUID(),
        sid: s.sid,
        uid: s.uid,
        name: p.name,
        area: p.area,
        text: verdict.text,
        t: N.quantTime(now - this.state.epoch),
      };
      const bytes = getMessageBytes.raw(Protocol.ROOM_DATA, N.MSG.line, line);
      for (const c of this.clients) {
        const r = this.sessions.get(c.sessionId);
        if (r && !blockedPair(s, r)) c.enqueueRaw(bytes);
      }
      o.world.chatLog.push({
        id: line.id,
        shard: this.state.shard,
        room_id: this.roomId,
        area: N.AREAS[p.area] ?? "village",
        member_id: s.uid,
        world_name: p.name,
        body: verdict.text,
        created_at: new Date(now).toISOString(),
      });
    }

    /**
     * `follow {uid}` (v1): a seat in a friend's shard. Refused as not_friend (no friendship), offline (not on the island,
     * or a block between you, never said as such), here (already in their shard), full (at maxClients) or busy. The seat
     * is reserved with the session's own card, blocks and friends and its area, mobile and class options.
     */
    private async onFollow(client: Client, message: unknown): Promise<void> {
      const s = this.sessions.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!s || !p || this.shuttingDown || !s.limit.follow.take(Date.now())) return;
      const ask = N.parseFollow(message);
      if (!ask) return;
      const answer = (a: N.FollowAnswer) => { if (this.sessions.get(s.key) === s) client.send(N.MSG.follow, a); };
      const refuse = (refused: N.FollowRefusal) => answer({ uid: ask.uid, refused });
      if (!s.friends.has(ask.uid)) return refuse("not_friend");
      const where = s.blocks.has(ask.uid) || s.blockedBy.has(ask.uid) ? null : o.world.presence(ask.uid);
      if (!where) return refuse("offline");
      if (where.roomId === this.roomId) return refuse("here");
      const auth: IslandAuth = {
        id: s.uid, identity: s.identity, card: s.card, friends: [...s.friends], blocks: { blocks: [...s.blocks], blockedBy: [...s.blockedBy] },
      };
      const options: N.JoinOptions = { v: N.PROTOCOL, area: p.area, mobile: s.mobile, showClass: N.hasFlag(p.flags, N.FLAG.showClass) };
      try {
        const room = await matchMaker.getRoomById(where.roomId);
        if (!room) return refuse("offline");
        const seat = await matchMaker.reserveSeatFor(room, options, auth);
        answer({ uid: ask.uid, seat: seat as N.SeatReservation });
        o.log("follow", { uid: s.uid, to: ask.uid, shard: where.shard });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        refuse(/full/i.test(message) ? "full" : "busy");
      }
    }

    // ── The world's calls ────────────────────────────────────────────

    /** A T1/T2 sanction (the admin routes or the poll): a mute takes effect on the next line, a removal closes now. */
    applySanction(uid: string, patch: SanctionPatch): number {
      let n = 0;
      const now = Date.now();
      for (const s of [...this.sessions.values()]) {
        if (s.uid !== uid || s.final !== undefined) continue;
        n++;
        // The card too: a follow carries it to the friend's shard (onFollow), where the new session's sender is built from it.
        s.card = { ...s.card, ...patch };
        if (patch.muted_until !== undefined) s.sender = { ...s.sender, mutedUntil: timeOf(patch.muted_until) };
        const removed = patch.removed_until !== undefined ? timeOf(patch.removed_until) : null;
        if (removed === null || removed <= now) continue;
        o.log("removed", { uid: s.uid, sid: s.sid });
        if (s.grace) {
          s.final = N.CLOSE.removed;
          s.grace.reject(new Error("removed"));
          continue;
        }
        const client = this.clients.getById(s.key);
        if (client) this.close(client, s, N.CLOSE.removed, "removed");
      }
      return n;
    }

    /** A block changed: from now on lines and emotes between the pair stop (or flow again). */
    applyBlock(blocker: string, blocked: string, on: boolean): number {
      let n = 0;
      for (const s of this.sessions.values()) {
        if (s.uid === blocker) {
          if (on) { s.blocks.add(blocked); s.friends.delete(blocked); }
          else s.blocks.delete(blocked);
          n++;
        } else if (s.uid === blocked) {
          if (on) { s.blockedBy.add(blocker); s.friends.delete(blocker); }
          else s.blockedBy.delete(blocker);
          n++;
        }
      }
      return n;
    }

    applyFriend(a: string, b: string, on: boolean): number {
      let n = 0;
      for (const s of this.sessions.values()) {
        const other = s.uid === a ? b : s.uid === b ? a : null;
        if (!other) continue;
        if (on && !s.blocks.has(other) && !s.blockedBy.has(other)) s.friends.add(other);
        else if (!on) s.friends.delete(other);
        n++;
      }
      return n;
    }

    presenceOf(uid: string): Presence | null {
      for (const s of this.sessions.values()) {
        if (s.uid !== uid || s.final !== undefined) continue;
        const p = this.state.players.get(s.key);
        if (p) return { shard: this.state.shard, area: p.area, roomId: this.roomId };
      }
      return null;
    }

    refreshFriends(uid: string): void {
      for (const s of this.sessions.values()) if (s.uid === uid) this.sendFriends(s);
    }

    friendMoved(uid: string): void {
      for (const s of this.sessions.values()) if (s.friends.has(uid)) this.sendFriends(s);
    }

    /** `friends`: their friends on the island now, in any shard, never one who blocked them (nor one they blocked). */
    private sendFriends(s: Session): void {
      const client = this.clients.getById(s.key);
      if (!client || s.final !== undefined) return;
      const list: N.FriendPresence[] = [];
      for (const uid of s.friends) {
        if (s.blockedBy.has(uid) || s.blocks.has(uid)) continue;
        const where = o.world.presence(uid);
        if (where) list.push({ uid, shard: where.shard, area: where.area });
        if (list.length >= N.FRIENDS_MAX) break;
      }
      list.sort((x, y) => (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0));
      client.send(N.MSG.friends, list);
    }

    memberIds(): string[] {
      return [...new Set([...this.sessions.values()].filter((s) => s.final === undefined).map((s) => s.uid))];
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private strike(client: Client, s: Session, why: string, now: number): void {
      const strikes = addStrike(s.track, now);
      if (strikes < SANITY.kickStrikes) return;
      if (o.kickForMovement) {
        o.log("kick", { uid: s.uid, sid: s.sid, why, strikes: Math.round(strikes) });
        this.close(client, s, N.CLOSE.kicked, "movement");
      } else if (!s.warned) {
        s.warned = true;
        o.log("strikes", { uid: s.uid, sid: s.sid, why, strikes: Math.round(strikes), note: "would kick in production" });
      }
    }

    private close(client: Client, s: Session, code: number, reason: string): void {
      s.final = code;
      client.leave(code, reason);
    }

    /**
     * A presence bit on the player and the roster. Typing stays off the roster: only those who see you draw the "…",
     * and a toggle shouldn't patch the whole shard's list.
     */
    private setFlag(key: string, bit: number, on: boolean): void {
      const p = this.state.players.get(key), r = this.state.roster.get(key);
      if (!p || !r) return;
      p.flags = on ? p.flags | bit : p.flags & ~bit;
      r.flags = p.flags & ~N.FLAG.typing;
    }

    /** §4.4: bring every view in line with areas and distances (2 Hz, and at once on a join or a door). */
    private rebuildViews(): void {
      const seen: Seen[] = [];
      this.state.players.forEach((p, key) => seen.push({ key, area: p.area, x: N.dequantPos(p.x), z: N.dequantPos(p.z) }));
      for (const { viewer, add, remove } of planViews(seen, this.visible, VIEW_RULES)) {
        const s = this.sessions.get(viewer), set = this.visible.get(viewer);
        if (!s || !set) continue;
        for (const k of add) {
          const p = this.state.players.get(k);
          if (p) {
            s.view.add(p);
            set.add(k);
          }
        }
        for (const k of remove) {
          const p = this.state.players.get(k);
          if (p) s.view.remove(p);
          set.delete(k);
        }
      }
    }

    /** §3: matchmaking stops at SHARD.lock players and resumes under SHARD.unlock; maxClients is the hard cap. */
    private applyShardCap(): void {
      const n = this.state.players.size;
      if (!this.capLocked && n >= N.SHARD.lock) {
        this.capLocked = true;
        this.lock().catch(() => {});
      } else if (this.capLocked && n < N.SHARD.unlock) {
        this.capLocked = false;
        this.unlock().catch(() => {});
      }
    }
  };
}

export type IslandRoomClass = ReturnType<typeof createIslandRoom>;
