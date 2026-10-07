/**
 * The E prompt at a bench or a bed (world audit item 17): it offers the seat while you stand, and once you sit (or
 * lie down) the same key stands you up, so it says so. Sitting is read from the local avatar's held pose.
 */

/** The held clips of a seat or a bed (PlayerAvatar's `tsi:sit`, the study seats). */
const SEAT_POSES: ReadonlySet<string> = new Set(["Sit", "Study", "Stretch", "Sleep"]);

export const isSeatedPose = (pose: string | null | undefined): boolean => !!pose && SEAT_POSES.has(pose);

/** The prompt for a seat in reach: its own label, or "Stand up" while you are on it. */
export const seatPrompt = (label: string, seated: boolean): string => (seated ? "Stand up" : label);
