import type { NextConfig } from "next";
import { join } from "node:path";
import { assetVersions } from "./lib/assetVersions";
import { hostRedirects, hostRewrites } from "./lib/hosts";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // The game's files by path to their content's version, for lib/assetUrl.ts (production builds only: in dev a file
  // edited while the server runs must show on reload).
  env: { ASSET_VERSIONS: process.env.NODE_ENV === "production" ? JSON.stringify(assetVersions(join(__dirname, "public"))) : "{}" },
  // Retired pages: sponsorship lives on /genesis, /student is the portal's title screen (sign-in and sign-up).
  async redirects() {
    return [
      { source: "/company/:path*", destination: "/", permanent: true },
      { source: "/sponsor", destination: "/genesis#sponsor", permanent: true },
      { source: "/student/login", destination: "/student", permanent: true },
      { source: "/student/signup", destination: "/student?view=signup", permanent: true },
      ...hostRedirects,
    ];
  },
  // The game's public files (models, textures, sounds): a URL carrying its content's version (`?v=`, lib/assetUrl.ts)
  // never changes what it serves, so the browser keeps it a year without asking; a bare URL is checked on every use.
  async headers() {
    const v = [{ type: "query" as const, key: "v" }];
    return ["/assets/:path*", "/models/:path*", "/audio/:path*"].flatMap(source => [
      { source, missing: v, headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
      { source, has: v, headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ]);
  },
  async rewrites() {
    return { beforeFiles: hostRewrites, afterFiles: [], fallback: [] };
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glb$/i,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
