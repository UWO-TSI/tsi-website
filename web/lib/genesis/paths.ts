/** genesis.tethos.ca serves /pass from its root (lib/hosts.ts); everywhere else (localhost, previews) the pages keep /pass. */
export const onGenesisHost = (host: string | null | undefined) => /^genesis\./i.test(host ?? "");
export const passHref = (host: string | null | undefined, path = "/") =>
  onGenesisHost(host) ? path : `/pass${path === "/" ? "" : path}`;
