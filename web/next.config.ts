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
