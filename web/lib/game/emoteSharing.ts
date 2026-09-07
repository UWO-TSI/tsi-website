import { presenceRequest, PresenceRequestError } from "./mobilePresence";
import type { PresencePosition } from "./positionHeartbeat";

export interface SharedEmote extends PresencePosition { id: string }
export type EmoteTransport = (emote: Readonly<SharedEmote>, signal: AbortSignal) => Promise<void>;

export const shareEmote: EmoteTransport = async (emote, signal) => {
  const response = await fetch("/api/emotes/log", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emote_type_id: emote.id, world_x: emote.x, world_z: emote.z }),
  });
  if (!response.ok) throw new PresenceRequestError(response.status);
  if ((await response.json())?.ok !== true) throw new Error("Missing emote acknowledgement");
};

/** Local animation is independent; only the latest selection can report a sharing failure. */
export function createEmoteSharing(transport: EmoteTransport, onFailure: (message: string) => void) {
  const requests = new Set<AbortController>();
  let latest = 0;
  let disposed = false;
  return {
    async send(emote: SharedEmote): Promise<void> {
      if (disposed) return;
      const attempt = ++latest;
      const controller = new AbortController();
      requests.add(controller);
      const snapshot = { ...emote };
      try {
        await presenceRequest((signal) => transport(snapshot, signal), controller.signal);
      } catch (error) {
        if (!disposed && attempt === latest) {
          onFailure(error instanceof PresenceRequestError && error.status === 401
            ? "Your emote played here. Sign in to share it."
            : "Your emote played here, but sharing could not be confirmed.");
        }
      } finally {
        requests.delete(controller);
      }
    },
    dispose() {
      disposed = true;
      for (const request of requests) request.abort();
      requests.clear();
    },
  };
}
