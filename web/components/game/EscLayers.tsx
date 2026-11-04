"use client";

/**
 * The Esc layers' own pieces (David, playtest round 1, decision 3; lib/game/escMenu.ts):
 * - `MenuDock`, the UI view's (Esc 1) row of menu entries over the live game: Settings, Quests, Bag and Collection,
 *   Friends and Mail, each with its key and the icon library's drawing (round 7: the same icon for a thing everywhere).
 *   Round 8 (David: "the settings icon should be in the bar before, and i want you to simplify the bar below"): Settings
 *   moved in from the top right as the first entry; Map went (the UI view's big minimap opens it); "Here (n)" folded into
 *   Friends (its "Who's on the island" button); "Quests and journal" is just Quests. The world keeps running and its
 *   keys keep working.
 * - `SystemMenu`, Esc 2: Resume, Settings, and Log out (Sign in for a guest). Escape or ✕ goes back to the game.
 */
import { useState } from "react";
import { LogOut, Play } from "lucide-react";
import { Button, Counter, Sheet, SignInLink } from "@/components/gui";
import { KeywordIcon } from "@/components/gui/flat";
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

export interface DockKeys { journal: string; bag: string; collection: string; mail: string }

/** The UI view's dock (Esc 1), bottom centre. */
export function MenuDock({ keys, touch, unread, asking, only, onSettings, onJournal, onBag, onCollection, onFriends, onMail }: {
  keys: DockKeys; touch: boolean; unread: number; asking: number;
  /** Only these entries (Alice's keyboard tour brings them in a key at a time); all when unset. */
  only?: ReadonlySet<"quests" | "collection" | "mail">;
  onSettings: () => void; onJournal: () => void; onBag: () => void; onCollection: () => void; onFriends: () => void; onMail: () => void;
}) {
  const k = (key: string) => (touch ? undefined : key);
  const all = !only;
  return <nav className={styles.dock} aria-label="Menu" data-testid="menu-dock">
    {all && <div className={styles.group} aria-label="Settings">
      <Entry icon={<KeywordIcon kind="settings" />} label="Settings" onClick={onSettings} />
    </div>}
    {(all || only.has("quests")) && <div className={styles.group} aria-label="Quests">
      <Entry icon={<KeywordIcon kind="quest" />} label="Quests" keyLabel={k(keys.journal)} onClick={onJournal} />
    </div>}
    {(all || only.has("collection")) && <div className={styles.group} aria-label="Bag and collection">
      {all && <Entry icon={<KeywordIcon kind="bag" />} label="Bag" keyLabel={k(keys.bag)} onClick={onBag} />}
      <Entry icon={<KeywordIcon kind="collection" />} label="Collection" keyLabel={k(keys.collection)} onClick={onCollection} />
    </div>}
    {(all || only.has("mail")) && <div className={styles.group} aria-label="Friends and mail">
      {all && <Entry icon={<KeywordIcon kind="friend" />} label="Friends" badge={asking} onClick={onFriends} />}
      <Entry icon={<KeywordIcon kind="mail" />} label="Mail" keyLabel={k(keys.mail)} badge={unread} onClick={onMail} />
    </div>}
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
      <Button variant="secondary" onClick={onSettings}><KeywordIcon kind="settings" size={17} /> Settings</Button>
      {signedIn
        ? <Button variant="quiet" disabled={leaving} onClick={() => { setLeaving(true); void logOut(); }}><LogOut size={17} aria-hidden /> {leaving ? "Logging out…" : "Log out"}</Button>
        : <SignInLink button>Sign in</SignInLink>}
    </div>
    <p className={styles.hint}><kbd>Esc</kbd> back to the island</p>
  </Sheet>;
}
