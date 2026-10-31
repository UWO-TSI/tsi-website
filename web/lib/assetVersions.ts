import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Each of the game's public files (models, textures, sounds) by its URL path, to a short hash of its bytes: its version.
 * next.config.ts reads it at build into ASSET_VERSIONS for lib/assetUrl.ts, and serves a URL carrying it as immutable.
 */
export function assetVersions(publicDir: string, dirs = ["assets", "models", "audio"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of dirs) {
    for (const e of readdirSync(join(publicDir, dir), { recursive: true, withFileTypes: true })) {
      if (!e.isFile()) continue;
      const file = join(e.parentPath, e.name);
      out[`/${relative(publicDir, file).split(sep).join("/")}`] = createHash("sha256").update(readFileSync(file)).digest("base64url").slice(0, 8);
    }
  }
  return out;
}
