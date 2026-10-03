import { mentionsSignIn } from "./signIn";

/** `signIn`: the note asks you to sign in, and its words are the link (reachability §3): it stays up long enough to tap. */
export type GameToast = { id: number; text: string; icon?: string; duration: number; signIn: boolean };

export function createToastQueue(publish: (entries: readonly GameToast[]) => void) {
  let entries: GameToast[] = [];
  let nextId = 0;
  let disposed = false;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  return {
    push(detail: unknown) {
      if (disposed || !detail || typeof detail !== "object" || !("text" in detail) || typeof detail.text !== "string") return;
      const characters = Array.from(detail.text.trim());
      if (!characters.length) return;
      const text = characters.length > 280 ? `${characters.slice(0, 279).join("").trimEnd()}…` : characters.join("");
      const icon = "icon" in detail && typeof detail.icon === "string" && detail.icon.trim() ? detail.icon : undefined;
      const signIn = mentionsSignIn(text);
      const entry = { id: nextId++, text, icon, signIn, duration: Math.max(signIn ? 6500 : 2600, Math.min(12000, characters.length * 45)) };
      entries = [...entries, entry];
      if (entries.length > 3) {
        const removed = entries.shift()!;
        clearTimeout(timers.get(removed.id));
        timers.delete(removed.id);
      }
      timers.set(entry.id, setTimeout(() => {
        if (disposed) return;
        timers.delete(entry.id);
        entries = entries.filter((item) => item.id !== entry.id);
        publish(entries);
      }, entry.duration));
      publish(entries);
    },
    dispose() {
      disposed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear(); entries = [];
    },
  };
}
