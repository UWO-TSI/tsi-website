"use client";

import { useEffect, type RefObject } from "react";
import { pollPresence } from "./mobilePresence";
import { createPositionHeartbeat, POSITION_POLL_MS, sendPosition, type PositionTransport, type PresencePosition } from "./positionHeartbeat";

/** Share on entry/movement and refresh idle presence before its five-minute expiry. */
export function usePositionHeartbeat(
  positionRef: RefObject<PresencePosition | null>,
  transport: PositionTransport = sendPosition,
): void {
  useEffect(() => {
    const update = createPositionHeartbeat(transport);
    return pollPresence((signal) => update(positionRef.current, signal), POSITION_POLL_MS, () => {}, () => {});
  }, [positionRef, transport]);
}
