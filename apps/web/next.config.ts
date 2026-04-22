import type { NextConfig } from "next";

/**
 * Staging config. The @neis/* path alias resolves to ../../convex/docroute/neis/*
 * which is outside apps/web. Turbopack (default since Next 15) handles this
 * cleanly; when running on webpack, the externalDir option below picks up
 * the transitive .ts files.
 */
const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    externalDir: true,
  },
};

export default config;
