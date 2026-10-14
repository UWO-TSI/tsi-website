/**
 * Friends' records in memory: the same rules the migration's functions keep (20261013170000_world_friends), for the
 * tests and for the local two-client bench (/api/world/friends with dev tokens, never production).
 */
import { FriendError, FRIEND_LIMITS, type FriendStore, type RequestOutcome } from "./friends";

const HOUR = 3_600_000;

export function memoryFriendStore(now: () => Date = () => new Date()) {
  const members = new Map<string, string | null>(); // id → world name
  const codes = new Map<string, string>(); // member → code
  const taken = new Set<string>(); // codes held by someone outside this store
  const friends: { a: string; b: string; at: string }[] = [];
  const requests: { from: string; to: string; at: string }[] = [];
  const blocks: { blocker: string; blocked: string }[] = [];
  const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);
  const isFriends = (x: string, y: string) => { const [a, b] = pair(x, y); return friends.some(f => f.a === a && f.b === b); };
  const countFriends = (x: string) => friends.filter(f => f.a === x || f.b === x).length;
  const blocked = (x: string, y: string) => blocks.some(b => (b.blocker === x && b.blocked === y) || (b.blocker === y && b.blocked === x));
  const dropRequests = (x: string, y: string) => {
    for (let i = requests.length - 1; i >= 0; i--) { const r = requests[i]; if ((r.from === x && r.to === y) || (r.from === y && r.to === x)) requests.splice(i, 1); }
  };
  const befriend = (x: string, y: string) => {
    if (countFriends(x) >= FRIEND_LIMITS.max || countFriends(y) >= FRIEND_LIMITS.max) throw new FriendError("limit");
    dropRequests(x, y);
    const [a, b] = pair(x, y);
    if (!isFriends(a, b)) friends.push({ a, b, at: now().toISOString() });
  };
  const nameOf = (id: string) => members.get(id) ?? null;

  const store: FriendStore = {
    async codeOf(member) { return codes.get(member) ?? null; },
    async insertCode(member, code) {
      if (codes.has(member)) return "exists";
      if (taken.has(code) || [...codes.values()].includes(code)) return "taken";
      codes.set(member, code);
      return "ok";
    },
    async memberByCode(code) { for (const [m, c] of codes) if (c === code) return m; return null; },
    async friends(member) {
      return friends.filter(f => f.a === member || f.b === member).map(f => { const other = f.a === member ? f.b : f.a; return { member_id: other, world_name: nameOf(other), since: f.at }; });
    },
    async requests(member) {
      const byNewest = (x: { at: string }, y: { at: string }) => y.at.localeCompare(x.at);
      return {
        incoming: requests.filter(r => r.to === member).sort(byNewest).map(r => ({ member_id: r.from, world_name: nameOf(r.from), at: r.at })),
        outgoing: requests.filter(r => r.from === member).sort(byNewest).map(r => ({ member_id: r.to, world_name: nameOf(r.to), at: r.at })),
      };
    },
    async request(from, to): Promise<RequestOutcome> {
      if (!from || !to || from === to) throw new FriendError("invalid");
      if (!members.has(from) || !members.has(to)) throw new FriendError("not_found");
      if (blocked(from, to)) throw new FriendError("blocked");
      if (isFriends(from, to)) return "already_friends";
      if (requests.some(r => r.from === to && r.to === from)) { befriend(from, to); return "friends"; }
      if (requests.some(r => r.from === from && r.to === to)) return "already_requested";
      const t = now().getTime(), mine = requests.filter(r => r.from === from);
      if (countFriends(from) >= FRIEND_LIMITS.max || mine.length >= FRIEND_LIMITS.pending || mine.filter(r => t - Date.parse(r.at) < HOUR).length >= FRIEND_LIMITS.hourly) {
        throw new FriendError("limit");
      }
      requests.push({ from, to, at: new Date(t).toISOString() });
      return "requested";
    },
    async accept(me, from) {
      if (!me || !from || me === from) throw new FriendError("invalid");
      if (isFriends(me, from)) { dropRequests(me, from); return "already_friends"; }
      if (!requests.some(r => r.from === from && r.to === me)) throw new FriendError("not_found");
      if (blocked(me, from)) throw new FriendError("blocked");
      befriend(me, from);
      return "friends";
    },
    async remove(me, other) {
      if (!me || !other || me === other) throw new FriendError("invalid");
      const [a, b] = pair(me, other), i = friends.findIndex(f => f.a === a && f.b === b);
      if (i >= 0) friends.splice(i, 1);
      dropRequests(me, other);
      return i >= 0;
    },
  };
  return {
    store,
    friends,
    requests,
    member(id: string, worldName: string | null = null) { members.set(id, worldName); },
    knows: (id: string) => members.has(id),
    /** A block (world_blocks), with the trigger's effect: the friendship and requests go. */
    block(blocker: string, blockedId: string) {
      blocks.push({ blocker, blocked: blockedId });
      const [a, b] = pair(blocker, blockedId), i = friends.findIndex(f => f.a === a && f.b === b);
      if (i >= 0) friends.splice(i, 1);
      dropRequests(blocker, blockedId);
    },
    /** Codes someone else already holds. */
    takeCodes(list: string[]) { for (const c of list) taken.add(c); },
  };
}
