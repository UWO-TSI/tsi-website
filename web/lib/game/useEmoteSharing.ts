"use client";

import { useCallback, useEffect, useRef } from "react";
import { createEmoteSharing, shareEmote, type EmoteTransport, type SharedEmote } from "./emoteSharing";

export function useEmoteSharing(transport: EmoteTransport = shareEmote) {
  const sharingRef = useRef<ReturnType<typeof createEmoteSharing> | null>(null);
  useEffect(() => {
    const sharing = createEmoteSharing(transport, (text) => {
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text } }));
    });
    sharingRef.current = sharing;
    return () => {
      sharing.dispose();
      sharingRef.current = null;
    };
  }, [transport]);
  return useCallback((emote: SharedEmote) => { void sharingRef.current?.send(emote); }, []);
}
