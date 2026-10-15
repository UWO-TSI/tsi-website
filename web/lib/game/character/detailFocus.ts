/**
 * The character drawn at Full whatever the camera (head-v10, row 311: "high def when ... clicking into profile"): the
 * player whose card is open (components/game/net/cards.ts sets it). Character compares it with its own `id` each
 * frame (lod.ts detailSituation), so opening a card never re-renders anyone.
 */
let focused: string | null = null;
export function setDetailFocus(id: string | null) { focused = id; }
export const isDetailFocus = (id: string | undefined) => !!id && id === focused;
