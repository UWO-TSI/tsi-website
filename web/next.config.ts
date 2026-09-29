import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glb$/i,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
