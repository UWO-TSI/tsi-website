import { useId } from "react";
import { PERSON_PATH } from "./marks";

/**
 * The site's own nav icons, picked by David from the icon board (2026-11-11). Drawn bold or filled on a
 * 24 grid so they read at 16 px, like the round icon buttons in the game.
 */
type Props = { size?: number; className?: string };

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false });

/** Nonprofits. */
export function HeartIcon({ size = 16, className }: Props) {
  return (
    <svg {...box(size)} className={className}>
      <path fill="currentColor" d="M12 20.6c-.3 0-.5-.1-.7-.3C7.2 16.9 3 13.6 3 9.4 3 6.7 5.1 4.6 7.7 4.6c1.8 0 3.3.9 4.3 2.4 1-1.5 2.5-2.4 4.3-2.4 2.6 0 4.7 2.1 4.7 4.8 0 4.2-4.2 7.5-8.3 10.9-.2.2-.4.3-.7.3z" />
    </svg>
  );
}

/** GENESIS: a spark, the start of something. */
export function SparkIcon({ size = 16, className }: Props) {
  return (
    <svg {...box(size)} className={className}>
      <path fill="currentColor" d="M12 2c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9z" />
    </svg>
  );
}

/** Students: one person from the Tethos mark. */
export function PersonIcon({ size = 16, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="470 -5 470 567" aria-hidden="true" focusable="false" className={className}>
      <path fill="currentColor" d={PERSON_PATH} />
    </svg>
  );
}

/** Contact: the flap is cut out of the envelope, so the ground shows through it. */
export function EnvelopeIcon({ size = 16, className }: Props) {
  const id = useId();
  return (
    <svg {...box(size)} className={className}>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <path d="m5.6 8.6 6.4 4.6 6.4-4.6" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <path mask={`url(#${id})`} fill="currentColor" d="M4.2 4.8h15.6c1.2 0 2.2 1 2.2 2.2v10c0 1.2-1 2.2-2.2 2.2H4.2C3 19.2 2 18.2 2 17V7c0-1.2 1-2.2 2.2-2.2z" />
    </svg>
  );
}

/** Student portal: the island at play.tethos.ca. */
export function IslandIcon({ size = 16, className }: Props) {
  return (
    <svg {...box(size)} className={className}>
      <path fill="currentColor" d="M2 20.4c2-3.1 5.8-4.9 10-4.9s8 1.8 10 4.9z" />
      <path {...STROKE} d="M12.4 15.6c.1-3.1.9-5.7 2.6-7.8" />
      <path {...STROKE} strokeWidth={2.2} d="M15 7.8c-1.6-1.7-3.9-2.2-6-1.4M15 7.8c.4-2.2 2.3-3.6 4.7-3.5M15 7.8c2.2 0 3.9 1.3 4.6 3.3" />
    </svg>
  );
}

/** Sponsor: a coin in an open hand. */
export function CoinHandIcon({ size = 16, className }: Props) {
  return (
    <svg {...box(size)} className={className}>
      <circle cx="15.4" cy="6.6" r="3.7" fill="currentColor" />
      <path {...STROKE} d="M2.6 14.6h3.3l3.1 2h4.4c1 0 1.4-1.4.5-1.9l-2.6-1.2" />
      <path {...STROKE} d="M2.6 20.2h9.6l7.6-4.7c.9-.6.6-2-.5-2-.3 0-.6.1-.9.2l-4.4 2.2" />
    </svg>
  );
}
