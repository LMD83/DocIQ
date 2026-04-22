import type { NextConfig } from "next";

/**
 * Staging config. The @neis/* path alias resolves to ../../convex/docroute/neis/*
 * which is outside apps/web. The NEIS TS modules use `.js` ESM-style imports
 * (required by Convex); webpack needs `extensionAlias` to resolve those back
 * to the TS source files here.
 */
const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve ??= {};
    (config.resolve as { extensionAlias?: Record<string, string[]> }).extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    resolveAlias: {
      // Turbopack reads the tsconfig paths alias natively; no extra mapping needed.
    },
  },
};

export default config;
