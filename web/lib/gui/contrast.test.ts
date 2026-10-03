import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The GUI sheet's text pairs are AA (4.5:1; 3:1 for large text and for the focus ring against the paper). */
const css = readFileSync(new URL("../../styles/game-tokens.css", import.meta.url), "utf8");
const hex = (name: string) => {
  const value = css.match(new RegExp(`--gui-${name}:\\s*(#[0-9a-f]{6})\\b`, "i"))?.[1];
  if (!value) throw new Error(`--gui-${name} is not a hex colour`);
  return value;
};
const luminance = (h: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const CREAMS = ["page", "paper", "paper-hi", "paper-warm", "paper-deep", "butter"];
const PAIRS: [string, string, number][] = [
  ...["ink-strong", "ink", "ink-2", "muted"].flatMap(fg => CREAMS.map(bg => [fg, bg, 4.5] as [string, string, number])),
  ...["sage", "teal-ink", "wood", "coral-ink", "success", "danger", "warn", "info"].flatMap(fg => ["paper", "paper-hi", "paper-warm"].map(bg => [fg, bg, 4.5] as [string, string, number])),
  ["paper", "sage", 4.5], ["paper", "sage-deep", 4.5], ["paper", "teal-ink", 4.5], ["paper", "wood", 4.5], ["paper", "bark", 4.5],
  ["ink-strong", "coral", 4.5], ["ink-strong", "gold", 4.5], ["ink-strong", "orange", 4.5], ["ink", "teal-pill", 4.5], ["ink", "highlight", 4.5], ["ink", "stripe-a", 4.5],
  ["success", "success-soft", 4.5], ["danger", "danger-soft", 4.5], ["warn", "warn-soft", 4.5], ["info", "info-soft", 4.5], ["ink", "sage-soft", 4.5],
  ["paper", "night", 4.5],
  // Rarity badges: ink on every rarity colour (the catch card, the journal, the book).
  ...["common", "uncommon", "rare", "epic", "legendary", "seaking"].map(r => ["ink-strong", `rarity-${r}`, 4.5] as [string, string, number]),
  // Large text only: the kit's dialogue ink (18 px bold and up).
  ["taupe", "paper", 3],
  // Non-text: the focus ring against every cream it sits on.
  ...CREAMS.map(bg => ["focus", bg, 3] as [string, string, number]),
];

describe("GUI sheet contrast", () => {
  it.each(PAIRS)("%s on %s is at least %s:1", (fg, bg, min) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(min);
  });
});
