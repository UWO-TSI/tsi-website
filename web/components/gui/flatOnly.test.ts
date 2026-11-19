import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_THEMES } from "@/styles/themes";

/**
 * Flat is the only look (ledger rows 320, 334 and 335; specs/design-bible.md, UI, "How it's built"). David, 2026-11-13: "im fed
 * up wit hthe game keep trying to use the old animal crossing ui kit", "make sure future dont drift back". This reads the
 * source tree and fails, naming the file and line, when the cream kit comes back. eslint.config.mjs stops the imports too.
 */
const WEB = join(__dirname, "..", "..");
/** Recruitment and the applicant island keep their own look, in their own code (row 334). */
const RECRUITMENT = ["components/recruit/", "app/student/apply/", "components/admin/"];
/** The one paper block: paper things stay paper in every pack (design bible UI 2). */
const PAPER = "styles/paper.css";
/** UI packs (row 335): a theme file may hold any values. */
const THEMES = "styles/themes/";
const SELF = "components/gui/flatOnly.test.ts";
const CREAM_HEX = ["f7f1da", "fffbe7", "fffff7", "f8f4e8", "eee9ca", "e3d9b8", "d3c39c", "ffeea0", "3a2e22", "4f3f31", "6b5843", "726450", "8a7b66", "946429", "bb813f", "725c4e"];

const files = (dir: string): string[] => readdirSync(join(WEB, dir)).flatMap(name => {
  const path = `${dir}/${name}`;
  if (name === "node_modules" || name.startsWith(".")) return [];
  return statSync(join(WEB, path)).isDirectory() ? files(path) : /\.(tsx?|css|mjs)$/.test(name) ? [path] : [];
});
const SOURCE = ["app", "components", "lib", "styles"].flatMap(files).map(p => p.split(sep).join("/"));
const read = (path: string) => readFileSync(join(WEB, path), "utf8");
const inRecruitment = (path: string) => RECRUITMENT.some(dir => path.startsWith(dir));
/** Every line of `paths` matching `re`, as "file:line: text". */
const hits = (paths: readonly string[], re: RegExp) => paths.flatMap(path => read(path).split("\n").flatMap((line, i) => re.test(line) ? [`${path}:${i + 1}: ${line.trim().slice(0, 140)}`] : []));
const fail = (found: string[], instead: string) => expect(found, found.length ? `${instead}\n${found.join("\n")}` : "").toEqual([]);

describe("flat is the only look (rows 334, 335)", () => {
  const game = SOURCE.filter(p => !inRecruitment(p) && p !== SELF);

  it("nothing outside recruitment imports the recruit kit or a cream path", () => {
    fail(hits(game, /(from|import)\s*\(?\s*["'][^"']*(recruit\/ui|gui\/cream|\/cream)(\/[^"']*)?["']/),
      "Use the flat kit (@/components/gui: Button, Field, TextArea, Keycap, Dialogue; @/components/gui/flat for the rest). The recruit kit is recruitment's own.");
  });

  it("components/gui/cream is gone", () => {
    expect(existsSync(join(WEB, "components/gui/cream")), "Its pieces live in the flat kit (components/gui/flat: Section, Folds, Fold, QuietButton, BackLink).").toBe(false);
  });

  it("there is no cream theme", () => {
    expect(UI_THEMES as readonly string[], "The old cream look comes back only as the vintage pack (styles/themes/vintage.css; rows 334 and 335), never as the base or a theme named cream.").not.toContain("cream");
    expect(existsSync(join(WEB, "styles/themes/cream.css")), "styles/themes/cream.css: the clean theme is the base (row 334).").toBe(false);
  });

  it("no code asks for the cream variant or theme", () => {
    fail(hits(SOURCE.filter(p => /^(app|components|lib)\//.test(p) && p !== SELF), /variant=["{]*"?cream"|variant:\s*"cream"|uitheme=cream|data-ui-theme=["{]*"?cream"/),
      "There is one look: drop the variant. A theme is a UI pack (styles/themes), worn by <body data-ui-theme>.");
  });

  it("no cream palette hex outside the themes, the paper block and recruitment", () => {
    const re = new RegExp(`#(${CREAM_HEX.join("|")})\\b`, "i");
    fail(hits(game.filter(p => !p.startsWith(THEMES) && p !== PAPER), re),
      "Read a --ui-* token (styles/themes/clean.css). For a thing that is paper in the world, set data-gui-paper and read the --gui-* paper tokens (styles/paper.css).");
  });

  it("only clean.css sets :root or body; every other theme file only its own [data-ui-theme]", () => {
    const sheets = readdirSync(join(WEB, THEMES)).filter(f => f.endsWith(".css"));
    expect(sheets).toContain("clean.css");
    for (const sheet of sheets) {
      const name = sheet.replace(/\.css$/, "");
      const selectors = [...read(THEMES + sheet).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)].flatMap(m => m[1].split(",").map(s => s.trim())).filter(Boolean);
      const own = `[data-ui-theme="${name}"]`;
      const bad = selectors.filter(s => sheet === "clean.css" ? ![":root", own].includes(s) : s !== own);
      expect(bad, `${THEMES}${sheet}: a pack wears only ${own} (the clean theme alone is the base on :root).`).toEqual([]);
    }
  });

  it("no component names a UI theme", () => {
    const names = UI_THEMES.join("|");
    const allowed = (p: string) => p === "styles/themes/index.ts" || p === "components/gui/DevUiTheme.tsx" || /^app\/(lab|dev)\//.test(p) || p === SELF;
    // The bare words collide ("dark" is also the site's section tone), so this catches a theme being worn or asked for.
    const re = new RegExp(`data-ui-theme=["{]*"?(${names})\\b|uitheme=(${names})\\b|setUiTheme\\(\\s*["'](${names})["']|uiTheme\\s*=\\s*["'](${names})["']`);
    fail(hits(SOURCE.filter(p => !allowed(p) && !p.startsWith(THEMES)), re),
      "Components read --ui-* tokens and never name a theme: <body data-ui-theme> wears the player's pack (styles/themes/index.ts setUiTheme).");
  });
});
