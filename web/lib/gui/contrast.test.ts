import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The GUI sheet's text pairs are AA (4.5:1; 3:1 for large text and for the focus ring against the paper). */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../../styles/game-tokens.css");
const theme = (name: string) => read(`../../styles/themes/${name}.css`);
const uiHex = (sheet: string, name: string) => sheet.match(new RegExp(`--ui-${name}:\\s*(#[0-9a-f]{6})\\b`, "i"))?.[1];
/** A cream kit token: its own hex, or the cream base's value of the theme token it reads (styles/themes/cream.css). */
const hex = (name: string) => {
  const own = css.match(new RegExp(`--gui-${name}:\\s*(?:(#[0-9a-f]{6})\\b|var\\(--ui-([a-z0-9-]+)\\))`, "i"));
  const value = own?.[1] ?? (own?.[2] && uiHex(theme("cream"), own[2]));
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
  ...["common", "uncommon", "rare", "epic", "legendary"].map(r => ["ink-strong", `rarity-${r}`, 4.5] as [string, string, number]),
  // Divine's text is white (design bible UI 7) with a soft shadow on the moving holo: its flat purple holds 3:1.
  ["paper-hi", "rarity-divine", 3],
  ["paper-hi", "rarity-contraband", 4.5],
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

describe("UI themes (specs/polish/ui-themes.md)", () => {
  const tokens = (sheet: string) => [...sheet.matchAll(/^\s*(--ui-[a-z0-9-]+):/gm)].map(m => m[1]).sort();
  const themes = [...read("../../styles/themes/index.ts").matchAll(/import "\.\/([a-z-]+)\.css"/g)].map(m => m[1]);
  it.each(themes)("%s sets every token, as clean does", name => {
    expect(tokens(theme(name))).toEqual(tokens(theme("clean")));
  });
  it("paper things inside a flat menu wear the cream base's colours", () => {
    const paper = css.slice(css.indexOf("[data-gui-flat] [data-gui-paper] {"));
    const rule = css.slice(css.indexOf(":root, [data-gui-flat] {"), css.indexOf("}", css.indexOf(":root, [data-gui-flat] {")));
    const aliases = [...rule.matchAll(/--gui-([a-z0-9-]+): var\(--ui-([a-z0-9-]+)\);/g)].filter(m => uiHex(theme("cream"), m[2]));
    expect(aliases.length).toBeGreaterThan(15);
    for (const [, gui, ui] of aliases) expect(paper.match(new RegExp(`--gui-${gui}: (#[0-9a-f]{6});`))?.[1], gui).toBe(uiHex(theme("cream"), ui));
  });
  it.each(themes)("%s keeps its text AA on its panels and cards", name => {
    const t = theme(name), c = (k: string) => uiHex(t, k)!;
    for (const [fg, bg] of [["ink", "panel"], ["ink", "card"], ["ink-body", "card"], ["ink-2", "panel"], ["ink-2", "card"], ["muted", "card"], ["accent-ink", "accent"], ["ink", "select"]]) {
      expect(contrast(c(fg), c(bg)), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
