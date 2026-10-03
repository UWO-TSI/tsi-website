"use client";

/**
 * The multiplayer HUD (specs/multiplayer.md §5.7): a small status pill while you're not with the others (connecting,
 * reconnecting, offline, or replaced by another window with "Play here"), and the people button that opens the
 * presence list. Nothing at all while multiplayer is off (no source, or not joined yet): the page's status is "off".
 * The clean HUD (row 283) hides the button while you explore; it slides in for a moment when someone comes or goes,
 * and stays with the full HUD (its key held, the pause view, touch, or the setting).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Users } from "lucide-react";
import { Badge, Button, IconButton } from "@/components/gui";
import { FLASH_MS, fullHud, useAlwaysFullHud } from "@/lib/game/hudPrefs";
import { readCapture, subscribeCapture } from "@/lib/game/orbitCamera";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";
import { isTyping } from "@/lib/game/useWorldDialog";
import { useWheelKeys } from "@/lib/game/movement/keys";
import type { Area } from "@/lib/net/protocol";
import type { NetStatus } from "@/lib/net/types";
import { useNetStatus, useRoster } from "@/lib/net/netStore";
import { useFlash } from "../useFlash";
import PresenceList from "./PresenceList";
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

/** The full HUD or the clean one, read as DefaultIslandWorld reads it (the setting, the HUD key, touch, the mouse). */
function useFullHud(): boolean {
  const always = useAlwaysFullHud(), touch = useCoarsePointer(), key = useWheelKeys().hud;
  const capture = useSyncExternalStore(subscribeCapture, readCapture, () => "off" as const);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key && !e.repeat && !isTyping(e.target as Element)) setHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key) setHeld(false); };
    const blur = () => setHeld(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [key]);
  return fullHud({ always, keyHeld: held, touch, capture });
}

function Hud({ area, status }: { area: Area; status: NetStatus }) {
  const roster = useRoster(), full = useFullHud();
  const [open, setOpen] = useState(false);
  // Someone came or went: the button shows for a moment in the clean HUD.
  const flash = useFlash(roster.length, FLASH_MS.mail);
  const line = statusLine(status), n = roster.length;
  return <>
    <div className={s.hud} data-clean={full ? undefined : ""}>
      {line && <div className={s.status} role="status" data-busy={line.busy || undefined}>
        <Badge tone={line.tone}>{line.busy && <span className={s.beads} aria-hidden="true"><i /><i /><i /></span>}{line.text}</Badge>
        {line.action && <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>{line.action === "play" ? "Play here" : "Reload"}</Button>}
      </div>}
      {(full || flash || open) && n > 0 && <IconButton label={`People on the island: ${n}`} className={s.people} data-flash={full ? undefined : flash ?? undefined}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Users size={19} aria-hidden /><b className={s.count} aria-hidden="true">{n}</b>
      </IconButton>}
    </div>
    <PresenceList open={open} onClose={() => setOpen(false)} area={area} />
  </>;
}

export default function NetHud({ area }: { area: Area }) {
  const status = useNetStatus();
  return status.kind === "off" ? null : <Hud area={area} status={status} />;
}
