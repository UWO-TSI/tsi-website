export const DEFAULT_CARD_WIDTH = 330;
export const DEFAULT_CARD_HEIGHT = 570;
export const DEFAULT_CARD_SPACING = 0.75;
export const DEFAULT_SMALL_LIFT = 30;
export const DEFAULT_MAX_FAN_ANGLE = 18;

export interface CardDimensions {
  width?: number;
  height?: number;
  spacing?: number;
  lift?: number;
  fanAngle?: number;
}

export function getCardTransform(
  index: number,
  total: number,
  dimensions: CardDimensions = {}
) {
  const {
    width = DEFAULT_CARD_WIDTH,
    spacing = DEFAULT_CARD_SPACING,
    lift = DEFAULT_SMALL_LIFT,
    fanAngle = DEFAULT_MAX_FAN_ANGLE,
  } = dimensions;

  const t = index;
  const xOffset = t * (width * spacing);
  const yOffset = Math.abs(t) * lift;
  const rotation = total > 1 ? (t * fanAngle) / ((total - 1) / 2) : 0;

  return { xOffset, yOffset, rotation };
}