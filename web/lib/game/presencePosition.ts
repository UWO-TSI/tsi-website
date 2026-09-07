// Includes the enlarged coast and Isla Chica (z=72, walk radius 5.6).
export const PRESENCE_COORD_LIMIT = 80;

export function isPresenceCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= PRESENCE_COORD_LIMIT;
}
