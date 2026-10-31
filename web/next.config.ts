import type { NextConfig } from "next";
import { hostRedirects, hostRewrites } from "./lib/hosts";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
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
  // The game's public files (models, textures, sounds) keep their names across deploys, so they can't be immutable.
  // Served from the browser's cache at once and checked in the background (stale-while-revalidate, a week): a return
  // visit no longer waits on a revalidation per file (~460 at entry). The trade-off: after a deploy that changes a file
  // in place, a returning player's first visit can draw the old file with the new code; the next visit has the new one.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=0, stale-while-revalidate=604800" }];
    return ["/assets/:path*", "/models/:path*", "/audio/:path*"].map(source => ({ source, headers: cache }));
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
