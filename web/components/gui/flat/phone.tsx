"use client";

/**
 * The phone (tutorial round 9, David on the UI view's bar: "pressing a button and a phone pops up on the bottom right and
 * the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"; design bible UI, the phone).
 * A small phone that slides up into the bottom right corner: an ink bezel round a light screen, a grid of app tiles
 * (white cards with the icon library's drawing, the name under, a count, the key), and a home bar at the bottom that
 * puts it away. An app opens its own sheet; while it's open the phone tucks down out of the way (`away`), and closing
 * the app brings the phone back as it was. On a phone screen (narrow) it's larger, with bigger tiles and no keys.
 * Colours: the theme's --ui-* tokens. Plain props; nothing here knows the game. Shown on /lab/gui?only=phone.
 */
import type { ReactNode } from "react";
import { Counter } from "@/components/gui";
import { usePresence } from "@/lib/game/useWorldDialog";
import p from "./phone.module.css";

export interface PhoneApp {
  id: string; label: string; icon: ReactNode;
  /** The key that opens it from the world (not shown on a touch screen). */
  keyLabel?: string;
  /** New things inside (letters, friend asks). */
  badge?: number;
  onOpen: () => void;
}

/** Its slide out, so the parent's closing state waits for it (ms). */
const OUT_MS = 220;

export function Phone({ open, apps, away, hint, onClose, testId = "phone" }: {
  open: boolean; apps: readonly PhoneApp[];
  /** An app is open: the phone tucks down out of the way until it closes. */
  away?: boolean;
  /** Beside the home bar: what puts it away (its key). */
  hint?: ReactNode;
  /** The home bar: put the phone away. */
  onClose: () => void;
  testId?: string;
}) {
  const state = usePresence(open, OUT_MS);
  if (!state) return null;
  return <nav className={`${p.phone} gui`} data-gui-flat="" data-state={state} data-away={away || undefined} aria-label="Phone" aria-hidden={away || undefined} data-testid={testId}>
    <div className={p.screen}>
      <span className={p.speaker} aria-hidden="true" />
      <div className={p.grid}>
        {apps.map(a => <button key={a.id} type="button" className={p.app} onClick={a.onOpen} tabIndex={away ? -1 : undefined}
          aria-label={a.badge ? `${a.label}, ${a.badge} new` : a.label} title={a.keyLabel ? `${a.label} (${a.keyLabel})` : a.label}>
          <span className={p.tile} aria-hidden="true">{a.icon}<Counter n={a.badge ?? 0} className={p.badge} />{a.keyLabel && <kbd>{a.keyLabel}</kbd>}</span>
          <span className={p.label}>{a.label}</span>
        </button>)}
      </div>
      <button type="button" className={p.home} onClick={onClose} tabIndex={away ? -1 : undefined} aria-label="Put the phone away">
        <i aria-hidden="true" />{hint}
      </button>
    </div>
  </nav>;
}
