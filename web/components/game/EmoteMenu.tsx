"use client";

import { useState } from "react";
import { Armchair, Hand, Laugh, Music, Pointer, X, type LucideIcon } from "lucide-react";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import styles from "./EmoteMenu.module.css";
import { useEmoteTypes } from "@/lib/content/loader";
import type { EmoteType } from "@/lib/content/types";

/**
 * EmoteMenu (sprint E2) — DOM overlay rendered alongside AudioController /
 * NPCChatOverlay, outside the R3F Canvas. Opens on G key or sidebar icon
 * (wired in GameWorld). Click an emote → onPick(emote) → onClose().
 *
 * Cosmetic-only: emotes don't grant XP/TC (CLAUDE.md principle #3 + #4).
 */

/** Our icons for the built-in emotes (row 281: no emoji as UI); an admin-made emote shows its own icon or its initial. */
const ICON_BY_KEY: Record<string, LucideIcon> = { wave: Hand, dance: Music, laugh: Laugh, point: Pointer, sit: Armchair };

interface EmoteMenuProps {
  open: boolean;
  onClose: () => void;
  onPick: (emote: EmoteType) => void;
}

export default function EmoteMenu(props: EmoteMenuProps) {
  const { data: emotes } = useEmoteTypes();
  return <EmoteMenuView {...props} emotes={emotes} />;
}

export function EmoteMenuView({ open, onClose, onPick, emotes }: EmoteMenuProps & { emotes: EmoteType[] }) {
  const dialogRef = useWorldDialog(open, onClose, "g");
  const state = usePresence(open);
  if (!state) return null;
  const visible = emotes.slice(0, 8);
  // A paper tray of round petals in the tool wheel's language (it was dark glass with emoji).
  return (
    <div className={styles.layer} data-state={state}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="emote-title" tabIndex={-1} className={styles.tray} data-gui-overlay>
        <header className={styles.head}>
          <h2 id="emote-title">Emotes</h2>
          <button className={styles.close} aria-label="Close emotes" title="Close (G or Esc)" onClick={onClose}><X size={18} aria-hidden /></button>
        </header>
        {visible.length === 0 && <p role="status" className={styles.empty}>No emotes yet. New ones arrive with club events.</p>}
        <ul className={styles.petals}>
          {visible.map((emote, i) => (
            <li key={emote.id} style={{ "--i": i } as React.CSSProperties}>
              <button className={styles.petal} onClick={() => { onPick(emote); onClose(); }} aria-label={emote.display_name}>
                <EmoteIcon emote={emote} />
                <span className={styles.name}>{emote.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmoteIcon({ emote }: { emote: EmoteType }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (emote.icon_url && failedSource !== emote.icon_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={emote.icon_url} alt="" onError={() => setFailedSource(emote.icon_url)} width={34} height={34} className={styles.icon} />;
  }
  const Icon = ICON_BY_KEY[emote.animation_key];
  if (Icon) return <Icon size={30} strokeWidth={2.2} aria-hidden className={styles.icon} />;
  return <span aria-hidden className={styles.initial}>{emote.display_name.charAt(0).toUpperCase()}</span>;
}
