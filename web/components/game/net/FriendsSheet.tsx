"use client";

/**
 * Your friends (specs/v1-drop.md §3): who's on the island and where (Join puts you in their shard), requests to answer
 * or take back, your friend code to share and a box to add someone by theirs (people who aren't online), and the
 * players you've blocked (unblock). A paper sheet through the one dialog system. World names only (row 222).
 */
import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, HeartHandshake, LogIn } from "lucide-react";
import { Button, Empty, List, ListRow, Sheet, Tabs, toast } from "@/components/gui";
import { chatStore } from "@/lib/net/chat";
import { useNetStatus } from "@/lib/net/netStore";
import { formatFriendCode } from "@/lib/world/friendCode";
import { blockList, unblockWorld } from "@/lib/world/api";
import { addFriend, answer, joinFriend, refreshFriends, unfriend, useFriends, whereOf } from "./friendActions";
import { openCard } from "./cards";
import s from "./card.module.css";

type Tab = "friends" | "requests" | "add" | "blocked";

function Blocked() {
  const [list, setList] = useState<{ member_id: string; world_name: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    void blockList().then(r => { if (alive) setList(r.ok ? r.blocks : []); });
    return () => { alive = false; };
  }, []);
  if (!list) return <p className={s.small}>Loading…</p>;
  if (!list.length) return <Empty title="Nobody blocked">Anyone you block shows here, to unblock later.</Empty>;
  return <List label="Blocked">{list.map(b => <ListRow key={b.member_id} title={b.world_name}
    value={<Button size="sm" variant="secondary" onClick={async () => {
      const r = await unblockWorld(b.member_id);
      if (!r.ok) { toast(r.error); return; }
      chatStore().unmute(b.member_id);
      setList(l => l?.filter(x => x.member_id !== b.member_id) ?? null);
      toast(`${b.world_name} is unblocked.`);
    }}>Unblock</Button>} />)}</List>;
}

function AddByCode({ code }: { code: string | null }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    if (await addFriend({ code: text })) setText("");
    setBusy(false);
  };
  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(formatFriendCode(code)); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { toast("Couldn't copy. Your code is " + formatFriendCode(code)); }
  };
  return <div className={s.add}>
    <p className={s.lead}>Your friend code</p>
    <div className={s.code}>
      <span data-testid="friend-code">{code ? formatFriendCode(code) : "…"}</span>
      <Button size="sm" variant="secondary" onClick={copy} disabled={!code} aria-label="Copy your friend code">{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? "Copied" : "Copy"}</Button>
    </div>
    <p className={s.small}>Share it with someone to add each other, even when one of you isn&apos;t on the island.</p>
    <form onSubmit={send} className={s.codeForm}>
      <label className={s.lead} htmlFor="friend-code-input">Their code</label>
      <div className={s.codeRow}>
        <input id="friend-code-input" value={text} onChange={e => setText(e.target.value)} placeholder="ABCD-2345" maxLength={12} autoComplete="off" spellCheck={false} />
        <Button size="sm" type="submit" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send request"}</Button>
      </div>
    </form>
  </div>;
}

export default function FriendsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const f = useFriends(), status = useNetStatus();
  const [tab, setTab] = useState<Tab>("friends");
  // Opening reads the list again and starts on your friends (or on the requests, when someone is asking).
  const asking = f.asking > 0;
  useEffect(() => {
    if (!open) return;
    void refreshFriends();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- each opening starts on the tab that matters now
    setTab(asking ? "requests" : "friends");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only when it opens, not as requests come in while it's open
  const v = f.view, myShard = status.kind === "joined" ? status.shard : null;
  const online = new Map(f.online.map(o => [o.uid, o]));
  const friends = [...(v?.friends ?? [])].sort((a, b) => Number(online.has(b.member_id)) - Number(online.has(a.member_id)) || a.world_name.localeCompare(b.world_name));
  const here = friends.filter(x => online.has(x.member_id)).length;
  return <Sheet open={open} onClose={onClose} size="sm" icon={<HeartHandshake size={20} />} testId="friends-sheet" title="Friends"
    eyebrow={v ? `${friends.length} friend${friends.length === 1 ? "" : "s"} · ${here} on the island` : "Your friends"}>
    <Tabs label="Friends" value={tab} onChange={setTab} tabs={[
      { id: "friends", label: "Friends" }, { id: "requests", label: "Requests", badge: f.asking || undefined }, { id: "add", label: "Add" }, { id: "blocked", label: "Blocked" },
    ]} />
    <div className={s.tabBody}>
      {!v && tab !== "blocked" ? <p className={s.small}>Friends aren&apos;t available right now.</p>
        : tab === "friends" ? (friends.length ? <List label="Friends">{friends.map(x => {
          const o = online.get(x.member_id);
          return <ListRow key={x.member_id} data-away={o ? undefined : ""}
            title={<button type="button" className={s.nameButton} onClick={() => openCard({ uid: x.member_id, name: x.world_name })} aria-label={`${x.world_name}: open their card`}>{x.world_name}</button>}
            detail={o ? whereOf(o.area) : "Not on the island"}
            value={o && o.shard !== myShard ? <Button size="sm" variant="secondary" onClick={() => joinFriend(x.member_id, x.world_name)}><LogIn size={14} aria-hidden /> Join</Button> : o ? <span className={s.status}>Here</span> : undefined} />;
        })}</List> : <Empty icon={<HeartHandshake size={28} />} title="No friends yet">Click someone on the island to add them, or share your code.</Empty>)
        : tab === "requests" ? (v!.incoming.length || v!.outgoing.length ? <>
          {v!.incoming.length > 0 && <List label="Asking you">{v!.incoming.map(r => <ListRow key={r.member_id} title={r.world_name} detail="Wants to be friends"
            value={<span className={s.rowActions}><Button size="sm" onClick={() => answer(r.member_id, r.world_name, true)}>Accept</Button><Button size="sm" variant="quiet" onClick={() => answer(r.member_id, r.world_name, false)}>Not now</Button></span>} />)}</List>}
          {v!.outgoing.length > 0 && <List label="You asked">{v!.outgoing.map(r => <ListRow key={r.member_id} title={r.world_name} detail="Waiting for them"
            value={<Button size="sm" variant="quiet" onClick={() => unfriend(r.member_id, r.world_name, true)}>Take back</Button>} />)}</List>}
        </> : <Empty title="No requests">Requests you send and get show here.</Empty>)
        : tab === "add" ? <AddByCode code={v!.code} />
        : <Blocked />}
    </div>
  </Sheet>;
}
