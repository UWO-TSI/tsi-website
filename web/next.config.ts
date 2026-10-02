import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Retired pages: sponsorship lives on /genesis, /student is the game portal login.
  async redirects() {
    return [
      { source: "/company/:path*", destination: "/", permanent: true },
      { source: "/sponsor", destination: "/genesis#sponsor", permanent: true },
      { source: "/student/login", destination: "/student", permanent: true },
    ];
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
