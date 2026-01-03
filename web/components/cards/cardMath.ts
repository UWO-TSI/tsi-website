export const CARD_WIDTH = 330;
export const CARD_HEIGHT = 570;
export const CARD_SPACING = 0.75;
export const SMALL_LIFT = 30;
export const MAX_FAN_ANGLE = 18;

export function getCardTransform(index: number, total: number) {
  const t = index;
  const xOffset = t * (CARD_WIDTH * CARD_SPACING);
  const yOffset = Math.abs(t) * SMALL_LIFT;
  const rotation =
    total > 1 ? (t * MAX_FAN_ANGLE) / ((total - 1) / 2) : 0;

  return { xOffset, yOffset, rotation };
}
