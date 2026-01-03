export const CARD_WIDTH = 330;
export const CARD_HEIGHT = 570;
export const CARD_SPACING = 0.9;
export const SMALL_LIFT = 30;
export const MAX_FAN_ANGLE = 18;

export function getCardTransform(index: -1 | 0 | 1) {
  const xOffset = index * CARD_WIDTH * CARD_SPACING;
  const yOffset = Math.abs(index) * SMALL_LIFT;
  const rotation = index * MAX_FAN_ANGLE;

  return { xOffset, yOffset, rotation };
}