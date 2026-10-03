import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same mapping as tsconfig `paths`: the shared contract lives in web/lib/net.
    alias: { "@net": fileURLToPath(new URL("../web/lib/net", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // Each file boots its own server on its own port; keep the suite small on the shared Mac mini.
    maxWorkers: 2,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
