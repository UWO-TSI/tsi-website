"use client";

/**
 * Member-game character UI: the creator at first login (row 142, skippable
 * with a random look). The emotes are the emote wheel's (components/game/emotes/EmoteWheel.tsx).
 */
import CharacterCreator from "./CharacterCreator";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";
import { refreshIdentity, useWorldIdentity } from "@/lib/game/identity";
import { toast } from "../ToastHub";

/** Saves the name; a refusal or a dropped connection is said in a toast (it used to be swallowed). */
async function saveName(name: string) {
  try {
    const res = await fetch("/api/identity/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (res.ok) { await refreshIdentity(); return; }
    const body = await res.json().catch(() => null) as { error?: string } | null;
    toast(`Your look is saved, but not your name: ${body?.error ?? "the island couldn’t take it just now"}.`);
  } catch {
    toast("Your look is saved, but not your name: the connection dropped.");
  }
}

export default function PlayerCharacterUI() {
  const mine = useMyLook();
  const identity = useWorldIdentity();
  return <>
    {mine.loaded && !mine.saved && <CharacterCreator initial={mine.look} askName={identity.signedIn ? { current: identity.display_name } : undefined}
      onDone={async (look, name) => { await saveMyLook(look); if (name) await saveName(name); }} />}
  </>;
}
