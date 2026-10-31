/**
 * A game file's URL with its content's version (`?v=<hash>`, lib/assetVersions.ts, read at build by next.config.ts),
 * which next.config.ts serves as immutable for a year: a deploy that changes a file in place changes its URL, so a
 * returning player never draws an old file with new code. A file the build didn't see keeps its bare URL, which the
 * browser revalidates on every use. three's loaders all go through it (lib/game/versionedLoads.ts); the audio, the
 * loading still and the title's prefetch call it themselves.
 */
const versions: Record<string, string> = JSON.parse(process.env.ASSET_VERSIONS || "{}");

export function assetUrl(url: string): string {
  const v = versions[url];
  return v ? `${url}?v=${v}` : url;
}
