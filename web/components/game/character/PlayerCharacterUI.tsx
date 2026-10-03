"use client";

/**
 * Member-game character UI: the creator at first login (row 142, skippable
 * with a random look) and the emote menu on G (content emote types → clips).
 */
import { useEffect, useState } from "react";
import CharacterCreator from "./CharacterCreator";
import EmoteMenu from "../EmoteMenu";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";
import { EMOTE_CLIPS } from "@/lib/game/character/clips";
import { refreshIdentity, useWorldIdentity } from "@/lib/game/identity";
import { worldKeysBlocked, isTyping } from "@/lib/game/useWorldDialog";
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
  const [emotes, setEmotes] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // The emote menu's own dialog takes G to close; under any other dialog (the creator too) G does nothing.
      if (e.repeat || e.key.toLowerCase() !== "g" || worldKeysBlocked() || isTyping(e.target as Element)) return;
      setEmotes(open => !open);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <>
    {mine.loaded && !mine.saved && <CharacterCreator initial={mine.look} askName={identity.signedIn ? { current: identity.display_name } : undefined}
      onDone={async (look, name) => { await saveMyLook(look); if (name) await saveName(name); }} />}
    <EmoteMenu open={emotes} onClose={() => setEmotes(false)} onPick={emote => {
      const clip = EMOTE_CLIPS[emote.animation_key];
      if (clip) window.dispatchEvent(new CustomEvent("tsi:emote", { detail: { clip } }));
      setEmotes(false);
    }} />
  </>;
}
