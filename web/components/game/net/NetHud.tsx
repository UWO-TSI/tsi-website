"use client";

/**
 * The multiplayer HUD (specs/multiplayer.md §5.7): a small status pill while you're not with the others (connecting,
 * reconnecting, offline, or replaced by another window with "Play here"). Nothing at all while multiplayer is off (no
 * source, or not joined yet): the page's status is "off". World chat's dock (ChatDock.tsx: Enter, or the chat button on
 * a touch screen), the player card (PlayerCard.tsx), the presence list and the friends sheet (FriendsSheet.tsx) live
 * here too; a cinematic (`hidden`: a talk, the boat, photo mode) puts the chat away.
 * Playtest round 1 (decision 3): the people and friends buttons left the HUD for the Esc Menu's Friends and mail, which
 * opens these sheets through `setNetSheet` (./sheets.ts). The friends sheet opens with multiplayer off too (it says
 * when friends aren't available).
 */
import { MessageCircle } from "lucide-react";
import { Badge, Button, IconButton } from "@/components/gui";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";
import type { Area } from "@/lib/net/protocol";
import type { NetStatus } from "@/lib/net/types";
import * as netStore from "@/lib/net/netStore";
import { useNetStatus } from "@/lib/net/netStore";
import PresenceList from "./PresenceList";
import ChatDock, { setChatOpen, useChatOpen } from "./ChatDock";
import PlayerCard from "./PlayerCard";
import FriendsSheet from "./FriendsSheet";
import { useFriendsSync } from "./friendActions";
import { setNetSheet, useNetSheet } from "./sheets";
import s from "./net.module.css";

/** What the pill says, and the one thing you can do about it; null while you're with the others (or off). */
export function statusLine(status: NetStatus | null): { text: string; tone: "info" | "warn" | "neutral"; action?: "play" | "reload"; busy?: boolean } | null {
  switch (status?.kind) {
    case "connecting": return { text: "Joining the others…", tone: "info", busy: true };
    case "reconnecting": return { text: "Reconnecting…", tone: "info", busy: true };
    case "offline": return { text: "Offline · trying again soon", tone: "neutral" };
    case "kicked":
      switch (status.reason) {
        case "replaced": return { text: "You're on the island in another window", tone: "warn", action: "play" };
        case "version": return { text: "The island has been updated", tone: "warn", action: "reload" };
        case "auth": return { text: "Sign in again to see the others", tone: "warn" };
        case "removed": return { text: "You can't join the others right now", tone: "neutral" };
        case "kicked": return { text: "Disconnected from the others", tone: "neutral" };
        case "origin": return { text: "Can't reach the others from here", tone: "neutral" };
      }
      return null;
    default: return null;
  }
}

/**
 * "Play here" (another window took the island over, 4104): take it back in this one through the store's rejoin; a
 * store without one yet (it lands with the island room's store) reloads, which rejoins too. Stale pages (4106) reload.
 */
function act(action: "play" | "reload") {
  const rejoin = action === "play" ? (Reflect.get(netStore, "rejoin") as (() => void) | undefined) : undefined;
  if (rejoin) rejoin(); else window.location.reload();
}

function Hud({ area, status, hidden, expanded }: { area: Area; status: NetStatus; hidden: boolean; expanded: boolean }) {
  const touch = useCoarsePointer(), chatting = useChatOpen(), sheet = useNetSheet();
  // Friends: kept fresh while you're with the others (a request or a friend arriving toasts; the Menu shows the count).
  useFriendsSync(status.kind === "joined");
  const line = statusLine(status);
  return <>
    <div className={s.hud}>
      {line && <div className={s.status} role="status" data-busy={line.busy || undefined}>
        <Badge tone={line.tone}>{line.busy && <span className={s.beads} aria-hidden="true"><i /><i /><i /></span>}{line.text}</Badge>
        {line.action && <Button size="sm" variant="secondary" onClick={() => act(line.action!)}>{line.action === "play" ? "Play here" : "Reload"}</Button>}
      </div>}
      {/* A touch screen has no Enter: a small chat button opens the bar. */}
      {touch && !hidden && <IconButton label="Chat" aria-expanded={chatting} onClick={() => setChatOpen(!chatting)}><MessageCircle size={19} aria-hidden /></IconButton>}
    </div>
    <PresenceList open={sheet === "people"} onClose={() => setNetSheet(null)} area={area} />
    <ChatDock hidden={hidden} expanded={expanded} />
  </>;
}

export default function NetHud({ area, hidden = false, expanded = false }: { area: Area;
  /** A cinematic (a talk with a resident, the boat trip) or photo mode: the chat steps away. */
  hidden?: boolean;
  /** The UI view (Esc 1): the chat's last lines stay up. */
  expanded?: boolean }) {
  const status = useNetStatus(), sheet = useNetSheet();
  return <>
    {status.kind !== "off" && <Hud area={area} status={status} hidden={hidden} expanded={expanded} />}
    <FriendsSheet open={sheet === "friends"} onClose={() => setNetSheet(null)} />
    <PlayerCard />
  </>;
}
