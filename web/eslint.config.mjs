import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Flat is the only look (ledger rows 334 and 335; specs/design-bible.md, UI, "How it's built"). The recruit kit is
  // recruitment's own; the cream kit is gone. components/gui/flatOnly.test.ts checks the same and more.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["components/recruit/**", "app/student/apply/**", "components/admin/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/components/recruit/ui", "@/components/recruit/ui/*", "**/recruit/ui", "**/recruit/ui/*"],
            message: "The recruit kit is recruitment's own. Use the flat kit: @/components/gui (Button, Field, TextArea, Keycap, Dialogue) and @/components/gui/flat (design bible UI; ledger row 334)." },
          { group: ["**/gui/cream", "**/gui/cream/*", "**/themes/cream.css"],
            message: "The cream kit is gone. Use the flat kit (@/components/gui/flat: Section, Folds, Fold, QuietButton, BackLink; design bible UI; ledger row 334)." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
