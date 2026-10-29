import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // The member island's map as village()'s default (lib/game/world/member.ts), as the game and the server have it.
  test: { setupFiles: ["./lib/game/world/member.ts"] },
});
