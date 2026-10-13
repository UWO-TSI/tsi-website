"use client";

/**
 * A player's card (specs/v1-drop.md §3, specs/multiplayer.md §6): opened from a chat line's name or the people list.
 * Their world name (never a real one, row 222), the member dot, their level when they're in view, and what you can do:
 * mute (this session; their lines and bubbles stop), block (persistent, POST /api/world/blocks: no chat lines or
 * emotes between you, both ways; avatars still show) and report (POST /api/world/report: a line from the chat, or the
 * player, with a reason; it lands in the T1/T2 queue with the room's last lines).
 */
import { useState, type ReactNode } from "react";
import { Ban, Flag, Volume2, VolumeX } from "lucide-react";
import { Button, ConfirmDialog, List, ListRow, Sheet, toast } from "@/components/gui";
import { chatStore } from "@/lib/net/chat";
import { REPORT_REASONS, blockWorld, reportWorld } from "@/lib/world/api";
import { activeNet } from "./active";
import { closeCard, useCard, type CardTarget } from "./cards";
import s from "./card.module.css";

/** Their level and member dot from the player in your view, when they're in it. */
function inView(t: CardTarget): { level: number; member: boolean } | null {
  const reg = activeNet()?.remotes;
  if (!reg) return null;
  for (let i = 0; i < reg.size; i++) {
    const p = reg.at(i).player;
    if (p.uid === t.uid) return { level: p.level, member: p.member };
  }
  return null;
}

function Report({ t, onDone }: { t: CardTarget; onDone: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const room = (activeNet() as { roomId?: string | null } | null)?.roomId ?? undefined;
    const r = await reportWorld(t.lineId ? { line_id: t.lineId, reason } : { member_id: t.uid, room_id: room, reason });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    toast("Thanks for telling us. A moderator will take a look.");
    onDone();
  };
  return <div className={s.report}>
    <p className={s.lead}>{t.lineId ? "What's wrong with what they said?" : `What's going on with ${t.name}?`}</p>
    <div role="radiogroup" aria-label="Reason" className={s.reasons}>
      {REPORT_REASONS.map(r => <button key={r} type="button" role="radio" aria-checked={reason === r} className={s.reason} onClick={() => setReason(r)}>{r}</button>)}
    </div>
    {error && <p className={s.error} role="alert">{error}</p>}
    <div className={s.actions}>
      <Button variant="quiet" size="sm" onClick={onDone}>Never mind</Button>
      <Button size="sm" disabled={!reason || busy} onClick={send}>{busy ? "Sending…" : "Send report"}</Button>
    </div>
    <p className={s.small}>The last few lines of chat go with it, so a moderator can see what happened.</p>
  </div>;
}

/** The card's own actions; v1 friends adds its row above them (`children`). */
export default function PlayerCard({ children }: { children?: (t: CardTarget) => ReactNode }) {
  const t = useCard();
  const chat = chatStore();
  const [view, setView] = useState<"main" | "report">("main");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [shown, setShown] = useState<CardTarget | null>(null);
  // A new card starts at its main view with its own mute state.
  if (t && t !== shown) { setShown(t); setView("main"); setMuted(chat.isMuted(t.uid)); }
  const close = () => { closeCard(); setConfirmBlock(false); };
  const me = chat.selfUid;
  const seen = t ? inView(t) : null;
  const member = seen?.member ?? t?.member ?? false;

  const toggleMute = () => {
    if (!t) return;
    if (chat.isMuted(t.uid)) { chat.unmute(t.uid); setMuted(false); toast(`${t.name} unmuted.`); }
    else { chat.mute(t.uid); setMuted(true); toast(`${t.name} muted until you leave the island.`); }
  };
  const block = async () => {
    if (!t) return;
    setBusy(true);
    const r = await blockWorld(t.uid);
    setBusy(false);
    setConfirmBlock(false);
    if (!r.ok) { toast(r.error); return; }
    chat.blocked(t.uid);
    toast(`${t.name} is blocked. You won't see each other's chat.`);
    close();
  };

  return <>
    <Sheet open={!!t && !confirmBlock} onClose={close} size="sm" testId="player-card" title={t?.name ?? ""}
      eyebrow={<span className={s.eyebrow}>{member && <span className={s.dot} role="img" aria-label="TSI member" title="TSI member" />}{member ? "TSI member" : "Islander"}{seen && seen.level > 0 ? ` · Lv ${seen.level}` : ""}</span>}>
      {t && (t.uid === me ? <p className={s.lead}>That&apos;s you!</p> : view === "report" ? <Report t={t} onDone={() => setView("main")} /> : <>
        {children?.(t)}
        <List label="Chat">
          <ListRow icon={muted ? <Volume2 size={18} /> : <VolumeX size={18} />} title={muted ? "Unmute" : "Mute"} detail={muted ? "See their chat again" : "Hide their chat until you leave"} onClick={toggleMute} />
          <ListRow icon={<Ban size={18} />} title="Block" detail="No chat or emotes between you" onClick={() => setConfirmBlock(true)} />
          <ListRow icon={<Flag size={18} />} title={t.lineId ? "Report this line" : "Report"} detail="Tell a moderator" onClick={() => setView("report")} />
        </List>
      </>)}
    </Sheet>
    <ConfirmDialog open={!!t && confirmBlock} title={`Block ${t?.name ?? ""}?`} confirmLabel="Block" cancelLabel="Not now" danger busy={busy}
      onConfirm={block} onCancel={() => setConfirmBlock(false)}>
      You won&apos;t see each other&apos;s chat or emotes.
    </ConfirmDialog>
  </>;
}
