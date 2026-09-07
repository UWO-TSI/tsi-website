import { PresenceRequestError } from "./mobilePresence";
import { isPresenceCoordinate } from "./presencePosition";

export type PresencePosition = { x: number; z: number };
export type PositionTransport = (position: Readonly<PresencePosition>, signal: AbortSignal) => Promise<void>;
export const POSITION_POLL_MS = 30_000;
export const IDLE_HEARTBEAT_MS = 4 * 60_000;

export const sendPosition: PositionTransport = async (position, signal) => {
  const response = await fetch("/api/positions/heartbeat", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ world_x: position.x, world_z: position.z }),
  });
  if (!response.ok) throw new PresenceRequestError(response.status);
};

export function createPositionHeartbeat(send: PositionTransport, now = () => performance.now()) {
  let lastSent: (PresencePosition & { at: number }) | null = null;
  return async (position: PresencePosition | null, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted || !position || !isPresenceCoordinate(position.x) || !isPresenceCoordinate(position.z)) return false;
    const snapshot = { x: position.x, z: position.z };
    if (lastSent && Math.hypot(snapshot.x - lastSent.x, snapshot.z - lastSent.z) <= 0.5 && now() - lastSent.at < IDLE_HEARTBEAT_MS) return false;
    await send(snapshot, signal);
    if (signal.aborted) return false;
    lastSent = { ...snapshot, at: now() };
    return true;
  };
}
