"use client";

/**
 * The Esc layers' own pieces (David, playtest round 1, decision 3; lib/game/escMenu.ts):
 * - `MenuDock`, the UI view's (Esc 1) row of menu entries over the live game: Map, Quests and journal, Bag and
 *   Collection, Friends and Mail, each with its key. The world keeps running and its keys keep working.
 * - `SystemMenu`, Esc 2: Resume, Settings, and Log out (Sign in for a guest). Escape or ✕ goes back to the game.
 */
import { useState } from "react";
import { BookOpen, HeartHandshake, LogOut, Mail, Map as MapIcon, Play, ScrollText, Settings, ShoppingBag, Users } from "lucide-react";
import { Button, Counter, Sheet, SignInLink } from "@/components/gui";
import { createClient } from "@/lib/supabase/client";
import styles from "./EscLayers.module.css";

function Entry({ icon, label, keyLabel, badge, disabled, onClick }: { icon: React.ReactNode; label: string; keyLabel?: string; badge?: number; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={styles.entry} onClick={onClick} disabled={disabled} aria-label={badge ? `${label}, ${badge} new` : label}
    title={keyLabel ? `${label} (${keyLabel})` : label}>
    <span className={styles.entryIcon} aria-hidden="true">{icon}{badge ? <Counter n={badge} className={styles.badge} /> : null}</span>
    <span className={styles.entryLabel}>{label}</span>
    {keyLabel && <kbd aria-hidden="true">{keyLabel}</kbd>}
  </button>;
}

export interface DockKeys { map: string; journal: string; bag: string; collection: string; mail: string }

/** The UI view's dock (Esc 1), bottom centre. `onMap` null where there's no island map (rooms, home, the ruins). */
export function MenuDock({ keys, touch, unread, asking, people, onMap, onJournal, onBag, onCollection, onFriends, onPeople, onMail }: {
  keys: DockKeys; touch: boolean; unread: number; asking: number;
  /** Players on the island with you (multiplayer on), or null while you're not with the others. */
  people: number | null;
  onMap: (() => void) | null; onJournal: () => void; onBag: () => void; onCollection: () => void; onFriends: () => void; onPeople: () => void; onMail: () => void;
}) {
  const k = (key: string) => (touch ? undefined : key);
  return <nav className={styles.dock} aria-label="Menu" data-testid="menu-dock">
    <div className={styles.group} aria-label="Map">
      <Entry icon={<MapIcon size={20} />} label="Map" keyLabel={k(keys.map)} disabled={!onMap} onClick={() => onMap?.()} />
    </div>
    <div className={styles.group} aria-label="Quests and journal">
      <Entry icon={<ScrollText size={20} />} label="Quests and journal" keyLabel={k(keys.journal)} onClick={onJournal} />
    </div>
    <div className={styles.group} aria-label="Bag and collection">
      <Entry icon={<ShoppingBag size={20} />} label="Bag" keyLabel={k(keys.bag)} onClick={onBag} />
      <Entry icon={<BookOpen size={20} />} label="Collection" keyLabel={k(keys.collection)} onClick={onCollection} />
    </div>
    <div className={styles.group} aria-label="Friends and mail">
      <Entry icon={<HeartHandshake size={20} />} label="Friends" badge={asking} onClick={onFriends} />
      {people !== null && <Entry icon={<Users size={20} />} label={`Here (${people})`} onClick={onPeople} />}
      <Entry icon={<Mail size={20} />} label="Mail" keyLabel={k(keys.mail)} badge={unread} onClick={onMail} />
    </div>
  </nav>;
}

/** Leaves the island for the title screen, signed out. */
export async function logOut() {
  try { await createClient().auth.signOut(); } catch { /* the title screen shows who's signed in */ }
  window.location.assign("/student");
}

/** Esc 2: the system menu. */
export function SystemMenu({ open, signedIn, name, onResume, onSettings, onClose }: {
  open: boolean; signedIn: boolean;
  /** Your world name (never a real one, row 222). */
  name: string;
  onResume: () => void; onSettings: () => void; onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  return <Sheet open={open} onClose={onClose} title="Menu" size="sm" testId="system-menu" eyebrow={signedIn ? `Signed in as ${name}` : "Playing as a guest"}>
    <div className={styles.system}>
      <Button onClick={onResume}><Play size={17} aria-hidden /> Resume</Button>
      <Button variant="secondary" onClick={onSettings}><Settings size={17} aria-hidden /> Settings</Button>
      {signedIn
        ? <Button variant="quiet" disabled={leaving} onClick={() => { setLeaving(true); void logOut(); }}><LogOut size={17} aria-hidden /> {leaving ? "Logging out…" : "Log out"}</Button>
        : <SignInLink button>Sign in</SignInLink>}
    </div>
    <p className={styles.hint}><kbd>Esc</kbd> back to the island</p>
  </Sheet>;
}
