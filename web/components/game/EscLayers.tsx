"use client";

/**
 * The Esc layers' own pieces (David, playtest round 1, decision 3; lib/game/escMenu.ts). The UI view's (Esc 1) menu is
 * the phone bottom right now (tutorial round 9, the kit's Phone, wired in DefaultIslandWorld); its old dock is gone.
 * - `SystemMenu`, Esc 2: Resume, Settings, and Log out (Sign in for a guest). Escape or ✕ goes back to the game.
 */
import { useState } from "react";
import { LogOut, Play } from "lucide-react";
import { Button, Sheet, SignInLink } from "@/components/gui";
import { KeywordIcon } from "@/components/gui/flat";
import { createClient } from "@/lib/supabase/client";
import styles from "./EscLayers.module.css";

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
